/**
 * Property Ads Intelligence - Optimization Recommendation Thresholds
 *
 * Explicit, documented, and conservative baseline benchmarks.
 * Separated from core recommendation logic to allow auditable tuning.
 */

export interface RecommendationThresholds {
  /**
   * Minimum number of leads with assessed Buyer Score required to move beyond insufficient_data.
   * Default: 5 leads.
   */
  minSampleSize: number;

  /**
   * Minimum ad spend (in IDR) required before making positive scaling recommendations.
   * Default: 1,000,000 IDR.
   */
  minSpendForScale: number;

  /**
   * Minimum average Buyer Score required for scale consideration.
   * Default: 70.0 (High Intent readiness).
   */
  minAvgBuyerScoreForScale: number;

  /**
   * Minimum percentage of assessed leads that must be qualified (Buyer Score >= 70).
   * Note: Denominator is buyerScoreSampleSize (assessed leads), not raw unassessed leads.
   * Default: 25.0%.
   */
  minQualifiedLeadRateForScale: number;

  /**
   * Minimum verified attribution rate (% of leads with official Meta Click-to-WhatsApp referral).
   * Formula: (verifiedCount / (verifiedCount + inferredCount)) * 100
   * Default: 60.0%.
   */
  minVerifiedAttributionRateForScale: number;

  /**
   * Maximum acceptable Cost Per Qualified Lead (CPQL) for scaling consideration.
   * Default: 2,500,000 IDR.
   */
  maxCPQLForScale: number;

  /**
   * Vanity Clicks Investigation Threshold:
   * When CTR is high (>= 2.0%) or clicks >= 500, but average Buyer Score is low (< 55.0)
   * or qualified lead count is 0.
   */
  vanityCTRThreshold: number;
  lowBuyerScoreThreshold: number;

  /**
   * High Spend Zero Leads Investigation Threshold:
   * When ad spend exceeds this amount but 0 qualified leads are produced.
   * Default: 2,000,000 IDR.
   */
  highSpendZeroLeadsThreshold: number;

  /**
   * Deteriorating / Excessively High CPQL Threshold:
   * When CPQL exceeds this benchmark, flag for cost efficiency investigation.
   * Default: 3,500,000 IDR.
   */
  deterioratingCPQLThreshold: number;
}

/**
 * PANDUAN PENTING & DISCLAIMER AMBANG BATAS:
 * Nilai-nilai di bawah ini merupakan konfigurasi dasar awal (baseline initial configuration)
 * untuk tujuan standardisasi alur evaluasi deterministik dan pengujian sistem.
 * 
 * Nilai ini BUKAN benchmark industri properti universal yang telah terbukti secara empiris.
 * Dalam implementasi operasional nyata, setiap tim pemasaran dan pengembang properti
 * WAJIB mengkalibrasi ulang nilai-nilai ini berdasarkan:
 * 1. Skala harga unit properti (misal: rumah subsidi vs menengah vs luxury).
 * 2. Margin laba kotor per unit yang terjual.
 * 3. Siklus penjualan (sales conversion cycle) dan tingkat konversi WhatsApp ke booking.
 * 4. Ketersediaan kuota belanja iklan bulanan.
 */
export const DEFAULT_RECOMMENDATION_THRESHOLDS: RecommendationThresholds = {
  minSampleSize: 5,
  minSpendForScale: 1_000_000,
  minAvgBuyerScoreForScale: 70.0,
  minQualifiedLeadRateForScale: 25.0,
  minVerifiedAttributionRateForScale: 60.0,
  maxCPQLForScale: 2_500_000,
  vanityCTRThreshold: 2.0,
  lowBuyerScoreThreshold: 55.0,
  highSpendZeroLeadsThreshold: 2_000_000,
  deterioratingCPQLThreshold: 3_500_000,
};
