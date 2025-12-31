import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Derive a 32-byte key from the encryption key using scrypt.
 * This allows using any length passphrase as the ENCRYPTION_KEY.
 */
function deriveKey(salt: Buffer): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return scryptSync(ENCRYPTION_KEY, salt, 32);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string containing: salt + iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from passphrase
  const key = deriveKey(salt);

  // Create cipher and encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine all parts: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt a base64-encoded encrypted string.
 * Expects format: salt + iv + authTag + ciphertext
 */
export function decrypt(encryptedBase64: string): string {
  if (!encryptedBase64) {
    return '';
  }

  // Decode from base64
  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract parts
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from passphrase
  const key = deriveKey(salt);

  // Create decipher and decrypt
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generate a random encryption key (32 bytes, hex-encoded = 64 characters).
 * Use this to generate a new ENCRYPTION_KEY for .env.
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate that the encryption key is properly configured.
 * Returns true if encryption is available, false otherwise.
 */
export function isEncryptionConfigured(): boolean {
  return !!ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 16;
}
