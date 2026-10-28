import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as authCallbackGet } from "@/app/auth/callback/route";
import * as serverSupabase from "@/lib/supabase/server";
import * as provisioningService from "@/lib/auth/provisioning";
import { idDictionary } from "@/lib/i18n/dictionaries/id";
import { enDictionary } from "@/lib/i18n/dictionaries/en";

describe("Phase 16 — Premium SaaS Authentication & Google OAuth", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Bilingual Dictionary Consistency for Phase 16", () => {
    it("ensures all Phase 16 auth keys exist and match across Indonesian and English", () => {
      const keys = [
        "welcomeBackTitle",
        "welcomeBackSubtitle",
        "continueWithGoogle",
        "orContinueWithEmail",
        "brandHeadline",
        "brandSubheadline",
        "sampleDataDisclaimer",
        "oauthFailed",
      ] as const;

      for (const k of keys) {
        expect(idDictionary.auth[k], `Missing ID auth.${k}`).toBeDefined();
        expect(idDictionary.auth[k].length).toBeGreaterThan(0);

        expect(enDictionary.auth[k], `Missing EN auth.${k}`).toBeDefined();
        expect(enDictionary.auth[k].length).toBeGreaterThan(0);
      }
    });

    it("verifies accurate user-facing Indonesian and English translations", () => {
      expect(idDictionary.auth.continueWithGoogle).toBe("Lanjutkan dengan Google");
      expect(enDictionary.auth.continueWithGoogle).toBe("Continue with Google");

      expect(idDictionary.auth.brandHeadline).toContain("Ubah Iklan Properti");
      expect(enDictionary.auth.brandHeadline).toContain("Turn Property Ads");

      expect(idDictionary.auth.welcomeBackTitle).toBe("Selamat Datang Kembali");
      expect(enDictionary.auth.welcomeBackTitle).toBe("Welcome back");
    });
  });

  describe("2. Server-side OAuth Callback Handling (/auth/callback)", () => {
    it("redirects to login with error param when OAuth provider returns an error", async () => {
      const req = new NextRequest("http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled");
      const res = await authCallbackGet(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("error=User+cancelled");
    });

    it("successfully exchanges authorization code, provisions workspace, and redirects to dashboard", async () => {
      const mockExchange = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "google-user-uuid-001",
            email: "google.tester@gmail.com",
            user_metadata: { full_name: "Google Tester" },
          },
          session: { access_token: "mock-jwt" },
        },
        error: null,
      });

      const mockGetUser = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "google-user-uuid-001",
            email: "google.tester@gmail.com",
            user_metadata: { full_name: "Google Tester" },
          },
        },
        error: null,
      });

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchange,
          getUser: mockGetUser,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const mockEnsure = vi.spyOn(provisioningService, "ensureUserOrganizationAndProfile").mockResolvedValue({
        organizationId: "org-google-001",
        role: "owner",
        isNewOrganization: true,
      });

      const req = new NextRequest("http://localhost:3000/auth/callback?code=mock-auth-code-123&redirect=%2Fdashboard");
      const res = await authCallbackGet(req);

      expect(mockExchange).toHaveBeenCalledWith("mock-auth-code-123");
      expect(mockEnsure).toHaveBeenCalledWith("google-user-uuid-001", "google.tester@gmail.com", "Google Tester");
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBe("http://localhost:3000/dashboard");
    });

    it("handles code exchange error gracefully and redirects to login", async () => {
      const mockExchange = vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid authorization code" },
      });

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchange,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const req = new NextRequest("http://localhost:3000/auth/callback?code=expired-code-999");
      const res = await authCallbackGet(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("error=Invalid+authorization+code");
    });
  });

  describe("3. Preserves Custom Destination Redirection", () => {
    it("redirects to the requested deep-link after successful OAuth authentication", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: {
              user: { id: "google-user-002", email: "user@domain.com" },
            },
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "google-user-002", email: "user@domain.com" } },
            error: null,
          }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      vi.spyOn(provisioningService, "ensureUserOrganizationAndProfile").mockResolvedValue({
        organizationId: "org-002",
        role: "owner",
        isNewOrganization: false,
      });

      const req = new NextRequest("http://localhost:3000/auth/callback?code=valid-code&redirect=%2Fsettings");
      const res = await authCallbackGet(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/settings");
    });
  });
});
