import {
  aggregateAdInsights,
  leadsFromRow,
  messagingFromRow,
  selectPrimaryResult,
  type AdInsightRowLike,
} from "@/lib/ads/aggregation";
import { buildAdvertisingIntelligence, type AdvertisingIntelligence } from "./diagnosis";
import { resolveOperationalStatus, type OperationalStatus } from "./status";

/**
 * SAFEGUARD 3 — Funnel Priority Weights (Anti-CTR Trap):
 * Bottom-of-funnel unit economics (CPR 45% + Volume 30% = 75%) dictate 75% of the score.
 * Upper-funnel Link CTR (5%) and CPC (5%) never override profitable conversion performance,
 * protecting high-CVR / low-CTR "Golden Offer" campaigns from being penalized.
 */
export const RANKING_WEIGHTS = {
  cpr: 0.45,
  volume: 0.30,
  confidence: 0.15,
  ctr: 0.05,
  cpc: 0.05,
} as const;

export interface RankingThresholds {
  minImpressionsForWinner: number;
  minResultsForWinner: number;
  minResultsForStrong: number;
  smallSampleMaxResults: number;
  smallSampleMaxSpend: number;
  materialZeroResultSpend: number;
  minImpressionsToJudge: number;
}

export const DEFAULT_RANKING_THRESHOLDS: RankingThresholds = {
  minImpressionsForWinner: 1000,
  minResultsForWinner: 10,
  minResultsForStrong: 5,
  smallSampleMaxResults: 1,
  smallSampleMaxSpend: 50_000,
  materialZeroResultSpend: 100_000,
  minImpressionsToJudge: 500,
};

export type TargetStatus = "BETTER" | "ON_TARGET" | "WORSE" | "TARGET_NOT_CONFIGURED" | "CPR_UNAVAILABLE";
export type TargetSource = "object" | "inherited" | "account_default" | "TARGET_NOT_CONFIGURED";
export type CampaignRankCategory =
  | "TOP_PERFORMER"
  | "EFFICIENT"
  | "STABLE"
  | "NEEDS_OPTIMIZATION"
  | "UNDERPERFORMING"
  | "INSUFFICIENT_DATA"
  | "GATHERING_DATA"
  | "UNRANKED";
export type AdRankCategory =
  | "WINNER"
  | "STRONG_PERFORMER"
  | "POTENTIAL_WINNER"
  | "STABLE"
  | "NEEDS_OPTIMIZATION"
  | "LOSING"
  | "INSUFFICIENT_DATA"
  | "GATHERING_DATA"
  | "UNRANKED";
export type IntelligenceAction =
  | "SCALE"
  | "MAINTAIN"
  | "OPTIMIZE"
  | "REDUCE_BUDGET"
  | "PAUSE"
  | "REACTIVATE"
  | "MONITOR"
  | "NO_ACTION"
  | "KEEP_PAUSED"
  | "HISTORICAL_REVIEW"
  | "REACTIVATION_CANDIDATE"
  | "HISTORICAL_REFERENCE"
  | "STATUS_UNKNOWN";

export interface ScoreBreakdown {
  cpr: number;
  volume: number;
  ctr: number;
  cpc: number;
  confidence: number;
  total: number;
}

export interface ResolvedTarget {
  value: number | null;
  source: TargetSource;
  status: TargetStatus;
}

export interface AccountCampaignInput {
  id: string;
  providerId: string;
  name: string;
  status: string | null;
  objective: string | null;
  targetCpr?: number | null;
  spend?: number | null;
}

export interface AccountAdInput {
  id: string;
  providerId: string;
  name: string;
  status: string | null;
  campaignId: string;
  targetCpr?: number | null;
  inheritCampaignTarget?: boolean;
  adSetStatus?: string | null;
  adSetStatusKnown?: boolean;
  metaEffectiveStatus?: string | null;
}

export interface AccountInsightInput extends AdInsightRowLike {
  ad_id: string;
}

export type FunnelSignal =
  | "golden_offer"
  | "traffic_leak"
  | "material_waste"
  | "fatigue"
  | "normal";

export interface RankedCampaign {
  rank: number;
  id: string;
  providerId: string;
  name: string;
  status: string;
  configuredStatus: OperationalStatus;
  effectiveStatus: OperationalStatus;
  objective: string | null;
  resultKind: string;
  resultLabel: string;
  spend: number;
  results: number | null;
  cpr: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  linkClicks?: number | null;
  cvr?: number | null;
  spendSharePct: number | null;
  target: ResolvedTarget;
  category: CampaignRankCategory;
  score: ScoreBreakdown;
  reason: string;
  action: IntelligenceAction;
  performanceBasis: "active_delivery" | "historical_paused";
  funnelSignal?: FunnelSignal;
  diagnosisLabel?: string;
  summaryShort?: string;
  actionLabel?: string;
}

export interface RankedAd {
  rank: number;
  id: string;
  providerId: string;
  name: string;
  status: string;
  configuredStatus: OperationalStatus;
  effectiveStatus: OperationalStatus;
  campaignId: string;
  campaignName: string;
  resultKind: string;
  resultLabel: string;
  spend: number;
  results: number | null;
  cpr: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  linkClicks?: number | null;
  cvr?: number | null;
  target: ResolvedTarget;
  category: AdRankCategory;
  score: ScoreBreakdown;
  reason: string;
  action: IntelligenceAction;
  performanceBasis: "active_delivery" | "historical_paused";
  funnelSignal?: FunnelSignal;
  diagnosisLabel?: string;
  summaryShort?: string;
  actionLabel?: string;
}

export interface ObjectiveKindBreakdownItem {
  kind: string;
  label: string;
  shortUnit: string;
  spend: number;
  results: number;
  cpr: number | null;
  campaignCount: number;
}

export interface PriorityActionItem {
  objectId: string;
  providerId: string;
  objectLevel: "campaign" | "ad";
  objectName: string;
  parentName?: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  action: IntelligenceAction;
  actionLabel: string;
  funnelSignal: FunnelSignal;
  spend: number;
  results: number | null;
  cpr: number | null;
  summaryShort: string;
  diagnosisLabel: string;
}

export interface AccountRecommendation {
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  action: IntelligenceAction;
  objectLevel: "campaign" | "ad";
  objectName: string;
  objectId: string;
  providerId: string;
  currentStatus: string;
  spend: number;
  results: number | null;
  cpr: number | null;
  ctr: number | null;
  targetCpr: number | null;
  targetStatus: TargetStatus;
  reason: string;
  recommendedAction: string;
  expectedImpact: string;
  risk: "low" | "medium" | "high";
  monitoring: string;
  stopLoss: string;
}

export interface AccountIntelligenceReport {
  analysis_metadata: {
    account_id: string | null;
    account_name: string;
    period_start: string;
    period_end: string;
    timezone: string;
    currency: string;
    data_confidence: "high" | "medium" | "low";
    analyzed_campaign_count: number;
    analyzed_ad_count: number;
    campaigns_with_delivery: number;
    ads_with_delivery: number;
    excluded_campaign_count: number;
    excluded_ad_count: number;
    active_without_delivery: number;
    configured_active_ads: number;
    effective_active_ads: number;
    effective_paused_ads: number;
    unknown_ads: number;
    all_campaigns_paused: boolean;
    result_comparability: "COMPARABLE" | "ACCOUNT_RESULT_NOT_COMPARABLE";
    account_cpr_code: "AVAILABLE" | "ACCOUNT_CPR_UNAVAILABLE" | "TARGET_NOT_CONFIGURED";
    object_count_label: string;
    scope_note: string;
    long_period_warning: string | null;
  };
  account_summary: {
    total_campaigns: number;
    active_campaigns: number;
    paused_campaigns: number;
    archived_campaigns: number;
    total_ads: number;
    active_ads: number;
    paused_ads: number;
    total_spend: number;
    total_results: number | null;
    blended_cpr: number | null;
    average_ctr: number | null;
    total_impressions: number;
    total_link_clicks: number | null;
    result_label: string | null;
    results_comparable: boolean;
    result_breakdown_by_kind?: ObjectiveKindBreakdownItem[];
    health_counts?: {
      activeCount: number;
      scaleCount: number;
      wasteCount: number;
      optimizeCount: number;
      holdCount: number;
      historicalCount: number;
      historicalGoodCount: number;
      historicalNeutralCount: number;
      historicalUnderperformingCount: number;
    };
  };
  campaign_rankings: RankedCampaign[];
  ad_rankings: RankedAd[];
  priority_actions?: PriorityActionItem[];
  budget_analysis: {
    total_spend: number;
    allocated_budget: null;
    remaining_budget: null;
    allocation_note: string;
    top_spending_campaign: { id: string; name: string; spend: number; share_pct: number } | null;
    top_spending_ad: { id: string; name: string; spend: number } | null;
    highest_result_campaign: { id: string; name: string; results: number } | null;
    most_efficient_campaign: { id: string; name: string; cpr: number } | null;
    wasted_spend_campaigns: Array<{ id: string; name: string; spend: number; results: number | null }>;
    spend_by_ad_category: Record<string, number>;
  };
  comparison: {
    status: "AVAILABLE" | "COMPARISON_DATA_UNAVAILABLE";
    previous_spend: number | null;
    previous_results: number | null;
    note: string;
  };
  key_insights: Array<{ text: string; object_id: string | null; object_name: string | null }>;
  recommendations: AccountRecommendation[];
  historical_reviews: AccountRecommendation[];
  action_plan: Array<{ item: string; object_id: string; object_name: string }>;
  data_quality: {
    is_complete: boolean;
    warnings: string[];
    missing_fields: string[];
    canonical_spend_level: "ad";
  };
  intelligence: AdvertisingIntelligence;
}

function statusBucket(raw: string | null): "active" | "paused" | "archived" | "unknown" {
  const status = (raw || "").toUpperCase();
  if (status === "ACTIVE" || status === "DELIVERING") return "active";
  if (status.includes("PAUSED") || status === "NOT_DELIVERING") return "paused";
  if (status === "ARCHIVED" || status === "DELETED") return "archived";
  return "unknown";
}

export function resolveEvaluationTarget(input: {
  level: "campaign" | "ad";
  objectTarget?: number | null;
  parentTarget?: number | null;
  inheritExplicit?: boolean;
  accountDefault?: number | null;
}): ResolvedTarget {
  if (input.objectTarget && input.objectTarget > 0) {
    return { value: input.objectTarget, source: "object", status: "TARGET_NOT_CONFIGURED" };
  }
  if (input.inheritExplicit && input.parentTarget && input.parentTarget > 0) {
    return { value: input.parentTarget, source: "inherited", status: "TARGET_NOT_CONFIGURED" };
  }
  if (input.level === "campaign" && input.accountDefault && input.accountDefault > 0) {
    return { value: input.accountDefault, source: "account_default", status: "TARGET_NOT_CONFIGURED" };
  }
  return { value: null, source: "TARGET_NOT_CONFIGURED", status: "TARGET_NOT_CONFIGURED" };
}

function applyTargetStatus(target: ResolvedTarget, cpr: number | null): ResolvedTarget {
  if (target.value === null || target.value <= 0) {
    return { ...target, value: null, status: "TARGET_NOT_CONFIGURED" };
  }
  if (cpr === null) return { ...target, status: "CPR_UNAVAILABLE" };
  if (cpr <= target.value * 0.9) return { ...target, status: "BETTER" };
  if (cpr <= target.value * 1.1) return { ...target, status: "ON_TARGET" };
  return { ...target, status: "WORSE" };
}

function higherBetter(value: number | null, peers: Array<number | null>): number {
  const mine = value ?? 0;
  const nums = peers.map((item) => item ?? 0);
  if (nums.length <= 1) return 60;
  const below = nums.filter((item) => item < mine).length;
  return Math.round((below / (nums.length - 1)) * 100);
}

function lowerBetter(value: number | null, peers: Array<number | null>): number {
  const comparable = peers.filter((item): item is number => item !== null && item > 0);
  if (value === null || value <= 0) return 0;
  if (comparable.length <= 1) return 60;
  const worse = comparable.filter((item) => item > value).length;
  return Math.round((worse / (comparable.length - 1)) * 100);
}

function confidenceScore(impressions: number, results: number | null, thresholds: RankingThresholds): number {
  const impressionPart = Math.min(100, Math.round((impressions / Math.max(thresholds.minImpressionsForWinner, 1)) * 100));
  const resultPart = Math.min(100, Math.round(((results ?? 0) / thresholds.minResultsForWinner) * 100));
  return Math.round(impressionPart * 0.55 + resultPart * 0.45);
}

/**
 * SAFEGUARD 2 — Statistical Significance Floor (Anti-Micro-Spend Lottery):
 * Prevents a lucky micro-spend entity (e.g., Rp 5,000 spend with 1 conversion)
 * from outranking stable high-volume campaigns.
 *
 * Anti-Hallucination Rules:
 * 1. Material Zero-Result Waste (results === 0 && spend >= materialZeroResultSpend && impressions >= minImpressionsToJudge)
 *    is NOT treated as insufficient data — it is evaluated and penalized as UNDERPERFORMING / LOSING.
 * 2. Any entity with results <= smallSampleMaxResults (1) and spend < minSpendFloor is quarantined as INSUFFICIENT_DATA.
 * 3. Any entity with impressions < minImpressionsToJudge (500) and results < minResultsForStrong (3) is quarantined as INSUFFICIENT_DATA.
 */
function insufficientSample(input: {
  impressions: number;
  results: number | null;
  spend: number;
  target?: number | null;
  thresholds: RankingThresholds;
}): boolean {
  const results = input.results ?? 0;
  const minSpendFloor =
    input.target && input.target > 0
      ? Math.max(input.target * 2, input.thresholds.smallSampleMaxSpend)
      : input.thresholds.smallSampleMaxSpend;
  if (results === 0 && input.spend >= input.thresholds.materialZeroResultSpend && input.impressions >= input.thresholds.minImpressionsToJudge) {
    return false;
  }
  if (results <= input.thresholds.smallSampleMaxResults && input.spend < minSpendFloor) return true;
  if (input.impressions < input.thresholds.minImpressionsToJudge && results < input.thresholds.minResultsForStrong) return true;
  return false;
}

/**
 * AUDIT PATCH 3 — Statistical Significance Upgrade:
 * Checks whether an entity meets the statistical significance floor required
 * to enter the TOP_PERFORMER / WINNER / EFFICIENT pool:
 * - results >= minResultsForWinner (default 10)
 * - spend >= max(target * 3, smallSampleMaxSpend)
 * Entities failing this floor are quarantined to STABLE or GATHERING_DATA,
 * preventing micro-samples from receiving winner classification.
 */
export function meetsWinnerSignificanceFloor(
  results: number | null,
  spend: number,
  target: number | null,
  thresholds: RankingThresholds = DEFAULT_RANKING_THRESHOLDS
): boolean {
  const minSpendFloor =
    target && target > 0
      ? Math.max(target * 3, thresholds.smallSampleMaxSpend)
      : thresholds.smallSampleMaxSpend;
  return (results ?? 0) >= thresholds.minResultsForWinner && spend >= minSpendFloor;
}

/**
 * SAFEGUARD 4 — Material Waste Protocol (Zero-Result Infinity Guard):
 * When Results === 0 and Spend >= materialZeroResultSpend (Rp 100,000),
 * the score is deterministically forced to 0 across all components,
 * preventing division-by-zero (CPR = Infinity) from corrupting sort order.
 */
function materialZeroResult(results: number | null, spend: number, impressions: number, thresholds: RankingThresholds): boolean {
  return (results ?? 0) === 0 && spend >= thresholds.materialZeroResultSpend && impressions >= thresholds.minImpressionsToJudge;
}

/**
 * SAFEGUARD 3 & 4 — Composite 5-Component Deterministic Scoring Algorithm:
 * - CPR (45%) + Volume (30%) = 75% weight priority.
 * - Protects "Golden Offer" campaigns (low CTR < 0.8%, high CVR >= 20%, linkClicks >= 30, profitable CPR <= target)
 *   from being penalized by upper-funnel CTR scores.
 * - Forces total score to 0 when Material Waste Protocol triggers.
 */
function buildScore(
  metrics: { cpr: number | null; results: number | null; ctr: number | null; cpc: number | null; impressions: number; spend?: number; cvr?: number | null; linkClicks?: number | null },
  peers: Array<{ cpr: number | null; results: number | null; ctr: number | null; cpc: number | null }>,
  target: number | null,
  thresholds: RankingThresholds
): ScoreBreakdown {
  if (materialZeroResult(metrics.results, metrics.spend ?? 0, metrics.impressions, thresholds)) {
    return { cpr: 0, volume: 0, ctr: 0, cpc: 0, confidence: 0, total: 0 };
  }

  const cpr = target && metrics.cpr && metrics.cpr > 0
    ? Math.max(0, Math.min(100, Math.round((target / metrics.cpr) * 70)))
    : lowerBetter(metrics.cpr, peers.map((item) => item.cpr));
  const volume = higherBetter(metrics.results, peers.map((item) => item.results));
  const rawCtr = higherBetter(metrics.ctr, peers.map((item) => item.ctr));
  const isGoldenOffer =
    (metrics.linkClicks ?? 0) >= 30 &&
    (metrics.ctr ?? 0) < 0.8 &&
    (metrics.cvr ?? 0) >= 20 &&
    metrics.cpr !== null &&
    metrics.cpr > 0 &&
    (target === null || metrics.cpr <= target);
  const ctr = isGoldenOffer ? Math.max(rawCtr, 75) : rawCtr;
  const cpc = lowerBetter(metrics.cpc, peers.map((item) => item.cpc));
  const confidence = confidenceScore(metrics.impressions, metrics.results, thresholds);
  const total = Math.round(
    cpr * RANKING_WEIGHTS.cpr +
      volume * RANKING_WEIGHTS.volume +
      ctr * RANKING_WEIGHTS.ctr +
      cpc * RANKING_WEIGHTS.cpc +
      confidence * RANKING_WEIGHTS.confidence
  );
  return { cpr, volume, ctr, cpc, confidence, total };
}

function campaignCategory(
  score: number,
  insufficient: boolean,
  results: number | null,
  spend: number,
  impressions: number,
  cpr: number | null,
  target: number | null,
  peerCount: number,
  thresholds: RankingThresholds
): CampaignRankCategory {
  if (insufficient) return "INSUFFICIENT_DATA";
  if ((results ?? 0) === 0) return materialZeroResult(results, spend, impressions, thresholds) ? "UNDERPERFORMING" : "INSUFFICIENT_DATA";
  if (peerCount < 2) return "UNRANKED";

  const res = results ?? 0;
  const significantForWinner = meetsWinnerSignificanceFloor(results, spend, target, thresholds);

  // Eligible for TOP_PERFORMER or EFFICIENT only when statistical significance floor is met
  if (significantForWinner && score >= 78 && (target === null || (cpr !== null && cpr <= target))) return "TOP_PERFORMER";
  if (significantForWinner && score >= 64) return "EFFICIENT";

  // AUDIT PATCH 3: Entities with results between 1 and 9 are capped at STABLE or flagged as GATHERING_DATA unless spend is massive
  const isMassiveSpend = target && target > 0 ? spend >= target * 5 : spend >= thresholds.materialZeroResultSpend * 2;
  if (res >= 1 && res < thresholds.minResultsForWinner && !isMassiveSpend) {
    return score >= 48 ? "STABLE" : "GATHERING_DATA";
  }

  if (score >= 48) return "STABLE";
  if (score >= 34) return "NEEDS_OPTIMIZATION";
  return "UNDERPERFORMING";
}

function adCategory(
  score: number,
  insufficient: boolean,
  results: number | null,
  impressions: number,
  spend: number,
  cpr: number | null,
  target: number | null,
  thresholds: RankingThresholds,
  peerCount: number
): AdRankCategory {
  if (insufficient) return "INSUFFICIENT_DATA";
  if ((results ?? 0) === 0) return materialZeroResult(results, spend, impressions, thresholds) ? "LOSING" : "INSUFFICIENT_DATA";
  if (peerCount < 2) return "UNRANKED";

  const res = results ?? 0;
  const significantForWinner = meetsWinnerSignificanceFloor(results, spend, target, thresholds);
  const enoughForWinner =
    significantForWinner &&
    impressions >= thresholds.minImpressionsForWinner &&
    (target === null || (cpr !== null && cpr <= target));

  if (enoughForWinner && score >= 72) return "WINNER";
  if (significantForWinner && (results ?? 0) >= thresholds.minResultsForStrong && spend >= thresholds.smallSampleMaxSpend && score >= 60) {
    return "STRONG_PERFORMER";
  }

  // AUDIT PATCH 3: Entities with results between 1 and 9 are capped at STABLE or flagged as GATHERING_DATA unless spend is massive
  const isMassiveSpend = target && target > 0 ? spend >= target * 5 : spend >= thresholds.materialZeroResultSpend * 2;
  if (res >= 1 && res < thresholds.minResultsForWinner && !isMassiveSpend) {
    return score >= 50 ? "STABLE" : "GATHERING_DATA";
  }

  if ((results ?? 0) >= 2 && score >= 50) return "POTENTIAL_WINNER";
  if ((results ?? 0) === 0 || score < 34) return "LOSING";
  return "NEEDS_OPTIMIZATION";
}

function eligibleAction(input: {
  effective: OperationalStatus;
  category: CampaignRankCategory | AdRankCategory;
  targetStatus: ResolvedTarget["status"];
  insufficient: boolean;
  activeAction: IntelligenceAction;
}): IntelligenceAction {
  if (input.effective === "DELETED" || input.effective === "ARCHIVED") return "HISTORICAL_REFERENCE";
  if (input.effective === "UNKNOWN") return "STATUS_UNKNOWN";
  if (input.effective === "PAUSED") {
    if (input.insufficient) return "KEEP_PAUSED";
    if (input.targetStatus === "BETTER" || input.targetStatus === "ON_TARGET") return "REACTIVATION_CANDIDATE";
    return "HISTORICAL_REVIEW";
  }
  return input.activeAction;
}

function campaignAction(category: CampaignRankCategory, paused: boolean, spendShare: number | null): IntelligenceAction {
  if (paused) return "HISTORICAL_REVIEW";
  if (category === "TOP_PERFORMER") return "SCALE";
  if (category === "EFFICIENT" || category === "STABLE") return "MAINTAIN";
  if (category === "GATHERING_DATA") return "MONITOR";
  if (category === "UNDERPERFORMING" && (spendShare ?? 0) >= 15) return "REDUCE_BUDGET";
  if (category === "UNDERPERFORMING") return "OPTIMIZE";
  if (category === "NEEDS_OPTIMIZATION") return "OPTIMIZE";
  return "MONITOR";
}

function adAction(category: AdRankCategory, paused: boolean): IntelligenceAction {
  if (paused) return "HISTORICAL_REVIEW";
  if (category === "WINNER") return "SCALE";
  if (category === "STRONG_PERFORMER" || category === "POTENTIAL_WINNER" || category === "STABLE") return "MAINTAIN";
  if (category === "GATHERING_DATA") return "MONITOR";
  if (category === "LOSING") return "PAUSE";
  if (category === "NEEDS_OPTIMIZATION") return "OPTIMIZE";
  return "MONITOR";
}

function money(value: number): string {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function compactRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  }
  if (abs >= 1_000) {
    return `Rp ${Math.round(value / 1_000).toLocaleString("id-ID")}rb`;
  }
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function shortResultUnitLabel(resultKind: string): string {
  switch (resultKind) {
    case "messaging":
      return "WA";
    case "leads":
      return "Leads";
    case "post_engagement":
      return "Interaksi";
    case "link_click":
      return "Klik";
    case "video_view":
      return "Views";
    default:
      return "hasil";
  }
}

function fmtPctId(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return `${val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function detectFunnelSignal(input: {
  spend: number;
  impressions: number;
  results: number | null;
  cpr: number | null;
  ctr: number | null;
  cvr: number | null;
  linkClicks: number | null;
  targetValue: number | null;
  thresholds: RankingThresholds;
}): FunnelSignal {
  const res = input.results ?? 0;
  const ctr = input.ctr;
  const cvr = input.cvr;
  const clicks = input.linkClicks ?? 0;

  if (materialZeroResult(input.results, input.spend, input.impressions, input.thresholds)) {
    return "material_waste";
  }

  const isProfitableCpr =
    input.cpr !== null &&
    input.cpr > 0 &&
    (input.targetValue !== null ? input.cpr <= input.targetValue : res >= 5);

  if (
    clicks >= 30 &&
    ctr !== null &&
    ctr < 0.8 &&
    cvr !== null &&
    cvr >= 20 &&
    isProfitableCpr
  ) {
    return "golden_offer";
  }

  if (
    input.spend >= 100_000 &&
    ctr !== null &&
    ((ctr > 1.5 && (cvr ?? 0) < 2) || (ctr >= 1.2 && res === 0))
  ) {
    return "traffic_leak";
  }

  return "normal";
}

function buildCompactDiagnosisCopy(input: {
  effectiveStatus: OperationalStatus;
  funnelSignal: FunnelSignal;
  category: CampaignRankCategory | AdRankCategory;
  action: IntelligenceAction;
  spend: number;
  results: number | null;
  cpr: number | null;
  ctr: number | null;
  cvr: number | null;
  target: ResolvedTarget;
  minResultsForWinner: number;
}): {
  diagnosisLabel: string;
  summaryShort: string;
  actionLabel: string;
} {
  const res = input.results ?? 0;
  const spendStr = compactRupiah(input.spend);
  const cprStr = compactRupiah(input.cpr);

  if (input.effectiveStatus !== "ACTIVE") {
    if (input.action === "REACTIVATION_CANDIDATE") {
      return {
        diagnosisLabel: `Kandidat Reaktivasi · ${res} hasil @ ${cprStr}`,
        summaryShort: `Kandidat Reaktivasi · CPR ${cprStr} berada pada atau di bawah target. Masukkan ke pertimbangan aktivasi manual.`,
        actionLabel: "Kandidat Reaktivasi",
      };
    }
    return {
      diagnosisLabel: "Nonaktif (Referensi Historis)",
      summaryShort: "Nonaktif (Referensi Historis) · Tidak memerlukan tindakan operasional.",
      actionLabel: "Arsip Historis",
    };
  }

  if (input.funnelSignal === "material_waste") {
    return {
      diagnosisLabel: `Spend Tanpa Hasil · ${spendStr} (0 konversi)`,
      summaryShort: `Spend Tanpa Hasil · ${spendStr} (0 konversi) — Hentikan penayangan.`,
      actionLabel: "Nonaktifkan",
    };
  }

  if (input.funnelSignal === "golden_offer") {
    return {
      diagnosisLabel: "Konversi Tinggi, CTR Rendah",
      summaryShort: `Konversi Tinggi, CTR Rendah · CTR ${fmtPctId(input.ctr)} / CVR ${fmtPctId(input.cvr)} — Pertahankan penawaran, uji variasi hook visual.`,
      actionLabel: "Optimasi",
    };
  }

  if (input.funnelSignal === "traffic_leak") {
    return {
      diagnosisLabel: "Drop-off Pasca-Klik",
      summaryShort: `Drop-off Pasca-Klik · CTR ${fmtPctId(input.ctr)} / CVR ${fmtPctId(input.cvr)} — Evaluasi kesesuaian pesan iklan dengan halaman tujuan/WhatsApp.`,
      actionLabel: "Optimasi",
    };
  }

  if (input.action === "SCALE") {
    return {
      diagnosisLabel: `Efisien (Di Bawah Target) · ${res} hasil @ ${cprStr}`,
      summaryShort: `Efisien (Di Bawah Target) · ${res} hasil @ ${cprStr} — Naikkan anggaran bertahap 15–20%.`,
      actionLabel: "Naikkan Budget",
    };
  }

  if (
    input.category === "INSUFFICIENT_DATA" ||
    input.category === "GATHERING_DATA" ||
    res < input.minResultsForWinner
  ) {
    return {
      diagnosisLabel: `Observasi Sampel · ${res}/${input.minResultsForWinner} konversi`,
      summaryShort: `Observasi Sampel · ${res}/${input.minResultsForWinner} konversi minimum — Tahan perubahan hingga sampel memadai.`,
      actionLabel: "Observasi",
    };
  }

  if (
    input.action === "PAUSE" ||
    input.action === "REDUCE_BUDGET" ||
    input.category === "UNDERPERFORMING" ||
    input.category === "LOSING" ||
    input.target.status === "WORSE"
  ) {
    const isPause = input.action === "PAUSE";
    return {
      diagnosisLabel: `Di Atas Target CPR · ${cprStr}/hasil`,
      summaryShort: isPause
        ? `Di Atas Target CPR · ${res} hasil @ ${cprStr} — Hentikan penayangan.`
        : `Di Atas Target CPR · ${res} hasil @ ${cprStr} — Evaluasi materi iklan dan segmentasi audiens.`,
      actionLabel: isPause ? "Nonaktifkan" : "Kurangi Budget",
    };
  }

  if (input.action === "OPTIMIZE" || input.category === "NEEDS_OPTIMIZATION") {
    return {
      diagnosisLabel: `Di Atas Target CPR · ${cprStr}/hasil`,
      summaryShort: `Di Atas Target CPR · ${res} hasil @ ${cprStr} — Evaluasi materi iklan dan segmentasi audiens.`,
      actionLabel: "Optimasi",
    };
  }

  if (input.target.value !== null && input.target.status !== "TARGET_NOT_CONFIGURED") {
    return {
      diagnosisLabel: `Stabil Sesuai Target · ${res} hasil @ ${cprStr}`,
      summaryShort: `Stabil Sesuai Target · Pertahankan struktur dan pantau frekuensi.`,
      actionLabel: "Pertahankan",
    };
  }

  return {
    diagnosisLabel: `Performa Stabil · ${res} hasil @ ${cprStr}`,
    summaryShort: `Performa Stabil · Pertahankan struktur dan pantau frekuensi.`,
    actionLabel: "Pertahankan",
  };
}

function recommendationCopy(action: IntelligenceAction, longPeriod: boolean): string {
  if (action === "REACTIVATION_CANDIDATE") {
    return "Histori periode ini berada pada atau di bawah target. Masukkan objek ini sebagai kandidat pertimbangan reaktivasi. Aktivasi tetap manual, dan anggaran uji diisi baru karena anggaran lama tidak tersimpan.";
  }
  if (action === "HISTORICAL_REVIEW") return "Tinjau angka periode ini sebagai histori. Jangan perlakukan objek sebagai sedang berjalan.";
  if (action === "KEEP_PAUSED") return "Biarkan dijeda. Sampel pada periode ini belum cukup untuk meninjau aktivasi.";
  if (action === "HISTORICAL_REFERENCE") return "Objek diarsipkan atau dihapus. Gunakan hanya sebagai referensi histori.";
  if (action === "STATUS_UNKNOWN") return "Status efektif tidak dapat dipastikan. Tidak ada tindakan operasional.";
  if (longPeriod) return "Agregasi periode panjang tidak dipakai untuk optimasi harian. Ulangi evaluasi pada jendela 7, 14, atau 30 hari sebelum mengubah anggaran.";
  if (action === "SCALE") return "Status efektif aktif dan performa periode mendukung uji skala. Besaran kenaikan tidak dihitung karena anggaran kampanye tidak ada di snapshot.";
  if (action === "REDUCE_BUDGET") return "Kurangi uji belanja secara bertahap. Nominal anggaran baru tidak dihitung karena sisa anggaran tidak tersedia.";
  if (action === "PAUSE") return "Pertimbangkan jeda setelah ambang belanja dan impresi terpenuhi. Jangan dieksekusi otomatis.";
  if (action === "OPTIMIZE") return "Tinjau materi, penawaran, dan audiens sebagai hipotesis. Penyebab belum dipastikan, dan anggaran tidak ditambah sebelum komponen yang lemah terbukti.";
  if (action === "MAINTAIN") return "Pertahankan pengaturan saat ini dan teruskan pemantauan.";
  return "Belum cukup dasar untuk mengubah anggaran atau status.";
}

/**
 * AUDIT PATCH 1 — Timezone & Date Truncation Safe Normalization:
 * Normalizes an ISO timestamp, Date object, or calendar string into a YYYY-MM-DD
 * representation aligned with the specified account timezone (default Asia/Jakarta).
 * Eliminates timezone drift (e.g. conversions at 23:00 UTC bleeding into the wrong day).
 */
export function normalizeDateToTimezone(
  rawDate: string | Date | null | undefined,
  timezone: string = "Asia/Jakarta"
): string | null {
  if (!rawDate) return null;

  // Strict YYYY-MM-DD calendar string without time or timezone offset
  if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
    return rawDate.trim();
  }

  try {
    const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (isNaN(dateObj.getTime())) {
      return typeof rawDate === "string" ? rawDate.slice(0, 10) : null;
    }

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(dateObj);
  } catch {
    try {
      const dateObj = new Date(rawDate);
      return dateObj.toISOString().slice(0, 10);
    } catch {
      return typeof rawDate === "string" ? rawDate.slice(0, 10) : null;
    }
  }
}

export function insightFallsInPeriod(
  row: AdInsightRowLike,
  periodStart: string,
  periodEnd: string,
  timezone: string = "Asia/Jakarta"
): boolean {
  if (!row.date_start) return false;
  const day = normalizeDateToTimezone(row.date_start, timezone);
  if (!day) return false;
  const startDay = normalizeDateToTimezone(periodStart, timezone) || periodStart;
  const endDay = normalizeDateToTimezone(periodEnd, timezone) || periodEnd;
  if (startDay && day < startDay) return false;
  if (endDay && day > endDay) return false;
  return true;
}

export function insightShowsActivity(row: AdInsightRowLike): boolean {
  const messaging = messagingFromRow(row) ?? 0;
  const leads = leadsFromRow(row) ?? 0;
  return (row.spend ?? 0) > 0
    || (row.impressions ?? 0) > 0
    || (row.reach ?? 0) > 0
    || (row.clicks ?? 0) > 0
    || (row.link_clicks ?? row.linkClicks ?? 0) > 0
    || (row.conversions ?? 0) > 0
    || messaging > 0
    || leads > 0;
}

/**
 * SAFEGUARD 1 — Strict Objective & Action Type Isolation:
 * Resolves the canonical conversion action kind so that cheap upper-funnel actions
 * (e.g., `post_engagement`, `video_view`, `link_click`) are never blended or ranked
 * in the same peer leaderboard as high-intent outcomes (`messaging`, `leads`).
 */
function metricsOf(rows: AdInsightRowLike[], objective: string | null) {
  const agg = aggregateAdInsights(rows);
  const primary = selectPrimaryResult(agg, objective);

  let resultKind: string = primary.kind;
  let resultLabel: string = primary.label;
  let results: number | null = primary.count;
  let cpr: number | null = primary.count && primary.count > 0 ? primary.cost : null;

  const explicitActionTypes = Array.from(
    new Set(
      rows
        .map((r) => (r.conversion_action_type || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
  const firstAction = explicitActionTypes[0] || "";
  const hasMessaging = (agg.messagingConversations ?? 0) > 0;
  const hasLeads = (agg.leads ?? 0) > 0;

  if (!hasMessaging && !hasLeads && firstAction) {
    if (firstAction.includes("post_engagement") || firstAction.includes("page_engagement") || firstAction === "engagement") {
      resultKind = "post_engagement";
      resultLabel = "Interaksi Postingan (Engagement)";
      results = agg.results;
      cpr = agg.results && agg.results > 0 ? agg.costPerResult : null;
    } else if (firstAction.includes("video_view")) {
      resultKind = "video_view";
      resultLabel = "Tayangan Video";
      results = agg.results;
      cpr = agg.results && agg.results > 0 ? agg.costPerResult : null;
    } else if (firstAction.includes("link_click")) {
      resultKind = "link_click";
      resultLabel = "Klik Tautan";
      results = agg.linkClicks ?? agg.results;
      cpr = results && results > 0 ? agg.linkCpc ?? agg.costPerResult : null;
    }
  }

  const cvr =
    agg.linkClicks && agg.linkClicks > 0 && results !== null
      ? Number(((results / agg.linkClicks) * 100).toFixed(2))
      : null;

  return {
    spend: agg.spend,
    impressions: agg.impressions,
    reach: agg.reach,
    frequency: agg.frequency,
    ctr: agg.linkCtr,
    cpc: agg.linkCpc,
    cpm: agg.cpm,
    linkClicks: agg.linkClicks,
    clicks: agg.allClicks,
    results,
    cpr: cpr !== null && Number.isFinite(cpr) ? cpr : null,
    cvr,
    resultKind,
    resultLabel,
  };
}

export function buildAccountIntelligence(input: {
  accountId?: string | null;
  accountName: string;
  currency?: string;
  timezone?: string;
  periodStart: string;
  periodEnd: string;
  durationDays: number;
  accountCampaignTargetCpr?: number | null;
  campaigns: AccountCampaignInput[];
  ads: AccountAdInput[];
  insights: AccountInsightInput[];
  previous?: { spend: number; results: number | null } | null;
  insightTruncated?: boolean;
  thresholds?: RankingThresholds;
}): AccountIntelligenceReport {
  const thresholds = input.thresholds ?? DEFAULT_RANKING_THRESHOLDS;
  const warnings: string[] = [];
  const missing = [
    "daily_budget",
    "lifetime_budget",
    "ad_set",
    "placement_breakdown",
    "audience_breakdown",
  ];
  if (input.insightTruncated) {
    warnings.push("Insight terpotong oleh batas halaman. Peringkat hanya memakai baris yang berhasil dimuat.");
  }
  warnings.push("Anggaran dialokasikan dan sisa anggaran tidak tersedia di snapshot lokal, jadi tidak dihitung.");
  warnings.push("Ad set, audience, dan placement tidak ada di data lokal. Tidak ada kesimpulan audience atau penempatan.");

  const accountTimezone = input.timezone || "Asia/Jakarta";
  const periodInsights = input.insights.filter((row) =>
    insightFallsInPeriod(row, input.periodStart, input.periodEnd, accountTimezone)
  );
  const droppedOutsidePeriod = input.insights.length - periodInsights.length;
  const activeInsights = periodInsights.filter((row) => insightShowsActivity(row));
  if (droppedOutsidePeriod > 0) {
    warnings.push(`${droppedOutsidePeriod} baris insight di luar ${input.periodStart} s/d ${input.periodEnd} tidak dipakai. Data lifetime tidak menggantikan periode ini.`);
  }
  if (input.insights.some((row) => !row.date_start)) {
    warnings.push("Baris insight tanpa tanggal dibuang agar metrik seumur hidup tidak masuk periode.");
  }

  // AUDIT PATCH 4 — CBO Budget Illusion Check:
  // Detects discrepancy between campaign-level spend and ad-level insight spend (> 5%).
  const campaignsWithSpend = input.campaigns.filter((c) => typeof c.spend === "number" && (c.spend ?? 0) > 0);
  if (campaignsWithSpend.length > 0) {
    const sumCampaignSpend = campaignsWithSpend.reduce((acc, c) => acc + (c.spend || 0), 0);
    const sumAdSpend = activeInsights.reduce((acc, r) => acc + (r.spend || 0), 0);
    if (sumCampaignSpend > 0) {
      const discrepancyRatio = Math.abs(sumCampaignSpend - sumAdSpend) / sumCampaignSpend;
      if (discrepancyRatio > 0.05) {
        warnings.push(
          "Terdeteksi selisih pembelanjaan antara level Iklan dan Kampanye. Metrik dihitung berdasarkan data level iklan."
        );
      }
    }
  }

  const campaignById = new Map(input.campaigns.map((campaign) => [campaign.id, campaign]));
  const activeAdIds = new Set(activeInsights.map((row) => row.ad_id));
  const rowsByAd = new Map<string, AccountInsightInput[]>();
  for (const row of activeInsights) {
    const list = rowsByAd.get(row.ad_id) || [];
    list.push(row);
    rowsByAd.set(row.ad_id, list);
  }
  const performanceAds = input.ads.filter((ad) => activeAdIds.has(ad.id));
  const performanceCampaignIds = new Set(performanceAds.map((ad) => ad.campaignId));
  const performanceCampaigns = input.campaigns.filter((campaign) => performanceCampaignIds.has(campaign.id));
  warnings.push("Ranking dan rekomendasi hanya memakai campaign dan iklan yang memiliki aktivitas di dalam periode analisis.");

  const adsByCampaign = new Map<string, AccountAdInput[]>();
  for (const ad of input.ads) {
    const list = adsByCampaign.get(ad.campaignId) || [];
    list.push(ad);
    adsByCampaign.set(ad.campaignId, list);
  }

  const campaignMetrics = performanceCampaigns.map((campaign) => {
    const ads = (adsByCampaign.get(campaign.id) || []).filter((ad) => activeAdIds.has(ad.id));
    const rows = ads.flatMap((ad) => rowsByAd.get(ad.id) || []);
    return { campaign, ads, metrics: metricsOf(rows, campaign.objective) };
  });

  const accountRows = activeInsights;
  const accountAgg = aggregateAdInsights(accountRows);
  const resultKinds = new Set(
    campaignMetrics
      .filter((item) => (item.metrics.results ?? 0) > 0 || item.metrics.spend > 0)
      .map((item) => item.metrics.resultKind)
  );
  const comparable = resultKinds.size <= 1;
  const soleKind = campaignMetrics.find((item) => (item.metrics.results ?? 0) > 0)?.metrics;
  const summedResults = campaignMetrics.reduce((sum, item) => sum + (item.metrics.results ?? 0), 0);
  const accountResults = comparable ? summedResults : null;
  const accountCpr = comparable && accountResults && accountResults > 0
    ? Number((accountAgg.spend / accountResults).toFixed(2))
    : null;
  const accountLabel = comparable ? soleKind?.resultLabel ?? null : null;
  if (!comparable) {
    warnings.push("ACCOUNT_RESULT_NOT_COMPARABLE. Hasil campaign tidak sejenis. Total hasil dan CPR akun tidak digabung.");
  }
  if (!input.accountCampaignTargetCpr) {
    warnings.push("TARGET_NOT_CONFIGURED untuk target default campaign.");
  }
  if (input.durationDays > 90) {
    warnings.push("Periode lebih dari 90 hari adalah agregasi historis. Jangan mengubah anggaran harian dari angka ini.");
  }

  const totalSpend = accountAgg.spend;
  const peerCampaign = campaignMetrics.map((item) => item.metrics);
  const rankedCampaigns: RankedCampaign[] = campaignMetrics
    .map((item) => {
      const target = applyTargetStatus(
        resolveEvaluationTarget({
          level: "campaign",
          objectTarget: item.campaign.targetCpr,
          accountDefault: input.accountCampaignTargetCpr,
        }),
        item.metrics.cpr
      );
      const insufficient = insufficientSample({ ...item.metrics, target: target.value, thresholds });
      const sameKind = peerCampaign.filter((peer) => peer.resultKind === item.metrics.resultKind);
      const score = buildScore(item.metrics, sameKind, target.value, thresholds);
      const share = totalSpend > 0 ? Number(((item.metrics.spend / totalSpend) * 100).toFixed(1)) : null;
      const category = campaignCategory(score.total, insufficient, item.metrics.results, item.metrics.spend, item.metrics.impressions, item.metrics.cpr, target.value, sameKind.length, thresholds);
      const resolved = resolveOperationalStatus({ configuredStatus: item.campaign.status });
      const paused = resolved.effective === "PAUSED" || resolved.effective === "ARCHIVED" || resolved.effective === "DELETED";
      const basis = paused ? "historical_paused" as const : "active_delivery" as const;
      const action = eligibleAction({
        effective: resolved.effective,
        category,
        targetStatus: target.status,
        insufficient,
        activeAction: campaignAction(category, false, share),
      });
      const cprText = item.metrics.cpr === null ? "CPR tidak tersedia" : `CPR ${money(item.metrics.cpr)}`;
      const targetText = target.status === "TARGET_NOT_CONFIGURED"
        ? sameKind.length < 2
          ? "Target campaign belum dikonfigurasi dan tidak ada campaign sejenis sebagai pembanding, jadi label peringkat tidak dipakai."
          : "Target campaign belum dikonfigurasi. Peringkat hanya dibanding campaign dengan jenis hasil yang sama."
        : `Target campaign ${money(target.value || 0)} (${target.status}).`;
      const funnelSignal = detectFunnelSignal({
        spend: item.metrics.spend,
        impressions: item.metrics.impressions,
        results: item.metrics.results,
        cpr: item.metrics.cpr,
        ctr: item.metrics.ctr,
        cvr: item.metrics.cvr,
        linkClicks: item.metrics.linkClicks,
        targetValue: target.value,
        thresholds,
      });
      const compactCopy = buildCompactDiagnosisCopy({
        effectiveStatus: resolved.effective,
        funnelSignal,
        category,
        action,
        spend: item.metrics.spend,
        results: item.metrics.results,
        cpr: item.metrics.cpr,
        ctr: item.metrics.ctr,
        cvr: item.metrics.cvr,
        target,
        minResultsForWinner: thresholds.minResultsForWinner,
      });
      return {
        rank: 0,
        id: item.campaign.id,
        providerId: item.campaign.providerId,
        name: item.campaign.name,
        status: resolved.effective,
        configuredStatus: resolved.configured,
        effectiveStatus: resolved.effective,
        objective: item.campaign.objective,
        resultKind: item.metrics.resultKind,
        resultLabel: item.metrics.resultLabel,
        spend: item.metrics.spend,
        results: item.metrics.results,
        cpr: item.metrics.cpr,
        ctr: item.metrics.ctr,
        cpc: item.metrics.cpc,
        cpm: item.metrics.cpm,
        impressions: item.metrics.impressions,
        reach: item.metrics.reach,
        frequency: item.metrics.frequency,
        linkClicks: item.metrics.linkClicks,
        cvr: item.metrics.cvr,
        spendSharePct: share,
        target,
        category,
        score,
        reason: `${paused ? "Status operasional dijeda. Angka berikut hanya performa di dalam periode, bukan bukti iklan sedang berjalan. " : ""}${cprText}, hasil ${item.metrics.results ?? 0}, belanja ${money(item.metrics.spend)}, CTR tautan ${item.metrics.ctr ?? "tidak tersedia"}%. ${targetText} Skor ${score.total} (CPR ${score.cpr}, volume ${score.volume}, CTR ${score.ctr}, CPC ${score.cpc}, keyakinan ${score.confidence}).`,
        action,
        performanceBasis: basis,
        funnelSignal,
        diagnosisLabel: compactCopy.diagnosisLabel,
        summaryShort: compactCopy.summaryShort,
        actionLabel: compactCopy.actionLabel,
      };
    })
    .sort((a, b) => b.score.total - a.score.total || (b.results ?? 0) - (a.results ?? 0) || a.id.localeCompare(b.id))
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const adPeers = performanceAds.map((ad) => metricsOf(rowsByAd.get(ad.id) || [], campaignById.get(ad.campaignId)?.objective ?? null));
  const rankedAds: RankedAd[] = performanceAds
    .map((ad, index) => {
      const parent = campaignById.get(ad.campaignId);
      const metrics = adPeers[index];
      const target = applyTargetStatus(
        resolveEvaluationTarget({
          level: "ad",
          objectTarget: ad.targetCpr,
          parentTarget: parent?.targetCpr ?? input.accountCampaignTargetCpr,
          inheritExplicit: ad.inheritCampaignTarget === true,
        }),
        metrics.cpr
      );
      const insufficient = insufficientSample({ ...metrics, target: target.value, thresholds });
      const sameKind = adPeers.filter((peer) => peer.resultKind === metrics.resultKind);
      const score = buildScore(metrics, sameKind, target.value, thresholds);
      const category = adCategory(score.total, insufficient, metrics.results, metrics.impressions, metrics.spend, metrics.cpr, target.value, thresholds, sameKind.length);
      const resolved = resolveOperationalStatus({
        configuredStatus: ad.status,
        campaignStatus: parent?.status,
        adSetStatus: ad.adSetStatus,
        adSetStatusKnown: ad.adSetStatusKnown === true,
        metaEffectiveStatus: ad.metaEffectiveStatus,
      });
      const action = eligibleAction({
        effective: resolved.effective,
        category,
        targetStatus: target.status,
        insufficient,
        activeAction: adAction(category, false),
      });
      const targetText = target.status === "TARGET_NOT_CONFIGURED"
        ? "Target ad belum dikonfigurasi."
        : `Target ad ${money(target.value || 0)} (${target.status}).`;
      const funnelSignal = detectFunnelSignal({
        spend: metrics.spend,
        impressions: metrics.impressions,
        results: metrics.results,
        cpr: metrics.cpr,
        ctr: metrics.ctr,
        cvr: metrics.cvr,
        linkClicks: metrics.linkClicks,
        targetValue: target.value,
        thresholds,
      });
      const compactCopy = buildCompactDiagnosisCopy({
        effectiveStatus: resolved.effective,
        funnelSignal,
        category,
        action,
        spend: metrics.spend,
        results: metrics.results,
        cpr: metrics.cpr,
        ctr: metrics.ctr,
        cvr: metrics.cvr,
        target,
        minResultsForWinner: thresholds.minResultsForWinner,
      });
      return {
        rank: 0,
        id: ad.id,
        providerId: ad.providerId,
        name: ad.name,
        status: resolved.effective,
        configuredStatus: resolved.configured,
        effectiveStatus: resolved.effective,
        campaignId: ad.campaignId,
        campaignName: parent?.name || "Campaign tidak diketahui",
        resultKind: metrics.resultKind,
        resultLabel: metrics.resultLabel,
        spend: metrics.spend,
        results: metrics.results,
        cpr: metrics.cpr,
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpm: metrics.cpm,
        impressions: metrics.impressions,
        reach: metrics.reach,
        frequency: metrics.frequency,
        linkClicks: metrics.linkClicks,
        cvr: metrics.cvr,
        target,
        category,
        score,
        reason: `${resolved.effective === "PAUSED" ? "Status efektif dijeda. Angka ini histori periode, bukan delivery aktif, dan bukan kelayakan aktivasi. " : ""}${metrics.impressions} impresi menghasilkan ${metrics.linkClicks ?? "tidak tersedia"} klik tautan, CTR ${metrics.ctr ?? "tidak tersedia"}%, CPC ${metrics.cpc === null ? "tidak tersedia" : money(metrics.cpc)}, hasil ${metrics.results ?? 0}, CPR ${metrics.cpr === null ? "tidak tersedia" : money(metrics.cpr)}. ${targetText} Isi creative, audience, dan placement tidak ada pada evidence, jadi tidak dinilai.`,
        action,
        performanceBasis: resolved.effective === "ACTIVE" ? "active_delivery" as const : "historical_paused" as const,
        funnelSignal,
        diagnosisLabel: compactCopy.diagnosisLabel,
        summaryShort: compactCopy.summaryShort,
        actionLabel: compactCopy.actionLabel,
      };
    })
    .sort((a, b) => b.score.total - a.score.total || (b.results ?? 0) - (a.results ?? 0) || a.id.localeCompare(b.id))
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const topSpendCampaign = [...rankedCampaigns].sort((a, b) => b.spend - a.spend)[0];
  const topSpendAd = [...rankedAds].sort((a, b) => b.spend - a.spend)[0];
  const mostResults = [...rankedCampaigns].sort((a, b) => (b.results ?? 0) - (a.results ?? 0))[0];
  const efficient = [...rankedCampaigns]
    .filter((item) => item.cpr !== null && item.category !== "INSUFFICIENT_DATA")
    .sort((a, b) => (a.cpr || 0) - (b.cpr || 0))[0];
  const wasted = rankedCampaigns.filter((item) => item.spend >= thresholds.materialZeroResultSpend && (item.results ?? 0) === 0);

  const spendByCategory: Record<string, number> = {};
  for (const ad of rankedAds) {
    spendByCategory[ad.category] = (spendByCategory[ad.category] || 0) + ad.spend;
  }

  const insights: AccountIntelligenceReport["key_insights"] = [];
  if (efficient) {
    insights.push({
      object_id: efficient.id,
      object_name: efficient.name,
      text: `${efficient.name} (${efficient.providerId}) punya CPR terendah yang layak dibanding di antara campaign berdata cukup: ${money(efficient.cpr || 0)}.`,
    });
  }
  if (topSpendCampaign && totalSpend > 0) {
    insights.push({
      object_id: topSpendCampaign.id,
      object_name: topSpendCampaign.name,
      text: `${topSpendCampaign.name} menyerap ${topSpendCampaign.spendSharePct ?? 0}% belanja akun (${money(topSpendCampaign.spend)} dari ${money(totalSpend)}).`,
    });
  }
  const topAd = rankedAds.find((item) => (item.results ?? 0) > 0);
  if (topAd) {
    insights.push({
      object_id: topAd.id,
      object_name: topAd.name,
      text: `${topAd.name} di ${topAd.campaignName} mencatat hasil terbanyak pada peringkat iklan: ${topAd.results} ${topAd.resultLabel}.`,
    });
  }
  if (wasted[0]) {
    insights.push({
      object_id: wasted[0].id,
      object_name: wasted[0].name,
      text: `${wasted[0].name} membelanjakan ${money(wasted[0].spend)} tanpa hasil. CPR tidak ditampilkan sebagai nol.`,
    });
  }
  const sink = rankedCampaigns.find((item) => item.action === "REDUCE_BUDGET");
  const grow = rankedCampaigns.find((item) => item.action === "SCALE" || item.action === "REACTIVATE");
  if (sink && grow && sink.id !== grow.id) {
    insights.push({
      object_id: sink.id,
      object_name: sink.name,
      text: `Peluang geser uji anggaran dari ${sink.name} (${sink.providerId}) ke ${grow.name} (${grow.providerId}), setelah pemantauan, bukan pemindahan otomatis.`,
    });
  }

  const longPeriod = input.durationDays > 90;
  const rankedRecommendations = [...rankedCampaigns, ...rankedAds]
    .map((item): AccountRecommendation => {
      const level = "campaignId" in item ? "ad" as const : "campaign" as const;
      const priority =
        item.action === "REDUCE_BUDGET" || (item.action === "PAUSE" && item.spend >= thresholds.materialZeroResultSpend)
          ? "CRITICAL"
          : item.action === "SCALE" || item.action === "PAUSE" || item.action === "REACTIVATION_CANDIDATE"
            ? "HIGH"
            : item.action === "OPTIMIZE" || item.action === "HISTORICAL_REVIEW"
              ? "MEDIUM"
              : "LOW";
      return {
        priority,
        action: item.action,
        objectLevel: level,
        objectName: item.name,
        objectId: item.id,
        providerId: item.providerId,
        currentStatus: item.effectiveStatus,
        spend: item.spend,
        results: item.results,
        cpr: item.cpr,
        ctr: item.ctr,
        targetCpr: item.target.value,
        targetStatus: item.target.status,
        reason: item.reason,
        recommendedAction: recommendationCopy(item.action, longPeriod),
        expectedImpact: "Dampak tidak dijamin. Ukuran keberhasilan adalah CPR dan volume hasil pada jenis konversi yang sama.",
        risk: item.action === "SCALE" || item.action === "PAUSE" || item.action === "REACTIVATION_CANDIDATE" ? "medium" : "low",
        monitoring: longPeriod
          ? "Jangan mengambil keputusan anggaran harian dari agregasi lebih dari 90 hari. Ulangi evaluasi pada 7, 14, atau 30 hari."
          : input.durationDays <= 3
            ? "Perpanjang observasi sebelum keputusan struktural."
            : "3 hari setelah perubahan manual.",
        stopLoss: item.target.value
          ? `Tinjau ulang jika CPR melewati ${money(item.target.value * 1.5)} pada jenis hasil yang sama.`
          : "Stop-loss numerik belum bisa dihitung karena target objek belum diatur.",
      };
    })
    .filter((item) => item.action !== "NO_ACTION" && item.action !== "MAINTAIN")
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.spend - a.spend);
  const historicalActions = new Set<IntelligenceAction>(["KEEP_PAUSED", "HISTORICAL_REVIEW", "REACTIVATION_CANDIDATE", "HISTORICAL_REFERENCE", "STATUS_UNKNOWN"]);
  const historical_reviews = rankedRecommendations.filter((item) => historicalActions.has(item.action)).slice(0, 5);
  const recommendations = rankedRecommendations.filter((item) => !historicalActions.has(item.action)).slice(0, 5);

  const actionPlan = recommendations.slice(0, 5).map((item) => ({
    object_id: item.objectId,
    object_name: item.objectName,
    item: `${item.action} · ${item.objectName} (${item.providerId})`,
  }));

  // Build per-objective breakdown (without mixing unlike result kinds)
  const kindBuckets = new Map<string, ObjectiveKindBreakdownItem>();
  for (const c of rankedCampaigns) {
    const existing = kindBuckets.get(c.resultKind) || {
      kind: c.resultKind,
      label: c.resultLabel,
      shortUnit: shortResultUnitLabel(c.resultKind),
      spend: 0,
      results: 0,
      cpr: null,
      campaignCount: 0,
    };
    existing.spend = Math.round((existing.spend + c.spend) * 100) / 100;
    existing.results += c.results ?? 0;
    existing.campaignCount += 1;
    existing.cpr = existing.results > 0 ? Number((existing.spend / existing.results).toFixed(2)) : null;
    kindBuckets.set(c.resultKind, existing);
  }
  const resultBreakdownByKind = Array.from(kindBuckets.values()).sort((a, b) => b.spend - a.spend);

  // Build "Prioritas Tindakan" (strictly ACTIVE entities, ordered by financial impact)
  // Order: 1) Spend Tanpa Hasil / Material Waste & Pause/Reduce Budget (largest spend first)
  //        2) Golden Offer & Clickbait Traffic Leak (largest spend first)
  //        3) Siap Scale (largest spend first)
  //        4) Optimasi CPR (largest spend first)
  const priorityCandidates: Array<PriorityActionItem & { sortBucket: number }> = [];
  for (const item of [...rankedCampaigns, ...rankedAds]) {
    if (item.effectiveStatus !== "ACTIVE" && item.action !== "REACTIVATION_CANDIDATE") continue;
    const isAd = "campaignId" in item;
    const sig = item.funnelSignal ?? "normal";
    let sortBucket = 99;
    let priority: PriorityActionItem["priority"] = "MEDIUM";

    if (sig === "material_waste" || item.action === "PAUSE" || item.action === "REDUCE_BUDGET") {
      sortBucket = 1;
      priority = "CRITICAL";
    } else if (sig === "golden_offer" || sig === "traffic_leak") {
      sortBucket = 2;
      priority = "HIGH";
    } else if (item.action === "SCALE" || item.action === "REACTIVATION_CANDIDATE") {
      sortBucket = 3;
      priority = "HIGH";
    } else if (item.action === "OPTIMIZE") {
      sortBucket = 4;
      priority = "MEDIUM";
    } else {
      continue;
    }

    priorityCandidates.push({
      sortBucket,
      objectId: item.id,
      providerId: item.providerId,
      objectLevel: isAd ? "ad" : "campaign",
      objectName: item.name,
      parentName: isAd ? item.campaignName : undefined,
      priority,
      action: item.action,
      actionLabel: item.actionLabel || item.action,
      funnelSignal: sig,
      spend: item.spend,
      results: item.results,
      cpr: item.cpr,
      summaryShort: item.summaryShort || item.reason,
      diagnosisLabel: item.diagnosisLabel || item.category,
    });
  }

  priorityCandidates.sort((a, b) => a.sortBucket - b.sortBucket || b.spend - a.spend);
  const priorityActions: PriorityActionItem[] = priorityCandidates
    .slice(0, 5)
    .map(({ sortBucket: _bucket, ...rest }) => {
      void _bucket;
      return rest;
    });

  // Account health counts across active vs paused campaigns/ads (mutually exclusive & collectively exhaustive)
  const activeRankedEntities = rankedCampaigns.length > 0 ? rankedCampaigns : rankedAds;
  let activeCount = 0;
  let scaleCount = 0;
  let wasteCount = 0;
  let optimizeCount = 0;
  let holdCount = 0;
  let historicalCount = 0;
  let historicalGoodCount = 0;
  let historicalNeutralCount = 0;
  let historicalUnderperformingCount = 0;

  for (const e of activeRankedEntities) {
    if (e.effectiveStatus === "ACTIVE") {
      activeCount += 1;
      if (e.funnelSignal === "material_waste" || e.action === "PAUSE" || e.action === "REDUCE_BUDGET") {
        wasteCount += 1;
      } else if (e.action === "SCALE") {
        scaleCount += 1;
      } else if (
        e.funnelSignal === "golden_offer" ||
        e.funnelSignal === "traffic_leak" ||
        e.action === "OPTIMIZE" ||
        e.category === "NEEDS_OPTIMIZATION"
      ) {
        optimizeCount += 1;
      } else {
        holdCount += 1;
      }
    } else {
      historicalCount += 1;
      if (e.category === "TOP_PERFORMER" || e.category === "EFFICIENT" || e.category === "WINNER") {
        historicalGoodCount += 1;
      } else if (e.category === "UNDERPERFORMING" || e.category === "LOSING") {
        historicalUnderperformingCount += 1;
      } else {
        historicalNeutralCount += 1;
      }
    }
  }

  const healthCounts = {
    activeCount,
    scaleCount,
    wasteCount,
    optimizeCount,
    holdCount,
    historicalCount,
    historicalGoodCount,
    historicalNeutralCount,
    historicalUnderperformingCount,
  };

  const inventoryAdStatus = input.ads.map((ad) => resolveOperationalStatus({
    configuredStatus: ad.status,
    campaignStatus: campaignById.get(ad.campaignId)?.status,
    adSetStatus: ad.adSetStatus,
    adSetStatusKnown: ad.adSetStatusKnown === true,
    metaEffectiveStatus: ad.metaEffectiveStatus,
  }));
  const allCampaignsPaused = input.campaigns.length > 0 && input.campaigns.every((campaign) => statusBucket(campaign.status) === "paused");
  const activeCampaigns = input.campaigns.filter((item) => statusBucket(item.status) === "active").length;
  const pausedCampaigns = input.campaigns.filter((item) => statusBucket(item.status) === "paused").length;
  const archivedCampaigns = input.campaigns.filter((item) => statusBucket(item.status) === "archived").length;
  const confidence = input.durationDays >= 14 && !input.insightTruncated && comparable ? "high" : input.durationDays <= 3 ? "low" : "medium";

  const reportWithoutIntelligence: Omit<AccountIntelligenceReport, "intelligence"> = {
    analysis_metadata: {
      account_id: input.accountId ?? null,
      account_name: input.accountName,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      timezone: input.timezone || "Asia/Jakarta",
      currency: input.currency || "IDR",
      data_confidence: confidence,
      analyzed_campaign_count: input.campaigns.length,
      analyzed_ad_count: input.ads.length,
      campaigns_with_delivery: performanceCampaigns.length,
      ads_with_delivery: performanceAds.length,
      excluded_campaign_count: input.campaigns.length - performanceCampaigns.length,
      excluded_ad_count: input.ads.length - performanceAds.length,
      active_without_delivery: input.campaigns.filter((campaign) => statusBucket(campaign.status) === "active" && !performanceCampaignIds.has(campaign.id)).length,
      configured_active_ads: inventoryAdStatus.filter((item) => item.configured === "ACTIVE").length,
      effective_active_ads: inventoryAdStatus.filter((item) => item.effective === "ACTIVE").length,
      effective_paused_ads: inventoryAdStatus.filter((item) => item.effective === "PAUSED").length,
      unknown_ads: inventoryAdStatus.filter((item) => item.effective === "UNKNOWN").length,
      all_campaigns_paused: allCampaignsPaused,
      result_comparability: comparable ? "COMPARABLE" : "ACCOUNT_RESULT_NOT_COMPARABLE",
      account_cpr_code: accountCpr === null ? "ACCOUNT_CPR_UNAVAILABLE" : "AVAILABLE",
      object_count_label: `${input.campaigns.length} campaign tersimpan, ${performanceCampaigns.length} punya aktivitas pada periode, ${input.campaigns.length - performanceCampaigns.length} dikecualikan dari ranking.`,
      scope_note: allCampaignsPaused
        ? "Seluruh campaign yang teridentifikasi saat ini berstatus dijeda. Iklan di bawah campaign tersebut tidak dianggap aktif untuk keperluan analisis status operasional."
        : "Ranking dan rekomendasi hanya menggunakan campaign dan iklan yang memiliki aktivitas dalam periode analisis.",
      long_period_warning: input.durationDays > 90
        ? "Periode lebih dari 90 hari adalah agregasi historis. Rentang pilihan pengguna tidak diubah. Evaluasi operasional terbaru sebaiknya memakai 7, 14, atau 30 hari."
        : null,
    },
    account_summary: {
      total_campaigns: input.campaigns.length,
      active_campaigns: activeCampaigns,
      paused_campaigns: pausedCampaigns,
      archived_campaigns: archivedCampaigns,
      total_ads: input.ads.length,
      active_ads: input.ads.filter((item) => statusBucket(item.status) === "active").length,
      paused_ads: input.ads.filter((item) => statusBucket(item.status) === "paused").length,
      total_spend: totalSpend,
      total_results: comparable ? accountResults : null,
      blended_cpr: accountCpr,
      average_ctr: accountAgg.linkCtr,
      total_impressions: accountAgg.impressions,
      total_link_clicks: accountAgg.linkClicks,
      result_label: accountLabel,
      results_comparable: comparable,
      result_breakdown_by_kind: resultBreakdownByKind,
      health_counts: healthCounts,
    },
    campaign_rankings: rankedCampaigns,
    ad_rankings: rankedAds,
    priority_actions: priorityActions,
    budget_analysis: {
      total_spend: totalSpend,
      allocated_budget: null,
      remaining_budget: null,
      allocation_note: "Total belanja akun dijumlahkan sekali dari insight level iklan. Belanja campaign adalah partisi baris yang sama, bukan penjumlahan tambahan.",
      top_spending_campaign: topSpendCampaign
        ? { id: topSpendCampaign.id, name: topSpendCampaign.name, spend: topSpendCampaign.spend, share_pct: topSpendCampaign.spendSharePct ?? 0 }
        : null,
      top_spending_ad: topSpendAd ? { id: topSpendAd.id, name: topSpendAd.name, spend: topSpendAd.spend } : null,
      highest_result_campaign: mostResults && (mostResults.results ?? 0) > 0
        ? { id: mostResults.id, name: mostResults.name, results: mostResults.results || 0 }
        : null,
      most_efficient_campaign: efficient && efficient.cpr !== null
        ? { id: efficient.id, name: efficient.name, cpr: efficient.cpr }
        : null,
      wasted_spend_campaigns: wasted.map((item) => ({ id: item.id, name: item.name, spend: item.spend, results: item.results })),
      spend_by_ad_category: spendByCategory,
    },
    comparison: input.previous
      ? {
          status: "AVAILABLE",
          previous_spend: input.previous.spend,
          previous_results: input.previous.results,
          note: "Perbandingan hanya ditampilkan sekali untuk total akun, pada periode dengan durasi yang sama.",
        }
      : {
          status: "COMPARISON_DATA_UNAVAILABLE",
          previous_spend: null,
          previous_results: null,
          note: "COMPARISON_DATA_UNAVAILABLE",
        },
    key_insights: insights.slice(0, 5),
    recommendations,
    historical_reviews,
    action_plan: actionPlan,
    data_quality: {
      is_complete: !input.insightTruncated && comparable,
      warnings,
      missing_fields: missing,
      canonical_spend_level: "ad",
    },
  };
  return { ...reportWithoutIntelligence, intelligence: buildAdvertisingIntelligence(reportWithoutIntelligence) };
}

function priorityRank(priority: AccountRecommendation["priority"]): number {
  if (priority === "CRITICAL") return 0;
  if (priority === "HIGH") return 1;
  if (priority === "MEDIUM") return 2;
  return 3;
}
