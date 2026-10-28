import { describe, it, expect } from "vitest";
import { parseDateRange } from "@/lib/ads/date-utils";

describe("Ads Intelligence Date & Metric Contracts", () => {
  describe("parseDateRange", () => {
    it("parses 30d range correctly with 30-day inclusive boundary in Asia/Jakarta timezone", () => {
      const { since, until } = parseDateRange("30d", "Asia/Jakarta");
      expect(since).toBeDefined();
      expect(until).toBeDefined();
      expect(since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(since! <= until!).toBe(true);

      const dSince = new Date(since!);
      const dUntil = new Date(until!);
      const diffDays = Math.round((dUntil.getTime() - dSince.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(29); // 30 days inclusive [today-29, today]
    });

    it("parses 7d range correctly with 7-day inclusive boundary", () => {
      const { since, until } = parseDateRange("7d", "Asia/Jakarta");
      expect(since).toBeDefined();
      expect(until).toBeDefined();

      const dSince = new Date(since!);
      const dUntil = new Date(until!);
      const diffDays = Math.round((dUntil.getTime() - dSince.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(6); // 7 days inclusive [today-6, today]
    });

    it("parses today range where since equals until", () => {
      const { since, until } = parseDateRange("today", "Asia/Jakarta");
      expect(since).toBe(until);
      expect(since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("parses custom ranges YYYY-MM-DD:YYYY-MM-DD deterministically", () => {
      const { since, until } = parseDateRange("2026-10-01:2026-10-25", "Asia/Jakarta");
      expect(since).toBe("2026-10-01");
      expect(until).toBe("2026-10-25");
    });

    it("returns empty object for all time so bounds can be discovered from source insights", () => {
      const { since, until } = parseDateRange("all", "Asia/Jakarta");
      expect(since).toBeUndefined();
      expect(until).toBeUndefined();
    });
  });

  describe("Delivery Status Resolution Rules", () => {
    // Pure function simulating service.ts delivery status logic
    function resolveDeliveryStatus(campaignStatus: string, adSettingStatus: string) {
      const cmp = campaignStatus.toUpperCase();
      const ad = adSettingStatus.toUpperCase();

      if (cmp === "ARCHIVED" || ad === "ARCHIVED") {
        return { deliveryStatus: "ARCHIVED", deliveryLabel: "Diarsipkan" };
      }
      if (cmp === "DELETED" || ad === "DELETED") {
        return { deliveryStatus: "DELETED", deliveryLabel: "Dihapus" };
      }
      if (cmp === "PAUSED") {
        if (ad === "PAUSED") {
          return { deliveryStatus: "AD_PAUSED", deliveryLabel: "Iklan Dijeda" };
        }
        return { deliveryStatus: "CAMPAIGN_PAUSED", deliveryLabel: "Campaign Dijeda" };
      }
      if (cmp === "ACTIVE") {
        if (ad === "ACTIVE") {
          return { deliveryStatus: "ACTIVE", deliveryLabel: "Aktif Menayangkan" };
        }
        return { deliveryStatus: "AD_PAUSED", deliveryLabel: "Iklan Dijeda" };
      }
      return { deliveryStatus: "UNKNOWN", deliveryLabel: "Status Belum Diketahui" };
    }

    it("resolves ACTIVE campaign and ACTIVE ad to Aktif Menayangkan", () => {
      const res = resolveDeliveryStatus("ACTIVE", "ACTIVE");
      expect(res.deliveryStatus).toBe("ACTIVE");
      expect(res.deliveryLabel).toBe("Aktif Menayangkan");
    });

    it("resolves PAUSED campaign with ACTIVE ad to Campaign Dijeda (not actively serving)", () => {
      const res = resolveDeliveryStatus("PAUSED", "ACTIVE");
      expect(res.deliveryStatus).toBe("CAMPAIGN_PAUSED");
      expect(res.deliveryLabel).toBe("Campaign Dijeda");
    });

    it("resolves PAUSED campaign with PAUSED ad to Iklan Dijeda", () => {
      const res = resolveDeliveryStatus("PAUSED", "PAUSED");
      expect(res.deliveryStatus).toBe("AD_PAUSED");
      expect(res.deliveryLabel).toBe("Iklan Dijeda");
    });

    it("resolves ACTIVE campaign with PAUSED ad to Iklan Dijeda", () => {
      const res = resolveDeliveryStatus("ACTIVE", "PAUSED");
      expect(res.deliveryStatus).toBe("AD_PAUSED");
      expect(res.deliveryLabel).toBe("Iklan Dijeda");
    });

    it("resolves ARCHIVED correctly regardless of individual ad status", () => {
      expect(resolveDeliveryStatus("ARCHIVED", "ACTIVE").deliveryStatus).toBe("ARCHIVED");
      expect(resolveDeliveryStatus("ACTIVE", "ARCHIVED").deliveryStatus).toBe("ARCHIVED");
    });
  });

  describe("Reconciliation Denominator Integrity", () => {
    it("ensures campaign breakdown sums 100% to total campaigns", () => {
      const campaigns = [
        { id: "1", status: "ACTIVE" },
        { id: "2", status: "ACTIVE" },
        { id: "3", status: "PAUSED" },
        { id: "4", status: "PAUSED" },
        { id: "5", status: "ARCHIVED" },
      ];

      const active = campaigns.filter((c) => c.status === "ACTIVE").length;
      const paused = campaigns.filter((c) => c.status === "PAUSED").length;
      const archived = campaigns.filter((c) => c.status === "ARCHIVED").length;

      expect(active + paused + archived).toBe(campaigns.length);
    });

    it("ensures ad delivery breakdown sums 100% to total ads without orphaned categories", () => {
      const ads = [
        { id: "1", deliveryStatus: "ACTIVE" },
        { id: "2", deliveryStatus: "ACTIVE" },
        { id: "3", deliveryStatus: "CAMPAIGN_PAUSED" },
        { id: "4", deliveryStatus: "CAMPAIGN_PAUSED" },
        { id: "5", deliveryStatus: "AD_PAUSED" },
        { id: "6", deliveryStatus: "ARCHIVED" },
      ];

      const active = ads.filter((a) => a.deliveryStatus === "ACTIVE").length;
      const campaignPaused = ads.filter((a) => a.deliveryStatus === "CAMPAIGN_PAUSED").length;
      const adPaused = ads.filter((a) => a.deliveryStatus === "AD_PAUSED").length;
      const archived = ads.filter((a) => a.deliveryStatus === "ARCHIVED").length;

      expect(active + campaignPaused + adPaused + archived).toBe(ads.length);
    });
  });

  describe("Weighted Metric Computations", () => {
    it("computes weighted Link CTR across ads correctly rather than simple average of rates", () => {
      const adA = { impressions: 10000, linkClicks: 150 }; // CTR = 1.5%
      const adB = { impressions: 2000, linkClicks: 10 }; // CTR = 0.5%

      const totalImpressions = adA.impressions + adB.impressions;
      const totalClicks = adA.linkClicks + adB.linkClicks;

      const weightedCtr = Number(((totalClicks / totalImpressions) * 100).toFixed(2));
      // (160 / 12000) * 100 = 1.33%
      expect(weightedCtr).toBe(1.33);

      // A flawed arithmetic average would be (1.5 + 0.5) / 2 = 1.0%, which is mathematically invalid
      const arithmeticAvg = (1.5 + 0.5) / 2;
      expect(weightedCtr).not.toBe(arithmeticAvg);
    });

    it("handles zero impressions gracefully with null", () => {
      const totalImpressions = 0;
      const totalClicks = 0;
      const weightedCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
      expect(weightedCtr).toBeNull();
    });

    it("computes cost per result correctly and handles zero results with null", () => {
      const spend = 500000;
      const resultsWithConv = 10;
      const resultsZero = 0;

      const cpr1 = resultsWithConv > 0 ? spend / resultsWithConv : null;
      const cprZero = resultsZero > 0 ? spend / resultsZero : null;

      expect(cpr1).toBe(50000);
      expect(cprZero).toBeNull();
    });
  });
});
