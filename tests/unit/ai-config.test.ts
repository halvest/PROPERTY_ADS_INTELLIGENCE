import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getMetaConfig,
  validateMetaConfig,
  maskApiKey,
  sanitizeLogOutput,
  isMetaModelApiConfigured,
} from "@/lib/ai/meta/config";
import { AIProviderError } from "@/lib/ai/providers/types";

describe("Meta Model API - Config & Environment Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MODEL_API_KEY;
    delete process.env.META_MODEL_API_KEY;
    delete process.env.META_MODEL_BASE_URL;
    delete process.env.META_MUSE_SPARK_MODEL;
    delete process.env.META_MODEL_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults to official base URL and muse-spark-1.3 model", () => {
    const config = getMetaConfig();
    expect(config.baseUrl).toBe("https://api.meta.ai/v1");
    expect(config.museSparkModel).toBe("muse-spark-1.3");
    expect(config.isConfigured).toBe(false);
    expect(config.apiKey).toBe("");
  });

  it("respects MODEL_API_KEY and custom configurations", () => {
    process.env.MODEL_API_KEY = "test_meta_key_123456789";
    process.env.META_MODEL_BASE_URL = "https://custom.meta.ai/v1";
    process.env.META_MUSE_SPARK_MODEL = "muse-spark-1.3";

    const config = getMetaConfig();
    expect(config.isConfigured).toBe(true);
    expect(config.apiKey).toBe("test_meta_key_123456789");
    expect(config.baseUrl).toBe("https://custom.meta.ai/v1");
    expect(config.museSparkModel).toBe("muse-spark-1.3");
  });

  it("supports legacy META_MODEL_API_KEY as backwards-compatible fallback", () => {
    process.env.META_MODEL_API_KEY = "legacy_meta_key_987654";
    expect(isMetaModelApiConfigured()).toBe(true);
    const config = getMetaConfig();
    expect(config.apiKey).toBe("legacy_meta_key_987654");
  });

  it("throws actionable AIProviderError when requireApiKey is true and key is missing", () => {
    expect(() => getMetaConfig({ requireApiKey: true })).toThrowError(AIProviderError);
    try {
      getMetaConfig({ requireApiKey: true });
    } catch (err) {
      const providerErr = err as AIProviderError;
      expect(providerErr.code).toBe("MISSING_CONFIGURATION");
      expect(providerErr.message).toContain("MODEL_API_KEY");
      expect(providerErr.isRecoverable).toBe(false);
    }
  });

  it("throws actionable error if META_MODEL_BASE_URL is invalid", () => {
    process.env.META_MODEL_BASE_URL = "not-a-valid-url";
    expect(() => getMetaConfig()).toThrowError(AIProviderError);
  });

  it("validateMetaConfig provides safe non-throwing status check", () => {
    const res = validateMetaConfig();
    expect(res.isValid).toBe(true);
    expect(res.config?.isConfigured).toBe(false);
  });

  describe("maskApiKey", () => {
    it("returns [NOT CONFIGURED] for empty, null, or undefined keys", () => {
      expect(maskApiKey("")).toBe("[NOT CONFIGURED]");
      expect(maskApiKey(undefined)).toBe("[NOT CONFIGURED]");
      expect(maskApiKey("   ")).toBe("[NOT CONFIGURED]");
    });

    it("masks short keys completely without leaking characters", () => {
      expect(maskApiKey("short12")).toBe("••••••••");
    });

    it("masks long keys keeping only first and last 4 characters", () => {
      const masked = maskApiKey("meta_prod_secret_token_9999");
      expect(masked).toBe("meta••••••••9999");
      expect(masked).not.toContain("secret");
      expect(masked).not.toContain("token");
    });
  });

  describe("sanitizeLogOutput", () => {
    it("strips raw API key from error strings and log messages", () => {
      const secret = "secret_meta_api_key_xyz987";
      const dirty = `Failed calling https://api.meta.ai with key: ${secret}`;
      const clean = sanitizeLogOutput(dirty, secret);
      expect(clean).not.toContain(secret);
      expect(clean).toContain("[REDACTED_API_KEY]");
    });

    it("redacts Bearer tokens in headers or message traces", () => {
      const dirty = 'Error with header Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.xyz';
      const clean = sanitizeLogOutput(dirty);
      expect(clean).toContain("Bearer [REDACTED_TOKEN]");
      expect(clean).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    });
  });
});
