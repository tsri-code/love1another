import { NextRequest, NextResponse } from "next/server";
import { getAllProfiles, getAuthenticatedUser } from "@/lib/supabase-db";
import { checkRateLimit, rateLimits, rateLimitedResponse } from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/people/available - Get all people available for linking
 * Returns all profiles owned by the authenticated user (type: person only)
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

    // Filter to only include "person" type profiles (not groups)
    // Groups can't be linked with other profiles
    const people = profiles
      .filter((p) => p.type === "person")
      .map((p) => ({
        id: p.id,
        displayName: p.display_name,
        type: p.type,
        avatarPath: p.avatar_path,
        avatarInitials: p.avatar_initials,
        avatarColor: p.avatar_color,
      }));

    return NextResponse.json({ people });
  } catch (error) {
    console.error("Error fetching available people:", error);
    return NextResponse.json(
      { error: "Failed to fetch available people" },
      { status: 500 }
    );
  }
}
