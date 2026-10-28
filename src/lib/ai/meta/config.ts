import "server-only";

import { AIProviderError, type MetaModelConfig } from "../providers/types";

const DEFAULT_BASE_URL = "https://api.meta.ai/v1";
const DEFAULT_MODEL = "muse-spark-1.3";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;

/**
 * Masks an API key for safe logging, diagnostics, and display.
 * Never reveals full secret values.
 */
export function maskApiKey(key?: string): string {
  if (!key || key.trim() === "") {
    return "[NOT CONFIGURED]";
  }
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return "••••••••";
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Sanitizes any error message or string by stripping out API keys and Bearer tokens.
 */
export function sanitizeLogOutput(text: string, knownApiKey?: string): string {
  let sanitized = text;

  // Redact known API key if provided
  if (knownApiKey && knownApiKey.trim().length > 4) {
    sanitized = sanitized.split(knownApiKey.trim()).join("[REDACTED_API_KEY]");
  }

  // Redact Bearer tokens: Bearer <anything>
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_\-.~+/=]+/gi, "Bearer [REDACTED_TOKEN]");

  // Redact Authorization headers
  sanitized = sanitized.replace(/"Authorization":\s*"[^"]+"/gi, '"Authorization": "Bearer [REDACTED]"');

  return sanitized;
}

/**
 * Inspects environment variables to check if Meta Model API is configured.
 */
export function isMetaModelApiConfigured(): boolean {
  const key = process.env.MODEL_API_KEY || process.env.META_MODEL_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/**
 * Safely parses integer configuration with bounds.
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
 * Retrieves the validated Meta Model API configuration.
 * When requireApiKey is false (default), it returns the config object with isConfigured=false
 * without throwing, enabling non-blocking server execution and demo mode fallback.
 */
export function getMetaConfig(options: { requireApiKey?: boolean } = {}): MetaModelConfig {
  const apiKey = (process.env.MODEL_API_KEY || process.env.META_MODEL_API_KEY || "").trim();
  const baseUrl = (process.env.META_MODEL_BASE_URL || DEFAULT_BASE_URL).trim();
  const museSparkModel = (
    process.env.META_MUSE_SPARK_MODEL ||
    process.env.META_MODEL_ID ||
    DEFAULT_MODEL
  ).trim();

  const timeoutMs = parseBoundedInt(process.env.META_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, 60000);
  const maxRetries = parseBoundedInt(process.env.META_MODEL_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 5);

  const isConfigured = apiKey.length > 0;

  if (options.requireApiKey && !isConfigured) {
    throw new AIProviderError({
      code: "MISSING_CONFIGURATION",
      message:
        "Meta Model API key is not configured. Set MODEL_API_KEY in your server environment (.env.local).",
      isRecoverable: false,
      provider: "meta_model_api",
      modelId: museSparkModel,
    });
  }

  // Validate URL format
  try {
    const parsedUrl = new URL(baseUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new AIProviderError({
      code: "MISSING_CONFIGURATION",
      message: `Invalid META_MODEL_BASE_URL configured: "${baseUrl}". Must be a valid HTTP/HTTPS URL.`,
      isRecoverable: false,
      provider: "meta_model_api",
      modelId: museSparkModel,
    });
  }

  return {
    apiKey,
    baseUrl,
    museSparkModel,
    timeoutMs,
    maxRetries,
    isConfigured,
  };
}

/**
 * Validates configuration without throwing.
 */
export function validateMetaConfig(): {
  isValid: boolean;
  error?: string;
  config?: MetaModelConfig;
} {
  try {
    const config = getMetaConfig({ requireApiKey: false });
    return {
      isValid: true,
      config,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown configuration error";
    return {
      isValid: false,
      error: errorMsg,
    };
  }
}
