import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isServerDemoMode, DEMO_ORGANIZATION_ID } from "@/lib/auth/tenant";
import { hashPhoneNumber } from "@/lib/whatsapp/config";
import { hashPhoneNumber as crmHashPhoneNumber } from "@/lib/crm/crm-sheets-service";
import { encryptAccessToken } from "@/lib/whatsapp/crypto";
import { safeInternalRedirect } from "@/lib/security/redirect";

describe("Audit remediation", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it("rate limiter blocks after the configured limit", () => {
    const key = `test:${Date.now()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    const third = checkRateLimit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("redirect targets cannot send authenticated users to another origin", () => {
    expect(safeInternalRedirect("/ads?range=30d")).toBe("/ads?range=30d");
    expect(safeInternalRedirect("https://attacker.example/phishing")).toBe("/dashboard");
    expect(safeInternalRedirect("//attacker.example/phishing")).toBe("/dashboard");
    expect(safeInternalRedirect(null, "/settings")).toBe("/settings");
  });

  it("demo mode is server-configured only", () => {
    delete process.env.DATA_MODE;
    expect(isServerDemoMode()).toBe(false);
    process.env.DATA_MODE = "demo";
    expect(isServerDemoMode()).toBe(true);
    expect(DEMO_ORGANIZATION_ID).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("phone hash uses env secret consistently across whatsapp and crm modules", () => {
    process.env.PHONE_HASH_SECRET = "test-phone-hash-secret";
    expect(hashPhoneNumber("0812-3456-7890")).toBe(
      crmHashPhoneNumber("0812-3456-7890")
    );
    delete process.env.PHONE_HASH_SECRET;
  });

  it("production token encryption requires a dedicated TOKEN_ENCRYPTION_KEY", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.TOKEN_ENCRYPTION_KEY;
    process.env.WHATSAPP_APP_SECRET = "some-other-secret";
    expect(() => encryptAccessToken("secret-token")).toThrow(
      "TOKEN_ENCRYPTION_KEY wajib"
    );
  });

  it("webhook route passes a persistence client to the inbound processor", () => {
    const route = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/webhook/whatsapp/route.ts"),
      "utf-8"
    );
    expect(route).toContain("getWebhookSupabaseClient()");
    expect(route).toContain("supabaseClient: adminClient");
  });

  it("diagnostics route has no production fallback tenant", () => {
    const route = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ads/diagnostics/route.ts"),
      "utf-8"
    );
    expect(route).toContain('code: "UNAUTHORIZED"');
    expect(route).toContain('code: "FORBIDDEN"');
    expect(route).not.toContain("act_407457194671566");
  });
});
