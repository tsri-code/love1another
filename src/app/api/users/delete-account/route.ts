import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/supabase-db";
import {
  checkRateLimit,
  rateLimits,
  rateLimitedResponse,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/users/delete-account - Delete the current user's account and all data
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, rateLimits.write);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();
    const userId = user.id;

    // Delete all user data in order (respecting foreign keys)

    // 1. Delete messages where user is sender
    await supabase.from("messages").delete().eq("sender_id", userId);

    // 2. Delete conversations where user is participant
    await supabase
      .from("conversations")
      .delete()
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    // 3. Delete friendships
    await supabase
      .from("friendships")
      .delete()
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    // 4. Delete connections
    await supabase
      .from("connections")
      .delete()
      .or(`owner_user_id.eq.${userId},connected_user_id.eq.${userId}`);

    // 5. Get all profiles owned by user
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId);

    if (profiles && profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);

      // 6. Delete links associated with user's profiles
      await supabase
        .from("links")
        .delete()
        .or(
          `profile1_id.in.(${profileIds.join(
            ","
          )}),profile2_id.in.(${profileIds.join(",")})`
        );

      // 7. Delete profiles
      await supabase.from("profiles").delete().eq("user_id", userId);
    }

    // 8. Delete user keys
    await supabase.from("user_keys").delete().eq("user_id", userId);

    // 9. Delete the auth user using admin client
    try {
      const adminClient = createAdminSupabaseClient();
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      
      if (authDeleteError) {
        console.error("Error deleting auth user:", authDeleteError);
        // Continue anyway - data is already deleted
      }
    } catch (adminError) {
      console.error("Admin client error:", adminError);
      // Continue anyway - data is already deleted
    }

    return NextResponse.json({
      success: true,
      message: "Account and all data deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
