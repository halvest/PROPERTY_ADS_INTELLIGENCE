import "server-only";

import crypto from "node:crypto";

/**
 * Verifies Meta's X-Hub-Signature-256 header against the raw request body
 * using HMAC-SHA256 and constant-time comparison.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (
    typeof rawBody !== "string" ||
    !signatureHeader ||
    typeof signatureHeader !== "string" ||
    !appSecret ||
    typeof appSecret !== "string"
  ) {
    return false;
  }

  const trimmedSig = signatureHeader.trim();
  if (!trimmedSig.startsWith("sha256=")) {
    return false;
  }

  const providedHex = trimmedSig.slice("sha256=".length);
  if (!/^[0-9a-fA-F]{64}$/.test(providedHex)) {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const providedBuf = Buffer.from(providedHex.toLowerCase(), "hex");
  const expectedBuf = Buffer.from(expectedHex.toLowerCase(), "hex");

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Masks a WhatsApp ID / phone number for safe display in the CRM dashboard.
 * Example: "6281234567890" -> "+62812****7890"
 */
export function maskPhoneNumber(waId: string): string {
  const digits = String(waId || "").replace(/\D/g, "");
  if (!digits) {
    return "****";
  }

  if (digits.length <= 4) {
    return `+${"*".repeat(digits.length)}`;
  }

  if (digits.length <= 8) {
    const maskedCount = digits.length - 4;
    return `+${digits.slice(0, 2)}${"*".repeat(maskedCount)}${digits.slice(-2)}`;
  }

  const prefix = digits.slice(0, 5);
  const suffix = digits.slice(-4);
  const maskedCount = Math.max(4, digits.length - 9);
  return `+${prefix}${"*".repeat(maskedCount)}${suffix}`;
}
