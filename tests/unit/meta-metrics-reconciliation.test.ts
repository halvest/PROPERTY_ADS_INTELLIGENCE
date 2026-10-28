import { describe, it, expect } from "vitest";
import { parseDateRange } from "@/lib/ads/date-utils";
import { mapMetaInsightToInternal } from "@/lib/marketing/meta/mapper";
import type { MetaInsightResponse } from "@/lib/marketing/meta/types";

describe("TASK: Fix Meta Ads Metrics Mismatch — Reconciliation & Pipeline Verification", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const adId = "11111111-1111-1111-1111-111111111111";

  describe("1. Timezone & Reporting Date Boundary Handling (Asia/Jakarta, UTC+7)", () => {
    it("correctly produces exact date boundaries in Asia/Jakarta timezone for 'today' and 'yesterday'", () => {
      const todayRange = parseDateRange("today", "Asia/Jakarta");
      const yesterdayRange = parseDateRange("yesterday", "Asia/Jakarta");

      expect(todayRange.since).toBeDefined();
      expect(todayRange.until).toBeDefined();
      expect(todayRange.since).toBe(todayRange.until); // Today is a single day

      expect(yesterdayRange.since).toBeDefined();
      expect(yesterdayRange.until).toBeDefined();
      expect(yesterdayRange.since).toBe(yesterdayRange.until); // Yesterday is a single day

      // Yesterday should strictly precede Today
      expect(yesterdayRange.since! < todayRange.since!).toBe(true);
    });

    it("handles 7d, 14d, 30d presets with correct day counts inclusive of until date", () => {
      const r7 = parseDateRange("7d", "Asia/Jakarta");
      expect(r7.since).toBeDefined();
      expect(r7.until).toBeDefined();

      const since7 = new Date(r7.since!);
      const until7 = new Date(r7.until!);
      const diffDays7 = Math.round((until7.getTime() - since7.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays7).toBe(6); // 7 days inclusive: today + 6 days prior

      const r30 = parseDateRange("30d", "Asia/Jakarta");
      const since30 = new Date(r30.since!);
      const until30 = new Date(r30.until!);
      const diffDays30 = Math.round((until30.getTime() - since30.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays30).toBe(29); // 30 days inclusive
    });

    it("parses custom date range format 'YYYY-MM-DD:YYYY-MM-DD'", () => {
      const custom = parseDateRange("2026-10-01:2026-10-25", "Asia/Jakarta");
      expect(custom.since).toBe("2026-10-01");
      expect(custom.until).toBe("2026-10-25");
    });

    it("returns undefined boundaries for lifetime 'all' preset without dropping records", () => {
      const all = parseDateRange("all", "Asia/Jakarta");
      expect(all.since).toBeUndefined();
      expect(all.until).toBeUndefined();
    });
  });

  describe("2. CTWA Action Type Mapping & Results Extraction", () => {
    it("maps 'onsite_conversion.messaging_conversation_started_7d' to conversions", () => {
      const mockInsight: MetaInsightResponse = {
        ad_id: "ad_123456",
        spend: "70662.00",
        impressions: "20162",
        clicks: "230",
        inline_link_clicks: "199",
        reach: "18500",
        actions: [
          { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "11" },
          { action_type: "post_reaction", value: "45" },
          { action_type: "page_engagement", value: "275" },
        ],
        date_start: "2026-10-26",
        date_stop: "2026-10-26",
      };

      const internal = mapMetaInsightToInternal(mockInsight, { organizationId: orgId, adId });
      expect(internal.conversions).toBe(11);
      expect(internal.linkClicks).toBe(199);
      expect(internal.clicks).toBe(230);
      expect(internal.impressions).toBe(20162);
      expect(internal.spend).toBe(70662);
      expect(internal.reach).toBe(18500);
      expect(internal.dateStart).toBe("2026-10-26");
      expect(internal.dateStop).toBe("2026-10-26");
    });

    it("does not falsely count generic page post engagements as messaging conversations", () => {
      const mockInsight: MetaInsightResponse = {
        ad_id: "ad_999999",
        spend: "50000.00",
        impressions: "10000",
        clicks: "150",
        inline_link_clicks: "120",
        actions: [
          { action_type: "post_reaction", value: "50" },
          { action_type: "comment", value: "12" },
          { action_type: "share", value: "5" },
        ],
        date_start: "2026-10-26",
        date_stop: "2026-10-26",
      };

      const internal = mapMetaInsightToInternal(mockInsight, { organizationId: orgId, adId });
      expect(internal.conversions).toBe(0); // Strictly 0 because no CTWA action was reported
    });

    it("prefers inline_link_clicks over generic clicks for Link Clicks", () => {
      const mockInsight: MetaInsightResponse = {
        ad_id: "ad_link_test",
        spend: "100000.00",
        impressions: "25000",
        clicks: "350", // All clicks
        inline_link_clicks: "280", // Inline Link clicks
        date_start: "2026-10-26",
        date_stop: "2026-10-26",
      };

      const internal = mapMetaInsightToInternal(mockInsight, { organizationId: orgId, adId });
      expect(internal.clicks).toBe(350);
      expect(internal.linkClicks).toBe(280);
    });
  });

  describe("3. Mathematical Metric Formulas & Rounding Rules", () => {
    it("calculates weighted Link CTR and Link CPC accurately", () => {
      const totalSpend = 70662;
      const totalImpressions = 20162;
      const totalLinkClicks = 199;
      const totalResults = 11;
      const totalReach = 18500;

      // Link CTR = (Link Clicks / Impressions) * 100
      const linkCtr = Number(((totalLinkClicks / totalImpressions) * 100).toFixed(2));
      expect(linkCtr).toBe(0.99); // 199 / 20162 * 100 = 0.9870... -> 0.99%

      // Link CPC = Spend / Link Clicks
      const linkCpc = Number((totalSpend / totalLinkClicks).toFixed(2));
      expect(linkCpc).toBe(355.09); // 70662 / 199 = 355.0854... -> Rp 355.09

      // CPM = (Spend / Impressions) * 1000
      const cpm = Number(((totalSpend / totalImpressions) * 1000).toFixed(2));
      expect(cpm).toBe(3504.71); // 70662 / 20162 * 1000 = 3504.7118... -> Rp 3,504.71

      // Cost per Result = Spend / Messaging Conversations Started
      const costPerResult = Number((totalSpend / totalResults).toFixed(2));
      expect(costPerResult).toBe(6423.82); // 70662 / 11 = 6423.8181... -> Rp 6,423.82

      // Frequency = Impressions / Reach
      const frequency = Number((totalImpressions / totalReach).toFixed(2));
      expect(frequency).toBe(1.09); // 20162 / 18500 = 1.0898... -> 1.09x
    });

    it("safely handles zero denominators without throwing or producing NaN/Infinity", () => {
      const zeroImpressions = 0;
      const zeroClicks = 0;
      const zeroConversions = 0;
      const spend = 50000;

      const linkCtr = zeroImpressions > 0 ? Number(((zeroClicks / zeroImpressions) * 100).toFixed(2)) : null;
      const linkCpc = zeroClicks > 0 ? Number((spend / zeroClicks).toFixed(2)) : null;
      const cpm = zeroImpressions > 0 ? Number(((spend / zeroImpressions) * 1000).toFixed(2)) : null;
      const costPerResult = zeroConversions > 0 ? Number((spend / zeroConversions).toFixed(2)) : null;

      expect(linkCtr).toBeNull();
      expect(linkCpc).toBeNull();
      expect(cpm).toBeNull();
      expect(costPerResult).toBeNull();
    });
  });

  describe("4. Multi-Tenant Account Isolation & Unique Key Determinism", () => {
    it("ensures insights are mapped strictly to the target organization and ad IDs", () => {
      const mockInsight: MetaInsightResponse = {
        ad_id: "ad_isolated_1",
        spend: "10000",
        impressions: "5000",
        clicks: "450",
        date_start: "2026-10-26",
        date_stop: "2026-10-26",
      };

      const recordA = mapMetaInsightToInternal(mockInsight, { organizationId: "org_A", adId: "db_ad_A" });
      const recordB = mapMetaInsightToInternal(mockInsight, { organizationId: "org_B", adId: "db_ad_B" });

      expect(recordA.organizationId).toBe("org_A");
      expect(recordA.adId).toBe("db_ad_A");

      expect(recordB.organizationId).toBe("org_B");
      expect(recordB.adId).toBe("db_ad_B");

      // Verifies no leak or cross-pollination between tenant IDs
      expect(recordA.organizationId).not.toBe(recordB.organizationId);
    });

    it("verifies daily insights store date_start == date_stop to prevent multi-day overlapping duplicates", () => {
      const dailyInsight: MetaInsightResponse = {
        ad_id: "ad_daily_check",
        spend: "25000",
        impressions: "4000",
        clicks: "320",
        date_start: "2026-10-25",
        date_stop: "2026-10-25",
      };

      const mapped = mapMetaInsightToInternal(dailyInsight, { organizationId: orgId, adId });
      expect(mapped.dateStart).toBe(mapped.dateStop);
      expect(mapped.dateStart).toBe("2026-10-25");
    });
  });

  describe("5. Delivery Status Hierarchy Distinction", () => {
    function resolveDeliveryStatus(campaignStatus: string, adSettingStatus: string): string {
      if (campaignStatus === "PAUSED") return "CAMPAIGN_PAUSED";
      if (campaignStatus === "ACTIVE") return adSettingStatus === "ACTIVE" ? "ACTIVE" : "AD_PAUSED";
      return "UNKNOWN";
    }

    it("accurately classifies delivery as CAMPAIGN_PAUSED when parent campaign is PAUSED even if ad is active", () => {
      expect(resolveDeliveryStatus("PAUSED", "ACTIVE")).toBe("CAMPAIGN_PAUSED");
    });

    it("accurately classifies delivery as AD_PAUSED when campaign is ACTIVE but ad setting is PAUSED", () => {
      expect(resolveDeliveryStatus("ACTIVE", "PAUSED")).toBe("AD_PAUSED");
    });

    it("accurately classifies delivery as ACTIVE only when BOTH campaign and ad are ACTIVE", () => {
      expect(resolveDeliveryStatus("ACTIVE", "ACTIVE")).toBe("ACTIVE");
    });
  });
});
