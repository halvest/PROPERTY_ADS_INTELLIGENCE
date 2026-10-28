/**
 * Property Ads Intelligence - Deterministic Ad Optimization Recommendation Engine
 * Pure domain service. Evaluates performance without LLM hallucinations.
 * Guarantees that identical inputs + thresholds produce strictly identical recommendations.
 */

import {
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateCPQLWithReason,
  calculateQualifiedLeadRate,
  calculateVerifiedAttributionRate,
} from "@/domain/metrics/marketing";
import {
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  type RecommendationThresholds,
} from "./thresholds";
import type {
  AdEvaluationInput,
  AdOptimizationRecommendation,
  AdRecommendationMetrics,
  RecommendationCategory,
} from "./types";

/**
 * Evaluates an individual ad deterministically against conservative optimization rules.
 */
export function evaluateAdOptimization(
  input: AdEvaluationInput,
  thresholds: RecommendationThresholds = DEFAULT_RECOMMENDATION_THRESHOLDS
): AdOptimizationRecommendation {
  const {
    adId,
    adName,
    campaignName,
    dateRange,
    spend,
    impressions,
    clicks,
    attributedLeadsCount,
    qualifiedLeadsCount,
    avgBuyerScore,
    buyerScoreSampleSize,
    verifiedCount,
    inferredCount,
    dataSource = "mock",
  } = input;

  // 1. Validate Identifier & Numeric Integrity, then Compute Deterministic Metrics
  const isAdIdInvalid = !adId || typeof adId !== "string" || adId.trim().length === 0;
  const isNumericInputInvalid =
    !Number.isFinite(spend) || spend < 0 ||
    !Number.isFinite(impressions) || impressions < 0 ||
    !Number.isFinite(clicks) || clicks < 0 ||
    !Number.isFinite(attributedLeadsCount) || attributedLeadsCount < 0 ||
    !Number.isFinite(qualifiedLeadsCount) || qualifiedLeadsCount < 0 ||
    !Number.isFinite(buyerScoreSampleSize) || buyerScoreSampleSize < 0 ||
    !Number.isFinite(verifiedCount) || verifiedCount < 0 ||
    !Number.isFinite(inferredCount) || inferredCount < 0;

  const ctr = calculateCTR(clicks, impressions);
  const cpc = calculateCPC(spend, clicks);
  const cpm = calculateCPM(spend, impressions);
  const { cpql, reason: cpqlReason } = calculateCPQLWithReason(spend, qualifiedLeadsCount);

  // Denominator isolation: qualified lead rate evaluates only assessed leads (buyerScoreSampleSize)
  // to avoid silently mixing unassessed leads into the denominator.
  const qualifiedLeadRate = calculateQualifiedLeadRate(qualifiedLeadsCount, buyerScoreSampleSize);

  // Verified attribution rate denominator explicitly represents computable attributed leads (verified + inferred)
  const computableAttributedLeads = verifiedCount + inferredCount;
  const verifiedAttributionRate = calculateVerifiedAttributionRate(verifiedCount, computableAttributedLeads);

  const supportingMetrics: AdRecommendationMetrics = {
    spend,
    impressions,
    clicks,
    ctr,
    cpc,
    cpm,
    cpql,
    cpqlReason,
    attributedLeadsCount,
    qualifiedLeadsCount,
    qualifiedLeadRate,
    avgBuyerScore,
    buyerScoreSampleSize,
    verifiedCount,
    inferredCount,
    verifiedAttributionRate,
  };

  // 2. Identify Missing Data & Analysis Limitations
  const missingDataAndLimitations: string[] = [];

  if (isAdIdInvalid) {
    missingDataAndLimitations.push("Identitas ID iklan tidak valid atau kosong.");
  }
  if (isNumericInputInvalid) {
    missingDataAndLimitations.push("Terdapat metrik numerik yang tidak valid, bernilai negatif, atau non-finite (NaN/Infinity).");
  }
  if (dataSource === "mock") {
    missingDataAndLimitations.push("Evaluasi menggunakan data mock sintetis (bukan data live Meta Marketing API).");
  }
  if (buyerScoreSampleSize < thresholds.minSampleSize) {
    missingDataAndLimitations.push(
      `Ukuran sampel Buyer Score (n = ${buyerScoreSampleSize}) di bawah ambang minimal (n = ${thresholds.minSampleSize}).`
    );
  }
  if (!Number.isFinite(spend) || spend <= 0) {
    missingDataAndLimitations.push("Data belanja iklan (spend) belum tersedia atau bernilai 0.");
  }
  if (!Number.isFinite(impressions) || impressions <= 0) {
    missingDataAndLimitations.push("Data impresi iklan belum tersedia atau bernilai 0.");
  }
  if (attributedLeadsCount === 0) {
    missingDataAndLimitations.push("Belum ada lead yang teratribusi ke iklan ini.");
  }
  if (inferredCount > 0) {
    missingDataAndLimitations.push(
      `${inferredCount} lead teratribusi secara inferensi kata kunci/headline (bukan referral resmi).`
    );
  }
  if (dateRange === "today" || dateRange === "yesterday") {
    missingDataAndLimitations.push("Rentang waktu evaluasi sangat singkat (< 3 hari); variabilitas harian tinggi.");
  }

  // 3. Deterministic Decision Hierarchy
  let category: RecommendationCategory = "insufficient_data";
  let headline = "Data Belum Memadai untuk Rekomendasi";
  let reason = "";

  // Step A: Check Invalid Identifier, Numbers, or Insufficient Data First
  if (isAdIdInvalid || isNumericInputInvalid) {
    category = "insufficient_data";
    headline = "Data Tidak Valid atau Belum Memadai";
    reason = "Identitas iklan atau data performa numerik tidak valid, bernilai negatif, atau non-finite (NaN/Infinity). Rekomendasi dihentikan demi menjaga integritas keputusan pengalokasian anggaran.";
  } else if (buyerScoreSampleSize < thresholds.minSampleSize || attributedLeadsCount < 3) {
    category = "insufficient_data";
    headline = "Data Belum Memadai untuk Rekomendasi";
    reason = `Ukuran sampel lead teratribusi (n = ${buyerScoreSampleSize}) belum memenuhi ambang batas minimal ${thresholds.minSampleSize} lead. Dibutuhkan lebih banyak interaksi calon pembeli sebelum menyarankan perubahan alokasi anggaran iklan.`;
  }
  // Step B: Problem Detection (Investigate)
  else if (
    ctr !== null &&
    ctr >= thresholds.vanityCTRThreshold &&
    ((avgBuyerScore !== null && avgBuyerScore < thresholds.lowBuyerScoreThreshold) ||
      qualifiedLeadsCount === 0)
  ) {
    // Sinyal Vanity Clicks: Klik tinggi tapi lead berkualitas rendah
    category = "investigate";
    headline = "Sinyal Vanity Clicks: CTR Tinggi tetapi Mutu Lead Rendah";
    reason = `Iklan menghasilkan rasio klik tinggi (${ctr}%), namun rata-rata Buyer Score hanya ${avgBuyerScore !== null ? `${avgBuyerScore}/100` : "belum dinilai"} dan rasio qualified leads hanya ${qualifiedLeadRate !== null ? `${qualifiedLeadRate}%` : "belum dapat dihitung"}. Materi iklan kemungkinan menarik klik non-target atau janji promo tidak selaras dengan kesiapan calon pembeli properti.`;
  } else if (spend >= thresholds.highSpendZeroLeadsThreshold && qualifiedLeadsCount === 0) {
    // Belanja tinggi tanpa qualified leads
    category = "investigate";
    headline = "Biaya Tinggi Tanpa Qualified Lead";
    reason = `Belanja iklan telah mencapai Rp ${Math.round(spend).toLocaleString("id-ID")} tanpa menghasilkan satupun qualified lead teratribusi. Segera periksa penargetan audiens atau alur sambutan staf penjualan di WhatsApp.`;
  } else if (cpql !== null && cpql > thresholds.deterioratingCPQLThreshold) {
    // CPQL membengkak melampaui batas toleransi
    category = "investigate";
    headline = "Biaya Per Qualified Lead (CPQL) Membengkak";
    reason = `Biaya per qualified lead (CPQL) mencapai Rp ${Math.round(cpql).toLocaleString("id-ID")}, melebihi batas efisiensi wajar (Rp ${thresholds.deterioratingCPQLThreshold.toLocaleString("id-ID")}). Biaya akuisisi calon pembeli tidak sebanding dengan mutu leads.`;
  }
  // Step C: High Performance (Scale Candidate - Evaluasi Manual)
  else if (
    spend >= thresholds.minSpendForScale &&
    avgBuyerScore !== null &&
    avgBuyerScore >= thresholds.minAvgBuyerScoreForScale &&
    qualifiedLeadRate !== null &&
    qualifiedLeadRate >= thresholds.minQualifiedLeadRateForScale &&
    verifiedAttributionRate !== null &&
    verifiedAttributionRate >= thresholds.minVerifiedAttributionRateForScale &&
    cpql !== null &&
    cpql <= thresholds.maxCPQLForScale
  ) {
    category = "scale_candidate";
    headline = "Kandidat Evaluasi Manual Peningkatan Anggaran (Scale Candidate)";
    reason = `Iklan menunjukkan sinyal performa awal yang kuat dengan rata-rata Buyer Score ${avgBuyerScore}/100, rasio qualified lead ${qualifiedLeadRate}%, dan CPQL terhitung sebesar Rp ${Math.round(cpql).toLocaleString("id-ID")}. Bukti atribusi verified mencapai ${verifiedAttributionRate}%. Data ini layak dipertimbangkan untuk evaluasi manual oleh tim pengelola iklan sebelum uji peningkatan anggaran bertahap (bukan jaminan keuntungan pasti).`;
  }
  // Step D: Balanced / Moderate Performance (Hold)
  else {
    category = "hold";
    headline = "Pertahankan dan Pantau Performa (Hold)";
    reason = `Performa iklan berada dalam batas kinerja wajar (Buyer Score: ${avgBuyerScore ?? "—"}/100, Qualified Leads: ${qualifiedLeadsCount}). Belum memenuhi kriteria ketat untuk peningkatan anggaran, pertahankan alokasi anggaran dan pantau konversi funnel berikutnya.`;
  }

  return {
    id: `rec_${adId}_${dateRange}`,
    adId,
    adName,
    campaignName,
    dateRange,
    category,
    headline,
    reason,
    supportingMetrics,
    missingDataAndLimitations,
    dataSource,
    evaluatedAt: "2026-10-26T14:30:00Z", // Deterministic baseline timestamp for consistent audits
    status: "active",
  };
}

/**
 * Batch evaluates all active ads.
 */
export function evaluateAllAds(
  inputs: AdEvaluationInput[],
  thresholds?: RecommendationThresholds
): AdOptimizationRecommendation[] {
  return inputs.map((input) => evaluateAdOptimization(input, thresholds));
}
