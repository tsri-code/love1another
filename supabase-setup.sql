-- =============================================================================
-- Love1Another Supabase Database Setup
-- =============================================================================
-- This file contains all the SQL needed to set up the Supabase database.
-- Run this in the Supabase SQL Editor.
-- =============================================================================

-- =============================================================================
-- 1. CREATE TABLES
-- =============================================================================

-- User encryption keys
CREATE TABLE IF NOT EXISTS public.user_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  key_salt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles (people they pray for)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'person' CHECK (type IN ('person', 'group')),
  avatar_initials TEXT,
  avatar_color TEXT,
  avatar_path TEXT,
  verse_id INTEGER,
  prayer_count INTEGER DEFAULT 0,
  encrypted_prayers TEXT,
  encryption_iv TEXT,
  last_prayed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Links between profiles (for shared prayers)
CREATE TABLE IF NOT EXISTS public.links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  link_name TEXT,
  prayer_count INTEGER DEFAULT 0,
  encrypted_prayers TEXT,
  encryption_iv TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile1_id, profile2_id)
);

-- Friendships between users
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

-- Connections (who can see which profiles)
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_links_profile1_id ON public.links(profile1_id);
CREATE INDEX IF NOT EXISTS idx_links_profile2_id ON public.links(profile2_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user1_id ON public.friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2_id ON public.friendships(user2_id);
CREATE INDEX IF NOT EXISTS idx_connections_owner_user_id ON public.connections(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user1_id ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON public.conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- =============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. CREATE RLS POLICIES
-- =============================================================================

-- User Keys policies
DROP POLICY IF EXISTS "Users can view own keys" ON public.user_keys;
CREATE POLICY "Users can view own keys" ON public.user_keys
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own keys" ON public.user_keys;
CREATE POLICY "Users can insert own keys" ON public.user_keys
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own keys" ON public.user_keys;
CREATE POLICY "Users can update own keys" ON public.user_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profiles" ON public.profiles;
CREATE POLICY "Users can view own profiles" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profiles" ON public.profiles;
CREATE POLICY "Users can insert own profiles" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profiles" ON public.profiles;
CREATE POLICY "Users can update own profiles" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profiles" ON public.profiles;
CREATE POLICY "Users can delete own profiles" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Links policies
DROP POLICY IF EXISTS "Users can view links for own profiles" ON public.links;
CREATE POLICY "Users can view links for own profiles" ON public.links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = links.profile1_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = links.profile2_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert links for own profiles" ON public.links;
CREATE POLICY "Users can insert links for own profiles" ON public.links
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = profile1_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = profile2_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update links for own profiles" ON public.links;
CREATE POLICY "Users can update links for own profiles" ON public.links
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = links.profile1_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = links.profile2_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete links for own profiles" ON public.links;
CREATE POLICY "Users can delete links for own profiles" ON public.links
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = links.profile1_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = links.profile2_id AND user_id = auth.uid())
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

-- =============================================================================
-- 4. CREATE FUNCTIONS
-- =============================================================================

-- Function to search users by email, username, or name
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
  avatar_color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'username', SPLIT_PART(u.email, '@', 1))::TEXT as username,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::TEXT as full_name,
    (u.raw_user_meta_data->>'avatar_initials')::TEXT as avatar_initials,
    (u.raw_user_meta_data->>'avatar_color')::TEXT as avatar_color
  FROM auth.users u
  WHERE 
    u.id != COALESCE(exclude_user_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND (
      u.email ILIKE '%' || search_query || '%'
      OR (u.raw_user_meta_data->>'username') ILIKE '%' || search_query || '%'
      OR (u.raw_user_meta_data->>'full_name') ILIKE '%' || search_query || '%'
    )
  LIMIT 20;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_users TO authenticated;

-- =============================================================================
-- 5. DONE!
-- =============================================================================
-- Your database is now ready for the Love1Another app.
-- Make sure to:
-- 1. Enable email authentication in Supabase Dashboard > Authentication > Providers
-- 2. Configure your email templates (optional but recommended)
-- 3. Set up your environment variables in your app:
--    - NEXT_PUBLIC_SUPABASE_URL
--    - NEXT_PUBLIC_SUPABASE_ANON_KEY
-- =============================================================================
