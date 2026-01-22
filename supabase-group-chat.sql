-- =============================================================================
-- Love1Another - Group Chat Feature SQL Setup
-- =============================================================================
-- Run this to add group chat functionality to your existing database.
-- This modifies conversations to support groups and adds member management.
-- =============================================================================

-- =============================================================================
-- 1. MODIFY CONVERSATIONS TABLE FOR GROUPS
-- =============================================================================

-- Add columns for group support
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'private' CHECK (type IN ('private', 'group')),
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS group_avatar_path TEXT,
  ADD COLUMN IF NOT EXISTS creator_id UUID;

-- Make user1_id and user2_id nullable for group conversations
ALTER TABLE public.conversations
  ALTER COLUMN user1_id DROP NOT NULL,
  ALTER COLUMN user2_id DROP NOT NULL;

-- =============================================================================
-- 2. CREATE CONVERSATION MEMBERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON public.conversation_members(user_id);

-- =============================================================================
-- 3. RLS POLICIES FOR CONVERSATION_MEMBERS
-- =============================================================================

-- Enable RLS
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join conversations they are invited to" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can add members to groups" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can leave conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove members from groups" ON public.conversation_members;

-- View members: Users can see members of conversations they are part of
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
    )
  );

-- Insert: Admins can add members, or users can be added to new conversations
CREATE POLICY "Admins can add members to groups"
  ON public.conversation_members FOR INSERT
  WITH CHECK (
    -- User is admin of the conversation
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
    -- OR this is the creator adding themselves as first member
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_members.conversation_id
      AND c.creator_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.conversation_members cm2
        WHERE cm2.conversation_id = c.id
      )
    )
    -- OR user is adding themselves to a new conversation they're creating
    OR conversation_members.user_id = auth.uid()
  );

-- Delete: Users can remove themselves (leave), admins can remove others
CREATE POLICY "Users can leave or admins can remove"
  ON public.conversation_members FOR DELETE
  USING (
    -- User is removing themselves (leaving)
    user_id = auth.uid()
    -- OR user is admin removing someone else
    OR EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );

-- =============================================================================
-- 4. UPDATE CONVERSATIONS RLS FOR GROUPS
-- =============================================================================

-- Drop and recreate conversation policies to support groups
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their conversations" ON public.conversations;

-- View: Users can see private conversations they're part of, or group conversations they're members of
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    -- Private conversation
    (type = 'private' AND (user1_id = auth.uid() OR user2_id = auth.uid()))
    -- OR group conversation where user is a member
    OR (type = 'group' AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = id
      AND cm.user_id = auth.uid()
    ))
  );

-- Create: Any authenticated user can create
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Update: Users can update private conversations they're part of, or groups they admin
CREATE POLICY "Users can update their conversations"
  ON public.conversations FOR UPDATE
  USING (
    (type = 'private' AND (user1_id = auth.uid() OR user2_id = auth.uid()))
    OR (type = 'group' AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    ))
  );

-- Delete: Users can delete private conversations, admins can delete groups
CREATE POLICY "Users can delete their conversations"
  ON public.conversations FOR DELETE
  USING (
    (type = 'private' AND (user1_id = auth.uid() OR user2_id = auth.uid()))
    OR (type = 'group' AND creator_id = auth.uid())
  );

-- =============================================================================
-- 5. UPDATE MESSAGES RLS FOR GROUPS
-- =============================================================================

-- Drop existing messages policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;

-- View messages: Must be part of the conversation
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id
          AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- Send messages: Must be part of the conversation
CREATE POLICY "Users can send messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id
          AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- =============================================================================
-- 6. HELPER FUNCTION: GET USER'S GROUP CONVERSATIONS
-- =============================================================================

-- Drop existing function first if it exists (return type may have changed)
DROP FUNCTION IF EXISTS public.get_user_group_conversations(UUID);

CREATE OR REPLACE FUNCTION public.get_user_group_conversations(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  group_name TEXT,
  group_avatar_path TEXT,
  creator_id UUID,
  member_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.group_name,
    c.group_avatar_path,
    c.creator_id,
    (SELECT COUNT(*) FROM public.conversation_members cm WHERE cm.conversation_id = c.id) as member_count,
    c.created_at,
    c.updated_at
  FROM public.conversations c
  INNER JOIN public.conversation_members cm ON cm.conversation_id = c.id
  WHERE c.type = 'group'
  AND cm.user_id = p_user_id
  ORDER BY c.updated_at DESC;
END;
$$;

-- =============================================================================
-- 7. HELPER FUNCTION: GET GROUP MEMBERS WITH USER INFO
-- =============================================================================

-- Drop existing function first if it exists (return type may have changed)
DROP FUNCTION IF EXISTS public.get_group_members(UUID);

CREATE OR REPLACE FUNCTION public.get_group_members(p_conversation_id UUID)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE,
  email TEXT,
  full_name TEXT,
  username TEXT,
  avatar_initials TEXT,
  avatar_color TEXT,
  avatar_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.user_id,
    cm.role,
    cm.joined_at,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))::TEXT as full_name,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))::TEXT as username,
    (u.raw_user_meta_data->>'avatar_initials')::TEXT as avatar_initials,
    COALESCE(u.raw_user_meta_data->>'avatar_color', '#7c9bb8')::TEXT as avatar_color,
    (u.raw_user_meta_data->>'avatar_path')::TEXT as avatar_path
  FROM public.conversation_members cm
  INNER JOIN auth.users u ON u.id = cm.user_id
  WHERE cm.conversation_id = p_conversation_id
  ORDER BY cm.role DESC, cm.joined_at ASC;
END;
$$;

-- =============================================================================
-- 8. FUNCTION: CREATE GROUP CONVERSATION
-- =============================================================================

-- Drop existing function first if it exists (signature may have changed)
DROP FUNCTION IF EXISTS public.create_group_conversation(TEXT, UUID[], UUID);

CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_group_name TEXT,
  p_member_ids UUID[],
  p_creator_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
  v_member_id UUID;
BEGIN
  -- Create the conversation
  INSERT INTO public.conversations (type, group_name, creator_id)
  VALUES ('group', p_group_name, p_creator_id)
  RETURNING id INTO v_conversation_id;

  -- Add creator as admin
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (v_conversation_id, p_creator_id, 'admin');

  -- Add other members
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id != p_creator_id THEN
      INSERT INTO public.conversation_members (conversation_id, user_id, role)
      VALUES (v_conversation_id, v_member_id, 'member')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_group_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(TEXT, UUID[], UUID) TO authenticated;
