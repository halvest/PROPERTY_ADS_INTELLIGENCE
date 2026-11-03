import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeMarketingSync } from "@/lib/marketing/meta/sync-service";
import { MetaMarketingApiClient } from "@/lib/marketing/meta/client";

/**
 * Phase 1 data-integrity tests (DI-01..DI-04) against executeMarketingSync
 * with a capturing in-memory Supabase mock. These exercise the real
 * validation/mapping/persistence pipeline, not just internal mocks.
 */

type Row = Record<string, unknown>;

function makeBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "gte", "limit", "select", "in"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function makeDb(captured: { insightsUpserts: Row[][]; tables: string[] }) {
  const campaigns = [{ id: "cmp-uuid-1", provider_campaign_id: "cmp_1" }];
  const ads = [{ id: "ad-uuid-1", provider_ad_id: "ad_1" }];
  return {
    from(table: string) {
      captured.tables.push(table);
      switch (table) {
        case "meta_user_tokens":
          return { select: () => makeBuilder({ data: null, error: null }) };
        case "meta_asset_selections":
        case "ad_accounts":
          return {
            select: () => ({
              ...makeBuilder({ data: null, error: null }),
              eq: () => makeBuilder({ data: null, error: null }),
            }),
            upsert: () => ({ select: () => ({ single: async () => ({ data: { id: "acc-uuid" }, error: null }) }) }),
            update: () => makeBuilder({ error: null }),
          };
        case "sync_jobs":
          return {
            select: () => makeBuilder({ data: [], error: null }),
            insert: () => ({ select: () => ({ single: async () => ({ data: { id: "job-1" }, error: null }) }) }),
            update: () => makeBuilder({ error: null }),
          };
        case "campaigns":
          return {
            upsert: async () => ({ error: null }),
            select: () => makeBuilder({ data: campaigns, error: null }),
          };
        case "ads":
          return {
            upsert: async () => ({ error: null }),
            select: () => makeBuilder({ data: ads, error: null }),
          };
        case "ad_insights":
          return {
            upsert: async (rows: Row[]) => {
              captured.insightsUpserts.push(rows);
              return { error: null };
            },
          };
        case "integration_connections":
          return { update: () => makeBuilder({ error: null }) };
        default:
          return { select: () => makeBuilder({ data: null, error: null }) };
      }
    },
  };
}

function makeClient(insights: Row[]) {
  return {
    getAdAccount: async () => ({ id: "act_111", name: "A", currency: "IDR", timezone_name: "Asia/Jakarta", account_status: 1 }),
    getCampaigns: async () => [{ id: "cmp_1", name: "C1", status: "ACTIVE", objective: "OUTCOME_LEADS" }],
    getAds: async () => [{ id: "ad_1", name: "Ad 1", status: "ACTIVE", campaign_id: "cmp_1" }],
    getAdInsights: async () => insights,
  };
}

const validRow = {
  ad_id: "ad_1",
  ad_name: "Ad 1",
  campaign_id: "cmp_1",
  spend: "10000",
  impressions: "1000",
  clicks: "50",
  date_start: "2026-10-01",
  date_stop: "2026-10-01",
};

describe("Phase 1 sync data integrity", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("DI-01: one invalid row does not abort the valid rows in the batch", async () => {
    const captured = { insightsUpserts: [] as Row[][], tables: [] as string[] };
    const client = makeClient([
      validRow,
      { ...validRow, ad_id: "ad_1", spend: undefined as never },
      { ...validRow, date_start: "2026-10-02", date_stop: "2026-10-02" },
    ]);
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      client: client as never,
      supabaseClient: makeDb(captured) as never,
    });
    expect(result.status).toBe("partial");
    expect(result.syncDetails).toMatchObject({ insightsReceived: 3, insightsValid: 2, insightsInvalid: 1 });
    expect(result.syncDetails?.invalidReasons.missing_or_invalid_spend).toBe(1);
    expect(result.recordsRejected).toBe(1);
    expect(captured.insightsUpserts).toHaveLength(1);
    expect(captured.insightsUpserts[0]).toHaveLength(2);
  });

  it("DI-01: all rows invalid stores nothing and rejects every row", async () => {
    const captured = { insightsUpserts: [] as Row[][], tables: [] as string[] };
    const client = makeClient([
      { ...validRow, ad_id: "" },
      { ...validRow, impressions: "N/A" },
    ]);
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      client: client as never,
      supabaseClient: makeDb(captured) as never,
    });
    expect(result.syncDetails).toMatchObject({ insightsValid: 0, insightsInvalid: 2 });
    expect(result.insightsSynced).toBe(0);
    expect(captured.insightsUpserts).toHaveLength(0);
  });

  it("DI-03: unmapped ads are counted and warned, never silently dropped", async () => {
    const captured = { insightsUpserts: [] as Row[][], tables: [] as string[] };
    const ghost = { ...validRow, ad_id: "ad_ghost", campaign_id: "cmp_unknown" };
    const client = makeClient([validRow, ghost]);
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      client: client as never,
      supabaseClient: makeDb(captured) as never,
    });
    expect(result.syncDetails?.insightsUnmapped).toBe(1);
    expect(result.recordsRejected).toBe(1);
    expect(result.warnings?.join(" ")).toContain("tidak dapat dipetakan");
    expect(captured.insightsUpserts[0]).toHaveLength(1);
    expect(captured.insightsUpserts[0][0].ad_id).toBe("ad-uuid-1");
  });

  it("DI-04: optional metrics are persisted as null, explicit zero stays zero", async () => {
    const captured = { insightsUpserts: [] as Row[][], tables: [] as string[] };
    const zeroRow = { ...validRow, spend: "0", impressions: "0", clicks: "0" };
    const client = makeClient([zeroRow]);
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      client: client as never,
      supabaseClient: makeDb(captured) as never,
    });
    expect(result.status).toBe("success");
    const stored = captured.insightsUpserts[0][0];
    expect(stored.spend).toBe(0);
    expect(stored.impressions).toBe(0);
    expect(stored.reach).toBeNull();
    expect(stored.link_clicks).toBeNull();
    expect(stored.conversions).toBeNull();
  });

  it("DI-02: truncated pagination is partial, fetched rows still stored additively", async () => {
    const captured = { insightsUpserts: [] as Row[][], tables: [] as string[] };
    const fetchFn = vi.fn(async (input: unknown) => {
      const url = String(input);
      const body = url.includes("/insights")
        ? { data: [{ ad_id: "ad_1", campaign_id: "cmp_1", spend: "10", impressions: "5", clicks: "1", date_start: "2026-10-01", date_stop: "2026-10-01" }], paging: { next: "https://graph.facebook.com/v26.0/act_111/insights?after=c", cursors: { after: "c" } } }
        : url.includes("/campaigns")
          ? { data: [{ id: "cmp_1", name: "C1", status: "ACTIVE" }] }
          : url.includes("/ads")
            ? { data: [{ id: "ad_1", name: "Ad 1", status: "ACTIVE", campaign_id: "cmp_1" }] }
            : { id: "act_111", name: "A", currency: "IDR", timezone_name: "Asia/Jakarta", account_status: 1 };
      return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    });
    const client = new MetaMarketingApiClient({ accessToken: "t", fetchFn: fetchFn as never });
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      client: client as never,
      supabaseClient: makeDb(captured) as never,
    });
    expect(result.status).toBe("partial");
    expect(result.syncDetails?.paginationComplete).toBe(false);
    expect(result.syncDetails?.pagesProcessed).toBe(100);
    expect(captured.insightsUpserts.length).toBeGreaterThan(0);
  });
});
