import { NextRequest, NextResponse } from "next/server";
import {
  getLinkById,
  updateLink,
  deleteLink,
  getAuthenticatedUser,
} from "@/lib/supabase-db";
import { checkRateLimit, rateLimits, rateLimitedResponse } from "@/lib/api-security";
import {
  encryptLinkName,
  parseStoredValue,
} from "@/lib/server-crypto";

export const dynamic = "force-dynamic";

/**
 * Helper to decrypt profile display_name
 */
function decryptProfileDisplayName(storedName: string, userId: string): string {
  return parseStoredValue(storedName, userId, "profile_name") || storedName;
}

/**
 * Helper to decrypt link name
 */
function decryptLinkDisplayName(storedName: string | null, userId: string): string {
  if (!storedName) return "Link";
  return parseStoredValue(storedName, userId, "link_name") || storedName;
}

/**
 * Helper to encrypt link name
 */
function encryptLinkDisplayName(name: string, userId: string): string {
  const encrypted = encryptLinkName(name, userId);
  return JSON.stringify(encrypted);
}

/**
 * Helper to decrypt avatar initials
 */
function decryptProfileAvatarInitials(storedInitials: string | null, userId: string): string | null {
  if (!storedInitials) return null;
  return parseStoredValue(storedInitials, userId, "avatar_initials") || storedInitials;
}

/**
 * GET /api/links/[id] - Get a link by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request, rateLimits.read);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const link = await getLinkById(id);

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    return NextResponse.json({
      link: {
        id: link.id,
        displayName: decryptLinkDisplayName(link.link_name, user.id),
        person1: link.profile1
          ? {
              id: link.profile1.id,
              displayName: decryptProfileDisplayName(link.profile1.display_name, link.profile1.user_id),
              avatarInitials: decryptProfileAvatarInitials(link.profile1.avatar_initials, link.profile1.user_id),
              avatarColor: link.profile1.avatar_color,
              avatarPath: link.profile1.avatar_path,
            }
          : null,
        person2: link.profile2
          ? {
              id: link.profile2.id,
              displayName: decryptProfileDisplayName(link.profile2.display_name, link.profile2.user_id),
              avatarInitials: decryptProfileAvatarInitials(link.profile2.avatar_initials, link.profile2.user_id),
              avatarColor: link.profile2.avatar_color,
              avatarPath: link.profile2.avatar_path,
            }
          : null,
        prayerCount: link.prayer_count,
        createdAt: link.created_at,
      },
    });
  } catch (error) {
    console.error("Error fetching link:", error);
    return NextResponse.json(
      { error: "Failed to fetch link" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/links/[id] - Update a link
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
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
    const { linkName } = body;

    const existingLink = await getLinkById(id);
    if (!existingLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Encrypt the link name if provided
    const encryptedLinkName = linkName ? encryptLinkDisplayName(linkName, user.id) : undefined;

    const updatedLink = await updateLink(id, {
      link_name: encryptedLinkName,
    });

    return NextResponse.json({
      link: {
        id: updatedLink.id,
        displayName: linkName || decryptLinkDisplayName(updatedLink.link_name, user.id),
        prayerCount: updatedLink.prayer_count,
        updatedAt: updatedLink.updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating link:", error);
    return NextResponse.json(
      { error: "Failed to update link" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/links/[id] - Delete a link
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request, rateLimits.write);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const existingLink = await getLinkById(id);
    if (!existingLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    await deleteLink(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting link:", error);
    return NextResponse.json(
      { error: "Failed to delete link" },
      { status: 500 }
    );
  }
}
