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
import {
  encryptMessage as encryptMsg,
  decryptMessage as decryptMsg,
  isEncryptedPayload,
} from "@/lib/server-crypto";

export const dynamic = "force-dynamic";

/**
 * Helper to decrypt message content, handling both encrypted and legacy plaintext
 */
function decryptMessageContent(encryptedContent: string, conversationId: string): string {
  if (!encryptedContent) return "";
  
  // Try to parse as encrypted payload
  try {
    const parsed = JSON.parse(encryptedContent);
    if (isEncryptedPayload(parsed)) {
      return decryptMsg(parsed, conversationId);
    }
  } catch {
    // Not JSON, treat as legacy plaintext
  }
  
  // Return as-is (legacy plaintext data)
  return encryptedContent;
}

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
    const skipMarkRead = searchParams.get("skipMarkRead") === "true";

    // Mark messages as read (unless skipMarkRead is set - used for preview fetches)
    if (!skipMarkRead) {
      await markMessagesAsRead(conversationId, user.id);
    }

    if (includeSender) {
      // Use the new function that includes sender info
      const messages = await getMessagesWithSender(conversationId, limit, newestFirst);

      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          // Decrypt content server-side (handles both encrypted and legacy plaintext)
          content: decryptMessageContent(m.encrypted_content, conversationId),
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
        // Decrypt content server-side (handles both encrypted and legacy plaintext)
        content: decryptMessageContent(m.encrypted_content, conversationId),
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
    // Accept either new format (content) or legacy format (encryptedContent + iv)
    const { content, encryptedContent, iv, type = "message" } = body;

    // Determine content and encrypt if needed
    let finalEncryptedContent: string;
    let finalIv: string;

    if (content) {
      // New format: plaintext content, encrypt server-side
      const encrypted = encryptMsg(content, conversationId);
      finalEncryptedContent = JSON.stringify(encrypted);
      finalIv = encrypted.iv; // Store IV separately for potential future use
    } else if (encryptedContent && iv) {
      // Legacy format: already encrypted (or was passed as plaintext with placeholder IV)
      // For backward compatibility, store as-is
      finalEncryptedContent = encryptedContent;
      finalIv = iv;
    } else {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // RPC function handles access control - throws if no access
    const message = await sendMessage({
      conversation_id: conversationId,
      sender_id: user.id,
      encrypted_content: finalEncryptedContent,
      iv: finalIv,
      message_type: type,
    });

    // Note: Notifications are created by database trigger (on_message_insert_notification)
    // No need to call createMessageNotification here

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
