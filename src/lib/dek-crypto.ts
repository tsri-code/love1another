/**
 * DEK (Data Encryption Key) Envelope Encryption Module
 *
 * This module implements envelope encryption where:
 * - A random DEK is used to encrypt all user content
 * - The DEK is wrapped (encrypted) by Key Encryption Keys (KEKs)
 * - KEKs are derived from either password or recovery code
 * - Password reset only requires re-wrapping the DEK, not re-encrypting content
 *
 * Key Management:
 * - DEK: Random 256-bit AES key, never stored plaintext
 * - KEK_password: Derived from user password via PBKDF2
 * - KEK_recovery: Derived from 6-word recovery code via PBKDF2
 * - Recovery code can be encrypted with KEK_password for viewing in settings
 */

// ============================================================================
// Constants
// ============================================================================

const PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const SALT_LENGTH = 16; // 128 bits
const DEK_LENGTH = 32; // 256 bits

// BIP39-inspired wordlist (simplified subset of 256 words for 6-word codes)
// 6 words from 256 options = 48 bits of entropy (sufficient for recovery)
const WORDLIST = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
  "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address",
  "adjust", "admit", "adult", "advance", "advice", "affair", "afford", "afraid",
  "again", "agent", "agree", "ahead", "aim", "air", "alarm", "album",
  "alert", "alien", "allow", "almost", "alone", "alpha", "already", "also",
  "alter", "always", "amateur", "amazing", "among", "amount", "amused", "anchor",
  "ancient", "angel", "anger", "angle", "animal", "annual", "answer", "anxiety",
  "apart", "apple", "april", "arch", "area", "arena", "argue", "arise",
  "arm", "armor", "army", "around", "arrange", "arrest", "arrive", "arrow",
  "art", "artist", "ask", "aspect", "assault", "asset", "assist", "assume",
  "asthma", "athlete", "atom", "attack", "attend", "auction", "august", "aunt",
  "author", "auto", "autumn", "average", "avocado", "avoid", "awake", "aware",
  "away", "awesome", "baby", "bachelor", "bacon", "badge", "bag", "balance",
  "ball", "bamboo", "banana", "banner", "bar", "barely", "barrel", "base",
  "basic", "basket", "battle", "beach", "bean", "beauty", "become", "beef",
  "begin", "behave", "behind", "believe", "below", "belt", "bench", "benefit",
  "best", "betray", "better", "beyond", "bicycle", "bird", "birth", "bitter",
  "blade", "blame", "blanket", "blast", "bleak", "bless", "blind", "blood",
  "blossom", "blue", "blur", "blush", "board", "boat", "body", "boil",
  "bomb", "bone", "bonus", "book", "boost", "border", "boring", "borrow",
  "boss", "bottom", "bounce", "box", "boy", "bracket", "brain", "brand",
  "brave", "bread", "breeze", "brick", "bridge", "brief", "bright", "bring",
  "brisk", "broken", "bronze", "broom", "brother", "brown", "brush", "bubble",
  "buddy", "budget", "build", "bullet", "bundle", "burden", "burger", "burst",
  "bus", "butter", "buyer", "cabin", "cable", "cage", "cake", "call",
  "calm", "camera", "camp", "can", "canal", "cancel", "candle", "candy",
  "cannon", "canvas", "canyon", "capable", "capital", "captain", "carbon", "card",
  "cargo", "carpet", "carry", "cart", "case", "cash", "castle", "casual",
  "catalog", "catch", "cause", "caution", "cave", "ceiling", "celery", "cement",
  "census", "century", "cereal", "certain", "chair", "chalk", "champion", "chance",
  "change", "chaos", "chapter", "charge", "chase", "cheap", "check", "cheese",
];

// ============================================================================
// Types
// ============================================================================

export interface E2EEKeys {
  userId: string;
  version: number;
  wrappedDekPassword: string; // DEK wrapped with password KEK
  passwordKdfSalt: string;
  wrappedDekRecovery?: string; // DEK wrapped with recovery KEK
  recoveryKdfSalt?: string;
  encryptedRecoveryCode?: string; // Recovery code encrypted with password KEK
  migrationState: "legacy" | "migrating" | "upgraded";
}

export interface WrappedDEK {
  wrappedDek: string; // Base64 encoded (IV + ciphertext)
  kdfSalt: string; // Base64 encoded
}

// ============================================================================
// Utility Functions
// ============================================================================

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  return buffer;
}

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

function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

// ============================================================================
// DEK Generation
// ============================================================================

/**
 * Generate a new random Data Encryption Key (DEK)
 * This is the master key that encrypts all user content
 */
export function generateDEK(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(DEK_LENGTH));
}

/**
 * Import a raw DEK as a CryptoKey for use with Web Crypto API
 */
export async function importDEK(dekBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(dekBytes),
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true, // Extractable for wrapping
    ["encrypt", "decrypt"]
  );
}

// ============================================================================
// Recovery Code Generation
// ============================================================================

/**
 * Generate a 6-word recovery code from the wordlist
 * Provides ~48 bits of entropy (256^6 / log2 = 48)
 */
export function generateRecoveryCode(): string {
  const words: string[] = [];
  const randomBytes = crypto.getRandomValues(new Uint8Array(6));

  for (let i = 0; i < 6; i++) {
    const index = randomBytes[i] % WORDLIST.length;
    words.push(WORDLIST[index]);
  }

  return words.join(" ");
}

/**
 * Normalize a recovery code (lowercase, single spaces)
 */
export function normalizeRecoveryCode(code: string): string {
  return code.trim().toLowerCase().split(/\s+/).join(" ");
}

// ============================================================================
// Key Encryption Key (KEK) Derivation
// ============================================================================

/**
 * Derive a Key Encryption Key from a secret (password or recovery code)
 */
async function deriveKEK(
  secret: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false, // Not extractable
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"]
  );
}

/**
 * Derive KEK from password
 */
export async function deriveKEKFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  return deriveKEK(password, salt);
}

/**
 * Derive KEK from recovery code
 */
export async function deriveKEKFromRecoveryCode(
  recoveryCode: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const normalized = normalizeRecoveryCode(recoveryCode);
  return deriveKEK(normalized, salt);
}

// ============================================================================
// DEK Wrapping (Encryption of DEK with KEK)
// ============================================================================

/**
 * Wrap (encrypt) a DEK with a KEK
 * Returns the wrapped DEK and the salt used for key derivation
 */
export async function wrapDEK(
  dek: Uint8Array,
  secret: string,
  isRecoveryCode: boolean = false
): Promise<WrappedDEK> {
  const salt = generateSalt();
  const kek = isRecoveryCode
    ? await deriveKEKFromRecoveryCode(secret, salt)
    : await deriveKEKFromPassword(secret, salt);

  // Import DEK as CryptoKey for wrapping
  const dekKey = await importDEK(dek);

  // Use AES-GCM for wrapping (more widely supported than AES-KW)
  const iv = generateIV();
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    kek,
    toArrayBuffer(dek)
  );

  // Combine IV + wrapped key
  const combined = new Uint8Array(iv.length + wrapped.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrapped), iv.length);

  return {
    wrappedDek: arrayBufferToBase64(toArrayBuffer(combined)),
    kdfSalt: arrayBufferToBase64(toArrayBuffer(salt)),
  };
}

/**
 * Unwrap (decrypt) a DEK with a KEK
 */
export async function unwrapDEK(
  wrappedDekBase64: string,
  kdfSaltBase64: string,
  secret: string,
  isRecoveryCode: boolean = false
): Promise<Uint8Array> {
  const salt = new Uint8Array(base64ToArrayBuffer(kdfSaltBase64));
  const kek = isRecoveryCode
    ? await deriveKEKFromRecoveryCode(secret, salt)
    : await deriveKEKFromPassword(secret, salt);

  // Parse wrapped data
  const combined = new Uint8Array(base64ToArrayBuffer(wrappedDekBase64));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    kek,
    toArrayBuffer(ciphertext)
  );

  return new Uint8Array(decrypted);
}

// ============================================================================
// Recovery Code Encryption (for viewing in Settings)
// ============================================================================

/**
 * Encrypt the recovery code with the password KEK
 * This allows users to view their recovery code in settings by entering their password
 */
export async function encryptRecoveryCode(
  recoveryCode: string,
  password: string,
  passwordSalt: Uint8Array
): Promise<string> {
  const kek = await deriveKEKFromPassword(password, passwordSalt);
  const iv = generateIV();
  const plaintext = new TextEncoder().encode(recoveryCode);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    kek,
    toArrayBuffer(plaintext)
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(toArrayBuffer(combined));
}

/**
 * Decrypt the recovery code with the password KEK
 */
export async function decryptRecoveryCode(
  encryptedCodeBase64: string,
  password: string,
  passwordSaltBase64: string
): Promise<string> {
  const salt = new Uint8Array(base64ToArrayBuffer(passwordSaltBase64));
  const kek = await deriveKEKFromPassword(password, salt);

  const combined = new Uint8Array(base64ToArrayBuffer(encryptedCodeBase64));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    kek,
    toArrayBuffer(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

// ============================================================================
// Re-encryption Helpers (for password change)
// ============================================================================

/**
 * Re-wrap the DEK with a new password and re-encrypt the recovery code
 * Used when user changes password while logged in
 */
export async function rewrapDEKWithNewPassword(
  dek: Uint8Array,
  recoveryCode: string,
  newPassword: string
): Promise<{
  wrappedDekPassword: WrappedDEK;
  encryptedRecoveryCode: string;
}> {
  // Wrap DEK with new password
  const wrappedDekPassword = await wrapDEK(dek, newPassword, false);

  // Re-encrypt recovery code with new password
  const newSalt = new Uint8Array(
    base64ToArrayBuffer(wrappedDekPassword.kdfSalt)
  );
  const encryptedRecoveryCode = await encryptRecoveryCode(
    recoveryCode,
    newPassword,
    newSalt
  );

  return {
    wrappedDekPassword,
    encryptedRecoveryCode,
  };
}

/**
 * Complete setup for a new user or during migration
 * Generates DEK, wraps with password and recovery code
 */
export async function setupEnvelopeEncryption(password: string): Promise<{
  dek: Uint8Array;
  recoveryCode: string;
  wrappedDekPassword: WrappedDEK;
  wrappedDekRecovery: WrappedDEK;
  encryptedRecoveryCode: string;
}> {
  // Generate new DEK
  const dek = generateDEK();

  // Generate recovery code
  const recoveryCode = generateRecoveryCode();

  // Wrap DEK with password
  const wrappedDekPassword = await wrapDEK(dek, password, false);

  // Wrap DEK with recovery code
  const wrappedDekRecovery = await wrapDEK(dek, recoveryCode, true);

  // Encrypt recovery code with password (for viewing in settings)
  const passwordSalt = new Uint8Array(
    base64ToArrayBuffer(wrappedDekPassword.kdfSalt)
  );
  const encryptedRecoveryCode = await encryptRecoveryCode(
    recoveryCode,
    password,
    passwordSalt
  );

  return {
    dek,
    recoveryCode,
    wrappedDekPassword,
    wrappedDekRecovery,
    encryptedRecoveryCode,
  };
}

/**
 * Restore access after password reset using recovery code
 * Returns the unwrapped DEK and new password wrapper
 */
export async function restoreWithRecoveryCode(
  wrappedDekRecoveryBase64: string,
  recoveryKdfSaltBase64: string,
  recoveryCode: string,
  newPassword: string
): Promise<{
  dek: Uint8Array;
  wrappedDekPassword: WrappedDEK;
  encryptedRecoveryCode: string;
}> {
  // Unwrap DEK using recovery code
  const dek = await unwrapDEK(
    wrappedDekRecoveryBase64,
    recoveryKdfSaltBase64,
    recoveryCode,
    true
  );

  // Wrap DEK with new password
  const wrappedDekPassword = await wrapDEK(dek, newPassword, false);

  // Re-encrypt recovery code with new password
  const newSalt = new Uint8Array(
    base64ToArrayBuffer(wrappedDekPassword.kdfSalt)
  );
  const encryptedRecoveryCode = await encryptRecoveryCode(
    recoveryCode,
    newPassword,
    newSalt
  );

  return {
    dek,
    wrappedDekPassword,
    encryptedRecoveryCode,
  };
}

// ============================================================================
// IndexedDB Storage for DEK (session persistence)
// ============================================================================

const DEK_DB_NAME = "love1another_dek";
const DEK_DB_VERSION = 1;
const DEK_STORE_NAME = "dek";

function openDEKDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEK_DB_NAME, DEK_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DEK_STORE_NAME)) {
        db.createObjectStore(DEK_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Store the DEK in IndexedDB for the session
 * The DEK is stored as a CryptoKey which provides some protection
 */
export async function storeDEKInSession(
  userId: string,
  dek: Uint8Array
): Promise<void> {
  const dekKey = await importDEK(dek);
  const db = await openDEKDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DEK_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DEK_STORE_NAME);
    const request = store.put({ id: `dek_${userId}`, key: dekKey });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get the stored DEK from IndexedDB
 */
export async function getStoredDEK(userId: string): Promise<CryptoKey | null> {
  try {
    const db = await openDEKDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DEK_STORE_NAME, "readonly");
      const store = transaction.objectStore(DEK_STORE_NAME);
      const request = store.get(`dek_${userId}`);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.key || null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Clear the stored DEK (for logout)
 */
export async function clearStoredDEK(): Promise<void> {
  try {
    const db = await openDEKDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DEK_STORE_NAME, "readwrite");
      const store = transaction.objectStore(DEK_STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // Ignore errors during cleanup
  }
}
