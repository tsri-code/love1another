-- =============================================================================
-- FINAL MESSAGING FIX - SECURITY DEFINER + SOFT DELETE + RLS
-- =============================================================================
-- This script:
-- 1. Fixes existing data before adding constraints
-- 2. Creates conversation_deletions table for per-user soft delete
-- 3. Uses SECURITY DEFINER functions for access control
-- 4. Re-enables RLS with deny-all policies (functions bypass RLS)
--
-- RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR
-- =============================================================================

-- =============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES ON MESSAGING TABLES
-- =============================================================================
-- Drop every single policy shown in the Supabase dashboard

-- conversation_members policies (ALL of them)
DROP POLICY IF EXISTS "Admins can add members to groups" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_delete" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_insert" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_select" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_update" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can leave or admins can remove" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can add group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can view group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Creator can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Creator can remove members or self can leave" ON public.conversation_members;

-- conversations policies (ALL of them)
DROP POLICY IF EXISTS "conv_delete" ON public.conversations;
DROP POLICY IF EXISTS "conv_insert" ON public.conversations;
DROP POLICY IF EXISTS "conv_select" ON public.conversations;
DROP POLICY IF EXISTS "conv_update" ON public.conversations;
DROP POLICY IF EXISTS "Users can access own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- messages policies (ALL of them)
DROP POLICY IF EXISTS "msg_delete" ON public.messages;
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_select" ON public.messages;
DROP POLICY IF EXISTS "msg_update" ON public.messages;
DROP POLICY IF EXISTS "Users can access messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;

-- =============================================================================
-- STEP 2: FIX TABLE CONSTRAINTS
-- =============================================================================

-- Make columns nullable for group chats (groups don't have user1/user2)
DO $$
BEGIN
  ALTER TABLE public.conversations ALTER COLUMN user1_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.conversations ALTER COLUMN user2_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.conversations ALTER COLUMN user1_key_encrypted DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.conversations ALTER COLUMN user2_key_encrypted DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- IMPORTANT: Fix existing data BEFORE adding constraint
-- Step 1: Drop the constraint if it exists
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_type_check;

-- Step 2: Fix all existing data to have valid types
-- Private chats: have user1_id and user2_id
UPDATE public.conversations
SET type = 'private'
WHERE user1_id IS NOT NULL AND user2_id IS NOT NULL
  AND (type IS NULL OR type NOT IN ('private', 'group'));

-- Group chats: have creator_id but no user1_id/user2_id
UPDATE public.conversations
SET type = 'group'
WHERE creator_id IS NOT NULL AND user1_id IS NULL
  AND (type IS NULL OR type NOT IN ('private', 'group'));

-- Fallback: any remaining NULL types default to private
UPDATE public.conversations SET type = 'private' WHERE type IS NULL;

-- Step 3: NOW add the constraint (all data should be valid)
ALTER TABLE public.conversations ADD CONSTRAINT conversations_type_check
  CHECK (type IN ('private', 'group'));

-- =============================================================================
-- STEP 3: CREATE CONVERSATION_DELETIONS TABLE FOR SOFT DELETE
-- =============================================================================
-- This table tracks which users have "deleted" a conversation
-- The conversation and messages remain for other participants

CREATE TABLE IF NOT EXISTS public.conversation_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversation_deletions_user
  ON public.conversation_deletions(user_id, conversation_id);

-- =============================================================================
-- STEP 4: ENABLE RLS WITH DENY-ALL POLICIES
-- =============================================================================
-- RLS is enabled but denies all direct access
-- SECURITY DEFINER functions bypass RLS, so they still work
-- This protects data from direct queries via anon/authenticated keys

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_deletions ENABLE ROW LEVEL SECURITY;

-- Drop any existing deny policies first
DROP POLICY IF EXISTS "deny_all_direct_access" ON public.conversations;
DROP POLICY IF EXISTS "deny_all_direct_access" ON public.messages;
DROP POLICY IF EXISTS "deny_all_direct_access" ON public.conversation_members;
DROP POLICY IF EXISTS "deny_all_direct_access" ON public.conversation_deletions;

-- Create deny-all policies - blocks all direct queries
-- SECURITY DEFINER functions bypass these policies
CREATE POLICY "deny_all_direct_access" ON public.conversations
  FOR ALL USING (false);

CREATE POLICY "deny_all_direct_access" ON public.messages
  FOR ALL USING (false);

CREATE POLICY "deny_all_direct_access" ON public.conversation_members
  FOR ALL USING (false);

CREATE POLICY "deny_all_direct_access" ON public.conversation_deletions
  FOR ALL USING (false);

-- =============================================================================
-- STEP 4: DROP ALL EXISTING MESSAGING FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_user_conversations(UUID);
DROP FUNCTION IF EXISTS public.get_or_create_private_conversation(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_conversation_messages(UUID, INT, BOOLEAN);
DROP FUNCTION IF EXISTS public.send_message(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_message(UUID);
DROP FUNCTION IF EXISTS public.mark_messages_read(UUID);
DROP FUNCTION IF EXISTS public.create_group_conversation(TEXT, UUID[], UUID);
DROP FUNCTION IF EXISTS public.get_user_group_conversations(UUID);
DROP FUNCTION IF EXISTS public.get_group_members(UUID);
DROP FUNCTION IF EXISTS public.user_has_conversation_access(UUID, UUID);
DROP FUNCTION IF EXISTS public.delete_conversation(UUID);

-- =============================================================================
-- STEP 5: CREATE SECURITY DEFINER FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: Check if user has access to a conversation
-- Also checks if user has "deleted" (soft-deleted) the conversation
-- -----------------------------------------------------------------------------
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
  v_conv RECORD;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if user has soft-deleted this conversation
  IF EXISTS (
    SELECT 1 FROM conversation_deletions
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id
  ) THEN
    RETURN FALSE;
  END IF;

  -- Private conversation: check user1_id or user2_id
  IF v_conv.user1_id = p_user_id OR v_conv.user2_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Group conversation: check creator or membership
  IF v_conv.type = 'group' THEN
    IF v_conv.creator_id = p_user_id THEN
      RETURN TRUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = p_conversation_id AND user_id = p_user_id
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Get all conversations for a user (private + groups)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  type TEXT,
  user1_id UUID,
  user2_id UUID,
  group_name TEXT,
  group_avatar_path TEXT,
  creator_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.type,
    c.user1_id,
    c.user2_id,
    c.group_name,
    c.group_avatar_path,
    c.creator_id,
    c.created_at,
    c.updated_at,
    (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) as last_message_at,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != p_user_id AND m.is_read = FALSE) as unread_count
  FROM conversations c
  WHERE
    -- Exclude soft-deleted conversations
    NOT EXISTS (
      SELECT 1 FROM conversation_deletions cd
      WHERE cd.conversation_id = c.id AND cd.user_id = p_user_id
    )
    AND (
      -- Private conversations
      (c.type = 'private' AND (c.user1_id = p_user_id OR c.user2_id = p_user_id))
      OR
      -- Group conversations (creator or member)
      (c.type = 'group' AND (
        c.creator_id = p_user_id
        OR EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = p_user_id)
      ))
    )
  ORDER BY COALESCE(
    (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
    c.updated_at
  ) DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Get or create a private conversation (returns full conversation)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_private_conversation(
  p_user1_id UUID,
  p_user2_id UUID
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  user1_id UUID,
  user2_id UUID,
  user1_key_encrypted TEXT,
  user2_key_encrypted TEXT,
  group_name TEXT,
  group_avatar_path TEXT,
  creator_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user1 UUID;
  v_user2 UUID;
  v_conversation_id UUID;
BEGIN
  -- Sort user IDs to ensure consistent ordering
  IF p_user1_id < p_user2_id THEN
    v_user1 := p_user1_id;
    v_user2 := p_user2_id;
  ELSE
    v_user1 := p_user2_id;
    v_user2 := p_user1_id;
  END IF;

  -- Try to find existing conversation
  SELECT conversations.id INTO v_conversation_id
  FROM conversations
  WHERE conversations.user1_id = v_user1 AND conversations.user2_id = v_user2 AND (conversations.type = 'private' OR conversations.type IS NULL);

  IF NOT FOUND THEN
    -- Create new conversation
    INSERT INTO conversations (user1_id, user2_id, type)
    VALUES (v_user1, v_user2, 'private')
    RETURNING id INTO v_conversation_id;
  END IF;

  -- Remove any soft-delete records for both users so they can access the conversation again
  -- This handles the case where a user previously deleted the conversation and is now re-initiating it
  DELETE FROM conversation_deletions
  WHERE conversation_id = v_conversation_id
    AND user_id IN (p_user1_id, p_user2_id);

  -- Return the full conversation
  RETURN QUERY
  SELECT
    c.id,
    c.type,
    c.user1_id,
    c.user2_id,
    c.user1_key_encrypted,
    c.user2_key_encrypted,
    c.group_name,
    c.group_avatar_path,
    c.creator_id,
    c.created_at,
    c.updated_at
  FROM conversations c
  WHERE c.id = v_conversation_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Get messages from a conversation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_conversation_messages(
  p_conversation_id UUID,
  p_limit INT DEFAULT 50,
  p_newest_first BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  sender_id UUID,
  encrypted_content TEXT,
  iv TEXT,
  message_type TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Check access
  IF NOT public.user_has_conversation_access(v_user_id, p_conversation_id) THEN
    RETURN; -- Return empty if no access
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.encrypted_content,
    m.iv,
    m.message_type,
    m.is_read,
    m.created_at
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
  ORDER BY
    CASE WHEN p_newest_first THEN m.created_at END DESC,
    CASE WHEN NOT p_newest_first THEN m.created_at END ASC
  LIMIT p_limit;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Send a message (message or prayer_request)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_message(
  p_conversation_id UUID,
  p_encrypted_content TEXT,
  p_iv TEXT,
  p_message_type TEXT DEFAULT 'message',
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_auth_user_id UUID;
  v_message_id UUID;
BEGIN
  -- Get authenticated user ID from JWT
  v_auth_user_id := auth.uid();

  -- Use provided user_id if auth.uid() is NULL (fallback for cases where JWT context isn't available)
  -- Otherwise verify the provided user_id matches auth.uid() for security
  IF p_user_id IS NOT NULL THEN
    IF v_auth_user_id IS NOT NULL AND v_auth_user_id != p_user_id THEN
      RAISE EXCEPTION 'User ID mismatch - security violation';
    END IF;
    v_user_id := p_user_id;
  ELSIF v_auth_user_id IS NOT NULL THEN
    v_user_id := v_auth_user_id;
  ELSE
    RAISE EXCEPTION 'User ID required - not authenticated';
  END IF;

  -- Check access
  IF NOT public.user_has_conversation_access(v_user_id, p_conversation_id) THEN
    RAISE EXCEPTION 'Access denied to conversation';
  END IF;

  -- Insert message
  INSERT INTO messages (conversation_id, sender_id, encrypted_content, iv, message_type)
  VALUES (p_conversation_id, v_user_id, p_encrypted_content, p_iv, p_message_type)
  RETURNING id INTO v_message_id;

  -- Update conversation timestamp
  UPDATE conversations SET updated_at = NOW() WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Mark messages as read
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_conversation_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_auth_user_id UUID;
BEGIN
  -- Get authenticated user ID from JWT
  v_auth_user_id := auth.uid();

  -- Use provided user_id if auth.uid() is NULL (fallback for cases where JWT context isn't available)
  -- Otherwise verify the provided user_id matches auth.uid() for security
  IF p_user_id IS NOT NULL THEN
    IF v_auth_user_id IS NOT NULL AND v_auth_user_id != p_user_id THEN
      RETURN; -- Security violation - silently fail
    END IF;
    v_user_id := p_user_id;
  ELSIF v_auth_user_id IS NOT NULL THEN
    v_user_id := v_auth_user_id;
  ELSE
    RETURN; -- Not authenticated - silently fail
  END IF;

  -- Check access
  IF NOT public.user_has_conversation_access(v_user_id, p_conversation_id) THEN
    RETURN;
  END IF;

  -- Mark messages from OTHER users as read
  UPDATE messages
  SET is_read = TRUE
  WHERE conversation_id = p_conversation_id
    AND sender_id != v_user_id
    AND is_read = FALSE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Delete a message (only your own)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_message(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_sender_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get message sender
  SELECT sender_id INTO v_sender_id FROM messages WHERE id = p_message_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Only sender can delete their own message
  IF v_sender_id != v_user_id THEN
    RETURN FALSE;
  END IF;

  DELETE FROM messages WHERE id = p_message_id;
  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Delete/Leave a conversation (SOFT DELETE for users)
-- For groups:
--   - Creator: HARD deletes entire group (messages, members, conversation)
--   - Member: SOFT delete (add to deletions) + remove from members (leave)
-- For private:
--   - SOFT delete only (add to deletions, conversation remains for other user)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_conv RECORD;
BEGIN
  v_user_id := auth.uid();

  -- Get the specific conversation by ID
  SELECT * INTO v_conv FROM conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if already soft-deleted
  IF EXISTS (
    SELECT 1 FROM conversation_deletions
    WHERE conversation_id = p_conversation_id AND user_id = v_user_id
  ) THEN
    RETURN TRUE; -- Already deleted for this user
  END IF;

  -- Handle GROUP conversations
  IF v_conv.type = 'group' THEN
    IF v_conv.creator_id = v_user_id THEN
      -- Creator: HARD delete entire group (with explicit type check)
      DELETE FROM conversation_deletions WHERE conversation_id = p_conversation_id;
      DELETE FROM messages WHERE conversation_id = p_conversation_id;
      DELETE FROM conversation_members WHERE conversation_id = p_conversation_id;
      DELETE FROM conversations WHERE id = p_conversation_id AND type = 'group';
      RETURN TRUE;
    ELSE
      -- Non-creator member: SOFT delete + leave group
      IF EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = p_conversation_id AND user_id = v_user_id
      ) THEN
        -- Add soft delete record (hide from user)
        INSERT INTO conversation_deletions (conversation_id, user_id)
        VALUES (p_conversation_id, v_user_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        -- Remove from group membership
        DELETE FROM conversation_members
        WHERE conversation_id = p_conversation_id AND user_id = v_user_id;
        RETURN TRUE;
      END IF;
      -- Not a member
      RETURN FALSE;
    END IF;
  END IF;

  -- Handle PRIVATE conversations
  IF v_conv.type = 'private' THEN
    -- Must be one of the participants
    IF v_conv.user1_id = v_user_id OR v_conv.user2_id = v_user_id THEN
      -- SOFT delete only - add to deletions table
      -- Conversation and messages remain for the other participant
      INSERT INTO conversation_deletions (conversation_id, user_id)
      VALUES (p_conversation_id, v_user_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Unknown type - don't delete
  RETURN FALSE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Add a member to a group (creator only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_group_member(
  p_conversation_id UUID,
  p_new_member_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_conv RECORD;
BEGIN
  v_user_id := auth.uid();

  -- Get the conversation
  SELECT * INTO v_conv FROM conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Must be a group
  IF v_conv.type != 'group' THEN
    RETURN FALSE;
  END IF;

  -- Only creator can add members
  IF v_conv.creator_id != v_user_id THEN
    RETURN FALSE;
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = p_new_member_id
  ) THEN
    RETURN TRUE; -- Already a member, consider it success
  END IF;

  -- Add the member
  INSERT INTO conversation_members (conversation_id, user_id)
  VALUES (p_conversation_id, p_new_member_id);

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Remove/kick a member from a group (creator only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_group_member(
  p_conversation_id UUID,
  p_member_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_conv RECORD;
BEGIN
  v_user_id := auth.uid();

  -- Get the conversation
  SELECT * INTO v_conv FROM conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Must be a group
  IF v_conv.type != 'group' THEN
    RETURN FALSE;
  END IF;

  -- Only creator can kick members
  IF v_conv.creator_id != v_user_id THEN
    RETURN FALSE;
  END IF;

  -- Creator cannot kick themselves (they should delete the group instead)
  IF p_member_id = v_user_id THEN
    RETURN FALSE;
  END IF;

  -- Remove the member
  DELETE FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = p_member_id;

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Create a group conversation
-- -----------------------------------------------------------------------------
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
  INSERT INTO conversations (type, group_name, creator_id)
  VALUES ('group', p_group_name, p_creator_id)
  RETURNING id INTO v_conversation_id;

  -- Add creator as admin member
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conversation_id, p_creator_id, 'admin');

  -- Add other members
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id != p_creator_id THEN
      INSERT INTO conversation_members (conversation_id, user_id, role)
      VALUES (v_conversation_id, v_member_id, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Get user's group conversations
-- -----------------------------------------------------------------------------
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
    (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id)
  FROM conversations c
  WHERE c.type = 'group'
    -- Exclude soft-deleted conversations
    AND NOT EXISTS (
      SELECT 1 FROM conversation_deletions cd
      WHERE cd.conversation_id = c.id AND cd.user_id = p_user_id
    )
    AND (
      c.creator_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM conversation_members cm
        WHERE cm.conversation_id = c.id AND cm.user_id = p_user_id
      )
    )
  ORDER BY c.updated_at DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Get group members
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_group_members(p_conversation_id UUID)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Check if user has access to this conversation
  IF NOT public.user_has_conversation_access(v_user_id, p_conversation_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT cm.user_id, cm.role, cm.joined_at
  FROM conversation_members cm
  WHERE cm.conversation_id = p_conversation_id
  ORDER BY cm.joined_at;
END;
$$;

-- =============================================================================
-- STEP 6: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.user_has_conversation_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_private_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_group_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member TO authenticated;

-- =============================================================================
-- STEP 7: REFRESH POSTGREST SCHEMA CACHE
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- DONE!
-- =============================================================================
SELECT 'SUCCESS! Messaging system rebuilt with SECURITY DEFINER functions.' as result;
