import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getConversationById,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  deleteConversation,
} from "@/lib/supabase-db";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages/[conversationId] - Get messages in a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.read);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { conversationId } = await params;

    // Verify user is part of this conversation
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (
      conversation.user1_id !== user.id &&
      conversation.user2_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Not authorized to view this conversation" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const newestFirst = searchParams.get("newest") === "true";

    const messages = await getMessages(conversationId, limit, newestFirst);

    // Mark messages as read
    await markMessagesAsRead(conversationId, user.id);

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        encryptedContent: m.encrypted_content,
        iv: m.iv,
        type: m.message_type,
        isRead: m.is_read,
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages/[conversationId] - Send a message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
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

    const { conversationId } = await params;

    // Verify user is part of this conversation
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (
      conversation.user1_id !== user.id &&
      conversation.user2_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Not authorized to send to this conversation" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { encryptedContent, iv, type = "message" } = body;

    if (!encryptedContent || !iv) {
      return NextResponse.json(
        { error: "Encrypted content and IV are required" },
        { status: 400 }
      );
    }

    const message = await sendMessage({
      conversation_id: conversationId,
      sender_id: user.id,
      encrypted_content: encryptedContent,
      iv,
      message_type: type,
    });

    return NextResponse.json(
      {
        message: {
          id: message.id,
          senderId: message.sender_id,
          type: message.message_type,
          createdAt: message.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/[conversationId] - Delete a conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
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

    const { conversationId } = await params;

    // Verify user is part of this conversation
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (
      conversation.user1_id !== user.id &&
      conversation.user2_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Not authorized to delete this conversation" },
        { status: 403 }
      );
    }

    await deleteConversation(conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
