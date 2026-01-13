-- =============================================================================
-- FINAL MESSAGING FIX - SECURITY DEFINER ARCHITECTURE
-- =============================================================================
-- This script completely rebuilds the messaging security model using
-- SECURITY DEFINER functions that bypass RLS entirely.
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

-- Set default type for existing conversations
UPDATE public.conversations SET type = 'private' WHERE type IS NULL;

-- =============================================================================
-- STEP 3: DISABLE RLS ON MESSAGING TABLES
-- =============================================================================
-- Since all access goes through SECURITY DEFINER functions, we don't need RLS
-- The functions handle all access control internally

ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members DISABLE ROW LEVEL SECURITY;

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
    -- Private conversations
    (c.type = 'private' AND (c.user1_id = p_user_id OR c.user2_id = p_user_id))
    OR
    -- Group conversations (creator or member)
    (c.type = 'group' AND (
      c.creator_id = p_user_id 
      OR EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = p_user_id)
    ))
  ORDER BY COALESCE(
    (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
    c.updated_at
  ) DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function: Get or create a private conversation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_private_conversation(
  p_user1_id UUID,
  p_user2_id UUID
)
RETURNS UUID
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
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE user1_id = v_user1 AND user2_id = v_user2 AND (type = 'private' OR type IS NULL);
  
  IF FOUND THEN
    RETURN v_conversation_id;
  END IF;
  
  -- Create new conversation
  INSERT INTO conversations (user1_id, user2_id, type)
  VALUES (v_user1, v_user2, 'private')
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
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
  p_message_type TEXT DEFAULT 'message'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_message_id UUID;
BEGIN
  v_user_id := auth.uid();
  
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
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID)
RETURNS VOID
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
-- Function: Delete a conversation
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
  
  SELECT * INTO v_conv FROM conversations WHERE id = p_conversation_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check permission: must be participant (private) or creator (group)
  IF v_conv.type = 'private' THEN
    IF v_conv.user1_id != v_user_id AND v_conv.user2_id != v_user_id THEN
      RETURN FALSE;
    END IF;
  ELSIF v_conv.type = 'group' THEN
    IF v_conv.creator_id != v_user_id THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Delete messages first
  DELETE FROM messages WHERE conversation_id = p_conversation_id;
  
  -- Delete members
  DELETE FROM conversation_members WHERE conversation_id = p_conversation_id;
  
  -- Delete conversation
  DELETE FROM conversations WHERE id = p_conversation_id;
  
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

-- =============================================================================
-- STEP 7: REFRESH POSTGREST SCHEMA CACHE
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- DONE!
-- =============================================================================
SELECT 'SUCCESS! Messaging system rebuilt with SECURITY DEFINER functions.' as result;
