import { describe, it, expect } from "vitest";
import { validateCriterionInput, calculateDimensionAssessment } from "@/domain/scoring/calculator";
import { BUYER_RUBRIC_V1 } from "@/domain/scoring/rubrics";
import type { RawCriterionInput } from "@/domain/scoring/types";

describe("Scoring Calculator - Evidence-Based Confidence Calibration (Audit Fix 1)", () => {
  it("does NOT fabricate numerical confidence when evidence is empty", () => {
    // Score is 20, but evidence array is empty
    const assessmentNoEvidence = validateCriterionInput("purchase_intent", 25, {
      criterion: "purchase_intent",
      points: 20,
      evidence: [],
    });

    expect(assessmentNoEvidence.status).toBe("scored");
    expect(assessmentNoEvidence.score).toBe(20);
    // Crucial check: confidence MUST be null when there is no supporting evidence
    expect(assessmentNoEvidence.confidence).toBeNull();
  });

  it("does NOT fabricate numerical confidence for zero score without evidence", () => {
    const zeroScoreNoEvidence = validateCriterionInput("budget_fit", 20, {
      criterion: "budget_fit",
      points: 0,
      evidence: [],
    });

    expect(zeroScoreNoEvidence.status).toBe("scored");
    expect(zeroScoreNoEvidence.score).toBe(0);
    expect(zeroScoreNoEvidence.confidence).toBeNull();
  });

  it("assigns high confidence ONLY when supported evidence with message ID is present", () => {
    const assessmentWithEvidence = validateCriterionInput("purchase_intent", 25, {
      criterion: "purchase_intent",
      points: 25,
      evidence: [
        {
          criterion: "purchase_intent",
          messageId: "wamid.123456",
          explanation: "Pembeli menyatakan pasti membeli tipe 72",
          evidenceStatus: "supported",
        },
      ],
    });

    expect(assessmentWithEvidence.status).toBe("scored");
    expect(assessmentWithEvidence.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("calculates overall dimension confidence as null when all scored criteria lack evidence", () => {
    const inputs: RawCriterionInput[] = [
      { criterion: "purchase_intent", points: 20, evidence: [] },
      { criterion: "budget_fit", points: 15, evidence: [] },
    ];

    const dimensionAssessment = calculateDimensionAssessment({
      rubric: BUYER_RUBRIC_V1,
      inputs,
      dimension: "buyer",
    });

    expect(dimensionAssessment.status).toBe("partial");
    expect(dimensionAssessment.rawPoints).toBe(35);
    // Dimension confidence must be null because no criterion had evidence
    expect(dimensionAssessment.confidence).toBeNull();
  });
});
