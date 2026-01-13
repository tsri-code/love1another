import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/lookup-by-username - Look up email by username (for login)
 * This is a public endpoint (no auth required) but rate limited
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.login);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    if (username.length < 5) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Look up email by username using RPC
    const { data, error } = await supabase.rpc("get_email_by_username", {
      lookup_username: username,
    });

    if (error) {
      console.error("Error looking up username:", error);
      // Return generic error to not reveal if username exists
      return NextResponse.json({ email: null });
    }

    // Return email if found (this is safe because the caller still needs the password)
    return NextResponse.json({ email: data || null });
  } catch (error) {
    console.error("Error in username lookup:", error);
    return NextResponse.json({ email: null });
  }
}
