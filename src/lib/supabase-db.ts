/**
 * Supabase Database Operations
 *
 * This module provides database operations using Supabase.
 * All operations are scoped to the authenticated user via RLS.
 */

import { createServerSupabaseClient, createAdminSupabaseClient } from "./supabase-server";
import { getInitials } from "./utils";

// ============================================================================
// Types
// ============================================================================

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  type: "person" | "group";
  avatar_initials: string | null;
  avatar_color: string | null;
  avatar_path: string | null;
  verse_id: number | null;
  prayer_count: number;
  encrypted_prayers: string | null;
  encryption_iv: string | null;
  last_prayed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileLink {
  id: string;
  profile1_id: string;
  profile2_id: string;
  link_name: string | null;
  prayer_count: number;
  encrypted_prayers: string | null;
  encryption_iv: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  profile1?: Profile | null;
  profile2?: Profile | null;
}

export interface Friendship {
  id: string;
  user1_id: string;
  user2_id: string;
  status: "pending" | "accepted" | "rejected" | "blocked";
  requester_id: string;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  owner_user_id: string;
  profile_id: string;
  connected_user_id: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user1_id: string | null;
  user2_id: string | null;
  user1_key_encrypted: string | null;
  user2_key_encrypted: string | null;
  type: "private" | "group" | null;
  group_name: string | null;
  group_avatar_path: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  message_type: "message" | "prayer_request";
  is_read: boolean;
  created_at: string;
}

export interface MessageWithSender extends Message {
  sender_full_name: string;
  sender_username: string | null;
  sender_avatar_initials: string | null;
  sender_avatar_color: string;
  sender_avatar_path: string | null;
}

export interface UserKeys {
  id: string;
  user_id: string;
  public_key: string;
  encrypted_private_key: string;
  key_salt: string;
  created_at: string;
  updated_at: string;
}

// Prayer data structure (stored encrypted in profile)
export interface Prayer {
  id: string;
  content: string;
  category: "immediate" | "ongoing";
  isAnswered: boolean;
  createdAt: string;
  answeredAt?: string;
}

export interface PrayerData {
  prayers: Prayer[];
}

// ============================================================================
// Authentication Helper
// ============================================================================

export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

// ============================================================================
// Profile Operations
// ============================================================================

/**
 * Get all profiles for the authenticated user
 */
export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("display_name");

  if (error) {
    console.error("Error fetching profiles:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single profile by ID
 */
export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Error fetching profile:", error);
    throw error;
  }

  return data;
}

/**
 * Create a new profile
 */
export async function createProfile(data: {
  display_name: string;
  type: "person" | "group";
  avatar_initials?: string;
  avatar_color?: string;
  avatar_path?: string | null;
  is_self_profile?: boolean;
  verse_id?: number;
}): Promise<Profile> {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      display_name: data.display_name,
      type: data.type,
      avatar_initials: data.avatar_initials || getInitials(data.display_name),
      avatar_color: data.avatar_color || generateRandomColor(),
      avatar_path: data.avatar_path || null,
      prayer_count: 0,
      is_self_profile: data.is_self_profile || false,
      verse_id: data.verse_id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating profile:", error);
    throw error;
  }

  return profile;
}

/**
 * Update a profile
 */
export async function updateProfile(
  id: string,
  data: {
    display_name?: string;
    type?: "person" | "group";
    avatar_initials?: string;
    avatar_color?: string;
    avatar_path?: string | null;
    verse_id?: string | null;
    prayer_count?: number;
  }
): Promise<Profile> {
  const supabase = await createServerSupabaseClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.display_name !== undefined)
    updateData.display_name = data.display_name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.avatar_initials !== undefined)
    updateData.avatar_initials = data.avatar_initials;
  if (data.avatar_color !== undefined)
    updateData.avatar_color = data.avatar_color;
  if (data.avatar_path !== undefined) updateData.avatar_path = data.avatar_path;
  if (data.verse_id !== undefined) updateData.verse_id = data.verse_id;
  if (data.prayer_count !== undefined)
    updateData.prayer_count = data.prayer_count;

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    throw error;
  }

  return profile;
}

/**
 * Delete a profile
 */
export async function deleteProfile(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("profiles").delete().eq("id", id);

  if (error) {
    console.error("Error deleting profile:", error);
    throw error;
  }
}

// ============================================================================
// Profile Link Operations
// ============================================================================

/**
 * Get all links for a profile
 */
export async function getLinksForProfile(
  profileId: string
): Promise<ProfileLink[]> {
  const supabase = await createServerSupabaseClient();

  // First, try a simple query to check if the links table exists and has data
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`);

  if (error) {
    // Log the error but don't crash - links may not exist yet
    console.error("Error fetching links (gracefully handling):", error);
    // Return empty array instead of throwing - links feature is optional
    return [];
  }

  // If we have link data, fetch the related profiles separately
  if (data && data.length > 0) {
    const linksWithProfiles = await Promise.all(
      data.map(async (link) => {
        const [profile1Result, profile2Result] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", link.profile1_id)
            .single(),
          supabase
            .from("profiles")
            .select("*")
            .eq("id", link.profile2_id)
            .single(),
        ]);
        return {
          ...link,
          profile1: profile1Result.data,
          profile2: profile2Result.data,
        };
      })
    );
    return linksWithProfiles;
  }

  return [];
}

/**
 * Get a link by ID
 */
export async function getLinkById(id: string): Promise<ProfileLink | null> {
  const supabase = await createServerSupabaseClient();

  // Query without FK hints
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching link:", error);
    throw error;
  }

  if (!data) return null;

  // Fetch profiles separately
  const result: ProfileLink = {
    ...data,
    profile1: null,
    profile2: null,
  };

  if (data.profile1_id) {
    const { data: p1 } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.profile1_id)
      .single();
    result.profile1 = p1;
  }
  if (data.profile2_id) {
    const { data: p2 } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.profile2_id)
      .single();
    result.profile2 = p2;
  }

  return result;
}

/**
 * Create a link between two profiles
 */
export async function createLink(data: {
  profile1_id: string;
  profile2_id: string;
  link_name?: string;
}): Promise<ProfileLink> {
  const supabase = await createServerSupabaseClient();

  // Insert the link without FK hints (they may not exist)
  const { data: link, error } = await supabase
    .from("links")
    .insert({
      profile1_id: data.profile1_id,
      profile2_id: data.profile2_id,
      link_name: data.link_name || null,
      prayer_count: 0,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating link:", error);
    throw error;
  }

  // Fetch the profiles separately if needed
  const result: ProfileLink = {
    ...link,
    profile1: null,
    profile2: null,
  };

  // Fetch profiles if we have the IDs
  if (link.profile1_id) {
    const { data: p1 } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", link.profile1_id)
      .single();
    result.profile1 = p1;
  }
  if (link.profile2_id) {
    const { data: p2 } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", link.profile2_id)
      .single();
    result.profile2 = p2;
  }

  return result;
}

/**
 * Update a link
 */
export async function updateLink(
  id: string,
  data: {
    link_name?: string;
    prayer_count?: number;
  }
): Promise<ProfileLink> {
  const supabase = await createServerSupabaseClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.link_name !== undefined) updateData.link_name = data.link_name;
  if (data.prayer_count !== undefined)
    updateData.prayer_count = data.prayer_count;

  const { data: link, error } = await supabase
    .from("links")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating link:", error);
    throw error;
  }

  return link;
}

/**
 * Delete a link
 */
export async function deleteLink(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("links").delete().eq("id", id);

  if (error) {
    console.error("Error deleting link:", error);
    throw error;
  }
}

// ============================================================================
// Friendship Operations
// ============================================================================

/**
 * Get all friendships for a user
 */
export async function getFriendships(userId: string): Promise<Friendship[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq("status", "accepted");

  if (error) {
    console.error("Error fetching friendships:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get pending friend requests for a user
 */
export async function getPendingFriendRequests(
  userId: string
): Promise<Friendship[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq("status", "pending")
    .neq("requester_id", userId); // Requests TO this user (not FROM)

  if (error) {
    console.error("Error fetching pending requests:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get sent friend requests from a user
 */
export async function getSentFriendRequests(
  userId: string
): Promise<Friendship[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .eq("requester_id", userId)
    .eq("status", "pending");

  if (error) {
    console.error("Error fetching sent requests:", error);
    throw error;
  }

  return data || [];
}

/**
 * Send a friend request
 */
export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string
): Promise<Friendship> {
  const supabase = await createServerSupabaseClient();

  // Order user IDs to prevent duplicate entries
  const [user1_id, user2_id] = [fromUserId, toUserId].sort();

  // First check if a friendship already exists
  const { data: existing } = await supabase
    .from("friendships")
    .select("*")
    .eq("user1_id", user1_id)
    .eq("user2_id", user2_id)
    .single();

  if (existing) {
    // If already friends or pending, return a friendly error
    if (existing.status === "accepted") {
      throw new Error("You are already friends with this user");
    } else if (existing.status === "pending") {
      throw new Error("A friend request is already pending");
    } else if (existing.status === "rejected") {
      // If previously rejected, update to pending (re-send request)
      const { data: updated, error: updateError } = await supabase
        .from("friendships")
        .update({
          status: "pending",
          requester_id: fromUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error re-sending friend request:", updateError);
        throw updateError;
      }
      return updated;
    }
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert({
      user1_id,
      user2_id,
      status: "pending",
      requester_id: fromUserId,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === "23505") {
      throw new Error("A friend request already exists");
    }
    console.error("Error sending friend request:", error);
    throw error;
  }

  return data;
}

/**
 * Update friendship status
 */
export async function updateFriendshipStatus(
  id: string,
  status: "accepted" | "rejected" | "blocked"
): Promise<Friendship> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("friendships")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating friendship:", error);
    throw error;
  }

  return data;
}

/**
 * Check if two users are friends
 */
export async function areFriends(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  const [user1_id, user2_id] = [userId1, userId2].sort();

  const { data, error } = await supabase
    .from("friendships")
    .select("id")
    .eq("user1_id", user1_id)
    .eq("user2_id", user2_id)
    .eq("status", "accepted")
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking friendship:", error);
    throw error;
  }

  return !!data;
}

// ============================================================================
// Connection Operations
// ============================================================================

/**
 * Create a connection between a profile and a user
 */
export async function createConnection(data: {
  owner_user_id: string;
  profile_id: string;
  connected_user_id: string;
}): Promise<Connection> {
  const supabase = await createServerSupabaseClient();

  // First check if connection already exists
  const { data: existing } = await supabase
    .from("connections")
    .select("*")
    .eq("profile_id", data.profile_id)
    .eq("connected_user_id", data.connected_user_id)
    .single();

  if (existing) {
    // Return existing connection instead of erroring
    return existing;
  }

  const { data: connection, error } = await supabase
    .from("connections")
    .insert(data)
    .select()
    .single();

  if (error) {
    // Handle duplicate key error gracefully
    if (error.code === "23505") {
      // Fetch and return the existing connection
      const { data: existingConn } = await supabase
        .from("connections")
        .select("*")
        .eq("profile_id", data.profile_id)
        .eq("connected_user_id", data.connected_user_id)
        .single();
      if (existingConn) return existingConn;
    }
    console.error("Error creating connection:", error);
    throw error;
  }

  return connection;
}

/**
 * Get connections for a profile
 */
export async function getConnectionsForProfile(
  profileId: string
): Promise<Connection[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .eq("profile_id", profileId);

  if (error) {
    console.error("Error fetching connections:", error);
    throw error;
  }

  return data || [];
}

/**
 * Delete a connection
 */
export async function deleteConnection(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("connections").delete().eq("id", id);

  if (error) {
    console.error("Error deleting connection:", error);
    throw error;
  }
}

/**
 * Find a profile connected to a specific user ID
 * Returns the profile that has this user connected, along with profile details
 */
export async function getProfileByConnectedUser(
  connectedUserId: string
): Promise<{ profileId: string; profileName: string } | null> {
  const supabase = await createServerSupabaseClient();

  // Find connections where this user is the connected user
  const { data: connections, error: connError } = await supabase
    .from("connections")
    .select("profile_id")
    .eq("connected_user_id", connectedUserId);

  if (connError) {
    console.error("Error finding connection:", connError);
    return null;
  }

  if (!connections || connections.length === 0) {
    return null;
  }

  // Get the profile details
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", connections[0].profile_id)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
    return null;
  }

  return {
    profileId: profile.id,
    profileName: profile.display_name,
  };
}

// ============================================================================
// Conversation Operations (Using SECURITY DEFINER RPC Functions)
// ============================================================================

/**
 * Get private (direct) conversations for a user
 * Uses RPC function that bypasses RLS
 * Note: Group conversations are fetched separately via get_user_group_conversations
 */
export async function getConversations(
  userId: string
): Promise<Conversation[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_user_conversations", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Error fetching conversations:", error);
    throw error;
  }

  // Filter to only return private (direct) conversations
  // Groups are fetched separately via /api/conversations/groups
  // Only include conversations that are explicitly private OR have both user IDs set (legacy private chats)
  const allConversations = (data || []) as Conversation[];
  return allConversations.filter(
    (c) =>
      c.type === "private" || (c.user1_id && c.user2_id && c.type !== "group")
  );
}

/**
 * Get a conversation by ID
 */
export async function getConversationById(
  id: string
): Promise<Conversation | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching conversation:", error);
    throw error;
  }

  return data;
}

/**
 * Check if a user has access to a conversation (private or group)
 * Uses RPC function that bypasses RLS
 */
export async function userHasConversationAccess(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("user_has_conversation_access", {
    p_user_id: userId,
    p_conversation_id: conversationId,
  });

  if (error) {
    console.error("Error checking conversation access:", error);
    return false;
  }

  return !!data;
}

/**
 * Get or create a conversation between two users
 * Uses RPC function that bypasses RLS
 */
export async function getOrCreateConversation(
  userId1: string,
  userId2: string,
  _user1KeyEncrypted: string,
  _user2KeyEncrypted: string
): Promise<Conversation> {
  const supabase = await createServerSupabaseClient();

  // Use RPC function to get or create conversation (returns full conversation object)
  const { data: conversations, error } = await supabase.rpc(
    "get_or_create_private_conversation",
    {
      p_user1_id: userId1,
      p_user2_id: userId2,
    }
  );
  if (error) {
    console.error("Error in getOrCreateConversation:", error);
    throw error;
  }

  if (!conversations || conversations.length === 0) {
    throw new Error("Failed to get or create conversation - no data returned");
  }

  return conversations[0] as Conversation;
}

// ============================================================================
// Message Operations (Using SECURITY DEFINER RPC Functions)
// ============================================================================

/**
 * Get messages for a conversation
 * Uses RPC function that bypasses RLS and checks access internally
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  newestFirst = false
): Promise<Message[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_conversation_messages", {
    p_conversation_id: conversationId,
    p_limit: limit,
    p_newest_first: newestFirst,
  });

  if (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }

  return (data || []) as Message[];
}

/**
 * Get messages with sender info for a conversation
 * Uses RPC function that includes sender details (name, avatar, etc.)
 * This works even for removed group members
 */
export async function getMessagesWithSender(
  conversationId: string,
  limit = 50,
  newestFirst = false
): Promise<MessageWithSender[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_conversation_messages_with_sender", {
    p_conversation_id: conversationId,
    p_limit: limit,
    p_newest_first: newestFirst,
  });

  if (error) {
    console.error("Error fetching messages with sender:", error);
    throw error;
  }

  return (data || []) as MessageWithSender[];
}

/**
 * Send a message
 * Uses RPC function that bypasses RLS and checks access internally
 */
export async function sendMessage(data: {
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  message_type: "message" | "prayer_request";
}): Promise<Message> {
  const supabase = await createServerSupabaseClient();

  const { data: messageId, error } = await supabase.rpc("send_message", {
    p_conversation_id: data.conversation_id,
    p_encrypted_content: data.encrypted_content,
    p_iv: data.iv,
    p_message_type: data.message_type,
    p_user_id: data.sender_id, // Pass user_id explicitly since auth.uid() may be NULL
  });
  if (error) {
    console.error("Error sending message:", error);
    throw error;
  }

  // Return a message object with the ID
  return {
    id: messageId,
    conversation_id: data.conversation_id,
    sender_id: data.sender_id,
    encrypted_content: data.encrypted_content,
    iv: data.iv,
    message_type: data.message_type,
    is_read: false,
    created_at: new Date().toISOString(),
  };
}

/**
 * Mark messages as read
 * Uses RPC function that bypasses RLS
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("mark_messages_read", {
    p_conversation_id: conversationId,
    p_user_id: userId, // Pass user_id explicitly since auth.uid() may be NULL
  });

  if (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
}

/**
 * Delete a conversation and all its messages
 * Uses RPC function that bypasses RLS and checks access internally
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { data: success, error } = await supabase.rpc("delete_conversation", {
    p_conversation_id: conversationId,
  });

  if (error) {
    console.error("Error deleting conversation:", error);
    throw error;
  }

  if (!success) {
    throw new Error("Failed to delete conversation - access denied");
  }
}

/**
 * Add a member to a group conversation (admins only)
 * Uses RPC function that bypasses RLS and checks access internally
 */
export async function addGroupMember(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { data: success, error } = await supabase.rpc("add_group_member", {
    p_conversation_id: conversationId,
    p_new_member_id: userId,
  });

  if (error) {
    console.error("Error adding group member:", error);
    throw error;
  }

  if (!success) {
    throw new Error(
      "Failed to add group member - access denied or not a group"
    );
  }
}

/**
 * Remove/kick a member from a group conversation (creator only)
 * Uses RPC function that bypasses RLS and checks access internally
 */
export async function removeGroupMember(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { data: success, error } = await supabase.rpc("remove_group_member", {
    p_conversation_id: conversationId,
    p_member_id: userId,
  });

  if (error) {
    console.error("Error removing group member:", error);
    throw error;
  }

  if (!success) {
    throw new Error("Failed to remove group member - access denied");
  }
}

// ============================================================================
// User Keys Operations
// ============================================================================

/**
 * Get user's encryption keys
 */
export async function getUserKeys(userId: string): Promise<UserKeys | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("user_keys")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching user keys:", error);
    throw error;
  }

  return data;
}

/**
 * Store user's encryption keys
 */
export async function storeUserKeys(data: {
  user_id: string;
  public_key: string;
  encrypted_private_key: string;
  key_salt: string;
}): Promise<UserKeys> {
  const supabase = await createServerSupabaseClient();

  const { data: keys, error } = await supabase
    .from("user_keys")
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error("Error storing user keys:", error);
    throw error;
  }

  return keys;
}

/**
 * Update user's encryption keys (for password change)
 */
export async function updateUserKeys(
  userId: string,
  data: {
    encrypted_private_key: string;
    key_salt: string;
  }
): Promise<UserKeys> {
  const supabase = await createServerSupabaseClient();

  const { data: keys, error } = await supabase
    .from("user_keys")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating user keys:", error);
    throw error;
  }

  return keys;
}

// ============================================================================
// User Search
// ============================================================================

/**
 * Search for users by email or name
 */
export async function searchUsers(
  query: string,
  excludeUserId?: string
): Promise<
  Array<{
    id: string;
    email: string;
    username: string;
    full_name: string;
    avatar_initials: string | null;
    avatar_color: string | null;
    avatar_path: string | null;
    effective_avatar_path: string | null;
  }>
> {
  const supabase = await createServerSupabaseClient();

  // Search in auth.users via a custom RPC function
  const { data, error } = await supabase.rpc("search_users", {
    search_query: query,
    exclude_user_id: excludeUserId || null,
  });

  if (error) {
    console.error("Error searching users:", error);
    return [];
  }

  interface SearchUserResult {
    id: string;
    email: string;
    username: string;
    full_name: string;
    avatar_initials: string | null;
    avatar_color: string | null;
    avatar_path: string | null;
  }

  const users: SearchUserResult[] = (data || []).map(
    (user: Record<string, unknown>) => ({
      id: user.id as string,
      email: user.email as string,
      username:
        (user.username as string) ||
        (user.email as string)?.split("@")[0] ||
        "",
      full_name: user.full_name as string,
      avatar_initials: user.avatar_initials as string | null,
      avatar_color: user.avatar_color as string | null,
      avatar_path: user.avatar_path as string | null,
    })
  );

  // Get effective avatars for each user (check connected profiles)
  const userIds = users.map((u: SearchUserResult) => u.id);

  // Batch fetch connections for all users
  const { data: connections } = await supabase
    .from("connections")
    .select("connected_user_id, profile_id")
    .in("connected_user_id", userIds);

  // Get profile avatars for connected profiles
  const profileIds = (connections || []).map((c) => c.profile_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, avatar_path")
    .in("id", profileIds);

  // Create lookup maps
  const connectionMap = new Map(
    (connections || []).map((c) => [c.connected_user_id, c.profile_id])
  );
  const profileAvatarMap = new Map(
    (profiles || []).map((p) => [p.id, p.avatar_path])
  );

  // Add effective avatar to each user
  return users.map((user: SearchUserResult) => {
    const profileId = connectionMap.get(user.id);
    const profileAvatar = profileId ? profileAvatarMap.get(profileId) : null;

    return {
      ...user,
      effective_avatar_path: profileAvatar || user.avatar_path,
    };
  });
}

/**
 * Get user info by ID
 * Returns effective_avatar_path which prioritizes:
 * 1. Connected profile's avatar_path (highest priority)
 * 2. User's own avatar_path (second priority)
 * 3. null (fallback to initials)
 */
export async function getUserById(userId: string): Promise<{
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_initials: string | null;
  avatar_color: string | null;
  avatar_path: string | null;
  effective_avatar_path: string | null;
} | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_user_by_id", {
    user_id: userId,
  });

  if (error) {
    console.error("Error getting user by ID:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const user = data[0];
  const userAvatarPath = user.avatar_path as string | null;

  // Check for connected profile's avatar (takes precedence)
  let effectiveAvatarPath = userAvatarPath;

  // Look for a profile connected to this user
  const { data: connectionData } = await supabase
    .from("connections")
    .select("profile_id")
    .eq("connected_user_id", userId)
    .limit(1)
    .maybeSingle();

  if (connectionData?.profile_id) {
    // Get the connected profile's avatar
    const { data: profileData } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", connectionData.profile_id)
      .single();

    if (profileData?.avatar_path) {
      // Profile's custom avatar takes precedence
      effectiveAvatarPath = profileData.avatar_path;
    }
  }

  return {
    id: user.id as string,
    email: user.email as string,
    username:
      (user.username as string) || (user.email as string)?.split("@")[0] || "",
    full_name: user.full_name as string,
    avatar_initials: user.avatar_initials as string | null,
    avatar_color: user.avatar_color as string | null,
    avatar_path: userAvatarPath,
    effective_avatar_path: effectiveAvatarPath,
  };
}

// ============================================================================
// Notification Functions
// ============================================================================

/**
 * Create a message notification for the recipient(s)
 * This is called after a message is sent to notify recipients in real-time
 */
export async function createMessageNotification(
  conversationId: string,
  senderId: string,
  senderName: string,
  messageId: string,
  messageType: string
): Promise<void> {
  // Use admin client for reads (to bypass RLS on conversations)
  // and for inserts (notification_events has no INSERT policy)
  let adminClient;
  try {
    adminClient = createAdminSupabaseClient();
  } catch (error) {
    console.error("Admin client not available for notifications:", error);
    return;
  }

  try {
    // Get conversation details using admin client
    const { data: conversation, error: convError } = await adminClient
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("Error fetching conversation for notification:", convError);
      return;
    }

    const displayName = senderName || "Someone";
    const isPrayer = messageType === "prayer_request";

    if (conversation.type === "private") {
      // Private conversation - notify the other user
      const recipientId =
        conversation.user1_id === senderId
          ? conversation.user2_id
          : conversation.user1_id;

      if (recipientId) {
        // Check if recipient has soft-deleted the conversation
        const { data: deletion } = await adminClient
          .from("conversation_deletions")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("user_id", recipientId)
          .maybeSingle();

        if (!deletion) {
          const { error: insertError } = await adminClient.from("notification_events").insert({
            user_id: recipientId,
            type: "message",
            title: displayName,
            body: isPrayer ? "Sent a prayer request" : "New message",
            payload: {
              conversation_id: conversationId,
              message_id: messageId,
              sender_id: senderId,
              is_prayer_request: isPrayer,
            },
          });
          if (insertError) {
            console.error("Error inserting message notification:", insertError);
          }
        }
      }
    } else if (conversation.type === "group") {
      // Group conversation - notify all members except sender
      const { data: members } = await adminClient
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", senderId);

      if (members && members.length > 0) {
        // Get users who haven't soft-deleted the conversation
        const { data: deletions } = await adminClient
          .from("conversation_deletions")
          .select("user_id")
          .eq("conversation_id", conversationId);

        const deletedUserIds = new Set(
          (deletions || []).map((d) => d.user_id)
        );

        const notifications = members
          .filter((m) => !deletedUserIds.has(m.user_id))
          .map((member) => ({
            user_id: member.user_id,
            type: "message" as const,
            title: `${conversation.group_name || "Group"}: ${displayName}`,
            body: isPrayer ? "Sent a prayer request" : "New message",
            payload: {
              conversation_id: conversationId,
              message_id: messageId,
              sender_id: senderId,
              group_name: conversation.group_name,
              is_prayer_request: isPrayer,
            },
          }));

        if (notifications.length > 0) {
          const { error: insertError } = await adminClient.from("notification_events").insert(notifications);
          if (insertError) {
            console.error("Error inserting group message notifications:", insertError);
          }
        }
      }
    }
  } catch (error) {
    // Log but don't fail - notifications should never break messaging
    console.error("Error creating message notification:", error);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateRandomColor(): string {
  const colors = [
    "#e57373",
    "#f06292",
    "#ba68c8",
    "#9575cd",
    "#7986cb",
    "#64b5f6",
    "#4fc3f7",
    "#4dd0e1",
    "#4db6ac",
    "#81c784",
    "#aed581",
    "#dce775",
    "#fff176",
    "#ffd54f",
    "#ffb74d",
    "#ff8a65",
    "#a1887f",
    "#90a4ae",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
