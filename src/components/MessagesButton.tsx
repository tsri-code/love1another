"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/components/AuthGuard";
import { useAlertBanner } from "@/components/ui/alert-banner";
import { useCrypto } from "@/lib/use-crypto";

interface Profile {
  id: string;
  displayName: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath?: string | null;
}

interface SearchUser {
  id: string;
  fullName: string;
  username: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath?: string | null;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderColor?: string;
  senderInitials?: string;
  content: string;
  type: "message" | "prayer_request";
  timestamp: string;
  isRead: boolean;
}

interface GroupMember {
  userId: string;
  role: "admin" | "member";
  joinedAt: string;
  fullName: string;
  username: string;
  avatarInitials: string | null;
  avatarColor: string;
  avatarPath: string | null;
}

interface Thread {
  id: string;
  type: "direct" | "group";
  // For direct messages
  participantId?: string;
  participantName: string;
  participantInitials?: string;
  participantColor?: string;
  participantAvatarPath?: string | null;
  // For groups
  groupName?: string;
  groupAvatarPath?: string | null;
  creatorId?: string;
  memberCount?: number;
  lastMessage: Message;
  unreadCount: number;
}

// Avatar colors matching the main app
const AVATAR_COLORS = [
  "#e07c7c", // soft red
  "#7cb87c", // soft green
  "#7c9bb8", // soft blue
  "#b87cb8", // soft purple
  "#b8a07c", // soft brown
  "#7cb8b8", // soft teal
  "#e0a07c", // soft orange
  "#a07cb8", // soft violet
];

const getColorForName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Darken a hex color for better contrast with white text
const darkenColor = (hex: string, percent: number = 15): string => {
  // Remove # if present
  const color = hex.replace("#", "");

  // Parse RGB
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);

  // Darken
  r = Math.max(0, Math.floor(r * (1 - percent / 100)));
  g = Math.max(0, Math.floor(g * (1 - percent / 100)));
  b = Math.max(0, Math.floor(b * (1 - percent / 100)));

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

interface MessagesButtonProps {
  className?: string;
  onPrayerAdded?: () => void;
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export function MessagesButton({
  className,
  onPrayerAdded,
  externalOpen,
  onExternalOpenHandled,
  onUnreadCountChange,
}: MessagesButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

  // Search/Compose state
  const [showSearchCompose, setShowSearchCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friends, setFriends] = useState<SearchUser[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Group creation state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const { user } = useAuth();
  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  // Handle external open trigger (from hamburger menu)
  useEffect(() => {
    if (externalOpen && !isOpen) {
      setIsOpen(true);
      onExternalOpenHandled?.();
    }
  }, [externalOpen, isOpen, onExternalOpenHandled]);

  // Report unread count changes
  useEffect(() => {
    onUnreadCountChange?.(totalUnread);
  }, [totalUnread, onUnreadCountChange]);

  // Fetch conversations from API (both direct and group)
  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingThreads(true);
    try {
      // Fetch direct conversations
      const res = await fetch("/api/messages");
      const directConversations: Thread[] = [];

      if (res.ok) {
        const data = await res.json();
        const conversations = data.conversations || [];

        // For each conversation, we need to get the other user's info
        // and the last message
        const directThreads = await Promise.all(
          conversations.map(
            async (conv: {
              id: string;
              otherUserId: string;
              updatedAt: string;
            }) => {
              // Fetch the other user's info by ID
              let participantName = "Unknown User";
              let participantInitials = "??";
              let participantColor = getColorForName("Unknown");
              let participantAvatarPath: string | null = null;

              try {
                const userRes = await fetch(`/api/users/${conv.otherUserId}`);
                if (userRes.ok) {
                  const userData = await userRes.json();
                  const otherUser = userData.user;
                  if (otherUser) {
                    participantName =
                      otherUser.fullName || otherUser.username || "Unknown";
                    participantInitials =
                      otherUser.avatarInitials || getInitials(participantName);
                    participantColor =
                      otherUser.avatarColor || getColorForName(participantName);
                    participantAvatarPath = otherUser.avatarPath || null;
                  }
                }
              } catch (err) {
                console.error("Error fetching user info:", err);
              }

              // Fetch last message for this conversation
              let lastMessage: Message = {
                id: `placeholder-${conv.id}`,
                senderId: "system",
                senderName: "System",
                content: "No messages yet",
                type: "message",
                timestamp: conv.updatedAt || new Date().toISOString(),
                isRead: true,
              };

              try {
                const msgRes = await fetch(`/api/messages/${conv.id}?limit=1&newest=true`);
                if (msgRes.ok) {
                  const msgData = await msgRes.json();
                  const messages = msgData.messages || [];

                  if (messages.length > 0) {
                    const msg = messages[0];
                    lastMessage = {
                      id: msg.id,
                      senderId: msg.senderId,
                      senderName:
                        msg.senderId === user.id ? "You" : participantName,
                      content: msg.encryptedContent || "[Encrypted message]",
                      type: msg.type || "message",
                      timestamp: msg.createdAt,
                      isRead: msg.isRead,
                    };
                  }
                }
              } catch (err) {
                console.error("Error fetching messages:", err);
              }

              return {
                id: conv.id,
                type: "direct" as const,
                participantId: conv.otherUserId,
                participantName,
                participantInitials,
                participantColor,
                participantAvatarPath,
                lastMessage,
                unreadCount:
                  lastMessage.isRead || lastMessage.senderId === user.id ? 0 : 1,
              } as Thread;
            }
          )
        );
        directConversations.push(...directThreads);
      }

      // Fetch group conversations
      const groupThreads: Thread[] = [];
      try {
        const groupRes = await fetch("/api/conversations/groups");
        if (groupRes.ok) {
          const groupData = await groupRes.json();
          const groups = groupData.groups || [];

          for (const group of groups) {
            // Fetch last message for this group
            let lastMessage: Message = {
              id: `placeholder-${group.id}`,
              senderId: "system",
              senderName: "System",
              content: "No messages yet",
              type: "message",
              timestamp: group.updated_at || new Date().toISOString(),
              isRead: true,
            };

            try {
              const msgRes = await fetch(`/api/messages/${group.id}?limit=1&newest=true`);
              if (msgRes.ok) {
                const msgData = await msgRes.json();
                const messages = msgData.messages || [];

                if (messages.length > 0) {
                  const msg = messages[0];
                  lastMessage = {
                    id: msg.id,
                    senderId: msg.senderId,
                    senderName: msg.senderId === user.id ? "You" : "Member",
                    content: msg.encryptedContent || "[Encrypted message]",
                    type: msg.type || "message",
                    timestamp: msg.createdAt,
                    isRead: msg.isRead,
                  };
                }
              }
            } catch (err) {
              console.error("Error fetching group messages:", err);
            }

            groupThreads.push({
              id: group.id,
              type: "group",
              participantName: group.group_name || "Unnamed Group",
              groupName: group.group_name,
              groupAvatarPath: group.group_avatar_path,
              creatorId: group.creator_id,
              memberCount: group.member_count || 0,
              participantInitials: (group.group_name || "G").substring(0, 2).toUpperCase(),
              participantColor: getColorForName(group.group_name || "Group"),
              lastMessage,
              unreadCount: lastMessage.isRead || lastMessage.senderId === user.id ? 0 : 1,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching groups:", err);
      }

      // Combine and sort by most recent
      const allThreads = [...directConversations, ...groupThreads];
      allThreads.sort(
        (a, b) =>
          new Date(b.lastMessage.timestamp).getTime() -
          new Date(a.lastMessage.timestamp).getTime()
      );

      setThreads(allThreads);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [user?.id]);

  // Fetch conversations on mount, when modal opens, and poll periodically for notifications
  useEffect(() => {
    if (!user?.id) return;
    
    // Initial fetch
    fetchConversations();
    
    // Poll every 30 seconds for new messages (for notification badges)
    const pollInterval = setInterval(() => {
      fetchConversations();
    }, 30000);
    
    return () => clearInterval(pollInterval);
  }, [user?.id, fetchConversations]);
  
  // Also fetch when modal opens (for immediate refresh)
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchConversations();
    }
  }, [isOpen, user?.id, fetchConversations]);

  // Fetch friends when compose modal opens
  useEffect(() => {
    if (!showSearchCompose || !user?.id) return;

    const fetchFriends = async () => {
      setIsLoadingFriends(true);
      try {
        const res = await fetch("/api/friends?type=friends");
        if (res.ok) {
          const data = await res.json();
          // Map friends to SearchUser format
          const friendsList: SearchUser[] = (data.friends || [])
            .filter((f: { user: SearchUser | null }) => f.user)
            .map((f: { user: SearchUser }) => ({
              id: f.user.id,
              fullName: f.user.fullName || f.user.username || "Unknown",
              username: f.user.username || "",
              avatarInitials: f.user.avatarInitials,
              avatarColor: f.user.avatarColor,
              avatarPath: f.user.avatarPath,
            }));
          setFriends(friendsList);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
      } finally {
        setIsLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [showSearchCompose, user?.id]);

  // Search for users
  useEffect(() => {
    if (!showSearchCompose || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/users?q=${encodeURIComponent(searchQuery)}&exclude=${
            user?.id || ""
          }`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, showSearchCompose, user?.id]);

  const handleStartConversation = async (targetUser: SearchUser) => {
    // Create or find existing thread with this user
    const existingThread = threads.find(
      (t) => t.type === "direct" && t.participantId === targetUser.id
    );

    if (existingThread) {
      setSelectedThread(existingThread);
    } else {
      try {
        // Create conversation via API
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otherUserId: targetUser.id }),
        });

        if (!res.ok) {
          console.error("Failed to create conversation");
          return;
        }

        const data = await res.json();
        const conversationId = data.conversation?.id;

        // Create new thread with the real conversation ID
        const newThread: Thread = {
          id: conversationId || `thread-new-${Date.now()}`,
          type: "direct",
          participantId: targetUser.id,
          participantName: targetUser.fullName,
          participantInitials:
            targetUser.avatarInitials || getInitials(targetUser.fullName),
          participantColor:
            targetUser.avatarColor || getColorForName(targetUser.fullName),
          participantAvatarPath: targetUser.avatarPath,
          lastMessage: {
            id: `msg-placeholder-${Date.now()}`,
            senderId: "system",
            senderName: "System",
            content: "Start a conversation...",
            type: "message",
            timestamp: new Date().toISOString(),
            isRead: true,
          },
          unreadCount: 0,
        };
        setThreads((prev) => [newThread, ...prev]);
        setSelectedThread(newThread);
      } catch (error) {
        console.error("Error starting conversation:", error);
      }
    }

    setShowSearchCompose(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Create group chat
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0 || isCreatingGroup) return;

    setIsCreatingGroup(true);
    try {
      const res = await fetch("/api/conversations/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: newGroupName.trim(),
          memberIds: selectedMembers.map((m) => m.id),
        }),
      });

      if (!res.ok) {
        console.error("Failed to create group");
        return;
      }

      const data = await res.json();
      const conversationId = data.conversationId;

      // Create new thread
      const newThread: Thread = {
        id: conversationId,
        type: "group",
        participantName: newGroupName.trim(),
        groupName: newGroupName.trim(),
        creatorId: user?.id,
        memberCount: selectedMembers.length + 1,
        participantInitials: newGroupName.substring(0, 2).toUpperCase(),
        participantColor: getColorForName(newGroupName),
        lastMessage: {
          id: `msg-placeholder-${Date.now()}`,
          senderId: "system",
          senderName: "System",
          content: "Group created",
          type: "message",
          timestamp: new Date().toISOString(),
          isRead: true,
        },
        unreadCount: 0,
      };

      setThreads((prev) => [newThread, ...prev]);
      setSelectedThread(newThread);

      // Reset state
      setShowCreateGroup(false);
      setShowSearchCompose(false);
      setNewGroupName("");
      setSelectedMembers([]);
    } catch (error) {
      console.error("Error creating group:", error);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const toggleMemberSelection = (member: SearchUser) => {
    setSelectedMembers((prev) => {
      const isSelected = prev.some((m) => m.id === member.id);
      if (isSelected) {
        return prev.filter((m) => m.id !== member.id);
      } else {
        return [...prev, member];
      }
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 1) return name.substring(0, 2).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  };

  const handleOpenThread = (thread: Thread) => {
    setSelectedThread(thread);
    // Mark as read
    setThreads((prev) =>
      prev.map((t) =>
        t.id === thread.id
          ? {
              ...t,
              unreadCount: 0,
              lastMessage: { ...t.lastMessage, isRead: true },
            }
          : t
      )
    );
  };

  const handleBackToList = () => {
    setSelectedThread(null);
  };

  // Action can be: "clear" (hide thread), "leave" (leave group), "delete" (delete conversation/group)
  const handleDeleteThread = async (threadId: string, action: "clear" | "leave" | "delete" = "delete") => {
    try {
      if (action === "clear") {
        // Just clear/hide the thread from view (user stays in group)
        // For now, we just remove it from local state - it will reappear on refresh if there are messages
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        setSelectedThread(null);
        return;
      }

      if (action === "leave") {
        // Leave group - removes user from group membership
        const res = await fetch(`/api/conversations/groups/${threadId}/members`, {
          method: "DELETE",
        });

        if (res.ok) {
          setThreads((prev) => prev.filter((t) => t.id !== threadId));
          setSelectedThread(null);
        } else {
          const data = await res.json().catch(() => ({}));
          if (data.requiresAdminAppoint) {
            alert(data.reason || "You must appoint another admin before leaving.");
          } else {
            console.error("Failed to leave group:", data.error);
          }
        }
        return;
      }

      // action === "delete" - Delete conversation entirely
      // Check if this is a group by looking at the thread
      const thread = threads.find((t) => t.id === threadId);
      if (thread?.type === "group") {
        // For groups, this deletes the entire group for everyone
        // We use a special endpoint or query param to indicate full deletion
        const res = await fetch(`/api/conversations/groups/${threadId}/members?deleteGroup=true`, {
          method: "DELETE",
        });

        if (res.ok) {
          setThreads((prev) => prev.filter((t) => t.id !== threadId));
          setSelectedThread(null);
        } else {
          console.error("Failed to delete group");
        }
      } else {
        // Delete direct conversation
        const res = await fetch(`/api/messages/${threadId}`, {
          method: "DELETE",
        });

        if (res.ok) {
          setThreads((prev) => prev.filter((t) => t.id !== threadId));
          setSelectedThread(null);
        } else {
          console.error("Failed to delete conversation");
        }
      }
    } catch (error) {
      console.error("Error in handleDeleteThread:", error);
    }
  };

  return (
    <>
      {/* Floating Action Button - Hidden when modal is open, hidden on mobile (use hamburger menu) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed z-50 flex items-center justify-center transition-all hover:scale-105 hide-mobile ${className}`}
          style={{
            bottom: "max(24px, env(safe-area-inset-bottom, 24px))",
            right: "24px",
            background: "var(--surface-elevated)",
            border: "1px solid var(--border-medium)",
            borderRadius: "36px",
            padding: "18px 28px",
            gap: "var(--space-sm)",
            boxShadow: "var(--shadow-xl)",
            minHeight: "72px",
          }}
          aria-label={`Messages${
            totalUnread > 0 ? `, ${totalUnread} unread` : ""
          }`}
        >
          {/* Message Icon */}
          <div style={{ position: "relative" }}>
            <svg
              style={{ width: "32px", height: "32px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {/* Unread Badge */}
            {totalUnread > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-10px",
                  background: "var(--error)",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: "600",
                  minWidth: "22px",
                  height: "22px",
                  borderRadius: "11px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 6px",
                }}
              >
                {totalUnread}
              </span>
            )}
          </div>
          <span
            className="font-medium text-[var(--text-primary)]"
            style={{ fontSize: "var(--text-lg)" }}
          >
            Messages
          </span>
        </button>
      )}

      {/* Messages Modal - Anchored at bottom right on desktop, full screen on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
              setSelectedThread(null);
            }
          }}
          style={{
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.4)",
          }}
        >
          <div
            className="messages-modal-grow messages-modal-container"
            style={{
              position: "fixed",
              display: "flex",
              flexDirection: "column",
              background: "var(--surface-primary)",
              overflow: "hidden",
              animation: "growFromBottom 0.25s ease-out forwards",
            }}
          >
            {selectedThread ? (
              // Thread View
              <ThreadView
                thread={selectedThread}
                onBack={handleBackToList}
                onClose={() => {
                  setIsOpen(false);
                  setSelectedThread(null);
                }}
                onDelete={handleDeleteThread}
                onPrayerAdded={onPrayerAdded}
                onMessageSent={fetchConversations}
                getInitials={getInitials}
                formatTime={formatTime}
                currentUserId={user?.id}
              />
            ) : (
              // Threads List
              <>
                {/* Header */}
                <div
                  className="flex items-center justify-between"
                  style={{
                    padding: "var(--space-md) var(--space-lg)",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div
                    className="flex items-center"
                    style={{ gap: "var(--space-sm)" }}
                  >
                    <h2
                      className="font-serif font-semibold"
                      style={{ fontSize: "var(--text-lg)" }}
                    >
                      Messages
                    </h2>
                    {totalUnread > 0 && (
                      <span
                        className="badge"
                        style={{
                          background: "var(--error)",
                          color: "white",
                          fontSize: "11px",
                          padding: "2px 8px",
                        }}
                      >
                        {totalUnread}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center"
                    style={{ gap: "var(--space-xs)" }}
                  >
                    {/* New Message Button */}
                    <button
                      className="icon-btn"
                      onClick={() => setShowSearchCompose(true)}
                      title="New message"
                    >
                      <svg
                        style={{ width: "20px", height: "20px" }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    {/* Close Button */}
                    <button
                      className="icon-btn"
                      onClick={() => setIsOpen(false)}
                    >
                      <svg
                        style={{ width: "20px", height: "20px" }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Search/Compose Modal */}
                {showSearchCompose && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "var(--surface-primary)",
                      zIndex: 10,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      className="flex items-center"
                      style={{
                        padding: "var(--space-md) var(--space-lg)",
                        borderBottom: "1px solid var(--border-light)",
                        gap: "var(--space-sm)",
                      }}
                    >
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setShowSearchCompose(false);
                          setShowCreateGroup(false);
                          setSearchQuery("");
                          setSearchResults([]);
                          setSelectedMembers([]);
                          setNewGroupName("");
                        }}
                      >
                        <svg
                          style={{ width: "20px", height: "20px" }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                      </button>
                      <h2
                        className="font-serif font-semibold"
                        style={{ fontSize: "var(--text-lg)" }}
                      >
                        {showCreateGroup ? "New Group" : "New Message"}
                      </h2>
                    </div>

                    {/* Toggle between direct message and group */}
                    <div
                      className="flex"
                      style={{
                        padding: "var(--space-sm) var(--space-lg)",
                        gap: "var(--space-sm)",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <button
                        className="btn btn-sm flex-1"
                        style={{
                          background: !showCreateGroup ? "var(--accent-primary)" : "var(--surface-secondary)",
                          color: !showCreateGroup ? "white" : "var(--text-secondary)",
                        }}
                        onClick={() => {
                          setShowCreateGroup(false);
                          setSelectedMembers([]);
                          setNewGroupName("");
                        }}
                      >
                        Direct
                      </button>
                      <button
                        className="btn btn-sm flex-1"
                        style={{
                          background: showCreateGroup ? "var(--accent-primary)" : "var(--surface-secondary)",
                          color: showCreateGroup ? "white" : "var(--text-secondary)",
                        }}
                        onClick={() => setShowCreateGroup(true)}
                      >
                        Group
                      </button>
                    </div>

                    {showCreateGroup ? (
                      <>
                        {/* Group name input */}
                        <div style={{ padding: "var(--space-md) var(--space-lg)" }}>
                          <input
                            type="text"
                            className="input"
                            placeholder="Group name..."
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            style={{ marginBottom: "var(--space-sm)" }}
                          />
                          {selectedMembers.length > 0 && (
                            <div
                              className="flex flex-wrap"
                              style={{ gap: "var(--space-xs)" }}
                            >
                              {selectedMembers.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center"
                                  style={{
                                    background: "var(--accent-primary-light)",
                                    borderRadius: "16px",
                                    padding: "4px 12px",
                                    fontSize: "var(--text-sm)",
                                    gap: "6px",
                                  }}
                                >
                                  <span>{member.fullName}</span>
                                  <button
                                    onClick={() => toggleMemberSelection(member)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Create button */}
                        {selectedMembers.length > 0 && newGroupName.trim() && (
                          <div style={{ padding: "0 var(--space-lg) var(--space-md)" }}>
                            <button
                              className="btn btn-primary w-full"
                              onClick={handleCreateGroup}
                              disabled={isCreatingGroup}
                            >
                              {isCreatingGroup ? "Creating..." : `Create Group (${selectedMembers.length} members)`}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ padding: "var(--space-md) var(--space-lg)" }}>
                        <div className="relative">
                          <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                            style={{ width: "18px", height: "18px" }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                          <input
                            type="text"
                            className="input"
                            style={{ paddingLeft: "42px" }}
                            placeholder="Search by name or @username..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {isSearching || isLoadingFriends ? (
                        <div
                          className="text-center text-[var(--text-muted)]"
                          style={{ padding: "var(--space-lg)" }}
                        >
                          {isSearching ? "Searching..." : "Loading friends..."}
                        </div>
                      ) : searchQuery.length >= 2 ? (
                        // Show search results when searching
                        searchResults.length > 0 ? (
                          searchResults.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => handleStartConversation(u)}
                              className="w-full flex items-center text-left transition-colors hover:bg-[var(--surface-secondary)]"
                              style={{
                                padding: "var(--space-md) var(--space-lg)",
                                gap: "var(--space-md)",
                                borderBottom: "1px solid var(--border-light)",
                              }}
                            >
                              <div
                                className="rounded-full flex items-center justify-center overflow-hidden"
                                style={{
                                  width: "48px",
                                  height: "48px",
                                  background: u.avatarPath
                                    ? "transparent"
                                    : u.avatarColor || getColorForName(u.fullName),
                                  color: "white",
                                  fontWeight: "600",
                                }}
                              >
                                {u.avatarPath ? (
                                  <img
                                    src={u.avatarPath}
                                    alt={u.fullName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  u.avatarInitials || getInitials(u.fullName)
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-[var(--text-primary)]">
                                  {u.fullName}
                                </p>
                                <p
                                  className="text-[var(--text-muted)]"
                                  style={{ fontSize: "var(--text-sm)" }}
                                >
                                  @{u.username}
                                </p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div
                            className="text-center text-[var(--text-muted)]"
                            style={{ padding: "var(--space-lg)" }}
                          >
                            No users found
                          </div>
                        )
                      ) : friends.length > 0 ? (
                        // Show friends when not searching
                        <>
                          <div
                            className="text-[var(--text-muted)] text-sm font-medium"
                            style={{
                              padding:
                                "var(--space-sm) var(--space-lg) var(--space-xs)",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {showCreateGroup ? "Select Members" : "Friends"}
                          </div>
                          {friends.map((friend) => {
                            const isSelected = selectedMembers.some((m) => m.id === friend.id);
                            return (
                              <button
                                key={friend.id}
                                onClick={() => showCreateGroup ? toggleMemberSelection(friend) : handleStartConversation(friend)}
                                className="w-full flex items-center text-left transition-colors hover:bg-[var(--surface-secondary)]"
                                style={{
                                  padding: "var(--space-md) var(--space-lg)",
                                  gap: "var(--space-md)",
                                  borderBottom: "1px solid var(--border-light)",
                                  background: isSelected ? "var(--accent-primary-light)" : "transparent",
                                }}
                              >
                                {showCreateGroup && (
                                  <div
                                    style={{
                                      width: "24px",
                                      height: "24px",
                                      borderRadius: "6px",
                                      border: isSelected ? "none" : "2px solid var(--border-medium)",
                                      background: isSelected ? "var(--accent-primary)" : "transparent",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {isSelected && (
                                      <svg
                                        style={{ width: "14px", height: "14px", color: "white" }}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    )}
                                  </div>
                                )}
                                <div
                                  className="rounded-full flex items-center justify-center overflow-hidden"
                                  style={{
                                    width: "48px",
                                    height: "48px",
                                    background: friend.avatarPath
                                      ? "transparent"
                                      : friend.avatarColor || getColorForName(friend.fullName),
                                    color: "white",
                                    fontWeight: "600",
                                  }}
                                >
                                  {friend.avatarPath ? (
                                    <img
                                      src={friend.avatarPath}
                                      alt={friend.fullName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    friend.avatarInitials || getInitials(friend.fullName)
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-[var(--text-primary)]">
                                    {friend.fullName}
                                  </p>
                                  <p
                                    className="text-[var(--text-muted)]"
                                    style={{ fontSize: "var(--text-sm)" }}
                                  >
                                    @{friend.username}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </>
                      ) : (
                        <div
                          className="text-center text-[var(--text-muted)]"
                          style={{ padding: "var(--space-lg)" }}
                        >
                          Search for a user to start a conversation
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Threads List */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {isLoadingThreads ? (
                    <div
                      className="flex flex-col items-center justify-center"
                      style={{ padding: "var(--space-3xl) var(--space-lg)" }}
                    >
                      <div
                        className="animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent"
                        style={{ width: "32px", height: "32px" }}
                      />
                      <p
                        className="text-[var(--text-secondary)]"
                        style={{
                          fontSize: "var(--text-sm)",
                          marginTop: "var(--space-md)",
                        }}
                      >
                        Loading conversations...
                      </p>
                    </div>
                  ) : threads.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center text-center"
                      style={{ padding: "var(--space-3xl) var(--space-lg)" }}
                    >
                      <div
                        className="bg-[var(--surface-accent)] rounded-full flex items-center justify-center"
                        style={{
                          width: "56px",
                          height: "56px",
                          marginBottom: "var(--space-md)",
                        }}
                      >
                        <svg
                          style={{ width: "28px", height: "28px" }}
                          className="text-[var(--accent-primary)]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      </div>
                      <p
                        className="text-[var(--text-secondary)]"
                        style={{ fontSize: "var(--text-sm)" }}
                      >
                        No messages yet
                      </p>
                      <p
                        className="text-[var(--text-muted)]"
                        style={{
                          fontSize: "var(--text-xs)",
                          marginTop: "var(--space-xs)",
                        }}
                      >
                        Tap the + button to start a conversation
                      </p>
                    </div>
                  ) : (
                    threads.map((thread) => (
                      <button
                        key={thread.id}
                        onClick={() => handleOpenThread(thread)}
                        className="w-full flex items-center text-left transition-colors"
                        style={{
                          padding: "var(--space-lg) var(--space-lg)",
                          gap: "var(--space-md)",
                          background:
                            thread.unreadCount > 0
                              ? "var(--surface-accent)"
                              : "transparent",
                          borderBottom: "1px solid var(--border-light)",
                          minHeight: "85px",
                        }}
                      >
                        {/* Avatar */}
                        <div
                          className="flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden"
                          style={{
                            width: "60px",
                            height: "60px",
                            background: thread.type === "group"
                              ? thread.groupAvatarPath
                                ? "transparent"
                                : "var(--accent-secondary)"
                              : thread.participantAvatarPath
                                ? "transparent"
                                : thread.participantColor || getColorForName(thread.participantName),
                            color: "white",
                            fontWeight: "600",
                            fontSize: "var(--text-lg)",
                            position: "relative",
                          }}
                        >
                          {thread.type === "group" ? (
                            thread.groupAvatarPath ? (
                              <img
                                src={thread.groupAvatarPath}
                                alt={thread.groupName || "Group"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <svg
                                style={{ width: "28px", height: "28px" }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                            )
                          ) : thread.participantAvatarPath ? (
                            <img
                              src={thread.participantAvatarPath}
                              alt={thread.participantName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            thread.participantInitials || getInitials(thread.participantName)
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div
                            className="flex items-center justify-between"
                            style={{ marginBottom: "4px" }}
                          >
                            <span
                              className={`font-medium truncate flex items-center ${
                                thread.unreadCount > 0
                                  ? "text-[var(--text-primary)]"
                                  : "text-[var(--text-secondary)]"
                              }`}
                              style={{ fontSize: "var(--text-base)", gap: "6px" }}
                            >
                              {thread.type === "group" && (
                                <span style={{ fontSize: "14px" }}>👥</span>
                              )}
                              {thread.participantName}
                              {thread.type === "group" && thread.memberCount && (
                                <span
                                  className="text-[var(--text-muted)]"
                                  style={{ fontSize: "var(--text-xs)" }}
                                >
                                  ({thread.memberCount})
                                </span>
                              )}
                            </span>
                            <span
                              className="text-[var(--text-muted)] flex-shrink-0"
                              style={{
                                fontSize: "var(--text-xs)",
                                marginLeft: "var(--space-sm)",
                              }}
                            >
                              {formatTime(thread.lastMessage.timestamp)}
                            </span>
                          </div>
                          <div
                            className="flex items-center"
                            style={{ gap: "6px" }}
                          >
                            {/* Prayer Request Indicator */}
                            {thread.lastMessage.type === "prayer_request" && (
                              <span
                                className="flex-shrink-0"
                                style={{
                                  color: "var(--accent-primary)",
                                  fontSize: "var(--text-xs)",
                                }}
                                title="Prayer request"
                              >
                                🙏
                              </span>
                            )}
                            <span
                              className={`truncate ${
                                thread.unreadCount > 0
                                  ? "text-[var(--text-primary)] font-medium"
                                  : "text-[var(--text-muted)]"
                              }`}
                              style={{ fontSize: "var(--text-sm)" }}
                            >
                              {thread.lastMessage.senderId === "test-user-id"
                                ? "You: "
                                : ""}
                              {thread.lastMessage.content}
                            </span>
                          </div>
                        </div>

                        {/* Unread Indicator */}
                        {thread.unreadCount > 0 && (
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: "var(--accent-primary)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Thread View Component
interface ThreadViewProps {
  thread: Thread;
  onBack: () => void;
  onClose: () => void;
  onDelete: (threadId: string, action?: "clear" | "leave" | "delete") => void;
  onPrayerAdded?: () => void;
  onMessageSent?: () => void;
  getInitials: (name: string) => string;
  formatTime: (timestamp: string) => string;
  currentUserId?: string;
}

function ThreadView({
  thread,
  onBack,
  onClose,
  onDelete,
  onPrayerAdded,
  onMessageSent,
  getInitials,
  formatTime,
  currentUserId,
}: ThreadViewProps) {
  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState<"message" | "prayer_request">(
    "message"
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showAddToPrayer, setShowAddToPrayer] = useState<string | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState<{
    messageId: string;
    prayerType: "immediate" | "ongoing";
  } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Group-specific state
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState<string | null>(null);

  // Group editing state
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editedGroupName, setEditedGroupName] = useState(thread.groupName || "");
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupAvatarPath, setGroupAvatarPath] = useState(thread.groupAvatarPath || null);
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<GroupMember[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState<string | null>(null);

  // Admin management state
  const [canLeave, setCanLeave] = useState(true);
  const [leaveBlockedReason, setLeaveBlockedReason] = useState("");
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [showAdminRequiredModal, setShowAdminRequiredModal] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);

  // Ref for scrolling to bottom
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Start at bottom when messages load (instant, no animation)
  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0 && messagesContainerRef.current) {
      // Instantly scroll to bottom without animation
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [isLoadingMessages, messages.length]);

  // Fetch group members when group thread is open (for showing avatars in messages)
  useEffect(() => {
    if (thread.type === "group") {
      setIsLoadingMembers(true);
      fetch(`/api/conversations/groups/${thread.id}/members`)
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error("Failed to fetch group members:", res.status, errorData);
            return { members: [], isAdmin: false };
          }
          return res.json();
        })
        .then((data) => {
          console.log("Group members fetched:", data);
          setGroupMembers(data.members || []);
          setIsAdmin(data.isAdmin || false);
          setCanLeave(data.canLeave !== false);
          setLeaveBlockedReason(data.leaveBlockedReason || "");
          setCreatorId(data.creatorId || null);
        })
        .catch((err) => {
          console.error("Error fetching group members:", err);
        })
        .finally(() => {
          setIsLoadingMembers(false);
        });
    }
  }, [thread.id, thread.type]);

  // Create a lookup map for group members by userId
  const memberLookup = useMemo(() => {
    const map = new Map<string, GroupMember>();
    groupMembers.forEach((member) => {
      map.set(member.userId, member);
    });
    return map;
  }, [groupMembers]);

  // Handle removing a member from group
  const handleRemoveMember = async (memberId: string) => {
    if (isRemovingMember) return;
    setIsRemovingMember(memberId);
    try {
      const res = await fetch(
        `/api/conversations/groups/${thread.id}/members?userId=${memberId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setGroupMembers((prev) => prev.filter((m) => m.userId !== memberId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove member");
      }
    } catch (err) {
      console.error("Error removing member:", err);
    } finally {
      setIsRemovingMember(null);
    }
  };

  // Handle promoting/demoting a member
  const handleChangeRole = async (memberId: string, action: "promote" | "demote") => {
    if (isChangingRole) return;
    setIsChangingRole(memberId);
    try {
      const res = await fetch(
        `/api/conversations/groups/${thread.id}/members`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: memberId, action }),
        }
      );
      if (res.ok) {
        // Update local state
        setGroupMembers((prev) =>
          prev.map((m) =>
            m.userId === memberId
              ? { ...m, role: action === "promote" ? "admin" : "member" }
              : m
          )
        );
        // Re-fetch to get updated canLeave status
        const refreshRes = await fetch(`/api/conversations/groups/${thread.id}/members`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setCanLeave(data.canLeave !== false);
          setLeaveBlockedReason(data.leaveBlockedReason || "");
        }
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${action} member`);
      }
    } catch (err) {
      console.error(`Error ${action}ing member:`, err);
    } finally {
      setIsChangingRole(null);
    }
  };

  // Handle leave group with admin check (for admins/creator)
  const handleLeaveGroup = () => {
    if (!canLeave) {
      // Show admin required modal FIRST
      setShowAdminRequiredModal(true);
    } else {
      // Show leave confirmation
      setShowLeaveConfirm(true);
    }
  };

  // Handle delete group (for admins/creator only)
  const handleDeleteGroup = () => {
    setShowDeleteGroupConfirm(true);
  };

  // Fetch friends who can be added to the group
  const fetchAvailableFriends = async () => {
    setIsLoadingFriends(true);
    try {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        const friends = (data.friends || []).map((f: {
          id: string;
          user: {
            id: string;
            fullName: string;
            username: string;
            avatarInitials: string | null;
            avatarColor: string;
            avatarPath: string | null;
          };
        }) => ({
          userId: f.user.id,
          fullName: f.user.fullName || f.user.username || "Unknown",
          username: f.user.username || "",
          avatarInitials: f.user.avatarInitials,
          avatarColor: f.user.avatarColor,
          avatarPath: f.user.avatarPath,
          role: "member",
        }));
        // Filter out users who are already members
        const memberIds = new Set(groupMembers.map((m) => m.userId));
        setAvailableFriends(friends.filter((f: GroupMember) => !memberIds.has(f.userId)));
      }
    } catch (err) {
      console.error("Error fetching friends:", err);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // Handle adding a member to group
  const handleAddMember = async (userId: string) => {
    if (isAddingMember) return;
    setIsAddingMember(userId);
    try {
      const res = await fetch(`/api/conversations/groups/${thread.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        // Refresh members list
        const membersRes = await fetch(`/api/conversations/groups/${thread.id}/members`);
        if (membersRes.ok) {
          const data = await membersRes.json();
          setGroupMembers(data.members || []);
        }
        // Remove from available friends
        setAvailableFriends((prev) => prev.filter((f) => f.userId !== userId));
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to add member:", errorData);
        alert("Failed to add member. " + (errorData.error || ""));
      }
    } catch (err) {
      console.error("Error adding member:", err);
      alert("Failed to add member. Please try again.");
    } finally {
      setIsAddingMember(null);
    }
  };

  // Handle saving group name
  const handleSaveGroupName = async () => {
    if (!editedGroupName.trim() || isSavingGroup) return;
    setIsSavingGroup(true);
    try {
      const res = await fetch(`/api/conversations/groups/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: editedGroupName.trim() }),
      });
      if (res.ok) {
        // Update thread name locally - will be reflected on next refresh
        thread.groupName = editedGroupName.trim();
        thread.participantName = editedGroupName.trim();
        setIsEditingGroupName(false);
        // Force re-fetch conversations to update the list
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refreshConversations"));
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to update group name:", res.status, errorData);
        alert("Failed to save group name. Please try again.");
      }
    } catch (err) {
      console.error("Error saving group name:", err);
      alert("Failed to save group name. Please try again.");
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Handle group avatar upload
  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploadingGroupAvatar) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setIsUploadingGroupAvatar(true);
    try {
      // Upload the image
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "group");
      formData.append("groupId", thread.id);

      const uploadRes = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      const { url } = await uploadRes.json();

      // Update the group with the new avatar path
      const updateRes = await fetch(`/api/conversations/groups/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupAvatarPath: url }),
      });

      if (updateRes.ok) {
        setGroupAvatarPath(url);
        thread.groupAvatarPath = url;
        // Force re-fetch conversations to update the list
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refreshConversations"));
        }
      } else {
        const errorData = await updateRes.json().catch(() => ({}));
        console.error("Failed to update group avatar:", updateRes.status, errorData);
        alert("Failed to save group image. Please try again.");
      }
    } catch (err) {
      console.error("Error uploading group avatar:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingGroupAvatar(false);
      // Reset the input
      if (groupAvatarInputRef.current) {
        groupAvatarInputRef.current.value = "";
      }
    }
  };

  // Hooks for encryption
  const {
    encryptPrayers: cryptoEncryptPrayers,
    decryptPrayers: cryptoDecryptPrayers,
  } = useCrypto();
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Fetch messages for this conversation
  useEffect(() => {
    const fetchMessages = async () => {
      if (!thread.id || thread.id.startsWith("thread-new-")) {
        // New conversation, no messages yet
        setMessages([]);
        setIsLoadingMessages(false);
        return;
      }

      setIsLoadingMessages(true);
      try {
        // For group chats, include sender info to handle removed members
        const includesSender = thread.type === "group";
        const url = `/api/messages/${thread.id}?limit=50${includesSender ? "&includeSender=true" : ""}`;
        const res = await fetch(url);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("Failed to fetch messages:", res.status, errorData);
          setMessages([]);
          return;
        }

        const data = await res.json();
        const apiMessages = (data.messages || []).map(
          (msg: {
            id: string;
            senderId: string;
            encryptedContent: string;
            type: string;
            createdAt: string;
            isRead: boolean;
            sender?: {
              fullName: string;
              username: string | null;
              avatarInitials: string | null;
              avatarColor: string;
              avatarPath: string | null;
            };
          }) => ({
            id: msg.id,
            senderId: msg.senderId,
            senderName:
              msg.senderId === currentUserId
                ? "You"
                : msg.sender?.fullName || thread.participantName,
            senderAvatar: msg.sender?.avatarPath || undefined,
            senderColor: msg.sender?.avatarColor || undefined,
            senderInitials: msg.sender?.avatarInitials || undefined,
            content: msg.encryptedContent || "[Encrypted message]", // Would decrypt in production
            type: msg.type || "message",
            timestamp: msg.createdAt,
            isRead: msg.isRead,
          })
        );

        setMessages(apiMessages);
      } catch (error) {
        console.error("Error fetching messages:", error);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [thread.id, thread.participantName, thread.type, currentUserId]);

  // Fetch profiles when needed
  useEffect(() => {
    if (showProfileSelector) {
      setIsLoadingProfiles(true);
      fetch("/api/people")
        .then((res) => res.json())
        .then((data) => {
          setProfiles(data.people || []);
        })
        .catch((err) => {
          console.error("Error fetching profiles:", err);
        })
        .finally(() => {
          setIsLoadingProfiles(false);
        });
    }
  }, [showProfileSelector]);

  const handleSend = async () => {
    if (!newMessage.trim() || !thread.id || isSending) return;

    setIsSending(true);
    const content = newMessage.trim();
    const type = messageType;

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUserId || "unknown",
      senderName: "You",
      content: content,
      type: type,
      timestamp: new Date().toISOString(),
      isRead: true,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage("");
    setMessageType("message");

    try {
      // For now, send unencrypted (would encrypt in production)
      const res = await fetch(`/api/messages/${thread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedContent: content, // Would be encrypted
          iv: "placeholder-iv", // Would be real IV
          type: type,
        }),
      });

      if (!res.ok) {
        console.error("Failed to send message");
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        return;
      }

      const data = await res.json();
      // Replace temp message with real one
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempMsg.id ? { ...m, id: data.message?.id || m.id } : m
        )
      );

      // Notify parent to refresh thread list
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectPrayerType = async (
    messageId: string,
    prayerType: "immediate" | "ongoing"
  ) => {
    setShowAddToPrayer(null);

    // Check if the sender is connected to a profile
    try {
      const res = await fetch(
        `/api/connections?connectedUserId=${thread.participantId}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.profileId && data.profileName) {
          // Auto-add to the connected profile - don't show selector, just add directly
          handleAddToProfileDirect(
            data.profileId,
            data.profileName,
            messageId,
            prayerType
          );
          return;
        }
      }
    } catch (error) {
      console.error("Error checking connection:", error);
    }

    // No connection found, show profile selector
    setShowProfileSelector({ messageId, prayerType });
  };

  // Use alert banner
  let alertBanner: {
    showAlert: (options: {
      title: string;
      description?: string;
      variant?: "default" | "success" | "destructive" | "warning";
      duration?: number;
    }) => void;
  } | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    alertBanner = useAlertBanner();
  } catch {
    // Alert banner not available
  }

  const handleAddToProfile = async (profileId: string, profileName: string) => {
    if (!showProfileSelector) return;

    const message = messages.find(
      (m) => m.id === showProfileSelector.messageId
    );
    if (!message) {
      console.error("Message not found for ID:", showProfileSelector.messageId);
      return;
    }

    try {
      // Get existing prayers for the profile
      const res = await fetch(`/api/people/${profileId}/prayers`);
      const data = await res.json();

      let existingPrayers: Array<{
        id: string;
        text: string;
        category: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        fromMessage?: boolean;
        senderName?: string;
      }> = [];

      // Decrypt existing prayers if they exist
      if (data.encryptedPrayers && data.encryptionIv && currentUserId) {
        try {
          const decrypted = await cryptoDecryptPrayers(
            data.encryptedPrayers,
            data.encryptionIv,
            currentUserId
          );
          // Prayer page stores as { prayers: [...] }
          const prayerData = decrypted as
            | { prayers?: typeof existingPrayers }
            | typeof existingPrayers;
          if (
            prayerData &&
            typeof prayerData === "object" &&
            "prayers" in prayerData
          ) {
            existingPrayers = prayerData.prayers || [];
          } else if (Array.isArray(prayerData)) {
            existingPrayers = prayerData;
          } else {
            existingPrayers = [];
          }
        } catch (decryptError) {
          console.error("Error decrypting prayers:", decryptError);
          // If decryption fails, start with empty array
          existingPrayers = [];
        }
      }

      // Create the new prayer
      const newPrayer = {
        id: `prayer-${Date.now()}`,
        text: message.content,
        category: showProfileSelector.prayerType,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fromMessage: true,
        senderName: message.senderName,
      };

      // Add to existing prayers
      const updatedPrayers = [...existingPrayers, newPrayer];

      // Encrypt the updated prayers (wrapped in object to match prayer page format)
      if (!currentUserId) {
        throw new Error("User not authenticated");
      }
      const encrypted = await cryptoEncryptPrayers(
        { prayers: updatedPrayers },
        currentUserId
      );
      if (!encrypted) {
        throw new Error("Failed to encrypt prayers");
      }

      // Save to the API
      const saveRes = await fetch(`/api/people/${profileId}/prayers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedPrayers: encrypted.encrypted,
          encryptionIv: encrypted.iv,
          prayerCount: updatedPrayers.length,
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveData.error || "Failed to save prayer");
      }

      // Show success using alert banner
      if (alertBanner) {
        alertBanner.showAlert({
          title: `Prayer Added to ${profileName}`,
          description: `"${message.content.substring(0, 50)}${
            message.content.length > 50 ? "..." : ""
          }" has been added as ${
            showProfileSelector.prayerType === "immediate"
              ? "an immediate"
              : "an ongoing"
          } prayer.`,
          variant: "success",
          duration: 3000,
        });
      }

      // Notify parent to refresh prayer counts
      if (onPrayerAdded) {
        onPrayerAdded();
      }
    } catch (error) {
      console.error("Error adding prayer:", error);
      if (alertBanner) {
        alertBanner.showAlert({
          title: "Failed to Add Prayer",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
          duration: 4000,
        });
      }
    }

    setShowProfileSelector(null);
  };

  // Direct version that takes all parameters (for auto-add when sender is connected)
  const handleAddToProfileDirect = async (
    profileId: string,
    profileName: string,
    messageId: string,
    prayerType: "immediate" | "ongoing"
  ) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) {
      console.error("Message not found for ID:", messageId);
      setShowProfileSelector(null);
      return;
    }

    try {
      // Get existing prayers for the profile
      const res = await fetch(`/api/people/${profileId}/prayers`);
      const data = await res.json();

      let existingPrayers: Array<{
        id: string;
        text: string;
        category: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        fromMessage?: boolean;
        senderName?: string;
      }> = [];

      // Decrypt existing prayers if they exist
      if (data.encryptedPrayers && data.encryptionIv && currentUserId) {
        try {
          const decrypted = await cryptoDecryptPrayers(
            data.encryptedPrayers,
            data.encryptionIv,
            currentUserId
          );
          const prayerData = decrypted as
            | { prayers?: typeof existingPrayers }
            | typeof existingPrayers;
          if (
            prayerData &&
            typeof prayerData === "object" &&
            "prayers" in prayerData
          ) {
            existingPrayers = prayerData.prayers || [];
          } else if (Array.isArray(prayerData)) {
            existingPrayers = prayerData;
          }
        } catch (decryptError) {
          console.error("Error decrypting prayers:", decryptError);
        }
      }

      // Create the new prayer
      const newPrayer = {
        id: `prayer-${Date.now()}`,
        text: message.content,
        category: prayerType,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fromMessage: true,
        senderName: message.senderName,
      };

      // Add to existing prayers
      const updatedPrayers = [...existingPrayers, newPrayer];

      // Encrypt the updated prayers
      if (!currentUserId) {
        throw new Error("User not authenticated");
      }
      const encrypted = await cryptoEncryptPrayers(
        { prayers: updatedPrayers },
        currentUserId
      );
      if (!encrypted) {
        throw new Error("Failed to encrypt prayers");
      }

      // Save to the API
      const saveRes = await fetch(`/api/people/${profileId}/prayers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedPrayers: encrypted.encrypted,
          encryptionIv: encrypted.iv,
          prayerCount: updatedPrayers.length,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || "Failed to save prayer");
      }

      // Show success using alert banner
      if (alertBanner) {
        alertBanner.showAlert({
          title: `Prayer Added to ${profileName}`,
          description: `"${message.content.substring(0, 50)}${
            message.content.length > 50 ? "..." : ""
          }" has been added as ${
            prayerType === "immediate" ? "an immediate" : "an ongoing"
          } prayer.`,
          variant: "success",
          duration: 3000,
        });
      }

      // Notify parent to refresh prayer counts
      if (onPrayerAdded) {
        onPrayerAdded();
      }
    } catch (error) {
      console.error("Error auto-adding prayer:", error);
      if (alertBanner) {
        alertBanner.showAlert({
          title: "Failed to Add Prayer",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
          duration: 4000,
        });
      }
    }

    setShowProfileSelector(null);
  };

  return (
    <div
      className="flex flex-col"
      style={{ flex: 1, minHeight: 0, position: "relative" }}
    >
      {/* Profile Selector Modal */}
      {showProfileSelector && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--surface-primary)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="flex items-center"
            style={{
              padding: "var(--space-md) var(--space-lg)",
              borderBottom: "1px solid var(--border-light)",
              gap: "var(--space-sm)",
            }}
          >
            <button
              className="icon-btn"
              onClick={() => setShowProfileSelector(null)}
            >
              <svg
                style={{ width: "20px", height: "20px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h2
              className="font-serif font-semibold"
              style={{ fontSize: "var(--text-lg)" }}
            >
              Add to Profile
            </h2>
          </div>

          <div
            style={{
              padding: "var(--space-md) var(--space-lg)",
              borderBottom: "1px solid var(--border-light)",
            }}
          >
            <p
              className="text-[var(--text-secondary)]"
              style={{ fontSize: "var(--text-sm)" }}
            >
              Select a profile to add this prayer request to:
            </p>
            <div
              className="flex items-center"
              style={{
                marginTop: "var(--space-sm)",
                gap: "var(--space-xs)",
                padding: "var(--space-sm)",
                background:
                  showProfileSelector.prayerType === "immediate"
                    ? "var(--warning-light)"
                    : "var(--accent-secondary-light)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span style={{ fontSize: "var(--text-sm)" }}>
                {showProfileSelector.prayerType === "immediate" ? "⚡" : "🔄"}
              </span>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                {showProfileSelector.prayerType === "immediate"
                  ? "Immediate Prayer"
                  : "Ongoing Prayer"}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {isLoadingProfiles ? (
              <div
                className="text-center text-[var(--text-muted)]"
                style={{ padding: "var(--space-lg)" }}
              >
                Loading profiles...
              </div>
            ) : profiles.length > 0 ? (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() =>
                    handleAddToProfile(profile.id, profile.displayName)
                  }
                  className="w-full flex items-center text-left transition-colors hover:bg-[var(--surface-secondary)]"
                  style={{
                    padding: "var(--space-md) var(--space-lg)",
                    gap: "var(--space-md)",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div
                    className="rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      width: "48px",
                      height: "48px",
                      background: profile.avatarPath
                        ? "transparent"
                        : profile.avatarColor || "#7c9bb8",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    {profile.avatarPath ? (
                      <img
                        src={profile.avatarPath}
                        alt={profile.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      profile.avatarInitials ||
                      profile.displayName.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[var(--text-primary)]">
                      {profile.displayName}
                    </p>
                  </div>
                  <svg
                    style={{ width: "20px", height: "20px" }}
                    className="text-[var(--text-muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              ))
            ) : (
              <div
                className="text-center"
                style={{ padding: "var(--space-xl)" }}
              >
                <p
                  className="text-[var(--text-muted)]"
                  style={{
                    fontSize: "var(--text-sm)",
                    marginBottom: "var(--space-md)",
                  }}
                >
                  No profiles found
                </p>
                <a
                  href="/add"
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = "/add";
                  }}
                >
                  Create a Profile
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Info Modal */}
      {showGroupInfo && thread.type === "group" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--surface-primary)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Fixed Header */}
          <div
            className="flex items-center flex-shrink-0"
            style={{
              padding: "var(--space-md) var(--space-lg)",
              borderBottom: "1px solid var(--border-light)",
              gap: "var(--space-sm)",
            }}
          >
            <button className="icon-btn" onClick={() => setShowGroupInfo(false)}>
              <svg
                style={{ width: "20px", height: "20px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h2 className="font-serif font-semibold" style={{ fontSize: "var(--text-lg)" }}>
              Group Info
            </h2>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Group Avatar & Name - Editable */}
            <div
              className="flex flex-col items-center text-center"
              style={{ padding: "var(--space-lg)" }}
            >
              {/* Avatar with upload button */}
              <div style={{ position: "relative", marginBottom: "var(--space-md)" }}>
                <input
                  ref={groupAvatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleGroupAvatarUpload}
                  style={{ display: "none" }}
                />
                <div
                  className="rounded-full flex items-center justify-center overflow-hidden cursor-pointer"
                  style={{
                    width: "80px",
                    height: "80px",
                    background: groupAvatarPath ? "transparent" : "var(--accent-secondary)",
                    color: "white",
                  }}
                  onClick={() => groupAvatarInputRef.current?.click()}
                  title="Click to change group photo"
                >
                  {isUploadingGroupAvatar ? (
                    <div
                      className="animate-spin rounded-full border-2 border-white border-t-transparent"
                      style={{ width: "24px", height: "24px" }}
                    />
                  ) : groupAvatarPath ? (
                    <img
                      src={groupAvatarPath}
                      alt="Group"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      style={{ width: "40px", height: "40px" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  )}
                </div>
                {/* Camera icon overlay */}
                <div
                  className="absolute flex items-center justify-center rounded-full cursor-pointer"
                  style={{
                    bottom: "0",
                    right: "0",
                    width: "28px",
                    height: "28px",
                    background: "var(--accent-primary)",
                    border: "2px solid var(--surface-primary)",
                  }}
                  onClick={() => groupAvatarInputRef.current?.click()}
                >
                  <svg
                    style={{ width: "14px", height: "14px" }}
                    fill="none"
                    stroke="white"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              </div>

              {/* Editable Group Name */}
              {isEditingGroupName ? (
                <div className="flex items-center" style={{ gap: "8px", marginBottom: "4px" }}>
                  <input
                    type="text"
                    value={editedGroupName}
                    onChange={(e) => setEditedGroupName(e.target.value)}
                    className="input"
                    style={{
                      fontSize: "var(--text-lg)",
                      fontWeight: 600,
                      textAlign: "center",
                      padding: "8px 12px",
                      width: "200px",
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveGroupName();
                      if (e.key === "Escape") {
                        setIsEditingGroupName(false);
                        setEditedGroupName(thread.groupName || "");
                      }
                    }}
                  />
                  <button
                    className="icon-btn"
                    onClick={handleSaveGroupName}
                    disabled={isSavingGroup}
                    style={{ background: "var(--accent-primary)", color: "white" }}
                  >
                    {isSavingGroup ? (
                      <div
                        className="animate-spin rounded-full border-2 border-white border-t-transparent"
                        style={{ width: "16px", height: "16px" }}
                      />
                    ) : (
                      <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => {
                      setIsEditingGroupName(false);
                      setEditedGroupName(thread.groupName || "");
                    }}
                  >
                    <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center cursor-pointer"
                  style={{ gap: "8px", marginBottom: "4px" }}
                  onClick={() => setIsEditingGroupName(true)}
                  title="Click to edit group name"
                >
                  <h3 className="font-semibold text-[var(--text-primary)]" style={{ fontSize: "var(--text-xl)" }}>
                    {thread.groupName || "Group"}
                  </h3>
                  <svg
                    style={{ width: "16px", height: "16px", color: "var(--text-muted)" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </div>
              )}
              <p className="text-[var(--text-muted)]" style={{ fontSize: "var(--text-sm)" }}>
                {groupMembers.length} member{groupMembers.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Members List */}
            <div
              className="text-[var(--text-muted)] text-sm font-medium"
              style={{
                padding: "var(--space-sm) var(--space-lg)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Members
            </div>
            {isLoadingMembers ? (
              <div className="text-center text-[var(--text-muted)]" style={{ padding: "var(--space-lg)" }}>
                Loading members...
              </div>
            ) : (
              groupMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center"
                  style={{
                    padding: "var(--space-md) var(--space-lg)",
                    gap: "var(--space-md)",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div
                    className="rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      width: "44px",
                      height: "44px",
                      background: member.avatarPath
                        ? "transparent"
                        : member.avatarColor || "#7c9bb8",
                      color: "white",
                      fontWeight: "600",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {member.avatarPath ? (
                      <img src={member.avatarPath} alt={member.fullName} className="w-full h-full object-cover" />
                    ) : (
                      member.avatarInitials || member.fullName.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--text-primary)] truncate">
                        {member.fullName}
                        {member.userId === currentUserId && " (You)"}
                      </p>
                      {member.role === "admin" && (
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: member.userId === creatorId ? "var(--accent-primary)" : "var(--warning-light)",
                            color: member.userId === creatorId ? "white" : "var(--warning)",
                            fontWeight: 600,
                          }}
                        >
                          {member.userId === creatorId ? "Creator" : "Admin"}
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text-muted)]" style={{ fontSize: "var(--text-sm)" }}>
                      @{member.username || "user"}
                    </p>
                  </div>
                  {/* Admin controls - only for admins managing other members */}
                  {isAdmin && member.userId !== currentUserId && member.userId !== creatorId && (
                    <div className="flex items-center" style={{ gap: "6px" }}>
                      {member.role === "admin" ? (
                        <button
                          className="btn btn-sm"
                          style={{
                            background: "var(--surface-secondary)",
                            color: "var(--text-secondary)",
                            fontSize: "var(--text-xs)",
                            padding: "4px 10px",
                            height: "28px",
                          }}
                          onClick={() => handleChangeRole(member.userId, "demote")}
                          disabled={isChangingRole === member.userId}
                          title="Remove admin role"
                        >
                          {isChangingRole === member.userId ? "..." : "Demote"}
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-sm"
                            style={{
                              background: "var(--accent-secondary)",
                              color: "var(--accent-dark)",
                              fontSize: "var(--text-xs)",
                              padding: "4px 10px",
                              height: "28px",
                            }}
                            onClick={() => handleChangeRole(member.userId, "promote")}
                            disabled={isChangingRole === member.userId}
                            title="Make admin"
                          >
                            {isChangingRole === member.userId ? "..." : "Make Admin"}
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{
                              background: "var(--error-light)",
                              color: "var(--error)",
                              fontSize: "var(--text-xs)",
                              padding: "4px 10px",
                              height: "28px",
                            }}
                            onClick={() => handleRemoveMember(member.userId)}
                            disabled={isRemovingMember === member.userId}
                            title="Remove from group"
                          >
                            {isRemovingMember === member.userId ? "..." : "Remove"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Add Member Section */}
            {isAdmin && (
              <div style={{ padding: "var(--space-md) var(--space-lg)" }}>
                {!showAddMember ? (
                  <button
                    className="btn w-full"
                    style={{
                      background: "var(--accent-primary)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                    onClick={() => {
                      setShowAddMember(true);
                      fetchAvailableFriends();
                    }}
                  >
                    <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Member
                  </button>
                ) : (
                  <div
                    style={{
                      background: "var(--surface-elevated)",
                      borderRadius: "12px",
                      border: "1px solid var(--border-light)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="flex items-center justify-between"
                      style={{
                        padding: "var(--space-sm) var(--space-md)",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <span className="text-sm font-medium text-[var(--text-secondary)]">
                        Add Friends to Group
                      </span>
                      <button
                        className="icon-btn"
                        onClick={() => setShowAddMember(false)}
                        style={{ width: "28px", height: "28px" }}
                      >
                        <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                      {isLoadingFriends ? (
                        <div className="text-center text-[var(--text-muted)]" style={{ padding: "var(--space-lg)" }}>
                          Loading friends...
                        </div>
                      ) : availableFriends.length === 0 ? (
                        <div className="text-center text-[var(--text-muted)]" style={{ padding: "var(--space-lg)" }}>
                          No friends available to add
                        </div>
                      ) : (
                        availableFriends.map((friend) => (
                          <div
                            key={friend.userId}
                            className="flex items-center"
                            style={{
                              padding: "var(--space-sm) var(--space-md)",
                              gap: "var(--space-sm)",
                              borderBottom: "1px solid var(--border-light)",
                            }}
                          >
                            <div
                              className="rounded-full flex items-center justify-center overflow-hidden"
                              style={{
                                width: "36px",
                                height: "36px",
                                background: friend.avatarPath ? "transparent" : friend.avatarColor || "#7c9bb8",
                                color: "white",
                                fontWeight: "600",
                                fontSize: "var(--text-xs)",
                              }}
                            >
                              {friend.avatarPath ? (
                                <img src={friend.avatarPath} alt={friend.fullName} className="w-full h-full object-cover" />
                              ) : (
                                friend.avatarInitials || friend.fullName.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[var(--text-primary)] truncate text-sm">
                                {friend.fullName}
                              </p>
                            </div>
                            <button
                              className="btn btn-sm"
                              style={{
                                background: "var(--accent-primary)",
                                color: "white",
                                fontSize: "var(--text-xs)",
                                padding: "4px 12px",
                                height: "28px",
                              }}
                              onClick={() => handleAddMember(friend.userId)}
                              disabled={isAddingMember === friend.userId}
                            >
                              {isAddingMember === friend.userId ? "..." : "Add"}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
          {/* End scrollable content */}

          {/* Fixed Bottom Section */}
          <div
            className="flex-shrink-0"
            style={{
              borderTop: "1px solid var(--border-light)",
              background: "var(--surface-primary)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Group Info Notice */}
            <div
              style={{
                margin: "var(--space-md) var(--space-lg)",
                padding: "var(--space-sm) var(--space-md)",
                backgroundColor: "var(--surface-elevated)",
                borderRadius: "8px",
                border: "1px solid var(--border-light)",
              }}
            >
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ color: "var(--text-secondary)" }}>Leave:</strong> You&apos;ll be removed but the group continues.
                {isAdmin && <><br /><strong style={{ color: "var(--text-secondary)" }}>Delete:</strong> Permanently removes the group for everyone.</>}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ padding: "0 var(--space-lg) var(--space-lg)", display: "flex", gap: "var(--space-sm)" }}>
              {/* Leave Group Button - for everyone */}
              <button
                className="btn flex-1 transition-colors hover:bg-[var(--surface-secondary)]"
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-light)",
                }}
                onClick={() => {
                  setShowGroupInfo(false);
                  handleLeaveGroup();
                }}
              >
                Leave Group
              </button>

              {/* Delete Group Button - only for admins/creator */}
              {isAdmin && (
                <button
                  className="btn flex-1 transition-colors hover:opacity-90"
                  style={{
                    background: "var(--error)",
                    color: "white",
                    border: "none",
                  }}
                  onClick={() => {
                    setShowGroupInfo(false);
                    handleDeleteGroup();
                  }}
                >
                  Delete Group
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center"
        style={{
          padding: "var(--space-md) var(--space-lg)",
          borderBottom: "1px solid var(--border-light)",
          gap: "var(--space-sm)",
        }}
      >
        <button className="icon-btn" onClick={onBack}>
          <svg
            style={{ width: "20px", height: "20px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div
          className="rounded-full flex items-center justify-center overflow-hidden"
          style={{
            width: "40px",
            height: "40px",
            background: thread.type === "group"
              ? (groupAvatarPath || thread.groupAvatarPath) ? "transparent" : "var(--accent-secondary)"
              : thread.participantAvatarPath
                ? "transparent"
                : thread.participantColor || getColorForName(thread.participantName),
            color: "white",
            fontWeight: "600",
            fontSize: "var(--text-sm)",
            cursor: thread.type === "group" ? "pointer" : "default",
          }}
          onClick={() => thread.type === "group" && setShowGroupInfo(true)}
        >
          {thread.type === "group" ? (
            (groupAvatarPath || thread.groupAvatarPath) ? (
              <img
                src={groupAvatarPath || thread.groupAvatarPath || ""}
                alt={thread.groupName || thread.participantName}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                style={{ width: "20px", height: "20px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            )
          ) : thread.participantAvatarPath ? (
            <img
              src={thread.participantAvatarPath}
              alt={thread.participantName}
              className="w-full h-full object-cover"
            />
          ) : (
            thread.participantInitials || getInitials(thread.participantName)
          )}
        </div>
        <div
          className={`flex-1 min-w-0 ${thread.type === "group" ? "cursor-pointer rounded-lg transition-colors hover:bg-[var(--surface-secondary)]" : ""}`}
          style={{ padding: thread.type === "group" ? "6px 10px" : "0", margin: thread.type === "group" ? "-6px -10px" : "0" }}
          onClick={() => thread.type === "group" && setShowGroupInfo(true)}
        >
          <div className="font-medium truncate">
            {thread.participantName}
          </div>
          {thread.type === "group" && (
            <div className="text-[var(--text-muted)]" style={{ fontSize: "var(--text-xs)" }}>
              Tap for info
            </div>
          )}
        </div>
        <button
          className="icon-btn"
          onClick={() => setShowDeleteConfirm(true)}
          title={thread.type === "group" ? "Clear thread" : "Delete conversation"}
        >
          <svg
            style={{ width: "18px", height: "18px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
        <button className="icon-btn" onClick={onClose}>
          <svg
            style={{ width: "20px", height: "20px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Clear Thread / Delete Conversation Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            className="card card-elevated"
            style={{
              padding: "var(--space-lg)",
              maxWidth: "320px",
              margin: "var(--space-md)",
            }}
          >
            <p
              className="font-medium text-[var(--text-primary)]"
              style={{ marginBottom: "var(--space-md)" }}
            >
              {thread.type === "group" ? "Clear this thread?" : "Delete this conversation?"}
            </p>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-lg)",
              }}
            >
              {thread.type === "group"
                ? "This will hide the conversation from your view. You will still be a member of the group and the thread will reappear if someone sends a new message."
                : "This will permanently delete all messages in this conversation."}
            </p>
            <div className="flex" style={{ gap: "var(--space-sm)" }}>
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn flex-1"
                style={{
                  background: thread.type === "group" ? "var(--accent-primary)" : "var(--error)",
                  color: "white",
                }}
                onClick={() => {
                  // For groups, this just clears the thread view (user stays in group)
                  // For private, this deletes the conversation
                  onDelete(thread.id, thread.type === "group" ? "clear" : "delete");
                  setShowDeleteConfirm(false);
                }}
              >
                {thread.type === "group" ? "Clear" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Group Confirmation Modal */}
      {showLeaveConfirm && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            className="card card-elevated"
            style={{
              padding: "var(--space-lg)",
              maxWidth: "320px",
              margin: "var(--space-md)",
            }}
          >
            <p
              className="font-medium text-[var(--text-primary)]"
              style={{ marginBottom: "var(--space-md)" }}
            >
              Leave this group?
            </p>
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-lg)",
              }}
            >
              You will be removed from the group and won&apos;t receive any more messages. The group will continue for other members.
            </p>
            <div className="flex" style={{ gap: "var(--space-sm)" }}>
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn flex-1"
                style={{
                  background: "var(--error)",
                  color: "white",
                }}
                onClick={() => {
                  onDelete(thread.id, "leave");
                  setShowLeaveConfirm(false);
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {showDeleteGroupConfirm && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            className="card card-elevated"
            style={{
              padding: "var(--space-lg)",
              maxWidth: "320px",
              margin: "var(--space-md)",
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "var(--error-light)",
                margin: "0 auto var(--space-md)",
              }}
            >
              <svg
                style={{ width: "24px", height: "24px", color: "var(--error)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p
              className="font-semibold text-[var(--text-primary)] text-center"
              style={{ marginBottom: "var(--space-sm)", fontSize: "var(--text-lg)" }}
            >
              Delete Group?
            </p>
            <p
              className="text-[var(--text-secondary)] text-center"
              style={{
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-lg)",
                lineHeight: 1.5,
              }}
            >
              This will permanently delete the entire group and all messages for <strong>everyone</strong>. This action cannot be undone.
            </p>
            <div className="flex" style={{ gap: "var(--space-sm)" }}>
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setShowDeleteGroupConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn flex-1"
                style={{
                  background: "var(--error)",
                  color: "white",
                }}
                onClick={() => {
                  onDelete(thread.id, "delete");
                  setShowDeleteGroupConfirm(false);
                }}
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Required Modal */}
      {showAdminRequiredModal && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            className="card card-elevated"
            style={{
              padding: "var(--space-lg)",
              maxWidth: "340px",
              margin: "var(--space-md)",
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "var(--warning-light)",
                margin: "0 auto var(--space-md)",
              }}
            >
              <svg
                style={{ width: "24px", height: "24px", color: "var(--warning)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p
              className="font-semibold text-[var(--text-primary)] text-center"
              style={{ marginBottom: "var(--space-sm)", fontSize: "var(--text-lg)" }}
            >
              Admin Required
            </p>
            <p
              className="text-[var(--text-secondary)] text-center"
              style={{
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-lg)",
                lineHeight: 1.5,
              }}
            >
              {leaveBlockedReason || "You must appoint another admin before you can leave this group."}
            </p>
            <div className="flex" style={{ gap: "var(--space-sm)" }}>
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setShowAdminRequiredModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={() => {
                  setShowAdminRequiredModal(false);
                  setShowGroupInfo(true);
                }}
              >
                Manage Admins
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
        style={{ padding: "var(--space-md) var(--space-lg)" }}
      >
        {isLoadingMessages ? (
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{ padding: "var(--space-3xl) var(--space-lg)" }}
          >
            <div
              className="animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent"
              style={{ width: "32px", height: "32px" }}
            />
            <p
              className="text-[var(--text-secondary)]"
              style={{
                fontSize: "var(--text-sm)",
                marginTop: "var(--space-md)",
              }}
            >
              Loading messages...
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-center"
            style={{ padding: "var(--space-3xl) var(--space-lg)" }}
          >
            <p
              className="text-[var(--text-secondary)]"
              style={{ fontSize: "var(--text-sm)" }}
            >
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === currentUserId;
            const isPrayerRequest = msg.type === "prayer_request";

            // Get sender info for group messages
            // First try memberLookup (for current members), then fall back to message's sender info
            // This handles removed members whose info is stored in the message
            const memberInfo = thread.type === "group" && !isOwn ? memberLookup.get(msg.senderId) : null;
            const sender = thread.type === "group" && !isOwn ? {
              fullName: memberInfo?.fullName || msg.senderName || "Unknown",
              avatarColor: memberInfo?.avatarColor || msg.senderColor || "#7c9bb8",
              avatarPath: memberInfo?.avatarPath || msg.senderAvatar || null,
              avatarInitials: memberInfo?.avatarInitials || msg.senderInitials || null,
            } : null;

            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                style={{
                  marginBottom: "var(--space-md)",
                  alignItems: "flex-end", // Align avatar to bottom of message
                }}
              >
                {/* Sender Avatar for group messages (non-own) - positioned at bottom near bubble tail */}
                {thread.type === "group" && !isOwn && (
                  <div
                    className="flex-shrink-0 flex flex-col justify-end"
                    style={{
                      width: "32px",
                      marginRight: "8px",
                      marginBottom: "2px", // Align with bubble tail
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium overflow-hidden"
                      style={{
                        backgroundColor: sender?.avatarColor || "var(--surface-elevated)",
                        color: "white",
                      }}
                      title={sender?.fullName || "Unknown"}
                    >
                      {sender?.avatarPath ? (
                        <img
                          src={sender.avatarPath}
                          alt={sender.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        sender?.avatarInitials || "?"
                      )}
                    </div>
                  </div>
                )}
                <div
                  style={{
                    maxWidth: thread.type === "group" && !isOwn ? "calc(80% - 44px)" : "80%",
                    position: "relative",
                  }}
                >
                  {/* Sender name for group messages - with spacing from avatar */}
                  {thread.type === "group" && !isOwn && sender && (
                    <div
                      className="text-xs font-medium"
                      style={{
                        color: sender.avatarColor || "var(--text-secondary)",
                        marginBottom: "4px",
                        marginLeft: "2px",
                      }}
                    >
                      {sender.fullName}
                    </div>
                  )}
                  {/* Prayer Request Badge */}
                  {isPrayerRequest && !isOwn && (
                    <div
                      className="flex items-center"
                      style={{
                        marginBottom: "6px",
                        gap: "6px",
                        fontSize: "var(--text-sm)",
                        color: "#8b5cf6",
                      }}
                    >
                      <span>🙏</span>
                      <span className="font-semibold">Prayer Request</span>
                    </div>
                  )}

                  <div
                    style={{
                      padding: "var(--space-sm) var(--space-md)",
                      borderRadius: isOwn
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                      // My messages are grey, other's messages are their color
                      background: isOwn
                        ? isPrayerRequest
                          ? "#7c3aed" // Vivid purple for my prayer requests
                          : "var(--surface-secondary)" // Grey for my normal messages
                        : isPrayerRequest
                        ? "rgba(124, 58, 237, 0.25)" // Soft purple for received prayer requests
                        : thread.type === "group"
                        ? darkenColor(sender?.avatarColor || thread.participantColor || "#5a8a4a", 20) // Sender's color for group
                        : darkenColor(thread.participantColor || "#5a8a4a", 20), // Participant's color for private
                      color: isOwn
                        ? isPrayerRequest
                          ? "#ffffff"
                          : "var(--text-bright)" // Dark text on grey for my messages
                        : "#ffffff", // White text on colored messages from others
                      textShadow: !isOwn || isPrayerRequest ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
                      border:
                        isPrayerRequest && !isOwn
                          ? "1px solid rgba(139, 92, 246, 0.5)"
                          : "none",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "var(--text-base)",
                        lineHeight: "1.5",
                        fontWeight: 600,
                        // Text color matches background logic
                        color: isOwn
                          ? isPrayerRequest
                            ? "#ffffff"
                            : "var(--text-bright)" // Dark text on grey for my normal messages
                          : "#ffffff", // White text on colored messages from others
                        textShadow: !isOwn || isPrayerRequest
                          ? "0 1px 2px rgba(0,0,0,0.15)"
                          : "none",
                      }}
                    >
                      {msg.content}
                    </p>
                  </div>

                  {/* Add to Prayer Button (for prayer requests from others) */}
                  {isPrayerRequest && !isOwn && (
                    <div style={{ marginTop: "6px" }}>
                      {showAddToPrayer === msg.id ? (
                        <div
                          className="flex items-center"
                          style={{ gap: "var(--space-xs)" }}
                        >
                          <button
                            onClick={() =>
                              handleSelectPrayerType(msg.id, "immediate")
                            }
                            className="btn btn-sm"
                            style={{
                              height: "28px",
                              fontSize: "var(--text-xs)",
                              padding: "0 10px",
                              background: "var(--warning-light)",
                              color: "var(--warning)",
                              border: "1px solid var(--warning)",
                            }}
                          >
                            ⚡ Immediate
                          </button>
                          <button
                            onClick={() =>
                              handleSelectPrayerType(msg.id, "ongoing")
                            }
                            className="btn btn-sm"
                            style={{
                              height: "28px",
                              fontSize: "var(--text-xs)",
                              padding: "0 10px",
                              background: "var(--accent-secondary-light)",
                              color: "var(--accent-secondary)",
                              border: "1px solid var(--accent-secondary)",
                            }}
                          >
                            🔄 Ongoing
                          </button>
                          <button
                            onClick={() => setShowAddToPrayer(null)}
                            className="icon-btn"
                            style={{ width: "28px", height: "28px" }}
                          >
                            <svg
                              style={{ width: "14px", height: "14px" }}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddToPrayer(msg.id)}
                          className="font-medium flex items-center"
                          style={{
                            fontSize: "var(--text-sm)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            gap: "6px",
                            padding: "6px 0",
                            color: "#8b5cf6",
                          }}
                        >
                          <svg
                            style={{ width: "16px", height: "16px" }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          Add to Prayer List
                        </button>
                      )}
                    </div>
                  )}

                  <span
                    className="text-[var(--text-muted)]"
                    style={{
                      fontSize: "10px",
                      display: "block",
                      marginTop: "4px",
                      textAlign: isOwn ? "right" : "left",
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input */}
      <div
        style={{
          padding: "var(--space-md) var(--space-lg)",
          borderTop: "1px solid var(--border-light)",
          background: "var(--surface-primary)",
        }}
      >
        {/* Message Type Toggle */}
        <div
          className="flex items-center"
          style={{ marginBottom: "var(--space-sm)", gap: "var(--space-sm)" }}
        >
          <button
            onClick={() => setMessageType("message")}
            className="btn btn-sm"
            style={{
              height: "32px",
              fontSize: "var(--text-sm)",
              padding: "0 14px",
              background:
                messageType === "message"
                  ? thread.participantColor || "#5a8a4a"
                  : "var(--surface-secondary)",
              border:
                messageType === "message"
                  ? "none"
                  : "1px solid var(--border-medium)",
              color:
                messageType === "message" ? "white" : "var(--text-secondary)",
            }}
          >
            💬 Message
          </button>
          <button
            onClick={() => setMessageType("prayer_request")}
            className="btn btn-sm"
            style={{
              height: "32px",
              fontSize: "var(--text-sm)",
              padding: "0 14px",
              background:
                messageType === "prayer_request"
                  ? "#8b5cf6"
                  : "var(--surface-secondary)",
              border:
                messageType === "prayer_request"
                  ? "none"
                  : "1px solid var(--border-medium)",
              color:
                messageType === "prayer_request"
                  ? "white"
                  : "var(--text-secondary)",
            }}
          >
            🙏 Prayer Request
          </button>
        </div>

        {/* Input Row */}
        <div className="flex items-center" style={{ gap: "var(--space-sm)" }}>
          <input
            type="text"
            className="input flex-1"
            style={{ height: "44px" }}
            placeholder={
              messageType === "prayer_request"
                ? "Share your prayer request..."
                : "Type a message..."
            }
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="btn"
            style={{
              width: "48px",
              height: "48px",
              padding: 0,
              borderRadius: "50%",
              background:
                messageType === "prayer_request"
                  ? "#8b5cf6"
                  : thread.participantColor || "#5a8a4a",
              color: "white",
              opacity: !newMessage.trim() ? 0.5 : 1,
            }}
          >
            <svg
              style={{ width: "22px", height: "22px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
