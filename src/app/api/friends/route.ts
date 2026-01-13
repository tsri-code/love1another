import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getFriendships,
  getPendingFriendRequests,
  getSentFriendRequests,
  sendFriendRequest,
  getUserById,
} from "@/lib/supabase-db";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

// Helper to format user data
function formatUser(
  userData: {
    id: string;
    email: string;
    username: string;
    full_name: string;
    avatar_initials: string | null;
    avatar_color: string | null;
    avatar_path: string | null;
    effective_avatar_path: string | null;
  } | null
) {
  if (!userData) return null;
  return {
    id: userData.id,
    email: userData.email,
    username: userData.username,
    fullName: userData.full_name,
    avatarInitials: userData.avatar_initials,
    avatarColor: userData.avatar_color,
    avatarPath: userData.effective_avatar_path, // Use effective avatar (profile > user)
  };
}

/**
 * GET /api/friends - Get friends and friend requests
 * Query params:
 * - type: 'all' | 'friends' | 'pending' | 'sent'
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.read);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    const result: {
      friends?: unknown[];
      pendingRequests?: unknown[];
      sentRequests?: unknown[];
    } = {};

    if (type === "all" || type === "friends") {
      const friendships = await getFriendships(user.id);
      const friendsWithData = await Promise.all(
        friendships.map(async (f) => {
          const friendId = f.user1_id === user.id ? f.user2_id : f.user1_id;
          const friendData = await getUserById(friendId);
          return {
            id: friendId,
            friendshipId: f.id,
            status: f.status,
            createdAt: f.created_at,
            user: formatUser(friendData),
          };
        })
      );
      result.friends = friendsWithData;
    }

    if (type === "all" || type === "pending") {
      const pending = await getPendingFriendRequests(user.id);
      const pendingWithData = await Promise.all(
        pending.map(async (f) => {
          const fromUserData = await getUserById(f.requester_id);
          return {
            id: f.id,
            fromUserId: f.requester_id,
            status: f.status,
            createdAt: f.created_at,
            fromUser: formatUser(fromUserData),
          };
        })
      );
      result.pendingRequests = pendingWithData;
    }

    if (type === "all" || type === "sent") {
      const sent = await getSentFriendRequests(user.id);
      const sentWithData = await Promise.all(
        sent.map(async (f) => {
          const toUserId = f.user1_id === user.id ? f.user2_id : f.user1_id;
          const toUserData = await getUserById(toUserId);
          return {
            id: f.id,
            toUserId: toUserId,
            status: f.status,
            createdAt: f.created_at,
            toUser: formatUser(toUserData),
          };
        })
      );
      result.sentRequests = sentWithData;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching friends:", error);
    return NextResponse.json(
      { error: "Failed to fetch friends" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/friends - Send a friend request
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.write);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { toUserId } = body;

    if (!toUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 }
      );
    }

    if (toUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot send friend request to yourself" },
        { status: 400 }
      );
    }

    const friendship = await sendFriendRequest(user.id, toUserId);

    return NextResponse.json(
      {
        friendship: {
          id: friendship.id,
          status: friendship.status,
          createdAt: friendship.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error sending friend request:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send friend request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
