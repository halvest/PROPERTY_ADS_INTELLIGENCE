/**
 * Property Ads Intelligence - Attribution Domain Types
 * Strict evidence-based attribution model: verified, inferred, unknown.
 */

export type AttributionStatus = "verified" | "inferred" | "unknown";

export interface OfficialReferralEvidence {
  referralSource: "ad_click" | "cta_button" | "webhook_payload";
  providerAdId?: string;
  providerCampaignId?: string;
  headline?: string;
  verifiedAt: string;
}

export interface InferredAttributionEvidence {
  method: "headline_match" | "promo_code_match" | "landing_page_session";
  matchedText: string;
  confidence: number; // 0.00 to 1.00
  ruleVersion: string;
  inferredAt: string;
  disclaimer: string;
}

export interface AttributionEvaluationResult {
  status: AttributionStatus;
  adId: string | null;
  campaignId: string | null;
  evidence: Record<string, unknown>;
  reason: string;
  ruleVersion: string;
}

export interface AttributionEventRecord {
  id?: string;
  organizationId: string;
  conversationId: string;
  previousStatus: AttributionStatus | null;
  newStatus: AttributionStatus;
  previousAdId?: string | null;
  newAdId?: string | null;
  attributionMethod: string;
  ruleVersion: string;
  evidence: Record<string, unknown>;
  actorId?: string | null;
  reason?: string;
  createdAt: string;
}
