-- =============================================================================
-- Love1Another - Self Profile Migration
-- =============================================================================
-- This migration adds a flag to identify the user's own "Me" profile
-- which cannot be connected to other users.
-- =============================================================================

-- Add is_self_profile column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_self_profile BOOLEAN DEFAULT FALSE;

-- Create an index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_self ON public.profiles(user_id, is_self_profile) WHERE is_self_profile = TRUE;

-- Update existing "Me" profiles (best effort to identify them)
-- This identifies profiles where:
-- 1. The display_name is exactly "Me"
-- 2. It's the oldest profile for that user (first created = self profile)
UPDATE public.profiles p1
SET is_self_profile = TRUE
WHERE p1.id = (
  SELECT p2.id
  FROM public.profiles p2
  WHERE p2.user_id = p1.user_id
  ORDER BY p2.created_at ASC
  LIMIT 1
);

-- Verify the migration
SELECT 
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE is_self_profile = TRUE) as self_profiles
FROM public.profiles;
