import { describe, it, expect } from "vitest";
import {
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateCPQL,
  aggregateAdPerformance,
  type AdPerformanceRow,
} from "@/domain/metrics/marketing";

describe("Deterministic Marketing Metrics & Ratio Aggregations", () => {
  describe("Individual metric formulas & division-by-zero protection", () => {
    it("calculates CTR accurately and returns null on zero or invalid impressions", () => {
      expect(calculateCTR(50, 1000)).toBe(5.0);
      expect(calculateCTR(25, 1250)).toBe(2.0);

      // Denominator zero: must return null, NEVER NaN or Infinity!
      expect(calculateCTR(10, 0)).toBeNull();
      expect(calculateCTR(0, 0)).toBeNull();

      // Negative or invalid inputs
      expect(calculateCTR(-5, 100)).toBeNull();
      expect(calculateCTR(5, -100)).toBeNull();
      expect(calculateCTR(NaN, 100)).toBeNull();
    });

    it("calculates CPC accurately and returns null on zero clicks", () => {
      expect(calculateCPC(5000000, 2500)).toBe(2000.0);

      // Zero clicks
      expect(calculateCPC(1000000, 0)).toBeNull();

      // Negative spend
      expect(calculateCPC(-500, 10)).toBeNull();
    });

    it("calculates CPM accurately and returns null on zero impressions", () => {
      expect(calculateCPM(2500000, 50000)).toBe(50000.0);
      expect(calculateCPM(1000000, 0)).toBeNull();
    });

    it("calculates CPQL accurately and returns null on zero qualified leads", () => {
      // 4.5M spend / 3 qualified leads = 1.5M per qualified lead
      expect(calculateCPQL(4500000, 3)).toBe(1500000.0);

      // Zero qualified leads: MUST return null, NOT Infinity or NaN!
      expect(calculateCPQL(4500000, 0)).toBeNull();
      expect(calculateCPQL(0, 0)).toBeNull();
      expect(calculateCPQL(-1000, 5)).toBeNull();
    });
  });

  describe("Aggregate Ad Performance (Numerator/Denominator Summation)", () => {
    it("recalculates aggregate ratios from total sums, NEVER by averaging row ratios", () => {
      // Ad 1: 10 clicks / 100 impressions = 10.00% CTR, spend 100,000, 1 qualified lead
      // Ad 2: 10 clicks / 1,000 impressions = 1.00% CTR, spend 1,000,000, 1 qualified lead
      // If someone naively averages row-level CTR: (10% + 1%) / 2 = 5.50% (WRONG!)
      // True aggregate CTR: (20 total clicks / 1,100 total impressions) * 100 = 1.82%
      const rows: AdPerformanceRow[] = [
        {
          adId: "ad_1",
          spend: 100000,
          impressions: 100,
          clicks: 10,
          attributedLeadsCount: 5,
          qualifiedLeadsCount: 1,
        },
        {
          adId: "ad_2",
          spend: 1000000,
          impressions: 1000,
          clicks: 10,
          attributedLeadsCount: 5,
          qualifiedLeadsCount: 1,
        },
      ];

      const agg = aggregateAdPerformance(rows);

      expect(agg.totalSpend).toBe(1100000);
      expect(agg.totalImpressions).toBe(1100);
      expect(agg.totalClicks).toBe(20);
      expect(agg.totalQualifiedLeads).toBe(2);

      // True aggregate CTR = (20 / 1100) * 100 = 1.82%
      expect(agg.ctr).toBe(1.82);
      expect(agg.ctr).not.toBe(5.5);

      // True aggregate CPC = 1,100,000 / 20 = 55,000
      expect(agg.cpc).toBe(55000);

      // True aggregate CPQL = 1,100,000 / 2 = 550,000
      expect(agg.cpql).toBe(550000);
    });

    it("handles empty ad performance list safely without crashing", () => {
      const agg = aggregateAdPerformance([]);
      expect(agg.totalSpend).toBe(0);
      expect(agg.totalImpressions).toBe(0);
      expect(agg.totalClicks).toBe(0);
      expect(agg.ctr).toBeNull();
      expect(agg.cpc).toBeNull();
      expect(agg.cpm).toBeNull();
      expect(agg.cpql).toBeNull();
    });
  });
});
