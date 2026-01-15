import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/migration/profiles
 *
 * Fetch all profiles and links with encrypted prayers for a user.
 * Used during migration to re-encrypt all data with the new DEK.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedUserId = request.nextUrl.searchParams.get("userId");

    // Security check: Only allow fetching own data
    if (requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results: Array<{
      profileId: string;
      profileType: "person" | "link";
      encryptedPrayers: string;
      encryptionIv: string;
    }> = [];

    // Fetch profiles owned by user
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, encrypted_prayers, encryption_iv")
      .eq("user_id", user.id)
      .not("encrypted_prayers", "is", null);

    if (profilesError) {
      console.error("[Migration] Failed to fetch profiles:", profilesError);
    } else if (profiles) {
      for (const profile of profiles) {
        if (profile.encrypted_prayers && profile.encryption_iv) {
          results.push({
            profileId: profile.id,
            profileType: "person",
            encryptedPrayers: profile.encrypted_prayers,
            encryptionIv: profile.encryption_iv,
          });
        }
      }
    }

    // Fetch profile links where user owns the profile
    // First, get all profile IDs owned by user
    const { data: userProfiles, error: userProfilesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id);

    if (userProfilesError) {
      console.error(
        "[Migration] Failed to fetch user profiles:",
        userProfilesError
      );
    } else if (userProfiles && userProfiles.length > 0) {
      const profileIds = userProfiles.map((p: { id: string }) => p.id);

      // Fetch links where user's profile is involved
      const { data: links, error: linksError } = await supabase
        .from("profile_links")
        .select("id, encrypted_prayers, encryption_iv")
        .or(`profile1_id.in.(${profileIds.join(",")}),profile2_id.in.(${profileIds.join(",")})`)
        .not("encrypted_prayers", "is", null);

      if (linksError) {
        console.error("[Migration] Failed to fetch links:", linksError);
      } else if (links) {
        for (const link of links) {
          if (link.encrypted_prayers && link.encryption_iv) {
            results.push({
              profileId: link.id,
              profileType: "link",
              encryptedPrayers: link.encrypted_prayers,
              encryptionIv: link.encryption_iv,
            });
          }
        }
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("[Migration] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
