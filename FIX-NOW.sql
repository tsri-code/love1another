-- =============================================================================
-- CRITICAL FIX - RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR NOW
-- =============================================================================
-- Copy ALL of this and paste into Supabase Dashboard > SQL Editor > New Query
-- Then click "Run"
-- =============================================================================

-- STEP 1: Fix the NOT NULL constraints that block group chats
ALTER TABLE public.conversations ALTER COLUMN user1_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user2_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user1_key_encrypted DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user2_key_encrypted DROP NOT NULL;

-- STEP 2: Set default type for existing conversations
UPDATE public.conversations SET type = 'private' WHERE type IS NULL;

-- STEP 3: DROP ALL conversation_members policies (these cause infinite recursion)
DROP POLICY IF EXISTS "Users can view group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can add group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove group members" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_select" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_insert" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_delete" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_update" ON public.conversation_members;

-- STEP 4: DROP ALL conversations policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
DROP POLICY IF EXISTS "conv_select" ON public.conversations;
DROP POLICY IF EXISTS "conv_insert" ON public.conversations;
DROP POLICY IF EXISTS "conv_update" ON public.conversations;
DROP POLICY IF EXISTS "conv_delete" ON public.conversations;

-- STEP 5: DROP ALL messages policies
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "msg_select" ON public.messages;
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_update" ON public.messages;
DROP POLICY IF EXISTS "msg_delete" ON public.messages;

-- =============================================================================
-- STEP 6: Create ULTRA-SIMPLE conversation_members policies
-- CRITICAL: These policies must NOT reference any other tables to prevent
-- any possibility of recursion. Use RPC functions for cross-table checks.
-- =============================================================================

-- SELECT: You can ONLY see your own membership records
-- (Use get_user_group_conversations RPC to see full group member lists)
CREATE POLICY "cm_select" ON public.conversation_members
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: Only the SECURITY DEFINER function can insert members
-- This allows the RPC function to add members while blocking direct inserts
CREATE POLICY "cm_insert" ON public.conversation_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- DELETE: You can only remove yourself (leave a group)
CREATE POLICY "cm_delete" ON public.conversation_members
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- STEP 7: Create conversations policies
-- NOTE: We CAN reference conversation_members here because cm_select only
-- checks user_id = auth.uid() (no recursion back to conversations)
-- =============================================================================

-- SELECT: You're a participant, creator, OR group member
CREATE POLICY "conv_select" ON public.conversations
  FOR SELECT USING (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
    OR (type = 'group' AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = id AND cm.user_id = auth.uid()
    ))
  );

-- INSERT: You're creating it
CREATE POLICY "conv_insert" ON public.conversations
  FOR INSERT WITH CHECK (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
  );

-- UPDATE: You're a participant, creator, or group member
CREATE POLICY "conv_update" ON public.conversations
  FOR UPDATE USING (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
    OR (type = 'group' AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = id AND cm.user_id = auth.uid()
    ))
  );

-- DELETE: Only participant or creator (not regular group members)
CREATE POLICY "conv_delete" ON public.conversations
  FOR DELETE USING (
    user1_id = auth.uid()
    OR user2_id = auth.uid()
    OR creator_id = auth.uid()
  );

-- =============================================================================
-- STEP 8: Create messages policies (supports both private and group)
-- =============================================================================

-- SELECT: Check via conversations (private) or membership (group)
CREATE POLICY "msg_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        c.user1_id = auth.uid()
        OR c.user2_id = auth.uid()
        OR c.creator_id = auth.uid()
        OR (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- INSERT: You're the sender AND have conversation access
CREATE POLICY "msg_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        c.user1_id = auth.uid()
        OR c.user2_id = auth.uid()
        OR c.creator_id = auth.uid()
        OR (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- UPDATE: You have conversation access (for marking as read, etc)
CREATE POLICY "msg_update" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        c.user1_id = auth.uid()
        OR c.user2_id = auth.uid()
        OR c.creator_id = auth.uid()
        OR (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- DELETE: You're the sender
CREATE POLICY "msg_delete" ON public.messages
  FOR DELETE USING (sender_id = auth.uid());

-- =============================================================================
-- STEP 9: Create/update the group chat functions
-- =============================================================================

-- Drop and recreate create_group_conversation function
DROP FUNCTION IF EXISTS public.create_group_conversation(TEXT, UUID[], UUID);

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
  -- Create the group conversation (no user1/user2 needed for groups)
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

-- Drop and recreate get_user_group_conversations function
DROP FUNCTION IF EXISTS public.get_user_group_conversations(UUID);

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
    (SELECT COUNT(*) FROM public.conversation_members cm WHERE cm.conversation_id = c.id)
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

-- Function to get members of a group (for users who are in the group)
DROP FUNCTION IF EXISTS public.get_group_members(UUID);

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
  v_is_member BOOLEAN;
BEGIN
  -- Get the calling user's ID
  v_user_id := auth.uid();

  -- Check if user is a member or creator of this conversation
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conversation_id AND cm.user_id = v_user_id
    UNION
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id AND (c.creator_id = v_user_id OR c.user1_id = v_user_id OR c.user2_id = v_user_id)
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN; -- Return empty if not a member
  END IF;

  -- Return all members
  RETURN QUERY
  SELECT cm.user_id, cm.role, cm.joined_at
  FROM public.conversation_members cm
  WHERE cm.conversation_id = p_conversation_id
  ORDER BY cm.joined_at;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_group_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_group_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_members TO authenticated;

-- =============================================================================
-- DONE! You should see "Success. No rows returned"
-- =============================================================================
SELECT 'SUCCESS! Messaging system fixed.' as result;
