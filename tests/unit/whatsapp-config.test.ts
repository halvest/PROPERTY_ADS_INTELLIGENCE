import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  getWhatsAppConfig,
  verifyWebhookChallenge,
  verifyWebhookSignature,
  hashPhoneNumber,
  maskPhoneNumber,
  sanitizeWhatsAppLog,
  getWhatsAppIntegrationStatus,
  getTenantWhatsAppConnectionStatus,
} from "@/lib/whatsapp/config";
import type { WhatsAppConnectionRecord } from "@/lib/whatsapp/types";

describe("WhatsApp Cloud API - Config & Security Utilities", () => {
  const originalEnv = process.env;
  const testSecret = "whatsapp_secret_app_key_999";
  const testVerifyToken = "my_custom_verify_token_123";

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getWhatsAppConfig", () => {
    it("returns isConfigured: false when tokens are unset", () => {
      const config = getWhatsAppConfig();
      expect(config.isConfigured).toBe(false);
      expect(config.verifyToken).toBe("");
    });

    it("returns isConfigured: true when verify token and app secret are present", () => {
      process.env.WHATSAPP_VERIFY_TOKEN = testVerifyToken;
      process.env.WHATSAPP_APP_SECRET = testSecret;

      const config = getWhatsAppConfig();
      expect(config.isConfigured).toBe(true);
      expect(config.verifyToken).toBe(testVerifyToken);
      expect(config.appSecret).toBe(testSecret);
    });

    it("in production, strictly rejects global customer credentials from environment", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });

      process.env.WHATSAPP_VERIFY_TOKEN = testVerifyToken;
      process.env.WHATSAPP_APP_SECRET = testSecret;
      process.env.WHATSAPP_PHONE_NUMBER_ID = "phone_123456";
      process.env.WHATSAPP_ACCESS_TOKEN = "global_token_xyz";

      const config = getWhatsAppConfig();
      expect(config.phoneNumberId).toBeUndefined();
      expect(config.accessToken).toBeUndefined();

      Object.defineProperty(process.env, "NODE_ENV", { value: originalNodeEnv, configurable: true });
    });
  });

  describe("verifyWebhookChallenge (GET)", () => {
    it("returns isValid: true and echoes challenge when mode and token match", () => {
      const result = verifyWebhookChallenge(
        "subscribe",
        testVerifyToken,
        "challenge_code_7777",
        testVerifyToken
      );

      expect(result.isValid).toBe(true);
      expect(result.challenge).toBe("challenge_code_7777");
    });

    it("rejects challenge when token does not match", () => {
      const result = verifyWebhookChallenge(
        "subscribe",
        "wrong_token",
        "challenge_code_7777",
        testVerifyToken
      );

      expect(result.isValid).toBe(false);
      expect(result.challenge).toBeUndefined();
    });

    it("rejects challenge when mode is not 'subscribe'", () => {
      const result = verifyWebhookChallenge(
        "other_mode",
        testVerifyToken,
        "challenge_code_7777",
        testVerifyToken
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe("verifyWebhookSignature (POST HMAC-SHA256)", () => {
    const rawPayload = JSON.stringify({ object: "whatsapp_business_account" });

    it("validates authentic Meta signature correctly", () => {
      const hmac = crypto
        .createHmac("sha256", testSecret)
        .update(rawPayload, "utf8")
        .digest("hex");
      const signatureHeader = `sha256=${hmac}`;

      const isValid = verifyWebhookSignature(rawPayload, signatureHeader, testSecret);
      expect(isValid).toBe(true);
    });

    it("rejects tampered raw payload", () => {
      const hmac = crypto
        .createHmac("sha256", testSecret)
        .update(rawPayload, "utf8")
        .digest("hex");
      const signatureHeader = `sha256=${hmac}`;

      const tamperedPayload = JSON.stringify({ object: "tampered_account" });
      const isValid = verifyWebhookSignature(tamperedPayload, signatureHeader, testSecret);
      expect(isValid).toBe(false);
    });

    it("rejects signature signed with different secret", () => {
      const hmac = crypto
        .createHmac("sha256", "wrong_secret")
        .update(rawPayload, "utf8")
        .digest("hex");
      const signatureHeader = `sha256=${hmac}`;

      const isValid = verifyWebhookSignature(rawPayload, signatureHeader, testSecret);
      expect(isValid).toBe(false);
    });

    it("rejects missing or malformed signature header", () => {
      expect(verifyWebhookSignature(rawPayload, null, testSecret)).toBe(false);
      expect(verifyWebhookSignature(rawPayload, "invalid_header", testSecret)).toBe(false);
    });
  });

  describe("hashPhoneNumber & maskPhoneNumber", () => {
    it("hashes phone numbers deterministically with salt", () => {
      const hash1 = hashPhoneNumber("6281298765432");
      const hash2 = hashPhoneNumber("+62 812-9876-5432"); // stripped formatting
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it("masks phone numbers properly to protect buyer PII", () => {
      expect(maskPhoneNumber("6281298765432")).toBe("+62 812-****-432");
      expect(maskPhoneNumber("081398765123")).toBe("+62 813-****-123");
      expect(maskPhoneNumber("")).toBe("+62 ***-****-***");
    });
  });

  describe("sanitizeWhatsAppLog", () => {
    it("redacts secret keys and SHA-256 signatures from logs", () => {
      const dirty = `Processing with secret: ${testSecret} and sha256=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789`;
      const clean = sanitizeWhatsAppLog(dirty, testSecret);

      expect(clean).not.toContain(testSecret);
      expect(clean).toContain("[REDACTED_SECRET]");
      expect(clean).toContain("sha256=[REDACTED_SIGNATURE]");
    });
  });

  describe("getWhatsAppIntegrationStatus & per-connection operational status", () => {
    const mockConnection: WhatsAppConnectionRecord = {
      id: "conn-123",
      organizationId: "org-1",
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
      displayPhoneNumber: "+62 812-3456-7890",
      verifiedName: "Haspro Property",
      connectionStatus: "connected",
      coexistenceEnabled: true,
      metadata: {},
      connectedBy: "user-1",
      lastWebhookReceivedAt: "2026-10-26T12:00:00Z",
      createdAt: "2026-10-26T10:00:00Z",
      updatedAt: "2026-10-26T12:00:00Z",
    };

    it("returns 'live_verified' when customer connection has verified webhook event", () => {
      expect(getWhatsAppIntegrationStatus(mockConnection)).toBe("live_verified");
      expect(getTenantWhatsAppConnectionStatus(mockConnection)).toBe("live_verified");
    });

    it("returns 'configured' when connection is connected but has not received webhook yet", () => {
      const pendingConn: WhatsAppConnectionRecord = {
        ...mockConnection,
        lastWebhookReceivedAt: null,
      };
      expect(getWhatsAppIntegrationStatus(pendingConn)).toBe("configured");
      expect(getTenantWhatsAppConnectionStatus(pendingConn)).toBe("connected");
    });

    it("returns 'not_configured' or 'disconnected' when connection is disconnected or null", () => {
      const disconnectedConn: WhatsAppConnectionRecord = {
        ...mockConnection,
        connectionStatus: "disconnected",
      };
      expect(getWhatsAppIntegrationStatus(disconnectedConn)).toBe("not_configured");
      expect(getTenantWhatsAppConnectionStatus(disconnectedConn)).toBe("disconnected");
      expect(getTenantWhatsAppConnectionStatus(null)).toBe("disconnected");
    });

    it("returns 'configured' for platform readiness when server webhook credentials are set", () => {
      process.env.WHATSAPP_VERIFY_TOKEN = testVerifyToken;
      process.env.WHATSAPP_APP_SECRET = testSecret;
      expect(getWhatsAppIntegrationStatus()).toBe("configured");
    });

    it("returns 'mock' when in test/demo mode without credentials", () => {
      delete process.env.WHATSAPP_VERIFY_TOKEN;
      delete process.env.WHATSAPP_APP_SECRET;
      expect(getWhatsAppIntegrationStatus()).toBe("mock");
    });

    it("returns 'not_configured' when in production with missing platform credentials", () => {
      delete process.env.WHATSAPP_VERIFY_TOKEN;
      delete process.env.WHATSAPP_APP_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
      process.env.ENABLE_DEMO_DATA = "false";
      expect(getWhatsAppIntegrationStatus()).toBe("not_configured");
      Object.defineProperty(process.env, "NODE_ENV", { value: originalNodeEnv, configurable: true });
    });
  });
});

