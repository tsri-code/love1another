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
    RETURNING conversations.id INTO v_conversation_id;
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
-- Function: Get messages with sender info (for group chats)
-- Returns sender name/avatar even for removed members
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_conversation_messages_with_sender(
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
  created_at TIMESTAMPTZ,
  sender_full_name TEXT,
  sender_username TEXT,
  sender_avatar_initials TEXT,
  sender_avatar_color TEXT,
  sender_avatar_path TEXT
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
    m.id::UUID,
    m.conversation_id::UUID,
    m.sender_id::UUID,
    m.encrypted_content::TEXT,
    m.iv::TEXT,
    m.message_type::TEXT,
    m.is_read::BOOLEAN,
    m.created_at::TIMESTAMPTZ,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email, 'Unknown User')::TEXT as sender_full_name,
    (u.raw_user_meta_data->>'username')::TEXT as sender_username,
    (u.raw_user_meta_data->>'avatar_initials')::TEXT as sender_avatar_initials,
    COALESCE(u.raw_user_meta_data->>'avatar_color', '#7c9bb8')::TEXT as sender_avatar_color,
    (u.raw_user_meta_data->>'avatar_path')::TEXT as sender_avatar_path
  FROM messages m
  LEFT JOIN auth.users u ON u.id = m.sender_id
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
--   - Any member (including creator): SOFT delete + remove from members (leave)
--   - To actually delete the group, use admin_delete_group function
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
    -- Any member (including creator): SOFT delete + leave group
    -- To actually delete the group, use admin_delete_group function
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
-- Function: Add a member to a group (admins only)
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
  v_user_role TEXT;
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

  -- Check if user is an admin
  SELECT role INTO v_user_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'admin' THEN
    RETURN FALSE;
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = p_new_member_id
  ) THEN
    -- Clear any soft-delete records so they can see the conversation
    DELETE FROM conversation_deletions
    WHERE conversation_id = p_conversation_id AND user_id = p_new_member_id;
    RETURN TRUE; -- Already a member, consider it success
  END IF;

  -- Clear any soft-delete records from previous membership
  DELETE FROM conversation_deletions
  WHERE conversation_id = p_conversation_id AND user_id = p_new_member_id;

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
-- Function: Get group members with full user info
-- Note: Explicit type casts are required to match the return table structure
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_group_members(p_conversation_id UUID)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ,
  email TEXT,
  full_name TEXT,
  username TEXT,
  avatar_initials TEXT,
  avatar_color TEXT,
  avatar_path TEXT
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
  SELECT
    cm.user_id::UUID,
    cm.role::TEXT,
    cm.joined_at::TIMESTAMPTZ,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email)::TEXT as full_name,
    (u.raw_user_meta_data->>'username')::TEXT as username,
    (u.raw_user_meta_data->>'avatar_initials')::TEXT as avatar_initials,
    COALESCE(u.raw_user_meta_data->>'avatar_color', '#7c9bb8')::TEXT as avatar_color,
    (u.raw_user_meta_data->>'avatar_path')::TEXT as avatar_path
  FROM conversation_members cm
  INNER JOIN auth.users u ON u.id = cm.user_id
  WHERE cm.conversation_id = p_conversation_id
  ORDER BY cm.joined_at;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Get conversation details
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_conversation_details(p_conversation_id UUID)
RETURNS TABLE (
  id UUID,
  type TEXT,
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
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Check if user has access to this conversation
  IF NOT public.user_has_conversation_access(v_user_id, p_conversation_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id::UUID,
    c.type::TEXT,
    c.group_name::TEXT,
    c.group_avatar_path::TEXT,
    c.creator_id::UUID,
    c.created_at::TIMESTAMPTZ,
    c.updated_at::TIMESTAMPTZ
  FROM conversations c
  WHERE c.id = p_conversation_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Update group info (name and/or avatar)
-- Any member can update group info
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_group_info(
  p_conversation_id UUID,
  p_group_name TEXT DEFAULT NULL,
  p_group_avatar_path TEXT DEFAULT NULL
)
RETURNS BOOLEAN
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
    RETURN FALSE;
  END IF;

  -- Update the group with provided values
  UPDATE conversations
  SET
    group_name = COALESCE(p_group_name, group_name),
    group_avatar_path = CASE
      WHEN p_group_avatar_path IS NOT NULL THEN p_group_avatar_path
      ELSE group_avatar_path
    END,
    updated_at = NOW()
  WHERE id = p_conversation_id
    AND type = 'group';

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Promote member to admin
-- Only creator or existing admins can promote members
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_to_admin(
  p_conversation_id UUID,
  p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_target_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- Check if current user is an admin in this group
  SELECT role INTO v_user_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can promote members';
  END IF;

  -- Check if target user is a member
  SELECT EXISTS(
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = p_target_user_id
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  -- Promote to admin
  UPDATE conversation_members
  SET role = 'admin'
  WHERE conversation_id = p_conversation_id AND user_id = p_target_user_id;

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Demote admin to member
-- Only creator or existing admins can demote (cannot demote creator)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demote_from_admin(
  p_conversation_id UUID,
  p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_creator_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Check if current user is an admin
  SELECT role INTO v_user_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can demote members';
  END IF;

  -- Get creator ID
  SELECT creator_id INTO v_creator_id
  FROM conversations
  WHERE id = p_conversation_id;

  -- Cannot demote the creator
  IF p_target_user_id = v_creator_id THEN
    RAISE EXCEPTION 'Cannot demote the group creator';
  END IF;

  -- Demote to member
  UPDATE conversation_members
  SET role = 'member'
  WHERE conversation_id = p_conversation_id AND user_id = p_target_user_id;

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Check if user can leave group
-- Admins/creator can only leave if another admin exists
-- Returns: can_leave (boolean), reason (text)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_leave_group(
  p_conversation_id UUID
)
RETURNS TABLE (can_leave BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_creator_id UUID;
  v_admin_count INT;
  v_is_creator BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- Get user's role in the group
  SELECT role INTO v_user_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'You are not a member of this group'::TEXT;
    RETURN;
  END IF;

  -- Get creator ID
  SELECT creator_id INTO v_creator_id
  FROM conversations
  WHERE id = p_conversation_id;

  v_is_creator := (v_user_id = v_creator_id);

  -- If user is not an admin, they can always leave
  IF v_user_role != 'admin' THEN
    RETURN QUERY SELECT TRUE::BOOLEAN, ''::TEXT;
    RETURN;
  END IF;

  -- Count other admins (excluding current user)
  SELECT COUNT(*) INTO v_admin_count
  FROM conversation_members
  WHERE conversation_id = p_conversation_id
    AND user_id != v_user_id
    AND role = 'admin';

  -- If there are other admins, user can leave
  IF v_admin_count > 0 THEN
    RETURN QUERY SELECT TRUE::BOOLEAN, ''::TEXT;
    RETURN;
  END IF;

  -- No other admins - user must appoint one first
  IF v_is_creator THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'As the creator, you must appoint another admin before leaving or deleting the group.'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE::BOOLEAN, 'As an admin, you must appoint another admin before leaving the group.'::TEXT;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Remove member from group (for admins)
-- Admins can remove non-admin members
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_remove_member(
  p_conversation_id UUID,
  p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_target_role TEXT;
  v_creator_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Check if current user is an admin
  SELECT role INTO v_user_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can remove members';
  END IF;

  -- Get target user's role
  SELECT role INTO v_target_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  -- Get creator ID
  SELECT creator_id INTO v_creator_id
  FROM conversations
  WHERE id = p_conversation_id;

  -- Cannot remove the creator
  IF p_target_user_id = v_creator_id THEN
    RAISE EXCEPTION 'Cannot remove the group creator';
  END IF;

  -- Remove the member
  DELETE FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = p_target_user_id;

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Admin delete entire group
-- Only admins can delete the group for everyone
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_group(
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_is_group BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- Check if this is a group conversation
  SELECT (type = 'group') INTO v_is_group
  FROM conversations
  WHERE id = p_conversation_id;

  IF NOT v_is_group THEN
    RAISE EXCEPTION 'This is not a group conversation';
  END IF;

  -- Check if current user is an admin
  SELECT role INTO v_user_role
  FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete the group';
  END IF;

  -- Delete the conversation (CASCADE will delete members and messages)
  DELETE FROM conversations WHERE id = p_conversation_id;

  RETURN TRUE;
END;
$$;

-- =============================================================================
-- STEP 6: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.user_has_conversation_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_private_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages_with_sender TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_group_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_info TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.demote_from_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_leave_group TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_group TO authenticated;

-- =============================================================================
-- STEP 7: REALTIME NOTIFICATIONS SYSTEM
-- =============================================================================
-- This creates a dedicated table for realtime notifications that bypasses
-- the deny-all RLS on the messages table. Users can subscribe to their own
-- notifications via Supabase Realtime.

-- -----------------------------------------------------------------------------
-- Create notification_events table
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.notification_events CASCADE;

CREATE TABLE public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'friend_request', 'friend_accepted', 'group_invite')),
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX idx_notification_events_user ON public.notification_events(user_id, created_at DESC);
CREATE INDEX idx_notification_events_unread ON public.notification_events(user_id, read) WHERE read = FALSE;

-- Enable RLS
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see/update their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notification_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notification_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notification_events FOR DELETE
  USING (auth.uid() = user_id);

-- System can insert (via trigger with SECURITY DEFINER)
-- No direct INSERT policy needed since triggers handle this

-- -----------------------------------------------------------------------------
-- Enable Realtime for notification_events
-- -----------------------------------------------------------------------------
-- This allows Supabase Realtime subscriptions to work
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_events;

-- -----------------------------------------------------------------------------
-- Function: Create notification (SECURITY DEFINER to bypass RLS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notification_events (user_id, type, title, body, payload)
  VALUES (p_user_id, p_type, p_title, p_body, p_payload)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Trigger: Create notification when a message is sent
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_sender_name TEXT;
  v_recipient_id UUID;
  v_member RECORD;
BEGIN
  -- Get conversation details
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get sender name
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    email
  ) INTO v_sender_name
  FROM auth.users WHERE id = NEW.sender_id;

  v_sender_name := COALESCE(v_sender_name, 'Someone');

  -- Handle private conversations
  IF v_conv.type = 'private' THEN
    -- Notify the other user
    IF v_conv.user1_id = NEW.sender_id THEN
      v_recipient_id := v_conv.user2_id;
    ELSE
      v_recipient_id := v_conv.user1_id;
    END IF;

    -- Check if recipient has soft-deleted the conversation
    IF NOT EXISTS (
      SELECT 1 FROM conversation_deletions
      WHERE conversation_id = NEW.conversation_id AND user_id = v_recipient_id
    ) THEN
      INSERT INTO notification_events (user_id, type, title, body, payload)
      VALUES (
        v_recipient_id,
        'message',
        v_sender_name,
        LEFT(NEW.content, 100),
        jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id,
          'is_prayer_request', NEW.is_prayer_request
        )
      );
    END IF;

  -- Handle group conversations
  ELSIF v_conv.type = 'group' THEN
    -- Notify all members except the sender
    FOR v_member IN
      SELECT cm.user_id
      FROM conversation_members cm
      WHERE cm.conversation_id = NEW.conversation_id
        AND cm.user_id != NEW.sender_id
        -- Exclude users who have soft-deleted the conversation
        AND NOT EXISTS (
          SELECT 1 FROM conversation_deletions cd
          WHERE cd.conversation_id = NEW.conversation_id AND cd.user_id = cm.user_id
        )
    LOOP
      INSERT INTO notification_events (user_id, type, title, body, payload)
      VALUES (
        v_member.user_id,
        'message',
        COALESCE(v_conv.group_name, 'Group') || ': ' || v_sender_name,
        LEFT(NEW.content, 100),
        jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id,
          'group_name', v_conv.group_name,
          'is_prayer_request', NEW.is_prayer_request
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_message_insert_notification ON public.messages;
CREATE TRIGGER on_message_insert_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_message_notification();

-- -----------------------------------------------------------------------------
-- Trigger: Create notification when a friend request is sent
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_friend_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_name TEXT;
  v_recipient_id UUID;
BEGIN
  -- Only notify on new pending requests
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get requester name
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    email
  ) INTO v_requester_name
  FROM auth.users WHERE id = NEW.requester_id;

  v_requester_name := COALESCE(v_requester_name, 'Someone');

  -- Determine recipient (the user who didn't send the request)
  IF NEW.user1_id = NEW.requester_id THEN
    v_recipient_id := NEW.user2_id;
  ELSE
    v_recipient_id := NEW.user1_id;
  END IF;

  INSERT INTO notification_events (user_id, type, title, body, payload)
  VALUES (
    v_recipient_id,
    'friend_request',
    'New Friend Request',
    v_requester_name || ' wants to connect with you',
    jsonb_build_object(
      'requester_id', NEW.requester_id,
      'friendship_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_friendship_insert_notification ON public.friendships;
CREATE TRIGGER on_friendship_insert_notification
  AFTER INSERT ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_friend_request_notification();

-- -----------------------------------------------------------------------------
-- Trigger: Notify when a friend request is accepted
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_friend_accepted_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepter_name TEXT;
  v_accepter_id UUID;
BEGIN
  -- Only notify when status changes to 'accepted'
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- The accepter is NOT the original requester
    IF NEW.user1_id = NEW.requester_id THEN
      v_accepter_id := NEW.user2_id;
    ELSE
      v_accepter_id := NEW.user1_id;
    END IF;

    -- Get accepter name
    SELECT COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      email
    ) INTO v_accepter_name
    FROM auth.users WHERE id = v_accepter_id;

    v_accepter_name := COALESCE(v_accepter_name, 'Someone');

    -- Notify the original requester
    INSERT INTO notification_events (user_id, type, title, body, payload)
    VALUES (
      NEW.requester_id,
      'friend_accepted',
      'Friend Request Accepted',
      v_accepter_name || ' accepted your friend request',
      jsonb_build_object(
        'accepter_id', v_accepter_id,
        'friendship_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_friendship_update_notification ON public.friendships;
CREATE TRIGGER on_friendship_update_notification
  AFTER UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_friend_accepted_notification();

-- -----------------------------------------------------------------------------
-- Function: Mark notifications as read
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notifications_read(
  p_notification_ids UUID[] DEFAULT NULL,
  p_mark_all BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF p_mark_all THEN
    UPDATE notification_events
    SET read = TRUE
    WHERE user_id = v_user_id AND read = FALSE;
  ELSE
    UPDATE notification_events
    SET read = TRUE
    WHERE user_id = v_user_id AND id = ANY(p_notification_ids);
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Get unread notification count
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS TABLE (
  total INTEGER,
  messages INTEGER,
  friend_requests INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total,
    COUNT(*) FILTER (WHERE type = 'message')::INTEGER as messages,
    COUNT(*) FILTER (WHERE type = 'friend_request')::INTEGER as friend_requests
  FROM notification_events
  WHERE user_id = v_user_id AND read = FALSE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Cleanup old notifications (run periodically)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Delete read notifications older than 7 days
  DELETE FROM notification_events
  WHERE read = TRUE AND created_at < NOW() - INTERVAL '7 days';

  -- Delete unread notifications older than 30 days
  DELETE FROM notification_events
  WHERE read = FALSE AND created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- Grant permissions
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications TO authenticated;

-- =============================================================================
-- STEP 8: REFRESH POSTGREST SCHEMA CACHE
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- DONE!
-- =============================================================================
SELECT 'SUCCESS! Messaging system with REALTIME NOTIFICATIONS ready.' as result;
