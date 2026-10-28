import "server-only";

import { MarketingApiError, type MetaMarketingConfig } from "./types";

const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com";
const DEFAULT_API_VERSION = "v21.0";
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_MAX_RETRIES = 2;

/**
 * Normalizes an Ad Account ID to always include the "act_" prefix.
 * e.g., "123456789" -> "act_123456789"
 * e.g., "act_123456789" -> "act_123456789"
 */
export function normalizeAdAccountId(accountId?: string): string {
  if (!accountId || accountId.trim() === "") {
    return "";
  }
  const trimmed = accountId.trim();
  if (trimmed.startsWith("act_")) {
    return trimmed;
  }
  return `act_${trimmed}`;
}

/**
 * Extracts raw numeric ad account ID without "act_" prefix.
 */
export function extractRawAdAccountId(accountId?: string): string {
  if (!accountId || accountId.trim() === "") {
    return "";
  }
  const trimmed = accountId.trim();
  if (trimmed.startsWith("act_")) {
    return trimmed.slice(4);
  }
  return trimmed;
}

/**
 * Safely masks a Meta access token for logging and UI display.
 * Never exposes middle/complete token bytes.
 */
export function maskToken(token?: string): string {
  if (!token || token.trim() === "") {
    return "[NOT CONFIGURED]";
  }
  const trimmed = token.trim();
  if (trimmed.length <= 10) {
    return "••••••••";
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Masks an Ad Account ID for display (e.g., "act_123••••890").
 */
export function maskAdAccountId(accountId?: string): string {
  if (!accountId || accountId.trim() === "") {
    return "[NOT CONFIGURED]";
  }
  const normalized = normalizeAdAccountId(accountId);
  if (normalized.length <= 8) {
    return "act_••••";
  }
  const prefix = normalized.slice(0, 7);
  const suffix = normalized.slice(-3);
  return `${prefix}••••${suffix}`;
}

/**
 * Sanitizes log output by stripping out known access tokens and authorization headers.
 */
export function sanitizeMarketingLog(text: string, knownToken?: string): string {
  let sanitized = text;

  // Redact known token if supplied
  if (knownToken && knownToken.trim().length > 6) {
    sanitized = sanitized.split(knownToken.trim()).join("[REDACTED_ACCESS_TOKEN]");
  }

  // Redact Bearer tokens: Bearer <anything>
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_\-.~+/=]+/gi, "Bearer [REDACTED_TOKEN]");

  // Redact URL query params: access_token=...
  sanitized = sanitized.replace(/access_token=[A-Za-z0-9_\-.~+/=]+/gi, "access_token=[REDACTED_TOKEN]");

  // Redact appsecret_proof=...
  sanitized = sanitized.replace(/appsecret_proof=[a-f0-9]+/gi, "appsecret_proof=[REDACTED_PROOF]");

  return sanitized;
}

/**
 * Checks whether Meta Marketing API is configured with a valid token in the server environment.
 */
export function isMetaMarketingConfigured(): boolean {
  const token = process.env.META_ACCESS_TOKEN;
  return typeof token === "string" && token.trim().length > 0;
}

/**
 * Safely parses bounded integer configuration.
 */
function parseBoundedInt(val: string | undefined, defaultVal: number, min: number, max: number): number {
  if (!val) return defaultVal;
  const parsed = parseInt(val, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    return defaultVal;
  }
  return parsed;
}

/**
 * Retrieves the validated Meta Marketing API configuration.
 * When requireConfigured is false (default), it returns the config object with isConfigured=false
 * without throwing, enabling non-blocking server execution and demo mode fallback.
 */
export function getMetaMarketingConfig(options: { requireConfigured?: boolean } = {}): MetaMarketingConfig {
  const accessToken = (process.env.META_ACCESS_TOKEN || "").trim();
  const rawAdAccountId = extractRawAdAccountId(process.env.META_AD_ACCOUNT_ID);
  const adAccountId = normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID);
  const appId = (process.env.META_APP_ID || "").trim() || undefined;
  const appSecret = (process.env.META_APP_SECRET || "").trim() || undefined;

  const apiVersion = (process.env.META_GRAPH_API_VERSION || DEFAULT_API_VERSION).trim();
  const baseUrl = (process.env.META_GRAPH_BASE_URL || DEFAULT_GRAPH_BASE_URL).trim();

  const timeoutMs = parseBoundedInt(process.env.META_MARKETING_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, 120000);
  const maxRetries = parseBoundedInt(process.env.META_MARKETING_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 5);

  const isConfigured = accessToken.length > 0 && adAccountId.length > 0;

  if (options.requireConfigured && !isConfigured) {
    const missing: string[] = [];
    if (accessToken.length === 0) missing.push("META_ACCESS_TOKEN");
    if (adAccountId.length === 0) missing.push("META_AD_ACCOUNT_ID");

    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message: `Meta Marketing API is not configured. Missing required server variables: ${missing.join(", ")}.`,
      isRecoverable: false,
    });
  }

  // Validate URL format
  try {
    const parsedUrl = new URL(baseUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message: `Invalid META_GRAPH_BASE_URL configured: "${baseUrl}". Must be a valid HTTP/HTTPS URL.`,
      isRecoverable: false,
    });
  }

  return {
    accessToken,
    adAccountId,
    rawAdAccountId,
    appId,
    appSecret,
    apiVersion,
    baseUrl,
    timeoutMs,
    maxRetries,
    isConfigured,
  };
}

/**
 * Validates configuration without throwing.
 */
export function validateMetaMarketingConfig(): {
  isValid: boolean;
  error?: string;
  config?: MetaMarketingConfig;
} {
  try {
    const config = getMetaMarketingConfig({ requireConfigured: false });
    return {
      isValid: true,
      config,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown marketing configuration error";
    return {
      isValid: false,
      error: errorMsg,
    };
  }
}
