-- FIX FOR MESSAGING RLS POLICIES
-- Run this in your Supabase SQL Editor (production)
-- This fixes the issue where conversations fail because RLS policies
-- check for type='private' but existing rows might have NULL type

-- Step 1: Ensure all existing conversations have type='private' (not NULL)
UPDATE public.conversations 
SET type = 'private' 
WHERE type IS NULL;

-- Step 2: Drop and recreate RLS policies to handle both NULL and 'private' type
-- This ensures backwards compatibility

-- ===== Conversations SELECT Policy =====
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (
    -- Private conversations (handle both NULL and 'private' type)
    ((type IS NULL OR type = 'private') AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    -- Group conversations (user is a member)
    (type = 'group' AND EXISTS (
      SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid()
    ))
  );

-- ===== Conversations INSERT Policy =====
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    ((type IS NULL OR type = 'private') AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

-- ===== Conversations UPDATE Policy =====
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (
    ((type IS NULL OR type = 'private') AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

-- ===== Conversations DELETE Policy =====
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations" ON public.conversations
  FOR DELETE USING (
    ((type IS NULL OR type = 'private') AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

-- ===== Messages SELECT Policy =====
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
CREATE POLICY "Users can view messages in own conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        ((c.type IS NULL OR c.type = 'private') AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- ===== Messages INSERT Policy =====
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
CREATE POLICY "Users can insert messages in own conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        ((c.type IS NULL OR c.type = 'private') AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- ===== Messages UPDATE Policy =====
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        ((c.type IS NULL OR c.type = 'private') AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- ===== Messages DELETE Policy =====
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;
CREATE POLICY "Users can delete messages in own conversations" ON public.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        ((c.type IS NULL OR c.type = 'private') AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- Done!
SELECT 'Messaging RLS policies fixed!' as result;
