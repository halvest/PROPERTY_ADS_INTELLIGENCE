import { NextRequest, NextResponse } from "next/server";
import { finishAiAnalysis, validateIdempotencyKey, reserveAiAnalysis } from "@/lib/ai/usage-quota";
import { z } from "zod";
import { isMetaModelApiConfigured, getMetaConfig } from "@/lib/ai/meta/config";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { createClient } from "@/lib/supabase/server";
import { resolveSessionTenant } from "@/lib/auth/tenant";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { parseDateRange, getEquivalentPreviousPeriod } from "@/lib/ads/date-utils";
import { ACTION_TO_VERDICT_STATUS, CtwaModelOutputSchema } from "@/lib/ai/ctwa-analysis/schema";
import { applyGuardrailsToModelOutput, enforceRecommendedAction } from "@/lib/ai/ctwa-analysis/guardrails";
import {
  aggregateAccountStatus,
  buildContextAwareness,
  classifyPeriodConfidence,
  deliveryStatusLabelId,
  effectiveDeliveryStatus,
  normalizeEntityStatus,
  spentBeyondDoubleTarget,
  type AnalysisScope,
  type EntityDeliveryStatus,
} from "@/lib/ai/ctwa-analysis/dynamic-context";
import { PAGE_ANALYST_SYSTEM_PROMPT } from "@/lib/ai/ctwa-analysis/prompt";
import { buildLlmUserPayload, serializeLlmUserPayload, type LlmPayloadEntity } from "@/lib/ai/llm-user-payload";
import { addReported, finiteNumber } from "@/lib/metrics/nullable-number";
import {
  aggregateAdInsights,
  buildZeroFilledDailyTrends,
  leadsFromRow,
  messagingFromRow,
  selectPrimaryResult,
  type AdInsightRowLike,
} from "@/lib/ads/aggregation";
import { buildAccountIntelligence, type AccountIntelligenceReport } from "@/lib/ai/account-intelligence/engine";
import { buildCrmAnalysisContext, calendarDayBounds, cqplForScope, type CrmAnalysisContext } from "@/lib/crm/crm-analysis-context";
import {
  evaluateAdsPerformance,
  DataSufficiencyStatus,
  PerformanceStatus,
  DecisionAction,
  ResultsCondition,
} from "@/lib/ads/performance-evaluator";

export const AnalyzePerformanceRequestSchema = z.object({
  scope: z.enum(["account", "campaign", "ad"]).default("account"),
  period: z
    .enum(["1d", "3d", "7d", "14d", "30d", "custom", "daily", "weekly", "monthly"])
    .default("30d"),
  targetId: z.string().optional(),
  adAccountId: z.string().optional(),
  dateRange: z.string().optional(),
  customSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetCpr: z.number().positive().optional(),
  locale: z.enum(["id", "en"]).default("id"),
});

export interface PerformanceAnalysisOutput {
  verdict: {
    status: "scale" | "maintain" | "optimize" | "stop";
    headline: string; // maks 12 kata
    subtext: string; // maks 20 kata
    confidence: {
      level: "high" | "medium" | "low";
      reason: string;
    };
  };
  evaluator: {
    data_status: DataSufficiencyStatus;
    data_status_reason: string;
    performance_status: PerformanceStatus;
    action: DecisionAction;
    results_condition: ResultsCondition;
    learning_status: string;
    tracking_status: string;
    timezone: string;
    date_range: { since: string; until: string };
    duration_days: number;
    uncertainty_notes: string[];
    entity_status: EntityDeliveryStatus;
  };
  context_awareness: {
    analyzed_scope: "Account" | "Campaign" | "Ad";
    entity_status: "Active" | "Paused" | "Unknown";
    period_confidence: "High" | "Medium" | "Low";
    period_days: number;
  };
  metrics: Array<{
    key: "spend" | "results" | "cpr" | "ctr";
    label: string;
    value: number | null;
    display: string;
    delta_pct: number | null;
    delta_note: string | null;
    vs_target: "better" | "on_target" | "worse" | "no_target";
    trend_7d: Array<number | null> | null;
  }>;
  extra_metrics: Array<{
    label: string;
    display: string;
    note?: string;
  }>;
  watchouts: Array<{
    severity: "ok" | "warn" | "critical";
    title: string; // maks 6 kata
    insight: string; // 1 kalimat
  }>;
  actions: Array<{
    priority: "high" | "medium" | "low";
    title: string; // maks 8 kata
    why: string; // 1 kalimat berangka
    do: string; // 1 kalimat spesifik
    stop_loss: string; // 1 kalimat
  }>;
  meta: {
    source: string;
    generated_at: string;
    engine: "rules" | "llm";
    period: string;
    scope: string;
    target_cpr: number | null;
    period_days: number;
    entity_status: string;
  };
  account_intelligence?: AccountIntelligenceReport;
  campaign_breakdown?: CampaignHierarchyBreakdown;
  crm_context?: CrmAnalysisContext;
}

export type EfficiencyCategoryCode =
  | "TOP_PERFORMER"
  | "EFFICIENT"
  | "STABLE"
  | "NEEDS_OPTIMIZATION"
  | "UNDERPERFORMING"
  | "INSUFFICIENT_DATA";

export interface RankedCampaignAdSetItem {
  rank: number;
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED";
  adsCount: number;
  activeAdsCount: number;
  spend: number | null;
  spendSharePct: number | null;
  results: number | null;
  resultLabel: string;
  cpr: number | null;
  targetCpr: number | null;
  cprVsTargetPct: number | null;
  ctr: number | null;
  cpc: number | null;
  impressions: number | null;
  linkClicks: number | null;
  score: number;
  category: EfficiencyCategoryCode;
  efficiencyLabel: string;
  actionLabel: string;
  diagnosis: string;
}

export interface RankedCampaignAdItem {
  rank: number;
  id: string;
  providerId: string;
  name: string;
  adsetId: string | null;
  adsetName: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
  effectiveStatus: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | "UNKNOWN";
  spend: number | null;
  spendSharePct: number | null;
  results: number | null;
  resultLabel: string;
  cpr: number | null;
  targetCpr: number | null;
  cprVsTargetPct: number | null;
  ctr: number | null;
  cpc: number | null;
  impressions: number | null;
  linkClicks: number | null;
  score: number;
  category: EfficiencyCategoryCode;
  efficiencyLabel: string;
  actionLabel: string;
  diagnosis: string;
}

export interface CampaignHierarchyBreakdown {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  campaignObjective: string | null;
  totalAdSets: number;
  totalAds: number;
  adsWithDelivery: number;
  efficientAdsCount: number;
  optimizeAdsCount: number;
  underperformingAdsCount: number;
  adset_rankings: RankedCampaignAdSetItem[];
  ad_rankings: RankedCampaignAdItem[];
}

const ModelResponseSchema = z.object({
  executive_verdict: z.object({
    status_badge: z.enum([
      "SEHAT_SIAP_SCALE",
      "STABIL_BUTUH_OPTIMASI",
      "KRITIS_KEBOCORAN",
      "OBSERVASI_DATA_MINIM",
      "DIJEDA_ARSIP_HISTORIS",
    ]),
    headline: z.string(),
    summary: z.string(),
  }),
  data_warnings: z.array(z.string()).default([]),
  watchouts: z
    .array(
      z.object({
        severity: z.enum(["critical", "warning", "info"]),
        layer: z.enum(["meta_ads", "funnel", "crm_quality", "data_integrity"]),
        title: z.string(),
        detail: z.string(),
      })
    )
    .max(4)
    .default([]),
  playbook: z
    .array(
      z.object({
        priority: z.enum(["P0", "P1", "P2"]),
        locked_action: z.string(),
        target_entity: z.string(),
        exact_action: z.string(),
        data_evidence: z.string(),
        evaluation_window: z.string(),
      })
    )
    .max(5)
    .default([]),
  unknowns: z.array(z.string()).default([]),
});

const BADGE_TO_VERDICT_STATUS = {
  SEHAT_SIAP_SCALE: "scale",
  STABIL_BUTUH_OPTIMASI: "optimize",
  KRITIS_KEBOCORAN: "stop",
  OBSERVASI_DATA_MINIM: "maintain",
  DIJEDA_ARSIP_HISTORIS: "maintain",
} as const;

const PLAYBOOK_PRIORITY_TO_ACTION = {
  P0: "high",
  P1: "medium",
  P2: "low",
} as const;

type PageAnalystModel = z.infer<typeof ModelResponseSchema>;

/** Projects the page-analyst JSON onto the dashboard narrative contract. */
export function mapPageAnalystModelToNarrative(model: PageAnalystModel): {
  verdict: PerformanceAnalysisOutput["verdict"];
  watchouts: PerformanceAnalysisOutput["watchouts"];
  actions: PerformanceAnalysisOutput["actions"];
} {
  const status = BADGE_TO_VERDICT_STATUS[model.executive_verdict.status_badge];
  const watchouts: PerformanceAnalysisOutput["watchouts"] = model.watchouts.map((item) => ({
    severity: item.severity === "critical" ? "critical" : item.severity === "warning" ? "warn" : "ok",
    title: item.title,
    insight: item.detail,
  }));
  for (const warning of model.data_warnings) {
    const text = warning.trim();
    if (!text) continue;
    watchouts.push({
      severity: "warn",
      title: "Peringatan Integritas Data",
      insight: text,
    });
  }
  const unknownText = model.unknowns.map((item) => item.trim()).filter(Boolean).join(" ");
  if (unknownText) {
    watchouts.push({
      severity: "ok",
      title: "Perlu Verifikasi Manual",
      insight: unknownText,
    });
  }
  const confidenceLevel: PerformanceAnalysisOutput["verdict"]["confidence"]["level"] =
    model.data_warnings.some((item) => item.trim()) || status === "maintain"
      ? status === "stop"
        ? "medium"
        : "low"
      : status === "scale"
        ? "high"
        : "medium";

  return {
    verdict: {
      status,
      headline: model.executive_verdict.headline,
      subtext: model.executive_verdict.summary,
      confidence: {
        level: confidenceLevel,
        reason: model.data_warnings.find((item) => item.trim())?.trim()
          || "Keputusan aksi mengikuti kunci server, bukan tebakan model.",
      },
    },
    watchouts: watchouts.slice(0, 5),
    actions: model.playbook.slice(0, 5).map((item) => ({
      priority: PLAYBOOK_PRIORITY_TO_ACTION[item.priority],
      title: `${item.locked_action} · ${item.target_entity}`,
      why: item.data_evidence,
      do: item.exact_action,
      stop_loss: item.evaluation_window,
    })),
  };
}

/** Keeps the required space after Rp and Indonesian percent decimals. */
export function normalizeIndonesianLlmCopy(text: string): string {
  return text
    .replace(/Rp(?=\d)/g, "Rp ")
    .replace(/(\d+)\.(\d{1,2})(?=%)/g, "$1,$2");
}

function normalizeNarrativeTree<T>(value: T): T {
  if (typeof value === "string") return normalizeIndonesianLlmCopy(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeNarrativeTree(item)) as T;
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) next[key] = normalizeNarrativeTree(child);
    return next as T;
  }
  return value;
}

function formatRp(amount: number | null | undefined, _loc: "id" | "en" = "id"): string {
  void _loc;
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "Tidak tersedia";
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(amount))}`;
}

function formatPct(value: number | null | undefined, _loc: "id" | "en" = "id"): string {
  void _loc;
  if (value === null || value === undefined || !Number.isFinite(value)) return "Tidak tersedia";
  return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

function formatFreq(value: number | null | undefined, _loc: "id" | "en" = "id"): string {
  void _loc;
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "Tidak tersedia";
  return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}x`;
}

function forceIndonesianOutputLocale(_requestedLocale: "id" | "en"): "id" | "en" {
  void _requestedLocale;
  return "id";
}

function parseModelJson(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  const parsed = JSON.parse(cleaned);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    if ("executive_verdict" in record || "verdict" in record) return record;
    const nested = [record.data, record.analysis];
    for (const candidate of nested) {
      if (candidate && typeof candidate === "object" && ("executive_verdict" in (candidate as Record<string, unknown>) || "verdict" in (candidate as Record<string, unknown>))) {
        return candidate;
      }
    }
  }
  return parsed;
}

export function cleanEntityName(raw?: string | null): string {
  if (!raw) return "";
  let name = raw.trim();

  name = name
    .replace(/^Postingan Instagram:\s*/i, "IG Post · ")
    .replace(/^Instagram post:\s*/i, "IG Post · ")
    .replace(/^Postingan Facebook:\s*/i, "FB Post · ")
    .replace(/^Facebook post:\s*/i, "FB Post · ")
    .replace(/^Postingan:\s*/i, "Post · ");

  name = name.replace(/^["'“”«»]\s*/, "").replace(/\s*["'“”«»]$/, "");
  name = name.replace(/^(IG Post · |FB Post · |Post · )["'“”«»]/, "$1").replace(/["'“”«»]$/, "");
  name = name.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");
  name = name.replace(/\s+/g, " ").trim();

  return name || raw;
}

export function formatIndoDateRange(sinceStr?: string | null, untilStr?: string | null, loc: "id" | "en" = "id"): string {
  if (!sinceStr || !untilStr) return loc === "id" ? "Periode Terkini" : "Current Period";
  try {
    const sDate = new Date(`${sinceStr}T00:00:00Z`);
    const uDate = new Date(`${untilStr}T00:00:00Z`);
    const sDay = sDate.getUTCDate();
    const uDay = uDate.getUTCDate();
    const intlLoc = loc === "en" ? "en-US" : "id-ID";
    const sMonth = sDate.toLocaleDateString(intlLoc, { month: "short", timeZone: "UTC" });
    const uMonth = uDate.toLocaleDateString(intlLoc, { month: "short", timeZone: "UTC" });
    const uYear = uDate.getUTCFullYear();

    if (sinceStr === untilStr) {
      return loc === "id" ? `${uDay} ${uMonth} ${uYear}` : `${uMonth} ${uDay}, ${uYear}`;
    }
    if (sMonth === uMonth) {
      return loc === "id" ? `${sDay}–${uDay} ${uMonth} ${uYear}` : `${sMonth} ${sDay}–${uDay}, ${uYear}`;
    }
    return loc === "id" ? `${sDay} ${sMonth} – ${uDay} ${uMonth} ${uYear}` : `${sMonth} ${sDay} – ${uMonth} ${uDay}, ${uYear}`;
  } catch {
    return `${sinceStr} – ${untilStr}`;
  }
}

/**
 * Builds deterministic rule-based analysis adhering to Senior Property Strategist guidelines.
 */
function buildDeterministicAnalysis(params: {
  targetName: string;
  scope: "account" | "campaign" | "ad";
  period: string;
  periodLabel: string;
  dateRange: { since: string; until: string };
  durationDays: number;
  timezone: string;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  linkClicks: number | null;
  linkCtr: number | null;
  linkCpc: number | null;
  cpm: number | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  allClicks: number | null;
  allCtr: number | null;
  allCpc: number | null;
  prevSpend: number | null;
  prevResults: number | null;
  prevCpr: number | null;
  prevLinkCtr: number | null;
  targetCpr: number | null;
  trends: {
    spend: Array<number | null>;
    results: Array<number | null>;
    cpr: Array<number | null>;
    ctr: Array<number | null>;
  };
  locale?: "id" | "en";
  entityStatus?: EntityDeliveryStatus;
  resultLabel?: string;
  linkCtrForDiagnosis?: number | null;
}): PerformanceAnalysisOutput {
  const {
    periodLabel,
    spend,
    results,
    costPerResult,
    linkCtr,
    linkCpc,
    cpm,
    impressions,
    reach,
    frequency,
    allClicks,
    allCtr,
    allCpc,
    prevSpend,
    prevResults,
    prevCpr,
    prevLinkCtr,
    targetCpr,
    trends,
    scope,
    durationDays,
    timezone,
    dateRange,
    locale = "id",
    entityStatus = "UNKNOWN",
    resultLabel = "Hasil Konversi",
    linkCtrForDiagnosis = linkCtr,
  } = params;

  // This analyst currently ships Indonesian-only copy and number formatting.
  const loc = locale;

  // Run deterministic Senior Meta Ads Intelligence Evaluator engine
  const evalResult = evaluateAdsPerformance({
    period: params.period,
    durationDays,
    spend,
    results,
    reportedCpr: costPerResult,
    targetCpr,
    linkClicks: params.linkClicks,
    impressions,
    reach: reach ?? undefined,
    frequency,
    prevSpend,
    prevResults,
    prevCpr,
    locale: loc,
    entityStatus,
    analysisScope: scope,
    linkCtr: linkCtrForDiagnosis,
  });

  // Evaluator metadata payload for frontend display
  const evaluator: PerformanceAnalysisOutput["evaluator"] = {
    data_status: evalResult.dataStatus,
    data_status_reason: evalResult.dataStatusReason,
    performance_status: evalResult.performanceStatus,
    action: evalResult.action,
    results_condition: evalResult.resultsCondition,
    learning_status: evalResult.learningStatus,
    tracking_status: evalResult.trackingStatusDisplay,
    timezone,
    date_range: dateRange,
    duration_days: durationDays,
    uncertainty_notes: evalResult.uncertaintyNotes,
    entity_status: evalResult.entityStatus,
  };

  // Map action to verdict status
  let verdictStatus: "scale" | "maintain" | "optimize" | "stop" = "maintain";
  if (evalResult.action === "hentikan_sementara") {
    verdictStatus = "stop";
  } else if (
    evalResult.action === "optimasi" ||
    evalResult.action === "periksa_tracking" ||
    evalResult.action === "kurangi"
  ) {
    verdictStatus = "optimize";
  } else if (evalResult.action === "reaktivasi") {
    verdictStatus = "maintain";
  } else if (evalResult.scaleEligible) {
    verdictStatus = "scale";
  } else {
    verdictStatus = "maintain";
  }

  if (durationDays <= 3 && (verdictStatus === "stop" || verdictStatus === "scale")) {
    verdictStatus = "maintain";
  }

  const periodConfidence = classifyPeriodConfidence(durationDays);
  const doubleBurn = spentBeyondDoubleTarget(spend, targetCpr, results);
  const confidenceLevel: "high" | "medium" | "low" =
    durationDays <= 3
      ? doubleBurn
        ? "medium"
        : "low"
      : periodConfidence === "high" && evalResult.dataStatus === "cukup"
        ? "high"
        : evalResult.dataStatus === "tidak_valid"
          ? "low"
          : "medium";

  const contextAwareness = buildContextAwareness({
    scope,
    entityStatus: evalResult.entityStatus,
    durationDays,
  });

  // Safe CTR comparison
  let ctrDeltaPct: number | null = null;
  let ctrDeltaNote: string | null = "Belum ada data di periode pembanding";
  if (linkCtr !== null && prevLinkCtr !== null && prevLinkCtr > 0) {
    ctrDeltaPct = Number((((linkCtr - prevLinkCtr) / prevLinkCtr) * 100).toFixed(1));
    ctrDeltaNote = `${ctrDeltaPct >= 0 ? "+" : ""}${formatPct(ctrDeltaPct, loc)}`;
  } else if (prevLinkCtr === 0) {
    ctrDeltaNote = "Belum ada data di periode pembanding";
  }

  const cprVsTarget = !targetCpr
    ? "no_target"
    : evalResult.actualCpr === null
    ? "no_target"
    : evalResult.actualCpr <= targetCpr * 0.9
    ? "better"
    : evalResult.actualCpr <= targetCpr * 1.1
    ? "on_target"
    : "worse";

  const ctrVsTarget = "no_target" as const;

  const metrics: PerformanceAnalysisOutput["metrics"] = [
    {
      key: "spend",
      label: "Total Belanja",
      value: spend,
      display: formatRp(spend, loc),
      delta_pct: evalResult.comparisons.spend.percentageDelta,
      delta_note: evalResult.comparisons.spend.displayDelta,
      vs_target: "no_target",
      trend_7d: trends.spend.length > 0 ? trends.spend : null,
    },
    {
      key: "results",
      label: resultLabel,
      value: results,
      display: results == null ? "Tidak tersedia" : results.toLocaleString("id-ID"),
      delta_pct: evalResult.comparisons.results.percentageDelta,
      delta_note: evalResult.comparisons.results.displayDelta,
      vs_target: "no_target",
      trend_7d: trends.results.length > 0 ? trends.results : null,
    },
    {
      key: "cpr",
      label: "Biaya per Hasil (CPR)",
      value: evalResult.actualCpr,
      display: evalResult.actualCpr !== null ? formatRp(evalResult.actualCpr, loc) : (loc === "id" ? "Tidak tersedia" : "Unavailable"),
      delta_pct: evalResult.comparisons.cpr.percentageDelta,
      delta_note: evalResult.comparisons.cpr.displayDelta,
      vs_target: cprVsTarget,
      trend_7d: trends.cpr.length > 0 ? trends.cpr : null,
    },
    {
      key: "ctr",
      label: "CTR Tautan",
      value: linkCtr,
      display: formatPct(linkCtr, loc),
      delta_pct: ctrDeltaPct,
      delta_note: ctrDeltaNote,
      vs_target: ctrVsTarget,
      trend_7d: trends.ctr.length > 0 ? trends.ctr : null,
    },
  ];

  // Extra Metrics for Accordion
  const extra_metrics: PerformanceAnalysisOutput["extra_metrics"] = [
    {
      label: "Frekuensi",
      display: formatFreq(frequency, loc),
      note: "Rata-rata tayangan per orang",
    },
    {
      label: loc === "id" ? "CPC Tautan" : "Link CPC",
      display: formatRp(linkCpc, loc),
      note: "Biaya rata-rata per klik tautan",
    },
    {
      label: "CPM",
      display: formatRp(cpm, loc),
      note: "Biaya per 1.000 tayangan",
    },
    {
      label: "Jangkauan Unik",
      display: reach !== null ? reach.toLocaleString("id-ID") : "Tidak tersedia",
      note: "Tidak dijumlahkan lintas hari",
    },
    {
      label: "Total Tayangan",
      display: impressions == null ? "Tidak tersedia" : impressions.toLocaleString("id-ID"),
      note: "Jumlah iklan ditampilkan",
    },
    {
      label: "Semua Klik (Interaksi)",
      display: allClicks == null ? "Tidak tersedia" : allClicks.toLocaleString("id-ID"),
      note: `CTR ${formatPct(allCtr, loc)} · CPC ${formatRp(allCpc, loc)}`,
    },
  ];

  // Watchouts: Incorporate uncertaintyNotes or performance warnings
  const watchouts: PerformanceAnalysisOutput["watchouts"] = [];

  if (durationDays > 60) {
    watchouts.push({
      severity: "warn",
      title: `Rentang Evaluasi Sangat Panjang (${durationDays} Hari)`,
      insight: "Data ini menggabungkan performa historis jangka panjang. Untuk keputusan optimasi anggaran harian atau menghentikan iklan yang sedang aktif, gunakan filter 7 atau 14 Hari Terakhir.",
    });
  }

  evalResult.uncertaintyNotes.forEach((note) => {
    watchouts.push({
      severity: evalResult.dataStatus === "tidak_valid" ? "critical" : "warn",
      title: loc === "id" ? "Catatan Batasan Data" : "Data Limitation Note",
      insight: note,
    });
  });

  for (const diagnostic of [...evalResult.causalDiagnostics].reverse()) {
    watchouts.unshift({
      severity: "warn",
      title: diagnostic.title,
      insight: diagnostic.insight,
    });
  }

  if (linkCtr !== null && linkCtr < 0.6 && !evalResult.causalDiagnostics.some((item) => item.code === "creative_hook")) {
    watchouts.push({
      severity: "warn",
      title: loc === "id" ? `CTR ${formatPct(linkCtr, loc)} — di bawah standar` : `CTR ${formatPct(linkCtr, loc)} — below benchmark`,
      insight: loc === "id"
        ? "CTR tautan berada di bawah 0,6%. Bandingkan dengan iklan sejenis. Penyebab belum dapat dipastikan tanpa data creative, audience, dan placement."
        : "Link CTR is below 0.6%. Compare it with similar ads. The cause is not established without creative, audience, and placement data.",
    });
  }

  if (frequency !== null && frequency >= 2.5) {
    watchouts.push({
      severity: "critical",
      title: loc === "id" ? `Frekuensi ${formatFreq(frequency, loc)} — jenuh (fatigue)` : `Frequency ${formatFreq(frequency, loc)} — creative fatigue`,
      insight: loc === "id"
        ? "Audiens jenuh dan risiko kenaikan CPR meningkat. Siapkan materi baru."
        : "Audience fatigue reached; CPR spike risk is elevated. Prepare new creatives.",
    });
  }

  const pausedDelivery = evalResult.entityStatus === "PAUSED" || evalResult.entityStatus === "ARCHIVED";
  if (pausedDelivery && impressions === 0) {
    watchouts.unshift({
      severity: "warn",
      title: "Penayangan Sedang Dijeda",
      insight: "Tidak ada tayangan maupun pembelanjaan anggaran pada periode ini karena status objek sedang dijeda.",
    });
  } else if (pausedDelivery && impressions != null && impressions > 0) {
    watchouts.unshift({
      severity: "ok",
      title: "Data Historis Pasca-Jeda",
      insight: "Metrik yang ditampilkan berasal dari riwayat tayangan sebelum objek dijeda.",
    });
  } else if (impressions === 0) {
    watchouts.unshift({
      severity: "warn",
      title: "Belum Ada Distribusi Tayangan",
      insight: "Objek berstatus aktif tetapi belum mencatat impresi pada periode ini. Periksa batas anggaran, jadwal tayang, atau kesegaran sinkronisasi Meta.",
    });
  } else if (spend === 0) {
    watchouts.unshift({
      severity: "warn",
      title: "Belum Ada Pembelanjaan",
      insight: "Belum ada pembelanjaan tercatat pada periode ini.",
    });
  } else if (watchouts.length === 0) {
    watchouts.push({
      severity: "ok",
      title: "Distribusi Tayangan Stabil",
      insight: "Tidak ditemukan kendala teknis pada pengiriman iklan di periode ini.",
    });
  }

  return {
    verdict: {
      status: verdictStatus,
      headline: evalResult.headline,
      subtext: evalResult.subtext,
      confidence: {
        level: confidenceLevel,
        reason: evalResult.dataStatusReason,
      },
    },
    evaluator,
    metrics,
    extra_metrics,
    watchouts: watchouts.slice(0, 3),
    actions: evalResult.nextActions.slice(0, 3),
    context_awareness: contextAwareness,
    meta: {
      source: "Meta Ads Insights (Snapshot Tersinkron)",
      generated_at: new Date().toISOString(),
      engine: "rules",
      period: periodLabel,
      scope,
      target_cpr: targetCpr,
      period_days: durationDays,
      entity_status: deliveryStatusLabelId(evalResult.entityStatus),
    },
  };
}

export async function POST(req: NextRequest) {
  let quotaReservation: { userId: string; reservationId: string } | null = null;
  try {
    const rl = checkRateLimit(rateLimitKey(req, "ai-analyze-performance"), 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak permintaan analisis.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
    // 1. Authenticate & Resolve Organization ID (supports Cookie & Bearer Token)
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const supabase = await createClient();
    const { user, organizationId } = await resolveSessionTenant(supabase, bearerToken);

    if (!user || !organizationId) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi atau organisasi tidak ditemukan", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const db = supabase;

    // 2. Fetch Ad Account Context
    const { data: adAccount } = await db
      .from("ad_accounts")
      .select("account_name, currency, timezone")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const timezone = adAccount?.timezone || "Asia/Jakarta";

    // 3. Parse Request Payload
    const body = await req.json().catch(() => ({}));
    const parseResult = AnalyzePerformanceRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Payload permintaan tidak valid",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { scope, period, targetId, adAccountId, dateRange, customSince, customUntil, targetCpr } = parseResult.data;
    const locale = forceIndonesianOutputLocale(parseResult.data.locale);


    // 3b. Resolve the validated ad-account context. Metrics must never mix
    // accounts: when an account is specified it must belong to this tenant,
    // and its campaigns bound every scope (including whole-account analysis).
    let accountCampaignIds: string[] | null = null;
    let accountName: string | null = adAccount?.account_name || null;
    if (adAccountId) {
      const norm = (v: string) => (v.startsWith("act_") ? v : `act_${v}`);
      const { data: accRow } = await db
        .from("ad_accounts")
        .select("id, provider_account_id, account_name, connection_status")
        .eq("organization_id", organizationId)
        .eq("provider_account_id", norm(adAccountId))
        .maybeSingle();
      if (!accRow) {
        return NextResponse.json(
          { success: false, error: "Akun iklan tidak termasuk milik organisasi ini.", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
      accountName = accRow.account_name || accountName;
      const { data: accCampaigns } = await db
        .from("campaigns")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("ad_account_id", accRow.id);
      accountCampaignIds = (accCampaigns || []).map((c) => c.id);
    }

    // 4. Resolve Effective Date Range for Chosen Period (Section B specifications)
    let since: string | undefined;
    let until: string | undefined;

    if (period === "custom" && customSince && customUntil) {
      since = customSince;
      until = customUntil;
    } else {
      let effectiveRangeKey = dateRange || "30d";
      if (period === "1d" || period === "daily") {
        effectiveRangeKey = "1d";
      } else if (period === "3d") {
        effectiveRangeKey = "3d";
      } else if (period === "7d" || period === "weekly") {
        effectiveRangeKey = "7d";
      } else if (period === "14d") {
        effectiveRangeKey = "14d";
      } else if (period === "30d" || period === "monthly") {
        effectiveRangeKey = "30d";
      } else if (dateRange) {
        effectiveRangeKey = dateRange;
      }
      const range = parseDateRange(effectiveRangeKey, timezone);
      since = range.since;
      until = range.until;
    }

    // Calculate duration in days
    let durationDays = 7;
    if (since && until) {
      const sMs = new Date(`${since}T00:00:00Z`).getTime();
      const uMs = new Date(`${until}T00:00:00Z`).getTime();
      durationDays = Math.max(1, Math.round((uMs - sMs) / 86400000) + 1);
    }

    // Calculate Equivalent Previous Period (exact same duration)
    const prevRange = since && until ? getEquivalentPreviousPeriod(since, until) : null;
    const prevSince: string | null = prevRange?.prevSince || null;
    const prevUntil: string | null = prevRange?.prevUntil || null;

    // 5. Resolve Target Scope Entities
    let targetName = cleanEntityName(adAccount?.account_name) || "Seluruh Akun";
    let targetAdIds: string[] = [];
    let targetObjective: string | null = null;
    let entityStatus: EntityDeliveryStatus = "UNKNOWN";
    const analysisScope: AnalysisScope = scope;
    let crmScopeCampaignId: string | null = scope === "campaign" ? targetId || null : null;
    const crmScopeAdId: string | null = scope === "ad" ? targetId || null : null;
    let scopedCampaignRow: { id: string; name: string; objective: string | null; status: string | null; provider_campaign_id: string | null } | null = null;
    let scopedCampaignAds: Array<{ id: string; name: string; status: string | null; provider_ad_id: string; campaign_id: string }> = [];

    if (scope === "campaign") {
      if (!targetId) {
        return NextResponse.json(
          { success: false, error: "Campaign ID wajib disertakan untuk cakupan per-campaign" },
          { status: 400 }
        );
      }

      const { data: campaign } = await db
        .from("campaigns")
        .select("id, name, objective, status, provider_campaign_id")
        .eq("organization_id", organizationId)
        .eq("id", targetId)
        .maybeSingle();

      if (!campaign || (accountCampaignIds && !accountCampaignIds.includes(campaign.id))) {
        return NextResponse.json(
          { success: false, error: "Campaign tidak ditemukan atau tidak memiliki hak akses" },
          { status: 404 }
        );
      }

      scopedCampaignRow = campaign;
      targetName = cleanEntityName(campaign.name);
      targetObjective = campaign.objective;
      entityStatus = normalizeEntityStatus(campaign.status);

      const { data: adsInCmp } = await db
        .from("ads")
        .select("id, name, status, provider_ad_id, campaign_id")
        .eq("organization_id", organizationId)
        .eq("campaign_id", targetId);

      scopedCampaignAds = (adsInCmp || []).map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        provider_ad_id: a.provider_ad_id || a.id,
        campaign_id: a.campaign_id,
      }));
      targetAdIds = scopedCampaignAds.map((a) => a.id);
    } else if (scope === "ad") {
      if (!targetId) {
        return NextResponse.json(
          { success: false, error: "Ad ID wajib disertakan untuk cakupan per-iklan" },
          { status: 400 }
        );
      }

      const { data: adRow } = await db
        .from("ads")
        .select("id, name, status, campaign_id, campaigns(name, objective, status)")
        .eq("organization_id", organizationId)
        .eq("id", targetId)
        .maybeSingle();

      if (
        !adRow ||
        (accountCampaignIds && !accountCampaignIds.includes(adRow.campaign_id))
      ) {
        return NextResponse.json(
          { success: false, error: "Iklan tidak ditemukan atau tidak memiliki hak akses" },
          { status: 404 }
        );
      }

      targetName = cleanEntityName(adRow.name);
      targetAdIds = [adRow.id];
      crmScopeCampaignId = adRow.campaign_id;
      const cmp = adRow.campaigns as { name?: string; objective?: string; status?: string } | null;
      targetObjective = cmp?.objective || null;
      entityStatus = effectiveDeliveryStatus(adRow.status, cmp?.status);
    } else {
      // Entire Account (restricted to the validated account's campaigns)
      let allAdsQuery = db
        .from("ads")
        .select("id")
        .eq("organization_id", organizationId);
      if (accountCampaignIds) {
        allAdsQuery = accountCampaignIds.length
          ? allAdsQuery.in("campaign_id", accountCampaignIds)
          : allAdsQuery.eq("campaign_id", "00000000-0000-0000-0000-000000000000");
      }
      const { data: allAds } = await allAdsQuery;
      targetAdIds = (allAds || []).map((a) => a.id);
      if (accountName) targetName = cleanEntityName(accountName) || targetName;
      if (accountCampaignIds) {
        const { data: scopedCampaigns } = await db
          .from("campaigns")
          .select("status")
          .eq("organization_id", organizationId)
          .in("id", accountCampaignIds.length ? accountCampaignIds : ["00000000-0000-0000-0000-000000000000"]);
        entityStatus = aggregateAccountStatus((scopedCampaigns || []).map((c) => c.status));
      } else {
        const { data: orgCampaigns } = await db
          .from("campaigns")
          .select("status")
          .eq("organization_id", organizationId);
        entityStatus = aggregateAccountStatus((orgCampaigns || []).map((c) => c.status));
      }
    }

    // 6. Fetch Insights from Database
    let currentInsights: Array<{
      ad_id?: string | null;
      adset_id?: string | null;
      adset_name?: string | null;
      spend: number | null;
      impressions: number | null;
      clicks: number | null;
      reach: number | null;
      link_clicks: number | null;
      conversions: number | null;
      action_breakdown?: unknown;
      conversion_action_type?: string | null;
      date_start: string | null;
    }> = [];
    let insightTruncated = false;

    // Only query if entire account OR we have matching ads for the entity
    const accountHasNoCampaigns = scope === "account" && accountCampaignIds !== null && accountCampaignIds.length === 0;
    if (!accountHasNoCampaigns && (scope === "account" || targetAdIds.length > 0)) {
      const loaded = await loadInsightPages(db, {
        organizationId,
        adIds: targetAdIds,
        since,
        until,
      });
      if (loaded.error) {
        return NextResponse.json(
          { success: false, error: "Gagal membaca insight iklan dari basis data" },
          { status: 500 }
        );
      }
      currentInsights = loaded.rows;
      insightTruncated = loaded.truncated;
    }

    // Previous Insights
    let prevInsights: AdInsightRowLike[] = [];

    if (prevSince && prevUntil && (scope === "account" || targetAdIds.length > 0)) {
      const loadedPrevious = await loadInsightPages(db, {
        organizationId,
        adIds: targetAdIds,
        since: prevSince,
        until: prevUntil,
      });
      if (!loadedPrevious.error) {
        prevInsights = loadedPrevious.rows.map((row) => ({
          spend: finiteNumber(row.spend),
          impressions: finiteNumber(row.impressions),
          clicks: finiteNumber(row.clicks),
          reach: finiteNumber(row.reach),
          link_clicks: finiteNumber(row.link_clicks),
          conversions: finiteNumber(row.conversions),
          date_start: row.date_start,
        }));
      }
    }

    // 7. Aggregate Current Metrics & Daily Trends.
    // Totals come from the SHARED aggregation (AI-02) so this endpoint can
    // never disagree with the dashboard; the daily map only feeds trends.
    const currAgg = aggregateAdInsights(currentInsights || []);
    const currSpend = currAgg.spend;
    const currImpressions = currAgg.impressions;
    const currClicks = currAgg.allClicks;
    const currReach = currAgg.reach;
    const currLinkClicks = currAgg.linkClicks;
    const primaryResult = selectPrimaryResult(currAgg, targetObjective);
    const currResults = primaryResult.count ?? currAgg.results;
    const decisionCpr = primaryResult.kind === "legacy" ? currAgg.costPerResult : primaryResult.cost;

    const currLinkCtr = currAgg.linkCtr;
    const currLinkCpc = currAgg.linkCpc;
    const currAllCtr = currAgg.allCtr;
    const currAllCpc = currAgg.allCpc;
    const currCpm = currAgg.cpm;
    const currCpr = decisionCpr;
    const currFrequency = currAgg.frequency;

    const resultOfDay = (row: AdInsightRowLike) => {
      if (primaryResult.kind === "messaging") return messagingFromRow(row);
      if (primaryResult.kind === "leads") return leadsFromRow(row);
      return finiteNumber(row.conversions);
    };
    const filledTrends = since && until
      ? buildZeroFilledDailyTrends(currentInsights, since, until, resultOfDay)
      : { spend: [] as number[], results: [] as number[], cpr: [] as number[], ctr: [] as number[] };
    const trendSpend = filledTrends.spend;
    const trendResults = filledTrends.results;
    const trendCpr = filledTrends.cpr;
    const trendCtr = filledTrends.ctr;

    // 8. Aggregate Previous Metrics (same shared aggregation)
    const prevAgg = aggregateAdInsights(prevInsights || []);
    const prevSpend = prevAgg.spend;
    const prevResults = prevAgg.results;
    const prevImpressions = prevAgg.impressions;
    const prevLinkClicks = prevAgg.linkClicks;

    const prevCpr = prevAgg.costPerResult;
    const prevLinkCtr = prevImpressions != null && prevImpressions > 0 && prevLinkClicks != null ? Number(((prevLinkClicks / prevImpressions) * 100).toFixed(2)) : null;
    const periodName =
      period === "1d" || period === "daily"
        ? "1 Hari (Pemantauan)"
        : period === "3d"
        ? "3 Hari (Diagnostik Awal)"
        : period === "7d" || period === "weekly"
        ? "7 Hari (Evaluasi Rutin)"
        : period === "14d"
        ? "14 Hari (Evaluasi Mendalam)"
        : period === "30d" || period === "monthly"
        ? "30 Hari (Evaluasi Bisnis)"
        : "Rentang Kustom";
    const dateRangeFormatted = formatIndoDateRange(since, until, locale);
    const periodLabel = `${periodName} · ${dateRangeFormatted}`;

    const deterministicParams = {
      targetName,
      scope,
      period,
      periodLabel,
      dateRange: { since: since || "", until: until || "" },
      durationDays,
      timezone,
      spend: currSpend,
      results: currResults,
      costPerResult: currCpr,
      resultLabel: primaryResult.label,
      linkClicks: currLinkClicks,
      linkCtr: currLinkCtr,
      linkCpc: currLinkCpc,
      cpm: currCpm,
      impressions: currImpressions,
      reach: currReach,
      frequency: currFrequency,
      allClicks: currClicks,
      allCtr: currAllCtr,
      allCpc: currAllCpc,
      prevSpend,
      prevResults,
      prevCpr,
      prevLinkCtr,
      targetCpr: targetCpr ?? null,
      trends: {
        spend: trendSpend,
        results: trendResults,
        cpr: trendCpr,
        ctr: trendCtr,
      },
      locale,
      entityStatus,
    };

    // Calculate deterministic analysis first as ground truth
    const deterministicOutput = buildDeterministicAnalysis(deterministicParams);
    const crmBounds = calendarDayBounds(since, until);
    let crmRowsQuery = db
      .from("conversations")
      .select("id, ad_id, campaign_id, attribution_status, quality_label, channel, attribution_evidence")
      .eq("organization_id", organizationId)
      .in("channel", ["crm_upload", "whatsapp"])
      .limit(2000);
    if (crmBounds.start) crmRowsQuery = crmRowsQuery.gte("started_at", crmBounds.start);
    if (crmBounds.end) crmRowsQuery = crmRowsQuery.lte("started_at", crmBounds.end);
    const crmRowsResult = await crmRowsQuery;
    let providerAdSetId: string | null = null;
    if (scope === "ad" && crmScopeAdId) {
      const { data: adSetInsight } = await db
        .from("ad_insights")
        .select("adset_id")
        .eq("organization_id", organizationId)
        .eq("ad_id", crmScopeAdId)
        .limit(1)
        .maybeSingle();
      providerAdSetId = adSetInsight?.adset_id || null;
    }
    const crmContext = buildCrmAnalysisContext(
      crmRowsResult.error
        ? null
        : (crmRowsResult.data || []).map((row) => {
            const evidence = row.attribution_evidence;
            const evidenceObject = evidence && typeof evidence === "object" && !Array.isArray(evidence) ? evidence : null;
            return {
              id: row.id,
              ad_id: row.ad_id,
              campaign_id: row.campaign_id,
              attribution_status: row.attribution_status,
              quality_label: row.quality_label,
              channel: row.channel,
              attribution_evidence: {
                funnel_stage: evidenceObject && typeof evidenceObject.funnel_stage === "string" ? evidenceObject.funnel_stage : null,
                provider_adset_id: evidenceObject && typeof evidenceObject.provider_adset_id === "string" ? evidenceObject.provider_adset_id : null,
              },
            };
          }),
      {
        failed: Boolean(crmRowsResult.error),
        truncated: !crmRowsResult.error && (crmRowsResult.data || []).length >= 2000,
        organizationId,
        since,
        until,
        scope: scope === "ad" ? "ad" : scope === "campaign" ? "campaign" : "workspace",
        campaignId: crmScopeCampaignId,
        adId: crmScopeAdId,
        providerAdSetId,
        spend: currSpend,
      }
    );
    deterministicOutput.crm_context = crmContext;
    deterministicOutput.extra_metrics.push(
      {
        label: "Prospek CRM",
        display: crmContext.availability === "error" ? "Tidak tersedia" : `${crmContext.workspaceRecords.value ?? 0}`,
        note: `Workspace pada periode. Cakupan ${crmContext.scope}: ${crmContext.totalRecords.value ?? "tidak tersedia"}.`,
      },
      {
        label: "Atribusi CRM",
        display: crmContext.availability === "error"
          ? "Tidak tersedia"
          : `${crmContext.attribution.directAd.value ?? 0} langsung · ${crmContext.attribution.campaign.value ?? 0} kampanye`,
        note: "Catatan yang tertaut ke iklan adalah tindak lanjut chat iklan itu. Catatan tanpa iklan tetap di tingkat kampanye bila kampanye punya lebih dari satu iklan.",
      },
      {
        label: "Qualified Leads",
        display: crmContext.qualifiedLeads.value === null ? "Data tidak tersedia" : String(crmContext.qualifiedLeads.value),
        note: "Qualified Lead = Hot + Warm pada cakupan ini. Cold tidak dihitung.",
      },
      {
        label: "CQPL",
        display: cqplForScope(crmContext).status === "available" && cqplForScope(crmContext).value !== null
          ? formatRp(cqplForScope(crmContext).value, locale)
          : cqplForScope(crmContext).message,
        note: cqplForScope(crmContext).message || "Spend dibagi qualified lead pada cakupan dan periode yang sama.",
      }
    );

    if (currAgg.messagingConversations !== null) {
      deterministicOutput.extra_metrics.push({
        label: "Percakapan Pesan",
        display: currAgg.messagingConversations.toLocaleString("id-ID"),
        note: `Percakapan Messaging: chat yang Meta laporkan dari iklan CTWA. Biaya per percakapan: ${formatRp(currAgg.costPerMessagingConversation, locale)}. Angka ini tidak sama dengan catatan CRM.`,
      });
    }

    if (scope === "account") {
      const roster = await loadAccountRoster(db, organizationId, accountCampaignIds);
      deterministicOutput.account_intelligence = buildAccountIntelligence({
        accountId: adAccountId || null,
        accountName: targetName,
        currency: adAccount?.currency || "IDR",
        timezone,
        periodStart: since || "",
        periodEnd: until || "",
        durationDays,
        accountCampaignTargetCpr: targetCpr ?? null,
        campaigns: roster.campaigns,
        ads: roster.ads,
        insights: currentInsights.flatMap((row) => row.ad_id ? [{ ...row, ad_id: row.ad_id }] : []),
        previous: prevInsights.length > 0 ? { spend: prevSpend, results: prevResults } : null,
        insightTruncated,
      });
      applyAccountPortfolioIntelligence(
        deterministicOutput,
        deterministicOutput.account_intelligence,
        targetCpr ?? null,
        durationDays,
        locale
      );
    } else if (scope === "campaign" && scopedCampaignRow) {
      deterministicOutput.campaign_breakdown = buildCampaignHierarchyBreakdown({
        campaign: scopedCampaignRow,
        ads: scopedCampaignAds,
        insights: currentInsights,
        currency: adAccount?.currency || "IDR",
        timezone,
        periodStart: since || "",
        periodEnd: until || "",
        durationDays,
        targetCpr: targetCpr ?? null,
        resultLabel: primaryResult.label,
      });
      applyCampaignHierarchyIntelligence(
        deterministicOutput,
        deterministicOutput.campaign_breakdown,
        targetName,
        targetCpr ?? null,
        durationDays,
        locale
      );
    }

    // 9. Try live Meta Model inference (if configured) with deterministic fallback.
    // Deterministic policy: rule-based output (engine:"rules") never reserves
    // or consumes AI quota. Quota is only reserved when a live AI call will
    // actually be attempted.
    const isConfigured = isMetaModelApiConfigured();
    const config = getMetaConfig({ requireApiKey: false });

    if (!isConfigured) {
      return NextResponse.json({ success: true, data: deterministicOutput });
    }

    const idempotencyKey = validateIdempotencyKey(req.headers.get("Idempotency-Key"));
    if (!idempotencyKey) {
      return NextResponse.json({ success: false, error: "Header Idempotency-Key wajib berupa UUID yang valid agar retry aman.", code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });
    }
    const reservation = await reserveAiAnalysis(user.id, idempotencyKey);
    if (!reservation.ok) {
      if (reservation.unavailable) {
        return NextResponse.json({ success: false, error: "Kuota analisis sementara tidak tersedia. Coba lagi sebentar.", code: "QUOTA_UNAVAILABLE" }, { status: 503 });
      }
      const limitReached = reservation.status === "limit_reached";
      return NextResponse.json({
        success: false,
        error: limitReached ? "Kuota analisis AI untuk periode ini telah habis." : "Permintaan analisis ini sedang diproses atau sudah selesai.",
        code: limitReached ? "AI_QUOTA_EXHAUSTED" : "AI_ANALYSIS_DUPLICATE",
        resetAt: reservation.resetAt,
      }, { status: limitReached ? 429 : 409 });
    }
    if (reservation.reservationId) {
      quotaReservation = { userId: user.id, reservationId: reservation.reservationId };
    }

    if (isConfigured) {
      try {
        const client = new MetaModelApiClient({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.museSparkModel,
          timeoutMs: 15000,
        });

        const systemPrompt = PAGE_ANALYST_SYSTEM_PROMPT;

        const objectiveGroups = deterministicOutput.account_intelligence?.account_summary.result_breakdown_by_kind?.map((item) => item.kind)
          ?? (targetObjective ? [targetObjective] : []);
        const payloadEntities: LlmPayloadEntity[] = deterministicOutput.account_intelligence
          ? deterministicOutput.account_intelligence.campaign_rankings.slice(0, 15).map((item) => ({
              level: "campaign",
              name: item.name,
              effectiveStatus: item.effectiveStatus,
              objective: item.objective,
              spendSharePct: item.spendSharePct,
              spend: item.spend,
              results: item.results,
              cpr: item.cpr,
              score: item.score.total,
              category: item.category,
              eligibleAction: item.action,
              funnelSignal: item.funnelSignal ?? "normal",
            }))
          : deterministicOutput.campaign_breakdown
            ? [
                ...deterministicOutput.campaign_breakdown.adset_rankings.slice(0, 8).map((item) => ({
                  level: "adset" as const,
                  name: item.name,
                  effectiveStatus: item.status,
                  objective: deterministicOutput.campaign_breakdown?.campaignObjective ?? null,
                  spendSharePct: item.spendSharePct,
                  spend: item.spend,
                  results: item.results,
                  cpr: item.cpr,
                  score: item.score,
                  category: item.category,
                  eligibleAction: null,
                  funnelSignal: null,
                })),
                ...deterministicOutput.campaign_breakdown.ad_rankings.slice(0, 12).map((item) => ({
                  level: "ad" as const,
                  name: item.name,
                  effectiveStatus: item.effectiveStatus,
                  objective: deterministicOutput.campaign_breakdown?.campaignObjective ?? null,
                  spendSharePct: item.spendSharePct,
                  spend: item.spend,
                  results: item.results,
                  cpr: item.cpr,
                  score: item.score,
                  category: item.category,
                  eligibleAction: null,
                  funnelSignal: null,
                })),
              ]
            : [{
                level: analysisScope === "campaign" ? "campaign" : "ad",
                name: targetName,
                effectiveStatus: entityStatus,
                objective: targetObjective,
                spendSharePct: null,
                spend: currSpend,
                results: currResults,
                cpr: currCpr,
                score: null,
                category: null,
                eligibleAction: deterministicOutput.evaluator.action,
                funnelSignal: null,
              }];
        const cqpl = cqplForScope(crmContext);
        const userPrompt = serializeLlmUserPayload(buildLlmUserPayload({
          locale,
          scope: analysisScope,
          since: since ?? null,
          until: until ?? null,
          durationDays,
          timezone,
          truncated: insightTruncated,
          entityStatus,
          dataStatus: deterministicOutput.evaluator.data_status,
          performanceStatus: deterministicOutput.evaluator.performance_status,
          lockedAction: deterministicOutput.evaluator.action,
          targetCpr: targetCpr ?? null,
          currency: adAccount?.currency || null,
          spend: currSpend,
          impressions: currImpressions,
          allClicks: currClicks,
          linkClicks: currLinkClicks,
          results: currResults,
          resultKind: primaryResult.kind === "messaging" ? "messaging_conversations" : primaryResult.kind,
          resultLabel: primaryResult.label,
          cpr: currCpr,
          linkCtr: currLinkCtr,
          linkCpc: currLinkCpc,
          cpm: currCpm,
          frequency: currFrequency,
          previousSpend: prevSpend,
          previousResults: prevResults,
          dailySpend: trendSpend,
          dailyResults: trendResults,
          objectiveGroups,
          crm: {
            connected: crmContext.availability === "available" || crmContext.availability === "empty",
            workspaceTotal: crmContext.workspaceRecords.value,
            qualifiedCount: crmContext.qualifiedLeads.value,
            cqpl: cqpl.status === "available" ? cqpl.value : null,
          },
          entities: payloadEntities,
        }));

        const response = await client.createChatCompletion({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 4000,
        });

        const rawContent = response.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsedJson = parseModelJson(rawContent);
          const validated = ModelResponseSchema.safeParse(parsedJson);

          if (validated.success) {
            const data = mapPageAnalystModelToNarrative(normalizeNarrativeTree(validated.data));
            const proposedAction =
              data.verdict.status === "stop"
                ? "STOP"
                : data.verdict.status === "scale"
                  ? "SCALE"
                  : data.verdict.status === "optimize"
                    ? "OPTIMIZE"
                    : "MAINTAIN";
            const guardInput = {
              dataStatus: deterministicOutput.evaluator.data_status,
              durationDays,
              hasChatTranscript: false,
              entityStatus,
              analysisScope,
              spend: currSpend,
              results: currResults,
              targetCpr: targetCpr ?? null,
              performanceStatus: deterministicOutput.evaluator.performance_status,
              actualCpr: currCpr,
            };
            const enforcedAction = enforceRecommendedAction(proposedAction, guardInput);
            data.verdict.status = ACTION_TO_VERDICT_STATUS[enforcedAction.action];
            if (durationDays <= 3 && data.verdict.confidence.level === "high") {
              data.verdict.confidence.level = spentBeyondDoubleTarget(currSpend, targetCpr ?? null, currResults)
                ? "medium"
                : "low";
            }
            const ctwaParsed = CtwaModelOutputSchema.safeParse(parsedJson);
            if (ctwaParsed.success) {
              const guarded = applyGuardrailsToModelOutput(
                ctwaParsed.data,
                guardInput,
                {
                  spend: currSpend,
                  link_ctr: currLinkCtr,
                  cpm: currCpm,
                  link_cpc: currAgg.linkCpc,
                  messaging_conversations: currAgg.messagingConversations,
                  leads: currAgg.leads,
                  cost_per_messaging_conversation: currAgg.costPerMessagingConversation,
                  cost_per_lead: currAgg.costPerLead,
                  unique_reach: currReach,
                }
              );
              data.verdict.status = ACTION_TO_VERDICT_STATUS[guarded.recommended_action];
            }
            const generatedText = [
              data.verdict.headline,
              data.verdict.subtext,
              data.verdict.confidence.reason,
              ...data.watchouts.flatMap((item) => [item.title, item.insight]),
              ...data.actions.flatMap((item) => [item.title, item.why, item.do, item.stop_loss]),
            ].join(" ");
            const missingFrequency = currFrequency === null || currFrequency <= 0;
            const missingReach = currReach === null;
            // Only flag if LLM explicitly hallucinated a quantitative figure for frequency or reach when they are missing
            const mentionsUnavailableFrequency =
              missingFrequency &&
              /(?:frequency|frekuensi)\s*(?:sebesar|mencapai|sebanyak|sekitar)?\s*[\d.,]+x?/i.test(generatedText);
            const mentionsUnavailableReach =
              missingReach &&
              /(?:reach|jangkauan)\s*(?:sebesar|mencapai|sebanyak|sekitar)?\s*[\d.,]+/i.test(generatedText);
            // Detect full English sentences rather than isolated words in Indonesian ad/property names
            const containsEnglishSentence =
              /\b(we recommend to|you should|in order to|as a result of|based on the data|the campaign is|this ad has|scale the budget)\b/i.test(generatedText);
            // Only consider completely idle if there is literally zero delivery data (spend=0 AND impressions=0)
            const isZeroData = currImpressions === 0 && currSpend === 0;
            const useDeterministicNarrative =
              isZeroData || containsEnglishSentence || mentionsUnavailableFrequency || mentionsUnavailableReach;
            const deterministicWarning = deterministicOutput.watchouts.find((item) => item.title.startsWith("Rentang Evaluasi Sangat Panjang"));
            const usesLegacySingleObjectPausedCopy =
              scope === "account" &&
              /\bobjek dijeda\b/i.test(`${data.verdict.headline} ${data.verdict.subtext}`);
            const fullOutput: PerformanceAnalysisOutput = {
              verdict:
                useDeterministicNarrative || usesLegacySingleObjectPausedCopy
                  ? deterministicOutput.verdict
                  : data.verdict,
              evaluator: deterministicOutput.evaluator,
              // Labels, values and formatted metrics always come from the
              // deterministic source of truth, even when narrative uses LLM.
              metrics: deterministicOutput.metrics,
              extra_metrics: deterministicOutput.extra_metrics,
              watchouts: deterministicWarning
                ? [deterministicWarning, ...data.watchouts.filter((item) => !item.title.startsWith("Rentang Evaluasi Sangat Panjang")).slice(0, 4)]
                : (useDeterministicNarrative || usesLegacySingleObjectPausedCopy ? deterministicOutput.watchouts : data.watchouts.slice(0, 5)),
              actions: useDeterministicNarrative || usesLegacySingleObjectPausedCopy
                ? deterministicOutput.actions
                : data.actions.slice(0, 5),
              context_awareness: deterministicOutput.context_awareness,
              meta: {
                source: "Meta Ads Insights (Snapshot Tersinkron)",
                generated_at: new Date().toISOString(),
                engine: useDeterministicNarrative ? "rules" : "llm", // engine: "llm" for live AI narrative
                period: periodLabel,
                scope,
                target_cpr: targetCpr ?? null,
                period_days: durationDays,
                entity_status: deliveryStatusLabelId(entityStatus),
              },
              account_intelligence: deterministicOutput.account_intelligence,
              campaign_breakdown: deterministicOutput.campaign_breakdown,
              crm_context: deterministicOutput.crm_context,
            };

            // Quota accounting fairness: if narrative was discarded to deterministic fallback,
            // release the reserved slot rather than deducting the user's AI quota.
            if (useDeterministicNarrative) {
              if (reservation.reservationId) {
                await finishAiAnalysis(user.id, reservation.reservationId, false, "deterministic_narrative_fallback");
              }
            } else {
              if (reservation.reservationId && !(await finishAiAnalysis(user.id, reservation.reservationId, true))) {
                return NextResponse.json(
                  {
                    success: false,
                    error: "Analisis selesai tetapi pencatatan kuota belum terkonfirmasi. Segarkan penggunaan sebelum mencoba lagi.",
                    code: "QUOTA_COMMIT_FAILED",
                  },
                  { status: 503 }
                );
              }
            }
            quotaReservation = null;
            return NextResponse.json({ success: true, data: fullOutput });
          }
        }
      } catch {
        // Fallback to deterministic strategist engine
      }
    }

    // 10. Deterministic fallback (provider error/invalid output): explicitly
    // marked engine:"rules" in its payload. It must NOT consume AI quota, so
    // the reservation is released instead of completed as a success.
    if (quotaReservation) {
      await finishAiAnalysis(quotaReservation.userId, quotaReservation.reservationId, false, "deterministic_output_no_quota");
      quotaReservation = null;
    }
    return NextResponse.json({ success: true, data: deterministicOutput });
  } catch (error) {
    if (quotaReservation) {
      await finishAiAnalysis(quotaReservation.userId, quotaReservation.reservationId, false, "analysis_failed");
    }
    const errorMsg = error instanceof Error ? error.message : "Kesalahan server internal";
    return NextResponse.json(
      { success: false, error: `Gagal memproses analisis: ${errorMsg}` },
      { status: 500 }
    );
  }
}

function mapCategoryToEfficiencyCode(category: string): EfficiencyCategoryCode {
  if (category === "TOP_PERFORMER") return "TOP_PERFORMER";
  if (category === "EFFICIENT") return "EFFICIENT";
  if (category === "STABLE") return "STABLE";
  if (category === "NEEDS_OPTIMIZATION") return "NEEDS_OPTIMIZATION";
  if (category === "UNDERPERFORMING") return "UNDERPERFORMING";
  return "INSUFFICIENT_DATA";
}

function mapEfficiencyCodeToLabel(code: EfficiencyCategoryCode): string {
  switch (code) {
    case "TOP_PERFORMER":
      return "Sangat Efisien · Top Performer";
    case "EFFICIENT":
      return "Efisien";
    case "STABLE":
      return "Stabil";
    case "NEEDS_OPTIMIZATION":
      return "Perlu Optimasi";
    case "UNDERPERFORMING":
      return "Tidak Efisien / Kritis";
    default:
      return "Data Terbatas";
  }
}

function applyAccountPortfolioIntelligence(
  output: PerformanceAnalysisOutput,
  report: AccountIntelligenceReport | undefined,
  targetCpr: number | null,
  durationDays: number,
  locale: "id" | "en"
): void {
  if (!report) return;
  const ranked = report.campaign_rankings;
  const efficientList = ranked.filter(
    (c) => c.category === "TOP_PERFORMER" || c.category === "EFFICIENT" || c.target.status === "ON_TARGET"
  );
  const optimizeList = ranked.filter(
    (c) => c.category === "NEEDS_OPTIMIZATION" || c.category === "STABLE"
  );
  const underperformingList = ranked.filter((c) => c.category === "UNDERPERFORMING");
  const topCmp = ranked[0];

  if (ranked.length > 0) {
    if (efficientList.length > 0 && (underperformingList.length > 0 || optimizeList.length > 0)) {
      output.verdict.headline = `Portofolio ${ranked.length} Kampanye: ${efficientList.length} Kampanye Efisien & ${underperformingList.length + optimizeList.length} Kampanye Perlu Optimasi`;
      output.verdict.status = "optimize";
      output.evaluator.action = "optimasi";
    } else if (efficientList.length > 0) {
      output.verdict.headline = `Kinerja Portofolio Akun Efisien: ${efficientList.length} dari ${ranked.length} Kampanye Mencapai Efisiensi Optimal`;
      output.verdict.status = report.analysis_metadata.all_campaigns_paused ? "maintain" : "scale";
      output.evaluator.action = report.analysis_metadata.all_campaigns_paused ? "pertahankan" : "pertahankan";
    } else if (targetCpr && report.account_summary.blended_cpr !== null) {
      output.verdict.headline = `Evaluasi Portofolio ${ranked.length} Kampanye: Rata-rata CPR ${formatRp(report.account_summary.blended_cpr, locale)} vs Target ${formatRp(targetCpr, locale)}`;
      output.verdict.status = "optimize";
      output.evaluator.action = "optimasi";
    } else {
      output.verdict.headline = `Audit Portofolio Akun: Evaluasi Performa & Peringkat ${ranked.length} Kampanye`;
      output.verdict.status = "maintain";
      output.evaluator.action = "pertahankan";
    }
  } else {
    output.verdict.headline = "Audit Portofolio Akun: Belum Ada Kampanye dengan Aktivitas pada Periode Ini";
    output.verdict.status = "maintain";
  }

  if (report.intelligence.executive_summary) {
    output.verdict.subtext = report.intelligence.executive_summary;
  }
  if (report.intelligence.confidence.explanation) {
    output.verdict.confidence.reason = report.intelligence.confidence.explanation;
  }

  const portfolioWatchouts: PerformanceAnalysisOutput["watchouts"] = [];
  if (topCmp) {
    portfolioWatchouts.push({
      severity: "ok",
      title: `Peringkat #1: ${cleanEntityName(topCmp.name).slice(0, 36)}`,
      insight: `Menyerap ${(topCmp.spendSharePct ?? 0).toFixed(1)}% belanja akun (${formatRp(topCmp.spend, locale)}) dengan ${topCmp.results ?? 0} ${topCmp.resultLabel}${topCmp.cpr !== null ? ` pada CPR ${formatRp(topCmp.cpr, locale)}` : ""} (Skor Kinerja ${topCmp.score.total}/100 · ${mapEfficiencyCodeToLabel(mapCategoryToEfficiencyCode(topCmp.category))}).`,
    });
  }
  if (underperformingList.length > 0) {
    const worst = underperformingList[underperformingList.length - 1] || underperformingList[0];
    portfolioWatchouts.push({
      severity: "critical",
      title: `${underperformingList.length} Kampanye Tidak Efisien / Di Atas Target`,
      insight: `Kampanye seperti "${cleanEntityName(worst.name)}" menyerap ${formatRp(worst.spend, locale)}${worst.cpr !== null ? ` dengan CPR ${formatRp(worst.cpr, locale)}` : " tanpa konversi efisien"} (Skor ${worst.score.total}/100). Realokasi budget ke kampanye peringkat teratas.`,
    });
  } else if (optimizeList.length > 0) {
    const opt = optimizeList[0];
    portfolioWatchouts.push({
      severity: "warn",
      title: `${optimizeList.length} Kampanye Perlu Optimasi Efisiensi`,
      insight: `"${cleanEntityName(opt.name)}" mencatat skor kinerja ${opt.score.total}/100${opt.cpr !== null ? ` dengan CPR ${formatRp(opt.cpr, locale)}` : ""}. Optimalkan ad set & materi iklan di dalamnya untuk menekan biaya per hasil.`,
    });
  }
  if (durationDays > 60) {
    portfolioWatchouts.push({
      severity: "warn",
      title: `Rentang Evaluasi Jangka Panjang (${durationDays} Hari)`,
      insight: "Analisis ini mencakup portofolio kampanye pada rentang jangka panjang. Gunakan peringkat efisiensi di bawah untuk memisahkan kampanye tulang punggung dari kampanye yang membebani rata-rata CPR.",
    });
  } else if (report.intelligence.key_findings.length > 0 && portfolioWatchouts.length < 3) {
    const finding = report.intelligence.key_findings[0];
    portfolioWatchouts.push({
      severity: "ok",
      title: finding.title.slice(0, 48),
      insight: finding.diagnosis,
    });
  }
  if (portfolioWatchouts.length > 0) {
    output.watchouts = portfolioWatchouts.slice(0, 3);
  }

  if (report.recommendations.length > 0) {
    output.actions = report.recommendations.slice(0, 3).map((rec) => ({
      priority: rec.priority === "CRITICAL" || rec.priority === "HIGH" ? "high" : rec.priority === "MEDIUM" ? "medium" : "low",
      title: `${rec.action === "SCALE" ? "Prioritaskan Budget" : rec.action === "PAUSE" ? "Evaluasi / Nonaktifkan" : rec.action === "REDUCE_BUDGET" ? "Kurangi Alokasi" : "Optimasi Kampanye"}: ${cleanEntityName(rec.objectName).slice(0, 38)}`,
      why: rec.reason,
      do: rec.recommendedAction,
      stop_loss: rec.stopLoss,
    }));
  }
}

function buildCampaignHierarchyBreakdown(input: {
  campaign: { id: string; name: string; objective: string | null; status: string | null; provider_campaign_id: string | null };
  ads: Array<{ id: string; name: string; status: string | null; provider_ad_id: string; campaign_id: string }>;
  insights: Array<{
    ad_id?: string | null;
    adset_id?: string | null;
    adset_name?: string | null;
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    reach: number | null;
    link_clicks: number | null;
    conversions: number | null;
    action_breakdown?: unknown;
    conversion_action_type?: string | null;
    date_start: string | null;
  }>;
  currency: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  durationDays: number;
  targetCpr: number | null;
  resultLabel: string;
}): CampaignHierarchyBreakdown {
  const singleReport = buildAccountIntelligence({
    accountId: null,
    accountName: cleanEntityName(input.campaign.name),
    currency: input.currency,
    timezone: input.timezone,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    durationDays: input.durationDays,
    accountCampaignTargetCpr: input.targetCpr,
    campaigns: [
      {
        id: input.campaign.id,
        providerId: input.campaign.provider_campaign_id || input.campaign.id,
        name: input.campaign.name,
        status: input.campaign.status,
        objective: input.campaign.objective,
      },
    ],
    ads: input.ads.map((a) => ({
      id: a.id,
      providerId: a.provider_ad_id,
      name: a.name,
      status: a.status,
      campaignId: a.campaign_id,
    })),
    insights: input.insights.flatMap((row) => (row.ad_id ? [{ ...row, ad_id: row.ad_id }] : [])),
  });

  const adsetByAdId = new Map<string, { id: string; name: string }>();
  for (const row of input.insights) {
    if (!row.ad_id) continue;
    const existing = adsetByAdId.get(row.ad_id);
    const rawId = row.adset_id?.trim() || "";
    const rawName = row.adset_name?.trim() || "";
    if (!existing && (rawId || rawName)) {
      adsetByAdId.set(row.ad_id, {
        id: rawId || rawName,
        name: rawName || `Ad Set #${rawId.slice(-6)}`,
      });
    } else if (existing && !existing.name.startsWith("Ad Set") && rawName) {
      adsetByAdId.set(row.ad_id, { id: existing.id, name: rawName });
    }
  }

  const defaultAdSetName = `Ad Set Utama · ${cleanEntityName(input.campaign.name)}`;
  const totalRankedAdSpend = singleReport.ad_rankings.reduce<number | null>((acc, item) => {
    if (typeof item.spend !== "number") return acc;
    return (acc ?? 0) + item.spend;
  }, null);
  const rankedAdIds = new Set<string>();
  const ad_rankings: RankedCampaignAdItem[] = singleReport.ad_rankings.map((ad, idx) => {
    rankedAdIds.add(ad.id);
    const adsetInfo = adsetByAdId.get(ad.id) || { id: "adset_primary", name: defaultAdSetName };
    const code = mapCategoryToEfficiencyCode(ad.category);
    const cprVsTargetPct =
      input.targetCpr && input.targetCpr > 0 && ad.cpr !== null
        ? Number((((ad.cpr - input.targetCpr) / input.targetCpr) * 100).toFixed(1))
        : null;
    const adSpendSharePct =
      totalRankedAdSpend != null && totalRankedAdSpend > 0 && ad.spend != null
        ? Number(((ad.spend / totalRankedAdSpend) * 100).toFixed(1))
        : null;
    return {
      rank: idx + 1,
      id: ad.id,
      providerId: ad.providerId,
      name: cleanEntityName(ad.name),
      adsetId: adsetInfo.id,
      adsetName: cleanEntityName(adsetInfo.name),
      status: (ad.configuredStatus === "ACTIVE" || ad.configuredStatus === "PAUSED" || ad.configuredStatus === "ARCHIVED" || ad.configuredStatus === "DELETED"
        ? ad.configuredStatus
        : "PAUSED"),
      effectiveStatus: ad.effectiveStatus,
      spend: ad.spend,
      spendSharePct: adSpendSharePct,
      results: ad.results,
      resultLabel: ad.resultLabel || input.resultLabel,
      cpr: ad.cpr,
      targetCpr: input.targetCpr,
      cprVsTargetPct,
      ctr: ad.ctr,
      cpc: ad.cpc,
      impressions: ad.impressions,
      linkClicks: ad.linkClicks ?? 0,
      score: ad.score.total,
      category: code,
      efficiencyLabel: mapEfficiencyCodeToLabel(code),
      actionLabel: ad.actionLabel || (ad.action === "SCALE" ? "Prioritaskan Budget" : ad.action === "PAUSE" ? "Evaluasi / Matikan" : ad.action === "REDUCE_BUDGET" ? "Kurangi Budget" : ad.action === "OPTIMIZE" ? "Optimasi Materi" : "Pertahankan"),
      diagnosis: ad.reason,
    };
  });

  // Append 0-delivery ads in the campaign so user sees complete ad roster of the campaign
  for (const rawAd of input.ads) {
    if (rankedAdIds.has(rawAd.id)) continue;
    const adsetInfo = adsetByAdId.get(rawAd.id) || { id: "adset_primary", name: defaultAdSetName };
    const normStatus = (rawAd.status || "PAUSED").toUpperCase();
    const statusVal: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" =
      normStatus === "ACTIVE" ? "ACTIVE" : normStatus === "ARCHIVED" ? "ARCHIVED" : normStatus === "DELETED" ? "DELETED" : "PAUSED";
    ad_rankings.push({
      rank: ad_rankings.length + 1,
      id: rawAd.id,
      providerId: rawAd.provider_ad_id || rawAd.id,
      name: cleanEntityName(rawAd.name),
      adsetId: adsetInfo.id,
      adsetName: cleanEntityName(adsetInfo.name),
      status: statusVal,
      effectiveStatus: input.campaign.status?.toUpperCase() === "ACTIVE" && statusVal === "ACTIVE" ? "ACTIVE" : "PAUSED",
      spend: 0,
      spendSharePct: 0,
      results: 0,
      resultLabel: input.resultLabel,
      cpr: null,
      targetCpr: input.targetCpr,
      cprVsTargetPct: null,
      ctr: null,
      cpc: null,
      impressions: 0,
      linkClicks: 0,
      score: 0,
      category: "INSUFFICIENT_DATA",
      efficiencyLabel: "Belum Ada Tayangan",
      actionLabel: "Observasi",
      diagnosis: "Materi iklan ini tidak mencatat tayangan atau pembelanjaan pada periode terpilih.",
    });
  }

  // Group by Ad Set to build adset_rankings
  const adsetGroups = new Map<
    string,
    {
      id: string;
      name: string;
      ads: RankedCampaignAdItem[];
    }
  >();
  for (const ad of ad_rankings) {
    const key = ad.adsetId || ad.adsetName || "adset_primary";
    const group = adsetGroups.get(key) ?? {
      id: key,
      name: ad.adsetName || defaultAdSetName,
      ads: [],
    };
    group.ads.push(ad);
    adsetGroups.set(key, group);
  }

  const totalCampaignSpend = ad_rankings.reduce<number | null>((acc, item) => addReported(acc, item.spend), null);
  const rawAdSets: Omit<RankedCampaignAdSetItem, "rank">[] = Array.from(adsetGroups.values()).map((grp) => {
    const spend = grp.ads.reduce<number | null>((acc, item) => addReported(acc, item.spend), null);
    const results = grp.ads.reduce<number | null>((acc, item) => addReported(acc, item.results), null);
    const impressions = grp.ads.reduce<number | null>((acc, item) => addReported(acc, item.impressions), null);
    const linkClicks = grp.ads.reduce<number | null>((acc, item) => addReported(acc, item.linkClicks), null);
    const cpr = results != null && results > 0 && spend != null ? Number((spend / results).toFixed(2)) : null;
    const ctr = impressions != null && impressions > 0 && linkClicks != null ? Number(((linkClicks / impressions) * 100).toFixed(2)) : null;
    const cpc = linkClicks != null && linkClicks > 0 && spend != null ? Number((spend / linkClicks).toFixed(2)) : null;
    const spendSharePct = totalCampaignSpend != null && totalCampaignSpend > 0 && spend != null ? Number(((spend / totalCampaignSpend) * 100).toFixed(1)) : null;
    const cprVsTargetPct =
      input.targetCpr && input.targetCpr > 0 && cpr !== null
        ? Number((((cpr - input.targetCpr) / input.targetCpr) * 100).toFixed(1))
        : null;
    const activeAdsCount = grp.ads.filter((a) => a.effectiveStatus === "ACTIVE").length;
    const deliveredAds = grp.ads.filter((a) => (a.spend != null && a.spend > 0) || (a.impressions != null && a.impressions > 0));
    const weightedScore =
      spend != null && spend > 0
        ? Math.round(deliveredAds.reduce((acc, a) => acc + a.score * ((a.spend ?? 0) / spend), 0))
        : deliveredAds.length > 0
          ? Math.round(deliveredAds.reduce((acc, a) => acc + a.score, 0) / deliveredAds.length)
          : 0;

    let category: EfficiencyCategoryCode = "INSUFFICIENT_DATA";
    if ((spend != null && spend > 0) || (results != null && results > 0)) {
      if (results != null && results >= 5 && input.targetCpr && cpr !== null && cpr <= input.targetCpr * 0.9 && weightedScore >= 75) {
        category = "TOP_PERFORMER";
      } else if (results != null && results >= 2 && ((input.targetCpr && cpr !== null && cpr <= input.targetCpr * 1.05) || weightedScore >= 68)) {
        category = "EFFICIENT";
      } else if (results != null && results > 0 && weightedScore >= 52) {
        category = "STABLE";
      } else if (results != null && results > 0 && weightedScore >= 38) {
        category = "NEEDS_OPTIMIZATION";
      } else if (spend != null && spend > 0 && (results === 0 || weightedScore < 38)) {
        category = "UNDERPERFORMING";
      }
    }

    const bestAd = deliveredAds[0];
    const diagnosis =
      spend === 0 && impressions === 0
        ? "Ad Set belum mencatat impresi atau belanja pada periode ini."
        : `Menaungi ${grp.ads.length} materi iklan (${deliveredAds.length} beraktivitas). Menghasilkan ${results} ${input.resultLabel} dari belanja ${formatRp(spend)}${cpr !== null ? ` (CPR ${formatRp(cpr)})` : ""}${bestAd ? `. Materi terbaik: "${bestAd.name}" (Skor ${bestAd.score}/100).` : "."}`;

    const actionLabel =
      category === "TOP_PERFORMER" || category === "EFFICIENT"
        ? activeAdsCount > 0 ? "Prioritaskan Budget" : "Kandidat Reaktivasi"
        : category === "STABLE"
          ? "Pertahankan"
          : category === "NEEDS_OPTIMIZATION"
            ? "Optimasi Materi Iklan"
            : category === "UNDERPERFORMING"
              ? "Kurangi / Evaluasi"
              : "Observasi";

    return {
      id: grp.id,
      name: grp.name,
      status: activeAdsCount > 0 ? "ACTIVE" : "PAUSED",
      adsCount: grp.ads.length,
      activeAdsCount,
      spend,
      spendSharePct,
      results,
      resultLabel: input.resultLabel,
      cpr,
      targetCpr: input.targetCpr,
      cprVsTargetPct,
      ctr,
      cpc,
      impressions,
      linkClicks,
      score: weightedScore,
      category,
      efficiencyLabel: mapEfficiencyCodeToLabel(category),
      actionLabel,
      diagnosis,
    };
  });

  rawAdSets.sort((a, b) => b.score - a.score || (b.results ?? Number.NEGATIVE_INFINITY) - (a.results ?? Number.NEGATIVE_INFINITY) || (b.spend ?? Number.NEGATIVE_INFINITY) - (a.spend ?? Number.NEGATIVE_INFINITY));
  const adset_rankings: RankedCampaignAdSetItem[] = rawAdSets.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  const adsWithDelivery = ad_rankings.filter((a) => (a.spend != null && a.spend > 0) || (a.impressions != null && a.impressions > 0)).length;
  const efficientAdsCount = ad_rankings.filter((a) => a.category === "TOP_PERFORMER" || a.category === "EFFICIENT").length;
  const optimizeAdsCount = ad_rankings.filter((a) => a.category === "STABLE" || a.category === "NEEDS_OPTIMIZATION").length;
  const underperformingAdsCount = ad_rankings.filter((a) => a.category === "UNDERPERFORMING").length;

  return {
    campaignId: input.campaign.id,
    campaignName: cleanEntityName(input.campaign.name),
    campaignStatus: input.campaign.status || "UNKNOWN",
    campaignObjective: input.campaign.objective,
    totalAdSets: adset_rankings.length,
    totalAds: ad_rankings.length,
    adsWithDelivery,
    efficientAdsCount,
    optimizeAdsCount,
    underperformingAdsCount,
    adset_rankings,
    ad_rankings,
  };
}

function applyCampaignHierarchyIntelligence(
  output: PerformanceAnalysisOutput,
  breakdown: CampaignHierarchyBreakdown,
  campaignName: string,
  targetCpr: number | null,
  durationDays: number,
  locale: "id" | "en"
): void {
  const deliveredAds = breakdown.ad_rankings.filter((a) => (a.spend != null && a.spend > 0) || (a.impressions != null && a.impressions > 0));
  const topAd = deliveredAds[0];
  const worstAd = deliveredAds.length > 1 ? deliveredAds[deliveredAds.length - 1] : null;
  const topAdSet = breakdown.adset_rankings[0];

  if (deliveredAds.length > 0) {
    output.verdict.headline = `Evaluasi Kampanye "${campaignName}": ${breakdown.totalAdSets} Ad Set & ${deliveredAds.length} Materi Iklan (${breakdown.efficientAdsCount} Efisien)`;
    const summaryParts: string[] = [];
    if (topAdSet) {
      summaryParts.push(
        `Ad Set "${topAdSet.name}" memimpin dengan ${topAdSet.results} ${topAdSet.resultLabel} (${topAdSet.spendSharePct}% porsi budget kampanye${topAdSet.cpr !== null ? `, CPR ${formatRp(topAdSet.cpr, locale)}` : ""}).`
      );
    }
    if (topAd) {
      summaryParts.push(
        `Materi iklan #1 "${topAd.name}" meraih skor kinerja tertinggi ${topAd.score}/100 (${topAd.efficiencyLabel}) dengan ${topAd.results} ${topAd.resultLabel}${topAd.cpr !== null ? ` pada CPR ${formatRp(topAd.cpr, locale)}` : ""}.`
      );
    }
    if (worstAd && worstAd.category === "UNDERPERFORMING") {
      summaryParts.push(
        `Sebaliknya, materi "${worstAd.name}" berada di peringkat terbawah (Skor ${worstAd.score}/100) dengan belanja ${formatRp(worstAd.spend, locale)}${worstAd.cpr !== null ? ` dan CPR ${formatRp(worstAd.cpr, locale)}` : " tanpa hasil efisien"}.`
      );
    }
    if (summaryParts.length > 0) {
      output.verdict.subtext = summaryParts.join(" ");
    }
  }

  const campaignWatchouts: PerformanceAnalysisOutput["watchouts"] = [];
  if (topAd) {
    campaignWatchouts.push({
      severity: "ok",
      title: `Iklan #1: ${topAd.name.slice(0, 34)}`,
      insight: `Berada di "${topAd.adsetName}" · Menyerap ${topAd.spendSharePct}% budget kampanye (${formatRp(topAd.spend, locale)}) dengan ${topAd.results} ${topAd.resultLabel}${topAd.cpr !== null ? ` (CPR ${formatRp(topAd.cpr, locale)})` : ""} · Skor ${topAd.score}/100 (${topAd.efficiencyLabel}).`,
    });
  }
  if (worstAd && (worstAd.category === "UNDERPERFORMING" || worstAd.category === "NEEDS_OPTIMIZATION")) {
    campaignWatchouts.push({
      severity: worstAd.category === "UNDERPERFORMING" ? "critical" : "warn",
      title: `Beban Efisiensi: ${worstAd.name.slice(0, 32)}`,
      insight: `Menyerap ${worstAd.spendSharePct}% budget kampanye (${formatRp(worstAd.spend, locale)}) dengan skor ${worstAd.score}/100 (${worstAd.efficiencyLabel})${worstAd.cpr !== null ? ` dan CPR ${formatRp(worstAd.cpr, locale)}` : ""}.`,
    });
  }
  if (durationDays > 60) {
    campaignWatchouts.push({
      severity: "warn",
      title: `Rentang Evaluasi Panjang (${durationDays} Hari)`,
      insight: "Bandingkan peringkat Ad Set dan Materi Iklan di bawah untuk mengidentifikasi pemenang kreatif vs materi yang sudah jenuh.",
    });
  }
  if (campaignWatchouts.length > 0) {
    output.watchouts = [...campaignWatchouts, ...output.watchouts].slice(0, 3);
  }

  const customActions: PerformanceAnalysisOutput["actions"] = [];
  const campaignPaused = /PAUSED|ARCHIVED/i.test(breakdown.campaignStatus);
  if (topAd && (topAd.category === "TOP_PERFORMER" || topAd.category === "EFFICIENT")) {
    const pausedAd = campaignPaused || topAd.effectiveStatus !== "ACTIVE";
    customActions.push(pausedAd ? {
      priority: "high",
      title: `Kandidat reaktivasi: ${topAd.name.slice(0, 32)}`,
      why: `Materi "${topAd.name}" di "${topAd.adsetName}" mencetak skor ${topAd.score}/100 (${topAd.efficiencyLabel}) dengan ${topAd.results} ${topAd.resultLabel}${topAd.cpr !== null ? ` dan CPR ${formatRp(topAd.cpr, locale)}` : ""}${targetCpr ? `, target ${formatRp(targetCpr, locale)}` : ""}.`,
      do: `Tandai "${topAd.name}" sebagai kandidat pertimbangan reaktivasi. Aktifkan manual hanya iklan ini setelah pratinjau tujuan masih berjalan, lalu isi anggaran uji baru. Jangan menyalakan seluruh kampanye dari laporan ini.`,
      stop_loss: targetCpr
        ? `Jika diaktifkan manual, hentikan uji saat belanja menyentuh ${formatRp(targetCpr * 2, locale)} tanpa hasil baru.`
        : "Anggaran uji tidak dihitung karena target CPR belum diatur.",
    } : {
      priority: "high",
      title: `Fokuskan Anggaran pada Iklan #1: ${topAd.name.slice(0, 32)}`,
      why: `Materi iklan "${topAd.name}" di "${topAd.adsetName}" mencetak skor ${topAd.score}/100 (${topAd.efficiencyLabel}) dengan ${topAd.results} ${topAd.resultLabel}${topAd.cpr !== null ? ` dan CPR ${formatRp(topAd.cpr, locale)}` : ""}.`,
      do: `Pertahankan distribusi utama kampanye pada Ad Set "${topAd.adsetName}" dan gunakan angle kreatif "${topAd.name}" sebagai acuan pembuatan variasi materi baru.`,
      stop_loss: targetCpr
        ? `Evaluasi ulang jika CPR materi ini naik melewati ${formatRp(Math.round(targetCpr * 1.25), locale)} selama 3 hari berturut-turut.`
        : "Evaluasi ulang jika CPR naik lebih dari 30% dibanding rata-rata historis kampanye.",
    });
  }
  if (worstAd && (worstAd.category === "UNDERPERFORMING" || worstAd.category === "NEEDS_OPTIMIZATION")) {
    customActions.push({
      priority: "high",
      title: `Optimasi / Pangkas Materi Terbawah: ${worstAd.name.slice(0, 28)}`,
      why: `Materi "${worstAd.name}" menyerap ${formatRp(worstAd.spend, locale)} (${worstAd.spendSharePct}% budget kampanye) dengan skor kinerja hanya ${worstAd.score}/100 (${worstAd.efficiencyLabel}).`,
      do: `Alihkan porsi anggaran dari materi "${worstAd.name}" ke materi peringkat #1 atau lakukan penyegaran hook & penawaran pada Ad Set "${worstAd.adsetName}".`,
      stop_loss: targetCpr
        ? `Hentikan materi iklan jika belanja melewati 2x target CPR (${formatRp(targetCpr * 2, locale)}) tanpa perbaikan konversi.`
        : "Hentikan materi iklan jika terus menyerap >20% budget kampanye tanpa perbaikan konversi.",
    });
  }
  if (customActions.length > 0) {
    output.actions = [...customActions, ...output.actions].slice(0, 3);
  }
}

async function loadInsightPages(
  db: Awaited<ReturnType<typeof createClient>>,
  input: { organizationId: string; adIds: string[]; since?: string; until?: string }
) {
  const chunks: Array<string[] | null> = input.adIds.length
    ? Array.from({ length: Math.ceil(input.adIds.length / 80) }, (_, index) => input.adIds.slice(index * 80, index * 80 + 80))
    : [null];
  let columns = "ad_id, adset_id, adset_name, spend, impressions, clicks, reach, link_clicks, conversions, action_breakdown, conversion_action_type, date_start";
  const rows: Array<{
    ad_id?: string | null;
    adset_id?: string | null;
    adset_name?: string | null;
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    reach: number | null;
    link_clicks: number | null;
    conversions: number | null;
    action_breakdown?: unknown;
    conversion_action_type?: string | null;
    date_start: string | null;
  }> = [];
  let truncated = false;

  for (const ids of chunks) {
    let offset = 0;
    for (let page = 0; page < 15; page += 1) {
      const run = (selected: string) => {
        let query = db.from("ad_insights").select(selected).eq("organization_id", input.organizationId);
        if (input.since) query = query.gte("date_start", input.since);
        if (input.until) query = query.lte("date_stop", input.until);
        if (ids) query = query.in("ad_id", ids);
        return query.range(offset, offset + 999);
      };
      let result = await run(columns);
      if (result.error && columns.includes("adset_name")) {
        columns = "ad_id, spend, impressions, clicks, reach, link_clicks, conversions, action_breakdown, conversion_action_type, date_start";
        result = await run(columns);
      }
      if (result.error && columns.includes("action_breakdown")) {
        columns = "ad_id, spend, impressions, clicks, reach, link_clicks, conversions, date_start";
        result = await run(columns);
      }
      if (result.error) return { rows, truncated, error: result.error };
      const batch = (result.data || []) as unknown as typeof rows;
      rows.push(...batch);
      if (batch.length < 1000) break;
      offset += 1000;
      if (page === 14) truncated = true;
    }
  }
  return { rows, truncated, error: null };
}

async function loadAccountRoster(
  db: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  campaignIds: string[] | null
) {
  const campaigns: Array<{ id: string; providerId: string; name: string; status: string | null; objective: string | null }> = [];
  const pullCampaigns = async (ids?: string[]) => {
    let query = db.from("campaigns").select("id, name, status, objective, provider_campaign_id").eq("organization_id", organizationId);
    if (ids) query = query.in("id", ids);
    const { data } = await query;
    for (const row of data || []) {
      campaigns.push({
        id: row.id,
        providerId: row.provider_campaign_id,
        name: row.name,
        status: row.status,
        objective: row.objective,
      });
    }
  };
  if (campaignIds && campaignIds.length > 0) {
    for (let index = 0; index < campaignIds.length; index += 100) {
      await pullCampaigns(campaignIds.slice(index, index + 100));
    }
  } else if (!campaignIds) {
    await pullCampaigns();
  }

  const ads: Array<{ id: string; providerId: string; name: string; status: string | null; campaignId: string }> = [];
  const ids = campaigns.map((campaign) => campaign.id);
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    if (!chunk.length) continue;
    const { data } = await db
      .from("ads")
      .select("id, name, status, provider_ad_id, campaign_id")
      .eq("organization_id", organizationId)
      .in("campaign_id", chunk);
    for (const row of data || []) {
      ads.push({
        id: row.id,
        providerId: row.provider_ad_id,
        name: row.name,
        status: row.status,
        campaignId: row.campaign_id,
      });
    }
  }
  return { campaigns, ads };
}
