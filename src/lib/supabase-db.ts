/**
 * Supabase Database Operations
 *
 * This module provides database operations using Supabase.
 * All operations are scoped to the authenticated user via RLS.
 */

import { createServerSupabaseClient } from "./supabase-server";
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
// Conversation Operations
// ============================================================================

/**
 * Get all conversations for a user
 */
export async function getConversations(
  userId: string
): Promise<Conversation[]> {
  const supabase = await createServerSupabaseClient();

  // Fetch conversations where user is a participant
  const result = await supabase
    .from("conversations")
    .select("*")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (result.error) {
    console.error("Error fetching conversations:", result.error);
    throw result.error;
  }

  // Filter out group chats client-side (type !== 'group')
  // This handles both when type column exists and when it doesn't
  const data = (result.data || []).filter(
    (c: Record<string, unknown>) => !c.type || c.type === "private"
  );

  return data;
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
 */
export async function userHasConversationAccess(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  // Use the database function we created to check access
  const { data, error } = await supabase.rpc("user_has_conversation_access", {
    p_user_id: userId,
    p_conversation_id: conversationId,
  });

  if (error) {
    console.error("Error checking conversation access:", error);
    // Fallback: try direct check
    const conversation = await getConversationById(conversationId);
    if (!conversation) return false;

    // Check private conversation
    if (conversation.user1_id === userId || conversation.user2_id === userId) {
      return true;
    }

    // Check group creator
    if (conversation.creator_id === userId) {
      return true;
    }

    // Check group membership
    if (conversation.type === "group") {
      const { data: member } = await supabase
        .from("conversation_members")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!member;
    }

    return false;
  }

  return !!data;
}

/**
 * Get or create a conversation between two users
 */
export async function getOrCreateConversation(
  userId1: string,
  userId2: string,
  user1KeyEncrypted: string,
  user2KeyEncrypted: string
): Promise<Conversation> {
  const supabase = await createServerSupabaseClient();

  const [user1_id, user2_id] = [userId1, userId2].sort();

  // Try to find existing conversation - use maybeSingle() to avoid error when not found
  const existingResult = await supabase
    .from("conversations")
    .select("*")
    .eq("user1_id", user1_id)
    .eq("user2_id", user2_id)
    .maybeSingle();

  if (existingResult.error) {
    console.error("Error checking existing conversation:", existingResult.error);
    throw existingResult.error;
  }

  if (existingResult.data) {
    return existingResult.data;
  }

  // Create new private conversation with type explicitly set
  const insertData = {
    user1_id,
    user2_id,
    user1_key_encrypted: user1KeyEncrypted,
    user2_key_encrypted: user2KeyEncrypted,
    type: "private",
  };

  const result = await supabase
    .from("conversations")
    .insert(insertData)
    .select()
    .single();

  if (result.error) {
    console.error("Error creating conversation:", result.error);
    throw result.error;
  }

  return result.data;
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  newestFirst = false
): Promise<Message[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: !newestFirst })
    .limit(limit);

  if (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }

  return data || [];
}

/**
 * Send a message
 */
export async function sendMessage(data: {
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  message_type: "message" | "prayer_request";
}): Promise<Message> {
  const supabase = await createServerSupabaseClient();

  const { data: message, error } = await supabase
    .from("messages")
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error("Error sending message:", error);
    throw error;
  }

  // Update conversation's updated_at
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", data.conversation_id);

  return message;
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  // Delete all messages in the conversation first
  const { error: messagesError } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId);

  if (messagesError) {
    console.error("Error deleting messages:", messagesError);
    throw messagesError;
  }

  // Then delete the conversation
  const { error: conversationError } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (conversationError) {
    console.error("Error deleting conversation:", conversationError);
    throw conversationError;
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
