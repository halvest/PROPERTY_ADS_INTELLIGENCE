/**
 * Property Ads Intelligence - Dashboard Service
 * Pure data access layer connecting synthetic demo dataset and deterministic domain logic.
 * Adheres strictly to the invariant: domain modules compute scores, UI only presents.
 */

import { SYNTHETIC_LEAD_SCENARIOS, type SyntheticLeadScenario } from "@/fixtures/synthetic-leads";
import { calculateBuyerScore } from "@/domain/scoring/buyer-score";
import { calculateSalesScore } from "@/domain/scoring/sales-score";
import { evaluateAttribution, filterLeadsForAdRanking } from "@/domain/attribution/evaluator";
import type { AttributionStatus } from "@/domain/attribution/types";
import {
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateCPQL,
} from "@/domain/metrics/marketing";
import { evaluateAllAds } from "@/domain/recommendations/engine";
import type {
  AdOptimizationRecommendation,
  AdEvaluationInput,
  RecommendationCategory,
} from "@/domain/recommendations/types";
import type {
  DashboardKPISummary,
  AdLeaderboardItem,
  LeadListItem,
  LeadDetailView,
  ReviewQueueItem,
  IntegrationStatusItem,
  QualityLabel,
} from "./types";

// In-memory corrections storage for demo review workflow
const customCorrections: Record<
  string,
  Array<{
    previousStatus: AttributionStatus;
    newStatus: AttributionStatus;
    reason: string;
    timestamp: string;
    actorName?: string;
  }>
> = {};

/**
 * In-memory user actions on recommendations (review / dismiss).
 *
 * CATATAN ARSITEKTUR & KEAMANAN MULTI-TENANT (PHASE 9.1 AUDIT):
 * Store ini bersifat in-memory untuk mode pengujian deterministik & demo mock.
 * Data AKAN RESET ketika server Next.js di-restart.
 *
 * Untuk mencegah kebocoran antar tenant (cross-tenant leakage), kunci penyimpanan
 * diisolasi secara ketat dengan format: `${organizationId}:${recommendationId}`.
 *
 * Pada fase produksi live berikutnya, tabel Supabase (e.g. `ad_recommendation_reviews`)
 * dengan RLS berbasis tenant `organization_id` wajib digunakan sebagai layer persisten.
 */
const recommendationActionStore: Record<
  string, // Key: `${organizationId}:${recommendationId}`
  {
    status: "reviewed" | "dismissed";
    organizationId: string;
    actorId: string;
    actorName: string;
    reviewedAt: string;
    note?: string;
  }
> = {};

// Static ad metadata matching campaigns in seed.sql & fixtures
const AD_METADATA_MAP: Record<
  string,
  {
    adName: string;
    campaignName: string;
    spend: number;
    impressions: number;
    clicks: number;
    status: "ACTIVE" | "PAUSED";
  }
> = {
  ad_sapphire_72: {
    adName: "Cluster Sapphire BSD - Tipe 72 Hook Siap Huni",
    campaignName: "Kampanye Cluster Sapphire BSD",
    spend: 4500000,
    impressions: 48200,
    clicks: 1250,
    status: "ACTIVE",
  },
  ad_sapphire_promo: {
    adName: "Cluster Sapphire BSD - Promo DP 0% Cicilan Ringan",
    campaignName: "Kampanye Cluster Sapphire BSD",
    spend: 6200000,
    impressions: 89400,
    clicks: 2410,
    status: "ACTIVE",
  },
  ad_promo_oktoberfest: {
    adName: "Cluster Sapphire BSD - Promo Spesial Oktoberfest",
    campaignName: "Kampanye Cluster Sapphire BSD",
    spend: 3100000,
    impressions: 35000,
    clicks: 890,
    status: "ACTIVE",
  },
  ad_villa_lembang: {
    adName: "Villa Heritage Lembang - View Pegunungan Asri",
    campaignName: "Kampanye Villa Heritage Lembang",
    spend: 2800000,
    impressions: 24100,
    clicks: 520,
    status: "ACTIVE",
  },
};

/**
 * Helper to process all synthetic scenarios through deterministic domain logic.
 */
function processAllScenarios(): Array<{
  scenario: SyntheticLeadScenario;
  leadItem: LeadListItem;
  detailView: LeadDetailView;
}> {
  const allScenarios = Object.values(SYNTHETIC_LEAD_SCENARIOS);

  return allScenarios.map((sc, index) => {
    // 1. Domain Buyer Score
    const buyerAssessment = calculateBuyerScore(sc.buyerCriteria);

    // 2. Domain Sales Score
    const salesAssessment = calculateSalesScore({
      criteriaInputs: sc.salesCriteria,
      messages: sc.messages,
      slaConfig: { slaMinutes: 60 },
    });

    // 3. Domain Attribution
    const attrResult = evaluateAttribution({
      rawReferral: sc.attribution.rawReferral,
      inferredCandidate: sc.attribution.inferredCandidate,
    });

    // Masked phone & display name
    const phoneMasked = `+62 812-****-${String(1000 + index).slice(1)}`;
    const adMeta = attrResult.adId ? AD_METADATA_MAP[attrResult.adId] : null;

    // Check last message timestamp
    const lastMsg = sc.messages[sc.messages.length - 1];
    const lastMessageAt = lastMsg ? String(lastMsg.sentAt) : "2026-10-24T12:00:00Z";

    // Review flag condition: invalid score, completeness < 80%, SLA overdue, or unknown attribution
    let needsReview = false;
    let reviewReason = "";
    if (buyerAssessment.status === "invalid" || salesAssessment.status === "invalid") {
      needsReview = true;
      reviewReason = "Terdapat kriteria penilaian dengan input invalid / di luar batas";
    } else if (buyerAssessment.completeness < 70 && buyerAssessment.completeness > 0) {
      needsReview = true;
      reviewReason = `Kelengkapan Buyer Score belum memadai (${buyerAssessment.completeness}%)`;
    } else if (salesAssessment.criteria.response_speed?.status === "scored" && salesAssessment.criteria.response_speed.score === 0) {
      needsReview = true;
      reviewReason = "SLA respons sales telah terlampaui tanpa balasan (0 poin)";
    } else if (attrResult.status === "inferred") {
      needsReview = true;
      reviewReason = "Atribusi berstatus inferensi; perlu konfirmasi reviewer";
    }

    const initialHistory = sc.correctionHistory || [];
    const recordedCustom = customCorrections[sc.id] || [];
    const combinedHistory = [...initialHistory, ...recordedCustom];

    const domisiliList = ["Jakarta Selatan", "Tangerang Selatan", "Bandung", "Surabaya", "Depok", "Bekasi", "Bogor"];
    const domisili = domisiliList[index % domisiliList.length];
    const qualityLabel: QualityLabel =
      (buyerAssessment.normalizedScore ?? 0) >= 80 ? "Hot" :
      (buyerAssessment.normalizedScore ?? 0) >= 55 ? "Warm" : "Cold";

    const leadItem: LeadListItem = {
      id: sc.id,
      name: sc.name,
      phoneMasked,
      domisili,
      funnelStage: sc.funnelStage,
      qualityLabel,
      notes: sc.description,
      attributionStatus: attrResult.status,
      adName: adMeta?.adName || null,
      campaignName: adMeta?.campaignName || null,
      buyerAssessment,
      salesAssessment,
      lastMessageAt,
      messageCount: sc.messages.length,
      needsReview,
      reviewReason: reviewReason || undefined,
    };

    const detailView: LeadDetailView = {
      ...leadItem,
      description: sc.description,
      messages: sc.messages,
      attributionEvidence: attrResult.evidence,
      attributionReason: attrResult.reason,
      correctionHistory: combinedHistory,
    };

    return { scenario: sc, leadItem, detailView };
  });
}

/**
 * Filter items by date range filter.
 * Reference date for demo: 2026-10-26.
 */
function isDateWithinRange(isoDateStr: string, range: string): boolean {
  if (!range || range === "all") return true;

  const date = new Date(isoDateStr).getTime();
  if (Number.isNaN(date)) return true;

  const referenceNow = new Date("2026-10-26T23:59:59Z").getTime();
  const diffDays = (referenceNow - date) / (1000 * 60 * 60 * 24);

  if (range === "7d") return diffDays <= 7 && diffDays >= 0;
  if (range === "14d") return diffDays <= 14 && diffDays >= 0;
  if (range === "30d") return diffDays <= 30 && diffDays >= 0;

  return true;
}

/**
 * Retrieves aggregate Dashboard KPI Summary.
 */
export function getDashboardKPISummary(dateRange = "all"): DashboardKPISummary {
  const processed = processAllScenarios().filter((p) =>
    isDateWithinRange(p.leadItem.lastMessageAt, dateRange)
  );

  // Sum ad spend, impressions, clicks from all active demo ads
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;

  Object.values(AD_METADATA_MAP).forEach((ad) => {
    totalSpend += ad.spend;
    totalImpressions += ad.impressions;
    totalClicks += ad.clicks;
  });

  const totalLeads = processed.length;

  // Qualified leads: Buyer Score >= 70 AND valid attribution (verified or inferred)
  const qualifiedLeads = processed.filter((p) => {
    const isHighIntent = (p.leadItem.buyerAssessment.normalizedScore ?? 0) >= 70;
    const isAttributed = p.leadItem.attributionStatus !== "unknown";
    return isHighIntent && isAttributed;
  }).length;

  // Domain calculations for CTR, CPC, CPM, CPQL
  const ctr = calculateCTR(totalClicks, totalImpressions);
  const cpc = calculateCPC(totalSpend, totalClicks);
  const cpm = calculateCPM(totalSpend, totalImpressions);
  const cpql = calculateCPQL(totalSpend, qualifiedLeads);

  // Average Buyer Score & Sales Score (with sample sizes)
  const validBuyerScores = processed
    .map((p) => p.leadItem.buyerAssessment.normalizedScore)
    .filter((s): s is number => typeof s === "number" && s !== null);

  const buyerScoreSampleSize = validBuyerScores.length;
  const avgBuyerScore =
    buyerScoreSampleSize > 0
      ? Number(
          (
            validBuyerScores.reduce((sum, s) => sum + s, 0) / buyerScoreSampleSize
          ).toFixed(1)
        )
      : null;

  const validSalesScores = processed
    .map((p) => p.leadItem.salesAssessment.normalizedScore)
    .filter((s): s is number => typeof s === "number" && s !== null);

  const salesScoreSampleSize = validSalesScores.length;
  const avgSalesScore =
    salesScoreSampleSize > 0
      ? Number(
          (
            validSalesScores.reduce((sum, s) => sum + s, 0) / salesScoreSampleSize
          ).toFixed(1)
        )
      : null;

  // Attribution Coverage
  const verifiedCount = processed.filter(
    (p) => p.leadItem.attributionStatus === "verified"
  ).length;
  const inferredCount = processed.filter(
    (p) => p.leadItem.attributionStatus === "inferred"
  ).length;
  const unknownCount = processed.filter(
    (p) => p.leadItem.attributionStatus === "unknown"
  ).length;

  const verifiedPercentage =
    totalLeads > 0 ? Number(((verifiedCount / totalLeads) * 100).toFixed(1)) : 0;

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    ctr,
    cpc,
    cpm,
    totalLeads,
    qualifiedLeads,
    cpql,
    avgBuyerScore,
    buyerScoreSampleSize,
    avgSalesScore,
    salesScoreSampleSize,
    attributionCoverage: {
      verifiedCount,
      inferredCount,
      unknownCount,
      total: totalLeads,
      verifiedPercentage,
    },
    currency: "IDR",
  };
}

/**
 * Retrieves Ad Quality Leaderboard.
 * CRITICAL RULE: Unknown attribution leads are STRICTLY EXCLUDED from ad-specific rankings!
 */
export function getAdLeaderboard(options?: {
  dateRange?: string;
  attributionFilter?: "all" | "verified" | "inferred";
  sortBy?: "spend" | "leads" | "cpql" | "buyer_score";
}): AdLeaderboardItem[] {
  const dateRange = options?.dateRange || "all";
  const attributionFilter = options?.attributionFilter || "all";
  const sortBy = options?.sortBy || "buyer_score";

  const processed = processAllScenarios().filter((p) =>
    isDateWithinRange(p.leadItem.lastMessageAt, dateRange)
  );

  // Transform processed leads into array for ranking evaluation
  const rankingLeads = processed.map((p) => ({
    leadId: p.leadItem.id,
    adId: p.detailView.attributionEvidence?.providerAdId as string || (p.scenario.attribution.adId ?? null),
    attributionStatus: p.leadItem.attributionStatus,
    buyerScore: p.leadItem.buyerAssessment.normalizedScore,
    isQualified:
      (p.leadItem.buyerAssessment.normalizedScore ?? 0) >= 70 &&
      p.leadItem.attributionStatus !== "unknown",
  }));

  const items: AdLeaderboardItem[] = [];

  for (const [adId, meta] of Object.entries(AD_METADATA_MAP)) {
    // 1. Filter leads strictly for this ad using domain evaluator
    // filterLeadsForAdRanking automatically excludes leads with attributionStatus === 'unknown'
    let matchingLeads = filterLeadsForAdRanking(rankingLeads, adId);

    if (attributionFilter !== "all") {
      matchingLeads = matchingLeads.filter(
        (l) => l.attributionStatus === attributionFilter
      );
    }

    const verifiedCount = matchingLeads.filter(
      (l) => l.attributionStatus === "verified"
    ).length;
    const inferredCount = matchingLeads.filter(
      (l) => l.attributionStatus === "inferred"
    ).length;
    const attributedLeadsCount = matchingLeads.length;

    const qualifiedLeadsCount = matchingLeads.filter((l) => l.isQualified).length;

    // Calculate CPQL using domain function
    const cpql = calculateCPQL(meta.spend, qualifiedLeadsCount);

    // Calculate Average Buyer Score with sample size n
    const scoredLeads = matchingLeads
      .map((l) => l.buyerScore)
      .filter((s): s is number => typeof s === "number" && s !== null);

    const buyerScoreSampleSize = scoredLeads.length;
    const avgBuyerScore =
      buyerScoreSampleSize > 0
        ? Number(
            (
              scoredLeads.reduce((sum, s) => sum + s, 0) / buyerScoreSampleSize
            ).toFixed(1)
          )
        : null;

    items.push({
      adId,
      adName: meta.adName,
      campaignName: meta.campaignName,
      status: meta.status,
      spend: meta.spend,
      impressions: meta.impressions,
      clicks: meta.clicks,
      ctr: calculateCTR(meta.clicks, meta.impressions),
      cpc: calculateCPC(meta.spend, meta.clicks),
      cpm: calculateCPM(meta.spend, meta.impressions),
      attributedLeadsCount,
      qualifiedLeadsCount,
      cpql,
      avgBuyerScore,
      buyerScoreSampleSize,
      sampleWarning: buyerScoreSampleSize < 5,
      attributionBreakdown: {
        verified: verifiedCount,
        inferred: inferredCount,
      },
    });
  }

  // Sort results
  items.sort((a, b) => {
    if (sortBy === "spend") return b.spend - a.spend;
    if (sortBy === "leads") return b.attributedLeadsCount - a.attributedLeadsCount;
    if (sortBy === "cpql") {
      if (a.cpql === null) return 1;
      if (b.cpql === null) return -1;
      return a.cpql - b.cpql; // Lower CPQL is better
    }
    // Default: buyer_score
    if (a.avgBuyerScore === null) return 1;
    if (b.avgBuyerScore === null) return -1;
    return b.avgBuyerScore - a.avgBuyerScore;
  });

  return items;
}

// In-memory store for user-uploaded CRM leads in demo mode
const uploadedDemoLeadsStore: LeadListItem[] = [];

/**
 * Merges or appends uploaded CRM leads into the demo leads store.
 */
export function addUploadedDemoLeads(newLeads: LeadListItem[]) {
  newLeads.forEach((nl) => {
    const existingIdx = uploadedDemoLeadsStore.findIndex(
      (item) => item.phoneMasked === nl.phoneMasked || item.id === nl.id
    );
    if (existingIdx >= 0) {
      uploadedDemoLeadsStore[existingIdx] = { ...uploadedDemoLeadsStore[existingIdx], ...nl };
    } else {
      uploadedDemoLeadsStore.unshift(nl);
    }
  });
}

/**
 * Retrieves list of leads with filtering and search.
 */
export function getLeadsList(options?: {
  dateRange?: string;
  funnelStage?: string;
  attributionStatus?: string;
  qualityLabel?: string;
  search?: string;
}): LeadListItem[] {
  const dateRange = options?.dateRange || "all";
  const funnelStage = options?.funnelStage;
  const attributionStatus = options?.attributionStatus;
  const qualityLabel = options?.qualityLabel;
  const search = options?.search?.toLowerCase().trim();

  // Combine uploaded leads with static scenarios
  const combined = [
    ...uploadedDemoLeadsStore,
    ...processAllScenarios().map((p) => p.leadItem),
  ];

  let list = combined.filter((l) => isDateWithinRange(l.lastMessageAt, dateRange));

  if (funnelStage && funnelStage !== "all") {
    list = list.filter((l) => l.funnelStage === funnelStage);
  }

  if (attributionStatus && attributionStatus !== "all") {
    list = list.filter((l) => l.attributionStatus === attributionStatus);
  }

  if (qualityLabel && qualityLabel !== "all") {
    list = list.filter((l) => l.qualityLabel === qualityLabel);
  }

  if (search) {
    list = list.filter(
      (l) =>
        l.name.toLowerCase().includes(search) ||
        l.id.toLowerCase().includes(search) ||
        (l.domisili && l.domisili.toLowerCase().includes(search)) ||
        (l.notes && l.notes.toLowerCase().includes(search)) ||
        (l.adName && l.adName.toLowerCase().includes(search))
    );
  }

  return list;
}

/**
 * Retrieves single lead detail by ID.
 */
export function getLeadDetail(id: string): LeadDetailView | null {
  const found = processAllScenarios().find((p) => p.leadItem.id === id);
  return found ? found.detailView : null;
}

/**
 * Retrieves items currently requiring review in the Review Queue.
 */
export function getReviewQueue(): ReviewQueueItem[] {
  const all = processAllScenarios();

  return all
    .filter((p) => p.leadItem.needsReview)
    .map((p) => {
      let flagType: ReviewQueueItem["flagType"] = "low_completeness";
      if (
        p.leadItem.buyerAssessment.status === "invalid" ||
        p.leadItem.salesAssessment.status === "invalid"
      ) {
        flagType = "invalid_criteria";
      } else if (p.leadItem.attributionStatus === "inferred") {
        flagType = "uncertain_attribution";
      } else if (
        p.leadItem.salesAssessment.criteria.response_speed?.status === "scored" &&
        p.leadItem.salesAssessment.criteria.response_speed.score === 0
      ) {
        flagType = "sales_sla_overdue";
      } else if (p.leadItem.buyerAssessment.missingCriteria.length > 0) {
        flagType = "missing_criteria";
      }

      return {
        leadId: p.leadItem.id,
        leadName: p.leadItem.name,
        flagReason: p.leadItem.reviewReason || "Memerlukan validasi reviewer",
        flagType,
        buyerScore: p.leadItem.buyerAssessment.normalizedScore,
        buyerCompleteness: p.leadItem.buyerAssessment.completeness,
        salesScore: p.leadItem.salesAssessment.normalizedScore,
        attributionStatus: p.leadItem.attributionStatus,
        lastMessageAt: p.leadItem.lastMessageAt,
      };
    });
}

/**
 * Records an attribution or assessment correction with a mandatory reason.
 */
export function submitReviewCorrection(params: {
  leadId: string;
  previousStatus: AttributionStatus;
  newStatus: AttributionStatus;
  reason: string;
  actorName?: string;
}): { success: boolean; error?: string } {
  if (!params.reason || params.reason.trim().length === 0) {
    return { success: false, error: "Alasan koreksi wajib diisi (tidak boleh kosong)" };
  }

  if (!customCorrections[params.leadId]) {
    customCorrections[params.leadId] = [];
  }

  customCorrections[params.leadId].push({
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    reason: params.reason.trim(),
    timestamp: new Date().toISOString(),
    actorName: params.actorName || "Supervisor Reviewer (Demo)",
  });

  return { success: true };
}

/**
 * Retrieves integration status for Settings page.
 */
export function getIntegrationStatus(): IntegrationStatusItem[] {
  return [
    {
      provider: "meta_marketing",
      name: "Meta Marketing API (Insights)",
      status: "demo_active",
      mode: "demo",
      lastSyncedAt: "2026-10-26T14:30:00Z",
      details: "Adapter Demo aktif: 4 kampanye, 3 ad sets terhubung secara deterministik.",
      maskedCredential: "EAAX...••••••••••••",
    },
    {
      provider: "whatsapp_cloud",
      name: "WhatsApp Business Cloud API",
      status: "demo_active",
      mode: "demo",
      lastSyncedAt: "2026-10-26T15:15:00Z",
      details: "Adapter Demo aktif: 16 simulasi percakapan customer WhatsApp.",
      maskedCredential: "wamid.••••••••••••",
    },
    {
      provider: "meta_model_api",
      name: "Meta Model API (Inference)",
      status: "demo_active",
      mode: "demo",
      lastSyncedAt: "2026-10-26T15:20:00Z",
      details: "Siap untuk Fase 5: Model muse-spark-open / Muse Glimmer terdaftar.",
      maskedCredential: "meta_sk_••••••••••••",
    },
    {
      provider: "supabase",
      name: "Supabase PostgreSQL Database",
      status: "connected",
      mode: "demo",
      lastSyncedAt: "2026-10-26T15:35:00Z",
      details: "Multi-tenant RLS aktif: Tenant A (Demo Developer Nusantara).",
      maskedCredential: "https://udprwj••••••••.supabase.co",
    },
  ];
}

/**
 * Retrieves deterministic ad optimization recommendations for current ad performance.
 */
export function getAdOptimizationRecommendations(options?: {
  dateRange?: string;
  categoryFilter?: "all" | RecommendationCategory;
  organizationId?: string;
  persistentReviews?: Record<
    string,
    {
      status: "reviewed" | "dismissed";
      reviewedBy?: string | null;
      reviewedAt?: string;
      reviewNote?: string | null;
    }
  >;
}): AdOptimizationRecommendation[] {
  const dateRange = options?.dateRange || "all";
  const categoryFilter = options?.categoryFilter || "all";
  const organizationId = options?.organizationId?.trim() || "org_dev_nusantara";

  // Use leaderboard which already computes spend, impressions, clicks, leads, and scores
  const leaderboard = getAdLeaderboard({ dateRange });

  const inputs: AdEvaluationInput[] = leaderboard.map((ad) => ({
    adId: ad.adId,
    adName: ad.adName,
    campaignName: ad.campaignName,
    dateRange,
    spend: ad.spend,
    impressions: ad.impressions,
    clicks: ad.clicks,
    attributedLeadsCount: ad.attributedLeadsCount,
    qualifiedLeadsCount: ad.qualifiedLeadsCount,
    avgBuyerScore: ad.avgBuyerScore,
    buyerScoreSampleSize: ad.buyerScoreSampleSize,
    verifiedCount: ad.attributionBreakdown.verified,
    inferredCount: ad.attributionBreakdown.inferred,
    dataSource: "mock",
  }));

  const recommendations = evaluateAllAds(inputs);

  // Apply persistent database reviews and tenant-isolated actions
  const merged = recommendations.map((rec) => {
    // 1. Persistent review from PostgreSQL if provided
    const persistent = options?.persistentReviews?.[rec.id];
    let status = rec.status;
    let reviewedBy = rec.reviewedBy;
    let reviewedAt = rec.reviewedAt;
    let reviewNote = rec.reviewNote;

    if (persistent) {
      status = persistent.status;
      reviewedBy = persistent.reviewedBy || undefined;
      reviewedAt = persistent.reviewedAt;
      reviewNote = persistent.reviewNote || undefined;
    }

    // 2. Local memory override takes precedence for active session changes
    const tenantStoreKey = `${organizationId}:${rec.id}`;
    const action = recommendationActionStore[tenantStoreKey];
    if (action) {
      status = action.status;
      reviewedBy = action.actorName || action.actorId;
      reviewedAt = action.reviewedAt;
      reviewNote = action.note;
    }

    return {
      ...rec,
      status,
      reviewedBy,
      reviewedAt,
      reviewNote,
    };
  });

  if (categoryFilter !== "all") {
    return merged.filter((r) => r.category === categoryFilter);
  }

  return merged;
}

/**
 * Updates review status of a recommendation (mark reviewed / dismiss) with audit trail.
 * Enforces organization isolation and rejects unvalidated statuses.
 */
export function updateRecommendationStatus(params: {
  recommendationId: string;
  status: "reviewed" | "dismissed";
  organizationId?: string;
  actorId?: string;
  actorName?: string;
  note?: string;
}): { success: boolean; recommendation?: AdOptimizationRecommendation; error?: string } {
  const {
    recommendationId,
    status,
    organizationId = "org_dev_nusantara",
    actorId = "usr_lead_manager_01",
    actorName = "Lead Performance Specialist",
    note,
  } = params;

  // Strict runtime validation
  if (!recommendationId || typeof recommendationId !== "string" || recommendationId.trim().length === 0) {
    return { success: false, error: "ID rekomendasi wajib diisi dan tidak boleh kosong" };
  }

  if (status !== "reviewed" && status !== "dismissed") {
    return {
      success: false,
      error: "Status tidak valid. Status hanya boleh 'reviewed' atau 'dismissed'",
    };
  }

  const cleanOrgId = organizationId.trim();
  const tenantStoreKey = `${cleanOrgId}:${recommendationId.trim()}`;

  // Record audit entry in tenant-isolated store with server-generated timestamp
  recommendationActionStore[tenantStoreKey] = {
    status,
    organizationId: cleanOrgId,
    actorId: actorId.trim(),
    actorName: actorName.trim(),
    reviewedAt: new Date().toISOString(),
    note: note ? note.trim().slice(0, 500) : undefined,
  };

  const all = getAdOptimizationRecommendations({ organizationId: cleanOrgId });
  const updated = all.find((r) => r.id === recommendationId.trim());

  return { success: true, recommendation: updated };
}
