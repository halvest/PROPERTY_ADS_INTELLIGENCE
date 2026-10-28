/**
 * Property Ads Intelligence - Scoring Rubrics Specification (v1.0)
 * Single source of truth for Buyer and Sales criteria, weights, and score ranges.
 */

export interface RubricCriterionDef {
  key: string;
  name: string;
  maxPoints: number;
  description: string;
}

export interface DimensionRubric {
  version: string;
  totalWeight: number;
  criteria: Record<string, RubricCriterionDef>;
}

export const BUYER_RUBRIC_V1: DimensionRubric = {
  version: "v1.0",
  totalWeight: 100,
  criteria: {
    purchase_intent: {
      key: "purchase_intent",
      name: "Niat Membeli (Purchase Intent)",
      maxPoints: 25,
      description: "Tingkat keseriusan dan inisiatif calon pembeli untuk bertransaksi properti.",
    },
    budget_fit: {
      key: "budget_fit",
      name: "Kesesuaian Anggaran (Budget Fit)",
      maxPoints: 20,
      description: "Kecocokan daya beli dan skema pembiayaan (KPR/Cash) dengan harga unit properti.",
    },
    property_needs_fit: {
      key: "property_needs_fit",
      name: "Kesesuaian Kebutuhan Properti (Property Needs Fit)",
      maxPoints: 20,
      description: "Kesesuaian lokasi, tipe unit, spesifikasi kamar/lahan dengan kebutuhan pembeli.",
    },
    purchase_timeline: {
      key: "purchase_timeline",
      name: "Timeline Pembelian (Purchase Timeline)",
      maxPoints: 15,
      description: "Target waktu calon pembeli untuk merealisasikan pembelian.",
    },
    readiness_for_action: {
      key: "readiness_for_action",
      name: "Kesiapan Bertindak (Readiness for Action)",
      maxPoints: 20,
      description: "Kesiapan melakukan survei lokasi, booking unit, atau konsultasi lanjutan.",
    },
  },
};

export const SALES_RUBRIC_V1: DimensionRubric = {
  version: "v1.0",
  totalWeight: 100,
  criteria: {
    response_speed: {
      key: "response_speed",
      name: "Kecepatan Respons (Response Speed)",
      maxPoints: 15,
      description: "Dihitung secara deterministik dari selisih waktu respons pertama sales terhadap pesan pembeli.",
    },
    relevance_of_answers: {
      key: "relevance_of_answers",
      name: "Relevansi & Akurasi Jawaban (Relevance of Answers)",
      maxPoints: 25,
      description: "Akurasi informasi unit, harga, promo, dan kelengkapan menjawab pertanyaan prospek.",
    },
    needs_discovery: {
      key: "needs_discovery",
      name: "Penggalian Kebutuhan (Needs Discovery)",
      maxPoints: 20,
      description: "Inisiatif sales dalam menggali preferensi lokasi, kamar, budget, dan cara bayar prospek.",
    },
    follow_up_consistency: {
      key: "follow_up_consistency",
      name: "Konsistensi Tindak Lanjut (Follow-Up Consistency)",
      maxPoints: 20,
      description: "Keteraturan dan ketepatan waktu follow-up sesuai komitmen dan konteks percakapan.",
    },
    next_step_progression: {
      key: "next_step_progression",
      name: "Arah ke Langkah Berikutnya (Next-Step Progression)",
      maxPoints: 20,
      description: "Kemampuan sales mengarahkan prospek menuju survei lokasi, booking fee, atau negosiasi.",
    },
  },
};
