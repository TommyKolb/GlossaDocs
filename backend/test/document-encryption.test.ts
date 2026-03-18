import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  decryptDocumentField,
  encryptDocumentField,
  parseDocumentEncryptionKey
} from "../src/shared/document-encryption.js";

function validKey(): Buffer {
  return randomBytes(32);
}

describe("document-encryption", () => {
  describe("encryptDocumentField / decryptDocumentField", () => {
    it("roundtrips plaintext", () => {
      const key = validKey();
      const plain = "Hello, world.";
      const encrypted = encryptDocumentField(plain, key);
      expect(encrypted).toMatch(/^v1:/);
      expect(encrypted).not.toBe(plain);
      expect(decryptDocumentField(encrypted, key)).toBe(plain);
    });

    it("produces different ciphertext each time (random IV)", () => {
      const key = validKey();
      const a = encryptDocumentField("same", key);
      const b = encryptDocumentField("same", key);
      expect(a).not.toBe(b);
      expect(decryptDocumentField(a, key)).toBe("same");
      expect(decryptDocumentField(b, key)).toBe("same");
    });

    it("decrypts empty string", () => {
      const key = validKey();
      const encrypted = encryptDocumentField("", key);
      expect(decryptDocumentField(encrypted, key)).toBe("");
    });

    it("decrypts long content (e.g. document body)", () => {
      const key = validKey();
      const long = "<p>" + "x".repeat(10000) + "</p>";
      expect(decryptDocumentField(encryptDocumentField(long, key), key)).toBe(long);
    });

    it("returns legacy plaintext unchanged when value does not start with v1:", () => {
      const key = validKey();
      expect(decryptDocumentField("plain title", key)).toBe("plain title");
      expect(decryptDocumentField("", key)).toBe("");
    });

    it("throws when decrypting with wrong key (confidentiality)", () => {
      const key1 = validKey();
      const key2 = validKey();
      const encrypted = encryptDocumentField("secret", key1);
      expect(() => decryptDocumentField(encrypted, key2)).toThrow();
    });

    it("throws when ciphertext is tampered (integrity)", () => {
      const key = validKey();
      const encrypted = encryptDocumentField("secret", key);
      const tampered = encrypted.slice(0, -4) + "xxxx";
      expect(() => decryptDocumentField(tampered, key)).toThrow();
    });

    it("throws when key is not 32 bytes", () => {
      const shortKey = Buffer.alloc(16);
      expect(() => encryptDocumentField("x", shortKey)).toThrow("32 bytes");
      const longKey = Buffer.alloc(64);
      expect(() => encryptDocumentField("x", longKey)).toThrow("32 bytes");
    });
  });

  describe("parseDocumentEncryptionKey", () => {
    it("returns null for undefined or empty string", () => {
      expect(parseDocumentEncryptionKey(undefined)).toBeNull();
      expect(parseDocumentEncryptionKey("")).toBeNull();
      expect(parseDocumentEncryptionKey("   ")).toBeNull();
    });

    it("returns 32-byte buffer for valid base64 key", () => {
      const key = randomBytes(32);
      const encoded = key.toString("base64");
      const parsed = parseDocumentEncryptionKey(encoded);
      expect(parsed).not.toBeNull();
      expect(Buffer.isBuffer(parsed)).toBe(true);
      expect(parsed!.length).toBe(32);
      expect(parsed!.equals(key)).toBe(true);
    });

    it("throws when base64 decodes to wrong length", () => {
      const badKey = Buffer.alloc(16).toString("base64");
      expect(() => parseDocumentEncryptionKey(badKey)).toThrow("32 bytes");
    });
  });
});
