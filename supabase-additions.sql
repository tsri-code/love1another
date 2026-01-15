-- =============================================================================
-- Love1Another - Additional SQL Setup
-- =============================================================================
-- Run this if you already have the basic tables set up.
-- This adds the new features: connections, conversations, messages, and functions.
-- =============================================================================

-- =============================================================================
-- 0. ADD MISSING COLUMNS TO EXISTING TABLES
-- =============================================================================

-- Add last_prayed_at column to profiles (for tracking when user last prayed)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_prayed_at TIMESTAMP WITH TIME ZONE;

-- =============================================================================
-- 1. ADD MISSING TABLES (if they don't exist)
-- =============================================================================

-- Connections (who can see which profiles - for sharing)
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connected_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, connected_user_id)
);

-- Conversations for messaging
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  user1_key_encrypted TEXT,
  user2_key_encrypted TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

-- Messages in conversations
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'message' CHECK (message_type IN ('message', 'prayer_request')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friendships (if not already exists)
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  requester_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

-- =============================================================================
-- 2. CREATE INDEXES (for better performance)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_connections_owner_user_id ON public.connections(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_profile_id ON public.connections(profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user1_id ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON public.conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_friendships_user1_id ON public.friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2_id ON public.friendships(user2_id);

-- =============================================================================
-- 3. ENABLE RLS ON NEW TABLES
-- =============================================================================

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. CREATE RLS POLICIES FOR NEW TABLES
-- =============================================================================

-- Connections policies
DROP POLICY IF EXISTS "Users can view connections" ON public.connections;
CREATE POLICY "Users can view connections" ON public.connections
  FOR SELECT USING (auth.uid() = owner_user_id OR auth.uid() = connected_user_id);

DROP POLICY IF EXISTS "Owners can insert connections" ON public.connections;
CREATE POLICY "Owners can insert connections" ON public.connections
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Owners can delete connections" ON public.connections;
CREATE POLICY "Owners can delete connections" ON public.connections
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Allow connected users to also delete connections (when unfriending)
DROP POLICY IF EXISTS "Connected users can delete connections" ON public.connections;
CREATE POLICY "Connected users can delete connections" ON public.connections
  FOR DELETE USING (auth.uid() = connected_user_id);

-- Conversations policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
CREATE POLICY "Users can view messages in own conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = messages.conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
CREATE POLICY "Users can insert messages in own conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = messages.conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

-- Friendships policies
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can insert friendships" ON public.friendships;
CREATE POLICY "Users can insert friendships" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users can update own friendships" ON public.friendships;
CREATE POLICY "Users can update own friendships" ON public.friendships
  FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- =============================================================================
-- 5. CREATE FUNCTIONS
-- =============================================================================

-- First, drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS search_users(TEXT, UUID);
DROP FUNCTION IF EXISTS check_username_available(TEXT);

-- Function to check if a username is available
CREATE OR REPLACE FUNCTION check_username_available(check_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  username_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE LOWER(raw_user_meta_data->>'username') = LOWER(check_username)
  ) INTO username_exists;

  RETURN NOT username_exists;
END;
$$;

-- Function to search users by username or full name
-- Returns both so users can differentiate between people with same names
CREATE OR REPLACE FUNCTION search_users(
  search_query TEXT,
  exclude_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  full_name TEXT,
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
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'username', '')::TEXT as username,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::TEXT as full_name,
    (u.raw_user_meta_data->>'avatar_initials')::TEXT as avatar_initials,
    (u.raw_user_meta_data->>'avatar_color')::TEXT as avatar_color,
    (u.raw_user_meta_data->>'avatar_path')::TEXT as avatar_path
  FROM auth.users u
  WHERE
    u.id != COALESCE(exclude_user_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND (
      -- Search by username (primary identifier)
      (u.raw_user_meta_data->>'username') ILIKE '%' || search_query || '%'
      OR
      -- Search by full name
      (u.raw_user_meta_data->>'full_name') ILIKE '%' || search_query || '%'
    )
  ORDER BY
    -- Prioritize exact username matches
    CASE WHEN LOWER(u.raw_user_meta_data->>'username') = LOWER(search_query) THEN 0 ELSE 1 END,
    -- Then username starts with query
    CASE WHEN LOWER(u.raw_user_meta_data->>'username') LIKE LOWER(search_query) || '%' THEN 0 ELSE 1 END,
    -- Then alphabetically
    u.raw_user_meta_data->>'username'
  LIMIT 20;
END;
$$;

-- Function to get user info by ID (for messaging UI)
DROP FUNCTION IF EXISTS get_user_by_id(UUID);

CREATE OR REPLACE FUNCTION get_user_by_id(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  full_name TEXT,
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
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'username', '')::TEXT as username,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::TEXT as full_name,
    (u.raw_user_meta_data->>'avatar_initials')::TEXT as avatar_initials,
    (u.raw_user_meta_data->>'avatar_color')::TEXT as avatar_color,
    (u.raw_user_meta_data->>'avatar_path')::TEXT as avatar_path
  FROM auth.users u
  WHERE u.id = user_id
  LIMIT 1;
END;
$$;

-- Function to look up email by username (for login with username)
DROP FUNCTION IF EXISTS get_email_by_username(TEXT);

CREATE OR REPLACE FUNCTION get_email_by_username(lookup_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT u.email INTO user_email
  FROM auth.users u
  WHERE LOWER(u.raw_user_meta_data->>'username') = LOWER(lookup_username)
  LIMIT 1;

  RETURN user_email;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_username_available TO authenticated;
GRANT EXECUTE ON FUNCTION search_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_by_username TO anon;
GRANT EXECUTE ON FUNCTION get_email_by_username TO authenticated;

-- =============================================================================
-- ADD: Missing DELETE policies for conversations and messages
-- =============================================================================

-- Allow users to delete their own conversations
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations" ON public.conversations
  FOR DELETE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Allow users to delete messages in their own conversations
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;
CREATE POLICY "Users can delete messages in own conversations" ON public.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = messages.conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

-- =============================================================================
-- FIX: user_keys INSERT policy should check user_id matches auth.uid()
-- Run this to fix the unrestricted INSERT on user_keys
-- =============================================================================

-- Drop the old permissive INSERT policy
DROP POLICY IF EXISTS "Users can insert own keys" ON public.user_keys;

-- Create a more restrictive INSERT policy
-- Note: During signup, the user creates keys after account creation, so auth.uid() should match
CREATE POLICY "Users can insert own keys" ON public.user_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy for account deletion
DROP POLICY IF EXISTS "Users can delete own keys" ON public.user_keys;
CREATE POLICY "Users can delete own keys" ON public.user_keys
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 6. E2EE DEK (Data Encryption Key) ENVELOPE ENCRYPTION
-- =============================================================================

-- Table to store wrapped DEKs and recovery information
-- DEK is encrypted (wrapped) by both password-derived and recovery-code-derived keys
CREATE TABLE IF NOT EXISTS public.user_e2ee_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,
  -- DEK wrapped with password-derived KEK
  wrapped_dek_password TEXT NOT NULL,
  password_kdf_salt TEXT NOT NULL,
  -- DEK wrapped with recovery-code-derived KEK (nullable until recovery is set up)
  wrapped_dek_recovery TEXT,
  recovery_kdf_salt TEXT,
  -- Recovery code encrypted with password KEK (so user can view it in settings)
  encrypted_recovery_code TEXT,
  -- Migration state: legacy (old password-derived), migrating, upgraded (DEK-based)
  migration_state TEXT DEFAULT 'legacy' CHECK (migration_state IN ('legacy', 'migrating', 'upgraded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_e2ee_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own row
DROP POLICY IF EXISTS "Users can view own e2ee keys" ON public.user_e2ee_keys;
CREATE POLICY "Users can view own e2ee keys" ON public.user_e2ee_keys
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own e2ee keys" ON public.user_e2ee_keys;
CREATE POLICY "Users can insert own e2ee keys" ON public.user_e2ee_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own e2ee keys" ON public.user_e2ee_keys;
CREATE POLICY "Users can update own e2ee keys" ON public.user_e2ee_keys
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own e2ee keys" ON public.user_e2ee_keys;
CREATE POLICY "Users can delete own e2ee keys" ON public.user_e2ee_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_e2ee_keys_migration_state ON public.user_e2ee_keys(migration_state);

-- =============================================================================
-- DONE! All new tables and functions are now set up.
-- =============================================================================
