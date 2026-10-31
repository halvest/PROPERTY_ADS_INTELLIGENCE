import { describe, it, expect, vi, beforeEach } from "vitest";
import { FetchGuard } from "@/lib/ads/fetch-guard";

const ORG = "org-1";
const rows: Record<string, Array<Record<string, unknown>>> = {
  organizations: [{ id: ORG, name: "Org One" }],
  ad_accounts: [
    { id: "acc-int-a", organization_id: ORG, provider_account_id: "act_111", account_name: "Account A", currency: "IDR", timezone: "Asia/Jakarta", connection_status: "connected", last_synced_at: "2026-10-01T00:00:00Z" },
    { id: "acc-int-b", organization_id: ORG, provider_account_id: "act_222", account_name: "Account B", currency: "IDR", timezone: "Asia/Jakarta", connection_status: "connected", last_synced_at: "2026-10-02T00:00:00Z" },
  ],
  integration_connections: [],
  meta_asset_selections: [{ organization_id: ORG, ad_account_id: "act_111" }],
  campaigns: [
    { id: "cmp-a", organization_id: ORG, ad_account_id: "acc-int-a", name: "Campaign A", status: "ACTIVE", objective: "OUTCOME_LEADS", provider_campaign_id: "pc-a", created_at: "2026-01-01", updated_at: "2026-01-01" },
    { id: "cmp-b", organization_id: ORG, ad_account_id: "acc-int-b", name: "Campaign B", status: "ACTIVE", objective: "OUTCOME_LEADS", provider_campaign_id: "pc-b", created_at: "2026-01-01", updated_at: "2026-01-01" },
  ],
  ads: [
    { id: "ad-a", organization_id: ORG, campaign_id: "cmp-a", name: "Ad A", status: "ACTIVE", provider_ad_id: "pa-a", quality_ranking: null, engagement_rate_ranking: null, conversion_rate_ranking: null, created_at: "2026-01-01", updated_at: "2026-01-01" },
    { id: "ad-b", organization_id: ORG, campaign_id: "cmp-b", name: "Ad B", status: "ACTIVE", provider_ad_id: "pa-b", quality_ranking: null, engagement_rate_ranking: null, conversion_rate_ranking: null, created_at: "2026-01-01", updated_at: "2026-01-01" },
  ],
  ad_insights: [
    { organization_id: ORG, ad_id: "ad-a", date_start: "2026-10-01", date_stop: "2026-10-01", spend: 100, impressions: 1000, clicks: 50, reach: 800, link_clicks: 40, conversions: 2, currency: "IDR", level: "ad", adset_id: null, adset_name: null, conversion_action_type: "lead", source: "meta" },
    { organization_id: ORG, ad_id: "ad-b", date_start: "2026-10-01", date_stop: "2026-10-01", spend: 999, impressions: 9000, clicks: 450, reach: 7000, link_clicks: 400, conversions: 9, currency: "IDR", level: "ad", adset_id: null, adset_name: null, conversion_action_type: "lead", source: "meta" },
  ],
};

class QB {
  private filters: Array<(r: Record<string, unknown>) => boolean> = [];
  constructor(private table: string) {}
  select() { return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  gte(col: string, val: unknown) { this.filters.push((r) => String(r[col]) >= String(val)); return this; }
  lte(col: string, val: unknown) { this.filters.push((r) => String(r[col]) <= String(val)); return this; }
  order() { return this; }
  limit() { return this; }
  private result() { return (rows[this.table] || []).filter((r) => this.filters.every((f) => f(r))); }
  async maybeSingle() { const d = this.result(); return { data: d[0] ?? null, error: null }; }
  async single() { const d = this.result(); return { data: d[0] ?? null, error: null }; }
  then(resolve: (v: { data: unknown; error: null }) => void) {
    resolve({ data: this.result(), error: null });
  }
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => new QB(table) }),
}));

import { getAdsIntelligenceData } from "@/lib/ads/service";

describe("Ads account switching (service level)", () => {
  beforeEach(() => {});

  it("returns only account A data by default (selected asset)", async () => {
    const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "all" });
    expect(data.adAccount?.id).toBe("act_111");
    expect(data.kpis.totalSpend).toBe(100);
    expect(data.ads.map((a: { id: string }) => a.id)).toEqual(["ad-a"]);
    expect(data.availableAdAccounts).toHaveLength(2);
  });

  it("switching to B returns only B KPI, ads and campaigns", async () => {
    const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "all", adAccountId: "act_222" });
    expect(data.adAccount?.id).toBe("act_222");
    expect(data.kpis.totalSpend).toBe(999);
    expect(data.ads.map((a: { id: string }) => a.id)).toEqual(["ad-b"]);
    expect(data.campaigns.map((c: { id: string }) => c.id)).toEqual(["cmp-b"]);
  });

  it("switching back to A restores A consistently", async () => {
    await getAdsIntelligenceData({ organizationId: ORG, dateRange: "all", adAccountId: "act_222" });
    const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "all", adAccountId: "act_111" });
    expect(data.kpis.totalSpend).toBe(100);
  });

  it("computes weighted rates and never sums unique daily reach", async () => {
    const prior = rows.ad_insights;
    rows.ad_insights = [
      ...prior,
      { organization_id: ORG, ad_id: "ad-b", date_start: "2026-10-02", date_stop: "2026-10-02", spend: 100, impressions: 1000, clicks: 50, reach: 800, link_clicks: 40, conversions: 1, currency: "IDR", level: "ad", adset_id: null, adset_name: null, conversion_action_type: "lead", source: "meta" },
    ];
    try {
      const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "all", adAccountId: "act_222" });
      expect(data.kpis.totalSpend).toBe(1099);
      expect(data.kpis.allClicks).toBe(500);
      expect(data.kpis.allCtr).toBe(5);
      expect(data.kpis.allCpc).toBeCloseTo(2.198);
      expect(data.kpis.cpm).toBeCloseTo(109.9);
      expect(data.kpis.totalReach).toBeNull();
    } finally {
      rows.ad_insights = prior;
    }
  });

  it("reports no Insights for the selected period without presenting metric zeroes as verified data", async () => {
    const data = await getAdsIntelligenceData({
      organizationId: ORG,
      dateRange: "2026-11-01:2026-11-02",
      adAccountId: "act_222",
    });
    expect(data.insightsState).toBe("no_data_for_period");
    expect(data.ads.every((ad: { hasInsights: boolean }) => !ad.hasInsights)).toBe(true);
  });

  it("rejects an account that does not belong to the organization without leaking existence", async () => {
    await expect(
      getAdsIntelligenceData({ organizationId: ORG, dateRange: "all", adAccountId: "act_999" })
    ).rejects.toThrow("FORBIDDEN_AD_ACCOUNT");
  });

  it("does not silently load all tenant campaigns when no account is selected", async () => {
    const prior = rows.meta_asset_selections;
    rows.meta_asset_selections = [];
    try {
      const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "all" });
      expect(data.adAccount).toBeNull();
      expect(data.campaigns).toEqual([]);
      expect(data.ads).toEqual([]);
      expect(data.insightsState).toBe("no_account_selected");
    } finally {
      rows.meta_asset_selections = prior;
    }
  });
});

describe("FetchGuard race protection", () => {
  it("only the latest sequence is current and the previous signal is aborted", () => {
    const guard = new FetchGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(first.signal.aborted).toBe(true);
    expect(guard.isCurrent(first.seq)).toBe(false);
    expect(guard.isCurrent(second.seq)).toBe(true);
  });

  it("A -> B -> A: earlier responses cannot overwrite the last selection", () => {
    const guard = new FetchGuard();
    const seqA1 = guard.begin().seq;
    const seqB = guard.begin().seq;
    const seqA2 = guard.begin().seq;
    expect([seqA1, seqB].every((s) => !guard.isCurrent(s))).toBe(true);
    expect(guard.isCurrent(seqA2)).toBe(true);
  });
});
