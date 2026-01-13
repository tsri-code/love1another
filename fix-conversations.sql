-- Fix conversations table for messaging
-- Run this in Supabase SQL Editor

-- 1. Add the type column if it doesn't exist
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'private';

-- 2. Update any existing rows that have NULL type
UPDATE public.conversations SET type = 'private' WHERE type IS NULL;

-- 3. Add the NOT NULL constraint if not present (ignore error if already exists)
DO $$
BEGIN
  ALTER TABLE public.conversations ALTER COLUMN type SET NOT NULL;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- 4. Add the check constraint if not present
DO $$
BEGIN
  ALTER TABLE public.conversations ADD CONSTRAINT conversations_type_check CHECK (type IN ('private', 'group'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 5. Add group chat columns if not present
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_avatar_path TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id);

-- 6. Drop old RLS policies that may be blocking
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their conversations" ON public.conversations;

-- 7. Create updated RLS policies for conversations
CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (
    (type = 'private' AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND EXISTS (
      SELECT 1 FROM public.conversation_members 
      WHERE conversation_id = id AND user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    (type = 'private' AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

CREATE POLICY "Users can update their conversations" ON public.conversations
  FOR UPDATE USING (
    (type = 'private' AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

CREATE POLICY "Users can delete their conversations" ON public.conversations
  FOR DELETE USING (
    (type = 'private' AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

-- 8. Create conversation_members table if not exists
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- 9. Enable RLS on conversation_members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- 10. Drop old conversation_members policies
DROP POLICY IF EXISTS "Members can view group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Creator can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Creator can remove members or self can leave" ON public.conversation_members;

-- 11. Create conversation_members RLS policies
CREATE POLICY "Members can view group members" ON public.conversation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Creator can add members" ON public.conversation_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
    OR
    (user_id = auth.uid() AND role = 'creator')
  );

CREATE POLICY "Creator can remove members or self can leave" ON public.conversation_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
  );

-- 12. Update messages RLS policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

CREATE POLICY "Users can send messages to their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- Done!
SELECT 'Conversations and messages fixed!' as result;
