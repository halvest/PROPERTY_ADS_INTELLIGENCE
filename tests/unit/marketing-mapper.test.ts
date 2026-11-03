import { describe, it, expect } from "vitest";
import {
  mapMetaAccountToInternal,
  mapMetaCampaignToInternal,
  mapMetaAdToInternal,
  mapMetaInsightToInternal,
  parseSpend,
  parseCount,
} from "@/lib/marketing/meta/mapper";
import type {
  MetaAdAccountResponse,
  MetaCampaignResponse,
  MetaAdResponse,
  MetaInsightResponse,
} from "@/lib/marketing/meta/types";

describe("Meta Marketing API - Data Mapper & Normalization", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";

  describe("parseSpend & parseCount", () => {
    it("safely converts monetary string values to non-negative floats", () => {
      expect(parseSpend("4500000.00")).toBe(4500000);
      expect(parseSpend("1250000.50")).toBe(1250000.5);
      expect(parseSpend(350000)).toBe(350000);
    });

    it("distinguishes explicit zero from not-available (DI-04)", () => {
      // Explicit zero reported by Meta stays zero.
      expect(parseSpend("0")).toBe(0);
      expect(parseSpend("0.00")).toBe(0);
      expect(parseSpend(0)).toBe(0);
      expect(parseCount("0")).toBe(0);
      expect(parseCount(0)).toBe(0);
      // Missing, empty, non-numeric, or negative values are NOT available.
      expect(parseSpend(null)).toBeNull();
      expect(parseSpend(undefined)).toBeNull();
      expect(parseSpend("")).toBeNull();
      expect(parseSpend("invalid")).toBeNull();
      expect(parseSpend("-50000")).toBeNull();
      expect(parseCount(null)).toBeNull();
      expect(parseCount(undefined)).toBeNull();
      expect(parseCount("N/A")).toBeNull();
      expect(parseCount("-100")).toBeNull();
    });

    it("safely converts metric counts to non-negative integers", () => {
      expect(parseCount("48200")).toBe(48200);
      expect(parseCount(1250)).toBe(1250);
      expect(parseCount("1250.9")).toBe(1250);
    });
  });

  describe("mapMetaAccountToInternal", () => {
    it("maps ad account metadata and ensures 'act_' prefix", () => {
      const metaAccount: MetaAdAccountResponse = {
        id: "123456789",
        account_id: "123456789",
        name: "Developer BSD Ads",
        currency: "idr",
        timezone_name: "Asia/Jakarta",
        account_status: 1, // ACTIVE
      };

      const normalized = mapMetaAccountToInternal(metaAccount, orgId);

      expect(normalized.organizationId).toBe(orgId);
      expect(normalized.providerAccountId).toBe("act_123456789");
      expect(normalized.accountName).toBe("Developer BSD Ads");
      expect(normalized.currency).toBe("IDR");
      expect(normalized.timezone).toBe("Asia/Jakarta");
      expect(normalized.connectionStatus).toBe("connected");
      expect(normalized.provider).toBe("meta");
    });

    it("marks status as error when account_status is not 1 (active)", () => {
      const disabledAccount: MetaAdAccountResponse = {
        id: "act_999999",
        account_id: "999999",
        name: "Disabled Account",
        currency: "IDR",
        timezone_name: "Asia/Jakarta",
        account_status: 2, // DISABLED
      };

      const normalized = mapMetaAccountToInternal(disabledAccount, orgId);
      expect(normalized.connectionStatus).toBe("error");
    });
  });

  describe("mapMetaCampaignToInternal & mapMetaAdToInternal", () => {
    it("maps campaign fields accurately", () => {
      const metaCmp: MetaCampaignResponse = {
        id: "cmp_101",
        name: "Promo Cluster Sapphire BSD",
        status: "ACTIVE",
        objective: "OUTCOME_LEADS",
      };

      const normalized = mapMetaCampaignToInternal(metaCmp, orgId, "act_123");
      expect(normalized.providerCampaignId).toBe("cmp_101");
      expect(normalized.name).toBe("Promo Cluster Sapphire BSD");
      expect(normalized.status).toBe("ACTIVE");
      expect(normalized.objective).toBe("OUTCOME_LEADS");
    });

    it("maps ad fields and references campaign", () => {
      const metaAd: MetaAdResponse = {
        id: "ad_202",
        name: "Cluster Sapphire - Tipe 72",
        status: "ACTIVE",
        campaign_id: "cmp_101",
      };

      const normalized = mapMetaAdToInternal(metaAd, orgId, "cmp_internal_uuid");
      expect(normalized.providerAdId).toBe("ad_202");
      expect(normalized.name).toBe("Cluster Sapphire - Tipe 72");
      expect(normalized.campaignId).toBe("cmp_internal_uuid");
    });
  });

  describe("mapMetaInsightToInternal", () => {
    it("normalizes spend, impressions, clicks, and date range", () => {
      const rawInsight: MetaInsightResponse = {
        ad_id: "ad_202",
        spend: "4500000.00",
        impressions: "48200",
        clicks: "1250",
        date_start: "2026-10-01",
        date_stop: "2026-10-26",
      };

      const normalized = mapMetaInsightToInternal(rawInsight, {
        organizationId: orgId,
        adId: "ad_internal_uuid",
        currency: "IDR",
        source: "meta",
      });

      expect(normalized.organizationId).toBe(orgId);
      expect(normalized.adId).toBe("ad_internal_uuid");
      expect(normalized.spend).toBe(4500000);
      expect(normalized.impressions).toBe(48200);
      expect(normalized.clicks).toBe(1250);
      expect(normalized.dateStart).toBe("2026-10-01");
      expect(normalized.dateStop).toBe("2026-10-26");
      expect(normalized.level).toBe("ad");
      expect(normalized.source).toBe("meta");
    });

    it("keeps optional metrics null when Meta does not provide them (DI-04)", () => {
      const rawInsight: MetaInsightResponse = {
        ad_id: "ad_202",
        spend: "0",
        impressions: "0",
        clicks: "0",
        date_start: "2026-10-01",
        date_stop: "2026-10-01",
      };
      const normalized = mapMetaInsightToInternal(rawInsight, {
        organizationId: orgId,
        adId: "ad_internal_uuid",
        currency: "IDR",
        source: "meta",
      });
      // Explicit zeros stay zero...
      expect(normalized.spend).toBe(0);
      expect(normalized.impressions).toBe(0);
      expect(normalized.clicks).toBe(0);
      // ...while absent optional metrics stay not-available.
      expect(normalized.reach).toBeNull();
      expect(normalized.linkClicks).toBeNull();
      expect(normalized.conversions).toBeNull();
    });

    it("reports conversions as 0 when Meta returns actions without conversion actions", () => {
      const rawInsight: MetaInsightResponse = {
        ad_id: "ad_202",
        spend: "1000",
        impressions: "10",
        clicks: "1",
        actions: [{ action_type: "link_click", value: "1" }],
        date_start: "2026-10-01",
        date_stop: "2026-10-01",
      };
      const normalized = mapMetaInsightToInternal(rawInsight, {
        organizationId: orgId,
        adId: "ad_internal_uuid",
        currency: "IDR",
        source: "meta",
      });
      expect(normalized.conversions).toBe(0);
      expect(normalized.linkClicks).toBe(1);
    });
  });
});
