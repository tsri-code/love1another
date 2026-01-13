import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getConversations,
  getOrCreateConversation,
} from "@/lib/supabase-db";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages - Get all conversations for the current user
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

    const conversations = await getConversations(user.id);

    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        otherUserId: c.user1_id === user.id ? c.user2_id : c.user1_id,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages - Start or get a conversation with another user
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
    const { otherUserId } = body;

    if (!otherUserId) {
      return NextResponse.json(
        { error: "Other user ID is required" },
        { status: 400 }
      );
    }

    if (otherUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot start conversation with yourself" },
        { status: 400 }
      );
    }

    // Get or create conversation (placeholder keys for now)
    const conversation = await getOrCreateConversation(
      user.id,
      otherUserId,
      "", // user1_key_encrypted - would be set up during E2E encryption setup
      ""  // user2_key_encrypted
    );

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        otherUserId: conversation.user1_id === user.id 
          ? conversation.user2_id 
          : conversation.user1_id,
        createdAt: conversation.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
