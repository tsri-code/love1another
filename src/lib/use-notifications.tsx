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

interface NotificationContextType {
  unreadMessages: number;
  pendingFriendRequests: number;
  refreshCounts: () => Promise<void>;
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
      messageAudioRef.current = new Audio("/sounds/message.aac");
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

  const refreshCounts = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch unread message count
      const msgRes = await fetch("/api/messages?unreadOnly=true");
      if (msgRes.ok) {
        const data = await msgRes.json();
        setUnreadMessages(data.unreadCount || 0);
      }

      // Fetch pending friend requests
      const friendRes = await fetch("/api/friends?type=pending");
      if (friendRes.ok) {
        const data = await friendRes.json();
        setPendingFriendRequests(data.pendingRequests?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching notification counts:", error);
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

  // Set up Supabase Realtime subscriptions
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel("messages-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // Check if message is for current user (not sent by them)
          const newMessage = payload.new as {
            sender_id: string;
            conversation_id: string;
          };
          if (newMessage.sender_id !== userId) {
            setUnreadMessages((prev) => prev + 1);
            playMessageSound();
            showToast("New message received!", "info");
          }
        }
      )
      .subscribe();

    // Subscribe to new friend requests
    const friendsChannel = supabase
      .channel("friends-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friendships",
        },
        (payload) => {
          const newFriendship = payload.new as {
            user1_id: string;
            user2_id: string;
            requester_id: string;
            status: string;
          };
          // Check if this is a request TO the current user
          const isRecipient =
            (newFriendship.user1_id === userId ||
              newFriendship.user2_id === userId) &&
            newFriendship.requester_id !== userId &&
            newFriendship.status === "pending";

          if (isRecipient) {
            setPendingFriendRequests((prev) => prev + 1);
            playFriendRequestSound();
            showToast("New friend request!", "info");
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "friendships",
        },
        (payload) => {
          const updated = payload.new as {
            user1_id: string;
            user2_id: string;
            requester_id: string;
            status: string;
          };
          // If a friend request was accepted and I was the requester
          if (
            updated.status === "accepted" &&
            updated.requester_id === userId
          ) {
            showToast("Friend request accepted! 🎉", "success");
            playFriendRequestSound();
          }
          // Refresh counts when any friendship status changes
          refreshCounts();
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(friendsChannel);
    };
  }, [
    userId,
    playMessageSound,
    playFriendRequestSound,
    refreshCounts,
    showToast,
  ]);

  return (
    <NotificationContext.Provider
      value={{
        unreadMessages,
        pendingFriendRequests,
        refreshCounts,
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
