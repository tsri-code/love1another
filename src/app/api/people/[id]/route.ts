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
import {
  encryptProfileName,
  encryptAvatarInitials,
  parseStoredValue,
} from "@/lib/server-crypto";

export const dynamic = "force-dynamic";

/**
 * Helper to decrypt profile display_name, handling both encrypted and legacy plaintext
 */
function decryptProfileDisplayName(storedName: string, userId: string): string {
  return parseStoredValue(storedName, userId, "profile_name") || storedName;
}

/**
 * Helper to encrypt profile display_name
 */
function encryptProfileDisplayName(name: string, userId: string): string {
  const encrypted = encryptProfileName(name, userId);
  return JSON.stringify(encrypted);
}

/**
 * Helper to decrypt avatar initials, handling both encrypted and legacy plaintext
 */
function decryptProfileAvatarInitials(storedInitials: string | null, userId: string): string | null {
  if (!storedInitials) return null;
  return parseStoredValue(storedInitials, userId, "avatar_initials") || storedInitials;
}

/**
 * Helper to encrypt avatar initials
 */
function encryptProfileAvatarInitials(initials: string, userId: string): string {
  const encrypted = encryptAvatarInitials(initials, userId);
  return JSON.stringify(encrypted);
}

/**
 * Helper to decrypt link name
 */
function decryptLinkDisplayName(storedName: string | null, userId: string): string {
  if (!storedName) return "Link";
  return parseStoredValue(storedName, userId, "link_name") || storedName;
}

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

    // Decrypt display name
    const decryptedName = decryptProfileDisplayName(profile.display_name, profile.user_id);

    // Transform to match frontend expectations
    const person = {
      id: profile.id,
      displayName: decryptedName,
      type: profile.type,
      avatarPath: profile.avatar_path,
      avatarInitials: decryptProfileAvatarInitials(profile.avatar_initials, profile.user_id),
      avatarColor: profile.avatar_color,
      verseId: profile.verse_id,
      prayerCount: profile.prayer_count,
      createdAt: profile.created_at,
    };

    // Get links this person is part of
    const allLinks = await getLinksForProfile(id);
    const links = allLinks.map((link) => ({
      id: link.id,
      displayName: decryptLinkDisplayName(link.link_name, user.id),
      person1: link.profile1
        ? {
            id: link.profile1.id,
            displayName: decryptProfileDisplayName(link.profile1.display_name, link.profile1.user_id),
            avatarInitials: decryptProfileAvatarInitials(link.profile1.avatar_initials, link.profile1.user_id),
            avatarColor: link.profile1.avatar_color,
          }
        : null,
      person2: link.profile2
        ? {
            id: link.profile2.id,
            displayName: decryptProfileDisplayName(link.profile2.display_name, link.profile2.user_id),
            avatarInitials: decryptProfileAvatarInitials(link.profile2.avatar_initials, link.profile2.user_id),
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

    // Store original plaintext for response
    const plaintextDisplayName = displayName?.trim();
    const plaintextInitials = avatarInitials;

    // Build update data with encrypted display name and initials
    const updateData: Record<string, unknown> = {};
    if (plaintextDisplayName) {
      updateData.display_name = encryptProfileDisplayName(plaintextDisplayName, existingProfile.user_id);
    }
    if (type) updateData.type = type;
    if (plaintextInitials) {
      updateData.avatar_initials = encryptProfileAvatarInitials(plaintextInitials, existingProfile.user_id);
    }
    if (avatarColor) updateData.avatar_color = avatarColor;
    if (avatarPath !== undefined) updateData.avatar_path = avatarPath;

    const updatedProfile = await updateProfile(id, updateData);

    // Transform to match frontend expectations (with decrypted values)
    const person = {
      id: updatedProfile.id,
      displayName: plaintextDisplayName || decryptProfileDisplayName(updatedProfile.display_name, updatedProfile.user_id),
      type: updatedProfile.type,
      avatarPath: updatedProfile.avatar_path,
      avatarInitials: plaintextInitials || decryptProfileAvatarInitials(updatedProfile.avatar_initials, updatedProfile.user_id),
      avatarColor: updatedProfile.avatar_color,
      verseId: updatedProfile.verse_id,
      prayerCount: updatedProfile.prayer_count,
      createdAt: updatedProfile.created_at,
    };

    // Get links this person is part of
    const allLinks = await getLinksForProfile(id);
    const links = allLinks.map((link) => ({
      id: link.id,
      displayName: decryptLinkDisplayName(link.link_name, user.id),
      person1: link.profile1
        ? {
            id: link.profile1.id,
            displayName: decryptProfileDisplayName(link.profile1.display_name, link.profile1.user_id),
            avatarInitials: decryptProfileAvatarInitials(link.profile1.avatar_initials, link.profile1.user_id),
            avatarColor: link.profile1.avatar_color,
          }
        : null,
      person2: link.profile2
        ? {
            id: link.profile2.id,
            displayName: decryptProfileDisplayName(link.profile2.display_name, link.profile2.user_id),
            avatarInitials: decryptProfileAvatarInitials(link.profile2.avatar_initials, link.profile2.user_id),
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
