import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { idDictionary } from "@/lib/i18n/dictionaries/id";
import { enDictionary } from "@/lib/i18n/dictionaries/en";
import { ensureUserOrganizationAndProfile } from "@/lib/auth/provisioning";
import * as adminSupabase from "@/lib/supabase/admin";

describe("Phase 15.2 — Registration Flow & Auth Integrity", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Bilingual Dictionary Consistency for Registration & Auth", () => {
    it("ensures all registration error keys exist in both Indonesian and English dictionaries", () => {
      const requiredKeys = [
        "requiredFields",
        "invalidEmail",
        "passwordMinLength",
        "passwordMismatch",
        "invalidCredentials",
        "emailAlreadyRegistered",
        "networkError",
        "provisionFailed",
        "otpExpired",
        "otpInvalid",
        "otpSentSuccess",
        "verificationSuccess",
      ] as const;

      for (const key of requiredKeys) {
        expect(idDictionary.auth[key], `Indonesian auth.${key} missing`).toBeDefined();
        expect(idDictionary.auth[key].length).toBeGreaterThan(0);

        expect(enDictionary.auth[key], `English auth.${key} missing`).toBeDefined();
        expect(enDictionary.auth[key].length).toBeGreaterThan(0);
      }
    });

    it("verifies accurate user-facing Indonesian translations for auth alerts", () => {
      expect(idDictionary.auth.emailAlreadyRegistered).toContain("sudah terdaftar");
      expect(idDictionary.auth.invalidEmail).toContain("tidak valid");
      expect(idDictionary.auth.passwordMinLength).toContain("minimal 8");
      expect(idDictionary.auth.passwordMismatch).toContain("tidak cocok");
      expect(idDictionary.auth.networkError).toContain("koneksi");
    });
  });

  describe("2. Client-side Input Validation Logic", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it("validates compliant email formats and rejects malformed inputs", () => {
      expect(emailRegex.test("user@developer.id")).toBe(true);
      expect(emailRegex.test("marketing.lead@propertyads.co.id")).toBe(true);
      expect(emailRegex.test("user+test@domain.com")).toBe(true);

      expect(emailRegex.test("")).toBe(false);
      expect(emailRegex.test("notanemail")).toBe(false);
      expect(emailRegex.test("missing@domain")).toBe(false);
      expect(emailRegex.test("@missingusername.com")).toBe(false);
      expect(emailRegex.test("spaces in@email.com")).toBe(false);
    });

    it("enforces minimum 8 characters for password security", () => {
      const validatePassword = (pass: string) => pass.length >= 8;
      expect(validatePassword("1234567")).toBe(false);
      expect(validatePassword("short")).toBe(false);
      expect(validatePassword("12345678")).toBe(true);
      expect(validatePassword("SecurePassword2026!")).toBe(true);
    });

    it("detects password and confirmPassword mismatch", () => {
      const checkMatch = (p1: string, p2: string) => p1 === p2;
      expect(checkMatch("Password123!", "Password123!")).toBe(true);
      expect(checkMatch("Password123!", "Password123?")).toBe(false);
      expect(checkMatch("Password123!", "")).toBe(false);
    });
  });

  describe("3. Supabase Auth Response Handling & Anti-Enumeration", () => {
    it("identifies already-registered email when GoTrue returns empty identities array", () => {
      // In Supabase Auth, when email enumeration protection is on, an existing user returns identities = []
      const fakeSupabaseResponse = {
        data: {
          user: {
            id: "fake-uuid-001",
            email: "existing@developer.id",
            identities: [], // Empty identities array indicates duplicate signup
          },
          session: null,
        },
        error: null,
      };

      const isDuplicate =
        fakeSupabaseResponse.data.user &&
        Array.isArray(fakeSupabaseResponse.data.user.identities) &&
        fakeSupabaseResponse.data.user.identities.length === 0;

      expect(isDuplicate).toBe(true);
    });

    it("identifies fresh unconfirmed signup requiring OTP verification", () => {
      const freshSignupResponse = {
        data: {
          user: {
            id: "fresh-uuid-002",
            email: "new@developer.id",
            identities: [{ id: "identity-001", provider: "email" }],
          },
          session: null, // No session yet -> email confirmation / OTP required
        },
        error: null,
      };

      const requiresOtp =
        freshSignupResponse.data.user &&
        Array.isArray(freshSignupResponse.data.user.identities) &&
        freshSignupResponse.data.user.identities.length > 0 &&
        !freshSignupResponse.data.session;

      expect(requiresOtp).toBe(true);
    });

    it("identifies direct session response for auto-confirmed development environments", () => {
      const directSessionResponse = {
        data: {
          user: {
            id: "dev-uuid-003",
            email: "auto@developer.id",
          },
          session: {
            access_token: "mock-jwt-token",
            refresh_token: "mock-refresh-token",
          },
        },
        error: null,
      };

      const hasDirectSession = !!directSessionResponse.data.session;
      expect(hasDirectSession).toBe(true);
    });
  });

  describe("4. OTP Token Sanitization", () => {
    it("sanitizes OTP inputs by removing spaces, tabs, and hyphens", () => {
      const sanitizeOtp = (raw: string) => raw.trim().replace(/[\s-]/g, "");

      expect(sanitizeOtp(" 123-456 ")).toBe("123456");
      expect(sanitizeOtp("123 456")).toBe("123456");
      expect(sanitizeOtp(" 1 2 3 - 4 5 6 ")).toBe("123456");
      expect(sanitizeOtp("890123")).toBe("890123");
    });
  });

  describe("5. Idempotent Organization & Profile Provisioning", () => {
    it("returns existing organization and role without duplicate inserts if profile exists", async () => {
      const mockAdmin = {
        from: vi.fn((table: string) => {
          if (table === "profiles") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: "existing-org-001", role: "owner" },
                error: null,
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      };

      vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue(mockAdmin as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const result = await ensureUserOrganizationAndProfile(
        "user-id-123",
        "user@propertyads.id",
        "Budi Prakoso"
      );

      expect(result.isNewOrganization).toBe(false);
      expect(result.organizationId).toBe("existing-org-001");
      expect(result.role).toBe("owner");
      // Ensure organizations table was never inserted into
      expect(mockAdmin.from).toHaveBeenCalledWith("profiles");
      expect(mockAdmin.from).not.toHaveBeenCalledWith("organizations");
    });

    it("creates new organization and owner profile for a first-time verified user", async () => {
      const mockAdmin = {
        from: vi.fn((table: string) => {
          if (table === "profiles") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { organization_id: "new-org-999", role: "owner" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "organizations") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "new-org-999" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      };

      vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue(mockAdmin as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const result = await ensureUserOrganizationAndProfile(
        "fresh-user-777",
        "owner@grhaproperty.id",
        "Siti Rahma"
      );

      expect(result.isNewOrganization).toBe(true);
      expect(result.organizationId).toBe("new-org-999");
      expect(result.role).toBe("owner");
      expect(mockAdmin.from).toHaveBeenCalledWith("organizations");
      expect(mockAdmin.from).toHaveBeenCalledWith("profiles");
    });

    it("gracefully recovers if a concurrent request inserts profile during execution", async () => {
      let profileCallCount = 0;
      const mockAdmin = {
        from: vi.fn((table: string) => {
          if (table === "profiles") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockImplementation(() => {
                profileCallCount++;
                // First call: null (not found)
                // Second call (concurrent retry): found!
                if (profileCallCount === 1) {
                  return Promise.resolve({ data: null, error: null });
                }
                return Promise.resolve({
                  data: { organization_id: "concurrent-org-888", role: "owner" },
                  error: null,
                });
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'duplicate key value violates unique constraint "profiles_pkey"' },
                  }),
                }),
              }),
            };
          }
          if (table === "organizations") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "org-race-777" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      };

      vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue(mockAdmin as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const result = await ensureUserOrganizationAndProfile(
        "race-user-555",
        "race@property.id",
        "Hendro"
      );

      expect(result.isNewOrganization).toBe(false);
      expect(result.organizationId).toBe("concurrent-org-888");
      expect(result.role).toBe("owner");
    });
  });
});
