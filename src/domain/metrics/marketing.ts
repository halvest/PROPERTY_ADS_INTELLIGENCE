/**
 * Property Ads Intelligence - Deterministic Marketing Metrics
 * Pure domain functions for calculating CTR, CPC, CPM, CPQL, and aggregated ratios.
 * Guarantees that zero denominators return null (never NaN or Infinity).
 */

export interface AdPerformanceRow {
  adId: string;
  adName?: string;
  spend: number;
  impressions: number;
  clicks: number;
  attributedLeadsCount: number;
  qualifiedLeadsCount: number; // Only qualified leads linked via verified/inferred attribution
  currency?: string;
}

export interface AggregatedAdMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalAttributedLeads: number;
  totalQualifiedLeads: number;
  ctr: number | null; // Percentage (e.g., 2.50%)
  cpc: number | null; // Cost per click in currency
  cpm: number | null; // Cost per 1000 impressions in currency
  cpql: number | null; // Cost per qualified lead in currency
  currency: string;
}

/**
 * Click-Through Rate: (clicks / impressions) * 100
 */
export function calculateCTR(clicks: number, impressions: number): number | null {
  if (
    typeof clicks !== "number" ||
    typeof impressions !== "number" ||
    !Number.isFinite(clicks) ||
    !Number.isFinite(impressions) ||
    clicks < 0 ||
    impressions <= 0
  ) {
    return null;
  }
  return Number(((clicks / impressions) * 100).toFixed(2));
}

/**
 * Cost Per Click: spend / clicks
 */
export function calculateCPC(spend: number, clicks: number): number | null {
  if (
    typeof spend !== "number" ||
    typeof clicks !== "number" ||
    !Number.isFinite(spend) ||
    !Number.isFinite(clicks) ||
    spend < 0 ||
    clicks <= 0
  ) {
    return null;
  }
  return Number((spend / clicks).toFixed(2));
}

/**
 * Cost Per Mille (1,000 Impressions): (spend / impressions) * 1000
 */
export function calculateCPM(spend: number, impressions: number): number | null {
  if (
    typeof spend !== "number" ||
    typeof impressions !== "number" ||
    !Number.isFinite(spend) ||
    !Number.isFinite(impressions) ||
    spend < 0 ||
    impressions <= 0
  ) {
    return null;
  }
  return Number(((spend / impressions) * 1000).toFixed(2));
}

/**
 * Cost Per Qualified Lead: eligibleSpend / qualifiedLeadCount
 * Only calculated when qualifiedLeadCount > 0.
 */
export function calculateCPQL(eligibleSpend: number, qualifiedLeadCount: number): number | null {
  if (
    typeof eligibleSpend !== "number" ||
    typeof qualifiedLeadCount !== "number" ||
    !Number.isFinite(eligibleSpend) ||
    !Number.isFinite(qualifiedLeadCount) ||
    eligibleSpend < 0 ||
    qualifiedLeadCount <= 0
  ) {
    return null;
  }
  return Number((eligibleSpend / qualifiedLeadCount).toFixed(2));
}

/**
 * Cost Per Qualified Lead with human-understandable reason when null.
 */
export function calculateCPQLWithReason(
  eligibleSpend: number,
  qualifiedLeadCount: number
): { cpql: number | null; reason: string | null } {
  if (
    typeof qualifiedLeadCount !== "number" ||
    !Number.isFinite(qualifiedLeadCount) ||
    qualifiedLeadCount < 0
  ) {
    return { cpql: null, reason: "Jumlah qualified leads tidak valid atau tidak diketahui" };
  }
  if (qualifiedLeadCount === 0) {
    return { cpql: null, reason: "Tidak ada qualified leads yang teratribusi (n = 0)" };
  }
  if (
    typeof eligibleSpend !== "number" ||
    !Number.isFinite(eligibleSpend) ||
    eligibleSpend < 0
  ) {
    return { cpql: null, reason: "Nilai belanja iklan (spend) tidak valid atau negatif" };
  }
  return {
    cpql: Number((eligibleSpend / qualifiedLeadCount).toFixed(2)),
    reason: null,
  };
}

/**
 * Qualified Lead Rate: (qualifiedLeads / totalRelevantLeads) * 100
 */
export function calculateQualifiedLeadRate(
  qualifiedLeads: number,
  totalRelevantLeads: number
): number | null {
  if (
    typeof qualifiedLeads !== "number" ||
    typeof totalRelevantLeads !== "number" ||
    !Number.isFinite(qualifiedLeads) ||
    !Number.isFinite(totalRelevantLeads) ||
    qualifiedLeads < 0 ||
    totalRelevantLeads <= 0
  ) {
    return null;
  }
  return Number(((qualifiedLeads / totalRelevantLeads) * 100).toFixed(2));
}

/**
 * Verified Attribution Rate: (verifiedLeads / computableAttributedLeads) * 100
 */
export function calculateVerifiedAttributionRate(
  verifiedLeads: number,
  computableAttributedLeads: number
): number | null {
  if (
    typeof verifiedLeads !== "number" ||
    typeof computableAttributedLeads !== "number" ||
    !Number.isFinite(verifiedLeads) ||
    !Number.isFinite(computableAttributedLeads) ||
    verifiedLeads < 0 ||
    computableAttributedLeads <= 0
  ) {
    return null;
  }
  return Number(((verifiedLeads / computableAttributedLeads) * 100).toFixed(2));
}

/**
 * Aggregates performance across multiple ads or dates.
 * CRITICAL RULE: Aggregate ratios (CTR, CPC, CPM, CPQL) are recalculated from total sums,
 * never by averaging individual row-level percentages.
 */
export function aggregateAdPerformance(
  rows: AdPerformanceRow[],
  currency = "IDR"
): AggregatedAdMetrics {
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalAttributedLeads = 0;
  let totalQualifiedLeads = 0;

  for (const row of rows) {
    if (Number.isFinite(row.spend) && row.spend > 0) {
      totalSpend += row.spend;
    }
    if (Number.isFinite(row.impressions) && row.impressions > 0) {
      totalImpressions += Math.round(row.impressions);
    }
    if (Number.isFinite(row.clicks) && row.clicks > 0) {
      totalClicks += Math.round(row.clicks);
    }
    if (Number.isFinite(row.attributedLeadsCount) && row.attributedLeadsCount > 0) {
      totalAttributedLeads += Math.round(row.attributedLeadsCount);
    }
    if (Number.isFinite(row.qualifiedLeadsCount) && row.qualifiedLeadsCount > 0) {
      totalQualifiedLeads += Math.round(row.qualifiedLeadsCount);
    }
  }

  return {
    totalSpend: Number(totalSpend.toFixed(2)),
    totalImpressions,
    totalClicks,
    totalAttributedLeads,
    totalQualifiedLeads,
    ctr: calculateCTR(totalClicks, totalImpressions),
    cpc: calculateCPC(totalSpend, totalClicks),
    cpm: calculateCPM(totalSpend, totalImpressions),
    cpql: calculateCPQL(totalSpend, totalQualifiedLeads),
    currency,
  };
}
