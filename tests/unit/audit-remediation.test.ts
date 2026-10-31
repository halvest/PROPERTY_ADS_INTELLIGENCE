import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { encryptAccessToken } from "@/lib/security/credential-crypto";
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

  it("production routes have no tenant demo mode switch", () => {
    const proxy = fs.readFileSync(path.resolve(import.meta.dirname, "../../src/proxy.ts"), "utf-8");
    const dashboardRoute = fs.readFileSync(path.resolve(import.meta.dirname, "../../src/app/api/dashboard/summary/route.ts"), "utf-8");
    expect(proxy).not.toContain("DATA_MODE");
    expect(dashboardRoute).not.toContain("forceDemo");
  });

  it("production token encryption requires a dedicated TOKEN_ENCRYPTION_KEY", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptAccessToken("secret-token")).toThrow(
      "TOKEN_ENCRYPTION_KEY wajib"
    );
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
