import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  tokenRows: new Map<string, unknown>(),
  upserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  accountsByToken: new Map<string, unknown[]>(),
  connectedByOrg: new Map<string, Array<Record<string, unknown>>>(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const state: { org?: string; eqs: Record<string, unknown> } = { eqs: {} };
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (col: string, val: unknown) => {
        state.eqs[col] = val;
        if (col === "organization_id") state.org = val as string;
        return builder;
      };
      builder.maybeSingle = async () => {
        if (table === "meta_user_tokens") {
          return { data: hoisted.tokenRows.get(state.org || "") ?? null, error: null };
        }
        if (table === "meta_asset_selections") return { data: null, error: null };
        if (table === "ad_accounts") {
          const list = hoisted.connectedByOrg.get(state.org || "") || [];
          const found = list.find(
            (r) => r.provider_account_id === state.eqs.provider_account_id
          );
          return { data: found ? { id: `id-${found.provider_account_id}` } : null, error: null };
        }
        return { data: null, error: null };
      };
      builder.upsert = (payload: Record<string, unknown>) => {
        hoisted.upserts.push({ table, payload });
        const result = { data: { id: "sel-1", ...payload }, error: null };
        return {
          ...result,
          select: () => ({ single: async () => result }),
          then: (resolve: (v: typeof result) => void) => resolve(result),
        };
      };
      builder.update = (payload: Record<string, unknown>) => {
        hoisted.updates.push({ table, payload });
        return builder;
      };
      builder.delete = () => builder;
      // Awaiting the builder directly (list queries / updates)
      builder.then = (resolve: (v: unknown) => void) => {
        if (table === "ad_accounts") {
          const list = hoisted.connectedByOrg.get(state.org || "") || [];
          const onlyConnected = state.eqs.connection_status === "connected";
          resolve({
            data: onlyConnected
              ? list.filter((r) => r.connection_status === "connected")
              : list,
            error: null,
          });
        } else {
          resolve({ data: [], error: null });
        }
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/marketing/meta/client", () => ({
  MetaMarketingApiClient: class {
    constructor(opts: { accessToken?: string }) {
      this.token = opts.accessToken;
    }
    token?: string;
    async getFacebookPages() {
      return [{ id: "page-1", name: "Page One", instagram_business_account: { id: "ig-1", username: "pageone" } }];
    }
    async getAdAccounts() {
      return hoisted.accountsByToken.get(this.token || "") ?? [];
    }
  },
}));

import {
  saveSelectedMetaAccounts,
  removeSelectedMetaAccount,
  getAvailableAndSelectedMetaAssets,
} from "@/lib/marketing/meta/asset-onboarding-service";
import { encryptAccessToken } from "@/lib/security/credential-crypto";

const ORG = "org-multi";

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

const ACCOUNTS = [
  { id: "act_111", account_id: "111", name: "Account One", currency: "IDR", timezone_name: "Asia/Jakarta", account_status: 1 },
  { id: "act_222", account_id: "222", name: "Account Two", currency: "USD", timezone_name: "Asia/Jakarta", account_status: 1 },
  { id: "act_333", account_id: "333", name: "Account Three", currency: "IDR", timezone_name: "Asia/Jakarta", account_status: 2 },
];

describe("Multi-account selection", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, TOKEN_ENCRYPTION_KEY: "test-encryption-key-1234567890" };
    hoisted.tokenRows.clear();
    hoisted.upserts.length = 0;
    hoisted.updates.length = 0;
    hoisted.accountsByToken.clear();
    hoisted.connectedByOrg.clear();
    hoisted.tokenRows.set(ORG, tokenRow("token-multi"));
    hoisted.accountsByToken.set("token-multi", ACCOUNTS);
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it("saves multiple validated accounts idempotently", async () => {
    const r1 = await saveSelectedMetaAccounts(ORG, "user-1", {
      adAccountIds: ["act_111", "222", "act_111"],
    });
    expect(r1.saved.map((s) => s.adAccountId)).toEqual(["act_111", "act_222"]);
    expect(r1.active.adAccountId).toBe("act_111");

    const accountUpserts = hoisted.upserts.filter((u) => u.table === "ad_accounts");
    expect(accountUpserts).toHaveLength(2);

    const r2 = await saveSelectedMetaAccounts(ORG, "user-1", {
      adAccountIds: ["act_111", "act_222"],
    });
    expect(r2.saved).toHaveLength(2);
  });

  it("rejects the whole save when one account is not accessible to the tenant", async () => {
    await expect(
      saveSelectedMetaAccounts(ORG, "user-1", { adAccountIds: ["act_111", "act_999"] })
    ).rejects.toThrow("act_999");
  });

  it("connected accounts are restored for the settings list", async () => {
    hoisted.connectedByOrg.set(ORG, [
      { provider_account_id: "act_111", account_name: "Account One", currency: "IDR", timezone: "Asia/Jakarta", connection_status: "connected", last_synced_at: null },
    ]);
    const assets = await getAvailableAndSelectedMetaAssets(ORG);
    expect(assets.connectedAccounts.map((a) => a.adAccountId)).toEqual(["act_111"]);
    expect(assets.adAccounts).toHaveLength(3);
    // Page payloads must never carry credentials
    expect(JSON.stringify(assets.pages)).not.toContain("access_token");
  });

  it("removing an account only marks that account disconnected for this org", async () => {
    hoisted.connectedByOrg.set(ORG, [
      { provider_account_id: "act_222", account_name: "Account Two", currency: "USD", timezone: "Asia/Jakarta", connection_status: "connected", last_synced_at: null },
    ]);
    // ad_accounts lookup for the removed row
    hoisted.connectedByOrg.get(ORG)!.push({
      provider_account_id: "act_111",
      account_name: "Account One",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      connection_status: "connected",
      last_synced_at: null,
    });
    const result = await removeSelectedMetaAccount(ORG, "act_111");
    expect(result.removed).toBe("act_111");
    const accUpdates = hoisted.updates.filter((u) => u.table === "ad_accounts");
    expect(accUpdates[0].payload.connection_status).toBe("disconnected");
  });

  it("expired tenant token reports invalid instead of listing accounts", async () => {
    const enc = encryptAccessToken("old-token");
    hoisted.tokenRows.set(ORG, {
      encrypted_access_token: enc.encryptedToken,
      encryption_iv: enc.iv,
      encryption_tag: enc.tag,
      expires_at: new Date(Date.now() - 1000).toISOString(),
      granted_scopes: ["ads_read"],
    });
    const assets = await getAvailableAndSelectedMetaAssets(ORG);
    expect(assets.tokenStatus).toBe("invalid");
    expect(assets.adAccounts).toEqual([]);
  });
});
