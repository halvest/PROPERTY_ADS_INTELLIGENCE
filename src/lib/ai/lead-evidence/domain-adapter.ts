import type { RawCriterionInput, EvidenceReference } from "@/domain/scoring/types";
import type { ExtractedLeadEvidence } from "./schema";

/**
 * Maps ExtractedLeadEvidence facts from Meta Model API into RawCriterionInput[]
 * for the deterministic Buyer Score domain engine (calculateBuyerScore).
 *
 * Invariant: The LLM does NOT calculate the score.
 * This adapter merely maps verified facts into structured criteria inputs,
 * allowing the TypeScript domain calculator to execute rubric weighting,
 * completeness calculation, and confidence scoring.
 */
export function mapEvidenceToBuyerCriteriaInputs(
  evidence: ExtractedLeadEvidence,
  propertyContext?: { startingPrice?: number }
): RawCriterionInput[] {
  const inputs: RawCriterionInput[] = [];

  // Helper to extract evidence quotes for a field
  const getEvidenceQuotes = (fieldName: string): EvidenceReference[] => {
    return evidence.evidenceQuotes
      .filter((q) => q.field.toLowerCase() === fieldName.toLowerCase() || q.field === "*")
      .map((q) => ({
        criterion: fieldName,
        explanation: q.quote,
        textSpan: q.quote,
        messageId: q.sourceMessageId || null,
        evidenceStatus: "supported" as const,
      }));
  };

  // 1. purchase_intent (max 25)
  if (evidence.purchaseIntent === "high") {
    inputs.push({
      criterion: "purchase_intent",
      points: 25,
      evidence: getEvidenceQuotes("purchaseIntent"),
    });
  } else if (evidence.purchaseIntent === "moderate") {
    inputs.push({
      criterion: "purchase_intent",
      points: 15,
      evidence: getEvidenceQuotes("purchaseIntent"),
    });
  } else if (evidence.purchaseIntent === "low") {
    inputs.push({
      criterion: "purchase_intent",
      points: 5,
      evidence: getEvidenceQuotes("purchaseIntent"),
    });
  } else {
    inputs.push({
      criterion: "purchase_intent",
      status: "missing",
      missingInformation: ["Niat membeli belum teridentifikasi dalam percakapan"],
    });
  }

  // 2. budget_fit (max 20)
  if (evidence.budget && evidence.budget.amount && evidence.budget.isExplicit) {
    let budgetPoints = 20;
    if (propertyContext?.startingPrice && evidence.budget.amount < propertyContext.startingPrice * 0.8) {
      budgetPoints = 8; // Budget lower than unit price
    }
    inputs.push({
      criterion: "budget_fit",
      points: budgetPoints,
      evidence: getEvidenceQuotes("budget"),
    });
  } else {
    inputs.push({
      criterion: "budget_fit",
      status: "missing",
      missingInformation: ["Anggaran belum disebutkan secara spesifik oleh calon pembeli"],
    });
  }

  // 3. property_needs_fit (max 20)
  const hasLoc = !!evidence.preferredLocation;
  const hasType = !!evidence.propertyType;
  if (hasLoc && hasType) {
    inputs.push({
      criterion: "property_needs_fit",
      points: 20,
      evidence: [...getEvidenceQuotes("preferredLocation"), ...getEvidenceQuotes("propertyType")],
    });
  } else if (hasLoc || hasType) {
    inputs.push({
      criterion: "property_needs_fit",
      points: 12,
      evidence: [...getEvidenceQuotes("preferredLocation"), ...getEvidenceQuotes("propertyType")],
    });
  } else {
    inputs.push({
      criterion: "property_needs_fit",
      status: "missing",
      missingInformation: ["Lokasi atau tipe properti yang diminati belum dijelaskan"],
    });
  }

  // 4. purchase_timeline (max 15)
  if (evidence.purchaseTimeline === "immediate") {
    inputs.push({
      criterion: "purchase_timeline",
      points: 15,
      evidence: getEvidenceQuotes("purchaseTimeline"),
    });
  } else if (evidence.purchaseTimeline === "1-3_months") {
    inputs.push({
      criterion: "purchase_timeline",
      points: 12,
      evidence: getEvidenceQuotes("purchaseTimeline"),
    });
  } else if (evidence.purchaseTimeline === "3-6_months") {
    inputs.push({
      criterion: "purchase_timeline",
      points: 8,
      evidence: getEvidenceQuotes("purchaseTimeline"),
    });
  } else if (evidence.purchaseTimeline === "6_months_plus") {
    inputs.push({
      criterion: "purchase_timeline",
      points: 4,
      evidence: getEvidenceQuotes("purchaseTimeline"),
    });
  } else {
    inputs.push({
      criterion: "purchase_timeline",
      status: "missing",
      missingInformation: ["Target waktu pembelian belum terkonfirmasi"],
    });
  }

  // 5. readiness_for_action (max 20)
  if (evidence.readinessForNextStep === "ready_for_survey") {
    inputs.push({
      criterion: "readiness_for_action",
      points: 20,
      evidence: getEvidenceQuotes("readinessForNextStep"),
    });
  } else if (evidence.readinessForNextStep === "requesting_brochure") {
    inputs.push({
      criterion: "readiness_for_action",
      points: 12,
      evidence: getEvidenceQuotes("readinessForNextStep"),
    });
  } else if (evidence.readinessForNextStep === "comparing_options") {
    inputs.push({
      criterion: "readiness_for_action",
      points: 8,
      evidence: getEvidenceQuotes("readinessForNextStep"),
    });
  } else if (evidence.readinessForNextStep === "not_ready") {
    inputs.push({
      criterion: "readiness_for_action",
      points: 2,
      evidence: getEvidenceQuotes("readinessForNextStep"),
    });
  } else {
    inputs.push({
      criterion: "readiness_for_action",
      status: "missing",
      missingInformation: ["Kesiapan survei atau reservasi belum terkonfirmasi"],
    });
  }

  return inputs;
}
