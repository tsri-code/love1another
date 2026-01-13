"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/components/AuthGuard";
import { useToast } from "@/lib/toast";
import { getInitials } from "@/lib/utils";

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath?: string | null;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: string;
  fromUser?: User;
  toUser?: User;
}

interface FriendEntry {
  id: string;
  friendshipId: string;
  status: string;
  createdAt: string;
  user: User | null;
}

interface Profile {
  id: string;
  displayName: string;
  avatarInitials?: string;
  avatarColor?: string;
  avatarPath?: string | null;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<
    (FriendRequest & { fromUser: User })[]
  >([]);
  const [sentRequests, setSentRequests] = useState<
    (FriendRequest & { toUser: User })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">(
    "friends"
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);

  // Profile action modal state
  const [profileActionUser, setProfileActionUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Delete friend confirmation state
  const [friendToDelete, setFriendToDelete] = useState<FriendEntry | null>(
    null
  );

  // Track previous sent requests to detect when they become friends
  const previousSentRequestsRef = useRef<Set<string>>(new Set());

  // Track friends that are NOT connected to any profile (should be highlighted)
  const [unlinkedFriendIds, setUnlinkedFriendIds] = useState<Set<string>>(
    new Set()
  );

  // Track friends that were just accepted (for extra notification)
  const [justAcceptedFriendIds, setJustAcceptedFriendIds] = useState<
    Set<string>
  >(new Set());

  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const currentUserId = user?.id || null;

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const res = await fetch("/api/people");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.people || []);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    fetchFriendsData();
  }, [currentUserId]);

  const fetchFriendsData = async () => {
    if (!currentUserId) return;

    try {
      const res = await fetch(`/api/friends?type=all`);
      if (res.ok) {
        const data = await res.json();
        const newFriends: FriendEntry[] = data.friends || [];
        const newSentRequests: (FriendRequest & { toUser: User })[] =
          data.sentRequests || [];

        // Check if any previously sent requests are now friends
        // (meaning they were accepted by the other user)
        const newSentUserIds = new Set(newSentRequests.map((r) => r.toUserId));
        const newFriendIds = new Set(newFriends.map((f) => f.id));
        const acceptedFriendIds: string[] = [];

        // Look for users who were in sent requests but are now friends
        for (const prevSentUserId of previousSentRequestsRef.current) {
          if (
            !newSentUserIds.has(prevSentUserId) &&
            newFriendIds.has(prevSentUserId)
          ) {
            // This user was in sent requests but is now a friend - they accepted!
            acceptedFriendIds.push(prevSentUserId);
            const newFriend = newFriends.find((f) => f.id === prevSentUserId);
            if (newFriend?.user) {
              // Show toast notification
              showToast(
                `${newFriend.user.fullName} accepted your request! Tap the link icon to connect them to a profile.`,
                "success"
              );
              if (!profileActionUser) {
                // Show profile action modal for this newly accepted friend
                setProfileActionUser(newFriend.user);
                fetchProfiles();
              }
              break; // Only show one at a time
            }
          }
        }

        // Mark these friends as just accepted for extra highlighting
        if (acceptedFriendIds.length > 0) {
          setJustAcceptedFriendIds(
            (prev) => new Set([...prev, ...acceptedFriendIds])
          );
        }

        // Update the ref with current sent request user IDs
        previousSentRequestsRef.current = new Set(
          newSentRequests.map((r) => r.toUserId)
        );

        setFriends(newFriends);
        setPendingRequests(data.pendingRequests || []);
        setSentRequests(newSentRequests);

        // Check which friends are NOT connected to any profile
        // Fetch all profiles and their connections to determine unlinked friends
        try {
          const profilesRes = await fetch("/api/people");
          if (profilesRes.ok) {
            const profilesData = await profilesRes.json();
            const allProfiles = profilesData.people || [];

            // For each profile, get connections
            const connectedUserIds = new Set<string>();
            for (const profile of allProfiles) {
              const connRes = await fetch(
                `/api/connections?profileId=${profile.id}`
              );
              if (connRes.ok) {
                const connData = await connRes.json();
                for (const conn of connData.connections || []) {
                  connectedUserIds.add(conn.connectedUserId);
                }
              }
            }

            // Find friends that are NOT connected to any profile
            const unlinked = new Set<string>();
            for (const friend of newFriends) {
              if (!connectedUserIds.has(friend.id)) {
                unlinked.add(friend.id);
              }
            }
            setUnlinkedFriendIds(unlinked);
          }
        } catch (err) {
          console.error("Error checking profile connections:", err);
        }
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
      showToast("Failed to load friends", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/users?q=${encodeURIComponent(
          searchQuery
        )}&exclude=${currentUserId}`
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
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "search") {
        handleSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const handleSendRequest = async (toUserId: string) => {
    if (!currentUserId) return;

    setSendingRequestTo(toUserId);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send request");
      }

      showToast("Friend request sent!", "success");

      // Remove from search results
      setSearchResults((prev) => prev.filter((u) => u.id !== toUserId));
      // Refresh data
      fetchFriendsData();
    } catch (error) {
      console.error("Error sending request:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to send request",
        "error"
      );
    } finally {
      setSendingRequestTo(null);
    }
  };

  // Handle creating a profile for the user
  const handleCreateProfile = async () => {
    if (!profileActionUser) return;

    setIsCreatingProfile(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profileActionUser.fullName,
          type: "person",
          avatarInitials:
            profileActionUser.avatarInitials ||
            getInitials(profileActionUser.fullName),
          avatarColor: profileActionUser.avatarColor || "#6b8cae",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create profile");
      }

      const data = await res.json();

      // Create connection to the new profile
      if (data.person?.id) {
        await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: data.person.id,
            connectedUserId: profileActionUser.id,
          }),
        });
      }

      showToast(
        `Profile created for ${profileActionUser.fullName}!`,
        "success"
      );
      setProfileActionUser(null);
    } catch (error) {
      console.error("Error creating profile:", error);
      showToast("Failed to create profile", "error");
    } finally {
      setIsCreatingProfile(false);
    }
  };

  // Handle connecting to an existing profile
  const handleConnectToProfile = async (profileId: string) => {
    if (!profileActionUser) return;

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          connectedUserId: profileActionUser.id,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create connection");
      }

      showToast(
        `Connected ${profileActionUser.fullName} to profile!`,
        "success"
      );
      setProfileActionUser(null);
      setShowProfileSelector(false);
    } catch (error) {
      console.error("Error connecting profile:", error);
      showToast("Failed to connect profile", "error");
    }
  };

  // Handle removing a friend (called from confirmation modal)
  const handleConfirmRemoveFriend = async () => {
    if (!friendToDelete) return;

    try {
      const res = await fetch(`/api/friends/${friendToDelete.friendshipId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove friend");
      }

      showToast("Friend removed", "success");
      setFriendToDelete(null);
      fetchFriendsData();
    } catch (error) {
      console.error("Error removing friend:", error);
      showToast("Failed to remove friend", "error");
    }
  };

  const handleRespondToRequest = async (
    requestId: string,
    action: "accept" | "reject",
    fromUser?: User
  ) => {
    try {
      // Map action to status expected by API
      const status = action === "accept" ? "accepted" : "rejected";

      const res = await fetch(`/api/friends/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Failed to respond to request");
      }

      showToast(
        action === "accept" ? "Friend added!" : "Request declined",
        action === "accept" ? "success" : "info"
      );

      // If accepted, show profile action modal
      if (action === "accept" && fromUser) {
        setProfileActionUser(fromUser);
        fetchProfiles();
      }

      fetchFriendsData();
    } catch (error) {
      console.error("Error responding to request:", error);
      showToast("Failed to respond to request", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="page-center">
        <div
          className="animate-pulse flex flex-col items-center"
          style={{ gap: "var(--space-md)" }}
        >
          <div
            className="bg-[var(--border-light)] rounded-full"
            style={{ width: "72px", height: "72px" }}
          />
          <div
            className="bg-[var(--border-light)] rounded"
            style={{ width: "100px", height: "20px" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <AppHeader showBack backHref="/" title="Friends" />

      <main className="flex-1">
        <div
          className="container"
          style={{
            maxWidth: "600px",
            paddingTop: "var(--space-lg)",
            paddingBottom: "var(--space-3xl)",
          }}
        >
          {/* Tabs */}
          <div
            className="flex bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
            style={{
              padding: "var(--space-xs)",
              marginBottom: "var(--space-lg)",
              gap: "var(--space-xs)",
            }}
          >
            <button
              onClick={() => setActiveTab("friends")}
              className={`flex-1 py-2 rounded-[var(--radius-sm)] font-medium transition-colors ${
                activeTab === "friends"
                  ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              style={{ fontSize: "var(--text-sm)" }}
            >
              Friends ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex-1 py-2 rounded-[var(--radius-sm)] font-medium transition-colors relative ${
                activeTab === "requests"
                  ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              style={{ fontSize: "var(--text-sm)" }}
            >
              Requests
              {pendingRequests.length > 0 && (
                <span
                  className="absolute bg-[var(--accent-primary)] text-white rounded-full flex items-center justify-center font-medium"
                  style={{
                    top: "-4px",
                    right: "8px",
                    width: "18px",
                    height: "18px",
                    fontSize: "11px",
                  }}
                >
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={`flex-1 py-2 rounded-[var(--radius-sm)] font-medium transition-colors ${
                activeTab === "search"
                  ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              style={{ fontSize: "var(--text-sm)" }}
            >
              Find
            </button>
          </div>

          {/* Friends Tab */}
          {activeTab === "friends" && (
            <div className="animate-fade-in">
              {friends.length === 0 ? (
                <div
                  className="text-center card card-elevated"
                  style={{ padding: "var(--space-2xl)" }}
                >
                  <svg
                    className="mx-auto text-[var(--text-muted)]"
                    style={{
                      width: "48px",
                      height: "48px",
                      marginBottom: "var(--space-md)",
                    }}
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
                  <h3
                    className="font-serif font-semibold text-[var(--text-primary)]"
                    style={{
                      fontSize: "var(--text-lg)",
                      marginBottom: "var(--space-xs)",
                    }}
                  >
                    No friends yet
                  </h3>
                  <p
                    className="text-[var(--text-muted)]"
                    style={{ fontSize: "var(--text-sm)" }}
                  >
                    Search for users to connect with
                  </p>
                  <button
                    onClick={() => setActiveTab("search")}
                    className="btn btn-primary mt-4"
                  >
                    Find Friends
                  </button>
                </div>
              ) : (
                <div
                  className="flex flex-col"
                  style={{ gap: "var(--space-md)" }}
                >
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center card card-elevated"
                      style={{
                        padding: "var(--space-md)",
                        gap: "var(--space-md)",
                      }}
                    >
                      <div
                        className="rounded-full flex items-center justify-center text-white font-medium overflow-hidden"
                        style={{
                          width: "48px",
                          height: "48px",
                          fontSize: "var(--text-base)",
                          backgroundColor: friend.user?.avatarPath
                            ? "transparent"
                            : friend.user?.avatarColor ||
                              "var(--accent-primary)",
                        }}
                      >
                        {friend.user?.avatarPath ? (
                          <img
                            src={friend.user.avatarPath}
                            alt={friend.user.fullName || "Friend"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          friend.user?.avatarInitials || "?"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)] truncate">
                          {friend.user?.fullName || "Unknown User"}
                        </p>
                        <p
                          className="text-[var(--text-muted)]"
                          style={{ fontSize: "var(--text-sm)" }}
                        >
                          @{friend.user?.username || "unknown"}
                        </p>
                      </div>
                      <div
                        className="flex items-center"
                        style={{ gap: "var(--space-xs)" }}
                      >
                        <button
                          onClick={() => {
                            if (friend.user) {
                              setProfileActionUser(friend.user);
                              fetchProfiles();
                            }
                          }}
                          className={`p-2 rounded-full transition-colors relative ${
                            unlinkedFriendIds.has(friend.id)
                              ? "bg-[var(--accent-primary)]"
                              : "hover:bg-[var(--bg-secondary)]"
                          } ${
                            justAcceptedFriendIds.has(friend.id)
                              ? "animate-pulse"
                              : ""
                          }`}
                          title={
                            unlinkedFriendIds.has(friend.id)
                              ? "Link to a profile (not connected yet)"
                              : "Link to profile"
                          }
                        >
                          {unlinkedFriendIds.has(friend.id) && (
                            <span
                              className="absolute -top-1 -right-1 bg-[var(--error)] rounded-full animate-ping"
                              style={{
                                width: "8px",
                                height: "8px",
                              }}
                            />
                          )}
                          {unlinkedFriendIds.has(friend.id) && (
                            <span
                              className="absolute -top-1 -right-1 bg-[var(--error)] rounded-full"
                              style={{
                                width: "8px",
                                height: "8px",
                              }}
                            />
                          )}
                          <svg
                            className={
                              unlinkedFriendIds.has(friend.id)
                                ? "text-white"
                                : "text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
                            }
                            style={{ width: "18px", height: "18px" }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setFriendToDelete(friend)}
                          className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
                          title="Remove friend"
                        >
                          <svg
                            className="text-[var(--text-muted)] hover:text-[var(--error)]"
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === "requests" && (
            <div className="animate-fade-in">
              {/* Pending requests */}
              {pendingRequests.length > 0 && (
                <div style={{ marginBottom: "var(--space-xl)" }}>
                  <h3
                    className="font-medium text-[var(--text-secondary)]"
                    style={{
                      fontSize: "var(--text-sm)",
                      marginBottom: "var(--space-md)",
                    }}
                  >
                    Pending Requests ({pendingRequests.length})
                  </h3>
                  <div
                    className="flex flex-col"
                    style={{ gap: "var(--space-md)" }}
                  >
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="card card-elevated"
                        style={{ padding: "var(--space-lg)" }}
                      >
                        <div
                          className="flex items-center"
                          style={{
                            gap: "var(--space-md)",
                            marginBottom: "var(--space-md)",
                          }}
                        >
                          <div
                            className="rounded-full flex items-center justify-center text-white font-medium overflow-hidden"
                            style={{
                              width: "48px",
                              height: "48px",
                              fontSize: "var(--text-base)",
                              backgroundColor: request.fromUser?.avatarPath
                                ? "transparent"
                                : request.fromUser?.avatarColor ||
                                  "var(--accent-primary)",
                            }}
                          >
                            {request.fromUser?.avatarPath ? (
                              <img
                                src={request.fromUser.avatarPath}
                                alt={request.fromUser.fullName || "User"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              request.fromUser?.avatarInitials || "?"
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">
                              {request.fromUser?.fullName || "Unknown User"}
                            </p>
                            <p
                              className="text-[var(--text-muted)]"
                              style={{ fontSize: "var(--text-sm)" }}
                            >
                              @{request.fromUser?.username || "unknown"} wants
                              to be friends
                            </p>
                          </div>
                        </div>
                        <div
                          className="flex"
                          style={{ gap: "var(--space-md)" }}
                        >
                          <button
                            onClick={() =>
                              handleRespondToRequest(request.id, "reject")
                            }
                            className="btn btn-secondary flex-1"
                            style={{ fontSize: "var(--text-sm)" }}
                          >
                            Decline
                          </button>
                          <button
                            onClick={() =>
                              handleRespondToRequest(
                                request.id,
                                "accept",
                                request.fromUser
                              )
                            }
                            className="btn btn-primary flex-1"
                            style={{ fontSize: "var(--text-sm)" }}
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent requests */}
              {sentRequests.length > 0 && (
                <div>
                  <h3
                    className="font-medium text-[var(--text-secondary)]"
                    style={{
                      fontSize: "var(--text-sm)",
                      marginBottom: "var(--space-md)",
                    }}
                  >
                    Sent Requests ({sentRequests.length})
                  </h3>
                  <div
                    className="flex flex-col"
                    style={{ gap: "var(--space-md)" }}
                  >
                    {sentRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center card card-elevated"
                        style={{
                          padding: "var(--space-lg)",
                          gap: "var(--space-md)",
                        }}
                      >
                        <div
                          className="rounded-full flex items-center justify-center text-white font-medium overflow-hidden"
                          style={{
                            width: "48px",
                            height: "48px",
                            fontSize: "var(--text-base)",
                            backgroundColor: request.toUser?.avatarPath
                              ? "transparent"
                              : request.toUser?.avatarColor ||
                                "var(--accent-primary)",
                          }}
                        >
                          {request.toUser?.avatarPath ? (
                            <img
                              src={request.toUser.avatarPath}
                              alt={request.toUser.fullName || "User"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            request.toUser?.avatarInitials || "?"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">
                            {request.toUser?.fullName || "Unknown User"}
                          </p>
                          <p
                            className="text-[var(--text-muted)]"
                            style={{ fontSize: "var(--text-sm)" }}
                          >
                            @{request.toUser?.username || "unknown"}
                          </p>
                        </div>
                        <span
                          className="text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-full"
                          style={{
                            fontSize: "var(--text-xs)",
                            padding: "var(--space-xs) var(--space-sm)",
                          }}
                        >
                          Pending
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingRequests.length === 0 && sentRequests.length === 0 && (
                <div
                  className="text-center card card-elevated"
                  style={{ padding: "var(--space-2xl)" }}
                >
                  <svg
                    className="mx-auto text-[var(--text-muted)]"
                    style={{
                      width: "48px",
                      height: "48px",
                      marginBottom: "var(--space-md)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <p
                    className="text-[var(--text-muted)]"
                    style={{ fontSize: "var(--text-sm)" }}
                  >
                    No pending friend requests
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === "search" && (
            <div className="animate-fade-in">
              <div
                className="relative"
                style={{ marginBottom: "var(--space-lg)" }}
              >
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  style={{ width: "20px", height: "20px" }}
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or @username..."
                  className="input"
                  style={{ paddingLeft: "48px", fontSize: "var(--text-base)" }}
                  autoFocus
                />
              </div>

              {isSearching ? (
                <div
                  className="text-center text-[var(--text-muted)]"
                  style={{ padding: "var(--space-lg)" }}
                >
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                <div
                  className="flex flex-col"
                  style={{ gap: "var(--space-md)" }}
                >
                  {searchResults.map((user) => {
                    const isFriend = friends.some((f) => f.id === user.id);
                    const hasPendingRequest = [
                      ...pendingRequests,
                      ...sentRequests,
                    ].some(
                      (r) => r.fromUserId === user.id || r.toUserId === user.id
                    );

                    return (
                      <div
                        key={user.id}
                        className="flex items-center card card-elevated"
                        style={{
                          padding: "var(--space-md)",
                          gap: "var(--space-md)",
                        }}
                      >
                        <div
                          className="rounded-full flex items-center justify-center text-white font-medium overflow-hidden"
                          style={{
                            width: "48px",
                            height: "48px",
                            fontSize: "var(--text-base)",
                            backgroundColor: user.avatarPath
                              ? "transparent"
                              : user.avatarColor || "var(--accent-primary)",
                          }}
                        >
                          {user.avatarPath ? (
                            <img
                              src={user.avatarPath}
                              alt={user.fullName || "User"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            user.avatarInitials || "?"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">
                            {user.fullName}
                          </p>
                          <p
                            className="text-[var(--text-muted)]"
                            style={{ fontSize: "var(--text-sm)" }}
                          >
                            @{user.username}
                          </p>
                        </div>
                        {isFriend ? (
                          <span
                            className="text-[var(--accent-primary)] font-medium"
                            style={{ fontSize: "var(--text-sm)" }}
                          >
                            Friends ✓
                          </span>
                        ) : hasPendingRequest ? (
                          <span
                            className="text-[var(--text-muted)]"
                            style={{ fontSize: "var(--text-sm)" }}
                          >
                            Pending
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(user.id)}
                            disabled={sendingRequestTo === user.id}
                            className="btn btn-primary"
                            style={{
                              fontSize: "var(--text-sm)",
                              padding: "var(--space-xs) var(--space-md)",
                            }}
                          >
                            {sendingRequestTo === user.id ? "..." : "Add"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div
                  className="text-center text-[var(--text-muted)]"
                  style={{ padding: "var(--space-lg)" }}
                >
                  No users found
                </div>
              ) : (
                <div
                  className="text-center text-[var(--text-muted)]"
                  style={{ padding: "var(--space-lg)" }}
                >
                  Type at least 2 characters to search
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Delete Friend Confirmation Modal */}
      {friendToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setFriendToDelete(null)}
        >
          <div
            className="bg-[var(--surface-primary)] rounded-[var(--card-radius)] shadow-xl w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center" style={{ padding: "var(--space-xl)" }}>
              <div
                className="mx-auto rounded-full flex items-center justify-center"
                style={{
                  width: "56px",
                  height: "56px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  marginBottom: "var(--space-md)",
                }}
              >
                <svg
                  style={{
                    width: "28px",
                    height: "28px",
                    color: "var(--error)",
                  }}
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
              </div>
              <h3
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{
                  fontSize: "var(--text-lg)",
                  marginBottom: "var(--space-sm)",
                }}
              >
                Remove Friend?
              </h3>
              <p
                className="text-[var(--text-muted)]"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-lg)",
                }}
              >
                Are you sure you want to remove{" "}
                <strong className="text-[var(--text-primary)]">
                  {friendToDelete.user?.fullName || "this friend"}
                </strong>
                ? You can always add them back later.
              </p>
              <div className="flex" style={{ gap: "var(--space-sm)" }}>
                <button
                  onClick={() => setFriendToDelete(null)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRemoveFriend}
                  className="btn btn-danger flex-1"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Action Modal */}
      {profileActionUser && !showProfileSelector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setProfileActionUser(null)}
        >
          <div
            className="bg-[var(--surface-primary)] rounded-[var(--card-radius)] shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center" style={{ padding: "var(--space-lg)" }}>
              <div
                className="rounded-full flex items-center justify-center text-white font-medium mx-auto overflow-hidden"
                style={{
                  width: "64px",
                  height: "64px",
                  fontSize: "24px",
                  backgroundColor: profileActionUser.avatarPath
                    ? "transparent"
                    : profileActionUser.avatarColor || "#6b8cae",
                  marginBottom: "var(--space-md)",
                }}
              >
                {profileActionUser.avatarPath ? (
                  <img
                    src={profileActionUser.avatarPath}
                    alt={profileActionUser.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  profileActionUser.avatarInitials ||
                  getInitials(profileActionUser.fullName)
                )}
              </div>
              <h3 className="font-serif font-semibold text-[var(--text-primary)] text-lg">
                Friend Request Sent!
              </h3>
              <p
                className="text-[var(--text-muted)]"
                style={{ marginTop: "var(--space-xs)" }}
              >
                Would you like to create a profile for{" "}
                {profileActionUser.fullName}?
              </p>
            </div>

            <div
              className="flex flex-col border-t border-[var(--border-primary)]"
              style={{ padding: "var(--space-md)", gap: "var(--space-sm)" }}
            >
              <button
                onClick={handleCreateProfile}
                disabled={isCreatingProfile}
                className="btn btn-primary btn-full"
              >
                {isCreatingProfile ? "Creating..." : "Create Profile"}
              </button>
              <button
                onClick={() => {
                  setShowProfileSelector(true);
                  fetchProfiles();
                }}
                className="btn btn-secondary btn-full"
              >
                Connect to Existing Profile
              </button>
              <button
                onClick={() => setProfileActionUser(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                style={{
                  padding: "var(--space-sm)",
                  fontSize: "var(--text-sm)",
                }}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Selector Modal */}
      {profileActionUser && showProfileSelector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => {
            setShowProfileSelector(false);
            setProfileActionUser(null);
          }}
        >
          <div
            className="bg-[var(--surface-primary)] rounded-[var(--card-radius)] shadow-xl w-full max-w-md mx-4"
            style={{ maxHeight: "70vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b border-[var(--border-primary)]"
              style={{ padding: "var(--space-md) var(--space-lg)" }}
            >
              <h3 className="font-serif font-semibold text-[var(--text-primary)]">
                Select a Profile
              </h3>
              <button
                onClick={() => {
                  setShowProfileSelector(false);
                  setProfileActionUser(null);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <svg
                  style={{ width: "24px", height: "24px" }}
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

            <div
              style={{
                padding: "var(--space-md)",
                overflowY: "auto",
                maxHeight: "50vh",
              }}
            >
              {isLoadingProfiles ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  Loading profiles...
                </div>
              ) : profiles.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  No profiles yet. Create one first.
                </div>
              ) : (
                <div
                  className="flex flex-col"
                  style={{ gap: "var(--space-xs)" }}
                >
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => handleConnectToProfile(profile.id)}
                      className="flex items-center w-full text-left bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-[var(--radius-md)] transition-colors"
                      style={{
                        padding: "var(--space-md)",
                        gap: "var(--space-sm)",
                      }}
                    >
                      <div
                        className="rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 overflow-hidden"
                        style={{
                          width: "40px",
                          height: "40px",
                          fontSize: "14px",
                          backgroundColor: profile.avatarPath
                            ? "transparent"
                            : profile.avatarColor || "#6b8cae",
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
                          getInitials(profile.displayName)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--text-primary)] truncate">
                          {profile.displayName}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
