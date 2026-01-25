"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

interface NotificationEvent {
  id: string;
  user_id: string;
  type: "message" | "friend_request" | "friend_accepted" | "group_invite";
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

interface NotificationContextType {
  unreadMessages: number;
  pendingFriendRequests: number;
  refreshCounts: () => Promise<void>;
  markAllRead: () => Promise<void>;
  playMessageSound: () => void;
  playFriendRequestSound: () => void;
  // Sound settings
  messageSoundEnabled: boolean;
  friendRequestSoundEnabled: boolean;
  setMessageSoundEnabled: (enabled: boolean) => void;
  setFriendRequestSoundEnabled: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadMessages: 0,
  pendingFriendRequests: 0,
  refreshCounts: async () => {},
  markAllRead: async () => {},
  playMessageSound: () => {},
  playFriendRequestSound: () => {},
  messageSoundEnabled: true,
  friendRequestSoundEnabled: true,
  setMessageSoundEnabled: () => {},
  setFriendRequestSoundEnabled: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

interface NotificationProviderProps {
  children: ReactNode;
  userId?: string;
}

export function NotificationProvider({
  children,
  userId,
}: NotificationProviderProps) {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const { showToast } = useToast();

  // Audio refs for notification sounds
  const messageAudioRef = useRef<HTMLAudioElement | null>(null);
  const friendRequestAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sound settings from localStorage
  const [messageSoundEnabled, setMessageSoundEnabled] = useState(true);
  const [friendRequestSoundEnabled, setFriendRequestSoundEnabled] =
    useState(true);

  // Load sound settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const msgSound = localStorage.getItem("love1another_message_sound");
      const friendSound = localStorage.getItem("love1another_friend_sound");
      if (msgSound !== null) setMessageSoundEnabled(msgSound === "true");
      if (friendSound !== null)
        setFriendRequestSoundEnabled(friendSound === "true");
    }
  }, []);

  // Initialize audio elements
  useEffect(() => {
    if (typeof window !== "undefined") {
      messageAudioRef.current = new Audio("/sounds/messages.aac");
      messageAudioRef.current.volume = 0.5;

      friendRequestAudioRef.current = new Audio("/sounds/friend-request.aac");
      friendRequestAudioRef.current.volume = 0.5;
    }
  }, []);

  // Update browser tab title with notification count
  const updateTabTitle = useCallback((total: number) => {
    if (typeof window !== "undefined") {
      const baseTitle = "Love1Another";
      if (total > 0) {
        document.title = `(${total}) ${baseTitle}`;
      } else {
        document.title = baseTitle;
      }
    }
  }, []);

  // Settings setters that persist to localStorage
  const handleSetMessageSoundEnabled = useCallback((enabled: boolean) => {
    setMessageSoundEnabled(enabled);
    if (typeof window !== "undefined") {
      localStorage.setItem("love1another_message_sound", String(enabled));
    }
  }, []);

  const handleSetFriendRequestSoundEnabled = useCallback((enabled: boolean) => {
    setFriendRequestSoundEnabled(enabled);
    if (typeof window !== "undefined") {
      localStorage.setItem("love1another_friend_sound", String(enabled));
    }
  }, []);

  const playMessageSound = useCallback(() => {
    if (messageSoundEnabled && messageAudioRef.current) {
      messageAudioRef.current.currentTime = 0;
      messageAudioRef.current.play().catch(() => {
        // Ignore autoplay errors - browser may block without user interaction
      });
    }
  }, [messageSoundEnabled]);

  const playFriendRequestSound = useCallback(() => {
    if (friendRequestSoundEnabled && friendRequestAudioRef.current) {
      friendRequestAudioRef.current.currentTime = 0;
      friendRequestAudioRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, [friendRequestSoundEnabled]);

  // Fetch notification counts from the database
  const refreshCounts = useCallback(async () => {
    if (!userId) return;

    try {
      const supabase = createClient();

      // Use the RPC function to get unread counts
      const { data, error } = await supabase.rpc("get_unread_notification_count");

      if (error) {
        // Silent fail - notifications will retry on next poll
        return;
      }

      if (data && data.length > 0) {
        const counts = data[0];
        setUnreadMessages(counts.messages || 0);
        setPendingFriendRequests(counts.friend_requests || 0);
      }
    } catch {
      // Silent fail - notifications will retry on next poll
    }
  }, [userId]);

  // Mark all notifications as read
  const markAllRead = useCallback(async () => {
    if (!userId) return;

    try {
      const supabase = createClient();
      await supabase.rpc("mark_notifications_read", { p_mark_all: true });
      setUnreadMessages(0);
      setPendingFriendRequests(0);
    } catch {
      // Silent fail
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      refreshCounts();
    }
  }, [userId, refreshCounts]);

  // Update tab title when notification counts change
  useEffect(() => {
    const totalNotifications = unreadMessages + pendingFriendRequests;
    updateTabTitle(totalNotifications);
  }, [unreadMessages, pendingFriendRequests, updateTabTitle]);

  // Set up Supabase Realtime subscription to notification_events table
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe to notification_events table for this user
    // RLS ensures we only receive our own notifications
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_events",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as NotificationEvent;

          // Update counts based on notification type
          switch (notification.type) {
            case "message":
              setUnreadMessages((prev) => prev + 1);
              playMessageSound();
              showToast(notification.title, "info");
              break;

            case "friend_request":
              setPendingFriendRequests((prev) => prev + 1);
              playFriendRequestSound();
              showToast(notification.title, "info");
              break;

            case "friend_accepted":
              playFriendRequestSound();
              showToast(notification.body || "Friend request accepted!", "success");
              break;

            case "group_invite":
              playMessageSound();
              showToast(notification.title, "info");
              break;
          }

          // Dispatch custom event for MessagesButton to refresh
          window.dispatchEvent(new CustomEvent("refreshConversations"));
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    userId,
    playMessageSound,
    playFriendRequestSound,
    showToast,
  ]);

  return (
    <NotificationContext.Provider
      value={{
        unreadMessages,
        pendingFriendRequests,
        refreshCounts,
        markAllRead,
        playMessageSound,
        playFriendRequestSound,
        messageSoundEnabled,
        friendRequestSoundEnabled,
        setMessageSoundEnabled: handleSetMessageSoundEnabled,
        setFriendRequestSoundEnabled: handleSetFriendRequestSoundEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
