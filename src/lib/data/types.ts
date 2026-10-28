/**
 * Property Ads Intelligence - Dashboard Data Types
 * Strongly-typed data contracts for UI presentation and analytics.
 */

import type { AttributionStatus } from "@/domain/attribution/types";
import type { DimensionAssessment } from "@/domain/scoring/types";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { MessageTimestampRecord } from "@/domain/scoring/response-speed";

export interface DashboardKPISummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  totalLeads: number;
  qualifiedLeads: number;
  cpql: number | null;
  avgBuyerScore: number | null;
  buyerScoreSampleSize: number;
  avgSalesScore: number | null;
  salesScoreSampleSize: number;
  attributionCoverage: {
    verifiedCount: number;
    inferredCount: number;
    unknownCount: number;
    total: number;
    verifiedPercentage: number;
  };
  currency: string;
}

export interface AdLeaderboardItem {
  adId: string;
  adName: string;
  campaignName: string;
  status: "ACTIVE" | "PAUSED";
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  attributedLeadsCount: number;
  qualifiedLeadsCount: number;
  cpql: number | null;
  avgBuyerScore: number | null;
  buyerScoreSampleSize: number;
  sampleWarning: boolean; // true if sample size < 5
  attributionBreakdown: {
    verified: number;
    inferred: number;
  };
}

export type QualityLabel = "Hot" | "Warm" | "Cold";

export interface LeadListItem {
  id: string;
  name: string;
  phoneMasked: string;
  funnelStage: FunnelStage;
  attributionStatus: AttributionStatus;
  adName: string | null;
  campaignName: string | null;
  buyerAssessment: DimensionAssessment;
  salesAssessment: DimensionAssessment;
  lastMessageAt: string;
  messageCount: number;
  needsReview: boolean;
  reviewReason?: string;
  domisili?: string | null;
  qualityLabel?: QualityLabel | null;
  notes?: string | null;
}

export interface LeadDetailView extends LeadListItem {
  description: string;
  messages: MessageTimestampRecord[];
  attributionEvidence: Record<string, unknown>;
  attributionReason: string;
  correctionHistory: Array<{
    previousStatus: AttributionStatus;
    newStatus: AttributionStatus;
    reason: string;
    timestamp: string;
    actorName?: string;
  }>;
}

export interface ReviewQueueItem {
  leadId: string;
  leadName: string;
  flagReason: string;
  flagType: "low_completeness" | "missing_criteria" | "invalid_criteria" | "uncertain_attribution" | "sales_sla_overdue";
  buyerScore: number | null;
  buyerCompleteness: number;
  salesScore: number | null;
  attributionStatus: AttributionStatus;
  lastMessageAt: string;
}

export interface IntegrationStatusItem {
  provider: "meta_marketing" | "whatsapp_cloud" | "meta_model_api" | "supabase";
  name: string;
  status: "connected" | "demo_active" | "disconnected" | "error";
  mode: "demo" | "live";
  lastSyncedAt: string;
  details: string;
  maskedCredential?: string;
}

export type {
  RecommendationCategory,
  AdOptimizationRecommendation,
  AdRecommendationMetrics,
  AdEvaluationInput,
} from "@/domain/recommendations/types";
