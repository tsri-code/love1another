import { NextRequest, NextResponse } from "next/server";
import {
  createLink,
  getAuthenticatedUser,
  getProfileById,
} from "@/lib/supabase-db";
import { checkRateLimit, rateLimits, rateLimitedResponse } from "@/lib/api-security";
import {
  encryptLinkName,
  parseStoredValue,
} from "@/lib/server-crypto";

/**
 * Helper to decrypt avatar initials
 */
function decryptProfileAvatarInitials(storedInitials: string | null, userId: string): string | null {
  if (!storedInitials) return null;
  return parseStoredValue(storedInitials, userId, "avatar_initials") || storedInitials;
}

export const dynamic = "force-dynamic";

/**
 * Helper to decrypt profile display_name
 */
function decryptProfileDisplayName(storedName: string, userId: string): string {
  return parseStoredValue(storedName, userId, "profile_name") || storedName;
}

/**
 * Helper to encrypt link name
 */
function encryptLinkDisplayName(name: string, userId: string): string {
  const encrypted = encryptLinkName(name, userId);
  return JSON.stringify(encrypted);
}

/**
 * POST /api/links - Create a new link between two profiles
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { person1Id, person2Id } = body;

    // Validation
    if (!person1Id || !person2Id) {
      return NextResponse.json(
        { error: "Both person1Id and person2Id are required" },
        { status: 400 }
      );
    }

    if (person1Id === person2Id) {
      return NextResponse.json(
        { error: "Cannot link a person to themselves" },
        { status: 400 }
      );
    }

    // Verify both profiles exist and belong to the user
    const [profile1, profile2] = await Promise.all([
      getProfileById(person1Id),
      getProfileById(person2Id),
    ]);

    if (!profile1 || !profile2) {
      return NextResponse.json(
        { error: "One or both profiles not found" },
        { status: 404 }
      );
    }

    // Decrypt profile names (they may be encrypted)
    const decryptedName1 = decryptProfileDisplayName(profile1.display_name, profile1.user_id);
    const decryptedName2 = decryptProfileDisplayName(profile2.display_name, profile2.user_id);

    // Generate and encrypt link name
    const plaintextLinkName = `${decryptedName1} & ${decryptedName2}`;
    const encryptedLinkName = encryptLinkDisplayName(plaintextLinkName, user.id);

    // Create the link with encrypted name
    const link = await createLink({
      profile1_id: person1Id,
      profile2_id: person2Id,
      link_name: encryptedLinkName,
    });

    return NextResponse.json(
      {
        link: {
          id: link.id,
          displayName: plaintextLinkName, // Return plaintext
          person1: {
            id: profile1.id,
            displayName: decryptedName1,
            avatarInitials: decryptProfileAvatarInitials(profile1.avatar_initials, profile1.user_id),
            avatarColor: profile1.avatar_color,
            avatarPath: profile1.avatar_path,
          },
          person2: {
            id: profile2.id,
            displayName: decryptedName2,
            avatarInitials: decryptProfileAvatarInitials(profile2.avatar_initials, profile2.user_id),
            avatarColor: profile2.avatar_color,
            avatarPath: profile2.avatar_path,
          },
          prayerCount: link.prayer_count,
          createdAt: link.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating link:", error);
    return NextResponse.json(
      { error: "Failed to create link" },
      { status: 500 }
    );
  }
}
