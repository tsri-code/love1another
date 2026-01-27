-- =============================================================================
-- Notification Security Enhancement
-- =============================================================================
-- This migration updates notification triggers to avoid storing sensitive
-- information (like names) in notification text for enhanced security.
--
-- Run this in the Supabase SQL Editor after the main migrations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Update message notification trigger to use generic text
-- This prevents storing sender names in plaintext in the notification table
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_recipient_id UUID;
  v_is_prayer BOOLEAN;
  v_member RECORD;
BEGIN
  -- Get conversation details
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check if it's a prayer request
  v_is_prayer := (NEW.message_type = 'prayer_request');

  BEGIN
    -- Handle private conversations
    IF v_conv.type = 'private' THEN
      -- Determine recipient (the other user in the conversation)
      IF v_conv.user1_id = NEW.sender_id THEN
        v_recipient_id := v_conv.user2_id;
      ELSE
        v_recipient_id := v_conv.user1_id;
      END IF;

      -- Only create notification if recipient hasn't deleted the conversation
      IF v_recipient_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM conversation_deletions
        WHERE conversation_id = NEW.conversation_id AND user_id = v_recipient_id
      ) THEN
        -- Use completely generic notification for maximum privacy
        -- No sender_id in payload to prevent social network mapping
        INSERT INTO notification_events (user_id, type, title, body, payload)
        VALUES (
          v_recipient_id,
          'message',
          'New Message',
          'You have a notification',
          jsonb_build_object(
            'conversation_id', NEW.conversation_id,
            'message_id', NEW.id
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
          AND NOT EXISTS (
            SELECT 1 FROM conversation_deletions cd
            WHERE cd.conversation_id = NEW.conversation_id AND cd.user_id = cm.user_id
          )
      LOOP
        -- Use completely generic notification for maximum privacy
        -- No sender_id in payload to prevent social network mapping
        INSERT INTO notification_events (user_id, type, title, body, payload)
        VALUES (
          v_member.user_id,
          'message',
          'New Message',
          'You have a notification',
          jsonb_build_object(
            'conversation_id', NEW.conversation_id,
            'message_id', NEW.id
          )
        );
      END LOOP;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Update friend request notification trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_friend_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
BEGIN
  -- Only notify on new pending requests
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Determine recipient (the user who didn't initiate)
  IF NEW.requester_id = NEW.user1_id THEN
    v_recipient_id := NEW.user2_id;
  ELSE
    v_recipient_id := NEW.user1_id;
  END IF;

  -- Use generic text for privacy - only friendship_id needed for navigation
  INSERT INTO notification_events (user_id, type, title, body, payload)
  VALUES (
    v_recipient_id,
    'friend_request',
    'New Request',
    'You have a notification',
    jsonb_build_object(
      'friendship_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Update friend accepted notification trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_friend_accepted_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepter_id UUID;
BEGIN
  -- Only notify when status changes to accepted
  IF OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
    -- Determine who accepted (the user who didn't request)
    IF NEW.requester_id = NEW.user1_id THEN
      v_accepter_id := NEW.user2_id;
    ELSE
      v_accepter_id := NEW.user1_id;
    END IF;

    -- Use generic text for privacy - only friendship_id needed for navigation
    INSERT INTO notification_events (user_id, type, title, body, payload)
    VALUES (
      NEW.requester_id,
      'friend_accepted',
      'Request Accepted',
      'You have a notification',
      jsonb_build_object(
        'friendship_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
