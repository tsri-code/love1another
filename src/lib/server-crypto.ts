/**
 * Server-side encryption utilities for Love1Another
 * 
 * This module provides server-side encryption for sensitive data.
 * It uses AES-256-GCM with keys derived from a server secret.
 * 
 * Security Model:
 * - Protects data at rest in the database
 * - Keys are derived per-entity (conversation, profile, etc.)
 * - Server can encrypt/decrypt (necessary for server-side operations)
 * - Database breach alone cannot reveal plaintext
 * 
 * For higher security (true E2E), client-side encryption should be used.
 * This is a practical solution that provides good protection for most use cases.
 */

import crypto from "crypto";

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Get the server encryption secret from environment
 * Falls back to a development key if not set (NOT FOR PRODUCTION)
 */
function getServerSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    // Development fallback - MUST be set in production
    console.warn("WARNING: ENCRYPTION_SECRET not set. Using development key.");
    return "dev-secret-key-do-not-use-in-production-12345";
  }
  return secret;
}

/**
 * Derive a unique encryption key for a specific context
 * 
 * @param contextId - Unique identifier (e.g., conversation ID, profile ID)
 * @param contextType - Type of data being encrypted (e.g., "message", "profile")
 * @returns 256-bit encryption key
 */
function deriveKey(contextId: string, contextType: string): Buffer {
  const secret = getServerSecret();
  // Use HKDF-like derivation: HMAC-SHA256(secret, contextType + contextId)
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${contextType}:${contextId}`);
  return hmac.digest();
}

// ============================================================================
// Encryption / Decryption
// ============================================================================

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  tag: string; // Base64 encoded auth tag
  version: string; // Encryption version for future upgrades
}

/**
 * Encrypt plaintext using a context-specific key
 * 
 * @param plaintext - Text to encrypt
 * @param contextId - Unique context identifier
 * @param contextType - Type of context
 * @returns Encrypted payload with IV and auth tag
 */
export function encrypt(
  plaintext: string,
  contextId: string,
  contextType: string
): EncryptedPayload {
  const key = deriveKey(contextId, contextType);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  
  const tag = cipher.getAuthTag();
  
  return {
    ciphertext,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    version: "srv_v1", // Server-side encryption v1
  };
}

/**
 * Decrypt ciphertext using a context-specific key
 * 
 * @param encrypted - Encrypted payload
 * @param contextId - Unique context identifier
 * @param contextType - Type of context
 * @returns Decrypted plaintext
 */
export function decrypt(
  encrypted: EncryptedPayload,
  contextId: string,
  contextType: string
): string {
  const key = deriveKey(contextId, contextType);
  const iv = Buffer.from(encrypted.iv, "base64");
  const tag = Buffer.from(encrypted.tag, "base64");
  const ciphertext = Buffer.from(encrypted.ciphertext, "base64");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  
  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);
  
  return plaintext.toString("utf8");
}

// ============================================================================
// Convenience Functions for Specific Data Types
// ============================================================================

/**
 * Encrypt a message for storage
 */
export function encryptMessage(content: string, conversationId: string): EncryptedPayload {
  return encrypt(content, conversationId, "message");
}

/**
 * Decrypt a message from storage
 */
export function decryptMessage(encrypted: EncryptedPayload, conversationId: string): string {
  return decrypt(encrypted, conversationId, "message");
}

/**
 * Encrypt a profile display name
 */
export function encryptProfileName(name: string, profileId: string): EncryptedPayload {
  return encrypt(name, profileId, "profile_name");
}

/**
 * Decrypt a profile display name
 */
export function decryptProfileName(encrypted: EncryptedPayload, profileId: string): string {
  return decrypt(encrypted, profileId, "profile_name");
}

/**
 * Encrypt a link name
 */
export function encryptLinkName(name: string, linkId: string): EncryptedPayload {
  return encrypt(name, linkId, "link_name");
}

/**
 * Decrypt a link name
 */
export function decryptLinkName(encrypted: EncryptedPayload, linkId: string): string {
  return decrypt(encrypted, linkId, "link_name");
}

/**
 * Encrypt avatar initials
 */
export function encryptAvatarInitials(initials: string, contextId: string): EncryptedPayload {
  return encrypt(initials, contextId, "avatar_initials");
}

/**
 * Decrypt avatar initials
 */
export function decryptAvatarInitials(encrypted: EncryptedPayload, contextId: string): string {
  return decrypt(encrypted, contextId, "avatar_initials");
}

/**
 * Check if a value looks like an encrypted payload
 * Used for backward compatibility with plaintext data
 */
export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.ciphertext === "string" &&
    typeof obj.iv === "string" &&
    typeof obj.tag === "string" &&
    typeof obj.version === "string"
  );
}

/**
 * Parse a stored value that might be encrypted or plaintext
 * Returns the plaintext value, decrypting if necessary
 */
export function parseStoredValue(
  storedValue: string | null,
  contextId: string,
  contextType: string
): string | null {
  if (!storedValue) return null;
  
  // Try to parse as JSON (encrypted payload)
  try {
    const parsed = JSON.parse(storedValue);
    if (isEncryptedPayload(parsed)) {
      return decrypt(parsed, contextId, contextType);
    }
  } catch {
    // Not JSON, treat as plaintext (legacy data)
  }
  
  // Return as plaintext (legacy or already decrypted)
  return storedValue;
}

/**
 * Store a value, encrypting it
 * Returns a JSON string of the encrypted payload
 */
export function storeEncryptedValue(
  value: string,
  contextId: string,
  contextType: string
): string {
  const encrypted = encrypt(value, contextId, contextType);
  return JSON.stringify(encrypted);
}
