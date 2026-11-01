import { NextRequest, NextResponse } from "next/server";
import { finishAiAnalysis, validateIdempotencyKey, reserveAiAnalysis } from "@/lib/ai/usage-quota";
import { z } from "zod";
import { isMetaModelApiConfigured, getMetaConfig } from "@/lib/ai/meta/config";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { parseDateRange, getEquivalentPreviousPeriod } from "@/lib/ads/date-utils";
import { classifyResult } from "@/lib/ads/service";
import { aggregateAdInsights } from "@/lib/ads/aggregation";
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
    .default("7d"),
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
  };
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
        label: z.string(),
        value: z.number(),
        display: z.string(),
        delta_pct: z.number().nullable(),
        delta_note: z.string().nullable(),
        vs_target: z.enum(["better", "on_target", "worse", "no_target"]),
        trend_7d: z.array(z.number()).nullable().optional(),
      })
    )
    .length(4),
  extra_metrics: z.array(
    z.object({
      label: z.string(),
      display: z.string(),
      note: z.string().optional(),
    })
  ),
  watchouts: z
    .array(
      z.object({
        severity: z.enum(["ok", "warn", "critical"]),
        title: z.string(),
        insight: z.string(),
      })
    )
    .max(3),
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
    .max(3),
});

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
  return JSON.parse(cleaned);
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
  } else if (
    evalResult.performanceStatus === "memenuhi_target" &&
    evalResult.dataStatus === "cukup" &&
    results >= 30 &&
    targetCpr !== null &&
    frequency !== null && frequency > 0 &&
    frequency < 2.5
  ) {
    verdictStatus = "scale";
  } else {
    verdictStatus = "maintain";
  }

  const confidenceLevel: "high" | "medium" | "low" =
    evalResult.dataStatus === "cukup" ? "high" : evalResult.dataStatus === "terbatas" ? "medium" : "low";

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

  const ctrVsTarget =
    linkCtr === null
      ? "no_target"
      : linkCtr >= 1.0
      ? "better"
      : linkCtr >= 0.6
      ? "on_target"
      : "worse";

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
      label: "Hasil Konversi",
      value: results,
      display: results.toLocaleString("id-ID"),
      delta_pct: evalResult.comparisons.results.percentageDelta,
      delta_note: evalResult.comparisons.results.displayDelta,
      vs_target: results > 0 ? "better" : "worse",
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

  if (linkCtr !== null && linkCtr < 0.6) {
    watchouts.push({
      severity: "warn",
      title: loc === "id" ? `CTR ${formatPct(linkCtr, loc)} — di bawah standar` : `CTR ${formatPct(linkCtr, loc)} — below benchmark`,
      insight: loc === "id"
        ? "Hook 3 detik pertama perlu penyegaran visual atau variasi sudut pandang."
        : "First 3-second hook needs visual refresh or new creative angle.",
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

  if (watchouts.length === 0) {
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
    meta: {
      source: "Meta Ads Insights (Snapshot Tersinkron)",
      generated_at: new Date().toISOString(),
      engine: "rules",
      period: periodLabel,
      scope,
      target_cpr: targetCpr,
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
        .select("id, provider_account_id, account_name")
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
        .select("id")
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
      let effectiveRangeKey = "7d";
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

    if (scope === "campaign") {
      if (!targetId) {
        return NextResponse.json(
          { success: false, error: "Campaign ID wajib disertakan untuk cakupan per-campaign" },
          { status: 400 }
        );
      }

      const { data: campaign } = await db
        .from("campaigns")
        .select("id, name, objective")
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
        .select("id, name, campaign_id, campaigns(name, objective)")
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
      const cmp = adRow.campaigns as { name?: string; objective?: string } | null;
      targetObjective = cmp?.objective || null;
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
    }

    // 6. Fetch Insights from Database
    let currentInsights: Array<{
      spend: number | null;
      impressions: number | null;
      clicks: number | null;
      reach: number | null;
      link_clicks: number | null;
      conversions: number | null;
      date_start: string | null;
    }> = [];

    // Only query if entire account OR we have matching ads for the entity
    if (scope === "account" || targetAdIds.length > 0) {
      const buildCurrentQuery = (columns: string) => {
        let q = db
          .from("ad_insights")
          .select(columns)
          .eq("organization_id", organizationId);
        if (since) q = q.gte("date_start", since);
        if (until) q = q.lte("date_stop", until);
        if (targetAdIds.length > 0) q = q.in("ad_id", targetAdIds);
        return q;
      };
      // action_breakdown/conversion_action_type arrive with migration
      // 20261027000000 (not applied everywhere yet): fall back to core
      // columns rather than failing the whole analysis.
      let currentResult = await buildCurrentQuery("spend, impressions, clicks, reach, link_clicks, conversions, action_breakdown, conversion_action_type, date_start");
      if (currentResult.error) {
        currentResult = await buildCurrentQuery("spend, impressions, clicks, reach, link_clicks, conversions, date_start");
      }
      const { data: insData, error: insError } = currentResult;
      if (insError) {
        return NextResponse.json(
          { success: false, error: "Gagal membaca insight iklan dari basis data" },
          { status: 500 }
        );
      }
      if (insData) currentInsights = insData as unknown as typeof currentInsights;
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
      let prevInsightsQuery = db
        .from("ad_insights")
        .select("spend, impressions, clicks, reach, link_clicks, conversions")
        .eq("organization_id", organizationId)
        .gte("date_start", prevSince)
        .lte("date_stop", prevUntil);

      if (targetAdIds.length > 0) {
        prevInsightsQuery = prevInsightsQuery.in("ad_id", targetAdIds);
      }

      const { data: pData } = await prevInsightsQuery;
      if (pData) prevInsights = pData;
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
    const currResults = currAgg.results ?? 0;

    const dailyMap = new Map<string, { spend: number; results: number; clicks: number; impressions: number }>();

    (currentInsights || []).forEach((row) => {
      const s = Number(row.spend) || 0;
      const imp = Number(row.impressions) || 0;
      const lk = Number(row.link_clicks) || 0;
      const conv = Number(row.conversions) || 0;

      const d = String(row.date_start || "").slice(0, 10);
      if (d) {
        const existing = dailyMap.get(d) || { spend: 0, results: 0, clicks: 0, impressions: 0 };
        existing.spend += s;
        existing.results += conv;
        existing.clicks += lk;
        existing.impressions += imp;
        dailyMap.set(d, existing);
      }
    });

    const currLinkCtr = currAgg.linkCtr;
    const currLinkCpc = currAgg.linkCpc;
    const currAllCtr = currAgg.allCtr;
    const currAllCpc = currAgg.allCpc;
    const currCpm = currAgg.cpm;
    const currCpr = currAgg.costPerResult;
    const currFrequency = currAgg.frequency;

    // Daily Sparkline Trend Arrays
    const sortedDays = Array.from(dailyMap.keys()).sort();
    const trendSpend: number[] = [];
    const trendResults: number[] = [];
    const trendCpr: number[] = [];
    const trendCtr: number[] = [];

    sortedDays.forEach((day) => {
      const item = dailyMap.get(day)!;
      trendSpend.push(Math.round(item.spend));
      trendResults.push(item.results);
      trendCpr.push(item.results > 0 ? Math.round(item.spend / item.results) : 0);
      trendCtr.push(item.impressions > 0 ? Number(((item.clicks / item.impressions) * 100).toFixed(2)) : 0);
    });

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
    };

    // Calculate deterministic analysis first as ground truth
    const deterministicOutput = buildDeterministicAnalysis(deterministicParams);

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

        const systemPrompt = `Kamu adalah Senior Meta Ads Strategist untuk bisnis properti di Indonesia (10+ tahun pengalaman, biasa mengelola anggaran besar).
Tugasmu: menghasilkan output analisis iklan yang SINGKAT, TAJAM, dan MUDAH DISCAN dalam 10 detik.

BAHASA: Gunakan Bahasa Indonesia profesional secara konsisten. Jangan menulis kalimat atau label dalam Bahasa Inggris; istilah CPR, CTR, CPM, Ad Set, dan Stop-Loss boleh dipertahankan.

PRINSIP WAJIB & INTEGRITAS DATA:
1. Verdict dulu, detail belakangan.
2. Gaya bahasa advertiser/performance marketer profesional (istilah: CPR, CTR, CPM, scaling, fatigue, hook, stop-loss).
3. Kalimat pendek, aktif, to the point. Maksimal 20 kata per kalimat. Hindari jargon kaku ("denominator", "mengindikasikan", "adapun").
4. Format angka: Rp 6.811 (spasi setelah Rp), 0,68% (koma desimal Indonesia), 1,04x.
5. JANGAN PERNAH menyimpulkan iklan "boncos" atau menyarankan mematikan iklan jika status data adalah "terbatas" atau durasi <= 1 hari.
6. HANYA rekomendasikan uji hook baru jika CTR link < 0.8% DAN CPR di atas target, atau frekuensi >= 2.5. Jika CPR sudah bagus, JANGAN sarankan perbaiki CTR.
7. Fase Learning: Tampilkan "Hanya berlaku pada level Ad Set yang sedang aktif tayang".
8. JANGAN membuat kesimpulan atau rekomendasi berdasarkan CRM, kualitas lead penjualan, survei, atau closing karena bukan dari sumber data Meta Ads.
9. Jika frekuensi tidak tersedia, JANGAN menyebut frekuensi/frequency di headline, subtext, watchouts, why, do, atau stop_loss. Gunakan CPR aktual, batas CPR sebesar 130% dari CPR aktual dibulatkan ke Rp 100 terdekat, dan CTR tautan.
10. Bedakan CPR aktual dari target CPR. Sebut hasil Meta sebagai "hasil tercatat", bukan "hasil terverifikasi".
11. Jika periode lebih dari 60 hari, tambahkan watchout rentang evaluasi sangat panjang dan sarankan filter 7 atau 14 hari terakhir.
9. Format output WAJIB JSON persis sesuai schema berikut:
{
  "verdict": {
    "status": "scale|maintain|optimize|stop",
    "headline": "string, maks 12 kata",
    "subtext": "string, maks 20 kata (berisi 2 angka paling penting)",
    "confidence": { "level": "high|medium|low", "reason": "string singkat" }
  },
  "metrics": [
    { "key": "spend|results|cpr|ctr", "label": "string", "value": number, "display": "string", "delta_pct": number|null, "delta_note": "string|null", "vs_target": "better|on_target|worse|no_target", "trend_7d": [number]|null }
  ],
  "extra_metrics": [ { "label": "...", "display": "..." } ],
  "watchouts": [ { "severity": "ok|warn|critical", "title": "maks 6 kata", "insight": "1 kalimat" } ],
  "actions": [ { "priority": "high|medium|low", "title": "maks 8 kata diawali kata kerja", "why": "1 kalimat berangka", "do": "1 kalimat spesifik", "stop_loss": "1 kalimat" } ]
}`;

        const userPrompt = `Data Kampanye Properti:
- Objek: ${targetName} (${scope})
- Periode: ${periodLabel} (${durationDays} hari, Timezone: ${timezone})
- Target CPR: ${targetCpr ? formatRp(targetCpr, locale) : "Belum diatur"}
- Belanja: ${formatRp(currSpend, locale)}
- Hasil Meta Tercatat: ${currResults} ${classification.resultLabel}
- CPR Aktual: ${currCpr !== null ? formatRp(currCpr, locale) : "Tidak tersedia"}
- CTR Link: ${formatPct(currLinkCtr, locale)}
- Frekuensi: ${formatFreq(currFrequency, locale)}
- Jangkauan: ${currReach !== null ? currReach.toLocaleString(locale === "en" ? "en-US" : "id-ID") : "Tidak tersedia (reach multi-hari tidak dijumlahkan sebagai reach unik)"}
- Percakapan Messaging: ${currAgg.messagingConversations !== null ? currAgg.messagingConversations : "Tidak tersedia"} (biaya per percakapan: ${currAgg.costPerMessagingConversation !== null ? formatRp(currAgg.costPerMessagingConversation, locale) : "Tidak tersedia"})
- Leads Meta: ${currAgg.leads !== null ? currAgg.leads : "Tidak tersedia"} (biaya per lead: ${currAgg.costPerLead !== null ? formatRp(currAgg.costPerLead, locale) : "Tidak tersedia"})
- Kualitas Lead / CPQL: Tidak tersedia (tidak ada sumber kualitas lead yang terverifikasi; jangan menyimpulkan kualitas lead atau performa sales)
- Data Pembanding: Belanja ${formatRp(prevSpend, locale)}, Hasil ${prevResults}, CPR ${formatRp(prevCpr, locale)}
- Status Evaluasi Sistem:
  * Status Data: ${deterministicOutput.evaluator.data_status} (${deterministicOutput.evaluator.data_status_reason})
  * Status Performa: ${deterministicOutput.evaluator.performance_status}
  * Tindakan Disarankan: ${deterministicOutput.evaluator.action}
  * Fase Learning: ${deterministicOutput.evaluator.learning_status}
  * Sumber Konversi: ${deterministicOutput.evaluator.tracking_status}`;

        const response = await client.createChatCompletion({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 1500,
        });

        const rawContent = response.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsedJson = parseModelJson(rawContent);
          const validated = ModelResponseSchema.safeParse(parsedJson);

          if (validated.success) {
            const data = validated.data;
            const generatedText = [
              data.verdict.headline,
              data.verdict.subtext,
              data.verdict.confidence.reason,
              ...data.watchouts.flatMap((item) => [item.title, item.insight]),
              ...data.actions.flatMap((item) => [item.title, item.why, item.do, item.stop_loss]),
            ].join(" ");
            const missingFrequency = currFrequency === null || currFrequency <= 0;
            const containsEnglishSentence = /\b(the|and|with|from|this|that|these|those|is|are|was|were|should|could|would|because|while|when|above|below|maintain|increase|decrease|pause|review|results|verified|frequency|performance|campaign|creative|budget|delivery|link|click|cost|good|high|low|healthy|recommend|focus|check|spend|lead|scale|stop|monitor|impression|reach|learning|tracking|conversion|ad\s+set)\b/i.test(generatedText);
            const mentionsUnavailableFrequency = missingFrequency && /\b(frequency|frekuensi)\b/i.test(generatedText);
            const hasNonIndonesianNumberFormat = /Rp(?!\s)\d|Rp\s+\d{1,3}(?:,\d{3})+|\b\d+\.\d{1,2}%/.test(generatedText);
            const useDeterministicNarrative = containsEnglishSentence || mentionsUnavailableFrequency || missingFrequency || hasNonIndonesianNumberFormat;
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
              meta: {
                source: "Meta Ads Insights (Snapshot Tersinkron)",
                generated_at: new Date().toISOString(),
                engine: useDeterministicNarrative ? "rules" : "llm",
                period: periodLabel,
                scope,
                target_cpr: targetCpr ?? null,
              },
            };

            if (reservation.reservationId && !(await finishAiAnalysis(user.id, reservation.reservationId, true))) {
              return NextResponse.json({ success: false, error: "Analisis selesai tetapi pencatatan kuota belum terkonfirmasi. Segarkan penggunaan sebelum mencoba lagi.", code: "QUOTA_COMMIT_FAILED" }, { status: 503 });
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
