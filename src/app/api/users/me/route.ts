import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-db";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/me - Get current user's info
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

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || "",
        username:
          user.user_metadata?.username || user.email?.split("@")[0] || "",
        avatarInitials: user.user_metadata?.avatar_initials || null,
        avatarColor: user.user_metadata?.avatar_color || null,
        avatarPath: user.user_metadata?.avatar_path || null,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/me - Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.profile);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { fullName, username, email, avatarPath } = body;

    const supabase = await createServerSupabaseClient();

    // Build update data
    const updateData: Record<string, string | null> = {};
    if (fullName?.trim()) {
      updateData.full_name = fullName.trim();
    }
    // Handle avatar path (URL from Supabase Storage)
    if (avatarPath !== undefined) {
      updateData.avatar_path = avatarPath;
    }
    if (username?.trim()) {
      const normalizedUsername = username.trim().toLowerCase();

      // Validate username format
      if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
        return NextResponse.json(
          {
            error:
              "Username can only contain lowercase letters, numbers, and underscores",
          },
          { status: 400 }
        );
      }
      if (normalizedUsername.length < 5) {
        return NextResponse.json(
          { error: "Username must be at least 5 characters" },
          { status: 400 }
        );
      }
      if (normalizedUsername.length > 30) {
        return NextResponse.json(
          { error: "Username must be 30 characters or less" },
          { status: 400 }
        );
      }

      // Check if username changed
      const currentUsername = user.user_metadata?.username?.toLowerCase();
      if (normalizedUsername !== currentUsername) {
        // Check if new username is available
        const { data: isAvailable, error: rpcError } = await supabase.rpc(
          "check_username_available",
          { check_username: normalizedUsername }
        );

        if (rpcError) {
          console.error("Error checking username:", rpcError);
          return NextResponse.json(
            { error: "Failed to verify username availability" },
            { status: 500 }
          );
        }

        if (!isAvailable) {
          return NextResponse.json(
            { error: "Username is already taken" },
            { status: 400 }
          );
        }
      }

      updateData.username = normalizedUsername;
    }

    // Update user metadata
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: updateData,
      });

      if (updateError) {
        console.error("Error updating user metadata:", updateError);
        return NextResponse.json(
          { error: "Failed to update profile" },
          { status: 500 }
        );
      }
    }

    // Update email if changed (requires re-verification)
    if (email && email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: email.trim(),
      });

      if (emailError) {
        console.error("Error updating email:", emailError);
        return NextResponse.json(
          { error: emailError.message || "Failed to update email" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
