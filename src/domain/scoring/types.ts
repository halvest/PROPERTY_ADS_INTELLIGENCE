/**
 * Property Ads Intelligence - Scoring Domain Types
 * Defines strict state representations, evidence models, and dimension assessment structures.
 */

export type CriterionStatus = "scored" | "missing" | "invalid";

export type EvidenceStatus = "supported" | "missing" | "contradictory";

export interface EvidenceReference {
  messageId?: string | null;
  textSpan?: string;
  criterion: string;
  explanation: string;
  evidenceStatus: EvidenceStatus;
  timestamp?: string;
}

export interface CriterionAssessment {
  criterion: string;
  maxPoints: number;
  status: CriterionStatus;
  score: number | null;
  evidence: EvidenceReference[];
  missingInformation: string[];
  confidence: number | null;
  rubricVersion: string;
  invalidReason?: string;
}

export type DimensionAssessmentStatus =
  | "completed"
  | "partial"
  | "insufficient_evidence"
  | "invalid";

export interface DimensionAssessment {
  dimension: "buyer" | "sales";
  rawPoints: number;
  maxRubricPoints: number;
  assessedValidWeight: number;
  completeness: number; // 0 to 100
  normalizedScore: number | null; // Provisional score 0-100 or null if completeness == 0
  confidence: number | null; // 0.00 to 1.00 based on verified evidence quality
  status: DimensionAssessmentStatus;
  criteria: Record<string, CriterionAssessment>;
  missingCriteria: string[];
  invalidCriteria: string[];
  missingInformation: string[];
  rubricVersion: string;
}

export interface RawCriterionInput {
  criterion: string;
  points?: number | null;
  status?: CriterionStatus;
  evidence?: EvidenceReference[];
  missingInformation?: string[];
  invalidReason?: string;
}
