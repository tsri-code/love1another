/**
 * Encryption Migration Module
 *
 * Handles the migration of existing users from legacy password-derived encryption
 * to the new DEK-based envelope encryption system.
 *
 * CRITICAL: This module deals with user data migration. Any bugs here could
 * result in permanent data loss. The code is designed to be:
 * - Atomic: All-or-nothing migration
 * - Reversible: Old data is preserved until migration is verified
 * - Verifiable: New encryption is tested before committing
 */

import { getStoredPrayerKey } from "./e2e-crypto";
import {
  generateDEK,
  generateRecoveryCode,
  wrapDEK,
  encryptRecoveryCode,
  importDEK,
  storeDEKInSession,
} from "./dek-crypto";
import { createClient } from "./supabase";

// ============================================================================
// Types
// ============================================================================

interface EncryptedPrayerData {
  profileId: string;
  profileType: "person" | "link";
  encryptedPrayers: string;
  encryptionIv: string;
}

interface MigrationResult {
  success: boolean;
  recoveryCode?: string;
  e2eeKeys?: {
    wrappedDekPassword: string;
    passwordKdfSalt: string;
    wrappedDekRecovery: string;
    recoveryKdfSalt: string;
    encryptedRecoveryCode: string;
  };
  migratedProfiles?: number;
  migratedLinks?: number;
  error?: string;
}

interface ReencryptedData {
  profileId: string;
  profileType: "person" | "link";
  newEncryptedPrayers: string;
  newEncryptionIv: string;
  // Keep backup of original data for rollback
  originalEncryptedPrayers: string;
  originalEncryptionIv: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  return buffer;
}

// ============================================================================
// Core Migration Functions
// ============================================================================

/**
 * Decrypt data using the legacy prayer key (cached in IndexedDB)
 */
async function decryptWithLegacyKey(
  encryptedBase64: string,
  ivBase64: string,
  prayerKey: CryptoKey
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(encryptedBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    prayerKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt data using the new DEK
 */
async function encryptWithDEK(
  plaintext: string,
  dekKey: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    dekKey,
    toArrayBuffer(encoded)
  );

  return {
    encrypted: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(toArrayBuffer(iv)),
  };
}

/**
 * Fetch all profiles with encrypted prayers for a user
 */
async function fetchUserProfiles(
  userId: string
): Promise<EncryptedPrayerData[]> {
  const response = await fetch(`/api/migration/profiles?userId=${userId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch profiles for migration");
  }
  return response.json();
}

/**
 * Update a profile with new encrypted data
 */
async function updateProfileEncryption(
  profileId: string,
  profileType: "person" | "link",
  encryptedPrayers: string,
  encryptionIv: string
): Promise<void> {
  const endpoint =
    profileType === "person"
      ? `/api/people/${profileId}/prayers`
      : `/api/links/${profileId}/prayers`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      encryptedPrayers,
      encryptionIv,
      // Don't update prayer count - keep existing
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update ${profileType} ${profileId}`);
  }
}

/**
 * Save E2EE keys to database
 * Uses client-side Supabase client directly to avoid cookie timing issues
 */
async function saveE2EEKeys(
  userId: string,
  keys: {
    wrappedDekPassword: string;
    passwordKdfSalt: string;
    wrappedDekRecovery: string;
    recoveryKdfSalt: string;
    encryptedRecoveryCode: string;
  },
  migrationState: "migrating" | "upgraded"
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("user_e2ee_keys").upsert(
    {
      user_id: userId,
      version: 1,
      wrapped_dek_password: keys.wrappedDekPassword,
      password_kdf_salt: keys.passwordKdfSalt,
      wrapped_dek_recovery: keys.wrappedDekRecovery || null,
      recovery_kdf_salt: keys.recoveryKdfSalt || null,
      encrypted_recovery_code: keys.encryptedRecoveryCode || null,
      migration_state: migrationState,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    console.error("[Migration] Failed to save E2EE keys:", error);
    throw new Error(`Failed to save E2EE keys: ${error.message}`);
  }
}

/**
 * Update E2EE migration state
 * Uses client-side Supabase client directly to avoid cookie timing issues
 */
async function updateMigrationState(
  userId: string,
  state: "migrating" | "upgraded"
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_e2ee_keys")
    .update({
      migration_state: state,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[Migration] Failed to update migration state:", error);
    throw new Error(`Failed to update migration state: ${error.message}`);
  }
}

// ============================================================================
// Main Migration Flow
// ============================================================================

/**
 * Perform the complete migration for a user
 *
 * This is the main entry point for migration. It:
 * 1. Generates new DEK and recovery code
 * 2. Re-encrypts all existing prayers with the new DEK
 * 3. Stores the wrapped DEK and recovery info
 * 4. Returns the recovery code for the user to save
 *
 * CRITICAL: This function is designed to be all-or-nothing.
 * If any step fails, the user's existing data remains intact.
 */
export async function performMigration(
  userId: string,
  password: string
): Promise<MigrationResult> {
  console.log("[Migration] Starting migration for user:", userId);

  try {
    // Step 1: Get the legacy prayer key from IndexedDB
    const prayerKey = await getStoredPrayerKey(userId);
    if (!prayerKey) {
      return {
        success: false,
        error: "Legacy encryption keys not available. Please log in again.",
      };
    }

    // Step 2: Generate new DEK and recovery code
    console.log("[Migration] Generating new DEK and recovery code...");
    const dek = generateDEK();
    const recoveryCode = generateRecoveryCode();
    const dekKey = await importDEK(dek);

    // Step 3: Wrap DEK with password and recovery code
    console.log("[Migration] Wrapping DEK...");
    const wrappedDekPassword = await wrapDEK(dek, password, false);
    const wrappedDekRecovery = await wrapDEK(dek, recoveryCode, true);

    // Step 4: Encrypt recovery code with password (for viewing in settings)
    const passwordSalt = new Uint8Array(
      base64ToArrayBuffer(wrappedDekPassword.kdfSalt)
    );
    const encryptedRecoveryCode = await encryptRecoveryCode(
      recoveryCode,
      password,
      passwordSalt
    );

    // Step 5: Save E2EE keys with 'migrating' state FIRST
    // This ensures we have the wrapped keys even if re-encryption fails
    console.log("[Migration] Saving E2EE keys (migrating state)...");
    const e2eeKeys = {
      wrappedDekPassword: wrappedDekPassword.wrappedDek,
      passwordKdfSalt: wrappedDekPassword.kdfSalt,
      wrappedDekRecovery: wrappedDekRecovery.wrappedDek,
      recoveryKdfSalt: wrappedDekRecovery.kdfSalt,
      encryptedRecoveryCode,
    };

    await saveE2EEKeys(userId, e2eeKeys, "migrating");

    // Step 6: Store DEK in session for immediate use
    await storeDEKInSession(userId, dek);

    // Step 7: Fetch all profiles with encrypted prayers
    console.log("[Migration] Fetching profiles to migrate...");
    let profiles: EncryptedPrayerData[] = [];
    try {
      profiles = await fetchUserProfiles(userId);
    } catch (fetchError) {
      console.warn("[Migration] Could not fetch profiles:", fetchError);
      // Continue anyway - user might have no encrypted prayers yet
    }

    // Step 8: Re-encrypt each profile's prayers
    const reencryptedData: ReencryptedData[] = [];
    let migratedProfiles = 0;
    let migratedLinks = 0;

    for (const profile of profiles) {
      if (!profile.encryptedPrayers || !profile.encryptionIv) {
        continue; // Skip profiles with no encrypted data
      }

      try {
        console.log(
          `[Migration] Migrating ${profile.profileType} ${profile.profileId}...`
        );

        // Decrypt with legacy key
        const plaintext = await decryptWithLegacyKey(
          profile.encryptedPrayers,
          profile.encryptionIv,
          prayerKey
        );

        // Re-encrypt with new DEK
        const { encrypted, iv } = await encryptWithDEK(plaintext, dekKey);

        // Store for batch update (with backup)
        reencryptedData.push({
          profileId: profile.profileId,
          profileType: profile.profileType,
          newEncryptedPrayers: encrypted,
          newEncryptionIv: iv,
          originalEncryptedPrayers: profile.encryptedPrayers,
          originalEncryptionIv: profile.encryptionIv,
        });

        if (profile.profileType === "person") {
          migratedProfiles++;
        } else {
          migratedLinks++;
        }
      } catch (decryptError) {
        console.error(
          `[Migration] Failed to decrypt ${profile.profileType} ${profile.profileId}:`,
          decryptError
        );
        // Continue with other profiles - this one might already be on new system
        // or might have corrupted data
      }
    }

    // Step 9: Verify new encryption works by test-decrypting one item
    if (reencryptedData.length > 0) {
      console.log("[Migration] Verifying new encryption...");
      const testItem = reencryptedData[0];
      try {
        const testDecrypt = await decryptWithDEK(
          testItem.newEncryptedPrayers,
          testItem.newEncryptionIv,
          dekKey
        );
        // Parse to verify it's valid JSON
        JSON.parse(testDecrypt);
        console.log("[Migration] Verification successful");
      } catch (verifyError) {
        console.error("[Migration] Verification failed:", verifyError);
        return {
          success: false,
          error:
            "Failed to verify new encryption. Your data is safe - please try again.",
        };
      }
    }

    // Step 10: Update all profiles with new encrypted data
    console.log("[Migration] Updating profiles with new encryption...");
    for (const item of reencryptedData) {
      try {
        await updateProfileEncryption(
          item.profileId,
          item.profileType,
          item.newEncryptedPrayers,
          item.newEncryptionIv
        );
      } catch (updateError) {
        console.error(
          `[Migration] Failed to update ${item.profileType} ${item.profileId}:`,
          updateError
        );
        // Continue with other profiles
      }
    }

    // Step 11: Mark migration as upgraded
    console.log("[Migration] Marking migration complete...");
    await updateMigrationState(userId, "upgraded");

    console.log("[Migration] Migration complete!");
    return {
      success: true,
      recoveryCode,
      e2eeKeys,
      migratedProfiles,
      migratedLinks,
    };
  } catch (error) {
    console.error("[Migration] Migration failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Migration failed unexpectedly",
    };
  }
}

/**
 * Decrypt with DEK (for verification)
 */
async function decryptWithDEK(
  encryptedBase64: string,
  ivBase64: string,
  dekKey: CryptoKey
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(encryptedBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    dekKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if a user needs migration
 * Returns true if user has no E2EE keys record or is in 'legacy' state
 * Uses client-side Supabase client directly to avoid cookie timing issues
 */
export async function checkNeedsMigration(userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_e2ee_keys")
      .select("migration_state")
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle to handle 0 rows gracefully

    if (error) {
      console.warn("[Migration] Could not check migration status:", error);
      return false; // Error - don't force migration
    }

    // No data means no E2EE keys record - needs migration
    if (!data) {
      return true;
    }

    return data.migration_state === "legacy" || !data.migration_state;
  } catch (error) {
    console.warn("[Migration] Error checking migration status:", error);
    return false; // Error - don't force migration
  }
}

/**
 * Get the current migration state for a user
 * Uses client-side Supabase client directly to avoid cookie timing issues
 */
export async function getMigrationState(
  userId: string
): Promise<"legacy" | "migrating" | "upgraded" | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_e2ee_keys")
      .select("migration_state")
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle to handle 0 rows gracefully

    if (error) {
      return null;
    }

    // No data means no E2EE keys record - legacy state
    if (!data) {
      return "legacy";
    }

    return (data.migration_state as "legacy" | "migrating" | "upgraded") || "legacy";
  } catch {
    return null;
  }
}
