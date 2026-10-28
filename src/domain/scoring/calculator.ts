/**
 * Property Ads Intelligence - Deterministic Scoring Calculator
 * Pure domain logic for validating criteria, computing completeness, provisional normalized scores,
 * and calibrating evidence-based confidence without LLM guessing.
 */

import type {
  CriterionAssessment,
  DimensionAssessment,
  DimensionAssessmentStatus,
  EvidenceReference,
  RawCriterionInput,
} from "./types";
import type { DimensionRubric } from "./rubrics";

export interface CalculateDimensionOptions {
  rubric: DimensionRubric;
  inputs: RawCriterionInput[];
  dimension: "buyer" | "sales";
}

/**
 * Validates a single criterion input against rubric rules.
 */
export function validateCriterionInput(
  criterionKey: string,
  maxPoints: number,
  input?: RawCriterionInput
): CriterionAssessment {
  const rubricVersion = "v1.0";
  const evidence: EvidenceReference[] = input?.evidence || [];
  const missingInformation: string[] = input?.missingInformation || [];

  // 1. Check if explicitly marked invalid
  if (input?.status === "invalid") {
    return {
      criterion: criterionKey,
      maxPoints,
      status: "invalid",
      score: null,
      evidence,
      missingInformation,
      confidence: null,
      rubricVersion,
      invalidReason: input.invalidReason || "Kriteria ditandai tidak valid",
    };
  }

  // 2. Check if explicitly missing or omitted
  if (
    !input ||
    input.status === "missing" ||
    input.points === null ||
    input.points === undefined
  ) {
    return {
      criterion: criterionKey,
      maxPoints,
      status: "missing",
      score: null,
      evidence,
      missingInformation: missingInformation.length > 0 ? missingInformation : ["Informasi belum tersedia dalam percakapan"],
      confidence: null,
      rubricVersion,
    };
  }

  // 2. Check for invalid inputs: NaN, Infinity, negative, non-numeric, or exceeds bounds
  const points = input.points;
  if (
    typeof points !== "number" ||
    !Number.isFinite(points) ||
    Number.isNaN(points)
  ) {
    return {
      criterion: criterionKey,
      maxPoints,
      status: "invalid",
      score: null,
      evidence,
      missingInformation,
      confidence: null,
      rubricVersion,
      invalidReason: `Nilai poin bukan angka berhingga yang valid: ${String(points)}`,
    };
  }

  if (points < 0) {
    return {
      criterion: criterionKey,
      maxPoints,
      status: "invalid",
      score: null,
      evidence,
      missingInformation,
      confidence: null,
      rubricVersion,
      invalidReason: `Poin tidak boleh negatif: ${points}`,
    };
  }

  if (points > maxPoints) {
    return {
      criterion: criterionKey,
      maxPoints,
      status: "invalid",
      score: null,
      evidence,
      missingInformation,
      confidence: null,
      rubricVersion,
      invalidReason: `Poin ${points} melebihi batas maksimum rubrik (${maxPoints})`,
    };
  }

  // 3. Valid scored criterion (including valid 0 points)
  // Calculate evidence confidence for this criterion:
  // Supported evidence with message ID yields highest confidence (0.80 - 1.00)
  // Supported evidence without message ID yields moderate confidence (0.60)
  // Contradictory evidence or missing status yields lower confidence
  let criterionConfidence: number | null = null;
  if (evidence.length > 0) {
    const supportedWithMsg = evidence.filter(
      (e) => e.evidenceStatus === "supported" && !!e.messageId
    ).length;
    const supportedNoMsg = evidence.filter(
      (e) => e.evidenceStatus === "supported" && !e.messageId
    ).length;
    const contradictory = evidence.filter(
      (e) => e.evidenceStatus === "contradictory"
    ).length;

    if (contradictory > 0) {
      criterionConfidence = 0.4;
    } else if (supportedWithMsg > 0) {
      criterionConfidence = Math.min(1.0, 0.85 + supportedWithMsg * 0.05);
    } else if (supportedNoMsg > 0) {
      criterionConfidence = 0.65;
    }
  } else {
    // Audit fix: No supporting evidence references exist. Never fabricate numerical confidence without evidence.
    criterionConfidence = null;
  }

  return {
    criterion: criterionKey,
    maxPoints,
    status: "scored",
    score: Math.round(points),
    evidence,
    missingInformation,
    confidence: criterionConfidence ? Number(criterionConfidence.toFixed(2)) : null,
    rubricVersion,
  };
}

/**
 * Calculates a complete dimension assessment (Buyer or Sales) deterministically.
 */
export function calculateDimensionAssessment(
  options: CalculateDimensionOptions
): DimensionAssessment {
  const { rubric, inputs, dimension } = options;

  const criteriaMap: Record<string, CriterionAssessment> = {};
  const missingCriteria: string[] = [];
  const invalidCriteria: string[] = [];
  const allMissingInfo: Set<string> = new Set();

  let rawPoints = 0;
  let assessedValidWeight = 0;
  let totalConfidenceSum = 0;
  let confidenceCount = 0;

  // Process each criterion defined in the rubric
  for (const [key, def] of Object.entries(rubric.criteria)) {
    const matchingInput = inputs.find((inp) => inp.criterion === key);
    const assessment = validateCriterionInput(key, def.maxPoints, matchingInput);

    criteriaMap[key] = assessment;

    if (assessment.status === "scored") {
      rawPoints += assessment.score ?? 0;
      assessedValidWeight += def.maxPoints;
      if (assessment.confidence !== null) {
        totalConfidenceSum += assessment.confidence;
        confidenceCount++;
      }
    } else if (assessment.status === "missing") {
      missingCriteria.push(key);
      assessment.missingInformation.forEach((info) => allMissingInfo.add(info));
    } else if (assessment.status === "invalid") {
      invalidCriteria.push(`${key}: ${assessment.invalidReason || "Input tidak valid"}`);
    }
  }

  // Completeness = (assessedValidWeight / totalRubricWeight) * 100
  const completeness =
    rubric.totalWeight > 0
      ? Number(((assessedValidWeight / rubric.totalWeight) * 100).toFixed(2))
      : 0;

  // Provisional normalized score = (rawPoints / assessedValidWeight) * 100
  // ONLY calculated when assessedValidWeight > 0. Never divide by zero.
  const normalizedScore =
    assessedValidWeight > 0
      ? Number(((rawPoints / assessedValidWeight) * 100).toFixed(2))
      : null;

  // Calibrated evidence confidence (average of scored criterion confidences, or null if 0 scored)
  const confidence =
    confidenceCount > 0
      ? Number((totalConfidenceSum / confidenceCount).toFixed(2))
      : null;

  // Determine overall status
  let status: DimensionAssessmentStatus = "completed";
  if (invalidCriteria.length > 0) {
    status = "invalid";
  } else if (completeness === 100) {
    status = "completed";
  } else if (completeness > 0) {
    status = "partial";
  } else {
    status = "insufficient_evidence";
  }

  return {
    dimension,
    rawPoints,
    maxRubricPoints: rubric.totalWeight,
    assessedValidWeight,
    completeness,
    normalizedScore,
    confidence,
    status,
    criteria: criteriaMap,
    missingCriteria,
    invalidCriteria,
    missingInformation: Array.from(allMissingInfo),
    rubricVersion: rubric.version,
  };
}
