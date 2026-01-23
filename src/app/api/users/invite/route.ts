import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-db";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * POST /api/users/invite - Send an invitation email to a friend
 * Uses Supabase Admin API to send invite emails with custom data
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.write);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { email, inviterName, inviterUsername } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Create admin Supabase client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Send invite using Supabase Admin API
    // The invite will use the "Invite user" email template
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_by: user.id,
        inviter_name: inviterName || "A friend",
        inviter_username: inviterUsername || "",
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://love1another.app"}/login?invited_by=${inviterUsername}`,
    });

    if (error) {
      console.error("Error sending invite:", error);
      
      // Check for specific errors
      if (error.message.includes("already registered")) {
        return NextResponse.json(
          { error: "This email is already registered. They can add you as a friend in the app!" },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to send invitation. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in invite route:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}
