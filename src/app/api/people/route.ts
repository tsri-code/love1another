import { NextRequest, NextResponse } from "next/server";
import {
  getAllProfiles,
  createProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-db";
import { getInitials } from "@/lib/utils";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
  validateContent,
} from "@/lib/api-security";
import {
  encryptProfileName,
  encryptAvatarInitials,
  parseStoredValue,
} from "@/lib/server-crypto";
import { PRAYER_VERSES } from "@/lib/verses";
import { randomInt } from "crypto";

/**
 * Helper to decrypt profile display_name, handling both encrypted and legacy plaintext
 * Uses the profile owner's user_id as context (available from the profile record)
 */
function decryptProfileDisplayName(storedName: string, userId: string): string {
  return parseStoredValue(storedName, userId, "profile_name") || storedName;
}

/**
 * Helper to encrypt profile display_name
 * Uses the profile owner's user_id as context
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

// Prevent caching on sensitive routes
export const dynamic = "force-dynamic";

/**
 * GET /api/people - List all profiles for the authenticated user
 */
export async function GET(request: NextRequest) {
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

    const profiles = await getAllProfiles();

    // Decrypt display names and transform to frontend format
    const decryptedProfiles = profiles.map((p) => ({
      ...p,
      decryptedName: decryptProfileDisplayName(p.display_name, p.user_id),
    }));

    // Sort by last name (last word in decrypted display_name)
    const sortedProfiles = [...decryptedProfiles].sort((a, b) => {
      const getLastName = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return parts[parts.length - 1].toLowerCase();
      };
      return getLastName(a.decryptedName).localeCompare(
        getLastName(b.decryptedName)
      );
    });

    // Transform to match existing frontend expectations
    const people = sortedProfiles.map((p) => ({
      id: p.id,
      displayName: p.decryptedName,
      type: p.type,
      avatarPath: p.avatar_path,
      avatarInitials: decryptProfileAvatarInitials(p.avatar_initials, p.user_id),
      avatarColor: p.avatar_color,
      verseId: p.verse_id,
      prayerCount: p.prayer_count,
      lastPrayedAt: p.last_prayed_at,
    }));

    return NextResponse.json({ people });
  } catch (error) {
    console.error("Error fetching people:", error);
    return NextResponse.json(
      { error: "Failed to fetch people" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people - Create a new person or group
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { displayName, type, avatarInitials, avatarColor, avatarPath, isSelfProfile } = body;

    // Validation
    if (
      !displayName ||
      typeof displayName !== "string" ||
      displayName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }

    // Validate content for safety
    const contentCheck = validateContent(displayName);
    if (!contentCheck.valid) {
      return NextResponse.json({ error: contentCheck.error }, { status: 400 });
    }

    // Length validation
    if (displayName.length > 100) {
      return NextResponse.json(
        { error: "Display name too long (max 100 characters)" },
        { status: 400 }
      );
    }

    const validTypes = ["person", "group"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "person" or "group"' },
        { status: 400 }
      );
    }

    // Encrypt display name and avatar initials before storing
    const encryptedDisplayName = encryptProfileDisplayName(displayName.trim(), user.id);
    const plaintextInitials = avatarInitials || getInitials(displayName);
    const encryptedInitials = encryptProfileAvatarInitials(plaintextInitials, user.id);

    // Generate a truly random verse ID for the profile using crypto
    // This ensures unpredictable distribution across all verses
    const randomVerseId = randomInt(1, PRAYER_VERSES.length + 1);

    // Create profile in Supabase with encrypted name and initials
    const profile = await createProfile({
      display_name: encryptedDisplayName,
      type,
      avatar_initials: encryptedInitials,
      avatar_color: avatarColor || generateRandomColor(),
      avatar_path: avatarPath || null,
      is_self_profile: isSelfProfile || false,
      verse_id: randomVerseId,
    });

    // Return in format frontend expects (with plaintext values, not encrypted)
    return NextResponse.json(
      {
        person: {
          id: profile.id,
          displayName: displayName.trim(), // Return the original plaintext name
          type: profile.type,
          avatarPath: profile.avatar_path,
          avatarInitials: plaintextInitials, // Return the original plaintext initials
          avatarColor: profile.avatar_color,
          verseId: profile.verse_id,
          prayerCount: profile.prayer_count,
          createdAt: profile.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating person:", error);
    return NextResponse.json(
      { error: "Failed to create person" },
      { status: 500 }
    );
  }
}

function generateRandomColor(): string {
  const colors = [
    "#e57373",
    "#f06292",
    "#ba68c8",
    "#9575cd",
    "#7986cb",
    "#64b5f6",
    "#4fc3f7",
    "#4dd0e1",
    "#4db6ac",
    "#81c784",
    "#aed581",
    "#dce775",
    "#fff176",
    "#ffd54f",
    "#ffb74d",
    "#ff8a65",
    "#a1887f",
    "#90a4ae",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
