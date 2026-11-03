import { NextRequest, NextResponse } from "next/server";
import { finishAiAnalysis, validateIdempotencyKey, reserveAiAnalysis } from "@/lib/ai/usage-quota";
import { z } from "zod";
import { isMetaModelApiConfigured, getMetaConfig } from "@/lib/ai/meta/config";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { createClient } from "@/lib/supabase/server";
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
  scopeNarrativeRules,
  spentBeyondDoubleTarget,
  type AnalysisScope,
  type EntityDeliveryStatus,
} from "@/lib/ai/ctwa-analysis/dynamic-context";
import { PAGE_ANALYST_SYSTEM_PROMPT } from "@/lib/ai/ctwa-analysis/prompt";
import { classifyResult } from "@/lib/ads/service";
import {
  aggregateAdInsights,
  buildZeroFilledDailyTrends,
  leadsFromRow,
  messagingFromRow,
  selectPrimaryResult,
  type AdInsightRowLike,
} from "@/lib/ads/aggregation";
import { buildAccountIntelligence, type AccountIntelligenceReport } from "@/lib/ai/account-intelligence/engine";
import { buildCrmAnalysisContext, calendarDayBounds, cqplForScope, formatCrmContextForPrompt, type CrmAnalysisContext } from "@/lib/crm/crm-analysis-context";
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
    value: number;
    display: string;
    delta_pct: number | null;
    delta_note: string | null;
    vs_target: "better" | "on_target" | "worse" | "no_target";
    trend_7d: number[] | null;
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
  crm_context?: CrmAnalysisContext;
}

const ModelResponseSchema = z.object({
  verdict: z.object({
    status: z.enum(["scale", "maintain", "optimize", "stop"]),
    headline: z.string(),
    subtext: z.string(),
    confidence: z.object({
      level: z.enum(["high", "medium", "low"]),
      reason: z.string(),
    }),
  }),
  metrics: z
    .array(
      z.object({
        key: z.enum(["spend", "results", "cpr", "ctr"]),
        label: z.string().optional(),
        value: z.number().optional(),
        display: z.string().optional(),
        delta_pct: z.number().nullable().optional(),
        delta_note: z.string().nullable().optional(),
        vs_target: z.enum(["better", "on_target", "worse", "no_target"]).optional(),
        trend_7d: z.array(z.number()).nullable().optional(),
      })
    )
    .optional()
    .default([]),
  extra_metrics: z
    .array(
      z.object({
        label: z.string(),
        display: z.string(),
        note: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  watchouts: z
    .array(
      z.object({
        severity: z.enum(["ok", "warn", "critical"]),
        title: z.string(),
        insight: z.string(),
      })
    )
    .max(5)
    .default([]),
  actions: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        title: z.string(),
        why: z.string(),
        do: z.string(),
        stop_loss: z.string(),
      })
    )
    .max(5)
    .default([]),
  context_awareness: z
    .object({
      analyzed_scope: z.enum(["Account", "Campaign", "Ad"]),
      entity_status: z.enum(["Active", "Paused", "Unknown"]),
      period_confidence: z.enum(["High", "Medium", "Low"]),
      period_days: z.number(),
    })
    .optional(),
});

/** Fixes spacing and English percent decimals without discarding the model narrative. */
export function normalizeIndonesianLlmCopy(text: string): string {
  return text
    .replace(/Rp\s+(?=\d)/g, "Rp")
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
    if ("verdict" in record) return record;
    if ("data" in record && record.data && typeof record.data === "object" && "verdict" in (record.data as Record<string, unknown>)) {
      return record.data;
    }
    if ("analysis" in record && record.analysis && typeof record.analysis === "object" && "verdict" in (record.analysis as Record<string, unknown>)) {
      return record.analysis;
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
  spend: number;
  results: number;
  costPerResult: number | null;
  linkClicks: number;
  linkCtr: number | null;
  linkCpc: number | null;
  cpm: number | null;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  allClicks: number;
  allCtr: number | null;
  allCpc: number | null;
  prevSpend: number | null;
  prevResults: number | null;
  prevCpr: number | null;
  prevLinkCtr: number | null;
  targetCpr: number | null;
  trends: {
    spend: number[];
    results: number[];
    cpr: number[];
    ctr: number[];
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
      display: results.toLocaleString("id-ID"),
      delta_pct: evalResult.comparisons.results.percentageDelta,
      delta_note: evalResult.comparisons.results.displayDelta,
      vs_target: "no_target",
      trend_7d: trends.results.length > 0 ? trends.results : null,
    },
    {
      key: "cpr",
      label: "Biaya per Hasil (CPR)",
      value: evalResult.actualCpr ?? 0,
      display: evalResult.actualCpr !== null ? formatRp(evalResult.actualCpr, loc) : (loc === "id" ? "Tidak tersedia" : "Unavailable"),
      delta_pct: evalResult.comparisons.cpr.percentageDelta,
      delta_note: evalResult.comparisons.cpr.displayDelta,
      vs_target: cprVsTarget,
      trend_7d: trends.cpr.length > 0 ? trends.cpr : null,
    },
    {
      key: "ctr",
      label: "CTR Tautan",
      value: linkCtr ?? 0,
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
      display: impressions.toLocaleString("id-ID"),
      note: "Jumlah iklan ditampilkan",
    },
    {
      label: "Semua Klik (Interaksi)",
      display: allClicks.toLocaleString("id-ID"),
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
  } else if (pausedDelivery && impressions > 0) {
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
    const supabase = await createClient();

    // 1. Authenticate & Resolve Organization ID
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Autentikasi diperlukan", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };

    const organizationId = profile?.organization_id || null;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
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
    let crmScopeAdId: string | null = scope === "ad" ? targetId || null : null;

    if (scope === "campaign") {
      if (!targetId) {
        return NextResponse.json(
          { success: false, error: "Campaign ID wajib disertakan untuk cakupan per-campaign" },
          { status: 400 }
        );
      }

      const { data: campaign } = await db
        .from("campaigns")
        .select("id, name, objective, status")
        .eq("organization_id", organizationId)
        .eq("id", targetId)
        .maybeSingle();

      if (!campaign || (accountCampaignIds && !accountCampaignIds.includes(campaign.id))) {
        return NextResponse.json(
          { success: false, error: "Campaign tidak ditemukan atau tidak memiliki hak akses" },
          { status: 404 }
        );
      }

      targetName = cleanEntityName(campaign.name);
      targetObjective = campaign.objective;
      entityStatus = normalizeEntityStatus(campaign.status);

      const { data: adsInCmp } = await db
        .from("ads")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("campaign_id", targetId);

      targetAdIds = (adsInCmp || []).map((a) => a.id);
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
    let prevInsights: Array<{
      spend: number;
      impressions: number;
      clicks: number;
      reach: number;
      link_clicks: number;
      conversions: number;
    }> = [];

    if (prevSince && prevUntil && (scope === "account" || targetAdIds.length > 0)) {
      const loadedPrevious = await loadInsightPages(db, {
        organizationId,
        adIds: targetAdIds,
        since: prevSince,
        until: prevUntil,
      });
      if (!loadedPrevious.error) {
        prevInsights = loadedPrevious.rows.map((row) => ({
          spend: Number(row.spend) || 0,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
          reach: Number(row.reach) || 0,
          link_clicks: Number(row.link_clicks) || 0,
          conversions: Number(row.conversions) || 0,
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
    const currLinkClicks = currAgg.linkClicks ?? 0;
    const primaryResult = selectPrimaryResult(currAgg, targetObjective);
    const currResults = primaryResult.count ?? currAgg.results ?? 0;
    const decisionCpr = primaryResult.kind === "legacy" ? currAgg.costPerResult : primaryResult.cost;

    const currLinkCtr = currAgg.linkCtr;
    const currLinkCpc = currAgg.linkCpc;
    const currAllCtr = currAgg.allCtr;
    const currAllCpc = currAgg.allCpc;
    const currCpm = currAgg.cpm;
    const currCpr = decisionCpr;
    const currFrequency = currAgg.frequency;

    const resultOfDay = (row: AdInsightRowLike) => {
      if (primaryResult.kind === "messaging") return messagingFromRow(row) ?? 0;
      if (primaryResult.kind === "leads") return leadsFromRow(row) ?? 0;
      return Number(row.conversions) || 0;
    };
    const filledTrends = since && until
      ? buildZeroFilledDailyTrends(currentInsights, since, until, resultOfDay)
      : { spend: [] as number[], results: [] as number[], cpr: [] as number[], ctr: [] as number[] };
    const trendSpend = filledTrends.spend;
    const trendResults = filledTrends.results;
    const trendCpr = filledTrends.cpr;
    const trendCtr = filledTrends.ctr;

    const classification = classifyResult(currResults, [], targetObjective);

    // 8. Aggregate Previous Metrics (same shared aggregation)
    const prevAgg = aggregateAdInsights(prevInsights || []);
    const prevSpend = prevAgg.spend;
    const prevResults = prevAgg.results ?? 0;
    const prevImpressions = prevAgg.impressions;
    const prevLinkClicks = prevAgg.linkClicks ?? 0;

    const prevCpr = prevAgg.costPerResult;
    const prevLinkCtr = prevImpressions > 0 ? Number(((prevLinkClicks / prevImpressions) * 100).toFixed(2)) : null;
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
      .eq("channel", "crm_upload")
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
        note: "Hot + Warm pada cakupan ini. Cold tidak dihitung.",
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
        note: `Chat yang Meta laporkan dari iklan CTWA. Biaya per percakapan: ${formatRp(currAgg.costPerMessagingConversation, locale)}. Angka ini tidak sama dengan catatan CRM.`,
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

        const userPrompt = `Data Kampanye Properti:
- Objek: ${targetName} (scope=${analysisScope})
- Status penayangan: ${deliveryStatusLabelId(entityStatus)} (${entityStatus})
- period_days: ${durationDays}
- Aturan cakupan: ${scopeNarrativeRules(analysisScope)}
- Periode: ${periodLabel} (${durationDays} hari, Timezone: ${timezone})
- Target CPR: ${targetCpr ? formatRp(targetCpr, locale) : "Belum diatur"}
- Belanja: ${formatRp(currSpend, locale)}
- Acuan keputusan (jangan campur jenis hasil): ${primaryResult.label} = ${currResults}. Jenis: ${primaryResult.kind}.
- Hasil Meta Tercatat: ${currResults} ${classification.resultLabel}
- CPR Aktual pada acuan di atas: ${currCpr !== null ? formatRp(currCpr, locale) : "Tidak tersedia"}
- CTR Link: ${formatPct(currLinkCtr, locale)}
- Frekuensi: ${formatFreq(currFrequency, locale)}
- Jangkauan: ${currReach !== null ? currReach.toLocaleString(locale === "en" ? "en-US" : "id-ID") : "Tidak tersedia (reach multi-hari tidak dijumlahkan sebagai reach unik)"}
- Percakapan Messaging: ${currAgg.messagingConversations !== null ? currAgg.messagingConversations : "Tidak tersedia"} (biaya per percakapan: ${currAgg.costPerMessagingConversation !== null ? formatRp(currAgg.costPerMessagingConversation, locale) : "Tidak tersedia"})
- Hasil keputusan CTWA adalah percakapan pesan. Jangan memakai prospek formulir atau lead pixel sebagai hasil iklan.
- Qualified Lead = Hot + Warm pada catatan CTWA yang tertaut. Cold bukan qualified lead. Jumlah percakapan Meta dan jumlah catatan CRM tidak disamakan.
${formatCrmContextForPrompt(crmContext)}
- Data Pembanding: Belanja ${formatRp(prevSpend, locale)}, Hasil ${prevResults}, CPR ${formatRp(prevCpr, locale)}
- Status Evaluasi Sistem:
  * Status Data: ${deterministicOutput.evaluator.data_status} (${deterministicOutput.evaluator.data_status_reason})
  * Status Performa: ${deterministicOutput.evaluator.performance_status}
  * Tindakan Disarankan: ${deterministicOutput.evaluator.action}
  * Fase Learning: ${deterministicOutput.evaluator.learning_status}
  * Sumber Konversi: ${deterministicOutput.evaluator.tracking_status}
${accountRosterPrompt(deterministicOutput.account_intelligence)}`;

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
            const data = normalizeNarrativeTree(validated.data);
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
            const fullOutput: PerformanceAnalysisOutput = {
              verdict: useDeterministicNarrative ? deterministicOutput.verdict : data.verdict,
              evaluator: deterministicOutput.evaluator,
              // Labels, values and formatted metrics always come from the
              // deterministic source of truth, even when narrative uses LLM.
              metrics: deterministicOutput.metrics,
              extra_metrics: deterministicOutput.extra_metrics,
              watchouts: deterministicWarning
                ? [deterministicWarning, ...data.watchouts.filter((item) => !item.title.startsWith("Rentang Evaluasi Sangat Panjang")).slice(0, 2)]
                : (useDeterministicNarrative ? deterministicOutput.watchouts : data.watchouts.slice(0, 3)),
              actions: useDeterministicNarrative
                ? deterministicOutput.actions
                : data.actions.slice(0, 3),
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

function accountRosterPrompt(report: AccountIntelligenceReport | undefined): string {
  if (!report) return "";
  const campaigns = report.campaign_rankings.slice(0, 12).map((item) =>
    `${item.name} | id=${item.providerId} | configured=${item.configuredStatus} | effective=${item.effectiveStatus} | spend=${item.spend} | results=${item.results ?? "null"} | cpr=${item.cpr ?? "null"} | category=${item.category} | action=${item.action} | target=${item.target.status}`
  );
  const ads = report.ad_rankings.slice(0, 12).map((item) =>
    `${item.name} | id=${item.providerId} | campaign=${item.campaignName} | configured=${item.configuredStatus} | effective=${item.effectiveStatus} | spend=${item.spend} | results=${item.results ?? "null"} | cpr=${item.cpr ?? "null"} | category=${item.category} | action=${item.action}`
  );
  return [
    "ROSTER PERIODE (hanya objek dengan aktivitas pada rentang tanggal ini; jangan menyebut atau merekomendasikan objek yang tidak ada di daftar):",
    `Inventaris: ${report.analysis_metadata.analyzed_campaign_count} campaign, ${report.analysis_metadata.analyzed_ad_count} iklan. Masuk ranking: ${report.analysis_metadata.campaigns_with_delivery} campaign, ${report.analysis_metadata.ads_with_delivery} iklan. Dikecualikan karena tidak ada aktivitas periode: ${report.analysis_metadata.excluded_campaign_count} campaign, ${report.analysis_metadata.excluded_ad_count} iklan.`,
    `Belanja akun (level iklan, sekali): ${report.account_summary.total_spend}. CPR akun: ${report.account_summary.blended_cpr ?? "null"}. Kode hasil: ${report.analysis_metadata.result_comparability}. Kode CPR: ${report.analysis_metadata.account_cpr_code}.`,
    "Dilarang menyebut iklan ACTIVE jika effective status-nya PAUSED. Dilarang menulis sesuai target jika target TARGET_NOT_CONFIGURED. Dilarang MONITOR atau SCALE untuk objek yang effective status-nya bukan ACTIVE.",
    "Hipotesis bukan fakta. Jangan menyebut isi creative, audience, atau placement sebagai penyebab. Qualified lead memakai blok CRM: Hot + Warm. Cold tidak dihitung. Prospek campaign-only bukan hasil satu iklan.",
    `Ringkasan deterministik: ${report.intelligence.executive_summary}`,
    `Keyakinan keputusan: ${report.intelligence.confidence.decision}. ${report.intelligence.confidence.explanation}`,
    ...report.intelligence.key_findings.map((item) => `${item.certainty}: ${item.title}. ${item.diagnosis}`),
    ...report.intelligence.data_gaps.map((item) => `DATA_GAP ${item.field}: ${item.impact_on_analysis}`),
    ...campaigns,
    ...ads,
  ].join("\n");
}

async function loadInsightPages(
  db: Awaited<ReturnType<typeof createClient>>,
  input: { organizationId: string; adIds: string[]; since?: string; until?: string }
) {
  const chunks: Array<string[] | null> = input.adIds.length
    ? Array.from({ length: Math.ceil(input.adIds.length / 80) }, (_, index) => input.adIds.slice(index * 80, index * 80 + 80))
    : [null];
  let columns = "ad_id, spend, impressions, clicks, reach, link_clicks, conversions, action_breakdown, conversion_action_type, date_start";
  const rows: Array<{
    ad_id?: string | null;
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
