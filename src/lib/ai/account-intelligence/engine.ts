import {
  aggregateAdInsights,
  leadsFromRow,
  messagingFromRow,
  selectPrimaryResult,
  type AdInsightRowLike,
} from "@/lib/ads/aggregation";
import { buildAdvertisingIntelligence, type AdvertisingIntelligence } from "./diagnosis";
import { resolveOperationalStatus, type OperationalStatus } from "./status";

export const RANKING_WEIGHTS = {
  cpr: 0.35,
  volume: 0.25,
  ctr: 0.15,
  cpc: 0.1,
  confidence: 0.15,
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
  minResultsForWinner: 5,
  minResultsForStrong: 3,
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
  | "UNRANKED";
export type AdRankCategory =
  | "WINNER"
  | "STRONG_PERFORMER"
  | "POTENTIAL_WINNER"
  | "NEEDS_OPTIMIZATION"
  | "LOSING"
  | "INSUFFICIENT_DATA"
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
  spendSharePct: number | null;
  target: ResolvedTarget;
  category: CampaignRankCategory;
  score: ScoreBreakdown;
  reason: string;
  action: IntelligenceAction;
  performanceBasis: "active_delivery" | "historical_paused";
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
  target: ResolvedTarget;
  category: AdRankCategory;
  score: ScoreBreakdown;
  reason: string;
  action: IntelligenceAction;
  performanceBasis: "active_delivery" | "historical_paused";
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
  };
  campaign_rankings: RankedCampaign[];
  ad_rankings: RankedAd[];
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

function insufficientSample(input: {
  impressions: number;
  results: number | null;
  spend: number;
  thresholds: RankingThresholds;
}): boolean {
  const results = input.results ?? 0;
  if (results === 0 && input.spend >= input.thresholds.materialZeroResultSpend) return false;
  if (results <= input.thresholds.smallSampleMaxResults && input.spend < input.thresholds.smallSampleMaxSpend) return true;
  if (input.impressions < input.thresholds.minImpressionsToJudge && results < input.thresholds.minResultsForStrong) return true;
  return false;
}

function buildScore(
  metrics: { cpr: number | null; results: number | null; ctr: number | null; cpc: number | null; impressions: number },
  peers: Array<{ cpr: number | null; results: number | null; ctr: number | null; cpc: number | null }>,
  target: number | null,
  thresholds: RankingThresholds
): ScoreBreakdown {
  const cpr = target && metrics.cpr
    ? Math.max(0, Math.min(100, Math.round((target / metrics.cpr) * 70)))
    : lowerBetter(metrics.cpr, peers.map((item) => item.cpr));
  const volume = higherBetter(metrics.results, peers.map((item) => item.results));
  const ctr = higherBetter(metrics.ctr, peers.map((item) => item.ctr));
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

function materialZeroResult(results: number | null, spend: number, impressions: number, thresholds: RankingThresholds): boolean {
  return (results ?? 0) === 0 && spend >= thresholds.materialZeroResultSpend && impressions >= thresholds.minImpressionsToJudge;
}

function campaignCategory(score: number, insufficient: boolean, results: number | null, spend: number, impressions: number, cpr: number | null, target: number | null, peerCount: number, thresholds: RankingThresholds): CampaignRankCategory {
  if (insufficient) return "INSUFFICIENT_DATA";
  if ((results ?? 0) === 0) return materialZeroResult(results, spend, impressions, thresholds) ? "UNDERPERFORMING" : "INSUFFICIENT_DATA";
  if (peerCount < 2) return "UNRANKED";
  if (score >= 78 && (results ?? 0) >= 5 && (target === null || (cpr !== null && cpr <= target))) return "TOP_PERFORMER";
  if (score >= 64) return "EFFICIENT";
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
  const enoughForWinner =
    (results ?? 0) >= thresholds.minResultsForWinner &&
    impressions >= thresholds.minImpressionsForWinner &&
    (target === null || (cpr !== null && cpr <= target));
  if (enoughForWinner && score >= 72) return "WINNER";
  if ((results ?? 0) >= thresholds.minResultsForStrong && score >= 60) return "STRONG_PERFORMER";
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
    return "HISTORICAL_REVIEW";
  }
  return input.activeAction;
}

function campaignAction(category: CampaignRankCategory, paused: boolean, spendShare: number | null): IntelligenceAction {
  if (paused) return "HISTORICAL_REVIEW";
  if (category === "TOP_PERFORMER") return "SCALE";
  if (category === "EFFICIENT" || category === "STABLE") return "MAINTAIN";
  if (category === "UNDERPERFORMING" && (spendShare ?? 0) >= 15) return "REDUCE_BUDGET";
  if (category === "UNDERPERFORMING") return "OPTIMIZE";
  if (category === "NEEDS_OPTIMIZATION") return "OPTIMIZE";
  return "MONITOR";
}

function adAction(category: AdRankCategory, paused: boolean): IntelligenceAction {
  if (paused) return "HISTORICAL_REVIEW";
  if (category === "WINNER") return "SCALE";
  if (category === "STRONG_PERFORMER" || category === "POTENTIAL_WINNER") return "MAINTAIN";
  if (category === "LOSING") return "PAUSE";
  if (category === "NEEDS_OPTIMIZATION") return "OPTIMIZE";
  return "MONITOR";
}

function money(value: number): string {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function recommendationCopy(action: IntelligenceAction, longPeriod: boolean): string {
  if (action === "REACTIVATION_CANDIDATE") {
    return "Histori periode ini lebih efisien daripada target. Data ini tidak membuktikan performa jika objek diaktifkan kembali, dan bukan saran memakai anggaran lama.";
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

export function insightFallsInPeriod(row: AdInsightRowLike, periodStart: string, periodEnd: string): boolean {
  const day = row.date_start ? String(row.date_start).slice(0, 10) : "";
  if (!day) return false;
  if (periodStart && day < periodStart) return false;
  if (periodEnd && day > periodEnd) return false;
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

function metricsOf(rows: AdInsightRowLike[], objective: string | null) {
  const agg = aggregateAdInsights(rows);
  const primary = selectPrimaryResult(agg, objective);
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
    results: primary.count,
    cpr: primary.count && primary.count > 0 ? primary.cost : null,
    resultKind: primary.kind,
    resultLabel: primary.label,
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

  const periodInsights = input.insights.filter((row) => insightFallsInPeriod(row, input.periodStart, input.periodEnd));
  const droppedOutsidePeriod = input.insights.length - periodInsights.length;
  const activeInsights = periodInsights.filter((row) => insightShowsActivity(row));
  if (droppedOutsidePeriod > 0) {
    warnings.push(`${droppedOutsidePeriod} baris insight di luar ${input.periodStart} s/d ${input.periodEnd} tidak dipakai. Data lifetime tidak menggantikan periode ini.`);
  }
  if (input.insights.some((row) => !row.date_start)) {
    warnings.push("Baris insight tanpa tanggal dibuang agar metrik seumur hidup tidak masuk periode.");
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
      const insufficient = insufficientSample({ ...item.metrics, thresholds });
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
        spendSharePct: share,
        target,
        category,
        score,
        reason: `${paused ? "Status operasional dijeda. Angka berikut hanya performa di dalam periode, bukan bukti iklan sedang berjalan. " : ""}${cprText}, hasil ${item.metrics.results ?? 0}, belanja ${money(item.metrics.spend)}, CTR tautan ${item.metrics.ctr ?? "tidak tersedia"}%. ${targetText} Skor ${score.total} (CPR ${score.cpr}, volume ${score.volume}, CTR ${score.ctr}, CPC ${score.cpc}, keyakinan ${score.confidence}).`,
        action,
        performanceBasis: basis,
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
      const insufficient = insufficientSample({ ...metrics, thresholds });
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
      const paused = resolved.effective !== "ACTIVE";
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
        target,
        category,
        score,
        reason: `${resolved.effective === "PAUSED" ? "Status efektif dijeda. Angka ini histori periode, bukan delivery aktif, dan bukan kelayakan aktivasi. " : ""}${metrics.impressions} impresi menghasilkan ${metrics.linkClicks ?? "tidak tersedia"} klik tautan, CTR ${metrics.ctr ?? "tidak tersedia"}%, CPC ${metrics.cpc === null ? "tidak tersedia" : money(metrics.cpc)}, hasil ${metrics.results ?? 0}, CPR ${metrics.cpr === null ? "tidak tersedia" : money(metrics.cpr)}. ${targetText} Isi creative, audience, dan placement tidak ada pada evidence, jadi tidak dinilai.`,
        action,
        performanceBasis: resolved.effective === "ACTIVE" ? "active_delivery" as const : "historical_paused" as const,
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
    },
    campaign_rankings: rankedCampaigns,
    ad_rankings: rankedAds,
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
