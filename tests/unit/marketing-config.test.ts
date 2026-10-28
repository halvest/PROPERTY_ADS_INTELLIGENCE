import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizeAdAccountId,
  extractRawAdAccountId,
  maskToken,
  maskAdAccountId,
  sanitizeMarketingLog,
  isMetaMarketingConfigured,
  getMetaMarketingConfig,
  validateMetaMarketingConfig,
} from "@/lib/marketing/meta/config";
import { MarketingApiError } from "@/lib/marketing/meta/types";

describe("Meta Marketing API - Config & Utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;
    delete process.env.META_GRAPH_BASE_URL;
    delete process.env.META_GRAPH_API_VERSION;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("normalizeAdAccountId & extractRawAdAccountId", () => {
    it("ensures 'act_' prefix is added if omitted", () => {
      expect(normalizeAdAccountId("123456789")).toBe("act_123456789");
      expect(normalizeAdAccountId("act_123456789")).toBe("act_123456789");
      expect(normalizeAdAccountId("")).toBe("");
      expect(normalizeAdAccountId(undefined)).toBe("");
    });

    it("extracts raw numeric account ID without 'act_' prefix", () => {
      expect(extractRawAdAccountId("act_123456789")).toBe("123456789");
      expect(extractRawAdAccountId("123456789")).toBe("123456789");
      expect(extractRawAdAccountId("")).toBe("");
    });
  });

  describe("maskToken", () => {
    it("returns [NOT CONFIGURED] for missing tokens", () => {
      expect(maskToken("")).toBe("[NOT CONFIGURED]");
      expect(maskToken(undefined)).toBe("[NOT CONFIGURED]");
      expect(maskToken("   ")).toBe("[NOT CONFIGURED]");
    });

    it("masks short tokens completely", () => {
      expect(maskToken("tok_12345")).toBe("••••••••");
    });

    it("masks long tokens preserving only first and last 4 characters", () => {
      const masked = maskToken("EAAXsecretToken9999");
      expect(masked).toBe("EAAX••••••••••••9999");
      expect(masked).not.toContain("secretToken");
    });
  });

  describe("maskAdAccountId", () => {
    it("returns [NOT CONFIGURED] for empty account ID", () => {
      expect(maskAdAccountId("")).toBe("[NOT CONFIGURED]");
      expect(maskAdAccountId(undefined)).toBe("[NOT CONFIGURED]");
    });

    it("masks ad account ID while showing partial prefix and suffix", () => {
      const masked = maskAdAccountId("1234567890123");
      expect(masked).toContain("act_123");
      expect(masked).toContain("••••");
      expect(masked).toContain("123");
    });
  });

  describe("sanitizeMarketingLog", () => {
    it("redacts access token from log strings", () => {
      const token = "EAAXsampleToken12345";
      const dirty = `Failed calling Graph API with access_token=${token}`;
      const clean = sanitizeMarketingLog(dirty, token);
      expect(clean).not.toContain(token);
      expect(clean).toContain("[REDACTED_ACCESS_TOKEN]");
    });

    it("redacts Bearer tokens and appsecret_proof", () => {
      const dirty = "Header Authorization: Bearer EAAX9999 and appsecret_proof=abcdef123456";
      const clean = sanitizeMarketingLog(dirty);
      expect(clean).toContain("Bearer [REDACTED_TOKEN]");
      expect(clean).toContain("appsecret_proof=[REDACTED_PROOF]");
      expect(clean).not.toContain("EAAX9999");
      expect(clean).not.toContain("abcdef123456");
    });
  });

  describe("getMetaMarketingConfig & validateMetaMarketingConfig", () => {
    it("defaults to official Graph API v21.0 and base URL", () => {
      const config = getMetaMarketingConfig();
      expect(config.baseUrl).toBe("https://graph.facebook.com");
      expect(config.apiVersion).toBe("v21.0");
      expect(config.isConfigured).toBe(false);
      expect(config.accessToken).toBe("");
    });

    it("recognizes configured credentials in environment", () => {
      process.env.META_ACCESS_TOKEN = "EAABmocktoken123456";
      process.env.META_AD_ACCOUNT_ID = "987654321";

      expect(isMetaMarketingConfigured()).toBe(true);
      const config = getMetaMarketingConfig();
      expect(config.isConfigured).toBe(true);
      expect(config.accessToken).toBe("EAABmocktoken123456");
      expect(config.adAccountId).toBe("act_987654321");
    });

    it("throws MarketingApiError when requireConfigured is true and token is missing", () => {
      expect(() => getMetaMarketingConfig({ requireConfigured: true })).toThrowError(
        MarketingApiError
      );
      try {
        getMetaMarketingConfig({ requireConfigured: true });
      } catch (err) {
        const error = err as MarketingApiError;
        expect(error.code).toBe("MISSING_CONFIGURATION");
        expect(error.message).toContain("META_ACCESS_TOKEN");
      }
    });

    it("throws MarketingApiError on invalid base URL protocol", () => {
      process.env.META_GRAPH_BASE_URL = "ftp://invalid-url";
      expect(() => getMetaMarketingConfig()).toThrowError(MarketingApiError);
    });

    it("validateMetaMarketingConfig returns status object without throwing", () => {
      const res = validateMetaMarketingConfig();
      expect(res.isValid).toBe(true);
      expect(res.config?.isConfigured).toBe(false);
    });
  });
});
