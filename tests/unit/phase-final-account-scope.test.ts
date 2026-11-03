import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, vi } from "vitest";

const ORG = "org-1";
const rows: Record<string, Array<Record<string, unknown>>> = {
  organizations: [{ id: ORG, name: "Org One" }],
  ad_accounts: [
    { id: "acc-1", organization_id: ORG, provider_account_id: "act_111", account_name: "Account A", currency: "IDR", timezone: "Asia/Jakarta", connection_status: "connected", last_synced_at: "2026-10-01T00:00:00Z" },
  ],
  integration_connections: [],
  meta_asset_selections: [{ organization_id: ORG, ad_account_id: "act_111" }],
  campaigns: [
    { id: "cmp-1", organization_id: ORG, ad_account_id: "acc-1", name: "Campaign 1", status: "ACTIVE", objective: "OUTCOME_LEADS", provider_campaign_id: "pc-1", created_at: "2026-01-01", updated_at: "2026-01-01" },
    { id: "cmp-2", organization_id: ORG, ad_account_id: "acc-1", name: "Campaign 2", status: "ACTIVE", objective: "OUTCOME_LEADS", provider_campaign_id: "pc-2", created_at: "2026-01-01", updated_at: "2026-01-01" },
  ],
  ads: [
    { id: "ad-1", organization_id: ORG, campaign_id: "cmp-1", name: "Ad 1", status: "ACTIVE", provider_ad_id: "pa-1", quality_ranking: null, engagement_rate_ranking: null, conversion_rate_ranking: null, created_at: "2026-01-01", updated_at: "2026-01-01" },
    { id: "ad-2", organization_id: ORG, campaign_id: "cmp-2", name: "Ad 2", status: "ACTIVE", provider_ad_id: "pa-2", quality_ranking: null, engagement_rate_ranking: null, conversion_rate_ranking: null, created_at: "2026-01-01", updated_at: "2026-01-01" },
  ],
  ad_insights: [] as Array<Record<string, unknown>>,
};

function insight(adId: string, day: string, reach: number, spend = 100) {
  return {
    organization_id: ORG, ad_id: adId, date_start: day, date_stop: day,
    spend, impressions: 1000, clicks: 50, reach, link_clicks: 40, conversions: 2,
    currency: "IDR", level: "ad", adset_id: null, adset_name: null,
    conversion_action_type: "lead", source: "meta",
    quality_ranking: null, engagement_rate_ranking: null, conversion_rate_ranking: null,
  };
}

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

import { getAdsIntelligenceData, getAdDetailById } from "@/lib/ads/service";

describe("Account reach scope (P1)", () => {
  it("one ad, one day: account reach and frequency remain available", async () => {
    rows.ad_insights = [insight("ad-1", "2026-10-01", 800), insight("ad-2", "2026-10-01", 700)];
    const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "2026-10-01:2026-10-01", selectedCampaignId: "cmp-1" });
    expect(data.kpis.totalReach).toBe(800);
    expect(data.kpis.frequency).toBe(1.25);
  });

  it("one ad, multi-day: account reach and frequency are null", async () => {
    rows.ad_insights = [insight("ad-1", "2026-10-01", 800), insight("ad-1", "2026-10-02", 750)];
    const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "2026-10-01:2026-10-02", selectedCampaignId: "cmp-1" });
    expect(data.kpis.totalReach).toBeNull();
    expect(data.kpis.frequency).toBeNull();
  });

  it("many ads, one day: account and campaign reach are null (never summed across ads)", async () => {
    rows.ad_insights = [insight("ad-1", "2026-10-01", 800), insight("ad-2", "2026-10-01", 700)];
    const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "2026-10-01:2026-10-01" });
    expect(data.kpis.totalReach).toBeNull();
    expect(data.kpis.frequency).toBeNull();
    const campaign2 = data.campaigns.find((c) => c.id === "cmp-2");
    // cmp-2 holds exactly one ad, so its single-ad reach remains valid.
    expect(campaign2?.reach).toBe(700);
  });

  it("campaign with two ads: reach null even on a single day", async () => {
    const priorAds = rows.ads;
    rows.ads = [
      ...priorAds,
      { id: "ad-3", organization_id: ORG, campaign_id: "cmp-2", name: "Ad 3", status: "ACTIVE", provider_ad_id: "pa-3", quality_ranking: null, engagement_rate_ranking: null, conversion_rate_ranking: null, created_at: "2026-01-01", updated_at: "2026-01-01" },
    ];
    rows.ad_insights = [insight("ad-2", "2026-10-01", 700), insight("ad-3", "2026-10-01", 300)];
    try {
      const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "2026-10-01:2026-10-01", selectedCampaignId: "cmp-2" });
      const campaign2 = data.campaigns.find((c) => c.id === "cmp-2");
      expect(campaign2?.reach).toBeNull();
      expect(campaign2?.frequency).toBeNull();
      expect(data.kpis.totalReach).toBeNull();
    } finally {
      rows.ads = priorAds;
    }
  });

  it("many ads, multi-day: account reach null", async () => {
    rows.ad_insights = [
      insight("ad-1", "2026-10-01", 800), insight("ad-1", "2026-10-02", 750),
      insight("ad-2", "2026-10-01", 700), insight("ad-2", "2026-10-02", 650),
    ];
    const data = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "2026-10-01:2026-10-02" });
    expect(data.kpis.totalReach).toBeNull();
    expect(data.kpis.frequency).toBeNull();
  });
});

describe("Dashboard/detail period consistency (P1)", () => {
  it("detail uses the same limited period as the dashboard, not full history", async () => {
    rows.ad_insights = [insight("ad-1", "2026-10-01", 800, 100), insight("ad-1", "2026-10-02", 750, 500)];
    const detail = await getAdDetailById(ORG, "pa-1", { dateRange: "2026-10-01:2026-10-01" });
    expect(detail.success).toBe(true);
    if (detail.success) {
      expect(detail.data.metrics.spend).toBe(100);
      expect(detail.data.metrics.dateRangeStart).toBe("2026-10-01");
      expect(detail.data.metrics.dateRangeStop).toBe("2026-10-01");
    }
    const dashboard = await getAdsIntelligenceData({ organizationId: ORG, dateRange: "2026-10-01:2026-10-01", selectedCampaignId: "cmp-1" });
    const row = dashboard.ads.find((a) => a.id === "ad-1");
    expect(row?.spend).toBe(100);
    if (detail.success) {
      expect(detail.data.metrics.spend).toBe(row?.spend);
      expect(detail.data.metrics.impressions).toBe(row?.impressions);
      expect(detail.data.metrics.linkClicks).toBe(row?.linkClicks);
    }
  });

  it("tenant isolation still applies to detail", async () => {
    rows.ad_insights = [insight("ad-1", "2026-10-01", 800)];
    const detail = await getAdDetailById("org-2", "pa-1", { dateRange: "all" });
    expect(detail.success).toBe(false);
    if (!detail.success) expect(detail.code).toBe("FORBIDDEN");
  });
});

describe("Metadata notice separation (P2)", () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(import.meta.dirname, rel), "utf-8");

  it("user-facing sync warning never leaks SQL migration instructions", () => {
    const sync = read("../../src/lib/marketing/meta/sync-service.ts");
    expect(sync).toContain(
      "Sinkronisasi berhasil. Sebagian jenis hasil belum dapat diidentifikasi karena konfigurasi integrasi belum lengkap."
    );
    const warningBlock = sync.slice(sync.indexOf("User-facing notice"));
    expect(warningBlock.slice(0, 900)).not.toContain("Terapkan migration");
    // Migration name remains only as an admin diagnostic in the server log.
    expect(sync).toContain('requiredMigration: "20261027000000_p0_security_and_metrics.sql"');
  });

  it("KPI scope caption is explicit on the Ads page", () => {
    const page = read("../../src/app/(dashboard)/ads/page.tsx");
    expect(page).toContain("KPI di bawah merupakan agregat akun iklan terpilih, pada periode terpilih");
    expect(page).toContain("total akun sebelum filter");
  });
});
