import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/check-email - Check if an email is already registered
 * Query params:
 * - email: the email to check
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.read);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        available: false,
        error: "Invalid email format",
      });
    }

    // Use admin client to check if email exists
    const adminClient = createAdminSupabaseClient();
    
    // Try to get user by email using admin API
    // We'll use listUsers with a filter approach
    const { data: { users }, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000, // Get enough users to search
    });

    if (error) {
      console.error("Error checking email:", error);
      // On error, allow signup to continue (Supabase will handle duplicate)
      return NextResponse.json({ available: true });
    }

    // Check if any user has this email
    const emailExists = users?.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    return NextResponse.json({
      available: !emailExists,
      error: emailExists ? "This email is already registered" : undefined,
    });
  } catch (error) {
    console.error("Error checking email:", error);
    return NextResponse.json(
      { error: "Failed to check email availability" },
      { status: 500 }
    );
  }
}
