/**
 * AES-256-GCM encryption for document title and content at rest.
 * Used by PgDocumentRepository when DOCUMENT_ENCRYPTION_KEY is set.
 *
 * This module never logs or persists the key; it only receives it as an argument.
 * Key theft risk is in how the key is stored and loaded (env, secret store, logging).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "v1:";

function checkKey(key: Buffer): void {
  if (key.length !== 32) {
    throw new Error("Document encryption key must be 32 bytes (256 bits)");
  }
}

/**
 * Encrypt plaintext with the given key. Returns a versioned, base64-encoded string
 * suitable for storing in a text column: "v1:" + base64(IV || ciphertext || authTag).
 */
export function encryptDocumentField(plaintext: string, key: Buffer): string {
  checkKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, encrypted, authTag]);
  return VERSION_PREFIX + blob.toString("base64");
}

/**
 * Decrypt a value from the database. If the value starts with "v1:", it is
 * decrypted; otherwise it is returned as-is (legacy plaintext).
 */
export function decryptDocumentField(ciphertext: string, key: Buffer): string {
  if (!ciphertext.startsWith(VERSION_PREFIX)) {
    return ciphertext;
  }
  checkKey(key);
  const blob = Buffer.from(ciphertext.slice(VERSION_PREFIX.length), "base64");
  if (blob.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Document field ciphertext too short to be valid");
  }
  const iv = blob.subarray(0, IV_LENGTH);
  const authTag = blob.subarray(blob.length - AUTH_TAG_LENGTH);
  const encrypted = blob.subarray(IV_LENGTH, blob.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/**
 * Parse a base64-encoded 32-byte key. Returns null if the string is empty/whitespace.
 */
export function parseDocumentEncryptionKey(encoded: string | undefined): Buffer | null {
  if (encoded === undefined || encoded.trim() === "") {
    return null;
  }
  const key = Buffer.from(encoded.trim(), "base64");
  if (key.length !== 32) {
    throw new Error(
      `DOCUMENT_ENCRYPTION_KEY must be base64 of 32 bytes (got ${key.length} bytes after decode)`
    );
  }
  return key;
}
