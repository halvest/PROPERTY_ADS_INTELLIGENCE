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
      expect(parseSpend("invalid")).toBe(0);
      expect(parseSpend("-50000")).toBe(0);
      expect(parseSpend(null)).toBe(0);
      expect(parseSpend(undefined)).toBe(0);
    });

    it("safely converts metric counts to non-negative integers", () => {
      expect(parseCount("48200")).toBe(48200);
      expect(parseCount(1250)).toBe(1250);
      expect(parseCount("1250.9")).toBe(1250);
      expect(parseCount("N/A")).toBe(0);
      expect(parseCount("-100")).toBe(0);
      expect(parseCount(null)).toBe(0);
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
  });
});
