import "server-only";

import crypto from "node:crypto";
import { getWhatsappTokenEncryptionKeyHex } from "@/lib/meta/config";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getAesKey(): Buffer {
  const keyHex = getWhatsappTokenEncryptionKeyHex();
  const keyBuf = Buffer.from(keyHex, "hex");
  if (keyBuf.length !== 32) {
    throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return keyBuf;
}

/**
 * Encrypts a Meta WhatsApp access token using AES-256-GCM with a random 12-byte IV.
 * Output format: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptToken(plaintext: string): {
  encryptedPayload: string;
  keyVersion: number;
} {
  if (!plaintext || plaintext.trim().length === 0) {
    throw new Error("Cannot encrypt an empty access token.");
  }

  const key = getAesKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedPayload: `v${KEY_VERSION}:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`,
    keyVersion: KEY_VERSION,
  };
}

/**
 * Decrypts a structured AES-256-GCM payload (v1:<iv_hex>:<tag_hex>:<ciphertext_hex>).
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new Error("Invalid encrypted token payload.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted token payload format.");
  }

  const [versionStr, ivHex, tagHex, ciphertextHex] = parts;
  if (versionStr !== `v${KEY_VERSION}`) {
    throw new Error(`Unsupported encrypted token key version: ${versionStr}`);
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES || ciphertext.length === 0) {
    throw new Error("Corrupted encrypted token component lengths.");
  }

  const key = getAesKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
