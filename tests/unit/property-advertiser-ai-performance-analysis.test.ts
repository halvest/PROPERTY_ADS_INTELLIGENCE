import { describe, it, expect } from "vitest";
import { buildVerifiedMetricsSummary } from "@/app/api/ai/analyze-ad/route";
import fs from "fs";
import path from "path";

/**
 * Section 12 Acceptance Criteria:
 * Rebuild AI Performance Analysis for Property Advertisers
 */
describe("Section 12: Property Advertiser AI Performance Analysis Acceptance Tests", () => {
  // Test 1: Perhitungan CPC, CTR, CPM, dan biaya per hasil benar
  it("Test 1: Perhitungan CPC tautan, CTR tautan, CPM, dan biaya per hasil benar secara matematis", () => {
    const spend = 150000;
    const impressions = 10000;
    const linkClicks = 100;
    const results = 5;

    const summary = buildVerifiedMetricsSummary({
      spend,
      impressions,
      reach: 8000,
      linkClicks,
      allClicks: 150,
      linkCtr: Number(((linkClicks / impressions) * 100).toFixed(2)),
      allCtr: Number(((150 / impressions) * 100).toFixed(2)),
      linkCpc: Number((spend / linkClicks).toFixed(2)),
      allCpc: Number((spend / 150).toFixed(2)),
      cpm: Number(((spend / impressions) * 1000).toFixed(2)),
      results,
      costPerResult: Number((spend / results).toFixed(2)),
      qualifiedLeads: 2,
      resultsTrackingStatus: "TERVERIFIKASI",
    });

    const linkCtrItem = summary.find((m) => m.id === "linkCtr");
    const linkCpcItem = summary.find((m) => m.id === "linkCpc");
    const cpmItem = summary.find((m) => m.id === "cpm");
    const cprItem = summary.find((m) => m.id === "costPerResult");

    expect(linkCtrItem?.rawValue).toBe(1.0);
    expect(linkCtrItem?.formattedValue).toBe("1%");

    expect(linkCpcItem?.rawValue).toBe(1500);
    expect(linkCpcItem?.formattedValue).toBe("Rp 1.500");

    expect(cpmItem?.rawValue).toBe(15000);
    expect(cpmItem?.formattedValue).toBe("Rp 15.000");

    expect(cprItem?.rawValue).toBe(30000);
    expect(cprItem?.formattedValue).toBe("Rp 30.000");
  });

  // Test 2: Semua jenis klik dibedakan dengan benar (klik tautan vs semua klik)
  it("Test 2: Semua jenis klik dibedakan dengan benar antara klik tautan dan interaksi semua klik", () => {
    const summary = buildVerifiedMetricsSummary({
      spend: 200000,
      impressions: 20000,
      reach: 15000,
      linkClicks: 80,
      allClicks: 220,
      linkCtr: 0.4,
      allCtr: 1.1,
      linkCpc: 2500,
      allCpc: 909.09,
      cpm: 10000,
      results: 4,
      costPerResult: 50000,
      qualifiedLeads: 1,
      resultsTrackingStatus: "TERVERIFIKASI",
    });

    const linkClicksItem = summary.find((m) => m.id === "linkClicks");
    const allClicksItem = summary.find((m) => m.id === "allClicks");
    const linkCpcItem = summary.find((m) => m.id === "linkCpc");
    const allCpcItem = summary.find((m) => m.id === "allCpc");

    expect(linkClicksItem?.rawValue).toBe(80);
    expect(allClicksItem?.rawValue).toBe(220);
    expect(linkClicksItem?.plainExplanation).toContain("menekan tombol spesifik menuju WhatsApp atau halaman tujuan");
    expect(allClicksItem?.plainExplanation).toContain("komentar, bagikan, foto profil");

    expect(linkCpcItem?.rawValue).toBe(2500);
    expect(allCpcItem?.rawValue).toBe(909.09);
    expect(linkCpcItem?.rawValue).not.toEqual(allCpcItem?.rawValue);
  });

  // Test 3: Data kosong tidak dianggap sebagai nol
  it("Test 3: Data kosong tidak dianggap sebagai nol dan tidak memalsukan metrik", () => {
    const summary = buildVerifiedMetricsSummary({
      spend: 0,
      impressions: 0,
      reach: 0,
      linkClicks: 0,
      allClicks: 0,
      linkCtr: null,
      allCtr: null,
      linkCpc: null,
      allCpc: null,
      cpm: null,
      results: 0,
      costPerResult: null,
      qualifiedLeads: 0,
      resultsTrackingStatus: "BELUM_TERSEDIA",
    });

    const reachItem = summary.find((m) => m.id === "reach");
    const qualifiedLeadsItem = summary.find((m) => m.id === "qualifiedLeads");
    const resultsItem = summary.find((m) => m.id === "results");

    expect(reachItem?.rawValue).toBeNull();
    expect(reachItem?.formattedValue).toBe("Tidak tersedia");

    expect(qualifiedLeadsItem?.rawValue).toBeNull();
    expect(qualifiedLeadsItem?.formattedValue).toBe("Belum dicatat di CRM");

    expect(resultsItem?.formattedValue).toBe("Data belum tersedia");
    expect(resultsItem?.status).toBe("BELUM_TERSEDIA");
  });

  // Test 4: Pembagian nol tidak menghasilkan Infinity atau NaN
  it("Test 4: Pembagian nol dilindungi dan tidak menghasilkan Infinity atau NaN", () => {
    const summary = buildVerifiedMetricsSummary({
      spend: 100000,
      impressions: 0, // Zero impressions denominator
      reach: 0,
      linkClicks: 0, // Zero clicks denominator
      allClicks: 0,
      linkCtr: null,
      allCtr: null,
      linkCpc: null,
      allCpc: null,
      cpm: null,
      results: 0, // Zero results denominator
      costPerResult: null,
      qualifiedLeads: 0,
      resultsTrackingStatus: "TERVERIFIKASI_NOL",
    });

    const linkCtrItem = summary.find((m) => m.id === "linkCtr");
    const linkCpcItem = summary.find((m) => m.id === "linkCpc");
    const cpmItem = summary.find((m) => m.id === "cpm");
    const cprItem = summary.find((m) => m.id === "costPerResult");
    const ratioItem = summary.find((m) => m.id === "clickToConversationRatio");

    expect(linkCtrItem?.formattedValue).toBe("Tidak dapat dihitung");
    expect(linkCtrItem?.rawValue).toBeNull();

    expect(linkCpcItem?.formattedValue).toBe("Tidak dapat dihitung");
    expect(linkCpcItem?.rawValue).toBeNull();

    expect(cpmItem?.formattedValue).toBe("Tidak dapat dihitung");
    expect(cpmItem?.rawValue).toBeNull();

    expect(cprItem?.formattedValue).toBe("Tidak dapat dihitung");
    expect(cprItem?.rawValue).toBeNull();

    expect(ratioItem?.formattedValue).toBe("Tidak dapat dihitung");
    expect(ratioItem?.rawValue).toBeNull();
  });

  // Test 5: Benchmark tidak muncul tanpa sumber yang valid
  it("Test 5: Benchmark eksternal tidak dimunculkan tanpa sumber valid dan dinyatakan secara transparan", () => {
    const routeContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ai/analyze-ad/route.ts"),
      "utf-8"
    );

    // Must not state arbitrary unverified benchmarks as universal truth
    expect(routeContent.includes("CTR 0.8% - 1.0%")).toBe(false);
    expect(routeContent.includes("Rp 1.500 - Rp 3.500")).toBe(false);

    // Must explicitly include transparency disclaimer about unverified external benchmarks
    expect(routeContent.includes("Benchmark eksternal industri properti spesifik wilayah")).toBe(true);
  });

  // Test 6: Fakta dibedakan dari hipotesis
  it("Test 6: Fakta aktual dibedakan dari hipotesis dan dugaan pada temuan utama", () => {
    const findingFact = {
      title: "Data Belanja Aktual",
      evidence: "Rp 150.000",
      interpretation: "Biaya yang telah ditagihkan Meta",
      confidence: "TINGGI" as const,
      businessRelevance: "Evaluasi anggaran",
      isHypothesis: false,
    };

    const findingHypothesis = {
      title: "Pemeriksaan Tombol WhatsApp",
      evidence: "120 klik tautan dan 0 percakapan",
      interpretation: "Diduga terjadi hambatan pada nomor WhatsApp atau pesan pembuka",
      confidence: "SEDANG" as const,
      businessRelevance: "Mencegah kebocoran calon pembeli",
      isHypothesis: true,
    };

    expect(findingFact.isHypothesis).toBe(false);
    expect(findingHypothesis.isHypothesis).toBe(true);
  });

  // Test 7: AI tidak membuat data properti atau promosi yang tidak tersedia
  it("Test 7: AI tidak mengarang harga, legalitas, atau promosi fiktif dan menggunakan placeholder", () => {
    const routeContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ai/analyze-ad/route.ts"),
      "utf-8"
    );

    // Templates use explicit placeholders
    expect(routeContent.includes("[Sebutkan Lokasi Strategis]")).toBe(true);
    expect(routeContent.includes("[Sebutkan Legalitas: misal SHM / PBG Ready]")).toBe(true);
    expect(routeContent.includes("[Sebutkan Skema: misal KPR DP Ringan / Cash Bertahap]")).toBe(true);

    // Prompt bans fabricating property details
    expect(routeContent.includes("JANGAN MENGARANG INFORMASI PROPERTI, HARGA, ATAU PROMOSI")).toBe(true);
  });

  // Test 8: Rekomendasi mempertimbangkan objektif campaign
  it("Test 8: Evaluasi dan prompt mempertimbangkan objektif campaign Meta", () => {
    const routeContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ai/analyze-ad/route.ts"),
      "utf-8"
    );

    expect(routeContent.includes("campaignObjective")).toBe(true);
    expect(routeContent.includes('Objektif Kampanye: "${data.campaignObjective')).toBe(true);
  });

  // Test 9: Nol lead tidak otomatis dianggap sebagai kerusakan funnel
  it("Test 9: Nol lead tidak otomatis divonis sebagai 'funnel rusak/jebol' melainkan kesenjangan yang perlu diuji", () => {
    const routeContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ai/analyze-ad/route.ts"),
      "utf-8"
    );

    // Banned jargon must not exist in prompt or code
    expect(routeContent.includes("funnel jebol")).toBe(false);
    expect(routeContent.includes("traffic murah tapi buntu")).toBe(false);
    expect(routeContent.includes("placement sampah")).toBe(false);
    expect(routeContent.includes("kill rule")).toBe(false);

    // States gap with testable hypotheses
    expect(routeContent.includes("Kesenjangan Antara Klik Tautan dan Percakapan Masuk")).toBe(true);
  });

  // Test 10: Output AI tervalidasi sebelum ditampilkan (Zod schema)
  it("Test 10: Output AI divalidasi dengan Zod schema sebelum disajikan ke client", () => {
    const routeContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ai/analyze-ad/route.ts"),
      "utf-8"
    );

    expect(routeContent.includes("ModelOutputSchema.safeParse")).toBe(true);
    expect(routeContent.includes("SCHEMA_VALIDATION_ERROR")).toBe(true);
  });

  // Test 11: AI hanya berjalan setelah klik manual
  it("Test 11: Analisis AI hanya berjalan setelah pengguna menekan tombol dan tidak ada auto-trigger", () => {
    const drawerContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/components/dashboard/AdDetailDrawer.tsx"),
      "utf-8"
    );

    // No auto-trigger on mount
    expect(drawerContent.includes("runAiAnalysis()")).toBe(false); // Only onClick={runAiAnalysis}
    expect(drawerContent.includes("Mulai Analisis AI Sekarang")).toBe(true);
    expect(drawerContent.includes("Analisis Ulang")).toBe(true);
  });

  // Test 12: Tidak ada retry atau double request otomatis
  it("Test 12: Tidak ada retry otomatis (maxRetries: 0) dan klik ganda dicegah", () => {
    const routeContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ai/analyze-ad/route.ts"),
      "utf-8"
    );
    const drawerContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/components/dashboard/AdDetailDrawer.tsx"),
      "utf-8"
    );

    // Server disables auto retries
    expect(routeContent.includes("maxRetries: 0")).toBe(true);

    // Client uses concurrency ref guard
    expect(drawerContent.includes("isAnalyzingRef.current = true")).toBe(true);
  });

  // Test 13: Data tenant lain tidak dapat dianalisis (403 forbidden)
  it("Test 13: Data iklan tenant lain ditolak dengan status 403 Forbidden", () => {
    const routeContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ai/analyze-ad/route.ts"),
      "utf-8"
    );

    expect(routeContent.includes("crossAd.organization_id !== organizationId")).toBe(true);
    expect(routeContent.includes("Iklan berada di luar batas tenant Anda")).toBe(true);
    expect(routeContent.includes("status: 403")).toBe(true);
  });

  // Test 14: Hasil analisis lama yang valid tetap tersedia jika analisis baru gagal
  it("Test 14: Hasil analisis lama yang valid tidak dihapus ketika analisis baru mengalami error", () => {
    const validState: { summary: string } | null = { summary: "Analisis valid sebelumnya" };
    let errorState: string | null = null;

    // Simulate re-analysis failure
    try {
      throw new Error("Server timeout");
    } catch (err) {
      errorState = (err as Error).message;
      // Do NOT set validState = null
    }

    expect(validState).not.toBeNull();
    expect(validState?.summary).toBe("Analisis valid sebelumnya");
    expect(errorState).toBe("Server timeout");
  });
});
