import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getLinkById } from "@/lib/supabase-db";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkRateLimit, rateLimits, rateLimitedResponse } from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/links/[id]/prayers - Get encrypted prayers for a link
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
    const link = await getLinkById(id);

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    return NextResponse.json({
      encryptedPrayers: link.encrypted_prayers,
      encryptionIv: link.encryption_iv,
      prayerCount: link.prayer_count,
    });
  } catch (error) {
    console.error("Error fetching link prayers:", error);
    return NextResponse.json(
      { error: "Failed to fetch prayers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/links/[id]/prayers - Update encrypted prayers for a link
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
    const body = await request.json();
    const { encryptedPrayers, encryptionIv, prayerCount } = body;

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from("links")
      .update({
        encrypted_prayers: encryptedPrayers,
        encryption_iv: encryptionIv,
        prayer_count: prayerCount ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating link prayers:", error);
      return NextResponse.json(
        { error: "Failed to update prayers" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating link prayers:", error);
    return NextResponse.json(
      { error: "Failed to update prayers" },
      { status: 500 }
    );
  }
}
