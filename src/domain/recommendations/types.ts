/**
 * Property Ads Intelligence - Ad Optimization Recommendation Domain Types
 * Strict, deterministic, explainable data contracts for ad-level recommendations.
 */

export type RecommendationCategory =
  | "scale_candidate"
  | "hold"
  | "investigate"
  | "insufficient_data";

export interface AdRecommendationMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpql: number | null;
  cpqlReason: string | null;
  attributedLeadsCount: number;
  qualifiedLeadsCount: number;
  qualifiedLeadRate: number | null; // percentage 0-100
  avgBuyerScore: number | null;
  buyerScoreSampleSize: number;
  verifiedCount: number;
  inferredCount: number;
  verifiedAttributionRate: number | null; // percentage 0-100
}

export interface AdEvaluationInput {
  adId: string;
  adName: string;
  campaignName?: string;
  dateRange: string;
  spend: number;
  impressions: number;
  clicks: number;
  attributedLeadsCount: number;
  qualifiedLeadsCount: number;
  avgBuyerScore: number | null;
  buyerScoreSampleSize: number;
  verifiedCount: number;
  inferredCount: number;
  dataSource?: "mock" | "live";
  observationDays?: number;
}

export interface AdOptimizationRecommendation {
  id: string; // Deterministic ID: `rec_${adId}_${dateRange}`
  adId: string;
  adName: string;
  campaignName?: string;
  dateRange: string;
  category: RecommendationCategory;
  headline: string;
  reason: string;
  supportingMetrics: AdRecommendationMetrics;
  missingDataAndLimitations: string[];
  dataSource: "mock" | "live";
  evaluatedAt: string;
  status: "active" | "reviewed" | "dismissed";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}
