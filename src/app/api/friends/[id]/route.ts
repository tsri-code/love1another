import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  updateFriendshipStatus,
} from "@/lib/supabase-db";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/friends/[id] - Accept or reject a friend request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.write);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["accepted", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be 'accepted' or 'rejected'" },
        { status: 400 }
      );
    }

    const friendship = await updateFriendshipStatus(id, status);

    return NextResponse.json({
      friendship: {
        id: friendship.id,
        status: friendship.status,
        updatedAt: friendship.updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating friendship:", error);
    return NextResponse.json(
      { error: "Failed to update friendship" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/friends/[id] - Remove a friend or cancel a request
 * Also deletes:
 * - Profile connections where the friend is the connected user
 * - Conversations and messages between the two users
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.write);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // First, get the friendship to find the other user
    const { data: friendship } = await supabase
      .from("friendships")
      .select("user1_id, user2_id")
      .eq("id", id)
      .single();

    if (friendship) {
      const otherUserId =
        friendship.user1_id === user.id
          ? friendship.user2_id
          : friendship.user1_id;

      // Delete ALL connections between these two users (in both directions)
      // Query for all connections involving both users, then delete by ID
      const { data: connectionsToDelete } = await supabase
        .from("connections")
        .select("id")
        .or(
          `and(owner_user_id.eq.${user.id},connected_user_id.eq.${otherUserId}),and(owner_user_id.eq.${otherUserId},connected_user_id.eq.${user.id})`
        );

      if (connectionsToDelete && connectionsToDelete.length > 0) {
        const connectionIds = connectionsToDelete.map((c) => c.id);
        const { error: connError } = await supabase
          .from("connections")
          .delete()
          .in("id", connectionIds);

        if (connError) {
          console.error("Error deleting connections:", connError);
        }
      }

      // Find and delete conversations between the two users
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`
        );

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map((c) => c.id);

        // Delete messages in these conversations
        const { error: msgError } = await supabase
          .from("messages")
          .delete()
          .in("conversation_id", conversationIds);

        if (msgError) {
          console.error("Error deleting messages:", msgError);
        }

        // Delete the conversations
        const { error: convError } = await supabase
          .from("conversations")
          .delete()
          .in("id", conversationIds);

        if (convError) {
          console.error("Error deleting conversations:", convError);
        }
      }
    }

    // Delete the friendship
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting friendship:", error);
      return NextResponse.json(
        { error: "Failed to delete friendship" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting friendship:", error);
    return NextResponse.json(
      { error: "Failed to delete friendship" },
      { status: 500 }
    );
  }
}
