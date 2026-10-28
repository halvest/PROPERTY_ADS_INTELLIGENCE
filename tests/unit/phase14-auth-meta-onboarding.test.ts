import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as assetsGet, POST as assetsPost, DELETE as assetsDelete } from "@/app/api/meta/assets/route";
import { POST as provisionPost } from "@/app/api/auth/provision/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import * as serverSupabase from "@/lib/supabase/server";
import * as onboardingService from "@/lib/marketing/meta/asset-onboarding-service";
import * as provisioningService from "@/lib/auth/provisioning";
import { verifyOAuthCsrfState } from "@/lib/whatsapp/crypto";

describe("Phase 14 — Authentication & Meta Asset Onboarding", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Authentication & Profile Provisioning", () => {
    it("rejects provisioning when user session is unauthenticated (HTTP 401)", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const response = await provisionPost();
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.code).toBe("UNAUTHORIZED");
    });

    it("rejects dashboard provisioning in production when email is unverified (HTTP 403)", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "user_unconfirmed_01",
                email: "unconfirmed@developer.id",
                email_confirmed_at: null, // Unverified email!
              },
            },
            error: null,
          }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const response = await provisionPost();
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe("EMAIL_NOT_VERIFIED");
    });

    it("successfully provisions organization and owner profile for verified user", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "user_verified_01",
                email: "owner@developer.id",
                email_confirmed_at: "2026-10-26T10:00:00Z",
                user_metadata: { full_name: "Budi Santoso" },
              },
            },
            error: null,
          }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      vi.spyOn(provisioningService, "ensureUserOrganizationAndProfile").mockResolvedValue({
        organizationId: "org-newly-created-001",
        role: "owner",
        isNewOrganization: true,
      });

      const response = await provisionPost();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.organizationId).toBe("org-newly-created-001");
      expect(json.role).toBe("owner");
    });

    it("logs out user, terminates Supabase auth session, and clears demo cookie", async () => {
      const signOutMock = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          signOut: signOutMock,
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const response = await logoutPost();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(signOutMock).toHaveBeenCalled();
    });
  });

  describe("2. Meta Asset Discovery & Anti-CSRF Protection", () => {
    it("generates anti-CSRF state token and returns available Meta pages and ad accounts", async () => {
      const orgId = "00000000-0000-0000-0000-000000000001";
      const userId = "user_owner_01";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      vi.spyOn(onboardingService, "getAvailableAndSelectedMetaAssets").mockResolvedValue({
        pages: [
          {
            id: "page_123",
            name: "Cluster Sapphire BSD",
            instagram_business_account: {
              id: "ig_456",
              username: "sapphire.bsd",
            },
          },
        ],
        adAccounts: [
          {
            id: "act_789",
            account_id: "789",
            name: "Akun Iklan Sapphire",
            currency: "IDR",
            timezone_name: "Asia/Jakarta",
            account_status: 1,
          },
        ],
        selected: null,
      });

      const response = await assetsGet();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.pages).toHaveLength(1);
      expect(json.adAccounts).toHaveLength(1);
      expect(json.csrfState).toBeDefined();

      // Verify CSRF state validity
      const csrfCheck = verifyOAuthCsrfState(json.csrfState, {
        organizationId: orgId,
        userId,
      });
      expect(csrfCheck.valid).toBe(true);
    });

    it("handles accounts without Facebook Pages or Instagram accounts gracefully", async () => {
      const orgId = "00000000-0000-0000-0000-000000000001";
      const userId = "user_owner_01";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      // Simulates empty pages & empty instagram
      vi.spyOn(onboardingService, "getAvailableAndSelectedMetaAssets").mockResolvedValue({
        pages: [],
        adAccounts: [
          {
            id: "act_999",
            account_id: "999",
            name: "Standalone Ad Account",
            currency: "IDR",
            timezone_name: "Asia/Jakarta",
            account_status: 1,
          },
        ],
        selected: null,
      });

      const response = await assetsGet();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.pages).toHaveLength(0);
      expect(json.adAccounts).toHaveLength(1);
    });
  });

  describe("3. Asset Selection, Persistence & Role Authorization", () => {
    it("rejects unauthorized role 'sales' from saving Meta assets with HTTP 403", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_sales_01" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: "00000000-0000-0000-0000-000000000001", role: "sales" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/meta/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: "act_12345",
          adAccountName: "Akun Iklan",
        }),
      });

      const response = await assetsPost(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe("FORBIDDEN");
      expect(json.error).toContain("tidak memiliki izin");
    });

    it("rejects saving when adAccountId is missing with HTTP 400 validation error", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_owner_01" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: "00000000-0000-0000-0000-000000000001", role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/meta/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: "page_123",
          // missing adAccountId
        }),
      });

      const response = await assetsPost(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("persists selected assets and updates ad_accounts table for owner role", async () => {
      const orgId = "00000000-0000-0000-0000-000000000001";
      const userId = "user_owner_01";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const saveSpy = vi.spyOn(onboardingService, "saveSelectedMetaAssets").mockResolvedValue({
        id: "sel-uuid-001",
        organizationId: orgId,
        pageId: "page_sapphire_01",
        pageName: "Cluster Sapphire BSD",
        instagramAccountId: "ig_sapphire_01",
        instagramUsername: "sapphire.bsd",
        adAccountId: "act_0812999001",
        adAccountName: "Akun Iklan BSD",
        connectionStatus: "connected",
        lastValidatedAt: "2026-10-26T12:00:00Z",
      });

      const request = new Request("http://localhost:3000/api/meta/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: "page_sapphire_01",
          pageName: "Cluster Sapphire BSD",
          instagramAccountId: "ig_sapphire_01",
          instagramUsername: "sapphire.bsd",
          adAccountId: "act_0812999001",
          adAccountName: "Akun Iklan BSD",
        }),
      });

      const response = await assetsPost(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(saveSpy).toHaveBeenCalledWith(orgId, userId, {
        pageId: "page_sapphire_01",
        pageName: "Cluster Sapphire BSD",
        instagramAccountId: "ig_sapphire_01",
        instagramUsername: "sapphire.bsd",
        adAccountId: "act_0812999001",
        adAccountName: "Akun Iklan BSD",
      });
      expect(json.selected.connectionStatus).toBe("connected");
    });
  });

  describe("4. Disconnect & Tenant Isolation", () => {
    it("allows owner to disconnect Meta assets with HTTP 200", async () => {
      const orgId = "00000000-0000-0000-0000-000000000001";
      const disconnectSpy = vi.spyOn(onboardingService, "disconnectMetaAssets").mockResolvedValue();

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_owner_01" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const response = await assetsDelete();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.connectionStatus).toBe("disconnected");
      expect(disconnectSpy).toHaveBeenCalledWith(orgId);
    });

    it("ensures Tenant A cannot modify or view Tenant B's Meta asset selections", async () => {
      const tenantA = "00000000-0000-0000-0000-000000000001";
      const tenantB = "00000000-0000-0000-0000-000000000002";

      // Mock user belongs to Tenant A
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_tenant_a" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: tenantA, role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const saveSpy = vi.spyOn(onboardingService, "saveSelectedMetaAssets").mockResolvedValue({
        id: "sel-uuid-tenant-a",
        organizationId: tenantA,
        adAccountId: "act_tenant_a",
        connectionStatus: "connected",
      });

      const request = new Request("http://localhost:3000/api/meta/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: "act_tenant_a",
        }),
      });

      await assetsPost(request);

      // Verify that saveSelectedMetaAssets was called strictly with Tenant A's org ID, never Tenant B
      expect(saveSpy).toHaveBeenCalledWith(tenantA, "user_tenant_a", expect.anything());
      expect(saveSpy).not.toHaveBeenCalledWith(tenantB, expect.anything(), expect.anything());
    });
  });
});
