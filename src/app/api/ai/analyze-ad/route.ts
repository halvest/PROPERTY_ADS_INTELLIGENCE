import { NextRequest, NextResponse } from "next/server";
import { finishAiAnalysis, validateIdempotencyKey, reserveAiAnalysis } from "@/lib/ai/usage-quota";
import { z } from "zod";
import { isMetaModelApiConfigured, maskApiKey, getMetaConfig } from "@/lib/ai/meta/config";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { aggregateAdInsights, type AdInsightRowLike, type AdMetricsAggregate } from "@/lib/ads/aggregation";
import { parseDateRange } from "@/lib/ads/date-utils";
import { evaluateAdsPerformance } from "@/lib/ads/performance-evaluator";
import { sanitizeUntrustedText, wrapUntrustedChatBlock } from "@/lib/ai/sanitize-untrusted-text";
import { CtwaModelOutputSchema as ModelOutputSchema } from "@/lib/ai/ctwa-analysis/schema";
import { applyGuardrailsToModelOutput } from "@/lib/ai/ctwa-analysis/guardrails";
import { effectiveDeliveryStatus } from "@/lib/ai/ctwa-analysis/dynamic-context";
import { CTWA_SYSTEM_PROMPT, buildCtwaUserPrompt } from "@/lib/ai/ctwa-analysis/prompt";
import { composeAdCardCopy } from "@/lib/ai/ctwa-analysis/ad-card-copy";
import { parseModelJson } from "@/lib/ai/parse-model-json";
import type { CtwaGroundTruthMetrics } from "@/lib/ai/ctwa-analysis/types";
import { summarizeCrmForAd, type CrmAdSummary } from "@/lib/crm/ad-drawer-crm";
import { buildCrmAnalysisContext, calendarDayBounds, formatCrmContextForPrompt } from "@/lib/crm/crm-analysis-context";

// Request Schema
const AnalyzeAdRequestSchema = z.object({
  adId: z.string().optional(),
  adName: z.string().min(1, "Nama iklan wajib disertakan"),
  campaignName: z.string().optional(),
  campaignObjective: z.string().nullable().optional(),
  status: z.string().optional(),
  /** Same presets as GET /api/ads → getAdsIntelligenceData (default 30d). */
  dateRange: z.string().default("30d"),
  locale: z.enum(["id", "en"]).optional().default("id"),
  metrics: z.object({
    spend: z.number().default(0),
    impressions: z.number().default(0),
    reach: z.number().nullable().default(null),
    linkClicks: z.number().default(0),
    allClicks: z.number().default(0),
    linkCtr: z.number().nullable().optional(),
    allCtr: z.number().nullable().optional(),
    linkCpc: z.number().nullable().optional(),
    allCpc: z.number().nullable().optional(),
    cpm: z.number().nullable().optional(),
    results: z.number().default(0),
    costPerResult: z.number().nullable().optional(),
    /** BL-01 separated result types (server-filled; client values are overwritten). */
    messagingConversations: z.number().nullable().optional(),
    leads: z.number().nullable().optional(),
    costPerMessagingConversation: z.number().nullable().optional(),
    costPerLead: z.number().nullable().optional(),
    resultType: z.string().optional().default("Percakapan WhatsApp / Hasil"),
    resultsTrackingStatus: z
      .enum(["TERVERIFIKASI ADA", "TERVERIFIKASI NOL", "BELUM TERVERIFIKASI", "DATA TIDAK KONSISTEN"])
      .optional(),
    attributedLeads: z.number().default(0),
    /** Legacy field: lead quality is not available from a verified source; server always sets null. */
    qualifiedLeads: z.number().nullable().default(null),
    costPerQualifiedLead: z.number().nullable().optional(),
    // Backward compatibility aliases
    clicks: z.number().optional(),
    ctr: z.number().nullable().optional(),
    cpc: z.number().nullable().optional(),
    cpql: z.number().nullable().optional(),
    avgBuyerScore: z.number().nullable().optional(),
  }),
  propertyContext: z
    .object({
      propertyType: z.string().optional(),
      projectName: z.string().optional(),
      priceRange: z.string().optional(),
      location: z.string().optional(),
    })
    .optional(),
});

export type WhatsAppVerificationStatus = SourceVerificationStatus;
type SourceVerificationStatus =
  | "TERVERIFIKASI ADA"
  | "TERVERIFIKASI NOL"
  | "BELUM TERVERIFIKASI"
  | "DATA TIDAK KONSISTEN";

export type BudgetDecisionKey =
  | "NAIKKAN"
  | "PERTAHANKAN"
  | "TAHAN KENAIKAN"
  | "KURANGI"
  | "HENTIKAN SEMENTARA";

export interface SourceDataStatusSection {
  metaResults: string;
  crmProspects: string;
  crmLines?: string[];
  note?: string | null;
}

export interface BudgetDecisionSection {
  decision: BudgetDecisionKey;
  reason: string;
}

export interface KeyFindingItem {
  finding: string;
  evidence: string;
  impact: string;
  isHypothesis?: boolean;
}

export interface PriorityActionItem {
  action: string;
  howToCheck: string;
  expectedResult: string;
}

export interface CoreMetricItem {
  id: string;
  label: string;
  formattedValue: string;
  rawValue: number | null;
  isValid: boolean;
  note?: string;
}

export interface AdditionalDetails {
  funnelEvaluation: {
    firstFailingStage: string;
    explanation: string;
  };
  facts: string[];
  hypotheses: string[];
  unknowns: string[];
  allMetrics: Array<{
    label: string;
    value: string;
    explanation: string;
  }>;
  creativeNotes?: string | null;
}

// Full Validated AI Ad Analysis Response Contract
export interface AIAdAnalysisResponse {
  isLiveAi: boolean;
  provider: string;
  model: string;
  maskedApiKey: string;
  analyzedAt: string;
  adName: string;
  campaignName?: string;
  campaignObjective?: string | null;

  // A. Ringkasan Kinerja (Maksimal 3–4 baris)
  performanceSummary: string;

  // B. Sumber data yang dipakai
  sourceDataStatus: SourceDataStatusSection;

  // C. Keputusan (Satu keputusan utama + alasan maks 2 kalimat)
  budgetDecision: BudgetDecisionSection;

  // D. Maksimal 3 Temuan Penting
  keyFindings: KeyFindingItem[];

  // E. Maksimal 3 Tindakan Prioritas
  priorityActions: PriorityActionItem[];

  // F. Metrik Utama (Maksimal 6 metrik)
  coreMetrics: CoreMetricItem[];

  // G. Detail Tambahan
  additionalDetails: AdditionalDetails;

  // Backward-compatibility bridges
  executiveSummary: string;
  actionDecision: {
    priority: "PERTAHANKAN" | "PANTAU" | "UJI_VARIASI" | "OPTIMALKAN" | "EVALUASI_PENGHENTIAN";
    priorityLabel: string;
    headline: string;
    justification: string;
  };

  recommended_action?: "SCALE" | "MAINTAIN" | "OPTIMIZE" | "STOP" | "INVESTIGATE" | "RE_ACTIVATE";
  chain_of_thought?: {
    meta_metrics: string;
    chat_semantics: string;
    score_conclusion: string;
  };
  context_awareness?: {
    analyzed_scope: "Account" | "Campaign" | "Ad";
    entity_status: "Active" | "Paused" | "Unknown";
    period_confidence: "High" | "Medium" | "Low";
    period_days: number;
  };
}

/**
 * Format currency without space after Rp (e.g. Rp323.001)
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "Tidak dapat dihitung";
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

/**
 * Builds Meta performance metrics alongside CRM data supplied by the client.
 * CRM lead costs are only shown when imported records are available.
 */
export function buildCoreMetrics(params: {
  spend: number;
  linkClicks: number;
  linkCpc: number | null;
  metaConversations: number | null;
  crmLeadsCount?: number | null;
  crmMetricNote?: string | null;
  verifiedWhatsAppMessages?: number | null;
  hasActiveIntegration?: boolean;
  costPerConversation?: number | null;
  isCostPerConversationValid?: boolean;
  costPerConversationNote?: string;
  locale?: "id" | "en";
}): CoreMetricItem[] {
  const {
    spend,
    linkClicks,
    linkCpc,
    metaConversations,
    crmLeadsCount = null,
    crmMetricNote = null,
    locale = "id",
  } = params;
  const isEn = locale === "en";
  const numLocale = isEn ? "en-US" : "id-ID";
  const fmtMoney = (amt: number | null | undefined) => {
    if (amt === null || amt === undefined || Number.isNaN(amt)) {
      return isEn ? "Cannot be calculated" : "Tidak dapat dihitung";
    }
    return `Rp${Math.round(amt).toLocaleString(numLocale)}`;
  };

  return [
    {
      id: "spend",
      label: isEn ? "Ad Spend" : "Belanja Iklan",
      rawValue: spend,
      formattedValue: fmtMoney(spend),
      isValid: true,
    },
    {
      id: "linkClicks",
      label: isEn ? "Link Clicks" : "Klik Tautan",
      rawValue: linkClicks,
      formattedValue: isEn
        ? `${linkClicks.toLocaleString(numLocale)} link clicks`
        : `${linkClicks.toLocaleString(numLocale)} klik tautan`,
      isValid: true,
    },
    {
      id: "linkCpc",
      label: isEn ? "Link CPC" : "CPC Tautan",
      rawValue: linkCpc,
      formattedValue:
        linkCpc !== null
          ? `${fmtMoney(linkCpc)} / ${isEn ? "click" : "klik"}`
          : isEn
          ? "Cannot be calculated"
          : "Tidak dapat dihitung",
      isValid: linkCpc !== null,
    },
    {
      id: "metaConversations",
      label: isEn ? "Meta Reported Results" : "Hasil menurut Meta",
      rawValue: metaConversations,
      formattedValue:
        metaConversations !== null
          ? `${metaConversations.toLocaleString(numLocale)} ${isEn ? "results" : "hasil"}`
          : isEn
          ? "Unavailable"
          : "Tidak tersedia",
      isValid: metaConversations !== null,
    },
    {
      id: "crmLeads",
      label: isEn ? "Recorded CRM Leads" : "Prospek CRM Tercatat",
      rawValue: crmLeadsCount,
      formattedValue:
        crmLeadsCount === null
          ? isEn
            ? "Not available yet"
            : "Belum tersedia"
          : `${crmLeadsCount.toLocaleString(numLocale)} ${isEn ? "leads" : "prospek"}`,
      isValid: crmLeadsCount !== null,
      note:
        crmMetricNote ||
        (isEn
          ? "Number of leads storing this ad's ad_id, not the entire workspace."
          : "Jumlah prospek yang menyimpan ad_id iklan ini, bukan seluruh workspace."),
    },
    {
      id: "costPerCrmLead",
      label: isEn ? "Cost per CRM Lead" : "Biaya per Prospek CRM",
      rawValue: crmLeadsCount !== null && crmLeadsCount > 0 ? Number((spend / crmLeadsCount).toFixed(2)) : null,
      formattedValue:
        crmLeadsCount !== null && crmLeadsCount > 0
          ? `${fmtMoney(spend / crmLeadsCount)} / ${isEn ? "lead" : "prospek"}`
          : isEn
          ? "Cannot be calculated"
          : "Tidak dapat dihitung",
      isValid: crmLeadsCount !== null && crmLeadsCount > 0,
      note: isEn
        ? "Meta spend divided by CRM leads attributed to this ad."
        : "Belanja Meta dibagi jumlah prospek CRM terkait dengan iklan ini.",
    },
  ];
}

/**
 * Helper to build verified metrics summary (backward-compatible).
 */
export function buildVerifiedMetricsSummary(params: {
  spend: number;
  impressions: number;
  reach: number | null;
  linkClicks: number;
  allClicks: number;
  linkCtr?: number | null;
  allCtr?: number | null;
  linkCpc?: number | null;
  allCpc?: number | null;
  cpm?: number | null;
  results?: number;
  costPerResult?: number | null;
  qualifiedLeads?: number;
  resultsTrackingStatus?: string;
}) {
  const {
    spend,
    impressions,
    reach,
    linkClicks,
    allClicks,
    linkCtr,
    allCtr,
    linkCpc,
    allCpc,
    cpm,
    results,
    costPerResult,
    qualifiedLeads,
    resultsTrackingStatus,
  } = params;

  const formatRpSpace = (amt: number | null | undefined) => {
    if (amt === null || amt === undefined || Number.isNaN(amt)) return "Tidak dapat dihitung";
    return `Rp ${Math.round(amt).toLocaleString("id-ID")}`;
  };

  const calculatedLinkCtr = impressions > 0 && linkClicks > 0 ? Number(((linkClicks / impressions) * 100).toFixed(2)) : (linkCtr ?? null);
  const calculatedLinkCpc = linkClicks > 0 ? Number((spend / linkClicks).toFixed(2)) : (linkCpc ?? null);
  const calculatedCpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : (cpm ?? null);
  const calculatedCpr = (results ?? 0) > 0 ? Number((spend / (results ?? 1)).toFixed(2)) : (costPerResult ?? null);
  const clickToConversationRatio = linkClicks > 0 && (results ?? 0) > 0 ? Number((((results ?? 0) / linkClicks) * 100).toFixed(2)) : null;

  return [
    {
      id: "spend",
      label: "Total Belanja Iklan",
      rawValue: spend > 0 ? spend : null,
      formattedValue: spend > 0 ? formatRpSpace(spend) : "Rp 0",
      plainExplanation: "Total saldo anggaran yang ditagihkan oleh sistem Meta Ads.",
    },
    {
      id: "impressions",
      label: "Penayangan (Impressions)",
      rawValue: impressions > 0 ? impressions : null,
      formattedValue: impressions > 0 ? `${impressions.toLocaleString("id-ID")} tayangan` : "Tidak tersedia",
      plainExplanation: "Jumlah berapa kali layar audiens menampilkan materi iklan Anda.",
    },
    {
      id: "reach",
      label: "Jangkauan (Reach)",
      rawValue: reach !== null && reach > 0 ? reach : null,
      formattedValue: reach !== null && reach > 0 ? `${reach.toLocaleString("id-ID")} orang` : "Tidak tersedia",
      plainExplanation: "Jumlah individu unik yang melihat materi iklan properti ini.",
    },
    {
      id: "linkClicks",
      label: "Klik Tautan (Link Clicks)",
      rawValue: linkClicks > 0 ? linkClicks : null,
      formattedValue: linkClicks > 0 ? `${linkClicks.toLocaleString("id-ID")} klik` : "0 klik",
      plainExplanation: "Calon pembeli yang menekan tombol spesifik menuju WhatsApp atau halaman tujuan.",
    },
    {
      id: "allClicks",
      label: "Semua Klik (Interaksi Post)",
      rawValue: allClicks > 0 ? allClicks : null,
      formattedValue: allClicks > 0 ? `${allClicks.toLocaleString("id-ID")} interaksi` : "0 interaksi",
      plainExplanation: "Semua sentuhan pada kartu iklan termasuk komentar, bagikan, foto profil, dan teks selengkapnya.",
    },
    {
      id: "linkCtr",
      label: "Rasio Klik Tautan (Link CTR)",
      rawValue: calculatedLinkCtr,
      formattedValue: calculatedLinkCtr !== null ? `${calculatedLinkCtr}%` : "Tidak dapat dihitung",
      plainExplanation: "Persentase audiens yang melanjutkan ke WhatsApp setelah melihat materi iklan.",
    },
    {
      id: "allCtr",
      label: "Rasio Semua Klik (All CTR)",
      rawValue: allCtr ?? null,
      formattedValue: allCtr !== null && allCtr !== undefined ? `${allCtr}%` : "Tidak dapat dihitung",
      plainExplanation: "Persentase penonton yang melakukan interaksi apa pun pada postingan iklan.",
    },
    {
      id: "linkCpc",
      label: "Biaya per Klik Tautan (Link CPC)",
      rawValue: calculatedLinkCpc,
      formattedValue: calculatedLinkCpc !== null ? formatRpSpace(calculatedLinkCpc) : "Tidak dapat dihitung",
      plainExplanation: "Biaya yang Anda bayar untuk setiap calon pembeli yang menekan tombol WhatsApp.",
    },
    {
      id: "allCpc",
      label: "Biaya per Semua Klik (All CPC)",
      rawValue: allCpc ?? null,
      formattedValue: allCpc !== null && allCpc !== undefined ? formatRpSpace(allCpc) : "Tidak dapat dihitung",
      plainExplanation: "Rata-rata biaya untuk seluruh jenis interaksi klik pada postingan.",
    },
    {
      id: "cpm",
      label: "Biaya per 1.000 Tayangan (CPM)",
      rawValue: calculatedCpm,
      formattedValue: calculatedCpm !== null ? formatRpSpace(calculatedCpm) : "Tidak dapat dihitung",
      plainExplanation: "Biaya untuk menampilkan materi iklan kepada 1.000 tayangan audiens.",
    },
    {
      id: "results",
      label: "Percakapan Masuk (Results)",
      rawValue: (results ?? 0) > 0 ? results : null,
      formattedValue:
        resultsTrackingStatus === "BELUM_TERSEDIA"
          ? "Data belum tersedia"
          : (results ?? 0) > 0
          ? `${results} percakapan`
          : "0 percakapan",
      status: resultsTrackingStatus,
      plainExplanation: "Hasil yang dilaporkan Meta untuk kampanye iklan ini.",
    },
    {
      id: "costPerResult",
      label: "Biaya per Percakapan Masuk",
      rawValue: calculatedCpr,
      formattedValue: calculatedCpr !== null ? formatRpSpace(calculatedCpr) : "Tidak dapat dihitung",
      plainExplanation: "Efisiensi pengeluaran anggaran untuk setiap pesan kontak yang berhasil didapatkan.",
    },
    {
      id: "clickToConversationRatio",
      label: "Rasio Klik ke Percakapan",
      rawValue: clickToConversationRatio,
      formattedValue: clickToConversationRatio !== null ? `${clickToConversationRatio}%` : "Tidak dapat dihitung",
      plainExplanation: "Persentase calon pembeli yang menekan tombol dan benar-benar mengirimkan pesan.",
    },
    {
      id: "qualifiedLeads",
      label: "Prospek Berkualitas (CRM)",
      rawValue: (qualifiedLeads ?? 0) > 0 ? qualifiedLeads : null,
      formattedValue: qualifiedLeads === undefined || qualifiedLeads === null ? "Data tidak tersedia" : `${qualifiedLeads} prospek`,
      plainExplanation: "Qualified Lead = Hot + Warm. Cold bukan qualified lead. CQPL tidak ditampilkan sebagai Rp0 bila qualified lead nol.",
    },
  ];
}

/**
 * Deterministic HD Creative Property Intelligence Engine.
 * Formulates succinct, professional, and business-driven decisions
 * strictly following Section 1-7 rules.
 */
function generateDeterministicAdAnalysis(
  input: z.infer<typeof AnalyzeAdRequestSchema>,
  context: {
    hasActiveIntegration: boolean;
    metaConversions: number | null;
    verifiedInboundMessages: number | null;
    crmLeadsCount: number | null;
    crmSummary?: CrmAdSummary | null;
    crmSurveysCount: number;
    crmClosingsCount: number;
    detectedStatus?: SourceVerificationStatus;
  }
): AIAdAnalysisResponse {
  const { adName, campaignName, campaignObjective, metrics } = input;
  const nowIso = new Date().toISOString();

  const spend = metrics.spend;
  const impressions = metrics.impressions;
  const reach = metrics.reach;
  const linkClicks = metrics.linkClicks || metrics.clicks || 0;
  const allClicks = metrics.allClicks || metrics.clicks || 0;

  const linkCtr = impressions > 0 ? Number(((linkClicks / impressions) * 100).toFixed(2)) : null;
  const linkCpc = linkClicks > 0 ? Number((spend / linkClicks).toFixed(2)) : null;
  const cpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null;

  const metaConversations = context.metaConversions ?? (metrics.results > 0 ? metrics.results : null);
  const verifiedMessages = context.verifiedInboundMessages;
  const crmLeads = context.crmLeadsCount;
  const crmSummary = context.crmSummary;

  // Determine conversation verification status
  let verificationStatus: SourceVerificationStatus = context.detectedStatus || "BELUM TERVERIFIKASI";
  let statusNote: string | null = null;
  let isCostPerConversationValid = false;
  let costPerConversation: number | null = null;
  let costNote = "";

  // Check data inconsistency rules (Section 3)
  const metaReportedCostPerResult = metrics.costPerResult;
  const effectiveChats = verifiedMessages ?? (metaConversations || 0);

  if (metaReportedCostPerResult !== null && metaReportedCostPerResult !== undefined && metaReportedCostPerResult > 0 && effectiveChats === 0) {
    verificationStatus = "DATA TIDAK KONSISTEN";
    statusNote = "Biaya per percakapan tercatat positif di Meta namun jumlah percakapan adalah nol.";
    costNote = "Biaya tidak valid karena jumlah percakapan nol.";
  } else if (context.hasActiveIntegration && (metaConversations || 0) > 0 && verifiedMessages === 0) {
    verificationStatus = "DATA TIDAK KONSISTEN";
    statusNote = "Meta melaporkan percakapan, tetapi belum ada pesan masuk yang terekam pada sistem WhatsApp.";
    costNote = "Hasil Meta dan jumlah prospek CRM tidak sebanding langsung.";
  } else if (!context.hasActiveIntegration) {
    verificationStatus = "BELUM TERVERIFIKASI";
    statusNote = "Pesan tidak dikumpulkan otomatis; analisis menggunakan data CRM yang dicatat atau diunggah klien.";
    costNote = "Jumlah chat belum terverifikasi sistem.";
  } else if (context.hasActiveIntegration && verifiedMessages !== null && verifiedMessages > 0) {
    verificationStatus = "TERVERIFIKASI ADA";
    isCostPerConversationValid = true;
    costPerConversation = Number((spend / verifiedMessages).toFixed(2));
  } else if (context.hasActiveIntegration && verifiedMessages === 0 && (metaConversations === 0 || metaConversations === null)) {
    verificationStatus = "TERVERIFIKASI NOL";
    statusNote = "Belum ada data prospek yang dicatat atau diunggah klien untuk iklan ini.";
    costNote = "Tidak dapat dihitung karena belum ada chat.";
  }

  // Cost per conversation validity enforcement (Rule 3.1)
  if (effectiveChats === 0) {
    isCostPerConversationValid = false;
    costPerConversation = null;
  }

  // 1. Ringkasan Kinerja (Maksimal 3–4 baris)
  let performanceSummary = "";
  if (verificationStatus === "TERVERIFIKASI ADA" && crmLeads !== null) {
    performanceSummary = `Iklan sudah menghabiskan ${formatRupiah(spend)} dan menghasilkan ${linkClicks.toLocaleString("id-ID")} klik tautan dengan ${verifiedMessages} pesan WhatsApp masuk terverifikasi. Biaya per chat tercatat ${formatRupiah(costPerConversation)}. Lanjutkan pemantauan kualitas respon dan percepat waktu tindak lanjut admin penjualan.`;
  } else if (verificationStatus === "BELUM TERVERIFIKASI") {
    performanceSummary = `Iklan menghabiskan ${formatRupiah(spend)} dan memperoleh ${linkClicks.toLocaleString("id-ID")} klik tautan. Jumlah prospek dari input atau unggahan CRM ${crmLeads === null ? "belum tersedia" : `tercatat ${crmLeads.toLocaleString("id-ID")}`}; data ini belum mencakup pesan yang tidak dimasukkan ke CRM.`;
  } else if (verificationStatus === "DATA TIDAK KONSISTEN") {
    performanceSummary = `Iklan mencatat belanja ${formatRupiah(spend)} dan ${linkClicks.toLocaleString("id-ID")} klik tautan. Hasil Meta dan prospek CRM memiliki definisi berbeda; tinjau sumber data sebelum membandingkannya.`;
  } else {
    // TERVERIFIKASI NOL
    performanceSummary = `Iklan telah menghabiskan ${formatRupiah(spend)} dan memperoleh ${linkClicks.toLocaleString("id-ID")} klik tautan. Belum ada prospek CRM yang dicatat untuk iklan ini; pastikan catatan prospek telah dimasukkan sebelum menilai hasil setelah klik.`;
  }

  // 2. Status Hasil WhatsApp
  const sourceDataStatus: SourceDataStatusSection = {
    metaResults: metaConversations !== null ? `${metaConversations.toLocaleString("id-ID")} hasil` : "Tidak tersedia",
    crmProspects: crmSummary?.prospectsLine || (crmLeads !== null ? `${crmLeads.toLocaleString("id-ID")} prospek dari CRM` : "Belum tersedia"),
    crmLines: crmSummary?.lines,
    note: crmSummary?.note || statusNote || "Data prospek berasal dari input atau unggahan klien. Pesan tidak dikumpulkan otomatis.",
  };

  // 3. Keputusan (Satu keputusan utama + alasan maksimal 2 kalimat)
  let decision: BudgetDecisionKey = "TAHAN KENAIKAN";
  let decisionReason = "";

  if (verificationStatus === "DATA TIDAK KONSISTEN") {
    decision = "TAHAN KENAIKAN";
    decisionReason = "Hasil Meta dan prospek CRM memiliki definisi berbeda. Tinjau data sumber sebelum membandingkan keduanya untuk keputusan anggaran.";
  } else if (verificationStatus === "BELUM TERVERIFIKASI") {
    decision = "TAHAN KENAIKAN";
    decisionReason = crmLeads !== null && crmLeads > 0
      ? `CRM mencatat ${crmLeads.toLocaleString("id-ID")} prospek terkait iklan ini. Gunakan jumlah tersebut sebagai catatan yang diunggah klien, bukan sebagai verifikasi pesan otomatis.`
      : crmSummary && (crmSummary.workspaceTotal || 0) > 0
      ? "Workspace memiliki prospek pada periode ini, tetapi tidak ada yang terhubung ke iklan ini. Jangan memakai total workspace sebagai hasil iklan."
      : "Belum ada prospek CRM yang tercatat untuk iklan ini pada periode ini. Lengkapi data sebelum menilai biaya per prospek.";
  } else if (spend === 0 || impressions === 0) {
    decision = "TAHAN KENAIKAN";
    decisionReason = "Iklan belum memiliki data penayangan yang cukup. Biarkan materi iklan tayang untuk mengumpulkan respon awal.";
  } else if (verificationStatus === "TERVERIFIKASI ADA") {
    if ((verifiedMessages || 0) >= 5 && isCostPerConversationValid && (costPerConversation || 999999) < 35000) {
      decision = "NAIKKAN";
      decisionReason = `Iklan terbukti menghasilkan ${verifiedMessages} chat WhatsApp dengan biaya ${formatRupiah(costPerConversation)} per kontak yang efisien. Anggaran dapat dinaikkan secara bertahap.`;
    } else if (isCostPerConversationValid && (costPerConversation || 0) > 80000) {
      decision = "KURANGI";
      decisionReason = `Biaya per percakapan terverifikasi (${formatRupiah(costPerConversation)}) melampaui batas efisiensi wajar. Kurangi alokasi anggaran harian.`;
    } else {
      decision = "PERTAHANKAN";
      decisionReason = `Iklan menghasilkan pesan masuk terverifikasi pada kisaran biaya yang masih wajar. Pertahankan anggaran saat ini untuk menjaga kestabilan respon.`;
    }
  } else if (verificationStatus === "TERVERIFIKASI NOL") {
    if (spend >= 300000 && linkClicks < 15) {
      decision = "HENTIKAN SEMENTARA";
      decisionReason = `Pengeluaran telah mencapai ${formatRupiah(spend)} tanpa respon klik atau pesan masuk yang memadai. Hentikan sementara untuk merumuskan ulang penawaran.`;
    } else if (linkClicks >= 40) {
      decision = "TAHAN KENAIKAN";
      decisionReason = `Terdapat ${linkClicks} klik tautan, tetapi belum ada prospek CRM yang dicatat. Periksa tujuan iklan dan lengkapi catatan prospek sebelum menaikkan anggaran.`;
    } else {
      decision = "TAHAN KENAIKAN";
      decisionReason = "Belum ada pesan masuk yang terekam pada sistem. Pantau perkembangan data hingga mencapai volume klik yang layak evaluasi.";
    }
  }

  // 4. Maksimal 3 Temuan Penting (Temuan, Bukti, Dampak - masing-masing 1 kalimat)
  const keyFindings: KeyFindingItem[] = [];

  keyFindings.push({
    finding: "Materi iklan berhasil mendatangkan minat klik calon pembeli.",
    evidence: `${linkClicks.toLocaleString("id-ID")} klik tautan dengan biaya ${formatRupiah(linkCpc)} per klik.`,
    impact: "Penonton di media sosial tertarik untuk menekan tombol aksi pada iklan.",
    isHypothesis: false,
  });

  if (verificationStatus === "TERVERIFIKASI ADA" && crmLeads !== null) {
    keyFindings.push({
      finding: "Data CRM mencatat prospek terkait iklan ini.",
      evidence: `${crmLeads} prospek tercatat dengan biaya ${formatRupiah(spend / crmLeads)} per prospek CRM.`,
      impact: "Tim dapat meninjau catatan prospek dan tindak lanjutnya di CRM.",
      isHypothesis: false,
    });
  } else if (verificationStatus === "BELUM TERVERIFIKASI") {
    keyFindings.push({
      finding: "Belum ada data CRM yang dapat digunakan untuk memeriksa hasil setelah klik.",
      evidence: `Data percakapan otomatis tidak digunakan pada produk saat ini.`,
      impact: "Efektivitas iklan terhadap penjualan belum dapat dihitung secara pasti.",
      isHypothesis: false,
    });
  } else if (verificationStatus === "DATA TIDAK KONSISTEN") {
    keyFindings.push({
      finding: "Hasil Meta dan jumlah prospek CRM memakai sumber yang berbeda.",
      evidence: `Meta melaporkan ${metaConversations || 0} hasil, sementara CRM mencatat ${crmLeads ?? 0} prospek.`,
      impact: "Keduanya perlu ditinjau terpisah sebelum menghitung biaya per prospek.",
      isHypothesis: false,
    });
  } else {
    keyFindings.push({
      finding: "Belum ada prospek CRM yang dapat dikaitkan dengan iklan ini.",
      evidence: `${linkClicks.toLocaleString("id-ID")} klik tautan dan belum ada prospek CRM yang dicatat.`,
      impact: "Data yang tersedia belum menunjukkan hasil setelah klik.",
      isHypothesis: true,
    });
  }

  if (linkCtr !== null && linkCtr < 0.5 && impressions >= 2000) {
    keyFindings.push({
      finding: "Rasio klik penayangan tergolong rendah dibanding tayangan yang dihasilkan.",
      evidence: `CTR tautan sebesar ${linkCtr}% dari ${impressions.toLocaleString("id-ID")} kali tayang.`,
      impact: "Sebagian besar penonton melewati materi iklan tanpa membuka tautan penawaran.",
      isHypothesis: false,
    });
  } else if (context.crmSurveysCount > 0) {
    keyFindings.push({
      finding: "Sebagian kontak berhasil melanjutkan ke tahap survei lokasi.",
      evidence: `${context.crmSurveysCount} jadwal survei lokasi tercatat pada CRM.`,
      impact: "Iklan memberikan kontribusi nyata menuju tahap penutupan transaksi properti.",
      isHypothesis: false,
    });
  }

  const finalFindings = keyFindings.slice(0, 3);

  // 5. Maksimal 3 Tindakan Prioritas (Apa, Cara periksa, Hasil diharapkan)
  const priorityActions: PriorityActionItem[] = [];

  if (verificationStatus === "BELUM TERVERIFIKASI" || verificationStatus === "DATA TIDAK KONSISTEN") {
    priorityActions.push({
      action: "Unggah atau lengkapi data CRM yang terkait dengan kampanye ini.",
      howToCheck: "Periksa apakah file CRM memuat nama iklan atau kampanye yang cocok dengan data Meta.",
      expectedResult: "Prospek dapat ditinjau bersama data performa iklan.",
    });
  } else if (verificationStatus === "TERVERIFIKASI NOL" && linkClicks >= 20) {
    priorityActions.push({
      action: "Tinjau tujuan tautan iklan dan informasi penawaran yang ditampilkan.",
      howToCheck: "Pastikan tautan pada iklan membuka tujuan yang benar di perangkat calon pembeli.",
      expectedResult: "Nomor tujuan aktif dan pesan pembuka otomatis memudahkan calon pembeli menekan tombol kirim.",
    });
  }

  if (verificationStatus === "TERVERIFIKASI ADA") {
    priorityActions.push({
      action: "Tindak lanjuti prospek berdasarkan catatan CRM dan arahkan ke jadwal survei.",
      howToCheck: "Perbarui tanggal dan tahap tindak lanjut berdasarkan catatan tim sales.",
      expectedResult: "Calon pembeli segera menerima denah unit dan menyepakati waktu kunjungan lokasi.",
    });
  }

  if (linkCtr !== null && linkCtr < 0.6 && impressions >= 3000) {
    priorityActions.push({
      action: "Siapkan 1 variasi foto atau video fasad baru untuk dibandingkan.",
      howToCheck: "Unggah gambar tampak depan rumah yang lebih terang atau video lingkungan sekitar.",
      expectedResult: "Rasio klik tautan (CTR tautan) meningkat pada penayangan awal.",
    });
  } else {
    priorityActions.push({
      action: "Catat atau unggah prospek setelah ditindaklanjuti.",
      howToCheck: "Periksa laporan berkala pada panel HD Creative Ads tanpa mengubah setelan penargetan.",
      expectedResult: "Performa iklan dapat ditinjau bersama data prospek yang dimasukkan klien.",
    });
  }

  const finalActions = priorityActions.slice(0, 3);

  // 6. Metrik Utama (Maksimal 6 metrik paling relevan)
  const coreMetrics = buildCoreMetrics({
    spend,
    linkClicks,
    linkCpc,
    metaConversations,
    crmLeadsCount: context.crmLeadsCount,
    crmMetricNote: context.crmSummary?.note,
    verifiedWhatsAppMessages: verifiedMessages,
    hasActiveIntegration: context.hasActiveIntegration,
    costPerConversation,
    isCostPerConversationValid,
    costPerConversationNote: costNote,
  });

  // 7. Detail Tambahan (Collapsible)
  const firstFailingStage =
    impressions === 0
      ? "Penayangan (Impressions)"
      : linkClicks === 0
      ? "Klik Tautan (Link Clicks)"
      : (verifiedMessages ?? 0) === 0
      ? "Data prospek CRM"
      : context.crmSurveysCount === 0
      ? "Survei Lokasi"
      : context.crmClosingsCount === 0
      ? "Closing Penjualan"
      : "Tidak ada hambatan kritis";

  const stageExplanation =
    firstFailingStage === "Data prospek CRM"
      ? "Klik tautan tercatat, tetapi belum ada prospek CRM yang dimasukkan untuk iklan ini."
      : firstFailingStage === "Survei Lokasi"
      ? "Belum ada catatan survei lokasi pada data CRM yang tersedia."
      : "Funnel berjalan dalam batas wajar.";

  const additionalDetails: AdditionalDetails = {
    funnelEvaluation: {
      firstFailingStage,
      explanation: stageExplanation,
    },
    facts: [
      `Total belanja aktual tercatat ${formatRupiah(spend)}.`,
      `Iklan telah ditampilkan sebanyak ${impressions.toLocaleString("id-ID")} kali.`,
      `Menghasilkan ${linkClicks.toLocaleString("id-ID")} klik tautan spesifik.`,
      "Sumber percakapan otomatis tidak digunakan; konteks prospek berasal dari input dan unggahan CRM klien.",
    ],
    hypotheses: [
      effectiveChats === 0 && linkClicks > 20
        ? "Kemungkinan nomor WhatsApp tujuan mengalami kendala atau pesan pembuka kurang mendorong aksi kirim."
        : "Format materi iklan saat ini memiliki tingkat penerimaan wajar pada audiens target.",
    ],
    unknowns: [
      "Jumlah prospek yang tidak dicatat atau diunggah ke CRM tidak tersedia untuk analisis.",
      reach === null || reach === 0 ? "Jumlah individu unik yang dijangkau." : "",
      context.crmSurveysCount === 0 ? "Belum ada catatan survei lokasi di data CRM yang tersedia." : "",
    ].filter(Boolean),
    allMetrics: [
      { label: "Total Belanja", value: formatRupiah(spend), explanation: "Biaya resmi dari platform Meta." },
      { label: "Tayangan (Impressions)", value: `${impressions.toLocaleString("id-ID")} kali`, explanation: "Frekuensi materi iklan tampil di layar." },
      { label: "Jangkauan (Reach)", value: reach !== null && reach > 0 ? `${reach.toLocaleString("id-ID")} orang` : "Tidak tersedia", explanation: "Jumlah orang unik yang melihat iklan (multi-hari tidak dijumlahkan)." },
      { label: "Klik Tautan", value: `${linkClicks.toLocaleString("id-ID")} klik`, explanation: "Klik tombol/tautan menuju WhatsApp." },
      { label: "Semua Klik", value: `${allClicks.toLocaleString("id-ID")} interaksi`, explanation: "Seluruh interaksi sentuhan pada postingan iklan." },
      { label: "CTR Tautan", value: linkCtr !== null ? `${linkCtr}%` : "Tidak dapat dihitung", explanation: "Persentase klik tautan dari total tayangan." },
      { label: "CPM", value: cpm !== null ? formatRupiah(cpm) : "Tidak dapat dihitung", explanation: "Biaya per 1.000 penayangan iklan." },
    ],
    creativeNotes:
      "Gunakan foto atau video bangunan/lahan asli dengan pencahayaan siang hari yang jelas. Sertakan kejelasan legalitas dan skema pembayaran yang telah terverifikasi.",
  };

  const cardCopy = composeAdCardCopy({
    locale: "id",
    paused: /paused|dijeda|archived|arsip/i.test(input.status || ""),
    spend,
    conversations: input.metrics.messagingConversations ?? metaConversations,
    costPerConversation: input.metrics.costPerMessagingConversation ?? null,
    linkCtr,
    hasTarget: false,
    directProspects: crmSummary?.availability === "error" ? null : crmLeads,
    campaignOnly: crmSummary?.availability === "error" ? null : crmSummary?.campaignOnly ?? null,
    crmFailed: crmSummary?.availability === "error",
  });
  performanceSummary = cardCopy.summary;
  decisionReason = cardCopy.reason;

  const result: AIAdAnalysisResponse = {
    isLiveAi: false,
    provider: "haspro_intelligence_engine",
    model: "haspro-ctwa-analyst-v1",
    maskedApiKey: "[LOCAL_ENGINE]",
    analyzedAt: nowIso,
    adName,
    campaignName,
    campaignObjective,
    performanceSummary,
    sourceDataStatus,
    budgetDecision: {
      decision,
      reason: decisionReason,
    },
    keyFindings: finalFindings,
    priorityActions: finalActions,
    coreMetrics,
    additionalDetails,
    // Bridges
    executiveSummary: performanceSummary,
    actionDecision: {
      priority:
        decision === "NAIKKAN"
          ? "OPTIMALKAN"
          : decision === "TAHAN KENAIKAN"
          ? "PANTAU"
          : decision === "HENTIKAN SEMENTARA"
          ? "EVALUASI_PENGHENTIAN"
          : decision === "KURANGI"
          ? "EVALUASI_PENGHENTIAN"
          : "PERTAHANKAN",
      priorityLabel: decision,
      headline: decision,
      justification: decisionReason,
    },
  };

  if (input.locale === "en") {
    return localizeDeterministicAdAnalysisEn(result, {
      spend,
      impressions,
      reach,
      linkClicks,
      allClicks,
      linkCtr,
      linkCpc,
      cpm,
      metaConversations,
      verifiedMessages,
      crmLeads,
      crmSummary,
      crmSurveysCount: context.crmSurveysCount,
      crmClosingsCount: context.crmClosingsCount,
      verificationStatus,
      isCostPerConversationValid,
      costPerConversation,
      paused: /paused|dijeda|archived|arsip/i.test(input.status || ""),
      messagingCost: input.metrics.costPerMessagingConversation ?? null,
    });
  }

  return result;
}

/**
 * POST /api/ai/analyze-ad
 * Strictly manual AI analysis. Never triggered automatically.
 */

function localizeDeterministicAdAnalysisEn(
  base: AIAdAnalysisResponse,
  params: {
    spend: number;
    impressions: number;
    reach: number | null;
    linkClicks: number;
    allClicks: number;
    linkCtr: number | null;
    linkCpc: number | null;
    cpm: number | null;
    metaConversations: number | null;
    verifiedMessages: number | null;
    crmLeads: number | null;
    crmSummary?: CrmAdSummary | null;
    crmSurveysCount: number;
    crmClosingsCount: number;
    verificationStatus: SourceVerificationStatus;
    isCostPerConversationValid: boolean;
    costPerConversation: number | null;
    paused: boolean;
    messagingCost: number | null;
  }
): AIAdAnalysisResponse {
  const {
    spend,
    impressions,
    reach,
    linkClicks,
    allClicks,
    linkCtr,
    linkCpc,
    cpm,
    metaConversations,
    verifiedMessages,
    crmLeads,
    crmSummary,
    crmSurveysCount,
    crmClosingsCount,
    verificationStatus,
    isCostPerConversationValid,
    costPerConversation,
  } = params;
  const fmtMoney = (amt: number | null | undefined) => {
    if (amt === null || amt === undefined || Number.isNaN(amt)) return "Cannot be calculated";
    return `Rp${Math.round(amt).toLocaleString("en-US")}`;
  };

  let performanceSummary = "";
  if (verificationStatus === "TERVERIFIKASI ADA" && crmLeads !== null) {
    performanceSummary = `This ad has spent ${fmtMoney(spend)} and generated ${linkClicks.toLocaleString("en-US")} link clicks with ${verifiedMessages} verified inbound WhatsApp messages. Cost per chat is ${fmtMoney(costPerConversation)}. Continue monitoring response quality and accelerate sales follow-up speed.`;
  } else if (verificationStatus === "BELUM TERVERIFIKASI") {
    performanceSummary = `This ad spent ${fmtMoney(spend)} and generated ${linkClicks.toLocaleString("en-US")} link clicks. Recorded CRM leads are ${crmLeads === null ? "not available yet" : `${crmLeads.toLocaleString("en-US")}`}; this figure excludes chats not yet logged into CRM.`;
  } else if (verificationStatus === "DATA TIDAK KONSISTEN") {
    performanceSummary = `This ad recorded ${fmtMoney(spend)} in spend and ${linkClicks.toLocaleString("en-US")} link clicks. Meta results and CRM leads use different definitions; review both data sources before comparing them.`;
  } else {
    performanceSummary = `This ad has spent ${fmtMoney(spend)} and generated ${linkClicks.toLocaleString("en-US")} link clicks. No CRM leads have been recorded for this ad yet; ensure lead records are logged before evaluating post-click conversion.`;
  }

  let decisionReason = "";
  if (verificationStatus === "DATA TIDAK KONSISTEN") {
    decisionReason = "Meta results and CRM leads use different definitions. Review source data before comparing them for budget decisions.";
  } else if (verificationStatus === "BELUM TERVERIFIKASI") {
    decisionReason =
      crmLeads !== null && crmLeads > 0
        ? `CRM recorded ${crmLeads.toLocaleString("en-US")} leads linked to this ad. Treat that figure as client-uploaded CRM data rather than automated chat verification.`
        : crmSummary && (crmSummary.workspaceTotal || 0) > 0
        ? "The workspace has leads in this period, but none are attributed to this ad. Do not use workspace totals as this ad's outcome."
        : "No CRM leads are recorded for this ad in this period. Complete CRM attribution before judging cost per lead.";
  } else if (spend === 0 || impressions === 0) {
    decisionReason = "This ad does not have enough delivery data yet. Allow the creative to run and gather initial audience response.";
  } else if (verificationStatus === "TERVERIFIKASI ADA") {
    if ((verifiedMessages || 0) >= 5 && isCostPerConversationValid && (costPerConversation || 999999) < 35000) {
      decisionReason = `This ad generated ${verifiedMessages} verified WhatsApp chats at an efficient ${fmtMoney(costPerConversation)} per contact. Budget can be scaled gradually.`;
    } else if (isCostPerConversationValid && (costPerConversation || 0) > 80000) {
      decisionReason = `Cost per verified conversation (${fmtMoney(costPerConversation)}) exceeds the healthy efficiency threshold. Reduce the daily budget allocation.`;
    } else {
      decisionReason = "This ad is generating verified inbound messages within a reasonable cost range. Maintain current budget to keep lead flow stable.";
    }
  } else if (verificationStatus === "TERVERIFIKASI NOL") {
    if (spend >= 300000 && linkClicks < 15) {
      decisionReason = `Spend reached ${fmtMoney(spend)} without adequate click or message response. Pause temporarily to rework the offer and creative hook.`;
    } else if (linkClicks >= 40) {
      decisionReason = `There are ${linkClicks.toLocaleString("en-US")} link clicks, but no CRM leads are recorded yet. Check destination routing and update CRM records before scaling budget.`;
    } else {
      decisionReason = "No inbound messages are recorded in the system yet. Monitor performance until click volume is sufficient for evaluation.";
    }
  }

  const keyFindings: KeyFindingItem[] = [
    {
      finding: "The ad creative is generating click interest from prospective buyers.",
      evidence: `${linkClicks.toLocaleString("en-US")} link clicks at ${fmtMoney(linkCpc)} per click.`,
      impact: "Social media viewers are interested enough to tap the call-to-action button.",
      isHypothesis: false,
    },
  ];
  if (verificationStatus === "TERVERIFIKASI ADA" && crmLeads !== null) {
    keyFindings.push({
      finding: "CRM data records leads attributed to this ad.",
      evidence: `${crmLeads} leads recorded at ${fmtMoney(spend / crmLeads)} per CRM lead.`,
      impact: "The sales team can review lead quality and follow-up progress in CRM.",
      isHypothesis: false,
    });
  } else if (verificationStatus === "BELUM TERVERIFIKASI") {
    keyFindings.push({
      finding: "CRM data is not yet available to verify post-click outcomes.",
      evidence: "Automated conversation tracking is not active for this ad.",
      impact: "Down-funnel sales effectiveness cannot be calculated with certainty yet.",
      isHypothesis: false,
    });
  } else if (verificationStatus === "DATA TIDAK KONSISTEN") {
    keyFindings.push({
      finding: "Meta results and CRM lead counts come from different tracking sources.",
      evidence: `Meta reports ${metaConversations || 0} results while CRM records ${crmLeads ?? 0} leads.`,
      impact: "Both sources should be reviewed separately before calculating cost per lead.",
      isHypothesis: false,
    });
  } else {
    keyFindings.push({
      finding: "No CRM leads are attributed to this ad yet.",
      evidence: `${linkClicks.toLocaleString("en-US")} link clicks and 0 recorded CRM leads.`,
      impact: "Available data does not yet show post-click lead conversion.",
      isHypothesis: true,
    });
  }
  if (linkCtr !== null && linkCtr < 0.5 && impressions >= 2000) {
    keyFindings.push({
      finding: "Link click-through rate is low relative to impression volume.",
      evidence: `Link CTR of ${linkCtr}% across ${impressions.toLocaleString("en-US")} impressions.`,
      impact: "Most viewers scroll past the ad without opening the property offer link.",
      isHypothesis: false,
    });
  } else if (crmSurveysCount > 0) {
    keyFindings.push({
      finding: "Some contacts progressed to the site-visit stage.",
      evidence: `${crmSurveysCount} site visits recorded in CRM.`,
      impact: "This ad is contributing directly toward property sales opportunities.",
      isHypothesis: false,
    });
  }

  const priorityActions: PriorityActionItem[] = [];
  if (verificationStatus === "BELUM TERVERIFIKASI" || verificationStatus === "DATA TIDAK KONSISTEN") {
    priorityActions.push({
      action: "Upload or complete CRM lead records associated with this campaign.",
      howToCheck: "Verify that your CRM upload includes ad or campaign identifiers matching Meta.",
      expectedResult: "Leads can be evaluated alongside ad spend and click performance.",
    });
  } else if (verificationStatus === "TERVERIFIKASI NOL" && linkClicks >= 20) {
    priorityActions.push({
      action: "Review the ad destination link and pre-filled WhatsApp greeting.",
      howToCheck: "Test the ad link on mobile to ensure it opens the active WhatsApp number smoothly.",
      expectedResult: "Prospective buyers can send their inquiry message with minimal friction.",
    });
  }
  if (verificationStatus === "TERVERIFIKASI ADA") {
    priorityActions.push({
      action: "Follow up on recorded CRM leads and guide qualified prospects to a site visit.",
      howToCheck: "Update follow-up stages and site-visit schedules in CRM based on sales notes.",
      expectedResult: "Prospective buyers receive unit floor plans and confirm a property visit schedule.",
    });
  }
  if (linkCtr !== null && linkCtr < 0.6 && impressions >= 3000) {
    priorityActions.push({
      action: "Prepare 1 new exterior facade photo or walkthrough video variation to test.",
      howToCheck: "Upload a brighter front-elevation image or neighborhood tour video.",
      expectedResult: "Link CTR improves on initial delivery.",
    });
  } else {
    priorityActions.push({
      action: "Log or upload leads into CRM after sales follow-up.",
      howToCheck: "Review periodic reports in HD Creative Ads without resetting ad set targeting.",
      expectedResult: "Ad performance can be evaluated together with client-recorded lead quality.",
    });
  }

  const firstFailingStage =
    impressions === 0
      ? "Impressions"
      : linkClicks === 0
      ? "Link Clicks"
      : (verifiedMessages ?? 0) === 0
      ? "CRM Lead Data"
      : crmSurveysCount === 0
      ? "Site Visit"
      : crmClosingsCount === 0
      ? "Sales Closing"
      : "No critical bottleneck";

  const stageExplanation =
    firstFailingStage === "CRM Lead Data"
      ? "Link clicks are recorded, but no CRM leads have been logged for this ad yet."
      : firstFailingStage === "Site Visit"
      ? "No site-visit records are present in the available CRM data yet."
      : "Funnel is operating within normal parameters.";

  const cardCopy = composeAdCardCopy({
    locale: "en",
    paused: params.paused,
    spend,
    conversations: metaConversations,
    costPerConversation: params.messagingCost,
    linkCtr,
    hasTarget: false,
    directProspects: crmSummary?.availability === "error" ? null : crmLeads,
    campaignOnly: crmSummary?.availability === "error" ? null : crmSummary?.campaignOnly ?? null,
    crmFailed: crmSummary?.availability === "error",
  });
  performanceSummary = cardCopy.summary;
  decisionReason = cardCopy.reason;

  return {
    ...base,
    performanceSummary,
    sourceDataStatus: {
      metaResults: metaConversations !== null ? `${metaConversations.toLocaleString("en-US")} results` : "Unavailable",
      crmProspects: crmLeads !== null ? `${crmLeads.toLocaleString("en-US")} CRM leads` : "Not available yet",
      crmLines: base.sourceDataStatus.crmLines,
      note: "Lead data comes from client CRM input or uploads. Messages are not collected automatically.",
    },
    budgetDecision: {
      decision: base.budgetDecision.decision,
      reason: decisionReason,
    },
    keyFindings: keyFindings.slice(0, 3),
    priorityActions: priorityActions.slice(0, 3),
    coreMetrics: buildCoreMetrics({
      spend,
      linkClicks,
      linkCpc,
      metaConversations,
      crmLeadsCount: crmLeads,
      verifiedWhatsAppMessages: verifiedMessages,
      hasActiveIntegration: Boolean(verifiedMessages && verifiedMessages > 0),
      costPerConversation,
      isCostPerConversationValid,
      locale: "en",
    }),
    additionalDetails: {
      funnelEvaluation: {
        firstFailingStage,
        explanation: stageExplanation,
      },
      facts: [
        `Total actual spend recorded is ${fmtMoney(spend)}.`,
        `The ad was displayed ${impressions.toLocaleString("en-US")} times.`,
        `Generated ${linkClicks.toLocaleString("en-US")} outbound link clicks.`,
        "Automated message collection is not used; lead context comes from client CRM inputs and uploads.",
      ],
      hypotheses: [
        (verifiedMessages ?? (metaConversations || 0)) === 0 && linkClicks > 20
          ? "The destination WhatsApp number or greeting template may be creating friction before prospects press send."
          : "Current creative format shows reasonable acceptance among the target audience.",
      ],
      unknowns: [
        "Leads that have not been logged or uploaded to CRM are not available for analysis.",
        reach === null || reach === 0 ? "Unique individuals reached." : "",
        crmSurveysCount === 0 ? "No site-visit records in the available CRM data yet." : "",
      ].filter(Boolean),
      allMetrics: [
        { label: "Total Spend", value: fmtMoney(spend), explanation: "Official billed spend from Meta." },
        { label: "Impressions", value: `${impressions.toLocaleString("en-US")} views`, explanation: "Total times the ad appeared on screen." },
        { label: "Reach", value: reach !== null && reach > 0 ? `${reach.toLocaleString("en-US")} people` : "Unavailable", explanation: "Unique people who saw the ad (multi-day reach is not summed)." },
        { label: "Link Clicks", value: `${linkClicks.toLocaleString("en-US")} clicks`, explanation: "Button/link clicks toward WhatsApp or destination." },
        { label: "All Clicks", value: `${allClicks.toLocaleString("en-US")} interactions`, explanation: "All touch interactions on the ad post." },
        { label: "Link CTR", value: linkCtr !== null ? `${linkCtr}%` : "Cannot be calculated", explanation: "Percentage of impressions resulting in a link click." },
        { label: "CPM", value: cpm !== null ? fmtMoney(cpm) : "Cannot be calculated", explanation: "Cost per 1,000 ad impressions." },
      ],
      creativeNotes:
        "Use authentic daylight photos or walkthrough videos of the property/site. Highlight verified legal status and clear payment terms.",
    },
    executiveSummary: performanceSummary,
    actionDecision: {
      ...base.actionDecision,
      justification: decisionReason,
    },
  };
}
export async function POST(request: NextRequest) {
  let quotaReservation: { userId: string; reservationId: string } | null = null;
  try {
    const rl = checkRateLimit(rateLimitKey(request, "ai-analyze-ad"), 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak permintaan analisis.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
    const rawBody = await request.json();
    const parseResult = AnalyzeAdRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Payload permintaan analisis tidak valid.",
          errors: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    // 1. Mandatory Session Authentication & Tenant Isolation
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("organization_id, role")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };

    const organizationId = profile?.organization_id;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    let data = parseResult.data;
    // AI-02/AI-03: shared-aggregation result and explicit analysis period,
    // filled during server ground-truth sourcing below.
    let analysisAggregate: AdMetricsAggregate | null = null;
    let analysisPeriod: { since: string | null; until: string | null; days: number; timezone: string; label: string } = {
      since: null,
      until: null,
      days: 0,
      timezone: "Asia/Jakarta",
      label: "Semua data tersimpan",
    };

    // Client-supplied metrics are not ground truth. Every analysis requires a
    // server-verified ad ID within the caller's tenant.
    if (!data.adId) {
      return NextResponse.json(
        {
          success: false,
          error: "adId wajib disertakan agar metrik diverifikasi dari data server tenant.",
          code: "AD_ID_REQUIRED",
        },
        { status: 400 }
      );
    }

    let hasActiveIntegration = false;
    let verifiedInboundMessages: number | null = null;
    let crmLeadsCount: number | null = null;
    let crmSummary: CrmAdSummary | null = null;
    let crmContextBlock: string | null = null;
    let crmSurveysCount = 0;
    let crmClosingsCount = 0;
    let sanitizedChat = "";

    // 2. Ground-Truth Data Sourcing from Server Database (Tenant Isolated)
    if (data.adId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.adId);
      let query = supabase
        .from("ads")
        .select("id, name, status, provider_ad_id, campaign_id, campaigns(id, name, objective, status)")
        .eq("organization_id", organizationId);

      if (isUuid) {
        query = query.eq("id", data.adId);
      } else {
        query = query.eq("provider_ad_id", data.adId);
      }

      const { data: verifiedAd, error: adErr } = await query.maybeSingle();

      if (adErr) {
        return NextResponse.json(
          { success: false, error: `Kesalahan basis data: ${adErr.message}`, code: "DB_ERROR" },
          { status: 500 }
        );
      }

      if (!verifiedAd) {
        // Enforce 403 vs 404 for tenant security
        let crossQuery = supabase.from("ads").select("id, organization_id");
        if (isUuid) crossQuery = crossQuery.eq("id", data.adId);
        else crossQuery = crossQuery.eq("provider_ad_id", data.adId);
        const { data: crossAd } = await crossQuery.maybeSingle();

        if (crossAd && crossAd.organization_id !== organizationId) {
          return NextResponse.json(
            {
              success: false,
              error: "Iklan berada di luar batas tenant Anda",
              code: "FORBIDDEN",
            },
            { status: 403 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            error: "Iklan tidak ditemukan",
            code: "NOT_FOUND",
          },
          { status: 404 }
        );
      }

      // Fetch authentic persisted insights from database, aggregated with the
      // SAME shared aggregation and dateRange parser as getAdsIntelligenceData (AI-02).
      // Default period is 30d so lifetime rows are never mixed into a dashboard view.
      const { data: campRow } = await supabase
        .from("campaigns")
        .select("ad_account_id")
        .eq("id", verifiedAd.campaign_id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      let accountTimezone = "Asia/Jakarta";
      if (campRow?.ad_account_id) {
        const { data: accRow } = await supabase
          .from("ad_accounts")
          .select("timezone")
          .eq("id", campRow.ad_account_id)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (accRow?.timezone) accountTimezone = accRow.timezone;
      }
      const range = parseDateRange(data.dateRange, accountTimezone);
      const buildInsightsQuery = (columns: string) => {
        let q = supabase
          .from("ad_insights")
          .select(columns)
          .eq("ad_id", verifiedAd.id)
          .eq("organization_id", organizationId);
        if (range.since) q = q.gte("date_start", range.since);
        if (range.until) q = q.lte("date_stop", range.until);
        return q;
      };
      // action_breakdown/conversion_action_type arrive with migration
      // 20261027000000, which is not applied everywhere yet. If the schema
      // lacks them, fall back to the core columns instead of failing the
      // whole analysis (messaging/leads then stay unavailable, not zeroed
      // from a failed query).
      let insightsResult = await buildInsightsQuery("spend, impressions, clicks, reach, link_clicks, conversions, action_breakdown, conversion_action_type, currency, date_start, date_stop");
      if (insightsResult.error) {
        insightsResult = await buildInsightsQuery("spend, impressions, clicks, reach, link_clicks, conversions, currency, date_start, date_stop");
      }
      const insights = (insightsResult.data || []) as unknown as AdInsightRowLike[];

      const agg: AdMetricsAggregate = aggregateAdInsights(insights || []);
      analysisAggregate = agg;
      let calendarDays = agg.days;
      if (range.since && range.until) {
        const span =
          Math.round(
            (new Date(`${range.until}T00:00:00Z`).getTime() - new Date(`${range.since}T00:00:00Z`).getTime()) /
              86_400_000
          ) + 1;
        calendarDays = Math.max(1, span);
      }
      analysisPeriod = {
        since: range.since || null,
        until: range.until || null,
        days: calendarDays,
        timezone: accountTimezone,
        label: range.since && range.until ? `${range.since} s.d. ${range.until}` : "Semua data tersimpan",
      };

      const serverSpend = agg.spend;
      const serverImpressions = agg.impressions;
      const serverReach = agg.reach;
      const serverLinkClicks = agg.linkClicks ?? 0;
      const serverAllClicks = agg.allClicks;
      const serverConversions = agg.results ?? 0;
      const serverLinkCtr = agg.linkCtr;
      const serverLinkCpc = agg.linkCpc;
      const serverAllCtr = agg.allCtr;
      const serverAllCpc = agg.allCpc;
      const serverCpm = agg.cpm;
      const serverCostPerResult = agg.costPerResult;

      const applyPeriod = <T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(
        query: T,
        column: string
      ) => {
        let next = query;
        if (range.since) next = next.gte(column, `${range.since}T00:00:00.000Z`);
        if (range.until) next = next.lte(column, `${range.until}T23:59:59.999Z`);
        return next;
      };

      // CRM is read for the whole workspace in the same period, then split.
      // A row counts for this ad only when conversations.ad_id stores this ad's id.
      const crmBounds = calendarDayBounds(range.since, range.until);
      let crmQuery = supabase
        .from("conversations")
        .select("id, ad_id, campaign_id, attribution_status, quality_label, channel, attribution_evidence", { count: "exact" })
        .eq("organization_id", organizationId)
        .eq("channel", "crm_upload")
        .limit(2000);
      if (crmBounds.start) crmQuery = crmQuery.gte("started_at", crmBounds.start);
      if (crmBounds.end) crmQuery = crmQuery.lte("started_at", crmBounds.end);
      const crmResult = await crmQuery;
      const crmRows = (crmResult.data || []).map((row) => {
        const evidence = row.attribution_evidence;
        const evidenceObject = evidence && typeof evidence === "object" && !Array.isArray(evidence) ? evidence : null;
        const funnelStage = evidenceObject && typeof evidenceObject.funnel_stage === "string" ? evidenceObject.funnel_stage : null;
        const providerAdSetOnRow = evidenceObject && typeof evidenceObject.provider_adset_id === "string" ? evidenceObject.provider_adset_id : null;
        return {
          id: row.id,
          ad_id: row.ad_id,
          campaign_id: row.campaign_id,
          attribution_status: row.attribution_status,
          quality_label: row.quality_label,
          channel: row.channel,
          attribution_evidence: { funnel_stage: funnelStage, provider_adset_id: providerAdSetOnRow },
        };
      });
      const { data: adSetInsight } = await supabase
        .from("ad_insights")
        .select("adset_id")
        .eq("ad_id", verifiedAd.id)
        .eq("organization_id", organizationId)
        .limit(1)
        .maybeSingle();
      crmSummary = summarizeCrmForAd(
        crmResult.error ? null : crmRows,
        Boolean(crmResult.error),
        verifiedAd.id,
        verifiedAd.campaign_id,
        {
          truncated: !crmResult.error && crmResult.count !== null && crmRows.length < crmResult.count,
          providerAdSetId: adSetInsight?.adset_id || null,
        }
      );
      crmLeadsCount = crmSummary.attributedToAd;
      crmContextBlock = formatCrmContextForPrompt(buildCrmAnalysisContext(crmResult.error ? null : crmRows, {
        failed: Boolean(crmResult.error),
        truncated: !crmResult.error && crmResult.count !== null && crmRows.length < crmResult.count,
        organizationId,
        since: range.since,
        until: range.until,
        scope: "ad",
        campaignId: verifiedAd.campaign_id,
        adId: verifiedAd.id,
        providerAdSetId: adSetInsight?.adset_id || null,
        spend: serverSpend,
      }));

      const adConversations = await applyPeriod(
        supabase
          .from("conversations")
          .select("id, channel")
          .eq("ad_id", verifiedAd.id)
          .eq("organization_id", organizationId),
        "started_at"
      );
      const periodConversationRows = adConversations.error ? [] : adConversations.data || [];
      const conversationIds = periodConversationRows.map((row) => row.id);
      hasActiveIntegration = conversationIds.length > 0;

      const adConvIds = crmSummary.attributedIds;
      const { data: outcomes } = adConvIds.length
        ? await supabase
            .from("lead_outcomes")
            .select("stage")
            .eq("organization_id", organizationId)
            .in("conversation_id", adConvIds)
        : { data: [] as Array<{ stage: string }> };

      (outcomes || []).forEach((out) => {
        const st = (out.stage || "").toLowerCase();
        if (st.includes("survey") || st.includes("survei")) crmSurveysCount++;
        if (
          st.includes("closing") ||
          st.includes("booking") ||
          st === "sale" ||
          st.includes("won") ||
          st.includes("deal")
        )
          crmClosingsCount++;
      });

      // Lead quality is NOT AVAILABLE from a verified source: Buyer Score is
      // legacy/out-of-scope and quality_label has no agreed qualified
      // definition. Qualified leads and CPQL are therefore never claimed
      // here (qualifiedLeads stays null). CRM counts below are raw recorded
      // prospects/outcomes, not quality judgments.

      if (conversationIds.length > 0) {
        let messageQuery = supabase
          .from("messages")
          .select("body, sender_type, direction, sent_at")
          .eq("organization_id", organizationId)
          .in("conversation_id", conversationIds)
          .order("sent_at", { ascending: true })
          .limit(80);
        if (range.since) messageQuery = messageQuery.gte("sent_at", `${range.since}T00:00:00.000Z`);
        if (range.until) messageQuery = messageQuery.lte("sent_at", `${range.until}T23:59:59.999Z`);
        const { data: chatRows } = await messageQuery;
        const rows = chatRows || [];
        verifiedInboundMessages = rows.filter((row) => {
          const direction = (row.direction || "").toLowerCase();
          const sender = (row.sender_type || "").toLowerCase();
          return direction === "inbound" || sender === "contact" || sender === "customer" || sender === "user";
        }).length;
        sanitizedChat = sanitizeUntrustedText(
          rows.map((row) => `${row.sender_type || row.direction || "unknown"}: ${row.body || ""}`).join("\n")
        );
      }

      const campaignData = verifiedAd.campaigns as { id?: string; name?: string; objective?: string; status?: string } | null;

      data = {
        ...data,
        adName: verifiedAd.name,
        campaignName: campaignData?.name || data.campaignName,
        campaignObjective: campaignData?.objective || data.campaignObjective,
        status: effectiveDeliveryStatus(verifiedAd.status, campaignData?.status),
        metrics: {
          spend: serverSpend,
          impressions: serverImpressions,
          reach: serverReach,
          linkClicks: serverLinkClicks,
          allClicks: serverAllClicks,
          linkCtr: serverLinkCtr,
          allCtr: serverAllCtr,
          linkCpc: serverLinkCpc,
          allCpc: serverAllCpc,
          cpm: serverCpm,
          results: serverConversions,
          costPerResult: serverCostPerResult,
          messagingConversations: agg.messagingConversations,
          leads: agg.leads,
          costPerMessagingConversation: agg.costPerMessagingConversation,
          costPerLead: agg.costPerLead,
          resultType: "Hasil Meta",
          attributedLeads: crmSummary?.attributedToAd || 0,
          qualifiedLeads: null,
        },
      };
    }

    // Deterministic policy: when the AI provider is not configured, the
    // rule-based engine answers WITHOUT reserving or consuming any AI quota.
    // Its output is explicitly marked isLiveAi:false / provider
    // "haspro_intelligence_engine" by generateDeterministicAdAnalysis.
    const isConfigured = isMetaModelApiConfigured();
    const config = getMetaConfig({ requireApiKey: false });
    if (!isConfigured) {
      const deterministicAnalysis = generateDeterministicAdAnalysis(data, {
        hasActiveIntegration,
        metaConversions: data.metrics.results,
        verifiedInboundMessages,
        crmLeadsCount,
        crmSummary,
        crmSurveysCount,
        crmClosingsCount,
      });
      return NextResponse.json({ success: true, data: deterministicAnalysis });
    }

    const idempotencyKey = validateIdempotencyKey(request.headers.get("Idempotency-Key"));
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
    const releaseReservation = async (code: string) => {
      if (!quotaReservation) return;
      await finishAiAnalysis(quotaReservation.userId, quotaReservation.reservationId, false, code);
      quotaReservation = null;
    };

    // 3. Live AI Execution with Strict CTWA Constraints
    if (isConfigured) {
      try {
        const client = new MetaModelApiClient({ timeoutMs: 35000, maxRetries: 0 });

        const evalResult = evaluateAdsPerformance({
          period: data.dateRange,
          durationDays: analysisPeriod.days,
          spend: data.metrics.spend,
          results: data.metrics.messagingConversations ?? data.metrics.results,
          reportedCpr: data.metrics.costPerMessagingConversation ?? data.metrics.costPerResult,
          targetCpr: null,
          linkClicks: data.metrics.linkClicks,
          impressions: data.metrics.impressions,
          reach: data.metrics.reach ?? undefined,
          frequency: analysisAggregate?.frequency ?? null,
          campaignObjective: data.campaignObjective,
          locale: "id",
          entityStatus: data.status || "UNKNOWN",
          analysisScope: "ad",
        });

        const groundTruth: CtwaGroundTruthMetrics = {
          spend: data.metrics.spend,
          link_ctr: data.metrics.linkCtr ?? null,
          cpm: data.metrics.cpm ?? null,
          link_cpc: data.metrics.linkCpc ?? null,
          messaging_conversations: data.metrics.messagingConversations ?? null,
          leads: data.metrics.leads ?? null,
          cost_per_messaging_conversation: data.metrics.costPerMessagingConversation ?? null,
          cost_per_lead: data.metrics.costPerLead ?? null,
          unique_reach: data.metrics.reach ?? null,
          impressions: data.metrics.impressions,
          link_clicks: data.metrics.linkClicks,
          all_clicks: data.metrics.allClicks,
          frequency: analysisAggregate?.frequency ?? null,
          results_legacy: data.metrics.results ?? null,
          cost_per_result_legacy: data.metrics.costPerResult ?? null,
        };

        const systemPrompt = CTWA_SYSTEM_PROMPT;
        const baseUserPrompt = buildCtwaUserPrompt({
          adName: data.adName,
          campaignName: data.campaignName || (data.locale === "en" ? "Property Campaign" : "Kampanye Properti"),
          campaignObjective: data.campaignObjective || null,
          status: data.status || "ACTIVE",
          analysisScope: "ad",
          periodDays: analysisPeriod.days,
          periodLabel: analysisPeriod.label,
          durationDays: analysisPeriod.days,
          timezone: analysisPeriod.timezone,
          rowCount: analysisAggregate?.rowCount ?? 0,
          dataStatus: evalResult.dataStatus,
          dataStatusReason: evalResult.dataStatusReason,
          evaluatorAction: evalResult.action,
          targetCpr: null,
          targetCpql: null,
          crmProspects: crmLeadsCount,
          crmAttributionNote: crmSummary?.note,
          crmContextBlock,
          verifiedInboundMessages,
          property: {
            projectName: data.propertyContext?.projectName,
            location: data.propertyContext?.location,
            priceRange: data.propertyContext?.priceRange,
            propertyType: data.propertyContext?.propertyType,
          },
          metrics: groundTruth,
          untrustedChatBlock: wrapUntrustedChatBlock(sanitizedChat),
          formatMoney: formatRupiah,
        });
        const userPrompt =
          data.locale === "en"
            ? `${baseUserPrompt}\n\nLANGUAGE INSTRUCTION: Write all narrative text fields (performanceSummary, budgetDecision.reason, keyFindings[].finding/evidence/impact, priorityActions[].action/howToCheck/expectedResult, additionalDetails.funnelEvaluation.firstFailingStage/explanation, facts, hypotheses, unknowns, creativeNotes, chain_of_thought) in clear, professional English. Keep enum keys (such as budgetDecision.decision and recommended_action) strictly in their required schema enum values.`
            : baseUserPrompt;

        const response = await client.createChatCompletion({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 6000,
        });

        const finishReason = response.choices?.[0]?.finish_reason;
        if (finishReason === "length") {
          await releaseReservation("truncated_ai_response");
          return NextResponse.json(
            {
              success: false,
              error: "Respons analisis AI terpotong karena melampaui batas token. Silakan coba kembali.",
              code: "TRUNCATED_AI_RESPONSE",
            },
            { status: 502 }
          );
        }

        const rawContent = response.choices?.[0]?.message?.content;
        if (!rawContent || rawContent.trim() === "") {
          await releaseReservation("empty_ai_response");
          return NextResponse.json(
            {
              success: false,
              error: "Model AI mengembalikan respons kosong. Silakan coba kembali.",
              code: "EMPTY_AI_RESPONSE",
            },
            { status: 502 }
          );
        }

        let parsedJson: unknown;
        try {
          parsedJson = parseModelJson(rawContent);
        } catch {
          await releaseReservation("invalid_json_response");
          return NextResponse.json(
            {
              success: false,
              error: "Format respons analisis AI tidak valid. Silakan coba kembali.",
              code: "INVALID_JSON_RESPONSE",
            },
            { status: 502 }
          );
        }

        const validationResult = ModelOutputSchema.safeParse(parsedJson);
        if (!validationResult.success) {
          await releaseReservation("schema_validation_error");
          console.error(
            "[AI Analysis] Model response failed schema validation:",
            validationResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
          );
          return NextResponse.json(
            {
              success: false,
              error: "Format respons analisis AI tidak valid. Silakan coba kembali.",
              code: "SCHEMA_VALIDATION_ERROR",
            },
            { status: 502 }
          );
        }

        const validData = applyGuardrailsToModelOutput(
          validationResult.data,
          {
            dataStatus: evalResult.dataStatus,
            durationDays: analysisPeriod.days,
            hasChatTranscript: sanitizedChat.length > 0,
            entityStatus: evalResult.entityStatus,
            analysisScope: "ad",
            spend: data.metrics.spend,
            results: data.metrics.messagingConversations ?? data.metrics.results,
            targetCpr: null,
            performanceStatus: evalResult.performanceStatus,
            actualCpr: evalResult.actualCpr,
          },
          {
            spend: groundTruth.spend,
            link_ctr: groundTruth.link_ctr,
            cpm: groundTruth.cpm,
            link_cpc: groundTruth.link_cpc,
            messaging_conversations: groundTruth.messaging_conversations,
            leads: groundTruth.leads,
            cost_per_messaging_conversation: groundTruth.cost_per_messaging_conversation,
            cost_per_lead: groundTruth.cost_per_lead,
            unique_reach: groundTruth.unique_reach,
          }
        );
        const dataSourceStatus: SourceDataStatusSection = {
          metaResults:
            data.metrics.results !== null && data.metrics.results !== undefined
              ? `${data.metrics.results.toLocaleString("id-ID")} hasil`
              : "Tidak tersedia",
          crmProspects: crmSummary?.prospectsLine || (crmLeadsCount !== null ? `${crmLeadsCount.toLocaleString("id-ID")} prospek dari CRM` : "Belum tersedia"),
          crmLines: crmSummary?.lines,
          note: crmSummary ? `${crmSummary.note} Periode: ${analysisPeriod.label}.` : "Pesan tidak dikumpulkan otomatis. Data CRM berasal dari input atau unggahan klien.",
        };

        // Build 6 Core Metrics mathematically
        const isCostValid = hasActiveIntegration && verifiedInboundMessages !== null && verifiedInboundMessages > 0;
        const costPerConversation = isCostValid ? Number((data.metrics.spend / (verifiedInboundMessages || 1)).toFixed(2)) : null;

        const coreMetrics = buildCoreMetrics({
          spend: data.metrics.spend,
          linkClicks: data.metrics.linkClicks,
          linkCpc: data.metrics.linkCpc ?? null,
          metaConversations: data.metrics.results,
          crmLeadsCount,
          crmMetricNote: crmSummary?.note,
          verifiedWhatsAppMessages: verifiedInboundMessages,
          hasActiveIntegration,
          costPerConversation,
          isCostPerConversationValid: isCostValid,
          locale: data.locale,
        });

        const allMetricsDetailed = [
          { label: "Total Belanja", value: formatRupiah(data.metrics.spend), explanation: "Biaya resmi yang ditagihkan platform Meta." },
          { label: "Tayangan (Impressions)", value: `${data.metrics.impressions.toLocaleString("id-ID")} kali`, explanation: "Frekuensi materi iklan tampil di layar pengguna." },
          { label: "Jangkauan (Reach)", value: data.metrics.reach !== null && data.metrics.reach > 0 ? `${data.metrics.reach.toLocaleString("id-ID")} orang` : "Tidak tersedia", explanation: "Jumlah pengguna unik yang melihat iklan (hanya valid satu hari; multi-hari tidak dijumlahkan)." },
          { label: "Klik Tautan", value: `${data.metrics.linkClicks.toLocaleString("id-ID")} klik`, explanation: "Klik tombol/tautan spesifik menuju WhatsApp." },
          { label: "Semua Klik", value: `${data.metrics.allClicks.toLocaleString("id-ID")} interaksi`, explanation: "Seluruh sentuhan interaksi pada postingan iklan." },
          { label: "CTR Tautan", value: data.metrics.linkCtr !== null ? `${data.metrics.linkCtr}%` : "Tidak dapat dihitung", explanation: "Persentase penonton yang menekan tautan." },
          { label: "CPM", value: data.metrics.cpm !== null ? formatRupiah(data.metrics.cpm) : "Tidak dapat dihitung", explanation: "Biaya lelang per 1.000 tayangan iklan." },
          { label: "Percakapan Messaging", value: data.metrics.messagingConversations != null ? `${data.metrics.messagingConversations.toLocaleString("id-ID")}` : "Tidak tersedia", explanation: "Chat yang Meta laporkan dimulai dari iklan CTWA. Angka ini tidak sama dengan jumlah catatan CRM." },
        ];

        const cardCopy = composeAdCardCopy({
          locale: data.locale === "en" ? "en" : "id",
          paused: /paused|dijeda|archived|arsip/i.test(data.status || ""),
          spend: data.metrics.spend,
          conversations: data.metrics.messagingConversations ?? null,
          costPerConversation: data.metrics.costPerMessagingConversation ?? null,
          linkCtr: data.metrics.linkCtr ?? null,
          hasTarget: false,
          directProspects: crmSummary?.availability === "error" ? null : crmSummary?.attributedToAd ?? crmLeadsCount,
          campaignOnly: crmSummary?.availability === "error" ? null : crmSummary?.campaignOnly ?? null,
          crmFailed: crmSummary?.availability === "error",
        });

        const responsePayload: AIAdAnalysisResponse = {
          isLiveAi: true,
          provider: "meta_model_api",
          model: response.model || config.museSparkModel,
          maskedApiKey: maskApiKey(config.apiKey),
          analyzedAt: new Date().toISOString(),
          adName: data.adName,
          campaignName: data.campaignName,
          campaignObjective: data.campaignObjective,
          performanceSummary: cardCopy.summary,
          sourceDataStatus: dataSourceStatus,
          budgetDecision: { ...validData.budgetDecision, reason: cardCopy.reason },
          keyFindings: validData.keyFindings,
          priorityActions: validData.priorityActions,
          coreMetrics,
          additionalDetails: {
            ...validData.additionalDetails,
            allMetrics: allMetricsDetailed,
          },
          executiveSummary: cardCopy.summary,
          actionDecision: {
            priority:
              validData.budgetDecision.decision === "NAIKKAN"
                ? "OPTIMALKAN"
                : validData.budgetDecision.decision === "TAHAN KENAIKAN"
                ? "PANTAU"
                : validData.budgetDecision.decision === "HENTIKAN SEMENTARA"
                ? "EVALUASI_PENGHENTIAN"
                : validData.budgetDecision.decision === "KURANGI"
                ? "EVALUASI_PENGHENTIAN"
                : "PERTAHANKAN",
            priorityLabel: validData.budgetDecision.decision,
            headline: validData.budgetDecision.decision,
            justification: cardCopy.reason,
          },
          recommended_action: validData.recommended_action,
          chain_of_thought: validData.chain_of_thought,
          context_awareness: validData.context_awareness,
        };

        if (reservation.reservationId && !(await finishAiAnalysis(user.id, reservation.reservationId, true))) {
          return NextResponse.json({ success: false, error: "Analisis selesai tetapi pencatatan kuota belum terkonfirmasi. Segarkan penggunaan sebelum mencoba lagi.", code: "QUOTA_COMMIT_FAILED" }, { status: 503 });
        }
        quotaReservation = null;
        return NextResponse.json({
          success: true,
          data: responsePayload,
        });
      } catch (aiErr) {
        await releaseReservation("ai_call_failed");
        console.error("[AI Analysis] Exception during model call:", aiErr);
        return NextResponse.json(
          {
            success: false,
            error: "Gagal memproses analisis AI dari server model. Silakan coba kembali.",
            code: "AI_CALL_FAILED",
          },
          { status: 502 }
        );
      }
    }

    // 4. Safety net only (unreachable in normal flow: the AI branch above
    // always returns, and the non-configured case returned earlier).
    // Deterministic output must never consume AI quota, so release the
    // reservation instead of completing it as a success.
    const deterministicAnalysis = generateDeterministicAdAnalysis(data, {
      hasActiveIntegration,
      metaConversions: data.metrics.results,
      verifiedInboundMessages,
      crmLeadsCount,
      crmSurveysCount,
      crmClosingsCount,
    });

    await releaseReservation("deterministic_output_no_quota");
    return NextResponse.json({
      success: true,
      data: deterministicAnalysis,
    });
  } catch (error) {
    if (quotaReservation) {
      await finishAiAnalysis(quotaReservation.userId, quotaReservation.reservationId, false, "analysis_failed");
    }
    const errorMsg = error instanceof Error ? error.message : "Kesalahan internal";
    console.error("[AI Analysis] Unhandled exception:", errorMsg);
    return NextResponse.json(
      { success: false, error: `Gagal memproses analisis AI: ${errorMsg}`, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
