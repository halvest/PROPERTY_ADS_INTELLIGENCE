import { NextRequest, NextResponse } from "next/server";
import { finishAiAnalysis, validateIdempotencyKey, reserveAiAnalysis } from "@/lib/ai/usage-quota";
import { z } from "zod";
import { isMetaModelApiConfigured, maskApiKey, getMetaConfig } from "@/lib/ai/meta/config";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

// Request Schema
const AnalyzeAdRequestSchema = z.object({
  adId: z.string().optional(),
  adName: z.string().min(1, "Nama iklan wajib disertakan"),
  campaignName: z.string().optional(),
  campaignObjective: z.string().nullable().optional(),
  status: z.string().optional(),
  metrics: z.object({
    spend: z.number().default(0),
    impressions: z.number().default(0),
    reach: z.number().default(0),
    linkClicks: z.number().default(0),
    allClicks: z.number().default(0),
    linkCtr: z.number().nullable().optional(),
    allCtr: z.number().nullable().optional(),
    linkCpc: z.number().nullable().optional(),
    allCpc: z.number().nullable().optional(),
    cpm: z.number().nullable().optional(),
    results: z.number().default(0),
    costPerResult: z.number().nullable().optional(),
    resultType: z.string().optional().default("Percakapan WhatsApp / Hasil"),
    resultsTrackingStatus: z
      .enum(["TERVERIFIKASI ADA", "TERVERIFIKASI NOL", "BELUM TERVERIFIKASI", "DATA TIDAK KONSISTEN"])
      .optional(),
    attributedLeads: z.number().default(0),
    qualifiedLeads: z.number().default(0),
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
}

// Zod schema to validate live model JSON
const ModelOutputSchema = z.object({
  performanceSummary: z.string(),
  sourceDataStatus: z.object({
    metaResults: z.string(),
    crmProspects: z.string(),
    note: z.string().nullable().optional(),
  }),
  budgetDecision: z.object({
    decision: z.enum(["NAIKKAN", "PERTAHANKAN", "TAHAN KENAIKAN", "KURANGI", "HENTIKAN SEMENTARA"]),
    reason: z.string(),
  }),
  keyFindings: z
    .array(
      z.object({
        finding: z.string(),
        evidence: z.string(),
        impact: z.string(),
        isHypothesis: z.boolean().default(false),
      })
    )
    .max(3),
  priorityActions: z
    .array(
      z.object({
        action: z.string(),
        howToCheck: z.string(),
        expectedResult: z.string(),
      })
    )
    .max(3),
  additionalDetails: z.object({
    funnelEvaluation: z.object({
      firstFailingStage: z.string(),
      explanation: z.string(),
    }),
    facts: z.array(z.string()).default([]),
    hypotheses: z.array(z.string()).default([]),
    unknowns: z.array(z.string()).default([]),
    creativeNotes: z.string().nullable().optional(),
  }),
});

/**
 * Format currency without space after Rp (e.g. Rp323.001)
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "Tidak dapat dihitung";
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

/**
 * Safely parses raw string from model, stripping markdown fences if present.
 */
function parseModelJson(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return JSON.parse(cleaned);
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
  verifiedWhatsAppMessages?: number | null;
  hasActiveIntegration?: boolean;
  costPerConversation?: number | null;
  isCostPerConversationValid?: boolean;
  costPerConversationNote?: string;
}): CoreMetricItem[] {
  const {
    spend,
    linkClicks,
    linkCpc,
    metaConversations,
    crmLeadsCount = null,
  } = params;

  return [
    {
      id: "spend",
      label: "Belanja Iklan",
      rawValue: spend,
      formattedValue: formatRupiah(spend),
      isValid: true,
    },
    {
      id: "linkClicks",
      label: "Klik Tautan",
      rawValue: linkClicks,
      formattedValue: `${linkClicks.toLocaleString("id-ID")} klik tautan`,
      isValid: true,
    },
    {
      id: "linkCpc",
      label: "CPC Tautan",
      rawValue: linkCpc,
      formattedValue: linkCpc !== null ? `${formatRupiah(linkCpc)} / klik` : "Tidak dapat dihitung",
      isValid: linkCpc !== null,
    },
    {
      id: "metaConversations",
      label: "Hasil menurut Meta",
      rawValue: metaConversations,
      formattedValue: metaConversations !== null ? `${metaConversations.toLocaleString("id-ID")} hasil` : "Tidak tersedia",
      isValid: metaConversations !== null,
    },
    {
      id: "crmLeads",
      label: "Prospek CRM Tercatat",
      rawValue: crmLeadsCount,
      formattedValue:
        crmLeadsCount === null
          ? "Belum tersedia"
          : `${crmLeadsCount.toLocaleString("id-ID")} prospek`,
      isValid: crmLeadsCount !== null,
      note: "Jumlah dari input atau unggahan klien; bukan pesan yang diverifikasi otomatis.",
    },
    {
      id: "costPerCrmLead",
      label: "Biaya per Prospek CRM",
      rawValue: crmLeadsCount !== null && crmLeadsCount > 0 ? Number((spend / crmLeadsCount).toFixed(2)) : null,
      formattedValue:
        crmLeadsCount !== null && crmLeadsCount > 0
          ? `${formatRupiah(spend / crmLeadsCount)} / prospek`
          : "Tidak dapat dihitung",
      isValid: crmLeadsCount !== null && crmLeadsCount > 0,
      note: "Belanja Meta dibagi jumlah prospek CRM terkait dengan iklan ini.",
    },
  ];
}

/**
 * Helper to build verified metrics summary (backward-compatible).
 */
export function buildVerifiedMetricsSummary(params: {
  spend: number;
  impressions: number;
  reach: number;
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
      rawValue: reach > 0 ? reach : null,
      formattedValue: reach > 0 ? `${reach.toLocaleString("id-ID")} orang` : "Tidak tersedia",
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
      formattedValue: (qualifiedLeads ?? 0) > 0 ? `${qualifiedLeads} prospek` : "Belum dicatat di CRM",
      plainExplanation: "Calon pembeli yang telah dikonfirmasi memiliki anggaran dan minat survei lokasi.",
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
    crmProspects: crmLeads !== null ? `${crmLeads.toLocaleString("id-ID")} prospek dari CRM` : "Belum tersedia",
    note: statusNote || "Data prospek berasal dari input atau unggahan klien. Pesan tidak dikumpulkan otomatis.",
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
      : "Belum ada prospek CRM yang dicatat untuk iklan ini. Lengkapi data prospek sebelum menilai biaya per prospek.";
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
      reach === 0 ? "Jumlah individu unik yang dijangkau." : "",
      context.crmSurveysCount === 0 ? "Belum ada catatan survei lokasi di data CRM yang tersedia." : "",
    ].filter(Boolean),
    allMetrics: [
      { label: "Total Belanja", value: formatRupiah(spend), explanation: "Biaya resmi dari platform Meta." },
      { label: "Tayangan (Impressions)", value: `${impressions.toLocaleString("id-ID")} kali`, explanation: "Frekuensi materi iklan tampil di layar." },
      { label: "Jangkauan (Reach)", value: reach > 0 ? `${reach.toLocaleString("id-ID")} orang` : "Tidak tersedia", explanation: "Jumlah orang unik yang melihat iklan." },
      { label: "Klik Tautan", value: `${linkClicks.toLocaleString("id-ID")} klik`, explanation: "Klik tombol/tautan menuju WhatsApp." },
      { label: "Semua Klik", value: `${allClicks.toLocaleString("id-ID")} interaksi`, explanation: "Seluruh interaksi sentuhan pada postingan iklan." },
      { label: "CTR Tautan", value: linkCtr !== null ? `${linkCtr}%` : "Tidak dapat dihitung", explanation: "Persentase klik tautan dari total tayangan." },
      { label: "CPM", value: cpm !== null ? formatRupiah(cpm) : "Tidak dapat dihitung", explanation: "Biaya per 1.000 penayangan iklan." },
    ],
    creativeNotes:
      "Gunakan foto atau video bangunan/lahan asli dengan pencahayaan siang hari yang jelas. Sertakan kejelasan legalitas dan skema pembayaran yang telah terverifikasi.",
  };

  return {
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
}

/**
 * POST /api/ai/analyze-ad
 * Strictly manual AI analysis. Never triggered automatically.
 */
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

    const hasActiveIntegration = false;
    const verifiedInboundMessages: number | null = null;
    let crmLeadsCount: number | null = null;
    let crmSurveysCount = 0;
    let crmClosingsCount = 0;

    // 2. Ground-Truth Data Sourcing from Server Database (Tenant Isolated)
    if (data.adId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.adId);
      let query = supabase
        .from("ads")
        .select("id, name, status, provider_ad_id, campaign_id, campaigns(id, name, objective)")
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

      // Fetch authentic persisted insights from database
      const { data: insights } = await supabase
        .from("ad_insights")
        .select("spend, impressions, clicks, reach, link_clicks, conversions, currency, date_start, date_stop")
        .eq("ad_id", verifiedAd.id)
        .eq("organization_id", organizationId);

      let serverSpend = 0;
      let serverImpressions = 0;
      let serverReach = 0;
      let serverLinkClicks = 0;
      let serverAllClicks = 0;
      let serverConversions = 0;

      (insights || []).forEach((ins) => {
        serverSpend += Number(ins.spend) || 0;
        serverImpressions += Number(ins.impressions) || 0;
        serverReach += Number(ins.reach) || 0;
        serverLinkClicks += Number(ins.link_clicks) || 0;
        serverAllClicks += Number(ins.clicks) || 0;
        serverConversions += Number(ins.conversions) || 0;
      });

      serverSpend = Math.round(serverSpend * 100) / 100;

      const serverLinkCtr = serverImpressions > 0 ? Number(((serverLinkClicks / serverImpressions) * 100).toFixed(2)) : null;
      const serverLinkCpc = serverLinkClicks > 0 ? Number((serverSpend / serverLinkClicks).toFixed(2)) : null;
      const serverAllCtr = serverImpressions > 0 ? Number(((serverAllClicks / serverImpressions) * 100).toFixed(2)) : null;
      const serverAllCpc = serverAllClicks > 0 ? Number((serverSpend / serverAllClicks).toFixed(2)) : null;
      const serverCpm = serverImpressions > 0 ? Number(((serverSpend / serverImpressions) * 1000).toFixed(2)) : null;
      const serverCostPerResult = serverConversions > 0 ? Number((serverSpend / serverConversions).toFixed(2)) : null;

      // Query CRM leads count
      const { count: leadsCount } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("ad_id", verifiedAd.id)
        .eq("organization_id", organizationId)
        .eq("channel", "crm_upload")
        .neq("attribution_status", "unknown");

      crmLeadsCount = leadsCount;

      // Query CRM surveys & closings for THIS ad only (via its conversations)
      const { data: adConvs } = await supabase
        .from("conversations")
        .select("id")
        .eq("ad_id", verifiedAd.id)
        .eq("organization_id", organizationId)
        .eq("channel", "crm_upload");
      const adConvIds = (adConvs || []).map((c) => c.id);
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

      // Qualified leads must come from server assessments, not client input.
      let serverQualifiedLeads = 0;
      if (adConvIds.length) {
        const { data: assessments } = await supabase
          .from("lead_assessments")
          .select("buyer_score, conversation_id")
          .eq("organization_id", organizationId)
          .in("conversation_id", adConvIds);
        serverQualifiedLeads = (assessments || []).filter(
          (a) => a.buyer_score !== null && Number(a.buyer_score) >= 70
        ).length;
      }

      const campaignData = verifiedAd.campaigns as { id?: string; name?: string; objective?: string } | null;

      data = {
        ...data,
        adName: verifiedAd.name,
        campaignName: campaignData?.name || data.campaignName,
        campaignObjective: campaignData?.objective || data.campaignObjective,
        status: verifiedAd.status,
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
          resultType: "Hasil Meta",
          attributedLeads: crmLeadsCount || 0,
          qualifiedLeads: serverQualifiedLeads,
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
    quotaReservation = { userId: user.id, reservationId: reservation.reservationId };
    const releaseReservation = async (code: string) => {
      if (!quotaReservation) return;
      await finishAiAnalysis(quotaReservation.userId, quotaReservation.reservationId, false, code);
      quotaReservation = null;
    };

    // 3. Live AI Execution with Strict CTWA Constraints
    if (isConfigured) {
      try {
        const client = new MetaModelApiClient({ timeoutMs: 35000, maxRetries: 0 });

        const systemPrompt = `Anda adalah Analis Meta Ads untuk pemasaran properti. Analisis performa iklan Meta dan catatan CRM yang dimasukkan atau diunggah klien.

TUGAS UTAMA:
Membantu pemilik bisnis dan tim marketing memahami:
1. Apa yang ditunjukkan data hasil Meta dan catatan prospek CRM yang tersedia.
2. Apakah biaya iklan sebanding dengan hasil yang diperoleh.
3. Apa masalah paling mungkin berdasarkan data yang tersedia.
4. Tindakan apa yang harus dilakukan selanjutnya.

GAYA BAHASA & ATURAN WAJIB:
- Gunakan bahasa Indonesia sehari-hari yang profesional, kalimat pendek, langsung ke inti.
- Maksimal 2 kalimat per paragraf.
- Hindari frasa berulang ("Hal ini menunjukkan bahwa...", "Dampak bisnis properti...", "Keramaian ini belum menghasilkan peluang...").
- Gunakan format Rupiah yang konsisten tanpa spasi, contoh: Rp323.001.

ATURAN MUTLAK VALIDASI DATA:
1. Jangan menyamakan klik tautan, hasil Meta, dan jumlah prospek CRM.
2. Status sumber data (sourceDataStatus) harus menjelaskan hasil Meta dan prospek CRM apa adanya:
   - Pesan tidak diambil otomatis; CRM hanya memuat catatan yang dimasukkan/diunggah klien.
   - Tandai ketidakkonsistenan di catatan hanya jika angka dari sumber yang tersedia saling bertentangan.
3. Jika jumlah percakapan adalah 0, biaya per percakapan TIDAK BOLEH dianggap valid.
4. KEPUTUSAN ANGGARAN (budgetDecision.decision) WAJIB MEMILIH SALAH SATU:
   - NAIKKAN
   - PERTAHANKAN
   - TAHAN KENAIKAN
   - KURANGI
   - HENTIKAN SEMENTARA
   Disertai alasan maksimal 2 kalimat.
5. TEMUAN PENTING (keyFindings): Maksimal 3 temuan. Setiap temuan HANYA berisi: finding (1 kalimat), evidence (angka relevan), impact (1 kalimat sederhana).
6. TINDAKAN PRIORITAS (priorityActions): Maksimal 3 tindakan. Setiap tindakan berisi: action (apa yang dilakukan), howToCheck (cara periksa), expectedResult (hasil yang diharapkan).
7. TRANSPARANSI DATA & PANDUAN MATERI IKLAN:
   - JANGAN MENGARANG INFORMASI PROPERTI, HARGA, ATAU PROMOSI.
   - Benchmark eksternal industri properti spesifik wilayah belum diverifikasi, gunakan data internal aktual.
   - Jika pengguna meminta rekomendasi struktur materi iklan, gunakan placeholder: [Sebutkan Lokasi Strategis], [Sebutkan Legalitas: misal SHM / PBG Ready], [Sebutkan Skema: misal KPR DP Ringan / Cash Bertahap].

HASILKAN OUTPUT JSON MURNI DENGAN STRUKTUR:
{
  "performanceSummary": "string maksimal 3-4 baris ringkasan kinerja to-the-point",
  "sourceDataStatus": {
    "metaResults": "string jumlah hasil Meta atau 'Tidak tersedia'",
    "crmProspects": "string jumlah prospek CRM atau 'Belum tersedia'",
    "note": "string maksimal satu kalimat catatan jika ada kendala data"
  },
  "budgetDecision": {
    "decision": "NAIKKAN" | "PERTAHANKAN" | "TAHAN KENAIKAN" | "KURANGI" | "HENTIKAN SEMENTARA",
    "reason": "string alasan keputusan maksimal 2 kalimat"
  },
  "keyFindings": [
    {
      "finding": "string satu kalimat temuan",
      "evidence": "string angka relevan",
      "impact": "string satu kalimat dampak sederhana",
      "isHypothesis": boolean
    }
  ],
  "priorityActions": [
    {
      "action": "string apa yang harus dilakukan",
      "howToCheck": "string cara memeriksanya",
      "expectedResult": "string hasil yang diharapkan"
    }
  ],
  "additionalDetails": {
    "funnelEvaluation": {
      "firstFailingStage": "string tahap pertama yang bermasalah",
      "explanation": "string penjelasan singkat masalah pada tahap tersebut"
    },
    "facts": ["string fakta 1", "string fakta 2"],
    "hypotheses": ["string hipotesis 1"],
    "unknowns": ["string informasi yang belum diketahui"],
    "creativeNotes": "string catatan materi iklan jika relevan"
  }
}`;

        const userPrompt = `Analisis performa iklan properti CTWA berikut:
Nama Iklan: "${data.adName}"
Kampanye: "${data.campaignName || "Kampanye Properti"}"
Objektif Kampanye: "${data.campaignObjective || "Belum ditentukan"}"
Status: ${data.status || "ACTIVE"}

Data Metrik Aktual:
- Belanja Iklan: ${formatRupiah(data.metrics.spend)}
- Penayangan (Impressions): ${data.metrics.impressions.toLocaleString("id-ID")} kali
- Klik Tautan (Link Clicks): ${data.metrics.linkClicks.toLocaleString("id-ID")} klik tautan
- CPC Tautan: ${data.metrics.linkCpc !== null && data.metrics.linkCpc !== undefined ? `${formatRupiah(data.metrics.linkCpc)} / klik` : "Tidak dapat dihitung"}
- Hasil menurut Meta: ${data.metrics.results !== null ? `${data.metrics.results.toLocaleString("id-ID")} hasil` : "Tidak tersedia"}
- Prospek dari data yang dimasukkan/diunggah klien: ${crmLeadsCount !== null ? `${crmLeadsCount.toLocaleString("id-ID")} prospek` : "Belum tersedia"}
- Jadwal Survei CRM: ${crmSurveysCount} survei
- Closing Transaksi: ${crmClosingsCount} transaksi

Berikan analisis singkat, padat, dan langsung pada keputusan bisnis. Jangan menyamakan hasil Meta dengan jumlah prospek CRM.`;

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

        const validData = validationResult.data;
        const dataSourceStatus: SourceDataStatusSection = {
          metaResults:
            data.metrics.results !== null && data.metrics.results !== undefined
              ? `${data.metrics.results.toLocaleString("id-ID")} hasil`
              : "Tidak tersedia",
          crmProspects:
            crmLeadsCount !== null
              ? `${crmLeadsCount.toLocaleString("id-ID")} prospek dari CRM`
              : "Belum tersedia",
          note: "Pesan tidak dikumpulkan otomatis. Data CRM berasal dari input atau unggahan klien.",
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
          verifiedWhatsAppMessages: verifiedInboundMessages,
          hasActiveIntegration,
          costPerConversation,
          isCostPerConversationValid: isCostValid,
        });

        const allMetricsDetailed = [
          { label: "Total Belanja", value: formatRupiah(data.metrics.spend), explanation: "Biaya resmi yang ditagihkan platform Meta." },
          { label: "Tayangan (Impressions)", value: `${data.metrics.impressions.toLocaleString("id-ID")} kali`, explanation: "Frekuensi materi iklan tampil di layar pengguna." },
          { label: "Jangkauan (Reach)", value: data.metrics.reach > 0 ? `${data.metrics.reach.toLocaleString("id-ID")} orang` : "Tidak tersedia", explanation: "Jumlah pengguna unik yang melihat iklan." },
          { label: "Klik Tautan", value: `${data.metrics.linkClicks.toLocaleString("id-ID")} klik`, explanation: "Klik tombol/tautan spesifik menuju WhatsApp." },
          { label: "Semua Klik", value: `${data.metrics.allClicks.toLocaleString("id-ID")} interaksi`, explanation: "Seluruh sentuhan interaksi pada postingan iklan." },
          { label: "CTR Tautan", value: data.metrics.linkCtr !== null ? `${data.metrics.linkCtr}%` : "Tidak dapat dihitung", explanation: "Persentase penonton yang menekan tautan." },
          { label: "CPM", value: data.metrics.cpm !== null ? formatRupiah(data.metrics.cpm) : "Tidak dapat dihitung", explanation: "Biaya lelang per 1.000 tayangan iklan." },
        ];

        const responsePayload: AIAdAnalysisResponse = {
          isLiveAi: true,
          provider: "meta_model_api",
          model: response.model || config.museSparkModel,
          maskedApiKey: maskApiKey(config.apiKey),
          analyzedAt: new Date().toISOString(),
          adName: data.adName,
          campaignName: data.campaignName,
          campaignObjective: data.campaignObjective,
          performanceSummary: validData.performanceSummary,
          sourceDataStatus: dataSourceStatus,
          budgetDecision: validData.budgetDecision,
          keyFindings: validData.keyFindings,
          priorityActions: validData.priorityActions,
          coreMetrics,
          additionalDetails: {
            ...validData.additionalDetails,
            allMetrics: allMetricsDetailed,
          },
          executiveSummary: validData.performanceSummary,
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
            justification: validData.budgetDecision.reason,
          },
        };

        if (!(await finishAiAnalysis(user.id, reservation.reservationId, true))) {
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
