-- =============================================================================
-- COMPLETE MESSAGING SYSTEM FIX
-- =============================================================================
-- Run this in your Supabase SQL Editor
--
-- Fixes:
-- 1. Infinite recursion in RLS policies
-- 2. NOT NULL constraints blocking group chat creation
-- 3. Proper handling of private vs group conversations
-- 4. Messages and prayer requests support
-- =============================================================================

-- =============================================================================
-- STEP 1: Fix table constraints for group chats
-- =============================================================================

-- Make user1_key_encrypted and user2_key_encrypted nullable (they're only for private chats)
ALTER TABLE public.conversations ALTER COLUMN user1_key_encrypted DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user2_key_encrypted DROP NOT NULL;

-- Make user1_id and user2_id nullable (they're only for private chats, groups use conversation_members)
ALTER TABLE public.conversations ALTER COLUMN user1_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user2_id DROP NOT NULL;

-- Ensure all existing private conversations have type set
UPDATE public.conversations
SET type = 'private'
WHERE type IS NULL;

-- =============================================================================
-- STEP 2: Drop ALL existing policies to start fresh
-- =============================================================================

-- Conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
DROP POLICY IF EXISTS "conv_select" ON public.conversations;
DROP POLICY IF EXISTS "conv_insert" ON public.conversations;
DROP POLICY IF EXISTS "conv_update" ON public.conversations;
DROP POLICY IF EXISTS "conv_delete" ON public.conversations;

-- Messages
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "msg_select" ON public.messages;
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_update" ON public.messages;
DROP POLICY IF EXISTS "msg_delete" ON public.messages;

-- Conversation Members
DROP POLICY IF EXISTS "Users can view group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can add group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove group members" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_select" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_insert" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_delete" ON public.conversation_members;

-- =============================================================================
-- STEP 3: Create helper function to check conversation access (avoids recursion)
-- =============================================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.user_has_conversation_access(UUID, UUID);

-- Create a SECURITY DEFINER function that bypasses RLS to check access
-- This prevents infinite recursion by not triggering RLS policies
CREATE OR REPLACE FUNCTION public.user_has_conversation_access(
  p_user_id UUID,
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_record RECORD;
BEGIN
  -- Get conversation details directly (bypasses RLS due to SECURITY DEFINER)
  SELECT type, user1_id, user2_id, creator_id
  INTO conv_record
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check access based on conversation type
  IF conv_record.type = 'private' OR conv_record.type IS NULL THEN
    -- Private conversation: user must be user1 or user2
    RETURN p_user_id = conv_record.user1_id OR p_user_id = conv_record.user2_id;
  ELSIF conv_record.type = 'group' THEN
    -- Group conversation: user must be creator or member
    IF p_user_id = conv_record.creator_id THEN
      RETURN TRUE;
    END IF;
    -- Check membership (direct query, no RLS)
    RETURN EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = p_conversation_id AND user_id = p_user_id
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.user_has_conversation_access TO authenticated;

-- =============================================================================
-- STEP 4: Create SIMPLE conversation policies (no cross-table references)
-- =============================================================================

-- Conversations SELECT: Direct check on conversation fields only
CREATE POLICY "conv_select" ON public.conversations
  FOR SELECT USING (
    -- Private: user is participant
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    -- Group: user is creator
    OR creator_id = auth.uid()
    -- Group: user is member (use function to avoid recursion)
    OR (type = 'group' AND public.user_has_conversation_access(auth.uid(), id))
  );

-- Conversations INSERT
CREATE POLICY "conv_insert" ON public.conversations
  FOR INSERT WITH CHECK (
    -- Private: user is one of the participants
    (type IS NULL AND (user1_id = auth.uid() OR user2_id = auth.uid()))
    OR (type = 'private' AND (user1_id = auth.uid() OR user2_id = auth.uid()))
    -- Group: user is the creator
    OR (type = 'group' AND creator_id = auth.uid())
  );

-- Conversations UPDATE
CREATE POLICY "conv_update" ON public.conversations
  FOR UPDATE USING (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
  );

-- Conversations DELETE
CREATE POLICY "conv_delete" ON public.conversations
  FOR DELETE USING (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
  );

-- =============================================================================
-- STEP 5: Create conversation_members policies (NO self-reference)
-- =============================================================================

-- Members SELECT: Can see members of conversations you're part of
CREATE POLICY "cm_select" ON public.conversation_members
  FOR SELECT USING (
    -- You can always see your own membership
    user_id = auth.uid()
    -- Or you're the creator of the conversation
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
    -- Or you're also a member (use function to check without recursion)
    OR public.user_has_conversation_access(auth.uid(), conversation_id)
  );

-- Members INSERT: Creator or admin can add
CREATE POLICY "cm_insert" ON public.conversation_members
  FOR INSERT WITH CHECK (
    -- Creator can add members
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
  );

-- Members DELETE: Creator can remove, or user can leave
CREATE POLICY "cm_delete" ON public.conversation_members
  FOR DELETE USING (
    -- Creator can remove anyone
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
    -- Users can leave (remove themselves)
    OR user_id = auth.uid()
  );

-- =============================================================================
-- STEP 6: Create messages policies (use helper function)
-- =============================================================================

-- Messages SELECT: Can view messages in conversations you have access to
CREATE POLICY "msg_select" ON public.messages
  FOR SELECT USING (
    public.user_has_conversation_access(auth.uid(), conversation_id)
  );

-- Messages INSERT: Can send messages/prayer_requests to conversations you have access to
CREATE POLICY "msg_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND public.user_has_conversation_access(auth.uid(), conversation_id)
  );

-- Messages UPDATE: Can update messages in your conversations (for read status etc)
CREATE POLICY "msg_update" ON public.messages
  FOR UPDATE USING (
    public.user_has_conversation_access(auth.uid(), conversation_id)
  );

-- Messages DELETE: Can delete your own messages
CREATE POLICY "msg_delete" ON public.messages
  FOR DELETE USING (
    sender_id = auth.uid()
  );

-- =============================================================================
-- STEP 7: Create group chat helper functions
-- =============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS public.create_group_conversation(TEXT, UUID[], UUID);
DROP FUNCTION IF EXISTS public.get_user_group_conversations(UUID);

-- Function to create a group conversation with members
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_group_name TEXT,
  p_member_ids UUID[],
  p_creator_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_member_id UUID;
BEGIN
  -- Create the group conversation
  INSERT INTO public.conversations (type, group_name, creator_id)
  VALUES ('group', p_group_name, p_creator_id)
  RETURNING id INTO v_conversation_id;

  -- Add creator as admin member
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (v_conversation_id, p_creator_id, 'admin');

  -- Add other members
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id != p_creator_id THEN
      INSERT INTO public.conversation_members (conversation_id, user_id, role)
      VALUES (v_conversation_id, v_member_id, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

-- Function to get user's group conversations with member info
CREATE OR REPLACE FUNCTION public.get_user_group_conversations(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  group_name TEXT,
  group_avatar_path TEXT,
  creator_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  member_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.group_name,
    c.group_avatar_path,
    c.creator_id,
    c.created_at,
    c.updated_at,
    (SELECT COUNT(*) FROM public.conversation_members cm WHERE cm.conversation_id = c.id) as member_count
  FROM public.conversations c
  WHERE c.type = 'group'
    AND (
      c.creator_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = c.id AND cm.user_id = p_user_id
      )
    )
  ORDER BY c.updated_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_group_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_group_conversations TO authenticated;

-- =============================================================================
-- STEP 8: Ensure message_type supports both 'message' and 'prayer_request'
-- =============================================================================

-- Update the check constraint if it exists
DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

  -- Add new constraint allowing both types
  ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN ('message', 'prayer_request'));
EXCEPTION
  WHEN others THEN
    -- Constraint might already be correct, ignore
    NULL;
END $$;

-- =============================================================================
-- DONE!
-- =============================================================================

SELECT 'Complete messaging system fix applied!' as result;
