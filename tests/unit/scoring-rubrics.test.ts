import { describe, it, expect } from "vitest";
import { BUYER_RUBRIC_V1, SALES_RUBRIC_V1 } from "@/domain/scoring/rubrics";
import { validateCriterionInput } from "@/domain/scoring/calculator";
import { calculateBuyerScore } from "@/domain/scoring/buyer-score";
import type { RawCriterionInput } from "@/domain/scoring/types";

describe("Scoring Rubrics & Criterion Boundary Validation", () => {
  it("Buyer rubric total weight is exactly 100 points across 5 criteria", () => {
    const total = Object.values(BUYER_RUBRIC_V1.criteria).reduce(
      (sum, c) => sum + c.maxPoints,
      0
    );
    expect(total).toBe(100);
    expect(Object.keys(BUYER_RUBRIC_V1.criteria)).toHaveLength(5);
    expect(BUYER_RUBRIC_V1.criteria.purchase_intent.maxPoints).toBe(25);
    expect(BUYER_RUBRIC_V1.criteria.budget_fit.maxPoints).toBe(20);
    expect(BUYER_RUBRIC_V1.criteria.property_needs_fit.maxPoints).toBe(20);
    expect(BUYER_RUBRIC_V1.criteria.purchase_timeline.maxPoints).toBe(15);
    expect(BUYER_RUBRIC_V1.criteria.readiness_for_action.maxPoints).toBe(20);
  });

  it("Sales rubric total weight is exactly 100 points across 5 criteria", () => {
    const total = Object.values(SALES_RUBRIC_V1.criteria).reduce(
      (sum, c) => sum + c.maxPoints,
      0
    );
    expect(total).toBe(100);
    expect(Object.keys(SALES_RUBRIC_V1.criteria)).toHaveLength(5);
    expect(SALES_RUBRIC_V1.criteria.response_speed.maxPoints).toBe(15);
    expect(SALES_RUBRIC_V1.criteria.relevance_of_answers.maxPoints).toBe(25);
    expect(SALES_RUBRIC_V1.criteria.needs_discovery.maxPoints).toBe(20);
    expect(SALES_RUBRIC_V1.criteria.follow_up_consistency.maxPoints).toBe(20);
    expect(SALES_RUBRIC_V1.criteria.next_step_progression.maxPoints).toBe(20);
  });

  describe("Distinction between 'scored' (including 0), 'missing', and 'invalid'", () => {
    it("assigns 'scored' with score 0 when valid evidence confirms explicit 0 points", () => {
      const res = validateCriterionInput("budget_fit", 20, {
        criterion: "budget_fit",
        points: 0,
        evidence: [{ criterion: "budget_fit", explanation: "Budget confirmed zero or unmatchable", evidenceStatus: "supported" }],
      });
      expect(res.status).toBe("scored");
      expect(res.score).toBe(0);
      expect(res.invalidReason).toBeUndefined();
    });

    it("assigns 'missing' with score null when input is omitted, null, or undefined", () => {
      const res1 = validateCriterionInput("purchase_timeline", 15, undefined);
      expect(res1.status).toBe("missing");
      expect(res1.score).toBeNull();

      const res2 = validateCriterionInput("purchase_timeline", 15, {
        criterion: "purchase_timeline",
        points: null,
      });
      expect(res2.status).toBe("missing");
      expect(res2.score).toBeNull();
    });

    it("assigns 'invalid' with score null when points are negative", () => {
      const res = validateCriterionInput("purchase_intent", 25, {
        criterion: "purchase_intent",
        points: -1,
      });
      expect(res.status).toBe("invalid");
      expect(res.score).toBeNull();
      expect(res.invalidReason).toMatch(/negatif/);
    });

    it("assigns 'invalid' with score null when points exceed criterion maximum", () => {
      const res = validateCriterionInput("purchase_intent", 25, {
        criterion: "purchase_intent",
        points: 26,
      });
      expect(res.status).toBe("invalid");
      expect(res.score).toBeNull();
      expect(res.invalidReason).toMatch(/melebihi batas maksimum/);
    });

    it("assigns 'invalid' when points are NaN or Infinity", () => {
      const resNaN = validateCriterionInput("budget_fit", 20, {
        criterion: "budget_fit",
        points: NaN,
      });
      expect(resNaN.status).toBe("invalid");
      expect(resNaN.score).toBeNull();

      const resInf = validateCriterionInput("budget_fit", 20, {
        criterion: "budget_fit",
        points: Infinity,
      });
      expect(resInf.status).toBe("invalid");
      expect(resInf.score).toBeNull();
    });
  });

  describe("Completeness, Normalized Score, and Confidence calculations", () => {
    it("calculates 100% completeness and exact score when all criteria are scored", () => {
      const inputs: RawCriterionInput[] = [
        { criterion: "purchase_intent", points: 20 }, // 20/25
        { criterion: "budget_fit", points: 15 }, // 15/20
        { criterion: "property_needs_fit", points: 15 }, // 15/20
        { criterion: "purchase_timeline", points: 10 }, // 10/15
        { criterion: "readiness_for_action", points: 15 }, // 15/20
      ];

      const assessment = calculateBuyerScore(inputs);
      expect(assessment.rawPoints).toBe(75);
      expect(assessment.completeness).toBe(100);
      expect(assessment.normalizedScore).toBe(75);
      expect(assessment.status).toBe("completed");
      expect(assessment.missingCriteria).toHaveLength(0);
      expect(assessment.invalidCriteria).toHaveLength(0);
    });

    it("calculates partial completeness and provisional normalized score without divide-by-zero", () => {
      // Only 2 of 5 criteria scored (purchase_intent: 25, budget_fit: 20 -> assessedWeight = 45)
      const inputs: RawCriterionInput[] = [
        { criterion: "purchase_intent", points: 20 },
        { criterion: "budget_fit", points: 16 },
      ];

      const assessment = calculateBuyerScore(inputs);
      expect(assessment.rawPoints).toBe(36);
      expect(assessment.assessedValidWeight).toBe(45);
      expect(assessment.completeness).toBe(45); // 45%
      // normalizedScore = (36 / 45) * 100 = 80.00
      expect(assessment.normalizedScore).toBe(80);
      expect(assessment.status).toBe("partial");
      expect(assessment.missingCriteria).toEqual([
        "property_needs_fit",
        "purchase_timeline",
        "readiness_for_action",
      ]);
    });

    it("returns normalizedScore: null when no criteria are scored (0% completeness)", () => {
      const assessment = calculateBuyerScore([]);
      expect(assessment.rawPoints).toBe(0);
      expect(assessment.assessedValidWeight).toBe(0);
      expect(assessment.completeness).toBe(0);
      expect(assessment.normalizedScore).toBeNull();
      expect(assessment.confidence).toBeNull();
      expect(assessment.status).toBe("insufficient_evidence");
      expect(assessment.missingCriteria).toHaveLength(5);
    });

    it("quarantines invalid criteria and marks status as 'invalid'", () => {
      const inputs: RawCriterionInput[] = [
        { criterion: "purchase_intent", points: 20 },
        { criterion: "budget_fit", points: 999 }, // INVALID
      ];

      const assessment = calculateBuyerScore(inputs);
      expect(assessment.status).toBe("invalid");
      expect(assessment.invalidCriteria).toHaveLength(1);
      expect(assessment.invalidCriteria[0]).toMatch(/melebihi batas/);
      // The invalid criterion points must NOT be included in rawPoints
      expect(assessment.rawPoints).toBe(20);
      expect(assessment.assessedValidWeight).toBe(25);
    });

    it("ensures confidence is based on evidence quality and separate from completeness", () => {
      // 1 criterion scored but with strong message evidence
      const inputs: RawCriterionInput[] = [
        {
          criterion: "purchase_intent",
          points: 25,
          evidence: [
            {
              criterion: "purchase_intent",
              messageId: "msg_verified_01",
              explanation: "Pembeli menyatakan siap transfer booking fee",
              evidenceStatus: "supported",
            },
          ],
        },
      ];

      const assessment = calculateBuyerScore(inputs);
      expect(assessment.completeness).toBe(25); // Completeness is low (only 1 criterion)
      expect(assessment.confidence).toBeGreaterThanOrEqual(0.85); // Confidence is high because evidence is verified!
      expect(assessment.confidence).not.toBe(assessment.completeness / 100);
    });
  });
});
