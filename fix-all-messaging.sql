-- COMPREHENSIVE FIX FOR ALL MESSAGING
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: Check if tables exist, create if not
-- ============================================

-- Ensure conversations table exists with all needed columns
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user1_key_encrypted TEXT,
  user2_key_encrypted TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure messages table exists
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL,
  message_type TEXT DEFAULT 'message',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 2: Add type column for group chats (optional - won't break if fails)
-- ============================================

DO $$
BEGIN
  -- Add type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'conversations'
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN type TEXT DEFAULT 'private';
  END IF;

  -- Add group_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'conversations'
    AND column_name = 'group_name'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN group_name TEXT;
  END IF;

  -- Add creator_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'conversations'
    AND column_name = 'creator_id'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN creator_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Update any NULL type values to 'private'
UPDATE public.conversations SET type = 'private' WHERE type IS NULL;

-- ============================================
-- STEP 3: Create conversation_members table for groups
-- ============================================

CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- ============================================
-- STEP 4: Enable RLS on all tables
-- ============================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: DROP ALL existing policies (clean slate)
-- ============================================

-- Conversations policies
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their conversations" ON public.conversations;
DROP POLICY IF EXISTS "conv_select" ON public.conversations;
DROP POLICY IF EXISTS "conv_insert" ON public.conversations;
DROP POLICY IF EXISTS "conv_update" ON public.conversations;
DROP POLICY IF EXISTS "conv_delete" ON public.conversations;

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "msg_select" ON public.messages;
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_update" ON public.messages;
DROP POLICY IF EXISTS "msg_delete" ON public.messages;

-- Conversation members policies
DROP POLICY IF EXISTS "Members can view group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Creator can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Creator can remove members or self can leave" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_select" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_insert" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_delete" ON public.conversation_members;

-- ============================================
-- STEP 6: Create NEW policies for CONVERSATIONS
-- ============================================

-- SELECT: User can see conversations they're part of (direct or group)
CREATE POLICY "conv_select" ON public.conversations
  FOR SELECT USING (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = id AND user_id = auth.uid()
    )
  );

-- INSERT: User can create conversations where they're a participant
CREATE POLICY "conv_insert" ON public.conversations
  FOR INSERT WITH CHECK (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
  );

-- UPDATE: User can update conversations they're part of
CREATE POLICY "conv_update" ON public.conversations
  FOR UPDATE USING (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
  );

-- DELETE: User can delete conversations they're part of
CREATE POLICY "conv_delete" ON public.conversations
  FOR DELETE USING (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
  );

-- ============================================
-- STEP 7: Create NEW policies for MESSAGES
-- ============================================

-- SELECT: User can see messages in conversations they're part of
CREATE POLICY "msg_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (
        c.user1_id = auth.uid()
        OR c.user2_id = auth.uid()
        OR c.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: User can send messages to conversations they're part of
CREATE POLICY "msg_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (
        c.user1_id = auth.uid()
        OR c.user2_id = auth.uid()
        OR c.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        )
      )
    )
  );

-- UPDATE: User can update messages in their conversations
CREATE POLICY "msg_update" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (
        c.user1_id = auth.uid()
        OR c.user2_id = auth.uid()
        OR c.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        )
      )
    )
  );

-- DELETE: User can delete their own messages
CREATE POLICY "msg_delete" ON public.messages
  FOR DELETE USING (
    sender_id = auth.uid()
  );

-- ============================================
-- STEP 8: Create NEW policies for CONVERSATION_MEMBERS
-- ============================================

-- SELECT: Members can see other members
CREATE POLICY "cm_select" ON public.conversation_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members cm2
      WHERE cm2.conversation_id = conversation_id AND cm2.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
  );

-- INSERT: Creator can add members, or user adds themselves
CREATE POLICY "cm_insert" ON public.conversation_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
  );

-- DELETE: User can leave, or creator can remove
CREATE POLICY "cm_delete" ON public.conversation_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
  );

-- ============================================
-- STEP 9: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON public.conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_creator ON public.conversations(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id);

-- ============================================
-- DONE!
-- ============================================

SELECT 'ALL MESSAGING FIXED!' as result;
