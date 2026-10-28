/**
 * Property Ads Intelligence - Phase 9.1 Production Logic & Security Audit Unit Tests
 * 
 * Tests the 10 critical edge cases outlined in the Phase 9.1 Audit specification:
 * 1. High CTR but sample size too small (insufficient_data priority).
 * 2. High spend and zero qualified leads (investigate).
 * 3. All leads unknown or unassessed (insufficient_data & null qualifiedLeadRate).
 * 4. CPQL null because denominator is zero.
 * 5. Verified attribution rate null when computable leads is 0.
 * 6. High inferred attribution with low verified attribution (hold, cannot scale).
 * 7. Incomplete / null Buyer Score values.
 * 8. Negative, non-finite (NaN, Infinity) input data.
 * 9. Non-comparable / very short observation periods (dateRange: 'today' limitation).
 * 10. Multi-tenant review status isolation & invalid status rejection.
 */

import { describe, it, expect } from "vitest";
import { evaluateAdOptimization } from "@/domain/recommendations/engine";
import type { AdEvaluationInput } from "@/domain/recommendations/types";
import {
  getAdOptimizationRecommendations,
  updateRecommendationStatus,
} from "@/lib/data/dashboard-service";

describe("Phase 9.1 — Production Logic & Edge Case Audit", () => {
  const standardBaseline: AdEvaluationInput = {
    adId: "ad_audit_01",
    adName: "Cluster Audit Grand BSD",
    campaignName: "Kampanye Audit",
    dateRange: "30d",
    spend: 2_500_000,
    impressions: 50_000,
    clicks: 1_200,
    attributedLeadsCount: 10,
    qualifiedLeadsCount: 4,
    avgBuyerScore: 78.0,
    buyerScoreSampleSize: 8,
    verifiedCount: 7,
    inferredCount: 3,
    dataSource: "mock",
  };

  // Case 1: High CTR, but sample size is too small (< 5 assessed leads)
  it("Case 1: enforces 'insufficient_data' priority when sample size is too small despite high CTR", () => {
    const input: AdEvaluationInput = {
      ...standardBaseline,
      clicks: 2_500, // CTR = (2500 / 50000) * 100 = 5.0% (well above vanity threshold 2.0%)
      buyerScoreSampleSize: 3, // Below minSampleSize threshold 5
      avgBuyerScore: 40.0, // Low score, which would trigger vanity clicks IF sample were sufficient
    };

    const rec = evaluateAdOptimization(input);

    expect(rec.category).toBe("insufficient_data");
    expect(rec.headline).toBe("Data Belum Memadai untuk Rekomendasi");
    expect(rec.reason).toContain("belum memenuhi ambang batas minimal");
  });

  // Case 2: High spend and zero qualified leads
  it("Case 2: produces 'investigate' when spend exceeds threshold (>= 2M) and qualified leads is 0", () => {
    const input: AdEvaluationInput = {
      ...standardBaseline,
      spend: 3_500_000, // >= 2,000,000 IDR threshold
      clicks: 200, // CTR = 0.4% (< 2% vanity threshold so high spend condition triggers)
      qualifiedLeadsCount: 0,
      buyerScoreSampleSize: 6,
    };

    const rec = evaluateAdOptimization(input);

    expect(rec.category).toBe("investigate");
    expect(rec.headline).toBe("Biaya Tinggi Tanpa Qualified Lead");
    expect(rec.reason).toContain("Rp 3.500.000 tanpa menghasilkan satupun qualified lead");
    expect(rec.supportingMetrics.cpql).toBeNull();
  });

  // Case 3: All leads unknown or unassessed
  it("Case 3: produces 'insufficient_data' and null qualified lead rate when all leads are unassessed", () => {
    const input: AdEvaluationInput = {
      ...standardBaseline,
      attributedLeadsCount: 10,
      qualifiedLeadsCount: 0,
      buyerScoreSampleSize: 0, // 0 leads assessed
      avgBuyerScore: null,
    };

    const rec = evaluateAdOptimization(input);

    expect(rec.category).toBe("insufficient_data");
    expect(rec.supportingMetrics.buyerScoreSampleSize).toBe(0);
    expect(rec.supportingMetrics.qualifiedLeadRate).toBeNull();
    expect(rec.supportingMetrics.avgBuyerScore).toBeNull();
  });

  // Case 4: CPQL null because denominator is zero
  it("Case 4: ensures CPQL is null with an explicit reason when qualified leads is 0", () => {
    const input: AdEvaluationInput = {
      ...standardBaseline,
      spend: 1_800_000,
      qualifiedLeadsCount: 0,
    };

    const rec = evaluateAdOptimization(input);

    expect(rec.supportingMetrics.cpql).toBeNull();
    expect(rec.supportingMetrics.cpqlReason).toBe(
      "Tidak ada qualified leads yang teratribusi (n = 0)"
    );
  });

  // Case 5: Verified attribution rate null when computable leads is 0
  it("Case 5: returns null for verified attribution rate when computable attributed leads is 0", () => {
    const input: AdEvaluationInput = {
      ...standardBaseline,
      verifiedCount: 0,
      inferredCount: 0,
      attributedLeadsCount: 0,
    };

    const rec = evaluateAdOptimization(input);

    expect(rec.supportingMetrics.verifiedAttributionRate).toBeNull();
  });

  // Case 6: High inferred attribution, but low verified attribution
  it("Case 6: prevents 'scale_candidate' (demotes to 'hold') when verified attribution rate is below threshold", () => {
    const input: AdEvaluationInput = {
      ...standardBaseline,
      spend: 3_000_000,
      avgBuyerScore: 82.0, // High buyer score (>= 70)
      qualifiedLeadsCount: 5,
      buyerScoreSampleSize: 8, // QL rate = (5/8)*100 = 62.5% (>= 25%)
      verifiedCount: 1, // Only 1 verified lead
      inferredCount: 9, // 9 inferred leads -> rate = 1 / (1 + 9) = 10.0% (< 60% threshold)
    };

    const rec = evaluateAdOptimization(input);

    expect(rec.supportingMetrics.verifiedAttributionRate).toBe(10);
    expect(rec.category).toBe("hold"); // Cannot scale due to low verified attribution certainty
    expect(rec.headline).toContain("Pertahankan dan Pantau Performa");
  });

  // Case 7: Incomplete Buyer score values
  it("Case 7: flags insufficient data when buyer score is incomplete / null", () => {
    const input: AdEvaluationInput = {
      ...standardBaseline,
      avgBuyerScore: null,
      buyerScoreSampleSize: 0,
    };

    const rec = evaluateAdOptimization(input);

    expect(rec.category).toBe("insufficient_data");
    expect(rec.supportingMetrics.avgBuyerScore).toBeNull();
  });

  // Case 8: Negative, non-finite, and invalid numbers
  it("Case 8: rejects negative or non-finite inputs immediately in Step A as 'insufficient_data'", () => {
    const negativeSpend: AdEvaluationInput = {
      ...standardBaseline,
      spend: -500_000,
    };
    const recSpend = evaluateAdOptimization(negativeSpend);
    expect(recSpend.category).toBe("insufficient_data");
    expect(recSpend.headline).toBe("Data Tidak Valid atau Belum Memadai");
    expect(recSpend.reason).toContain("non-finite");

    const nanClicks: AdEvaluationInput = {
      ...standardBaseline,
      clicks: NaN,
    };
    const recClicks = evaluateAdOptimization(nanClicks);
    expect(recClicks.category).toBe("insufficient_data");
    expect(recClicks.headline).toBe("Data Tidak Valid atau Belum Memadai");

    const infiniteImpressions: AdEvaluationInput = {
      ...standardBaseline,
      impressions: Infinity,
    };
    const recImp = evaluateAdOptimization(infiniteImpressions);
    expect(recImp.category).toBe("insufficient_data");
    expect(recImp.headline).toBe("Data Tidak Valid atau Belum Memadai");
  });

  // Case 9: Non-comparable observation periods (dateRange: 'today' or 'yesterday')
  it("Case 9: appends analysis limitation warning when date range is very short", () => {
    const todayInput: AdEvaluationInput = {
      ...standardBaseline,
      dateRange: "today",
    };

    const rec = evaluateAdOptimization(todayInput);

    expect(
      rec.missingDataAndLimitations.some((lim) =>
        lim.includes("Rentang waktu evaluasi sangat singkat (< 3 hari)")
      )
    ).toBe(true);
  });
});

describe("Phase 9.1 — Multi-Tenant Review & Audit Trail Security", () => {
  it("Case 10a: ensures review status is strictly isolated per tenant (Tenant A does not leak to Tenant B)", () => {
    const targetRecId = "rec_ad_sapphire_72_all";

    // 1. Tenant A marks recommendation as reviewed
    const reviewResult = updateRecommendationStatus({
      recommendationId: targetRecId,
      status: "reviewed",
      organizationId: "org_tenant_alpha",
      actorId: "usr_specialist_alpha",
      actorName: "Siti Rahmawati (Alpha)",
      note: "Disetujui untuk uji coba kenaikan anggaran pada Tenant Alpha.",
    });

    expect(reviewResult.success).toBe(true);
    expect(reviewResult.recommendation?.status).toBe("reviewed");
    expect(reviewResult.recommendation?.reviewedBy).toBe("Siti Rahmawati (Alpha)");

    // 2. Tenant B accesses the same recommendation ID
    const tenantBRecs = getAdOptimizationRecommendations({
      organizationId: "org_tenant_beta",
    });
    const tenantBTarget = tenantBRecs.find((r) => r.id === targetRecId);

    // CRITICAL SECURITY ASSERTION: Tenant B must see 'active', not Tenant A's 'reviewed'
    expect(tenantBTarget?.status).toBe("active");
    expect(tenantBTarget?.reviewedBy).toBeUndefined();
    expect(tenantBTarget?.reviewNote).toBeUndefined();

    // 3. Tenant A still sees their reviewed status intact
    const tenantARecs = getAdOptimizationRecommendations({
      organizationId: "org_tenant_alpha",
    });
    const tenantATarget = tenantARecs.find((r) => r.id === targetRecId);
    expect(tenantATarget?.status).toBe("reviewed");
    expect(tenantATarget?.reviewedBy).toBe("Siti Rahmawati (Alpha)");
  });

  it("Case 10b: rejects invalid review status and empty recommendation ID safely", () => {
    // Unvalidated status string
    const invalidStatusResult = updateRecommendationStatus({
      recommendationId: "rec_ad_test",
      // @ts-expect-error - testing runtime defense against untrusted client status
      status: "malicious_status_or_approved",
      organizationId: "org_tenant_alpha",
    });

    expect(invalidStatusResult.success).toBe(false);
    expect(invalidStatusResult.error).toContain("Status tidak valid");

    // Empty recommendation ID
    const emptyIdResult = updateRecommendationStatus({
      recommendationId: "   ",
      status: "reviewed",
      organizationId: "org_tenant_alpha",
    });

    expect(emptyIdResult.success).toBe(false);
    expect(emptyIdResult.error).toContain("ID rekomendasi wajib diisi");
  });
});
