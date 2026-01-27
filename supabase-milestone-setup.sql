-- =====================================================
-- MILESTONE NOTIFICATIONS TABLE
-- Tracks which user count milestones have been notified
-- =====================================================

-- Create the milestone_notifications table
CREATE TABLE IF NOT EXISTS public.milestone_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone INTEGER NOT NULL UNIQUE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.milestone_notifications IS 'Tracks user count milestones that have been notified via email';

-- Enable RLS (but we only access via service role, so no policies needed for users)
ALTER TABLE public.milestone_notifications ENABLE ROW LEVEL SECURITY;

-- Grant access to service role only (no user access needed)
-- The service role bypasses RLS automatically

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_milestone_notifications_milestone 
ON public.milestone_notifications(milestone);

-- =====================================================
-- VERIFY SETUP
-- =====================================================
SELECT 'milestone_notifications table created successfully' as status;
