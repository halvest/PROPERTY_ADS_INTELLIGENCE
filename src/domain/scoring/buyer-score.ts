/**
 * Property Ads Intelligence - Buyer Score Domain Calculator
 * Evaluates property buyer readiness across 5 weighted criteria (Max 100 points).
 */

import { BUYER_RUBRIC_V1 } from "./rubrics";
import { calculateDimensionAssessment } from "./calculator";
import type { DimensionAssessment, RawCriterionInput } from "./types";

export function calculateBuyerScore(
  inputs: RawCriterionInput[]
): DimensionAssessment {
  return calculateDimensionAssessment({
    rubric: BUYER_RUBRIC_V1,
    inputs,
    dimension: "buyer",
  });
}
