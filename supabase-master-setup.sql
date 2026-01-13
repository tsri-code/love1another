-- =============================================================================
-- Love1Another - MASTER SQL SETUP (Step 7.1)
-- =============================================================================
-- This is a COMPLETE setup file. Run this ONCE in Supabase SQL Editor.
-- It safely drops and recreates all functions to avoid conflicts.
-- =============================================================================

-- =============================================================================
-- STEP 1: DROP ALL EXISTING FUNCTIONS (to avoid return type conflicts)
-- =============================================================================

DROP FUNCTION IF EXISTS search_users(TEXT, UUID);
DROP FUNCTION IF EXISTS check_username_available(TEXT);
DROP FUNCTION IF EXISTS get_user_by_id(UUID);
DROP FUNCTION IF EXISTS get_email_by_username(TEXT);

-- =============================================================================
-- STEP 2: CREATE/UPDATE TABLES
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

-- Add last_prayed_at if it doesn't exist (for existing tables)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_prayed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path TEXT;

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

-- Conversations for messaging (private/direct)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID,
  user2_id UUID,
  user1_key_encrypted TEXT,
  user2_key_encrypted TEXT,
  -- Group chat fields
  type TEXT NOT NULL DEFAULT 'private' CHECK (type IN ('private', 'group')),
  group_name TEXT,
  group_avatar_path TEXT,
  creator_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add group chat columns if they don't exist (for existing tables)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'private';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_avatar_path TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS creator_id UUID;

-- Add constraint if not exists (ignore error if already exists)
DO $$
BEGIN
  ALTER TABLE public.conversations ADD CONSTRAINT conversations_type_check CHECK (type IN ('private', 'group'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

-- Group chat members
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- =============================================================================
-- STEP 3: CREATE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_links_profile1_id ON public.links(profile1_id);
CREATE INDEX IF NOT EXISTS idx_links_profile2_id ON public.links(profile2_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user1_id ON public.friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2_id ON public.friendships(user2_id);
CREATE INDEX IF NOT EXISTS idx_connections_owner_user_id ON public.connections(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_profile_id ON public.connections(profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user1_id ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON public.conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_creator_id ON public.conversations(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);

-- =============================================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 5: CREATE RLS POLICIES (with DROP IF EXISTS)
-- =============================================================================

-- ===== User Keys =====
DROP POLICY IF EXISTS "Users can view own keys" ON public.user_keys;
CREATE POLICY "Users can view own keys" ON public.user_keys
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own keys" ON public.user_keys;
CREATE POLICY "Users can insert own keys" ON public.user_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own keys" ON public.user_keys;
CREATE POLICY "Users can update own keys" ON public.user_keys
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own keys" ON public.user_keys;
CREATE POLICY "Users can delete own keys" ON public.user_keys
  FOR DELETE USING (auth.uid() = user_id);

-- ===== Profiles =====
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

-- ===== Links =====
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

-- ===== Friendships =====
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

-- ===== Connections =====
DROP POLICY IF EXISTS "Users can view connections" ON public.connections;
CREATE POLICY "Users can view connections" ON public.connections
  FOR SELECT USING (auth.uid() = owner_user_id OR auth.uid() = connected_user_id);

DROP POLICY IF EXISTS "Owners can insert connections" ON public.connections;
CREATE POLICY "Owners can insert connections" ON public.connections
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Owners can delete connections" ON public.connections;
CREATE POLICY "Owners can delete connections" ON public.connections
  FOR DELETE USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Connected users can delete connections" ON public.connections;
CREATE POLICY "Connected users can delete connections" ON public.connections
  FOR DELETE USING (auth.uid() = connected_user_id);

-- ===== Conversations (Private + Group) =====
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (
    -- Private conversations
    (type = 'private' AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    -- Group conversations (user is a member)
    (type = 'group' AND EXISTS (
      SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    (type = 'private' AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (
    (type = 'private' AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations" ON public.conversations
  FOR DELETE USING (
    (type = 'private' AND (auth.uid() = user1_id OR auth.uid() = user2_id))
    OR
    (type = 'group' AND auth.uid() = creator_id)
  );

-- ===== Messages =====
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
CREATE POLICY "Users can view messages in own conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
CREATE POLICY "Users can insert messages in own conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;
CREATE POLICY "Users can delete messages in own conversations" ON public.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.type = 'private' AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
        OR
        (c.type = 'group' AND EXISTS (
          SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- ===== Conversation Members (Group Chat) =====
DROP POLICY IF EXISTS "Users can view group members" ON public.conversation_members;
CREATE POLICY "Users can view group members" ON public.conversation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm2 WHERE cm2.conversation_id = conversation_id AND cm2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can add group members" ON public.conversation_members;
CREATE POLICY "Admins can add group members" ON public.conversation_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = conversation_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can remove group members" ON public.conversation_members;
CREATE POLICY "Admins can remove group members" ON public.conversation_members
  FOR DELETE USING (
    -- Admin/creator can remove anyone
    EXISTS (
      SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = conversation_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    )
    OR
    -- Users can remove themselves (leave group)
    user_id = auth.uid()
  );

-- =============================================================================
-- STEP 6: CREATE FUNCTIONS
-- =============================================================================

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
      (u.raw_user_meta_data->>'username') ILIKE '%' || search_query || '%'
      OR
      (u.raw_user_meta_data->>'full_name') ILIKE '%' || search_query || '%'
    )
  ORDER BY
    CASE WHEN LOWER(u.raw_user_meta_data->>'username') = LOWER(search_query) THEN 0 ELSE 1 END,
    CASE WHEN LOWER(u.raw_user_meta_data->>'username') LIKE LOWER(search_query) || '%' THEN 0 ELSE 1 END,
    u.raw_user_meta_data->>'username'
  LIMIT 20;
END;
$$;

-- Function to get user info by ID
CREATE OR REPLACE FUNCTION get_user_by_id(lookup_user_id UUID)
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
  WHERE u.id = lookup_user_id
  LIMIT 1;
END;
$$;

-- Function to look up email by username (for login)
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

-- =============================================================================
-- STEP 7: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION check_username_available TO authenticated;
GRANT EXECUTE ON FUNCTION search_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_by_username TO anon;
GRANT EXECUTE ON FUNCTION get_email_by_username TO authenticated;

-- =============================================================================
-- DONE! Your database is now fully set up for Love1Another.
-- =============================================================================
