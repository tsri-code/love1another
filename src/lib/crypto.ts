import crypto from 'crypto';
import argon2 from 'argon2';

// Argon2id configuration for secure password hashing
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

// AES-256-GCM for encryption
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits

/**
 * Hash a passcode using Argon2id
 */
export async function hashPasscode(passcode: string): Promise<string> {
  return argon2.hash(passcode, ARGON2_CONFIG);
}

/**
 * Verify a passcode against its hash
 */
export async function verifyPasscode(passcode: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, passcode);
  } catch {
    return false;
  }
}

/**
 * Derive an encryption key from a passcode using Argon2id
 */
export async function deriveKey(passcode: string, salt: Buffer): Promise<Buffer> {
  const hash = await argon2.hash(passcode, {
    ...ARGON2_CONFIG,
    salt,
    raw: true,
    hashLength: KEY_LENGTH,
  });
  return Buffer.from(hash);
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM
 * Returns: salt (32 bytes) + iv (12 bytes) + authTag (16 bytes) + ciphertext
 */
export async function encrypt(plaintext: string, passcode: string): Promise<Buffer> {
  const salt = generateSalt();
  const key = await deriveKey(passcode, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: salt + iv + authTag + ciphertext
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(encryptedData: Buffer, passcode: string): Promise<string> {
  // Extract components
  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encryptedData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const key = await deriveKey(passcode, salt);
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  
  return decrypted.toString('utf8');
}

/**
 * Re-encrypt data with a new passcode
 */
export async function reencrypt(
  encryptedData: Buffer,
  oldPasscode: string,
  newPasscode: string
): Promise<Buffer> {
  const plaintext = await decrypt(encryptedData, oldPasscode);
  return encrypt(plaintext, newPasscode);
}

/**
 * Generate a secure random ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Simple symmetric encryption for storing passcodes (for admin recovery)
// Uses a fixed key derived from app secret - this is for convenience, not high security
const APP_ENCRYPTION_KEY = crypto.scryptSync(
  process.env.APP_SECRET || 'love1another-local-encryption-key',
  'love1another-salt',
  32
);

/**
 * Encrypt passcode for storage (recoverable by admin)
 */
export function encryptPasscodeForStorage(passcode: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, APP_ENCRYPTION_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(passcode, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: iv + authTag + ciphertext, then base64
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt stored passcode (for admin recovery)
 */
export function decryptStoredPasscode(encryptedPasscode: string): string {
  const data = Buffer.from(encryptedPasscode, 'base64');
  
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, APP_ENCRYPTION_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  
  return decrypted.toString('utf8');
}

