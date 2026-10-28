import { describe, it, expect } from "vitest";
import { mapEvidenceToBuyerCriteriaInputs } from "@/lib/ai/lead-evidence/domain-adapter";
import { calculateBuyerScore } from "@/domain/scoring/buyer-score";
import { filterLeadsForAdRanking } from "@/domain/attribution/evaluator";
import type { ExtractedLeadEvidence } from "@/lib/ai/lead-evidence/schema";

describe("Scoring Determinism & Attribution Integrity Preservation", () => {
  it("preserves deterministic buyer score calculation from extracted facts", () => {
    const completeEvidence: ExtractedLeadEvidence = {
      purchaseIntent: "high", // 25
      budget: { amount: 1500000000, currency: "IDR", isExplicit: true, rawText: "1.5 M" }, // 20
      preferredLocation: "BSD City", // 20 (both loc & type)
      propertyType: "Tipe 72",
      purchaseTimeline: "immediate", // 15
      readinessForNextStep: "ready_for_survey", // 20
      objections: [],
      recommendedFollowUp: null,
      evidenceQuotes: [
        { field: "purchaseIntent", quote: "Pasti beli", sourceMessageId: "msg_1" },
        { field: "budget", quote: "Budget 1,5 M", sourceMessageId: "msg_2" },
        { field: "preferredLocation", quote: "BSD", sourceMessageId: "msg_3" },
        { field: "propertyType", quote: "Tipe 72", sourceMessageId: "msg_3" },
        { field: "purchaseTimeline", quote: "Bulan ini", sourceMessageId: "msg_4" },
        { field: "readinessForNextStep", quote: "Siap survei besok", sourceMessageId: "msg_5" },
      ],
      unconfirmedFields: [],
      confidenceScore: 0.95,
      uncertaintyReason: null,
      model: "muse-spark-1.3",
      provider: "meta_model_api",
    };

    const inputs = mapEvidenceToBuyerCriteriaInputs(completeEvidence);
    const assessment = calculateBuyerScore(inputs);

    // Sum: 25 + 20 + 20 + 15 + 20 = 100
    expect(assessment.rawPoints).toBe(100);
    expect(assessment.completeness).toBe(100);
    expect(assessment.status).toBe("completed");
    expect(assessment.criteria["purchase_intent"].status).toBe("scored");
    expect(assessment.normalizedScore).toBe(100);
    expect(assessment.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("handles unconfirmed/missing evidence without hallucinating points", () => {
    const partialEvidence: ExtractedLeadEvidence = {
      purchaseIntent: "high", // 25
      budget: null, // missing -> 0 pts
      preferredLocation: null, // missing -> 0 pts
      propertyType: null,
      purchaseTimeline: "unconfirmed", // missing -> 0 pts
      readinessForNextStep: "requesting_brochure", // 12
      objections: [],
      recommendedFollowUp: null,
      evidenceQuotes: [
        { field: "purchaseIntent", quote: "Tertarik", sourceMessageId: "msg_1" },
        { field: "readinessForNextStep", quote: "Minta brosur", sourceMessageId: "msg_2" },
      ],
      unconfirmedFields: ["budget", "preferredLocation", "purchaseTimeline"],
      confidenceScore: 0.6,
      uncertaintyReason: "Banyak field belum terkonfirmasi",
      model: "muse-spark-1.3",
      provider: "meta_model_api",
    };

    const inputs = mapEvidenceToBuyerCriteriaInputs(partialEvidence);
    const assessment = calculateBuyerScore(inputs);

    // Assessed weight: purchase_intent (25) + readiness_for_action (20) = 45 / 100
    expect(assessment.completeness).toBe(45);
    expect(assessment.rawPoints).toBe(25 + 12); // 37
    expect(assessment.missingCriteria).toEqual([
      "budget_fit",
      "property_needs_fit",
      "purchase_timeline",
    ]);
  });

  it("preserves distinction between numeric score 0, missing, and invalid status", () => {
    // 0 points explicitly scored
    const zeroScoreAssessment = calculateBuyerScore([
      {
        criterion: "purchase_intent",
        points: 0,
        evidence: [{ criterion: "purchase_intent", explanation: "Tidak berminat sama sekali", evidenceStatus: "supported" }],
      },
      {
        criterion: "budget_fit",
        points: 0,
        evidence: [{ criterion: "budget_fit", explanation: "Tidak ada uang", evidenceStatus: "supported" }],
      },
      {
        criterion: "property_needs_fit",
        points: 0,
        evidence: [{ criterion: "property_needs_fit", explanation: "Bukan lokasi yang dicari", evidenceStatus: "supported" }],
      },
      {
        criterion: "purchase_timeline",
        points: 0,
        evidence: [{ criterion: "purchase_timeline", explanation: "Tidak akan beli dalam waktu dekat", evidenceStatus: "supported" }],
      },
      {
        criterion: "readiness_for_action",
        points: 0,
        evidence: [{ criterion: "readiness_for_action", explanation: "Tolak dihubungi lagi", evidenceStatus: "supported" }],
      },
    ]);

    expect(zeroScoreAssessment.status).toBe("completed");
    expect(zeroScoreAssessment.criteria["purchase_intent"].status).toBe("scored");
    expect(zeroScoreAssessment.criteria["purchase_intent"].score).toBe(0);
    expect(zeroScoreAssessment.rawPoints).toBe(0);
    expect(zeroScoreAssessment.completeness).toBe(100);

    // Missing status
    const missingAssessment = calculateBuyerScore([]);
    expect(missingAssessment.status).toBe("insufficient_evidence");
    expect(missingAssessment.normalizedScore).toBeNull();
    expect(missingAssessment.completeness).toBe(0);

    // Invalid status
    const invalidAssessment = calculateBuyerScore([
      { criterion: "purchase_intent", status: "invalid", invalidReason: "Data korup" },
    ]);
    expect(invalidAssessment.status).toBe("invalid");
    expect(invalidAssessment.normalizedScore).toBeNull();
  });

  it("strictly excludes leads with 'unknown' attribution from ad ranking calculations", () => {
    const sampleLeads = [
      {
        id: "lead_1",
        name: "Lead Verified",
        adId: "ad_sapphire_72",
        attributionStatus: "verified" as const,
      },
      {
        id: "lead_2",
        name: "Lead Inferred",
        adId: "ad_sapphire_72",
        attributionStatus: "inferred" as const,
      },
      {
        id: "lead_3",
        name: "Lead Unknown",
        adId: null,
        attributionStatus: "unknown" as const,
      },
    ];

    const rankedLeads = filterLeadsForAdRanking(sampleLeads, "ad_sapphire_72");

    expect(rankedLeads).toHaveLength(2);
    expect(rankedLeads.map((l) => l.attributionStatus)).toEqual(["verified", "inferred"]);
    expect(rankedLeads.find((l) => l.attributionStatus === "unknown")).toBeUndefined();
  });
});
