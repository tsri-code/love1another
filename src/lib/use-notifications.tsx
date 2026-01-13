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
}

const NotificationContext = createContext<NotificationContextType>({
  unreadMessages: 0,
  pendingFriendRequests: 0,
  refreshCounts: async () => {},
  playMessageSound: () => {},
  playFriendRequestSound: () => {},
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

  // Initialize audio elements
  useEffect(() => {
    if (typeof window !== "undefined") {
      messageAudioRef.current = new Audio("/sounds/message.mp3");
      messageAudioRef.current.volume = 0.5;
      
      friendRequestAudioRef.current = new Audio("/sounds/friend-request.mp3");
      friendRequestAudioRef.current.volume = 0.5;
    }
  }, []);

  const playMessageSound = useCallback(() => {
    if (messageAudioRef.current) {
      messageAudioRef.current.currentTime = 0;
      messageAudioRef.current.play().catch(() => {
        // Ignore autoplay errors - browser may block without user interaction
      });
    }
  }, []);

  const playFriendRequestSound = useCallback(() => {
    if (friendRequestAudioRef.current) {
      friendRequestAudioRef.current.currentTime = 0;
      friendRequestAudioRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, []);

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
          const newMessage = payload.new as { sender_id: string; conversation_id: string };
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
            (newFriendship.user1_id === userId || newFriendship.user2_id === userId) &&
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
  }, [userId, playMessageSound, playFriendRequestSound, refreshCounts, showToast]);

  return (
    <NotificationContext.Provider
      value={{
        unreadMessages,
        pendingFriendRequests,
        refreshCounts,
        playMessageSound,
        playFriendRequestSound,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
