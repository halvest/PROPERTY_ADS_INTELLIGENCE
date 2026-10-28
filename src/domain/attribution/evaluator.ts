/**
 * Property Ads Intelligence - Attribution Evaluator
 * Pure domain logic for validating ad attribution evidence, preventing fabricated links,
 * and maintaining immutable attribution event audit history.
 */

import type {
  AttributionEvaluationResult,
  AttributionEventRecord,
  AttributionStatus,
  InferredAttributionEvidence,
  OfficialReferralEvidence,
} from "./types";

export interface EvaluateAttributionParams {
  rawReferral?: {
    source?: string;
    adId?: string;
    campaignId?: string;
    headline?: string;
    verifiedSignature?: boolean;
  };
  inferredCandidate?: {
    method: "headline_match" | "promo_code_match" | "landing_page_session";
    matchedText: string;
    confidence: number;
    adId: string;
    campaignId?: string;
  };
  conversationMessageText?: string;
  ruleVersion?: string;
}

/**
 * Evaluates attribution status based strictly on available evidence.
 * RULES:
 * 1. Verified ONLY if official provider referral or verified signature/id connects the chat.
 * 2. Inferred if documented rule matches with declared confidence (marked not fact).
 * 3. Unknown if evidence is insufficient. Ad ID is NEVER fabricated or guessed.
 */
export function evaluateAttribution(
  params: EvaluateAttributionParams
): AttributionEvaluationResult {
  const ruleVersion = params.ruleVersion || "v1.0";

  // 1. Check for official verified referral evidence
  if (
    params.rawReferral &&
    params.rawReferral.adId &&
    params.rawReferral.adId.trim().length > 0 &&
    params.rawReferral.verifiedSignature !== false
  ) {
    const evidence: OfficialReferralEvidence = {
      referralSource: "ad_click",
      providerAdId: params.rawReferral.adId,
      providerCampaignId: params.rawReferral.campaignId,
      headline: params.rawReferral.headline,
      verifiedAt: new Date().toISOString(),
    };

    return {
      status: "verified",
      adId: params.rawReferral.adId,
      campaignId: params.rawReferral.campaignId || null,
      evidence: evidence as unknown as Record<string, unknown>,
      reason: "Terverifikasi melalui metadata referral resmi Meta/WhatsApp ad click",
      ruleVersion,
    };
  }

  // 2. Check for documented inferred attribution
  if (
    params.inferredCandidate &&
    params.inferredCandidate.confidence >= 0.7 &&
    params.inferredCandidate.adId
  ) {
    const evidence: InferredAttributionEvidence = {
      method: params.inferredCandidate.method,
      matchedText: params.inferredCandidate.matchedText,
      confidence: params.inferredCandidate.confidence,
      ruleVersion,
      inferredAt: new Date().toISOString(),
      disclaimer: "Atribusi inferensi berbasis aturan terstruktur; bukan bukti transaksi faktual.",
    };

    return {
      status: "inferred",
      adId: params.inferredCandidate.adId,
      campaignId: params.inferredCandidate.campaignId || null,
      evidence: evidence as unknown as Record<string, unknown>,
      reason: `Inferensi terdeteksi melalui metode ${params.inferredCandidate.method} (confidence: ${(params.inferredCandidate.confidence * 100).toFixed(0)}%)`,
      ruleVersion,
    };
  }

  // 3. Fallback to Unknown (Evidence insufficient)
  // NEVER fabricate or link ad ID when attribution is unknown
  return {
    status: "unknown",
    adId: null,
    campaignId: null,
    evidence: {},
    reason: "Bukti tidak cukup untuk menghubungkan percakapan dengan iklan tertentu",
    ruleVersion,
  };
}

/**
 * Creates an attribution correction event, preserving audit history.
 */
export function createAttributionEvent(params: {
  organizationId: string;
  conversationId: string;
  previousStatus: AttributionStatus | null;
  newStatus: AttributionStatus;
  previousAdId?: string | null;
  newAdId?: string | null;
  attributionMethod: string;
  ruleVersion?: string;
  evidence?: Record<string, unknown>;
  actorId?: string | null;
  reason: string;
}): AttributionEventRecord {
  if (!params.reason || params.reason.trim().length === 0) {
    throw new Error("Koreksi atribusi wajib menyertakan alasan (reason non-empty)");
  }

  return {
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    previousAdId: params.previousAdId || null,
    newAdId: params.newAdId || null,
    attributionMethod: params.attributionMethod,
    ruleVersion: params.ruleVersion || "v1.0",
    evidence: params.evidence || {},
    actorId: params.actorId || null,
    reason: params.reason.trim(),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Filter leads eligible for a specific ad's ranking.
 * MANDATORY RULE: Leads with attribution status 'unknown' MUST BE EXCLUDED from ad-specific performance.
 */
export function filterLeadsForAdRanking<
  T extends { adId?: string | null; attributionStatus: AttributionStatus }
>(leads: T[], targetAdId: string): T[] {
  return leads.filter((lead) => {
    // Exclude unknown
    if (lead.attributionStatus === "unknown") {
      return false;
    }
    // Must match targeted ad
    return lead.adId === targetAdId;
  });
}
