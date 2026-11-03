import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { aggregateAdInsights, buildZeroFilledDailyTrends, messagingFromRow, leadsFromRow, selectPrimaryResult } from "@/lib/ads/aggregation";
import { mapMetaInsightToInternal } from "@/lib/marketing/meta/mapper";
import type { MetaInsightResponse } from "@/lib/marketing/meta/types";

const root = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

function insight(partial: Partial<MetaInsightResponse>): MetaInsightResponse {
  return {
    ad_id: "ad_1",
    spend: "10000",
    impressions: "1000",
    clicks: "50",
    date_start: "2026-10-01",
    date_stop: "2026-10-01",
    ...partial,
  } as MetaInsightResponse;
}

function map(partial: Partial<MetaInsightResponse>) {
  return mapMetaInsightToInternal(insight(partial), {
    organizationId: "org-1",
    adId: "ad_1",
    currency: "IDR",
    source: "meta",
  });
}

describe("BL-01 conversion separation (mapper)", () => {
  it("keeps messaging conversations and leads independent when both present", () => {
    const n = map({
      actions: [
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "7" },
        { action_type: "lead", value: "3" },
      ],
    });
    expect(n.messagingConversations).toBe(7);
    expect(n.leads).toBe(3);
    // Legacy combined field may hold either type; it is never the sum of both.
    expect(n.conversions).not.toBe(10);
  });

  it("reports only messaging when only messaging exists", () => {
    const n = map({ actions: [{ action_type: "messaging_conversation_started_7d", value: "5" }] });
    expect(n.messagingConversations).toBe(5);
    expect(n.leads).toBe(0);
  });

  it("reports only leads when only leads exist", () => {
    const n = map({ actions: [{ action_type: "offsite_conversion.fb_pixel_lead", value: "4" }] });
    expect(n.leads).toBe(4);
    expect(n.messagingConversations).toBe(0);
  });

  it("returns null result types when Meta sends no actions at all", () => {
    const n = map({});
    expect(n.messagingConversations).toBeNull();
    expect(n.leads).toBeNull();
    expect(n.conversions).toBeNull();
  });

  it("does not double-count multiple lead action aliases", () => {
    const row = {
      action_breakdown: { lead: 2, "onsite_conversion.lead_grouped": 2 },
      conversions: 2,
    };
    expect(leadsFromRow(row)).toBe(2);
    expect(messagingFromRow({ action_breakdown: { "onsite_conversion.messaging_conversation_started_7d": 6 } })).toBe(6);
  });
});

describe("AI-02 shared aggregation", () => {
  const base = { spend: 10000, impressions: 1000, clicks: 50, link_clicks: 40, conversions: 5 };

  it("computes dashboard-identical derived metrics for one day", () => {
    const agg = aggregateAdInsights([
      { ...base, reach: 800, date_start: "2026-10-01", action_breakdown: { "onsite_conversion.messaging_conversation_started_7d": 5 } },
    ]);
    expect(agg.spend).toBe(10000);
    expect(agg.linkCtr).toBe(4);
    expect(agg.linkCpc).toBe(250);
    expect(agg.cpm).toBe(10000);
    expect(agg.reach).toBe(800);
    expect(agg.frequency).toBe(1.25);
    expect(agg.messagingConversations).toBe(5);
    expect(agg.costPerMessagingConversation).toBe(2000);
    expect(agg.leads).toBe(0);
    expect(agg.costPerLead).toBeNull();
  });

  it("never sums reach or frequency across multiple days", () => {
    const agg = aggregateAdInsights([
      { ...base, reach: 800, date_start: "2026-10-01" },
      { ...base, reach: 700, date_start: "2026-10-02" },
    ]);
    expect(agg.reach).toBeNull();
    expect(agg.frequency).toBeNull();
    expect(agg.days).toBe(2);
    expect(agg.spend).toBe(20000);
  });

  it("keeps null link clicks null and zero denominators null", () => {
    const agg = aggregateAdInsights([{ spend: 5000, impressions: 0, clicks: 0, link_clicks: null, conversions: null, date_start: "2026-10-01" }]);
    expect(agg.linkClicks).toBeNull();
    expect(agg.linkCtr).toBeNull();
    expect(agg.linkCpc).toBeNull();
    expect(agg.costPerResult).toBeNull();
    expect(agg.results).toBeNull();
  });

  it("separates messaging and lead costs from stored action breakdowns", () => {
    const agg = aggregateAdInsights([
      { ...base, action_breakdown: { "onsite_conversion.messaging_conversation_started_7d": 4, lead: 0 }, date_start: "2026-10-01" },
      { ...base, action_breakdown: { lead: 2 }, date_start: "2026-10-01" },
    ]);
    expect(agg.messagingConversations).toBe(4);
    expect(agg.leads).toBe(2);
    expect(agg.costPerMessagingConversation).toBe(5000);
    expect(agg.costPerLead).toBe(10000);
  });
});

describe("Phase 2 wiring contracts", () => {
  it("dashboard detail and both AI endpoints use the shared aggregation", () => {
    expect(read("src/lib/ads/service.ts")).toContain("aggregateAdInsights(insights || [])");
    expect(read("src/app/api/ai/analyze-ad/route.ts")).toContain("aggregateAdInsights(insights || [])");
    expect(read("src/app/api/ai/analyze-performance/route.ts")).toContain("aggregateAdInsights(currentInsights || [])");
    expect(read("src/app/api/ai/analyze-performance/route.ts")).toContain("aggregateAdInsights(prevInsights || [])");
  });

  it("dashboard list aggregation (getAdsIntelligenceData) uses the shared aggregation per ad", () => {
    const service = read("src/lib/ads/service.ts");
    const listFn = service.slice(service.indexOf("export async function getAdsIntelligenceData"));
    const detailStart = listFn.indexOf("export async function getAdDetailById");
    const listBody = detailStart > 0 ? listFn.slice(0, detailStart) : listFn;
    expect(listBody).toContain("aggregateAdInsights(rows)");
    expect(listBody).toContain("adAggMap");
    // Per-ad dashboard metrics are read from the shared aggregate, and the
    // separated BL-01 result types are exposed to consumers.
    expect(listBody).toContain("agg.messagingConversations");
    expect(listBody).toContain("agg.leads");
    expect(listBody).toContain("agg.costPerMessagingConversation");
    expect(listBody).toContain("agg.costPerLead");
  });

  it("grouped (dashboard) and single (detail/AI) aggregation agree on identical rows", () => {
    const rows = [
      { spend: 10000, impressions: 1000, clicks: 50, link_clicks: 40, reach: 800, conversions: 5, date_start: "2026-10-01", action_breakdown: { "onsite_conversion.messaging_conversation_started_7d": 5 } },
      { spend: 5000, impressions: 500, clicks: 20, link_clicks: 10, reach: 600, conversions: 2, date_start: "2026-10-02", action_breakdown: { lead: 2 } },
    ];
    const whole = aggregateAdInsights(rows);
    const perDay = rows.map((r) => aggregateAdInsights([r]));
    // Additive metrics agree; unique reach across two days is null in both views.
    expect(whole.spend).toBe(perDay.reduce((a, d) => a + d.spend, 0));
    expect(whole.impressions).toBe(perDay.reduce((a, d) => a + d.impressions, 0));
    expect(whole.messagingConversations).toBe(5);
    expect(whole.leads).toBe(2);
    expect(whole.reach).toBeNull();
    expect(whole.frequency).toBeNull();
  });

  it("qualified leads no longer come from Buyer Score in ad analysis or live dashboard", () => {
    const analyzeAd = read("src/app/api/ai/analyze-ad/route.ts");
    expect(analyzeAd).not.toContain("buyer_score");
    expect(analyzeAd).toContain("Qualified Lead = Hot + Warm");
    const live = read("src/lib/data/live-dashboard-service.ts");
    expect(live).not.toContain("buyerScore >= 70");
    expect(live).not.toContain("buyerScore !== null && buyerScore >= 70");
  });

  it("AI prompts carry period, separated result types, and the lead-quality limitation", () => {
    const analyzeAd = read("src/app/api/ai/analyze-ad/route.ts") + read("src/lib/ai/ctwa-analysis/prompt.ts");
    expect(analyzeAd).toContain("Periode Analisis:");
    expect(analyzeAd).toContain("Percakapan Messaging (Meta):");
    expect(analyzeAd).toContain("Leads (Meta):");
    expect(analyzeAd).toContain("Qualified Lead = Hot + Warm");
    const analyzePerformance = read("src/app/api/ai/analyze-performance/route.ts");
    expect(analyzePerformance).toContain("Percakapan Messaging:");
    expect(analyzePerformance).toContain("Qualified Lead = Hot + Warm");
  });

  it("legacy scoring modules are preserved, not deleted", () => {
    for (const rel of [
      "src/domain/scoring/buyer-score.ts",
      "src/domain/scoring/sales-score.ts",
      "src/lib/ai/lead-evidence/extract.ts",
      "src/app/api/ai/extract-evidence/route.ts",
    ]) {
      expect(fs.existsSync(path.join(root, rel)), rel).toBe(true);
    }
  });

  it("zero-fills every calendar day and prefers messaging when it dominates", () => {
    const trends = buildZeroFilledDailyTrends(
      [{ spend: 1000, impressions: 100, link_clicks: 2, conversions: 1, date_start: "2026-10-02" }],
      "2026-10-01",
      "2026-10-03"
    );
    expect(trends.spend).toEqual([0, 1000, 0]);
    expect(trends.results).toEqual([0, 1, 0]);
    expect(trends.spend).toHaveLength(3);

    const primary = selectPrimaryResult({
      spend: 100,
      impressions: 10,
      allClicks: 1,
      linkClicks: 1,
      reach: null,
      frequency: null,
      linkCtr: 10,
      linkCpc: 100,
      allCtr: 10,
      allCpc: 100,
      cpm: 10000,
      results: 9,
      messagingConversations: 8,
      leads: 1,
      costPerMessagingConversation: 12.5,
      costPerLead: 100,
      costPerResult: 11,
      days: 7,
      rowCount: 7,
    }, null);
    expect(primary.kind).toBe("messaging");
    expect(primary.count).toBe(8);
  });
});
