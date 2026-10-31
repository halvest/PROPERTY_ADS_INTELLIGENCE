import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  tokenRows: new Map<string, unknown>(),
  clientCalls: [] as Array<{ accessToken?: string }>,
  upserts: [] as Array<{ table: string; payload: unknown }>,
  assetsByToken: new Map<string, { pages: unknown[]; accounts: unknown[] }>(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => {
        const state: { org?: string } = {};
        const chain: Record<string, unknown> = {};
        chain.eq = (col: string, val: unknown) => {
          if (col === "organization_id") state.org = val as string;
          return chain;
        };
        chain.maybeSingle = async () => ({
          data:
            table === "meta_user_tokens"
              ? (hoisted.tokenRows.get(state.org || "") ?? null)
              : null,
          error: null,
        });
        chain.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [], error: null });
        return chain;
      },
      upsert: (payload: unknown) => {
        hoisted.upserts.push({ table, payload });
        const row = {
          id: "sel-1",
          organization_id: ORG_A,
          page_id: null,
          page_name: null,
          instagram_account_id: null,
          instagram_username: null,
          ad_account_id: "act_111",
          ad_account_name: "Account A",
          connection_status: "connected",
          last_validated_at: null,
          ...((payload as object) ?? {}),
        };
        const result = { data: row, error: null };
        return {
          ...result,
          select: () => ({ single: async () => result }),
          then: (resolve: (v: typeof result) => void) => resolve(result),
        };
      },
    }),
  }),
}));

vi.mock("@/lib/marketing/meta/client", () => ({
  MetaMarketingApiClient: class {
    constructor(opts: { accessToken?: string }) {
      hoisted.clientCalls.push({ accessToken: opts.accessToken });
      this.token = opts.accessToken;
    }
    token?: string;
    async getFacebookPages() {
      return hoisted.assetsByToken.get(this.token || "")?.pages ?? [];
    }
    async getAdAccounts() {
      return hoisted.assetsByToken.get(this.token || "")?.accounts ?? [];
    }
  },
}));

import { NextRequest } from "next/server";
import {
  getAvailableAndSelectedMetaAssets,
  saveSelectedMetaAssets,
} from "@/lib/marketing/meta/asset-onboarding-service";
import { encryptAccessToken } from "@/lib/security/credential-crypto";
import { GET as callbackGet } from "@/app/api/auth/meta/callback/route";
import * as serverSupabase from "@/lib/supabase/server";
import { generateOAuthCsrfState } from "@/lib/security/credential-crypto";

const ORG_A = "aaaaaaaa-0000-0000-0000-000000000001";
const ORG_B = "bbbbbbbb-0000-0000-0000-000000000002";

function tokenRow(token: string) {
  const enc = encryptAccessToken(token);
  return {
    encrypted_access_token: enc.encryptedToken,
    encryption_iv: enc.iv,
    encryption_tag: enc.tag,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    granted_scopes: ["ads_read"],
  };
}

describe("Meta multi-tenant isolation", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, TOKEN_ENCRYPTION_KEY: "test-encryption-key-1234567890" };
    hoisted.tokenRows.clear();
    hoisted.clientCalls.length = 0;
    hoisted.upserts.length = 0;
    hoisted.assetsByToken.clear();
  });
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("tenant without a Meta connection sees not_connected even when a global env token exists", async () => {
    process.env.META_ACCESS_TOKEN = "global-operator-token";
    hoisted.assetsByToken.set("global-operator-token", {
      pages: [{ id: "page-haspro", name: "Haspro Digital Creative" }],
      accounts: [{ id: "act_407457194671566", name: "HDC Property" }],
    });

    const result = await getAvailableAndSelectedMetaAssets(ORG_B);

    expect(result.tokenStatus).toBe("not_connected");
    expect(result.pages).toEqual([]);
    expect(result.adAccounts).toEqual([]);
    // The global env token must never be used to list a tenant's assets.
    expect(hoisted.clientCalls).toEqual([]);
    delete process.env.META_ACCESS_TOKEN;
  });

  it("tenant assets come only from that tenant's own OAuth token", async () => {
    hoisted.tokenRows.set(ORG_A, tokenRow("token-org-a"));
    hoisted.assetsByToken.set("token-org-a", {
      pages: [{ id: "page-a", name: "Page A" }],
      accounts: [{ id: "act_111", name: "Account A" }],
    });

    const result = await getAvailableAndSelectedMetaAssets(ORG_A);

    expect(result.tokenStatus).toBe("valid");
    expect(result.adAccounts[0].id).toBe("act_111");
    expect(hoisted.clientCalls).toEqual([{ accessToken: "token-org-a" }]);
  });

  it("rejects selecting an ad account that the tenant connection cannot access", async () => {
    hoisted.tokenRows.set(ORG_B, tokenRow("token-org-b"));
    hoisted.assetsByToken.set("token-org-b", {
      pages: [],
      accounts: [{ id: "act_222", name: "Account B" }],
    });

    await expect(
      saveSelectedMetaAssets(ORG_B, "user-b", { adAccountId: "act_407457194671566" })
    ).rejects.toThrow("tidak termasuk aset");
    expect(hoisted.upserts).toEqual([]);
  });

  it("saves a selection using canonical names returned by Meta, not client names", async () => {
    hoisted.tokenRows.set(ORG_A, tokenRow("token-org-a"));
    hoisted.assetsByToken.set("token-org-a", {
      pages: [{ id: "page-a", name: "Page A" }],
      accounts: [{ id: "act_111", name: "Account A", currency: "IDR", timezone_name: "Asia/Jakarta" }],
    });

    const saved = await saveSelectedMetaAssets(ORG_A, "user-a", {
      adAccountId: "act_111",
      adAccountName: "Forged Name",
      pageId: "page-a",
      pageName: "Forged Page",
    });

    expect(saved.adAccountName).toBe("Account A");
    expect(saved.pageName).toBe("Page A");
  });

  it("OAuth callback rejects a request without the authorize state cookie", async () => {
    const state = generateOAuthCsrfState({ organizationId: ORG_A, userId: "user-a" });
    vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-a" } }, error: null }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { organization_id: ORG_A, role: "owner" } }),
          }),
        }),
      }),
    } as never);

    const req = new NextRequest(
      `http://localhost:3000/api/auth/meta/callback?code=x&state=${encodeURIComponent(state)}`
    );
    const res = await callbackGet(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid_csrf_state");
  });

  it("OAuth callback cannot bind a token to another organization via a foreign state", async () => {
    const foreignState = generateOAuthCsrfState({ organizationId: ORG_A, userId: "user-b" });
    vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "user-b" } }, error: null }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { organization_id: ORG_B, role: "owner" } }),
          }),
        }),
      }),
    } as never);

    const req = new NextRequest(
      `http://localhost:3000/api/auth/meta/callback?code=x&state=${encodeURIComponent(foreignState)}`,
      { headers: { cookie: `meta_oauth_state=${encodeURIComponent(foreignState)}` } }
    );
    const res = await callbackGet(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid_csrf_state");
  });
});
