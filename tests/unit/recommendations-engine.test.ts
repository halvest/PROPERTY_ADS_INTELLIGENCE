import { describe, it, expect } from "vitest";
import { evaluateAdOptimization } from "@/domain/recommendations/engine";
import { DEFAULT_RECOMMENDATION_THRESHOLDS } from "@/domain/recommendations/thresholds";
import type { AdEvaluationInput } from "@/domain/recommendations/types";
import {
  getAdOptimizationRecommendations,
  updateRecommendationStatus,
} from "@/lib/data/dashboard-service";

describe("Phase 9 - Deterministic Ad Optimization Recommendation Engine", () => {
  const baseInput: AdEvaluationInput = {
    adId: "ad_test_01",
    adName: "Cluster Test BSD",
    campaignName: "Kampanye Test",
    dateRange: "30d",
    spend: 3_000_000,
    impressions: 40_000,
    clicks: 1_000,
    attributedLeadsCount: 10,
    qualifiedLeadsCount: 4,
    avgBuyerScore: 78.5,
    buyerScoreSampleSize: 8,
    verifiedCount: 7,
    inferredCount: 3,
    dataSource: "mock",
  };

  it("produces 'scale_candidate' when all conservative performance criteria are satisfied", () => {
    const rec = evaluateAdOptimization(baseInput);

    expect(rec.category).toBe("scale_candidate");
    expect(rec.headline).toContain("Kandidat Evaluasi Manual Peningkatan Anggaran");
    expect(rec.supportingMetrics.cpql).toBe(750_000); // 3M / 4
    expect(rec.supportingMetrics.qualifiedLeadRate).toBe(50); // 4 / 8 assessed leads
    expect(rec.supportingMetrics.verifiedAttributionRate).toBe(70); // 7 / 10 computable leads
    expect(rec.supportingMetrics.avgBuyerScore).toBe(78.5);
    expect(rec.missingDataAndLimitations).toContain(
      "Evaluasi menggunakan data mock sintetis (bukan data live Meta Marketing API)."
    );
  });

  it("produces 'insufficient_data' when buyerScoreSampleSize is below minimum threshold (n < 5)", () => {
    const input: AdEvaluationInput = {
      ...baseInput,
      buyerScoreSampleSize: 3, // Below threshold 5
      avgBuyerScore: 85,
    };

    const rec = evaluateAdOptimization(input);
    expect(rec.category).toBe("insufficient_data");
    expect(rec.headline).toContain("Data Belum Memadai");
    expect(rec.reason).toContain("belum memenuhi ambang batas minimal");
  });

  it("produces 'insufficient_data' when attributedLeadsCount is less than 3", () => {
    const input: AdEvaluationInput = {
      ...baseInput,
      attributedLeadsCount: 2,
      buyerScoreSampleSize: 2,
    };

    const rec = evaluateAdOptimization(input);
    expect(rec.category).toBe("insufficient_data");
  });

  it("produces 'investigate' for vanity clicks: high CTR (>= 2%) but low Buyer Score (< 55)", () => {
    const input: AdEvaluationInput = {
      ...baseInput,
      spend: 4_000_000,
      impressions: 50_000,
      clicks: 1_800, // CTR = 3.6%
      attributedLeadsCount: 12,
      qualifiedLeadsCount: 1, // Only 1 qualified lead
      avgBuyerScore: 48.0, // Low buyer score
      buyerScoreSampleSize: 10,
    };

    const rec = evaluateAdOptimization(input);
    expect(rec.category).toBe("investigate");
    expect(rec.headline).toContain("Sinyal Vanity Clicks");
    expect(rec.headline).toContain("CTR Tinggi tetapi Mutu Lead Rendah");
    expect(rec.reason).toContain("rasio klik tinggi");
  });

  it("produces 'investigate' when ad spend is high (>= 2M) but qualified leads count is 0", () => {
    const input: AdEvaluationInput = {
      ...baseInput,
      spend: 2_500_000,
      clicks: 300, // CTR = 0.75% (< 2.0% vanity threshold)
      impressions: 40_000,
      attributedLeadsCount: 6,
      qualifiedLeadsCount: 0, // 0 qualified leads
      avgBuyerScore: 50,
      buyerScoreSampleSize: 5,
    };

    const rec = evaluateAdOptimization(input);
    expect(rec.category).toBe("investigate");
    expect(rec.headline).toContain("Biaya Tinggi Tanpa Qualified Lead");
    expect(rec.supportingMetrics.cpql).toBeNull();
    expect(rec.supportingMetrics.cpqlReason).toContain("Tidak ada qualified leads");
  });

  it("produces 'investigate' when CPQL deteriorates beyond threshold (> Rp 3.5M)", () => {
    const input: AdEvaluationInput = {
      ...baseInput,
      spend: 4_500_000,
      attributedLeadsCount: 8,
      qualifiedLeadsCount: 1, // CPQL = 4.5M
      avgBuyerScore: 68.0,
      buyerScoreSampleSize: 6,
    };

    const rec = evaluateAdOptimization(input);
    expect(rec.category).toBe("investigate");
    expect(rec.headline).toContain("CPQL) Membengkak");
  });

  it("produces 'hold' when metrics are moderate and healthy without meeting strict scale criteria", () => {
    const input: AdEvaluationInput = {
      ...baseInput,
      spend: 2_000_000,
      attributedLeadsCount: 8,
      qualifiedLeadsCount: 2, // CPQL = 1M, QL rate = 25%
      avgBuyerScore: 65.0, // Moderate: 65 < 70 (does not meet scale threshold)
      buyerScoreSampleSize: 6,
      verifiedCount: 6,
      inferredCount: 2,
    };

    const rec = evaluateAdOptimization(input);
    expect(rec.category).toBe("hold");
    expect(rec.headline).toContain("Pertahankan dan Pantau Performa");
  });

  it("guarantees determinism: identical inputs produce identical recommendations", () => {
    const rec1 = evaluateAdOptimization(baseInput, DEFAULT_RECOMMENDATION_THRESHOLDS);
    const rec2 = evaluateAdOptimization(baseInput, DEFAULT_RECOMMENDATION_THRESHOLDS);

    expect(rec1).toEqual(rec2);
  });

  it("handles division by zero and empty metrics safely without NaN or Infinity", () => {
    const zeroInput: AdEvaluationInput = {
      adId: "ad_zero",
      adName: "Zero Data Ad",
      dateRange: "all",
      spend: 0,
      impressions: 0,
      clicks: 0,
      attributedLeadsCount: 0,
      qualifiedLeadsCount: 0,
      avgBuyerScore: null,
      buyerScoreSampleSize: 0,
      verifiedCount: 0,
      inferredCount: 0,
      dataSource: "live",
    };

    const rec = evaluateAdOptimization(zeroInput);
    expect(rec.category).toBe("insufficient_data");
    expect(rec.supportingMetrics.ctr).toBeNull();
    expect(rec.supportingMetrics.cpc).toBeNull();
    expect(rec.supportingMetrics.cpm).toBeNull();
    expect(rec.supportingMetrics.cpql).toBeNull();
    expect(rec.supportingMetrics.qualifiedLeadRate).toBeNull();
  });

  it("correctly identifies live vs mock data source limitations", () => {
    const mockRec = evaluateAdOptimization({ ...baseInput, dataSource: "mock" });
    const liveRec = evaluateAdOptimization({ ...baseInput, dataSource: "live" });

    expect(
      mockRec.missingDataAndLimitations.some((lim) => lim.includes("data mock"))
    ).toBe(true);
    expect(
      liveRec.missingDataAndLimitations.some((lim) => lim.includes("data mock"))
    ).toBe(false);
  });
});

describe("Dashboard Service - Recommendations Integration & Audit Trail", () => {
  it("retrieves ad optimization recommendations with category filtering", () => {
    const all = getAdOptimizationRecommendations({ dateRange: "all" });
    expect(all.length).toBeGreaterThan(0);

    const scaleOnly = getAdOptimizationRecommendations({
      dateRange: "all",
      categoryFilter: "scale_candidate",
    });
    expect(scaleOnly.every((r) => r.category === "scale_candidate")).toBe(true);
  });

  it("allows marking a recommendation as reviewed or dismissed with audit tracking", () => {
    const all = getAdOptimizationRecommendations({ dateRange: "all" });
    const target = all[0];
    expect(target).toBeDefined();

    const result = updateRecommendationStatus({
      recommendationId: target.id,
      status: "reviewed",
      actorId: "usr_lead_specialist_99",
      actorName: "Budi Santoso",
      note: "Disetujui untuk peningkatan anggaran 10% minggu depan.",
    });

    expect(result.success).toBe(true);
    expect(result.recommendation?.status).toBe("reviewed");
    expect(result.recommendation?.reviewedBy).toBe("Budi Santoso");
    expect(result.recommendation?.reviewNote).toContain("peningkatan anggaran");
  });
});
