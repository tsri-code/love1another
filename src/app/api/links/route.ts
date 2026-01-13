import { NextRequest, NextResponse } from "next/server";
import {
  createLink,
  getAuthenticatedUser,
  getProfileById,
} from "@/lib/supabase-db";
import { checkRateLimit, rateLimits, rateLimitedResponse } from "@/lib/api-security";

export const dynamic = "force-dynamic";

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

    // Create the link
    const link = await createLink({
      profile1_id: person1Id,
      profile2_id: person2Id,
      link_name: `${profile1.display_name} & ${profile2.display_name}`,
    });

    return NextResponse.json(
      {
        link: {
          id: link.id,
          displayName: link.link_name,
          person1: {
            id: profile1.id,
            displayName: profile1.display_name,
            avatarInitials: profile1.avatar_initials,
            avatarColor: profile1.avatar_color,
            avatarPath: profile1.avatar_path,
          },
          person2: {
            id: profile2.id,
            displayName: profile2.display_name,
            avatarInitials: profile2.avatar_initials,
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
