import "server-only";

import crypto from "crypto";

/**
 * Returns a 32-byte encryption key derived deterministically from server secrets.
 */
function getDerivedKey(): Buffer {
  // Production requires a dedicated encryption key. Deriving the token
  // encryption key from rotatable app secrets would make stored tokens
  // undecryptable (or co-mingle key purposes) on secret rotation.
  if (process.env.NODE_ENV === "production" && !process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY wajib dikonfigurasi di production untuk enkripsi kredensial."
    );
  }
  const secretSource =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.META_APP_SECRET ||
    process.env.WHATSAPP_APP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NODE_ENV !== "production" ? "property-ads-dev-local-secret-key-32b" : "");

  if (!secretSource) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY wajib dikonfigurasi untuk enkripsi kredensial."
    );
  }

  return crypto.createHash("sha256").update(secretSource).digest();
}

/**
 * Encrypts sensitive credentials (such as Meta Graph API access tokens)
 * using authenticated AES-256-GCM.
 */
export function encryptAccessToken(plainToken: string): {
  encryptedToken: string;
  iv: string;
  tag: string;
} {
  if (!plainToken || plainToken.trim().length === 0) {
    throw new Error("Token tidak boleh kosong.");
  }

  const key = getDerivedKey();
  const ivBuffer = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, ivBuffer);

  const encryptedBuffer = Buffer.concat([
    cipher.update(plainToken, "utf8"),
    cipher.final(),
  ]);
  const tagBuffer = cipher.getAuthTag();

  return {
    encryptedToken: encryptedBuffer.toString("base64"),
    iv: ivBuffer.toString("base64"),
    tag: tagBuffer.toString("base64"),
  };
}

/**
 * Decrypts AES-256-GCM encrypted credentials.
 * Throws if authentication tag or ciphertext has been tampered with.
 */
export function decryptAccessToken(
  encryptedTokenBase64: string,
  ivBase64: string,
  tagBase64: string
): string {
  const key = getDerivedKey();
  const ivBuffer = Buffer.from(ivBase64, "base64");
  const tagBuffer = Buffer.from(tagBase64, "base64");
  const encryptedBuffer = Buffer.from(encryptedTokenBase64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  const decryptedBuffer = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);

  return decryptedBuffer.toString("utf8");
}

/**
 * Generates a signed, tamper-resistant anti-CSRF state token for Embedded Signup onboarding.
 */
export function generateOAuthCsrfState(payload: {
  organizationId: string;
  userId: string;
}): string {
  const key = getDerivedKey();
  const body = JSON.stringify({
    orgId: payload.organizationId,
    uid: payload.userId,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  });

  const bodyBase64 = Buffer.from(body, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", key)
    .update(bodyBase64)
    .digest("base64url");

  return `${bodyBase64}.${signature}`;
}

/**
 * Validates the anti-CSRF state token returned from the Embedded Signup flow.
 * Ensures the state has not been tampered with, expired, or bound to a different tenant/user.
 */
export function verifyOAuthCsrfState(
  state: string,
  expected: { organizationId: string; userId: string }
): { valid: boolean; reason?: string } {
  if (!state || typeof state !== "string" || !state.includes(".")) {
    return { valid: false, reason: "Format state token tidak valid." };
  }

  const [bodyBase64, providedSig] = state.split(".");
  if (!bodyBase64 || !providedSig) {
    return { valid: false, reason: "State token tidak lengkap." };
  }

  const key = getDerivedKey();
  const expectedSig = crypto
    .createHmac("sha256", key)
    .update(bodyBase64)
    .digest("base64url");

  // Constant-time comparison
  const expectedSigBuf = Buffer.from(expectedSig);
  const providedSigBuf = Buffer.from(providedSig);

  if (
    expectedSigBuf.length !== providedSigBuf.length ||
    !crypto.timingSafeEqual(expectedSigBuf, providedSigBuf)
  ) {
    return { valid: false, reason: "Tanda tangan state token (anti-CSRF) tidak valid." };
  }

  try {
    const rawBody = Buffer.from(bodyBase64, "base64url").toString("utf8");
    const parsed = JSON.parse(rawBody) as {
      orgId?: string;
      uid?: string;
      ts?: number;
    };

    if (parsed.orgId !== expected.organizationId) {
      return { valid: false, reason: "State token tidak sesuai dengan organisasi aktif (tenant mismatch)." };
    }

    if (parsed.uid !== expected.userId) {
      return { valid: false, reason: "State token tidak sesuai dengan sesi pengguna yang menginisiasi alur." };
    }

    // Token expiry: 15 minutes max
    const MAX_AGE_MS = 15 * 60 * 1000;
    if (!parsed.ts || Date.now() - parsed.ts > MAX_AGE_MS) {
      return { valid: false, reason: "State token telah kedaluwarsa (maksimum 15 menit)." };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Isi payload state token korup." };
  }
}
