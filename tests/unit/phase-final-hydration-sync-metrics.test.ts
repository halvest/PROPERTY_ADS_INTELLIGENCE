import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeMarketingSync } from "@/lib/marketing/meta/sync-service";
import { aggregateAdInsights } from "@/lib/ads/aggregation";
import { formatOptionalNumber } from "@/lib/ads/display";

const read = (rel: string) => fs.readFileSync(path.resolve(import.meta.dirname, rel), "utf-8");

/* ------------------------------------------------------------------ */
/* Hydration safety (Target CPR)                                       */
/* ------------------------------------------------------------------ */

describe("AIAdsPerformanceAnalyst hydration safety", () => {
  const content = read("../../src/components/dashboard/AIAdsPerformanceAnalyst.tsx");

  it("initial target CPR state is identical for server and client (no storage read during render)", () => {
    expect(content).toContain("useSyncExternalStore(");
    // No state initializer may touch browser storage or window.
    expect(content).not.toContain("useState<number | null>(() =>");
    expect(content).not.toContain("useState<string>(() =>");
    expect(content).not.toMatch(/useState\(\(\) => typeof window/);
  });

  it("stored target CPR comes from the external-store client snapshot, never the server snapshot", () => {
    const store = content.slice(content.indexOf("useSyncExternalStore("));
    expect(store.slice(0, 1200)).toContain("window.localStorage.getItem(targetCprStorageKey)");
    expect(content).toContain("haspro_target_cpr_");
    // Server snapshot is a stable null -> identical first render on both sides.
    expect(store.slice(0, 1200)).toContain("() => null");
    expect(content).not.toContain("{!hydrated ? (");
  });

  it("the settings button and save/reset behaviour are preserved", () => {
    expect(content).toContain("saveTargetCpr(");
    expect(content).toContain("localStorage.setItem(targetCprStorageKey, String(val))");
    expect(content).toContain("localStorage.removeItem(targetCprStorageKey)");
    expect(content).not.toContain("suppressHydrationWarning");
  });
});

/* ------------------------------------------------------------------ */
/* Metric display & formulas                                           */
/* ------------------------------------------------------------------ */

describe("Ads metric display rules", () => {
  const fmt = (n: number) => String(n);

  it("null reach and frequency render as unavailable, explicit zero stays zero", () => {
    const agg = aggregateAdInsights([
      { spend: 100, impressions: 100, clicks: 5, reach: 80, link_clicks: 2, date_start: "2026-10-01" },
      { spend: 100, impressions: 100, clicks: 5, reach: 70, link_clicks: 2, date_start: "2026-10-02" },
    ]);
    expect(agg.reach).toBeNull();
    expect(agg.frequency).toBeNull();
    expect(formatOptionalNumber(agg.reach, fmt)).toBe("—");
    expect(formatOptionalNumber(agg.frequency, fmt)).toBe("—");
    expect(formatOptionalNumber(0, fmt)).toBe("0");
  });

  it("link clicks and all clicks are never swapped; ratios use the matching denominator", () => {
    const agg = aggregateAdInsights([
      { spend: 300, impressions: 1000, clicks: 100, reach: 500, link_clicks: 30, date_start: "2026-10-01" },
    ]);
    expect(agg.linkClicks).toBe(30);
    expect(agg.allClicks).toBe(100);
    expect(agg.linkCpc).toBe(10); // 300 / 30 link clicks
    expect(agg.allCpc).toBe(3); // 300 / 100 all clicks
    expect(agg.linkCtr).toBe(3); // 30 / 1000 * 100
    expect(agg.allCtr).toBe(10); // 100 / 1000 * 100
    expect(agg.cpm).toBe(300); // 300 / 1000 * 1000
  });
});

/* ------------------------------------------------------------------ */
/* PGRST204 / 42703 conversion metadata fallback                       */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

function makeBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "gte", "limit", "select", "in"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function makeDb(
  captured: { insightsUpserts: Row[][] },
  firstInsightsError: { code: string } | null,
  coreAlsoFails = false
) {
  let insightsCalls = 0;
  const campaigns = [{ id: "cmp-uuid-1", provider_campaign_id: "cmp_1" }];
  const ads = [{ id: "ad-uuid-1", provider_ad_id: "ad_1" }];
  return {
    from(table: string) {
      switch (table) {
        case "meta_user_tokens":
          return { select: () => makeBuilder({ data: null, error: null }) };
        case "meta_asset_selections":
        case "ad_accounts":
          return {
            select: () => ({ ...makeBuilder({ data: null, error: null }), eq: () => makeBuilder({ data: null, error: null }) }),
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
          return { upsert: async () => ({ error: null }), select: () => makeBuilder({ data: campaigns, error: null }) };
        case "ads":
          return { upsert: async () => ({ error: null }), select: () => makeBuilder({ data: ads, error: null }) };
        case "ad_insights":
          return {
            upsert: async (rowsToStore: Row[]) => {
              insightsCalls += 1;
              captured.insightsUpserts.push(rowsToStore);
              if (insightsCalls === 1 && firstInsightsError) return { error: firstInsightsError };
              if (coreAlsoFails) return { error: { code: "23505" } };
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

function makeClient() {
  return {
    getAdAccount: async () => ({ id: "act_111", name: "A", currency: "IDR", timezone_name: "Asia/Jakarta", account_status: 1 }),
    getCampaigns: async () => [{ id: "cmp_1", name: "C1", status: "ACTIVE", objective: "OUTCOME_LEADS" }],
    getAds: async () => [{ id: "ad_1", name: "Ad 1", status: "ACTIVE", campaign_id: "cmp_1" }],
    getAdInsights: async () => [
      {
        ad_id: "ad_1", ad_name: "Ad 1", campaign_id: "cmp_1",
        spend: "10000", impressions: "1000", clicks: "50",
        date_start: "2026-10-01", date_stop: "2026-10-01",
        actions: [{ action_type: "lead", value: "2" }],
      },
    ],
  };
}

describe("Conversion metadata fallback (PGRST204 / 42703)", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it.each(["PGRST204", "42703"])("%s: core metrics stored, metadata not fabricated, user notice has no technical details", async (code) => {
    const captured = { insightsUpserts: [] as Row[][] };
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      client: makeClient() as never,
      supabaseClient: makeDb(captured, { code }) as never,
    });
    // Exactly one full attempt + one core fallback (no retry loop / duplicates).
    expect(captured.insightsUpserts).toHaveLength(2);
    const [fullRows, coreRows] = captured.insightsUpserts;
    expect(fullRows[0]).toHaveProperty("action_breakdown");
    // Core fallback keeps core metrics and drops only the metadata columns.
    expect(coreRows[0]).not.toHaveProperty("action_breakdown");
    expect(coreRows[0]).not.toHaveProperty("conversion_action_type");
    expect(coreRows[0]).not.toHaveProperty("mapping_version");
    expect(Number(coreRows[0].spend)).toBeGreaterThan(0);
    expect(result.recordsRejected).toBe(0);
    const notice = (result.warnings ?? []).join(" ");
    expect(notice).toContain(
      "Sinkronisasi berhasil. Sebagian jenis hasil belum dapat diidentifikasi karena konfigurasi integrasi belum lengkap."
    );
    expect(notice).not.toContain(".sql");
    expect(notice).not.toContain("PGRST");
    expect(notice).not.toContain("migration");
    expect((result.warnings ?? []).filter((w) => w.includes("jenis hasil"))).toHaveLength(1);
  });

  it("core storage failure is never disguised as success", async () => {
    const captured = { insightsUpserts: [] as Row[][] };
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      client: makeClient() as never,
      supabaseClient: makeDb(captured, { code: "PGRST204" }, true) as never,
    });
    expect(result.recordsRejected).toBeGreaterThan(0);
    expect(result.status).not.toBe("success");
    expect((result.warnings ?? []).join(" ")).not.toContain("Sinkronisasi berhasil");
  });

  it("healthy sync (no warnings) keeps the plain success contract", async () => {
    const captured = { insightsUpserts: [] as Row[][] };
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      client: makeClient() as never,
      supabaseClient: makeDb(captured, null) as never,
    });
    expect(captured.insightsUpserts).toHaveLength(1);
    expect(result.warnings ?? []).toHaveLength(0);
    const page = read("../../src/app/(dashboard)/ads/page.tsx");
    expect(page).toContain('"Sinkronisasi Berhasil"');
    expect(page).toContain('"Sinkronisasi Berhasil dengan Catatan"');
  });

  it("diagnostic logging carries context but no secrets", () => {
    const sync = read("../../src/lib/marketing/meta/sync-service.ts");
    const logBlock = sync.slice(sync.indexOf("Conversion metadata columns unavailable"));
    expect(logBlock.slice(0, 900)).toContain("metadataColumns");
    expect(logBlock.slice(0, 900)).toContain('fallback: "core_metrics_stored"');
    expect(logBlock.slice(0, 900)).not.toMatch(/accessToken|access_token|serviceRole|SECRET/i);
  });
});
