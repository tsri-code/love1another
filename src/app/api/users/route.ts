import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, searchUsers } from "@/lib/supabase-db";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/users - Search for users
 * Query params:
 * - q: search query (username, email, or full name)
 * - exclude: user ID to exclude from results (usually current user)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.read);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const excludeUserId = searchParams.get("exclude") || user.id;

    if (query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await searchUsers(query, excludeUserId);

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        fullName: u.full_name,
        avatarInitials: u.avatar_initials,
        avatarColor: u.avatar_color,
        avatarPath: u.effective_avatar_path, // Use effective avatar (profile > user)
      })),
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
