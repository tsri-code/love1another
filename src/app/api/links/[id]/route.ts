import { NextRequest, NextResponse } from "next/server";
import {
  getLinkById,
  updateLink,
  deleteLink,
  getAuthenticatedUser,
} from "@/lib/supabase-db";
import { checkRateLimit, rateLimits, rateLimitedResponse } from "@/lib/api-security";

export const dynamic = "force-dynamic";

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
        displayName: link.link_name,
        person1: link.profile1
          ? {
              id: link.profile1.id,
              displayName: link.profile1.display_name,
              avatarInitials: link.profile1.avatar_initials,
              avatarColor: link.profile1.avatar_color,
              avatarPath: link.profile1.avatar_path,
            }
          : null,
        person2: link.profile2
          ? {
              id: link.profile2.id,
              displayName: link.profile2.display_name,
              avatarInitials: link.profile2.avatar_initials,
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

    const updatedLink = await updateLink(id, {
      link_name: linkName,
    });

    return NextResponse.json({
      link: {
        id: updatedLink.id,
        displayName: updatedLink.link_name,
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
