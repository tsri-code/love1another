import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/check-username - Check if a username is available
 * Query params:
 * - username: the username to check
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.read);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim().toLowerCase();

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // Validate username format
    if (username.length < 5) {
      return NextResponse.json({
        available: false,
        error: "Username must be at least 5 characters",
      });
    }

    if (username.length > 30) {
      return NextResponse.json({
        available: false,
        error: "Username must be 30 characters or less",
      });
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json({
        available: false,
        error:
          "Username can only contain lowercase letters, numbers, and underscores",
      });
    }

    // Reserved usernames that can't be used
    const reservedUsernames = [
      "admin",
      "administrator",
      "support",
      "help",
      "system",
      "love1another",
      "moderator",
      "official",
      "staff",
      "root",
      "null",
      "undefined",
      "anonymous",
      "user",
      "guest",
    ];

    if (reservedUsernames.includes(username)) {
      return NextResponse.json({
        available: false,
        error: "This username is reserved",
      });
    }

    const supabase = await createServerSupabaseClient();

    // Check if username exists in auth.users metadata using RPC
    const { data, error } = await supabase.rpc("check_username_available", {
      check_username: username,
    });

    if (error) {
      // If function doesn't exist, try alternative check
      console.error("RPC error:", error);
      // Fallback - assume available if we can't check
      return NextResponse.json({ available: true });
    }

    return NextResponse.json({
      available: data === true,
      error: data === true ? undefined : "Username is already taken",
    });
  } catch (error) {
    console.error("Error checking username:", error);
    return NextResponse.json(
      { error: "Failed to check username availability" },
      { status: 500 }
    );
  }
}
