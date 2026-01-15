import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/users/e2ee-keys
 *
 * Fetch the E2EE keys for the authenticated user.
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

    // Fetch E2EE keys
    const { data, error } = await supabase
      .from("user_e2ee_keys")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned - user doesn't have E2EE keys
        return NextResponse.json(
          { error: "Not found" },
          { status: 404 }
        );
      }
      console.error("[E2EE Keys] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch E2EE keys" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      userId: data.user_id,
      version: data.version,
      wrappedDekPassword: data.wrapped_dek_password,
      passwordKdfSalt: data.password_kdf_salt,
      wrappedDekRecovery: data.wrapped_dek_recovery,
      recoveryKdfSalt: data.recovery_kdf_salt,
      encryptedRecoveryCode: data.encrypted_recovery_code,
      migrationState: data.migration_state,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    console.error("[E2EE Keys] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/e2ee-keys
 *
 * Create or update E2EE keys for the authenticated user.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // Security check: Only allow updating own data
    if (body.userId && body.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate required fields
    if (!body.wrappedDekPassword || !body.passwordKdfSalt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upsert E2EE keys
    const { error } = await supabase.from("user_e2ee_keys").upsert(
      {
        user_id: user.id,
        version: body.version || 1,
        wrapped_dek_password: body.wrappedDekPassword,
        password_kdf_salt: body.passwordKdfSalt,
        wrapped_dek_recovery: body.wrappedDekRecovery || null,
        recovery_kdf_salt: body.recoveryKdfSalt || null,
        encrypted_recovery_code: body.encryptedRecoveryCode || null,
        migration_state: body.migrationState || "upgraded",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      console.error("[E2EE Keys] Upsert error:", error);
      return NextResponse.json(
        { error: "Failed to save E2EE keys" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[E2EE Keys] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/e2ee-keys
 *
 * Update migration state or specific fields.
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();

    // Security check: Only allow updating own data
    if (body.userId && body.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.migrationState) {
      updateData.migration_state = body.migrationState;
    }
    if (body.wrappedDekPassword) {
      updateData.wrapped_dek_password = body.wrappedDekPassword;
    }
    if (body.passwordKdfSalt) {
      updateData.password_kdf_salt = body.passwordKdfSalt;
    }
    if (body.encryptedRecoveryCode) {
      updateData.encrypted_recovery_code = body.encryptedRecoveryCode;
    }

    const { error } = await supabase
      .from("user_e2ee_keys")
      .update(updateData)
      .eq("user_id", user.id);

    if (error) {
      console.error("[E2EE Keys] Update error:", error);
      return NextResponse.json(
        { error: "Failed to update E2EE keys" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[E2EE Keys] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
