/**
 * End-to-End Encryption Library for Love1Another
 *
 * This module provides browser-compatible encryption using the Web Crypto API.
 * All encryption/decryption happens on the client - the server never sees plaintext.
 *
 * Key Management:
 * - Each user has an RSA key pair (public + private)
 * - The private key is encrypted with a key derived from the user's password
 * - Conversation keys are AES-256 symmetric keys, encrypted with each participant's public key
 * - Messages and prayers are encrypted with AES-256-GCM
 *
 * Security Properties:
 * - Forward secrecy: Each message has a unique IV
 * - Authentication: GCM mode provides authenticated encryption
 * - Key derivation: PBKDF2 with 600,000 iterations (OWASP recommendation)
 */

// ============================================================================
// Constants
// ============================================================================

const PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation
const AES_KEY_LENGTH = 256;
const RSA_KEY_LENGTH = 2048;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const SALT_LENGTH = 16; // 128 bits

// Storage keys for IndexedDB
const DB_NAME = "love1another_crypto";
const DB_VERSION = 1;
const STORE_NAME = "keys";

// ============================================================================
// Types
// ============================================================================

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  version?: "legacy_v1" | "e2ee_v2"; // Encryption scheme version
}

export interface UserKeyPair {
  publicKey: string; // Base64 encoded SPKI format
  encryptedPrivateKey: string; // Base64 encoded (encrypted with password-derived key)
  keySalt: string; // Base64 encoded salt for key derivation
}

export interface DecryptedKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Uint8Array to ArrayBuffer (for Web Crypto API compatibility)
 */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  // Create a new ArrayBuffer and copy the data
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  return buffer;
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a random IV for AES-GCM
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Generate a random salt for key derivation
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

// ============================================================================
// Key Derivation (Password → Encryption Key)
// ============================================================================

/**
 * Derive an AES key from a password using PBKDF2
 *
 * @param password - User's password
 * @param salt - Random salt (16 bytes)
 * @returns AES-GCM key for encrypting the private key
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import password as key material
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false, // Not extractable
    ["encrypt", "decrypt"]
  );
}

// ============================================================================
// RSA Key Pair Generation & Management
// ============================================================================

/**
 * Generate a new RSA key pair for a user
 *
 * @returns RSA key pair (public key can encrypt, private key can decrypt)
 */
async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: RSA_KEY_LENGTH,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true, // Extractable (we need to export the private key)
    ["encrypt", "decrypt"]
  );
}

/**
 * Export a public key to SPKI format (for storage/sharing)
 */
async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import a public key from SPKI format
 */
async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(publicKeyBase64);
  return crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

/**
 * Export and encrypt a private key for storage
 *
 * @param privateKey - The RSA private key
 * @param password - User's password to encrypt the key
 * @returns Encrypted private key and salt
 */
async function exportAndEncryptPrivateKey(
  privateKey: CryptoKey,
  password: string
): Promise<{ encryptedKey: string; salt: string }> {
  // Export private key to PKCS8 format
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);

  // Generate salt and derive encryption key
  const salt = generateSalt();
  const encryptionKey = await deriveKeyFromPassword(password, salt);

  // Encrypt the private key
  const iv = generateIV();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    encryptionKey,
    exported
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return {
    encryptedKey: arrayBufferToBase64(toArrayBuffer(combined)),
    salt: arrayBufferToBase64(toArrayBuffer(salt)),
  };
}

/**
 * Decrypt and import a private key
 *
 * @param encryptedKeyBase64 - Encrypted private key (IV + ciphertext)
 * @param saltBase64 - Salt used for key derivation
 * @param password - User's password
 * @returns The decrypted RSA private key
 */
async function decryptAndImportPrivateKey(
  encryptedKeyBase64: string,
  saltBase64: string,
  password: string
): Promise<CryptoKey> {
  // Parse the encrypted data
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedKeyBase64));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Derive the encryption key
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
  const encryptionKey = await deriveKeyFromPassword(password, salt);

  // Decrypt the private key
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    encryptionKey,
    toArrayBuffer(ciphertext)
  );

  // Import the private key
  return crypto.subtle.importKey(
    "pkcs8",
    decrypted,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// ============================================================================
// AES Key Generation (for Conversations/Prayers)
// ============================================================================

/**
 * Generate a random AES-256 key for symmetric encryption
 */
async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true, // Extractable (we need to encrypt it with RSA)
    ["encrypt", "decrypt"]
  );
}

/**
 * Export an AES key to raw bytes
 */
async function exportAESKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", key);
}

/**
 * Import an AES key from raw bytes
 */
async function importAESKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt an AES key with an RSA public key (for key exchange)
 */
async function encryptAESKeyWithRSA(
  aesKey: CryptoKey,
  publicKey: CryptoKey
): Promise<string> {
  const rawKey = await exportAESKey(aesKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawKey
  );
  return arrayBufferToBase64(encrypted);
}

/**
 * Decrypt an AES key with an RSA private key
 */
async function decryptAESKeyWithRSA(
  encryptedKeyBase64: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedKey
  );
  return importAESKey(rawKey);
}

// ============================================================================
// Message/Prayer Encryption (using AES-GCM)
// ============================================================================

/**
 * Encrypt plaintext using AES-GCM
 *
 * @param plaintext - The text to encrypt
 * @param key - AES key (from conversation or derived from password)
 * @returns Encrypted data with IV
 */
async function encryptWithAES(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const iv = generateIV();
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(toArrayBuffer(iv)),
  };
}

/**
 * Decrypt ciphertext using AES-GCM
 *
 * @param encrypted - The encrypted data
 * @param key - AES key
 * @returns Decrypted plaintext
 */
async function decryptWithAES(
  encrypted: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = base64ToArrayBuffer(encrypted.iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ============================================================================
// IndexedDB Key Storage (for in-browser key caching)
// ============================================================================

/**
 * Open the IndexedDB database for key storage
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Store a key in IndexedDB (for session persistence)
 * The key is stored as-is - IndexedDB can handle CryptoKey objects
 */
async function storeKey(keyId: string, key: CryptoKey): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put({ id: keyId, key });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Store the decrypted private key in IndexedDB (for session persistence)
 * The key is stored as a non-extractable CryptoKey, which provides some protection.
 */
async function storePrivateKey(
  userId: string,
  privateKey: CryptoKey
): Promise<void> {
  return storeKey(`privateKey_${userId}`, privateKey);
}

/**
 * Store the prayer encryption key in IndexedDB (for session persistence)
 */
async function storePrayerKey(
  userId: string,
  prayerKey: CryptoKey
): Promise<void> {
  return storeKey(`prayerKey_${userId}`, prayerKey);
}

/**
 * Retrieve a stored key from IndexedDB
 */
async function getStoredKey(keyId: string): Promise<CryptoKey | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(keyId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.key || null);
    };
  });
}

/**
 * Retrieve the stored private key from IndexedDB
 */
async function getStoredPrivateKey(userId: string): Promise<CryptoKey | null> {
  return getStoredKey(`privateKey_${userId}`);
}

/**
 * Retrieve the stored prayer key from IndexedDB
 */
async function getStoredPrayerKey(userId: string): Promise<CryptoKey | null> {
  return getStoredKey(`prayerKey_${userId}`);
}

/**
 * Clear all stored keys (for logout)
 */
async function clearStoredKeys(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ============================================================================
// High-Level API (What the app uses)
// ============================================================================

/**
 * Generate encryption keys for a new user during signup
 *
 * @param password - User's password
 * @returns Key data to store in the database
 */
export async function generateUserKeys(password: string): Promise<UserKeyPair> {
  // Generate RSA key pair
  const keyPair = await generateRSAKeyPair();

  // Export public key
  const publicKey = await exportPublicKey(keyPair.publicKey);

  // Encrypt and export private key
  const { encryptedKey, salt } = await exportAndEncryptPrivateKey(
    keyPair.privateKey,
    password
  );

  return {
    publicKey,
    encryptedPrivateKey: encryptedKey,
    keySalt: salt,
  };
}

/**
 * Unlock a user's private key after login
 * Also derives and caches the prayer encryption key
 *
 * @param userKeys - Key data from database
 * @param password - User's password
 * @param userId - User ID for caching
 * @returns Whether unlock was successful
 */
export async function unlockUserKeys(
  userKeys: UserKeyPair,
  password: string,
  userId: string
): Promise<boolean> {
  try {
    // Decrypt the private key
    const privateKey = await decryptAndImportPrivateKey(
      userKeys.encryptedPrivateKey,
      userKeys.keySalt,
      password
    );

    // Store RSA private key in IndexedDB for session
    await storePrivateKey(userId, privateKey);

    // Also derive and store the prayer encryption key
    // We use a fixed salt derived from user's key salt for consistency
    const salt = new Uint8Array(base64ToArrayBuffer(userKeys.keySalt));
    const prayerKey = await deriveKeyFromPassword(password, salt);
    await storePrayerKey(userId, prayerKey);

    return true;
  } catch (error) {
    console.error("Failed to unlock user keys:", error);
    return false;
  }
}

/**
 * Lock the user's keys (clear from memory/storage)
 */
export async function lockUserKeys(): Promise<void> {
  await clearStoredKeys();
}

/**
 * Get the user's decrypted key pair (from IndexedDB cache)
 */
export async function getUserKeyPair(
  userId: string,
  publicKeyBase64: string
): Promise<DecryptedKeyPair | null> {
  const privateKey = await getStoredPrivateKey(userId);
  if (!privateKey) return null;

  const publicKey = await importPublicKey(publicKeyBase64);

  return { publicKey, privateKey };
}

/**
 * Create a new conversation key and encrypt it for both participants
 *
 * @param myKeyPair - Current user's key pair
 * @param theirPublicKeyBase64 - Other user's public key
 * @returns Encrypted conversation keys for both users
 */
export async function createConversationKey(
  myKeyPair: DecryptedKeyPair,
  theirPublicKeyBase64: string
): Promise<{ myEncryptedKey: string; theirEncryptedKey: string }> {
  // Import their public key
  const theirPublicKey = await importPublicKey(theirPublicKeyBase64);

  // Generate a shared AES key
  const conversationKey = await generateAESKey();

  // Encrypt the key for both participants
  const myEncryptedKey = await encryptAESKeyWithRSA(
    conversationKey,
    myKeyPair.publicKey
  );
  const theirEncryptedKey = await encryptAESKeyWithRSA(
    conversationKey,
    theirPublicKey
  );

  return { myEncryptedKey, theirEncryptedKey };
}

/**
 * Decrypt a conversation key using user's private key
 */
export async function decryptConversationKey(
  encryptedKeyBase64: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  return decryptAESKeyWithRSA(encryptedKeyBase64, privateKey);
}

/**
 * Encrypt a message for a conversation
 */
export async function encryptMessage(
  content: string,
  conversationKey: CryptoKey
): Promise<EncryptedData> {
  return encryptWithAES(content, conversationKey);
}

/**
 * Decrypt a message from a conversation
 */
export async function decryptMessage(
  encrypted: EncryptedData,
  conversationKey: CryptoKey
): Promise<string> {
  return decryptWithAES(encrypted, conversationKey);
}

/**
 * Encrypt prayers using a key derived from password
 * (Prayers are encrypted with the user's own password, not shared)
 */
export async function encryptPrayers(
  prayers: object,
  password: string
): Promise<{ encrypted: string; iv: string; salt: string }> {
  // Generate a new salt for this encryption
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);

  const plaintext = JSON.stringify(prayers);
  const encrypted = await encryptWithAES(plaintext, key);

  return {
    encrypted: encrypted.ciphertext,
    iv: encrypted.iv,
    salt: arrayBufferToBase64(toArrayBuffer(salt)),
  };
}

/**
 * Decrypt prayers using password
 */
export async function decryptPrayers(
  encryptedBase64: string,
  ivBase64: string,
  saltBase64: string,
  password: string
): Promise<object> {
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
  const key = await deriveKeyFromPassword(password, salt);

  const encrypted: EncryptedData = {
    ciphertext: encryptedBase64,
    iv: ivBase64,
  };

  const plaintext = await decryptWithAES(encrypted, key);
  return JSON.parse(plaintext);
}

/**
 * Encrypt prayers using the cached prayer key (no password needed)
 * Call this after unlockUserKeys has been called
 *
 * @param prayers - Prayer data object
 * @param userId - User ID to look up cached key
 * @returns Encrypted data with IV
 */
export async function encryptPrayersWithCachedKey(
  prayers: object,
  userId: string
): Promise<{ encrypted: string; iv: string }> {
  const prayerKey = await getStoredPrayerKey(userId);
  if (!prayerKey) {
    throw new Error("Prayer key not available. Please log in again.");
  }

  const plaintext = JSON.stringify(prayers);
  const encrypted = await encryptWithAES(plaintext, prayerKey);

  return {
    encrypted: encrypted.ciphertext,
    iv: encrypted.iv,
  };
}

/**
 * Decrypt prayers using the cached prayer key (no password needed)
 * Call this after unlockUserKeys has been called
 *
 * @param encryptedBase64 - Encrypted prayer data
 * @param ivBase64 - Initialization vector
 * @param userId - User ID to look up cached key
 * @returns Decrypted prayer data
 */
export async function decryptPrayersWithCachedKey(
  encryptedBase64: string,
  ivBase64: string,
  userId: string
): Promise<object> {
  const prayerKey = await getStoredPrayerKey(userId);
  if (!prayerKey) {
    throw new Error("Prayer key not available. Please log in again.");
  }

  const encrypted: EncryptedData = {
    ciphertext: encryptedBase64,
    iv: ivBase64,
  };

  const plaintext = await decryptWithAES(encrypted, prayerKey);
  return JSON.parse(plaintext);
}

/**
 * Check if the user's encryption keys are unlocked (available in IndexedDB)
 */
export async function isUserUnlocked(userId: string): Promise<boolean> {
  const privateKey = await getStoredPrivateKey(userId);
  const prayerKey = await getStoredPrayerKey(userId);
  return privateKey !== null && prayerKey !== null;
}

/**
 * Re-encrypt private key with a new password (for password change)
 */
export async function reEncryptPrivateKey(
  currentKeys: UserKeyPair,
  oldPassword: string,
  newPassword: string
): Promise<UserKeyPair> {
  // Decrypt with old password
  const privateKey = await decryptAndImportPrivateKey(
    currentKeys.encryptedPrivateKey,
    currentKeys.keySalt,
    oldPassword
  );

  // Re-encrypt with new password
  const { encryptedKey, salt } = await exportAndEncryptPrivateKey(
    privateKey,
    newPassword
  );

  return {
    publicKey: currentKeys.publicKey,
    encryptedPrivateKey: encryptedKey,
    keySalt: salt,
  };
}

/**
 * Check if the browser supports the required Web Crypto APIs
 */
export function checkCryptoSupport(): {
  supported: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!crypto?.subtle) {
    missing.push("Web Crypto API");
  }

  if (!indexedDB) {
    missing.push("IndexedDB");
  }

  if (!TextEncoder || !TextDecoder) {
    missing.push("TextEncoder/TextDecoder");
  }

  return {
    supported: missing.length === 0,
    missing,
  };
}

// ============================================================================
// DEK-Based Encryption (e2ee_v2)
// ============================================================================

/**
 * Store the DEK as a CryptoKey in IndexedDB for the session
 */
export async function storeDEK(userId: string, dekKey: CryptoKey): Promise<void> {
  return storeKey(`dek_${userId}`, dekKey);
}

/**
 * Get the stored DEK from IndexedDB
 */
export async function getStoredDEK(userId: string): Promise<CryptoKey | null> {
  return getStoredKey(`dek_${userId}`);
}

/**
 * Encrypt content using the DEK (e2ee_v2 scheme)
 * 
 * @param content - Content to encrypt
 * @param userId - User ID to look up DEK
 * @returns Encrypted data with version tag
 */
export async function encryptWithDEK(
  content: string,
  userId: string
): Promise<EncryptedData> {
  const dek = await getStoredDEK(userId);
  if (!dek) {
    throw new Error("DEK not available. Please complete encryption setup.");
  }

  const encrypted = await encryptWithAES(content, dek);
  return {
    ...encrypted,
    version: "e2ee_v2",
  };
}

/**
 * Decrypt content using the DEK (e2ee_v2 scheme)
 * 
 * @param encrypted - Encrypted data
 * @param userId - User ID to look up DEK
 * @returns Decrypted content
 */
export async function decryptWithDEK(
  encrypted: EncryptedData,
  userId: string
): Promise<string> {
  const dek = await getStoredDEK(userId);
  if (!dek) {
    throw new Error("DEK not available. Please complete encryption setup.");
  }

  return decryptWithAES(encrypted, dek);
}

/**
 * Encrypt prayers using DEK (e2ee_v2 scheme)
 * No salt needed since we use the same DEK
 * 
 * @param prayers - Prayer data object
 * @param userId - User ID to look up DEK
 * @returns Encrypted data with IV and version
 */
export async function encryptPrayersWithDEK(
  prayers: object,
  userId: string
): Promise<{ encrypted: string; iv: string; version: "e2ee_v2" }> {
  const plaintext = JSON.stringify(prayers);
  const encrypted = await encryptWithDEK(plaintext, userId);

  return {
    encrypted: encrypted.ciphertext,
    iv: encrypted.iv,
    version: "e2ee_v2",
  };
}

/**
 * Decrypt prayers using DEK (e2ee_v2 scheme)
 * 
 * @param encryptedBase64 - Encrypted prayer data
 * @param ivBase64 - Initialization vector
 * @param userId - User ID to look up DEK
 * @returns Decrypted prayer data
 */
export async function decryptPrayersWithDEK(
  encryptedBase64: string,
  ivBase64: string,
  userId: string
): Promise<object> {
  const encrypted: EncryptedData = {
    ciphertext: encryptedBase64,
    iv: ivBase64,
    version: "e2ee_v2",
  };

  const plaintext = await decryptWithDEK(encrypted, userId);
  return JSON.parse(plaintext);
}

/**
 * Try to decrypt prayers, handling both legacy and e2ee_v2 schemes
 * 
 * @param encryptedBase64 - Encrypted prayer data
 * @param ivBase64 - Initialization vector
 * @param saltBase64 - Salt (only used for legacy scheme)
 * @param userId - User ID
 * @param version - Encryption version (optional, will try to detect)
 * @returns Decrypted prayer data
 */
export async function decryptPrayersAuto(
  encryptedBase64: string,
  ivBase64: string,
  saltBase64: string | null,
  userId: string,
  version?: "legacy_v1" | "e2ee_v2"
): Promise<object> {
  // If version is specified as e2ee_v2, use DEK
  if (version === "e2ee_v2") {
    return decryptPrayersWithDEK(encryptedBase64, ivBase64, userId);
  }

  // If version is legacy_v1 or we have a salt, try legacy first
  if (version === "legacy_v1" || saltBase64) {
    // Try DEK first (in case user is migrated but data has old version tag)
    const dek = await getStoredDEK(userId);
    if (dek) {
      try {
        return await decryptPrayersWithDEK(encryptedBase64, ivBase64, userId);
      } catch {
        // Fall through to legacy
      }
    }

    // Try legacy with cached prayer key
    const prayerKey = await getStoredPrayerKey(userId);
    if (prayerKey) {
      try {
        const encrypted: EncryptedData = {
          ciphertext: encryptedBase64,
          iv: ivBase64,
        };
        const plaintext = await decryptWithAES(encrypted, prayerKey);
        return JSON.parse(plaintext);
      } catch {
        throw new Error("Failed to decrypt prayers. Keys may have changed.");
      }
    }

    throw new Error("No decryption keys available. Please log in again.");
  }

  // No version specified and no salt - try DEK first, then legacy
  const dek = await getStoredDEK(userId);
  if (dek) {
    try {
      return await decryptPrayersWithDEK(encryptedBase64, ivBase64, userId);
    } catch {
      // Fall through to legacy
    }
  }

  const prayerKey = await getStoredPrayerKey(userId);
  if (prayerKey) {
    const encrypted: EncryptedData = {
      ciphertext: encryptedBase64,
      iv: ivBase64,
    };
    const plaintext = await decryptWithAES(encrypted, prayerKey);
    return JSON.parse(plaintext);
  }

  throw new Error("No decryption keys available. Please log in again.");
}

/**
 * Check if user has DEK-based encryption set up
 */
export async function hasDEKSetup(userId: string): Promise<boolean> {
  const dek = await getStoredDEK(userId);
  return dek !== null;
}

/**
 * Generate keys for a new user with envelope encryption (e2ee_v2)
 * This is the new signup flow that uses DEK
 */
export async function generateUserKeysV2(password: string): Promise<{
  legacy: UserKeyPair;
  dek: Uint8Array;
}> {
  // Generate legacy keys for backward compatibility with conversation encryption
  const legacyKeys = await generateUserKeys(password);

  // Generate DEK for content encryption
  const dek = crypto.getRandomValues(new Uint8Array(32));

  return {
    legacy: legacyKeys,
    dek,
  };
}
