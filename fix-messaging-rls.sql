-- =============================================================================
-- FIX FOR MESSAGING RLS POLICIES - INFINITE RECURSION FIX
-- =============================================================================
-- Run this in your Supabase SQL Editor (production)
--
-- PROBLEM: The conversation_members policy references itself, causing
-- infinite recursion when conversations policy checks group membership.
-- Error: "infinite recursion detected in policy for relation conversation_members"
-- =============================================================================

-- Step 1: Ensure all existing conversations have type='private' (not NULL)
UPDATE public.conversations
SET type = 'private'
WHERE type IS NULL;

-- =============================================================================
-- Step 2: Fix conversation_members policies FIRST (to break the recursion)
-- The key fix: Don't have conversation_members policy reference itself
-- =============================================================================

-- Drop ALL existing conversation_members policies
DROP POLICY IF EXISTS "Users can view group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can add group members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove group members" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_select" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_insert" ON public.conversation_members;
DROP POLICY IF EXISTS "cm_delete" ON public.conversation_members;

-- NEW conversation_members SELECT policy - NO self-reference, check via conversations table
CREATE POLICY "Users can view group members" ON public.conversation_members
  FOR SELECT USING (
    -- User can see members if they are the member being viewed
    user_id = auth.uid()
    OR
    -- Or if user is the creator of the conversation
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
  );

-- NEW conversation_members INSERT policy
CREATE POLICY "Admins can add group members" ON public.conversation_members
  FOR INSERT WITH CHECK (
    -- Creator can add members
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
  );

-- NEW conversation_members DELETE policy
CREATE POLICY "Admins can remove group members" ON public.conversation_members
  FOR DELETE USING (
    -- Creator can remove anyone
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
    OR
    -- Users can remove themselves (leave group)
    user_id = auth.uid()
  );

-- =============================================================================
-- Step 3: Fix conversations policies - simplified, no recursion risk
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
DROP POLICY IF EXISTS "conv_select" ON public.conversations;
DROP POLICY IF EXISTS "conv_insert" ON public.conversations;
DROP POLICY IF EXISTS "conv_update" ON public.conversations;
DROP POLICY IF EXISTS "conv_delete" ON public.conversations;

-- Conversations SELECT - simplified to avoid recursion
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (
    -- User is participant in private conversation
    auth.uid() = user1_id
    OR auth.uid() = user2_id
    -- Or user is creator of group
    OR auth.uid() = creator_id
  );

-- Conversations INSERT
CREATE POLICY "Users can insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() = user1_id
    OR auth.uid() = user2_id
    OR auth.uid() = creator_id
  );

-- Conversations UPDATE
CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (
    auth.uid() = user1_id
    OR auth.uid() = user2_id
    OR auth.uid() = creator_id
  );

-- Conversations DELETE
CREATE POLICY "Users can delete own conversations" ON public.conversations
  FOR DELETE USING (
    auth.uid() = user1_id
    OR auth.uid() = user2_id
    OR auth.uid() = creator_id
  );

-- =============================================================================
-- Step 4: Fix messages policies - simplified
-- =============================================================================

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "msg_select" ON public.messages;
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_update" ON public.messages;
DROP POLICY IF EXISTS "msg_delete" ON public.messages;

-- Messages SELECT - check via conversations (no recursion since we fixed conversation_members)
CREATE POLICY "Users can view messages in own conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid() OR c.creator_id = auth.uid())
    )
  );

-- Messages INSERT
CREATE POLICY "Users can insert messages in own conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid() OR c.creator_id = auth.uid())
    )
  );

-- Messages UPDATE
CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid() OR c.creator_id = auth.uid())
    )
  );

-- Messages DELETE
CREATE POLICY "Users can delete messages in own conversations" ON public.messages
  FOR DELETE USING (
    sender_id = auth.uid()
  );

-- =============================================================================
-- Done!
-- =============================================================================
SELECT 'Messaging RLS policies fixed - infinite recursion resolved!' as result;
