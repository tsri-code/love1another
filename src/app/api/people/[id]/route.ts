import { NextRequest, NextResponse } from "next/server";
import {
  getProfileById,
  updateProfile,
  deleteProfile,
  getLinksForProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-db";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/people/[id] - Get person public info with their links
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

    const profile = await getProfileById(id);

    if (!profile) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Transform to match frontend expectations
    const person = {
      id: profile.id,
      displayName: profile.display_name,
      type: profile.type,
      avatarPath: profile.avatar_path,
      avatarInitials: profile.avatar_initials,
      avatarColor: profile.avatar_color,
      verseId: profile.verse_id,
      prayerCount: profile.prayer_count,
      createdAt: profile.created_at,
    };

    // Get links this person is part of
    const allLinks = await getLinksForProfile(id);
    const links = allLinks.map((link) => ({
      id: link.id,
      displayName: link.link_name || "Link",
      person1: link.profile1
        ? {
            id: link.profile1.id,
            displayName: link.profile1.display_name,
            avatarInitials: link.profile1.avatar_initials,
            avatarColor: link.profile1.avatar_color,
          }
        : null,
      person2: link.profile2
        ? {
            id: link.profile2.id,
            displayName: link.profile2.display_name,
            avatarInitials: link.profile2.avatar_initials,
            avatarColor: link.profile2.avatar_color,
          }
        : null,
      prayerCount: link.prayer_count,
      createdAt: link.created_at,
    }));

    return NextResponse.json({
      person,
      links,
    });
  } catch (error) {
    console.error("Error fetching person:", error);
    return NextResponse.json(
      { error: "Failed to fetch person" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/people/[id] - Update person
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request, rateLimits.profile);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const existingProfile = await getProfileById(id);

    if (!existingProfile) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const body = await request.json();
    const { displayName, type, avatarInitials, avatarColor, avatarPath } = body;

    // Validate type
    if (type && !["person", "group"].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "person" or "group"' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (displayName?.trim()) updateData.display_name = displayName.trim();
    if (type) updateData.type = type;
    if (avatarInitials) updateData.avatar_initials = avatarInitials;
    if (avatarColor) updateData.avatar_color = avatarColor;
    if (avatarPath !== undefined) updateData.avatar_path = avatarPath;

    const updatedProfile = await updateProfile(id, updateData);

    // Transform to match frontend expectations
    const person = {
      id: updatedProfile.id,
      displayName: updatedProfile.display_name,
      type: updatedProfile.type,
      avatarPath: updatedProfile.avatar_path,
      avatarInitials: updatedProfile.avatar_initials,
      avatarColor: updatedProfile.avatar_color,
      verseId: updatedProfile.verse_id,
      prayerCount: updatedProfile.prayer_count,
      createdAt: updatedProfile.created_at,
    };

    // Get links this person is part of
    const allLinks = await getLinksForProfile(id);
    const links = allLinks.map((link) => ({
      id: link.id,
      displayName: link.link_name || "Link",
      person1: link.profile1
        ? {
            id: link.profile1.id,
            displayName: link.profile1.display_name,
            avatarInitials: link.profile1.avatar_initials,
            avatarColor: link.profile1.avatar_color,
          }
        : null,
      person2: link.profile2
        ? {
            id: link.profile2.id,
            displayName: link.profile2.display_name,
            avatarInitials: link.profile2.avatar_initials,
            avatarColor: link.profile2.avatar_color,
          }
        : null,
      prayerCount: link.prayer_count,
      createdAt: link.created_at,
    }));

    return NextResponse.json({
      person,
      links,
    });
  } catch (error) {
    console.error("Error updating person:", error);
    return NextResponse.json(
      { error: "Failed to update person" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/[id] - Delete person
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
    const profile = await getProfileById(id);

    if (!profile) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Note: Links involving this profile will be cascade deleted due to foreign key
    await deleteProfile(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting person:", error);
    return NextResponse.json(
      { error: "Failed to delete person" },
      { status: 500 }
    );
  }
}
