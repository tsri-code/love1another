import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getMessages,
  getMessagesWithSender,
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
 * Access control is handled by the RPC function internally
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const newestFirst = searchParams.get("newest") === "true";
    const includeSender = searchParams.get("includeSender") === "true";

    // Mark messages as read (RPC function handles access control)
    await markMessagesAsRead(conversationId, user.id);

    if (includeSender) {
      // Use the new function that includes sender info
      const messages = await getMessagesWithSender(conversationId, limit, newestFirst);

      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          encryptedContent: m.encrypted_content,
          iv: m.iv,
          type: m.message_type,
          isRead: m.is_read,
          createdAt: m.created_at,
          sender: {
            fullName: m.sender_full_name,
            username: m.sender_username,
            avatarInitials: m.sender_avatar_initials,
            avatarColor: m.sender_avatar_color,
            avatarPath: m.sender_avatar_path,
          },
        })),
      });
    }

    // Default: use original function without sender info
    const messages = await getMessages(conversationId, limit, newestFirst);

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
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error("Error fetching messages:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages", details: err.message, code: err.code },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages/[conversationId] - Send a message
 * Access control is handled by the RPC function internally
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

    const body = await request.json();
    const { encryptedContent, iv, type = "message" } = body;

    if (!encryptedContent || !iv) {
      return NextResponse.json(
        { error: "Encrypted content and IV are required" },
        { status: 400 }
      );
    }

    // RPC function handles access control - throws if no access
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
 * Access control is handled by the RPC function internally
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

    // RPC function handles access control - throws if no access
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
