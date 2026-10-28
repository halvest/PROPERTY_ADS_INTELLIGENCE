/**
 * Property Ads Intelligence - Deterministic Synthetic Demo Dataset
 * Contains 16 explicit scenarios covering the complete domain test matrix.
 * 
 * NOTICE: All data in this file is strictly SYNTHETIC and FICTIONAL.
 * No real customer PII or confidential property transactions exist here.
 */

import type { RawCriterionInput } from "../domain/scoring/types";
import type { MessageTimestampRecord } from "../domain/scoring/response-speed";
import type { AttributionStatus } from "../domain/attribution/types";
import type { FunnelStage } from "../domain/funnel/stages";

export interface SyntheticLeadScenario {
  id: string;
  name: string;
  description: string;
  buyerCriteria: RawCriterionInput[];
  salesCriteria: RawCriterionInput[];
  messages: MessageTimestampRecord[];
  attribution: {
    status: AttributionStatus;
    adId: string | null;
    campaignId: string | null;
    rawReferral?: {
      source?: string;
      adId?: string;
      campaignId?: string;
      headline?: string;
      verifiedSignature?: boolean;
    };
    inferredCandidate?: {
      method: "headline_match" | "promo_code_match" | "landing_page_session";
      matchedText: string;
      confidence: number;
      adId: string;
      campaignId?: string;
    };
  };
  funnelStage: FunnelStage;
  correctionHistory?: Array<{
    previousStatus: AttributionStatus;
    newStatus: AttributionStatus;
    reason: string;
    timestamp: string;
  }>;
}

export const SYNTHETIC_LEAD_SCENARIOS: Record<string, SyntheticLeadScenario> = {
  // Scenario 1: High Buyer Score, High Sales Score, Verified Attribution
  scenario_01_high_buyer_high_sales_verified: {
    id: "lead_syn_01",
    name: "Lead 1: High Buyer, High Sales (Verified)",
    description: "Prospek matang dengan budget cocok (2M), respon sales kilat (3 menit), survei terjadwal.",
    buyerCriteria: [
      { criterion: "purchase_intent", points: 25, status: "scored", evidence: [{ criterion: "purchase_intent", explanation: "Langsung menanyakan kesiapan unit hook dan sertifikat", evidenceStatus: "supported" }] },
      { criterion: "budget_fit", points: 20, status: "scored", evidence: [{ criterion: "budget_fit", explanation: "Budget 2 Miliar tunai keras", evidenceStatus: "supported" }] },
      { criterion: "property_needs_fit", points: 20, status: "scored", evidence: [{ criterion: "property_needs_fit", explanation: "Butuh 3 KT di BSD sesuai tipe 72", evidenceStatus: "supported" }] },
      { criterion: "purchase_timeline", points: 15, status: "scored", evidence: [{ criterion: "purchase_timeline", explanation: "Target pindah bulan depan", evidenceStatus: "supported" }] },
      { criterion: "readiness_for_action", points: 20, status: "scored", evidence: [{ criterion: "readiness_for_action", explanation: "Konfirmasi survei besok jam 10", evidenceStatus: "supported" }] },
    ],
    salesCriteria: [
      { criterion: "relevance_of_answers", points: 25, status: "scored" },
      { criterion: "needs_discovery", points: 20, status: "scored" },
      { criterion: "follow_up_consistency", points: 20, status: "scored" },
      { criterion: "next_step_progression", points: 20, status: "scored" },
    ],
    messages: [
      { id: "m_01_1", direction: "inbound", senderType: "buyer", body: "Halo, saya tertarik unit Cluster Sapphire tipe 72 hook BSD", sentAt: "2026-10-20T09:00:00Z" },
      { id: "m_01_2", direction: "outbound", senderType: "sales", body: "Halo! Terima kasih telah menghubungi kami. Unit hook 72 masih tersedia 1 unit. Rencana untuk dihuni sendiri Pak?", sentAt: "2026-10-20T09:03:00Z" },
    ],
    attribution: {
      status: "verified",
      adId: "ad_sapphire_72",
      campaignId: "cmp_bsd_october",
      rawReferral: { source: "ad_click", adId: "ad_sapphire_72", campaignId: "cmp_bsd_october", verifiedSignature: true },
    },
    funnelStage: "survei",
  },

  // Scenario 2: High Buyer Score, Low Sales Score
  scenario_02_high_buyer_low_sales: {
    id: "lead_syn_02",
    name: "Lead 2: High Buyer, Low Sales",
    description: "Pembeli serius budget 3M, namun sales lambat merespons (4 jam) dan jawaban ketus.",
    buyerCriteria: [
      { criterion: "purchase_intent", points: 24, status: "scored" },
      { criterion: "budget_fit", points: 19, status: "scored" },
      { criterion: "property_needs_fit", points: 18, status: "scored" },
      { criterion: "purchase_timeline", points: 14, status: "scored" },
      { criterion: "readiness_for_action", points: 18, status: "scored" },
    ],
    salesCriteria: [
      { criterion: "relevance_of_answers", points: 7, status: "scored", evidence: [{ criterion: "relevance_of_answers", explanation: "Hanya membalas 'brosur ada di web'", evidenceStatus: "contradictory" }] },
      { criterion: "needs_discovery", points: 3, status: "scored" },
      { criterion: "follow_up_consistency", points: 4, status: "scored" },
      { criterion: "next_step_progression", points: 5, status: "scored" },
    ],
    messages: [
      { id: "m_02_1", direction: "inbound", senderType: "buyer", body: "Selamat pagi, saya ingin info ketersediaan unit Sapphire 3 KT cash keras", sentAt: "2026-10-20T08:00:00Z" },
      { id: "m_02_2", direction: "outbound", senderType: "sales", body: "Cek brosur aja di web kita.", sentAt: "2026-10-20T12:30:00Z" }, // 4.5 jam kemudian
    ],
    attribution: {
      status: "verified",
      adId: "ad_sapphire_promo",
      campaignId: "cmp_bsd_october",
      rawReferral: { source: "ad_click", adId: "ad_sapphire_promo", verifiedSignature: true },
    },
    funnelStage: "prospek",
  },

  // Scenario 3: Low Buyer Score, High Sales Score
  scenario_03_low_buyer_high_sales: {
    id: "lead_syn_03",
    name: "Lead 3: Low Buyer, High Sales",
    description: "Calon pembeli hanya iseng/coba-coba, tetapi sales merespons sangat cepat, ramah, dan profesional.",
    buyerCriteria: [
      { criterion: "purchase_intent", points: 5, status: "scored", evidence: [{ criterion: "purchase_intent", explanation: "Cuma iseng klik iklan", evidenceStatus: "supported" }] },
      { criterion: "budget_fit", points: 4, status: "scored" },
      { criterion: "property_needs_fit", points: 5, status: "scored" },
      { criterion: "purchase_timeline", points: 2, status: "scored" },
      { criterion: "readiness_for_action", points: 3, status: "scored" },
    ],
    salesCriteria: [
      { criterion: "relevance_of_answers", points: 24, status: "scored" },
      { criterion: "needs_discovery", points: 19, status: "scored" },
      { criterion: "follow_up_consistency", points: 18, status: "scored" },
      { criterion: "next_step_progression", points: 17, status: "scored" },
    ],
    messages: [
      { id: "m_03_1", direction: "inbound", senderType: "buyer", body: "Cuma mau lihat gambarnya doang", sentAt: "2026-10-21T10:00:00Z" },
      { id: "m_03_2", direction: "outbound", senderType: "sales", body: "Halo! Tentu, berikut e-katalog lengkap Cluster Sapphire. Jika kelak berminat konsultasi denah atau promo DP, silakan kabari saya ya.", sentAt: "2026-10-21T10:02:00Z" },
    ],
    attribution: {
      status: "verified",
      adId: "ad_sapphire_72",
      campaignId: "cmp_bsd_october",
      rawReferral: { source: "ad_click", adId: "ad_sapphire_72", verifiedSignature: true },
    },
    funnelStage: "dihubungi",
  },

  // Scenario 4: Both Scores Low, With Sufficient Evidence
  scenario_04_both_low: {
    id: "lead_syn_04",
    name: "Lead 4: Both Low",
    description: "Pembeli tidak ada niat beli properti (mencari kos-kosan), sales merespons asal-asalan.",
    buyerCriteria: [
      { criterion: "purchase_intent", points: 0, status: "scored", evidence: [{ criterion: "purchase_intent", explanation: "Mau cari kosan sewa bulanan, bukan beli rumah", evidenceStatus: "supported" }] },
      { criterion: "budget_fit", points: 0, status: "scored" },
      { criterion: "property_needs_fit", points: 0, status: "scored" },
      { criterion: "purchase_timeline", points: 0, status: "scored" },
      { criterion: "readiness_for_action", points: 0, status: "scored" },
    ],
    salesCriteria: [
      { criterion: "relevance_of_answers", points: 4, status: "scored" },
      { criterion: "needs_discovery", points: 0, status: "scored" },
      { criterion: "follow_up_consistency", points: 0, status: "scored" },
      { criterion: "next_step_progression", points: 0, status: "scored" },
    ],
    messages: [
      { id: "m_04_1", direction: "inbound", senderType: "buyer", body: "Bisa sewa kosan 500rb per bulan gak di sini?", sentAt: "2026-10-21T11:00:00Z" },
      { id: "m_04_2", direction: "outbound", senderType: "sales", body: "Gak ada.", sentAt: "2026-10-21T15:30:00Z" },
    ],
    attribution: {
      status: "unknown",
      adId: null,
      campaignId: null,
    },
    funnelStage: "batal",
  },

  // Scenario 5: Buyer Score with Missing Budget and Timeline
  scenario_05_missing_budget_timeline: {
    id: "lead_syn_05",
    name: "Lead 5: Missing Budget & Timeline",
    description: "Prospek tertarik tipe 60, namun belum pernah menyebut budget maupun target waktu beli.",
    buyerCriteria: [
      { criterion: "purchase_intent", points: 15, status: "scored" },
      { criterion: "budget_fit", points: null, status: "missing", missingInformation: ["Budget belum diketahui"] },
      { criterion: "property_needs_fit", points: 16, status: "scored" },
      { criterion: "purchase_timeline", points: null, status: "missing", missingInformation: ["Timeline pembelian belum ditanyakan"] },
      { criterion: "readiness_for_action", points: 12, status: "scored" },
    ],
    salesCriteria: [
      { criterion: "relevance_of_answers", points: 20, status: "scored" },
      { criterion: "needs_discovery", points: 10, status: "scored" },
      { criterion: "follow_up_consistency", points: 14, status: "scored" },
      { criterion: "next_step_progression", points: 12, status: "scored" },
    ],
    messages: [
      { id: "m_05_1", direction: "inbound", senderType: "buyer", body: "Cluster Sapphire tipe 60 luas tanah berapa ya?", sentAt: "2026-10-22T09:00:00Z" },
      { id: "m_05_2", direction: "outbound", senderType: "sales", body: "Tipe 60 luas tanahnya 84m2 Pak dengan 3 kamar tidur.", sentAt: "2026-10-22T09:08:00Z" },
    ],
    attribution: {
      status: "inferred",
      adId: "ad_sapphire_type_60",
      campaignId: "cmp_bsd_october",
      inferredCandidate: { method: "headline_match", matchedText: "tipe 60", confidence: 0.85, adId: "ad_sapphire_type_60" },
    },
    funnelStage: "prospek",
  },

  // Scenario 6: Explicit Valid Zero for a Criterion
  scenario_06_explicit_valid_zero: {
    id: "lead_syn_06",
    name: "Lead 6: Explicit Valid Zero",
    description: "Pembeli menyatakan secara eksplisit bahwa dana tidak mencukupi (budget mismatch total).",
    buyerCriteria: [
      { criterion: "purchase_intent", points: 15, status: "scored" },
      { criterion: "budget_fit", points: 0, status: "scored", evidence: [{ criterion: "budget_fit", explanation: "Budget maksimal 300 juta, harga rumah 1.8 Miliar", evidenceStatus: "supported" }] },
      { criterion: "property_needs_fit", points: 12, status: "scored" },
      { criterion: "purchase_timeline", points: 10, status: "scored" },
      { criterion: "readiness_for_action", points: 2, status: "scored" },
    ],
    salesCriteria: [
      { criterion: "relevance_of_answers", points: 18, status: "scored" },
      { criterion: "needs_discovery", points: 15, status: "scored" },
      { criterion: "follow_up_consistency", points: 10, status: "scored" },
      { criterion: "next_step_progression", points: 6, status: "scored" },
    ],
    messages: [
      { id: "m_06_1", direction: "inbound", senderType: "buyer", body: "Harga 1,8M ya? Waduh budget mentok saya cuma 300 juta, ga sanggup kalau segitu", sentAt: "2026-10-22T10:00:00Z" },
    ],
    attribution: { status: "unknown", adId: null, campaignId: null },
    funnelStage: "batal",
  },

  // Scenario 7: Invalid Criterion Score Outside Allowed Range
  scenario_07_invalid_score_outside_range: {
    id: "lead_syn_07",
    name: "Lead 7: Invalid Score Outside Bounds",
    description: "Input cacat: poin 99 diberikan pada purchase_intent (maksimal 25) atau nilai negatif.",
    buyerCriteria: [
      { criterion: "purchase_intent", points: 99, status: "invalid", invalidReason: "Poin 99 melebihi batas maksimum rubrik (25)" },
      { criterion: "budget_fit", points: -5, status: "invalid", invalidReason: "Poin tidak boleh negatif: -5" },
      { criterion: "property_needs_fit", points: 15, status: "scored" },
      { criterion: "purchase_timeline", points: 10, status: "scored" },
      { criterion: "readiness_for_action", points: 12, status: "scored" },
    ],
    salesCriteria: [],
    messages: [],
    attribution: { status: "unknown", adId: null, campaignId: null },
    funnelStage: "baru",
  },

  // Scenario 8: Fast Substantive Sales Response
  scenario_08_fast_sales_response: {
    id: "lead_syn_08",
    name: "Lead 8: Fast Substantive Response (<= 5 min)",
    description: "Sales merespons pesan pertama dalam 2 menit dengan konten substantif.",
    buyerCriteria: [],
    salesCriteria: [],
    messages: [
      { id: "m_08_1", direction: "inbound", senderType: "buyer", body: "Tanya promo DP 0 persen Cluster Sapphire", sentAt: "2026-10-23T08:00:00Z" },
      { id: "m_08_2", direction: "outbound", senderType: "sales", body: "Pagi Bu! Promo DP 0% berlaku untuk akad KPR bulan ini dengan subsidi biaya notaris.", sentAt: "2026-10-23T08:02:00Z" },
    ],
    attribution: { status: "verified", adId: "ad_promo_dp", campaignId: "cmp_bsd", rawReferral: { source: "ad_click", adId: "ad_promo_dp" } },
    funnelStage: "dihubungi",
  },

  // Scenario 9: Pending Response Before SLA Expiry
  scenario_09_pending_response_before_sla: {
    id: "lead_syn_09",
    name: "Lead 9: Pending Response (Before SLA Expiry)",
    description: "Pesan baru masuk 10 menit lalu, belum ada balasan sales namun SLA 60 menit belum habis. Status pending, poin NULL.",
    buyerCriteria: [],
    salesCriteria: [],
    messages: [
      { id: "m_09_1", direction: "inbound", senderType: "buyer", body: "Halo ada unit ready stock?", sentAt: "2026-10-23T10:00:00Z" },
    ],
    attribution: { status: "unknown", adId: null, campaignId: null },
    funnelStage: "baru",
  },

  // Scenario 10: Overdue Response After SLA Expiry
  scenario_10_overdue_response_after_sla: {
    id: "lead_syn_10",
    name: "Lead 10: Overdue Response (After SLA Expiry)",
    description: "Pesan masuk 2 jam lalu (SLA 60 menit), tidak ada balasan sales. Status overdue, poin 0.",
    buyerCriteria: [],
    salesCriteria: [],
    messages: [
      { id: "m_10_1", direction: "inbound", senderType: "buyer", body: "Bisa kirim pricelist Cluster Sapphire?", sentAt: "2026-10-23T08:00:00Z" },
    ],
    attribution: { status: "unknown", adId: null, campaignId: null },
    funnelStage: "baru",
  },

  // Scenario 11: Incomplete or Invalid Timestamps
  scenario_11_invalid_timestamps: {
    id: "lead_syn_11",
    name: "Lead 11: Invalid Timestamps",
    description: "Timestamp pesan cacat / waktu balasan sales mendahului pesan pelanggan (anomali kronologi).",
    buyerCriteria: [],
    salesCriteria: [],
    messages: [
      { id: "m_11_1", direction: "inbound", senderType: "buyer", body: "Halo?", sentAt: "2026-10-23T12:00:00Z" },
      { id: "m_11_2", direction: "outbound", senderType: "sales", body: "Halo selamat siang", sentAt: "2026-10-23T11:00:00Z" }, // Balasan mendahului 1 jam
    ],
    attribution: { status: "unknown", adId: null, campaignId: null },
    funnelStage: "dihubungi",
  },

  // Scenario 12: Verified Attribution with Valid Linked Identifiers
  scenario_12_verified_attribution: {
    id: "lead_syn_12",
    name: "Lead 12: Verified Attribution",
    description: "Atribusi resmi terverifikasi dengan payload ad_click Meta API.",
    buyerCriteria: [],
    salesCriteria: [],
    messages: [],
    attribution: {
      status: "verified",
      adId: "ad_sapphire_type_60",
      campaignId: "cmp_bsd_october",
      rawReferral: { source: "ad_click", adId: "ad_sapphire_type_60", campaignId: "cmp_bsd_october", headline: "Rumah Siap Huni BSD", verifiedSignature: true },
    },
    funnelStage: "prospek",
  },

  // Scenario 13: Inferred Attribution with Documented Evidence
  scenario_13_inferred_attribution: {
    id: "lead_syn_13",
    name: "Lead 13: Inferred Attribution",
    description: "Atribusi inferred berbasis pencocokan promo code spesifik kampanye (confidence 88%).",
    buyerCriteria: [],
    salesCriteria: [],
    messages: [],
    attribution: {
      status: "inferred",
      adId: "ad_promo_oktoberfest",
      campaignId: "cmp_bsd_october",
      inferredCandidate: { method: "promo_code_match", matchedText: "KODE_PROMO_OKT26", confidence: 0.88, adId: "ad_promo_oktoberfest" },
    },
    funnelStage: "prospek",
  },

  // Scenario 14: Unknown Attribution Excluded from Ad Ranking
  scenario_14_unknown_attribution_excluded: {
    id: "lead_syn_14",
    name: "Lead 14: Unknown Attribution (Excluded from Ad Ranking)",
    description: "Prospek organik tanpa bukti rujukan iklan. Harus dikeluarkan dari ranking performa per iklan.",
    buyerCriteria: [],
    salesCriteria: [],
    messages: [],
    attribution: {
      status: "unknown",
      adId: null,
      campaignId: null,
    },
    funnelStage: "baru",
  },

  // Scenario 15: Attribution Correction with Preserved History
  scenario_15_attribution_correction_history: {
    id: "lead_syn_15",
    name: "Lead 15: Attribution Correction History",
    description: "Lead awalnya berstatus 'inferred' lalu dikoreksi oleh supervisor menjadi 'verified' dengan audit trail.",
    buyerCriteria: [],
    salesCriteria: [],
    messages: [],
    attribution: {
      status: "verified",
      adId: "ad_sapphire_72",
      campaignId: "cmp_bsd_october",
    },
    correctionHistory: [
      {
        previousStatus: "inferred",
        newStatus: "verified",
        reason: "Bukti screenshot riwayat klik Meta Ads dikonfirmasi valid oleh supervisor",
        timestamp: "2026-10-24T14:00:00Z",
      },
    ],
    funnelStage: "survei",
  },

  // Scenario 16: Incomplete Transcript Where Sales Cannot Be Fully Assessed
  scenario_16_incomplete_transcript: {
    id: "lead_syn_16",
    name: "Lead 16: Incomplete Transcript",
    description: "Chat terpotong (hanya 1 pertukaran pesan). Kriteria follow-up dan closing berstatus missing, bukan dinilai buruk/0.",
    buyerCriteria: [],
    salesCriteria: [
      { criterion: "relevance_of_answers", points: 18, status: "scored" },
      { criterion: "needs_discovery", points: 8, status: "scored" },
      { criterion: "follow_up_consistency", points: null, status: "missing", missingInformation: ["Percakapan belum mencapai fase follow-up"] },
      { criterion: "next_step_progression", points: null, status: "missing", missingInformation: ["Percakapan terputus sebelum arahan langkah lanjut"] },
    ],
    messages: [
      { id: "m_16_1", direction: "inbound", senderType: "buyer", body: "Sore, pricelist cluster sapphire ada?", sentAt: "2026-10-24T16:00:00Z" },
      { id: "m_16_2", direction: "outbound", senderType: "sales", body: "Sore Pak! Ini pricelist terbaru untuk Cluster Sapphire.", sentAt: "2026-10-24T16:04:00Z" },
    ],
    attribution: { status: "unknown", adId: null, campaignId: null },
    funnelStage: "dihubungi",
  },
};
