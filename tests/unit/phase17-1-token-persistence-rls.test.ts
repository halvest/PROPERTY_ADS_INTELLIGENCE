import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET as metaCallbackGet } from "@/app/api/auth/meta/callback/route";
import { persistMetaUserToken } from "@/lib/marketing/meta/token-storage";
import { generateOAuthCsrfState, encryptAccessToken } from "@/lib/whatsapp/crypto";
import * as serverSupabase from "@/lib/supabase/server";

describe("Phase 17.1 — Meta OAuth Token Persistence RLS & Multi-Tenant Isolation", () => {
  const orgId = "11111111-2222-3333-4444-555555555555";
  const otherOrgId = "99999999-8888-7777-6666-555555555555";
  const userId = "user_owner_haspro_123";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.META_APP_ID = "test_meta_app_12345";
    process.env.META_APP_SECRET = "test_meta_app_secret_abcde12345";
    process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  describe("1. Token Storage Helper (persistMetaUserToken)", () => {
    it("successfully persists an encrypted token record using upsert", async () => {
      const encrypted = encryptAccessToken("EAABtest_token_content");
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: mockUpsert,
        }),
      } as unknown as SupabaseClient;

      const result = await persistMetaUserToken({
        organizationId: orgId,
        userId,
        encryptedAccessToken: encrypted.encryptedToken,
        encryptionIv: encrypted.iv,
        encryptionTag: encrypted.tag,
        expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        grantedScopes: ["ads_read", "pages_read_engagement"],
        supabaseClient: mockSupabase,
      });

      expect(result.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: orgId,
          user_id: userId,
          encrypted_access_token: encrypted.encryptedToken,
          encryption_iv: encrypted.iv,
          encryption_tag: encrypted.tag,
        }),
        { onConflict: "organization_id" }
      );
    });

    it("rejects token persistence when organization_id or user_id is missing", async () => {
      const encrypted = encryptAccessToken("EAABtest_token_content");
      const result = await persistMetaUserToken({
        organizationId: "",
        userId,
        encryptedAccessToken: encrypted.encryptedToken,
        encryptionIv: encrypted.iv,
        encryptionTag: encrypted.tag,
        expiresAt: new Date().toISOString(),
        grantedScopes: ["ads_read"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("organization_id and user_id are required");
    });

    it("handles idempotent duplicate callbacks safely by updating existing organization token", async () => {
      const encrypted1 = encryptAccessToken("EAABtoken_1");
      const encrypted2 = encryptAccessToken("EAABtoken_2");
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: mockUpsert,
        }),
      } as unknown as SupabaseClient;

      // First callback
      const res1 = await persistMetaUserToken({
        organizationId: orgId,
        userId,
        encryptedAccessToken: encrypted1.encryptedToken,
        encryptionIv: encrypted1.iv,
        encryptionTag: encrypted1.tag,
        expiresAt: new Date().toISOString(),
        grantedScopes: ["ads_read"],
        supabaseClient: mockSupabase,
      });

      // Second duplicate callback
      const res2 = await persistMetaUserToken({
        organizationId: orgId,
        userId,
        encryptedAccessToken: encrypted2.encryptedToken,
        encryptionIv: encrypted2.iv,
        encryptionTag: encrypted2.tag,
        expiresAt: new Date().toISOString(),
        grantedScopes: ["ads_read"],
        supabaseClient: mockSupabase,
      });

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(mockUpsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          organization_id: orgId,
          encrypted_access_token: encrypted2.encryptedToken,
        }),
        { onConflict: "organization_id" }
      );
    });
  });

  describe("2. Server-side Meta OAuth Callback Security Gates", () => {
    it("redirects unauthenticated callers to /login", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const req = new NextRequest("http://localhost:3000/api/auth/meta/callback?code=mock_code&state=mock_state");
      const res = await metaCallbackGet(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toContain("/login");
    });

    it("rejects users missing organization membership in profiles", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const req = new NextRequest("http://localhost:3000/api/auth/meta/callback?code=mock_code&state=mock_state");
      const res = await metaCallbackGet(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toContain("error=missing_organization");
    });

    it("rejects unauthorized user roles (e.g. sales agent)", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "sales" },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const state = generateOAuthCsrfState({ organizationId: orgId, userId });
      const req = new NextRequest(`http://localhost:3000/api/auth/meta/callback?code=mock_code&state=${state}`);
      const res = await metaCallbackGet(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toContain("error=forbidden_role");
    });

    it("rejects tampered or mismatched anti-CSRF state token", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "owner" },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      // State generated for another tenant (cross-tenant forgery attempt)
      const forgedState = generateOAuthCsrfState({ organizationId: otherOrgId, userId });
      const req = new NextRequest(`http://localhost:3000/api/auth/meta/callback?code=mock_code&state=${forgedState}`);
      const res = await metaCallbackGet(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toContain("error=invalid_csrf_state");
    });

    it("successfully exchanges code and persists token for authorized owner", async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === "profiles") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { organization_id: orgId, role: "owner" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            upsert: mockUpsert,
          };
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      // Mock Graph API token exchange responses
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            access_token: "EAAB_mock_short_lived_token",
            expires_in: 3600,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            access_token: "EAAB_mock_long_lived_token_60d",
            expires_in: 5184000,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: {
              is_valid: true,
              scopes: ["ads_read", "pages_read_engagement"],
            },
          }),
        } as unknown as Response);

      const validState = generateOAuthCsrfState({ organizationId: orgId, userId });
      const req = new NextRequest(`http://localhost:3000/api/auth/meta/callback?code=valid_meta_code&state=${validState}`);
      const res = await metaCallbackGet(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toContain("meta_connected=true");

      // Verify token was stored with AES-256 encrypted fields
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: orgId,
          user_id: userId,
          encrypted_access_token: expect.any(String),
          encryption_iv: expect.any(String),
          encryption_tag: expect.any(String),
        }),
        { onConflict: "organization_id" }
      );
    });
  });
});
