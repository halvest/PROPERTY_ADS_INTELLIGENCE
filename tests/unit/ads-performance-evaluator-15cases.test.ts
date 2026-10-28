import { describe, it, expect } from "vitest";
import {
  evaluateAdsPerformance,
  calculateMetricComparison,
} from "@/lib/ads/performance-evaluator";
import { parseDateRange, getEquivalentPreviousPeriod } from "@/lib/ads/date-utils";
import { classifyResult } from "@/lib/ads/service";

/**
 * Audit Test Suite: 15 Core Scenarios from Specification Section I
 */
describe("Audit Section I: 15 Core Test Scenarios for Ads Performance Evaluation", () => {
  // Kasus 1: Satu hari, nol hasil terverifikasi
  it("Kasus 1: Satu hari, nol hasil terverifikasi — tidak memvonis gagal, status data terbatas, aksi pantau", () => {
    const res = evaluateAdsPerformance({
      period: "1d",
      durationDays: 1,
      spend: 50000,
      results: 0,
      targetCpr: 30000,
      linkClicks: 40,
      impressions: 2500,
      trackingStatus: "verified",
    });

    // 1. Data calculations
    expect(res.actualCpr).toBeNull(); // CPR must be numerically null
    expect(res.resultsCondition).toBe("verified_zero");

    // 2. Data sufficiency & performance status
    expect(res.dataStatus).toBe("terbatas");
    expect(res.performanceStatus).toBe("belum_dapat_dinilai");

    // 3. Proportional action
    expect(res.action).toBe("pantau");
    expect(res.action).not.toBe("hentikan_sementara");
    expect(res.mainReason).toContain("1 hari");
  });

  // Kasus 2: Satu hari, satu hasil dengan CPR di atas target
  it("Kasus 2: Satu hari, satu hasil dengan CPR di atas target — belum membuktikan kegagalan jangka panjang, aksi pantau", () => {
    const res = evaluateAdsPerformance({
      period: "1d",
      durationDays: 1,
      spend: 45000,
      results: 1,
      targetCpr: 30000, // CPR actual = 45.000 (150% target)
      linkClicks: 30,
      impressions: 2000,
    });

    expect(res.actualCpr).toBe(45000);
    expect(res.resultsCondition).toBe("limited");
    expect(res.dataStatus).toBe("terbatas");
    expect(res.performanceStatus).toBe("belum_dapat_dinilai");
    expect(res.action).toBe("pantau");
    expect(res.action).not.toBe("hentikan_sementara");
  });

  // Kasus 3: Tujuh hari, nol hasil, tracking belum valid
  it("Kasus 3: Tujuh hari, nol hasil, tracking belum valid — prioritas periksa_tracking, bukan matikan iklan", () => {
    const res = evaluateAdsPerformance({
      period: "7d",
      durationDays: 7,
      spend: 200000,
      results: 0,
      targetCpr: 30000,
      linkClicks: 150,
      impressions: 12000,
      trackingStatus: "unverified",
    });

    expect(res.dataStatus).toBe("terbatas");
    expect(res.action).toBe("periksa_tracking");
    expect(res.action).not.toBe("hentikan_sementara");
    expect(res.mainReason).toContain("tracking");
  });

  // Kasus 4: Tujuh hari, nol hasil, tracking terverifikasi
  it("Kasus 4: Tujuh hari, nol hasil, tracking terverifikasi — pengeluaran berisiko (5x target CPR), aksi hentikan_sementara", () => {
    const res = evaluateAdsPerformance({
      period: "7d",
      durationDays: 7,
      spend: 250000,
      results: 0,
      targetCpr: 50000, // 5x target CPR spent with 0 results
      linkClicks: 180,
      impressions: 15000,
      trackingStatus: "verified",
    });

    expect(res.actualCpr).toBeNull();
    expect(res.resultsCondition).toBe("verified_zero");
    expect(res.dataStatus).toBe("cukup");
    expect(res.performanceStatus).toBe("di_atas_target");
    expect(res.action).toBe("hentikan_sementara");
    expect(res.riskToSpendRatio).toBe(5);
  });

  // Kasus 5: Empat belas hari, CPR konsisten di atas target
  it("Kasus 5: Empat belas hari, CPR konsisten di atas target — data cukup, performa di_atas_target, aksi optimasi/kurangi", () => {
    const res = evaluateAdsPerformance({
      period: "14d",
      durationDays: 14,
      spend: 1400000,
      results: 20, // CPR = 70.000 vs Target 40.000 (175%)
      targetCpr: 40000,
      linkClicks: 600,
      impressions: 40000,
    });

    expect(res.actualCpr).toBe(70000);
    expect(res.dataStatus).toBe("cukup");
    expect(res.performanceStatus).toBe("di_atas_target");
    expect(["kurangi", "optimasi"]).toContain(res.action);
  });

  // Kasus 6: Tiga puluh hari, CPR memenuhi target tetapi kualitas lead buruk / di luar cakupan Meta Ads
  it("Kasus 6: Tiga puluh hari, CPR memenuhi target — AI Meta Ads tidak mencampurkan asumsi CRM dan tetap pertahankan efisiensi Meta", () => {
    const res = evaluateAdsPerformance({
      period: "30d",
      durationDays: 30,
      spend: 3000000,
      results: 100, // CPR = 30.000 vs Target 35.000
      targetCpr: 35000,
      linkClicks: 1800,
      impressions: 120000,
      leadQualityReported: "Rendah di CRM",
    });

    expect(res.actualCpr).toBe(30000);
    expect(res.dataStatus).toBe("cukup");
    expect(res.performanceStatus).toBe("memenuhi_target");
    expect(res.action).toBe("pertahankan");
    // Explicit disclaimer that CRM is outside Meta Ads intelligence
    expect(res.uncertaintyNotes.some((n) => n.includes("CRM") || n.includes("kualitas prospek"))).toBe(true);
  });

  // Kasus 7: CPR yang dilaporkan tidak sesuai dengan total belanja dan hasil (inkonsistensi data)
  it("Kasus 7: CPR yang dilaporkan tidak sesuai dengan total belanja dan hasil — tandai tidak_valid, aksi periksa_tracking", () => {
    const res = evaluateAdsPerformance({
      period: "7d",
      durationDays: 7,
      spend: 100000,
      results: 2, // Actual calculated CPR = 50.000
      reportedCpr: 10000, // Reported CPR = 10.000 (contradicts actual ratio by 400%)
      targetCpr: 30000,
      linkClicks: 50,
      impressions: 5000,
    });

    expect(res.dataStatus).toBe("tidak_valid");
    expect(res.performanceStatus).toBe("belum_dapat_dinilai");
    expect(res.action).toBe("periksa_tracking");
    expect(res.dataStatusReason).toContain("tidak sesuai");
  });

  // Kasus 8: Perubahan signifikan terjadi di tengah periode analisis
  it("Kasus 8: Perubahan signifikan terjadi di tengah periode analisis — status terbatas, aksi pantau", () => {
    const res = evaluateAdsPerformance({
      period: "14d",
      durationDays: 14,
      spend: 700000,
      results: 12,
      targetCpr: 40000,
      linkClicks: 300,
      impressions: 25000,
      midPeriodChange: true, // Significant change mid-period
    });

    expect(res.dataStatus).toBe("terbatas");
    expect(res.action).toBe("pantau");
    expect(res.dataStatusReason).toContain("perubahan signifikan");
  });

  // Kasus 9: WhatsApp menerima pesan, tetapi hasil konversi Meta tercatat nol (tracking disconnect)
  it("Kasus 9: WhatsApp menerima pesan, tetapi konversi Meta tercatat nol — tracking disconnect terdeteksi, aksi periksa_tracking", () => {
    const res = evaluateAdsPerformance({
      period: "7d",
      durationDays: 7,
      spend: 350000,
      results: 0, // Meta recorded 0 conversions
      whatsappMessagesActual: 15, // Actual incoming WhatsApp chats exist
      targetCpr: 35000,
      linkClicks: 220,
      impressions: 18000,
    });

    expect(res.dataStatus).toBe("tidak_valid");
    expect(res.performanceStatus).toBe("belum_dapat_dinilai");
    expect(res.action).toBe("periksa_tracking");
    expect(res.uncertaintyNotes.some((n) => n.includes("tracking") || n.includes("WhatsApp"))).toBe(true);
  });

  // Kasus 10: Data hasil tidak tersedia akibat kegagalan pengambilan data (null / unavailable)
  it("Kasus 10: Data hasil tidak tersedia (null) — dataStatus tidak_valid, CPR null, aksi periksa_tracking", () => {
    const res = evaluateAdsPerformance({
      period: "7d",
      durationDays: 7,
      spend: 200000,
      results: null, // Data fetch error
      targetCpr: 30000,
      linkClicks: 80,
      impressions: 6000,
    });

    expect(res.actualCpr).toBeNull();
    expect(res.resultsCondition).toBe("unavailable");
    expect(res.dataStatus).toBe("tidak_valid");
    expect(res.performanceStatus).toBe("belum_dapat_dinilai");
    expect(res.action).toBe("periksa_tracking");
  });

  // Kasus 11: Target CPR tidak tersedia atau bernilai tidak valid
  it("Kasus 11: Target CPR tidak tersedia — status performa belum_dapat_dinilai terhadap target bisnis, aksi pantau", () => {
    const res = evaluateAdsPerformance({
      period: "7d",
      durationDays: 7,
      spend: 150000,
      results: 3,
      targetCpr: null, // No target CPR configured
      linkClicks: 60,
      impressions: 5000,
    });

    expect(res.targetCpr).toBeNull();
    expect(res.dataStatus).toBe("terbatas");
    expect(res.performanceStatus).toBe("belum_dapat_dinilai");
    expect(res.action).toBe("pantau");
  });

  // Kasus 12: Periode khusus dengan batas tanggal yang diuji (Custom Date Range)
  it("Kasus 12: Periode khusus dengan batas tanggal yang diuji — parsing rentang tanggal tepat dan durasi pembanding setara", () => {
    const customSince = "2026-10-10";
    const customUntil = "2026-10-20"; // 11 days inclusive
    const parsed = parseDateRange(`${customSince}:${customUntil}`, "Asia/Jakarta");

    expect(parsed.since).toBe("2026-10-10");
    expect(parsed.until).toBe("2026-10-20");

    const prev = getEquivalentPreviousPeriod(parsed.since!, parsed.until!);
    expect(prev).not.toBeNull();
    expect(prev?.prevUntil).toBe("2026-10-09");
    expect(prev?.prevSince).toBe("2026-09-29"); // Exactly 11 days prior
  });

  // Kasus 13: Perbandingan periode dengan nilai pembanding nol
  it("Kasus 13: Perbandingan periode dengan nilai pembanding nol — persentase delta tidak terdefinisi (null) dan bukan NaN/Infinity", () => {
    const compResults = calculateMetricComparison(10, 0, "id");
    expect(compResults.current).toBe(10);
    expect(compResults.previous).toBe(0);
    expect(compResults.percentageDelta).toBeNull(); // Strictly null, not Infinity or NaN
    expect(compResults.isDefined).toBe(false);
    expect(compResults.displayDelta).toBe("Pembanding 0");
    expect(compResults.absoluteDelta).toBe(10);

    const compSpend = calculateMetricComparison(500000, 0, "en");
    expect(compSpend.percentageDelta).toBeNull();
    expect(compSpend.displayDelta).toBe("Baseline 0");
  });

  // Kasus 14: Perbedaan tujuan optimasi atau definisi hasil
  it("Kasus 14: Perbedaan tujuan optimasi menghasilkan pelabelan eksplisit tanpa pencampuran sembarang", () => {
    const leadClass = classifyResult(10, ["lead"], "OUTCOME_LEADS");
    expect(leadClass.resultLabel).toBe("Leads");
    expect(leadClass.isLeads).toBe(true);

    const msgClass = classifyResult(15, ["messaging_conversation_started_7d"], "MESSAGES");
    expect(msgClass.resultLabel).toBe("Percakapan");
    expect(msgClass.isConversation).toBe(true);

    const salesClass = classifyResult(5, ["purchase"], "OUTCOME_SALES");
    expect(salesClass.resultLabel).toBe("Hasil");
    expect(salesClass.isLeads).toBe(false);
    expect(salesClass.isConversation).toBe(false);
  });

  // Kasus 15: Pergantian periode yang memastikan query dan kesimpulan ikut berubah
  it("Kasus 15: Pergantian periode mengubah data, batas waktu, dan kesimpulan evaluasi secara konsisten", () => {
    // Evaluation on 1d (monitoring): limited data, pantau
    const eval1d = evaluateAdsPerformance({
      period: "1d",
      durationDays: 1,
      spend: 40000,
      results: 0,
      targetCpr: 30000,
      linkClicks: 25,
      impressions: 1500,
    });
    expect(eval1d.dataStatus).toBe("terbatas");
    expect(eval1d.action).toBe("pantau");

    // Evaluation on 14d (deep evaluation): enough data, target exceeded, action optimasi/kurangi
    const eval14d = evaluateAdsPerformance({
      period: "14d",
      durationDays: 14,
      spend: 900000,
      results: 15, // CPR = 60.000 vs Target 30.000
      targetCpr: 30000,
      linkClicks: 400,
      impressions: 30000,
    });
    expect(eval14d.dataStatus).toBe("cukup");
    expect(eval14d.performanceStatus).toBe("di_atas_target");
    expect(["optimasi", "kurangi"]).toContain(eval14d.action);

    // Verify outcomes clearly differ between periods
    expect(eval1d.dataStatus).not.toEqual(eval14d.dataStatus);
    expect(eval1d.action).not.toEqual(eval14d.action);
  });
});
