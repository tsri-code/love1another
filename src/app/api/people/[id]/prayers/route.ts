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
 * GET /api/people/[id]/prayers - Get encrypted prayers data
 *
 * Returns the encrypted prayers blob - decryption happens client-side
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request, rateLimits.prayer);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, encrypted_prayers, encryption_iv, prayer_count")
      .eq("id", id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Return encrypted data - client will decrypt
    return NextResponse.json({
      encryptedPrayers: profile.encrypted_prayers,
      encryptionIv: profile.encryption_iv,
      prayerCount: profile.prayer_count,
    });
  } catch (error) {
    console.error("Error fetching prayers:", error);
    return NextResponse.json(
      { error: "Failed to fetch prayers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/[id]/prayers - Save encrypted prayers data
 *
 * Receives encrypted prayers blob from client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request, rateLimits.prayer);
    if (rateLimit.limited) {
      return rateLimitedResponse(rateLimit.resetAt);
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Verify profile exists and belongs to user
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const { encryptedPrayers, encryptionIv, prayerCount, lastPrayedAt } = body;

    if (!encryptedPrayers || !encryptionIv) {
      return NextResponse.json(
        { error: "Encrypted prayers data is required" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      encrypted_prayers: encryptedPrayers,
      encryption_iv: encryptionIv,
      prayer_count: prayerCount ?? 0,
      updated_at: new Date().toISOString(),
    };

    // Only update last_prayed_at if provided
    if (lastPrayedAt) {
      updateData.last_prayed_at = lastPrayedAt;
    }

    // Update profile with encrypted prayers
    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Error updating prayers:", updateError);
      return NextResponse.json(
        { error: "Failed to save prayers" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving prayers:", error);
    return NextResponse.json(
      { error: "Failed to save prayers" },
      { status: 500 }
    );
  }
}
