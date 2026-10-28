/**
 * HD Creative Ads Performance Intelligence Evaluator
 *
 * Deterministic evaluation engine for Meta Ads performance analysis.
 * Strictly implements Section A-J audit specifications:
 * 1. Data Sufficiency Assessment (cukup, terbatas, tidak_valid).
 * 2. Performance Status (memenuhi_target, di_atas_target, belum_dapat_dinilai).
 * 3. Proportional Action Prescriptions (pantau, periksa_tracking, optimasi, pertahankan, kurangi, hentikan_sementara).
 * 4. Safe Period Comparisons (handling zero baseline without NaN/Infinity).
 * 5. Explicit metadata transparency (Learning status & Tracking status).
 *
 * Designed to prevent premature "boncos" conclusions or ad kills based on
 * limited data, 1-day noise, or tracking discrepancies.
 */

export type DataSufficiencyStatus = "cukup" | "terbatas" | "tidak_valid";
export type PerformanceStatus = "memenuhi_target" | "di_atas_target" | "belum_dapat_dinilai";
export type DecisionAction =
  | "pantau"
  | "periksa_tracking"
  | "optimasi"
  | "pertahankan"
  | "kurangi"
  | "hentikan_sementara";

export type ResultsCondition =
  | "verified_zero" // Data lengkap dan tidak terdapat hasil yang sesuai dalam periode
  | "unavailable"   // Data hasil tidak berhasil diperoleh atau belum lengkap
  | "limited"       // Terdapat hasil valid, tetapi jumlahnya belum cukup untuk mendukung kesimpulan kuat
  | "sufficient";   // Hasil cukup

export type AnalysisPeriod = "1d" | "3d" | "7d" | "14d" | "30d" | "custom";

export interface EvaluationInput {
  period: AnalysisPeriod | string;
  durationDays: number;
  spend: number;
  results: number | null; // null if fetch error / data unavailable
  reportedCpr?: number | null;
  targetCpr?: number | null;
  linkClicks: number;
  impressions: number;
  reach?: number;
  frequency?: number | null;
  trackingStatus?: "verified" | "unverified" | "unavailable" | "disconnect";
  whatsappMessagesActual?: number | null; // for detecting WhatsApp vs Meta disconnect
  midPeriodChange?: boolean; // Significant change occurred mid-period
  prevSpend?: number | null;
  prevResults?: number | null;
  prevCpr?: number | null;
  campaignObjective?: string | null;
  leadQualityReported?: string | null; // Outside Meta Ads data
  locale?: "id" | "en";
}

export interface MetricComparison {
  current: number | null;
  previous: number | null;
  absoluteDelta: number | null;
  percentageDelta: number | null;
  displayDelta: string;
  isDefined: boolean;
}

export interface PerformanceEvaluationResult {
  dataStatus: DataSufficiencyStatus;
  dataStatusReason: string;
  resultsCondition: ResultsCondition;
  performanceStatus: PerformanceStatus;
  action: DecisionAction;
  mainReason: string;
  uncertaintyNotes: string[];
  actualCpr: number | null; // Strictly NULL when results === 0 or results is null
  targetCpr: number | null;
  riskToSpendRatio: number | null;
  comparisons: {
    spend: MetricComparison;
    results: MetricComparison;
    cpr: MetricComparison;
  };
  learningStatus: string;
  trackingStatusDisplay: string;
  headline: string;
  subtext: string;
  nextActions: Array<{
    priority: "high" | "medium" | "low";
    title: string;
    why: string;
    do: string;
    stop_loss: string;
  }>;
}

/**
 * Calculates deterministic metric comparison between current and previous periods.
 * Strictly prevents Infinity or NaN when previous baseline is 0 or null.
 */
export function calculateMetricComparison(
  current: number | null | undefined,
  previous: number | null | undefined,
  locale: "id" | "en" = "id"
): MetricComparison {
  const curr = current !== null && current !== undefined && !Number.isNaN(current) ? current : null;
  const prev = previous !== null && previous !== undefined && !Number.isNaN(previous) ? previous : null;

  if (curr === null || prev === null || prev === 0) {
    const isBaselineZero = prev === 0;
    return {
      current: curr,
      previous: prev,
      absoluteDelta: curr !== null && prev !== null ? Number((curr - prev).toFixed(2)) : null,
      percentageDelta: null,
      displayDelta: isBaselineZero
        ? locale === "en" ? "Baseline 0" : "Pembanding 0"
        : "—",
      isDefined: false,
    };
  }

  const abs = Number((curr - prev).toFixed(2));
  const pct = Number((((curr - prev) / prev) * 100).toFixed(1));
  const sign = pct >= 0 ? "+" : "";

  return {
    current: curr,
    previous: prev,
    absoluteDelta: abs,
    percentageDelta: pct,
    displayDelta: `${sign}${locale === "id" ? String(pct).replace(".", ",") : pct}%`,
    isDefined: true,
  };
}

/**
 * Core deterministic evaluation function implementing Section B-H requirements.
 */
export function evaluateAdsPerformance(input: EvaluationInput): PerformanceEvaluationResult {
  const {
    period,
    durationDays,
    spend,
    results,
    reportedCpr,
    targetCpr,
    linkClicks,
    impressions,
    trackingStatus = "verified",
    whatsappMessagesActual,
    midPeriodChange = false,
    prevSpend,
    prevResults,
    prevCpr,
    locale = "id",
  } = input;

  const loc = locale;
  const uncertaintyNotes: string[] = [];

  // 1. Validate Numeric Data Validity & Inconsistencies
  let isDataCorrupt = false;
  let corruptReason = "";

  if (spend < 0 || impressions < 0 || linkClicks < 0 || (results !== null && results < 0)) {
    isDataCorrupt = true;
    corruptReason = loc === "en"
      ? "Invalid negative metrics detected in ad data."
      : "Data metrik negatif tidak valid terdeteksi.";
  }

  // Check Results Condition
  let resultsCondition: ResultsCondition;
  if (results === null || results === undefined || Number.isNaN(results)) {
    resultsCondition = "unavailable";
  } else if (results === 0) {
    resultsCondition = "verified_zero";
  } else if (results < 5) {
    resultsCondition = "limited";
  } else {
    resultsCondition = "sufficient";
  }

  // Calculate Actual CPR (Must be numerically null if results === 0 or unavailable)
  let actualCpr: number | null = null;
  if (results !== null && results > 0) {
    actualCpr = Number((spend / results).toFixed(2));
  }

  // Check Reported CPR Consistency against Calculated CPR
  let isInconsistent = false;
  if (reportedCpr !== undefined && reportedCpr !== null && actualCpr !== null && actualCpr > 0) {
    const diff = Math.abs(reportedCpr - actualCpr) / actualCpr;
    if (diff > 0.1) {
      isInconsistent = true;
      isDataCorrupt = true;
      corruptReason = loc === "en"
        ? `Reported CPR (Rp ${Math.round(reportedCpr).toLocaleString()}) contradicts total spend / results ratio (Rp ${Math.round(actualCpr).toLocaleString()}).`
        : `CPR yang dilaporkan (Rp ${Math.round(reportedCpr).toLocaleString("id-ID")}) tidak sesuai dengan rasio total belanja terhadap hasil valid (Rp ${Math.round(actualCpr).toLocaleString("id-ID")}).`;
    }
  }

  // Tracking Disconnect (WhatsApp received messages, but Meta recorded 0 conversions)
  const isTrackingDisconnect =
    (whatsappMessagesActual && whatsappMessagesActual > 0 && results === 0) ||
    trackingStatus === "disconnect";

  if (isTrackingDisconnect) {
    uncertaintyNotes.push(
      loc === "en"
        ? "Tracking mismatch detected: WhatsApp incoming messages active while Meta recorded 0 conversions."
        : "Terdeteksi ketidakcocokan tracking: pesan WhatsApp masuk aktif namun konversi Meta tercatat 0."
    );
  }

  // 2. Assess Data Sufficiency Status (cukup, terbatas, tidak_valid)
  let dataStatus: DataSufficiencyStatus = "cukup";
  let dataStatusReason = "";

  if (isDataCorrupt || resultsCondition === "unavailable" || isTrackingDisconnect) {
    dataStatus = "tidak_valid";
    dataStatusReason = corruptReason || (resultsCondition === "unavailable"
      ? (loc === "en" ? "Results data could not be retrieved from Meta API." : "Data hasil tidak berhasil diperoleh dari Meta API.")
      : (loc === "en" ? "Tracking discrepancy detected between Meta conversions and actual messages." : "Kesenjangan tracking terdeteksi antara konversi Meta dan pesan aktual."));
  } else if (
    durationDays <= 3 ||
    period === "1d" ||
    period === "3d" ||
    resultsCondition === "limited" ||
    midPeriodChange ||
    trackingStatus === "unverified" ||
    trackingStatus === "unavailable" ||
    (targetCpr && targetCpr > 0 && spend < targetCpr && results === 0)
  ) {
    dataStatus = "terbatas";
    if (durationDays <= 1 || period === "1d") {
      dataStatusReason = loc === "en"
        ? "1-day observation is insufficient for conclusive performance verdicts."
        : "Periode observasi 1 hari belum memadai untuk kesimpulan performa definitif.";
    } else if (durationDays <= 3 || period === "3d") {
      dataStatusReason = loc === "en"
        ? "3-day observation is early diagnostic data; stabilization ongoing."
        : "Periode 3 hari merupakan diagnostik awal; data masih dalam tahap stabilisasi.";
    } else if (midPeriodChange) {
      dataStatusReason = loc === "en"
        ? "Significant configuration change occurred mid-period, resetting trend continuity."
        : "Terjadi perubahan signifikan di tengah periode analisis yang memutus kontinuitas tren.";
    } else if (trackingStatus === "unverified" || trackingStatus === "unavailable") {
      dataStatusReason = loc === "en"
        ? "Tracking setup has not been independently verified."
        : "Status tracking belum terverifikasi secara independen.";
    } else if (resultsCondition === "limited") {
      dataStatusReason = loc === "en"
        ? `Valid results (${results}) are below statistical evaluation threshold (min. 5).`
        : `Jumlah hasil valid (${results}) masih di bawah ambang evaluasi statistik (min. 5).`;
    } else {
      dataStatusReason = loc === "en"
        ? "Observation data remains limited for definitive scaling decisions."
        : "Data pengamatan masih terbatas untuk keputusan skala definitif.";
    }
  } else {
    dataStatus = "cukup";
    dataStatusReason = loc === "en"
      ? "Sufficient data volume and observation window for evaluation."
      : "Data dan durasi pengamatan memadai untuk evaluasi performa.";
  }

  // 3. Assess Performance Status (memenuhi_target, di_atas_target, belum_dapat_dinilai)
  let performanceStatus: PerformanceStatus = "belum_dapat_dinilai";
  const effectiveTargetCpr = targetCpr && targetCpr > 0 ? targetCpr : null;
  const riskToSpendRatio = effectiveTargetCpr && effectiveTargetCpr > 0
    ? Number((spend / effectiveTargetCpr).toFixed(2))
    : null;

  if (dataStatus === "tidak_valid") {
    performanceStatus = "belum_dapat_dinilai";
  } else if (durationDays <= 1 || period === "1d") {
    // Section E: 1 day without results or 1 day with high CPR is NOT failure
    performanceStatus = "belum_dapat_dinilai";
  } else if (resultsCondition === "verified_zero") {
    if (effectiveTargetCpr && spend >= 2 * effectiveTargetCpr && durationDays >= 3) {
      performanceStatus = "di_atas_target"; // High risk spend
    } else {
      performanceStatus = "belum_dapat_dinilai";
    }
  } else if (actualCpr !== null) {
    if (resultsCondition === "limited" && durationDays <= 3) {
      // 1-3 results in <= 3 days cannot declare long-term failure
      performanceStatus = "belum_dapat_dinilai";
    } else if (effectiveTargetCpr) {
      if (actualCpr <= effectiveTargetCpr * 1.05) {
        performanceStatus = "memenuhi_target";
      } else {
        performanceStatus = "di_atas_target";
      }
    } else {
      // No target CPR: evaluate based on volume stability
      performanceStatus = resultsCondition === "sufficient" ? "memenuhi_target" : "belum_dapat_dinilai";
    }
  }

  // 4. Prescribe Proportional Action (pantau, periksa_tracking, optimasi, pertahankan, kurangi, hentikan_sementara)
  let action: DecisionAction = "pantau";
  let mainReason = "";

  if (dataStatus === "tidak_valid" || isTrackingDisconnect || trackingStatus === "unverified" || trackingStatus === "unavailable") {
    action = "periksa_tracking";
    mainReason = corruptReason || (loc === "en"
      ? "Verify tracking link, pixel, or WhatsApp connection before making ad budget changes."
      : "Periksa tracking tautan, pixel, atau koneksi WhatsApp sebelum mengubah anggaran iklan.");
  } else if (dataStatus === "terbatas") {
    // When data is limited, NEVER conclude "hentikan_sementara" or permanent failure
    action = "pantau";
    if (durationDays <= 1 || period === "1d") {
      mainReason = loc === "en"
        ? "1-day observation is too short to evaluate performance. Continue monitoring over 3–7 days."
        : "Periode 1 hari terlalu singkat untuk menyimpulkan performa. Lanjutkan pemantauan selama 3–7 hari ke depan.";
    } else if (resultsCondition === "limited") {
      mainReason = loc === "en"
        ? `Observation shows ${results} result(s). Continue monitoring to accumulate at least 5 results before optimizing.`
        : `Tercatat ${results} hasil. Lanjutkan pemantauan hingga terkumpul minimal 5 hasil sebelum optimasi.`;
    } else if (midPeriodChange) {
      mainReason = loc === "en"
        ? "Configuration change occurred mid-period. Allow 3–5 days of uninterrupted delivery."
        : "Perubahan konfigurasi terjadi di tengah periode. Berikan waktu 3–5 hari penayangan stabil.";
    } else {
      mainReason = loc === "en"
        ? "Early observation window. Monitor CPR accumulation over the next 3–7 days."
        : "Jendela observasi awal. Pantau akumulasi CPR selama 3–7 hari ke depan.";
    }
  } else {
    // Data is "cukup"
    if (resultsCondition === "verified_zero") {
      if (effectiveTargetCpr && spend >= 2 * effectiveTargetCpr) {
        action = "hentikan_sementara";
        mainReason = loc === "en"
          ? `Ad spend reached ${riskToSpendRatio}x target CPR without verified conversions over ${durationDays} days. Pause temporarily to review creative and offer.`
          : `Belanja telah mencapai ${riskToSpendRatio}x target CPR tanpa konversi terverifikasi selama ${durationDays} hari. Hentikan sementara untuk review penawaran.`;
      } else {
        action = "pantau";
        mainReason = loc === "en"
          ? "Spend is within safe risk tolerance. Continue delivery monitoring."
          : "Belanja masih dalam batas toleransi risiko. Lanjutkan pemantauan.";
      }
    } else if (performanceStatus === "di_atas_target") {
      if (actualCpr && effectiveTargetCpr && actualCpr > 1.4 * effectiveTargetCpr && durationDays >= 14) {
        action = "kurangi";
        mainReason = loc === "en"
          ? `CPR (Rp ${Math.round(actualCpr).toLocaleString()}) consistently exceeds target (Rp ${Math.round(effectiveTargetCpr).toLocaleString()}) over ${durationDays} days. Reduce budget or rotate hook.`
          : `CPR (Rp ${Math.round(actualCpr).toLocaleString("id-ID")}) konsisten melampaui target (Rp ${Math.round(effectiveTargetCpr).toLocaleString("id-ID")}) selama ${durationDays} hari. Kurangi budget atau rotasi hook.`;
      } else {
        action = "optimasi";
        mainReason = loc === "en"
          ? `Actual CPR exceeds target. Optimize lowest performing ad sets and creatives.`
          : `CPR aktual di atas target. Lakukan optimasi pada ad set atau materi dengan CPR tertinggi.`;
      }
    } else if (performanceStatus === "memenuhi_target") {
      action = "pertahankan";
      mainReason = loc === "en"
        ? `Performance meets target CPR (Rp ${Math.round(actualCpr || 0).toLocaleString()}) with ${results} verified results.`
        : `Performa memenuhi target CPR (Rp ${Math.round(actualCpr || 0).toLocaleString("id-ID")}) dengan ${results} hasil terverifikasi.`;
    } else {
      action = "pantau";
      mainReason = loc === "en"
        ? "Metrics are stable; keep current delivery settings."
        : "Metrik stabil; pertahankan pengaturan penayangan saat ini.";
    }
  }

  // 5. Build Period Comparisons
  const comparisons = {
    spend: calculateMetricComparison(spend, prevSpend, loc),
    results: calculateMetricComparison(results, prevResults, loc),
    cpr: calculateMetricComparison(actualCpr, prevCpr, loc),
  };

  if (prevResults !== undefined && prevResults !== null && prevResults < 5 && prevResults > 0) {
    uncertaintyNotes.push(
      loc === "en"
        ? "Comparison baseline has fewer than 5 results; percentage trend should be interpreted with caution."
        : "Periode pembanding memiliki kurang dari 5 hasil; persentase tren harus diinterpretasikan secara hati-hati."
    );
  }

  // 6. Metadata Transparency (Section F & CRM Separation)
  const learningStatus = loc === "en"
    ? "Learning status not available in data source"
    : "Status Learning tidak tersedia";

  const trackingStatusDisplay = trackingStatus === "verified"
    ? (loc === "en" ? "Meta Standard Tracking Verified" : "Tracking Standar Meta Terverifikasi")
    : (loc === "en" ? "Not available in data source" : "Tidak tersedia dalam sumber data");

  // CRM Lead Quality Separation Disclaimer
  if (input.leadQualityReported) {
    uncertaintyNotes.push(
      loc === "en"
        ? "Note: External CRM lead quality / closing is evaluated outside Meta Ads intelligence."
        : "Catatan: Kualitas prospek / closing CRM dievaluasi di luar analisis Meta Ads."
    );
  }

  // 7. Compose Headline, Subtext, and Max 3 Actions
  let headline = "";
  let subtext = "";

  if (action === "periksa_tracking") {
    headline = loc === "en"
      ? "Tracking check needed before budget decisions."
      : "Pemeriksaan tracking diperlukan sebelum keputusan budget.";
    subtext = mainReason;
  } else if (action === "pantau") {
    headline = loc === "en"
      ? "Monitoring phase: continue data accumulation."
      : "Fase pemantauan: lanjutkan akumulasi data.";
    subtext = mainReason;
  } else if (action === "optimasi") {
    headline = loc === "en"
      ? "CPR exceeds target: creative and audience optimization recommended."
      : "CPR di atas target: rekomendasi optimasi materi dan audiens.";
    subtext = mainReason;
  } else if (action === "kurangi" || action === "hentikan_sementara") {
    headline = loc === "en"
      ? "Budget protection: temporary pause recommended."
      : "Perlindungan budget: jeda sementara direkomendasikan.";
    subtext = mainReason;
  } else {
    headline = loc === "en"
      ? "Efficient delivery: maintain current allocation."
      : "Penayangan efisien: pertahankan alokasi saat ini.";
    subtext = mainReason;
  }

  const nextActions: PerformanceEvaluationResult["nextActions"] = [];

  if (action === "periksa_tracking") {
    nextActions.push({
      priority: "high",
      title: loc === "en" ? "Verify WhatsApp tracking link" : "Periksa tautan pesan WhatsApp",
      why: loc === "en" ? "Ensure click-to-chat URL and pre-filled message work seamlessly." : "Memastikan URL click-to-chat dan pesan pembuka berfungsi tanpa hambatan.",
      do: loc === "en" ? "Test ad click directly in Meta Ads preview to verify chat opens." : "Uji klik iklan langsung dari pratinjau Meta untuk verifikasi chat masuk.",
      stop_loss: loc === "en" ? "Pause delivery if tracking is broken." : "Jeda iklan jika tautan tracking terbukti rusak.",
    });
  } else if (action === "pantau") {
    nextActions.push({
      priority: "medium",
      title: loc === "en" ? "Accumulate delivery data" : "Akumulasi data penayangan",
      why: loc === "en" ? "Current data volume is below statistical stability threshold." : "Volume data saat ini masih di bawah ambang kestabilan statistik.",
      do: loc === "en" ? "Maintain existing budget for 3–5 days without editing creative." : "Pertahankan budget saat ini selama 3–5 hari tanpa mengubah materi.",
      stop_loss: loc === "en" ? "Re-evaluate if spend reaches 2x target CPR with zero conversions." : "Evaluasi ulang jika belanja mencapai 2x target CPR tanpa hasil.",
    });
  } else if (action === "optimasi") {
    nextActions.push({
      priority: "high",
      title: loc === "en" ? "Review weakest ad sets" : "Evaluasi ad set terlemah",
      why: loc === "en" ? "Concentrating budget on top creatives lowers overall CPR." : "Memusatkan budget pada materi terbaik menurunkan CPR keseluruhan.",
      do: loc === "en" ? "Turn off ads with CPR 30% higher than average." : "Matikan iklan dengan CPR 30% di atas rata-rata.",
      stop_loss: loc === "en" ? "Pause ad set if CPR does not improve in 3 days." : "Jeda ad set jika CPR tidak membaik dalam 3 hari.",
    });
  } else if (action === "kurangi" || action === "hentikan_sementara") {
    nextActions.push({
      priority: "high",
      title: loc === "en" ? "Pause underperforming creative" : "Jeda materi yang belum menghasilkan",
      why: loc === "en" ? "Prevent budget bleed when conversion rate is below target." : "Mencegah kebocoran budget ketika rasio konversi di bawah target.",
      do: loc === "en" ? "Pause ad temporarily and audit buyer hook and property pricing." : "Jeda iklan sementara dan audit hook pembeli serta harga properti.",
      stop_loss: loc === "en" ? "Only re-enable with refreshed creative angle." : "Aktifkan kembali hanya setelah sudut penawaran diperbarui.",
    });
  } else {
    nextActions.push({
      priority: "medium",
      title: loc === "en" ? "Maintain stable budget" : "Pertahankan budget stabil",
      why: loc === "en" ? "CPR meets target and frequency is in healthy range." : "CPR memenuhi target dan frekuensi berada di batas sehat.",
      do: loc === "en" ? "Monitor CPR daily to preserve current efficiency." : "Pantau CPR harian untuk menjaga efisiensi saat ini.",
      stop_loss: loc === "en" ? "Re-evaluate if frequency exceeds 2.5x." : "Evaluasi ulang jika frekuensi melampaui 2,5x.",
    });
  }

  return {
    dataStatus,
    dataStatusReason,
    resultsCondition,
    performanceStatus,
    action,
    mainReason,
    uncertaintyNotes,
    actualCpr,
    targetCpr: effectiveTargetCpr,
    riskToSpendRatio,
    comparisons,
    learningStatus,
    trackingStatusDisplay,
    headline,
    subtext,
    nextActions,
  };
}
