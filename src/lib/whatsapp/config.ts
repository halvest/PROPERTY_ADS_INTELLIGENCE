import "server-only";

import crypto from "node:crypto";
import type {
  WhatsAppConfig,
  WhatsAppIntegrationStatus,
  WhatsAppConnectionRecord,
  WhatsAppConnectionStatus,
} from "./types";

/**
 * Retrieves the validated platform-level WhatsApp Cloud API configuration.
 *
 * Note: HD Creative is a multi-tenant SaaS. Customer-specific credentials
 * (phone_number_id, waba_id, access_token) are persisted per-tenant in the
 * database via Embedded Signup and are NEVER read from global env in production.
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  const verifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
  const appSecret = (process.env.WHATSAPP_APP_SECRET || "").trim();
  const appId = (process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "").trim() || undefined;
  const embeddedSignupConfigId =
    (process.env.WHATSAPP_CONFIG_ID || process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID || "").trim() || undefined;

  const isProduction = process.env.NODE_ENV === "production";

  // In production, strictly reject global customer credentials
  const phoneNumberId = !isProduction
    ? (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim() || undefined
    : undefined;
  const businessAccountId = !isProduction
    ? (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim() || undefined
    : undefined;
  const accessToken = !isProduction
    ? (process.env.WHATSAPP_ACCESS_TOKEN || "").trim() || undefined
    : undefined;

  const isConfigured = verifyToken.length > 0 && appSecret.length > 0;

  return {
    verifyToken,
    appSecret,
    phoneNumberId,
    businessAccountId,
    accessToken,
    appId,
    embeddedSignupConfigId,
    isConfigured,
  };
}

/**
 * Resolves operational WhatsApp integration status.
 *
 * Replaces global WHATSAPP_LIVE_VERIFIED with authentic per-connection verification results:
 * - When a tenant connection record is provided, status truthfully reflects that customer's connection.
 * - When called without arguments, reflects platform-level readiness (webhook secret & token configured).
 * - A global configuration flag must never imply every customer's WhatsApp connection is live.
 */
export function getWhatsAppIntegrationStatus(
  connection?: WhatsAppConnectionRecord | null
): WhatsAppIntegrationStatus {
  // If evaluating a specific tenant connection
  if (connection) {
    const raw = connection as unknown as Record<string, unknown>;
    const status = connection.connectionStatus || (raw["connection_status"] as string);
    const lastWebhook = connection.lastWebhookReceivedAt || (raw["last_webhook_received_at"] as string | null);

    if (status === "connected" && lastWebhook) {
      return "live_verified";
    }
    if (status === "connected") {
      return "configured";
    }
    return "not_configured";
  }

  // Platform-level readiness
  const config = getWhatsAppConfig();
  if (config.isConfigured) {
    return "configured";
  }
  if (process.env.NODE_ENV === "test" || process.env.ENABLE_DEMO_DATA !== "false") {
    return "mock";
  }
  return "not_configured";
}

/**
 * Returns truthful per-tenant operational status.
 */
export function getTenantWhatsAppConnectionStatus(
  conn: WhatsAppConnectionRecord | null
): WhatsAppConnectionStatus | "live_verified" {
  if (!conn) return "disconnected";
  const raw = conn as unknown as Record<string, unknown>;
  const status = (conn.connectionStatus || raw["connection_status"] || "disconnected") as WhatsAppConnectionStatus;
  const lastWebhook = conn.lastWebhookReceivedAt || (raw["last_webhook_received_at"] as string | null);

  if (status === "connected" && lastWebhook) {
    return "live_verified";
  }
  return status;
}

/**
 * Validates Meta Webhook GET challenge according to official protocol.
 */
export function verifyWebhookChallenge(
  mode?: string | null,
  token?: string | null,
  challenge?: string | null,
  configuredVerifyToken?: string
): { isValid: boolean; challenge?: string } {
  const expectedToken = configuredVerifyToken || getWhatsAppConfig().verifyToken;

  if (
    mode === "subscribe" &&
    token &&
    expectedToken &&
    token === expectedToken &&
    challenge
  ) {
    return {
      isValid: true,
      challenge,
    };
  }

  return {
    isValid: false,
  };
}

/**
 * Verifies the X-Hub-Signature-256 header using HMAC-SHA256 and constant-time comparison.
 * Meta computes: HMAC-SHA256(raw_request_body, app_secret).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader?: string | null,
  secretOverride?: string
): boolean {
  const secret = secretOverride || getWhatsAppConfig().appSecret;

  if (!secret || secret.trim() === "") {
    return false;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const signatureHash = signatureHeader.slice(7).trim(); // Remove "sha256=" prefix

  try {
    const expectedHash = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    const expectedBuf = Buffer.from(expectedHash, "utf8");
    const receivedBuf = Buffer.from(signatureHash, "utf8");

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * Computes a deterministic privacy-preserving hash of an E.164 phone number.
 */
export function resolvePhoneHashSecret(explicit?: string): string {
  if (explicit) return explicit;
  const envSecret = process.env.PHONE_HASH_SECRET || process.env.TOKEN_ENCRYPTION_KEY;
  if (envSecret) return envSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PHONE_HASH_SECRET wajib dikonfigurasi di production.");
  }
  // Legacy salt kept only for non-production compatibility with existing demo data.
  return "property_ads_salt";
}

export function hashPhoneNumber(phone: string, secretSalt?: string): string {
  const salt = resolvePhoneHashSecret(secretSalt);
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = `62${cleanPhone.slice(1)}`;
  }
  return crypto.createHmac("sha256", salt).update(cleanPhone).digest("hex");
}

/**
 * Masks a phone number to protect prospective buyer PII.
 * e.g., "628123456789" -> "+62 812-****-789"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || phone.trim() === "") {
    return "+62 ***-****-***";
  }

  const clean = phone.replace(/[^0-9]/g, "");
  if (clean.length < 9) {
    return "+62 ***-****-***";
  }

  let formatted = clean;
  if (formatted.startsWith("62")) {
    formatted = formatted.slice(2);
  } else if (formatted.startsWith("0")) {
    formatted = formatted.slice(1);
  }

  const prefix = formatted.slice(0, 3); // e.g. "812"
  const suffix = formatted.slice(-3); // e.g. "789"

  return `+62 ${prefix}-****-${suffix}`;
}

/**
 * Sanitizes logs to strip tokens, raw secrets, and prospective buyer phone numbers.
 */
export function sanitizeWhatsAppLog(text: string, knownSecret?: string): string {
  let sanitized = text;

  if (knownSecret && knownSecret.trim().length > 4) {
    sanitized = sanitized.split(knownSecret.trim()).join("[REDACTED_SECRET]");
  }

  sanitized = sanitized.replace(/sha256=[a-f0-9]{64}/gi, "sha256=[REDACTED_SIGNATURE]");
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_\-.~+/=]+/gi, "Bearer [REDACTED_TOKEN]");
  sanitized = sanitized.replace(/(?:\+?62|0)8[0-9]{8,12}/g, "[REDACTED_PHONE]");

  return sanitized;
}
