import {
  classifyPeriodConfidence,
  meetsPerformanceSla,
  normalizeEntityStatus,
  spentBeyondDoubleTarget,
  type AnalysisScope,
  type EntityDeliveryStatus,
  type PeriodConfidence,
} from "@/lib/ai/ctwa-analysis/dynamic-context";

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
  | "hentikan_sementara"
  | "reaktivasi"
  | "tinjau_reaktivasi";

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
  trackingStatus?: "verified" | "unverified" | "unavailable";
  midPeriodChange?: boolean; // Significant change occurred mid-period
  prevSpend?: number | null;
  prevResults?: number | null;
  prevCpr?: number | null;
  campaignObjective?: string | null;
  leadQualityReported?: string | null; // Outside Meta Ads data
  locale?: "id" | "en";
  entityStatus?: string | null;
  analysisScope?: AnalysisScope;
  /** Link CTR in percent. Used for causal diagnostics. */
  linkCtr?: number | null;
}

export interface CausalDiagnostic {
  code: "creative_hook" | "conversion_dropoff";
  title: string;
  insight: string;
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
  entityStatus: EntityDeliveryStatus;
  analysisScope: AnalysisScope;
  periodConfidence: PeriodConfidence;
  scaleEligible: boolean;
  causalDiagnostics: CausalDiagnostic[];
}

/** Multi-day aggregates cannot produce frequency. Null does not block SCALE. */
export function frequencyAllowsScale(frequency: number | null | undefined): boolean {
  if (frequency === null || frequency === undefined || !Number.isFinite(frequency)) return true;
  return frequency > 0 && frequency < 2.5;
}

export function qualifiesForScaleVerdict(input: {
  performanceStatus: PerformanceStatus;
  dataStatus: DataSufficiencyStatus;
  results: number | null;
  targetCpr: number | null;
  frequency?: number | null;
  durationDays: number;
  entityStatus: EntityDeliveryStatus;
}): boolean {
  return (
    input.performanceStatus === "memenuhi_target" &&
    input.dataStatus === "cukup" &&
    (input.results ?? 0) >= 30 &&
    input.targetCpr !== null &&
    input.targetCpr > 0 &&
    frequencyAllowsScale(input.frequency) &&
    input.durationDays >= 14 &&
    input.entityStatus === "ACTIVE"
  );
}

export function diagnoseCausalFriction(input: {
  linkCtr: number | null;
  actualCpr: number | null;
  targetCpr: number | null;
  results: number | null;
}): CausalDiagnostic[] {
  const notes: CausalDiagnostic[] = [];
  const linkCtr = input.linkCtr;
  const target = input.targetCpr && input.targetCpr > 0 ? input.targetCpr : null;
  const cpr = input.actualCpr;
  if (linkCtr !== null && linkCtr < 0.8 && target !== null && cpr !== null && cpr > target) {
    notes.push({
      code: "creative_hook",
      title: "Respons klik perlu ditinjau",
      insight: `CTR tautan ${linkCtr.toLocaleString("id-ID")}% berada di bawah 0,8% sementara CPR di atas target. Ini hipotesis bahwa materi, penawaran, audiens, atau placement perlu dibandingkan. Penyebab belum dapat dipastikan tanpa data creative dan placement.`,
    });
  }
  if (
    linkCtr !== null &&
    linkCtr >= 1.2 &&
    (input.results === 0 || (target !== null && cpr !== null && cpr > 1.4 * target))
  ) {
    notes.push({
      code: "conversion_dropoff",
      title: "Klik tidak sebanding dengan hasil",
      insight: `CTR tautan ${linkCtr.toLocaleString("id-ID")}% relatif kuat, tetapi hasil nol atau CPR jauh di atas target. Hipotesis meliputi penawaran, halaman tujuan, atau proses balasan. CRM tidak ikut dihitung pada diagnosis ini.`,
    });
  }
  return notes;
}

function formatRupiah(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

function formatIdPercent(value: number): string {
  return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

function forceIndonesianLocale(_requestedLocale: "id" | "en" | undefined): "id" | "en" {
  void _requestedLocale;
  return "id";
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
  void locale;
  const curr = current !== null && current !== undefined && !Number.isNaN(current) ? current : null;
  const prev = previous !== null && previous !== undefined && !Number.isNaN(previous) ? previous : null;

  if (curr === null || prev === null || prev === 0) {
    return {
      current: curr,
      previous: prev,
      absoluteDelta: curr !== null && prev !== null ? Number((curr - prev).toFixed(2)) : null,
      percentageDelta: null,
      displayDelta: "Belum ada data di periode pembanding",
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
    displayDelta: `${sign}${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(pct)}%`,
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
    midPeriodChange = false,
    prevSpend,
    prevResults,
    prevCpr,
    locale = "id",
    entityStatus: rawEntityStatus,
    analysisScope = "ad",
    linkCtr: reportedLinkCtr,
  } = input;

  const loc = forceIndonesianLocale(locale);
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
  if (reportedCpr !== undefined && reportedCpr !== null && actualCpr !== null && actualCpr > 0) {
    const diff = Math.abs(reportedCpr - actualCpr) / actualCpr;
    if (diff > 0.1) {
      isDataCorrupt = true;
      corruptReason = loc === "en"
        ? `Reported CPR (${formatRupiah(reportedCpr)}) contradicts total spend / results ratio (${formatRupiah(actualCpr)}).`
        : `CPR yang dilaporkan (${formatRupiah(reportedCpr)}) tidak sesuai dengan rasio total belanja terhadap hasil tercatat (${formatRupiah(actualCpr)}).`;
    }
  }

  // 2. Assess Data Sufficiency Status (cukup, terbatas, tidak_valid)
  let dataStatus: DataSufficiencyStatus = "cukup";
  let dataStatusReason = "";

  if (isDataCorrupt || resultsCondition === "unavailable") {
    dataStatus = "tidak_valid";
    dataStatusReason = corruptReason || (resultsCondition === "unavailable"
      ? (loc === "en" ? "Results data could not be retrieved from Meta API." : "Data hasil tidak berhasil diperoleh dari Meta API.")
      : (loc === "en" ? "Meta result tracking needs review." : "Pencatatan hasil Meta perlu ditinjau."));
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
      performanceStatus = "belum_dapat_dinilai";
    }
  }

  // 4. Prescribe Proportional Action (pantau, periksa_tracking, optimasi, pertahankan, kurangi, hentikan_sementara)
  let action: DecisionAction = "pantau";
  let mainReason = "";

  if (dataStatus === "tidak_valid" || trackingStatus === "unverified" || trackingStatus === "unavailable") {
    action = "periksa_tracking";
    mainReason = corruptReason || (loc === "en"
      ? "Review the ad destination and Meta result settings before changing the budget."
      : "Periksa tracking tujuan tautan iklan dan pengaturan hasil Meta sebelum mengubah anggaran.");
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
        : `Tercatat ${results} hasil Meta. Lanjutkan pemantauan hingga terkumpul minimal 5 hasil sebelum optimasi.`;
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
          : `Belanja telah mencapai ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(riskToSpendRatio || 0)}x target CPR tanpa hasil Meta tercatat selama ${durationDays} hari. Jeda sementara untuk meninjau penawaran.`;
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
          ? `CPR (${formatRupiah(actualCpr)}) consistently exceeds target (${formatRupiah(effectiveTargetCpr)}) over ${durationDays} days. Reduce budget or rotate hook.`
          : `CPR (${formatRupiah(actualCpr)}) konsisten melampaui target (${formatRupiah(effectiveTargetCpr)}) selama ${durationDays} hari. Kurangi anggaran atau rotasi materi iklan.`;
      } else {
        action = "optimasi";
        mainReason = loc === "en"
          ? `Actual CPR exceeds target. Optimize lowest performing ad sets and creatives.`
          : `CPR aktual di atas target. Lakukan optimasi pada ad set atau materi dengan CPR tertinggi.`;
      }
    } else if (performanceStatus === "memenuhi_target") {
      action = "pertahankan";
      mainReason = loc === "en"
        ? `Performance meets target CPR (${formatRupiah(actualCpr || 0)}) with ${results} recorded results.`
        : effectiveTargetCpr
        ? `Biaya per hasil aktual ${formatRupiah(actualCpr || 0)} berhasil mencapai target yang ditetapkan (Target: ${formatRupiah(effectiveTargetCpr)}) dari total ${results} hasil tercatat.`
        : `Performa stabil dengan rata-rata Biaya per Hasil ${formatRupiah(actualCpr || 0)} dari total ${results} hasil tercatat (Target CPR belum ditetapkan).`;
    } else {
      action = "pantau";
      mainReason = loc === "en"
        ? "Metrics are stable; keep current delivery settings."
        : "Metrik stabil; pertahankan pengaturan penayangan saat ini.";
    }
  }

  const entityStatus = normalizeEntityStatus(rawEntityStatus);
  const paused = entityStatus === "PAUSED" || entityStatus === "ARCHIVED";
  const slaMet = meetsPerformanceSla(performanceStatus, actualCpr, effectiveTargetCpr);
  const doubleBurn = spentBeyondDoubleTarget(spend, effectiveTargetCpr, results);
  const noDelivery = spend === 0 && impressions === 0;
  let pausedScenario: "none" | "idle" | "efficient" | "inefficient" | "review" = "none";

  if (paused) {
    if (noDelivery) {
      pausedScenario = "idle";
      action = "pantau";
      mainReason = "Objek sedang dijeda dan tidak menyerap anggaran pada rentang tanggal ini. Pilih periode 7 atau 30 hari terakhir untuk mengaudit histori performa.";
    } else if (!effectiveTargetCpr) {
      pausedScenario = "review";
      action = "tinjau_reaktivasi";
      mainReason = "Objek sedang dijeda. Target CPR belum diatur, jadi histori tidak disebut sesuai target dan bukan perintah aktivasi. Anggaran harian tidak tersimpan di snapshot.";
    } else if (slaMet && (results ?? 0) >= 5 && durationDays >= 14 && dataStatus === "cukup") {
      pausedScenario = "efficient";
      action = "tinjau_reaktivasi";
      mainReason = "Histori biaya per hasil berada pada atau di bawah target. Ini hanya kelayakan peninjauan, bukan perintah menyalakan kembali dan bukan saran memakai anggaran lama.";
    } else {
      pausedScenario = "inefficient";
      action = "optimasi";
      mainReason = "Data historis menunjukkan biaya per hasil melampaui target atau belum menghasilkan konversi. Evaluasi ulang penawaran, materi kreatif, dan penargetan sebelum menayangkan kembali.";
    }
  } else if (durationDays <= 3 && action !== "periksa_tracking") {
    const structural = action === "hentikan_sementara" || action === "kurangi" || action === "optimasi" || action === "pertahankan";
    action = "pantau";
    if (doubleBurn || structural) {
      mainReason = doubleBurn
        ? (loc === "en"
          ? "1–3 day window with spend above 2x target CPR and no results. Monitor/investigate; do not make structural budget changes."
          : "Jendela 1–3 hari, belanja > 2x target CPR tanpa hasil. PANTAU/INVESTIGATE; jangan ubah struktur budget.")
        : (loc === "en"
          ? "1–3 day observation: keep MAINTAIN/MONITOR. Confidence is low until a 14-day window."
          : "Observasi 1–3 hari: gunakan MAINTAIN/PANTAU. Confidence LOW hingga jendela 14 hari.");
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
  const learningStatus = "Hanya berlaku pada level Ad Set yang sedang aktif tayang";

  const trackingStatusDisplay = "Meta Ads Insights (Snapshot Tersinkron)";

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

  if (pausedScenario === "idle") {
    headline = "Tidak ada penayangan aktif pada periode ini";
    subtext = mainReason;
  } else if (pausedScenario === "efficient") {
    headline = "Histori layak ditinjau, bukan perintah aktivasi";
    subtext = mainReason;
  } else if (pausedScenario === "review") {
    headline = "Objek dijeda dan target belum diatur";
    subtext = mainReason;
  } else if (pausedScenario === "inefficient") {
    headline = "Objek dijeda dengan histori efisiensi di bawah target";
    subtext = mainReason;
  } else if (action === "periksa_tracking") {
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

  if (pausedScenario === "idle") {
    nextActions.push({
      priority: "high",
      title: "Ubah rentang tanggal ke periode historis",
      why: "Periode yang dipilih tidak memiliki riwayat tayangan karena objek sedang dijeda.",
      do: "Ganti filter periode ke 7 Hari, 14 Hari, atau 30 Hari terakhir untuk melihat rekam jejak CPR dan CTR sebelum memutuskan aktivasi ulang.",
      stop_loss: "Jangan mengaktifkan kembali kampanye/iklan tanpa memeriksa histori biaya per hasil pada periode tayang sebelumnya.",
    });
  } else if (pausedScenario === "review") {
    nextActions.push({
      priority: "medium",
      title: "Tinjau histori tanpa menyalakan objek",
      why: "Target CPR belum diatur, jadi efisiensi dan stop-loss tidak dapat dihitung.",
      do: "Jangan menyalakan objek dari laporan ini. Anggaran harian tidak tersimpan di snapshot.",
      stop_loss: "Stop-loss numerik tidak dihitung karena target CPR belum diatur.",
    });
  } else if (pausedScenario === "inefficient") {
    nextActions.push({
      priority: "high",
      title: "Audit materi kreatif dan penawaran sebelum replikasi",
      why: "Riwayat penayangan sebelumnya belum mencapai target efisiensi biaya per hasil.",
      do: "Bandingkan biaya per hasil dengan target yang sudah diatur. Isi visual tidak ada pada laporan ini, jadi hook tidak dinilai.",
      stop_loss: "Batasi anggaran uji coba awal maksimal 1x–2x target CPR per hari saat menayangkan materi baru.",
    });
  } else if (pausedScenario === "efficient") {
    nextActions.push({
      priority: "medium",
      title: "Tinjau histori sebelum membahas aktivasi",
      why: effectiveTargetCpr
        ? "Rekam jejak biaya per hasil berada pada atau di bawah target yang dikonfigurasi."
        : "Target CPR belum diatur, jadi efisiensi tidak dapat dinyatakan.",
      do: "Jangan menyalakan objek dari laporan ini. Anggaran harian tidak tersimpan, jadi anggaran lama tidak disarankan.",
      stop_loss: effectiveTargetCpr
        ? "Jika nanti diuji manual, hentikan uji saat belanja melewati 2x target CPR tanpa hasil baru."
        : "Stop-loss numerik tidak dihitung karena target CPR belum diatur.",
    });
  } else if (action === "periksa_tracking") {
    nextActions.push({
      priority: "high",
      title: loc === "en" ? "Review the ad destination" : "Periksa tujuan tautan iklan",
      why: loc === "en" ? "A broken or incorrect destination can prevent interested people from continuing." : "Tautan yang salah atau tidak berfungsi dapat menghambat orang yang tertarik untuk melanjutkan.",
      do: loc === "en" ? "Open the ad destination from Meta Ads preview and confirm it works." : "Buka tujuan iklan dari pratinjau Meta Ads dan pastikan tautannya berfungsi.",
      stop_loss: loc === "en" ? "Fix the destination before increasing spend." : "Perbaiki tujuan iklan sebelum menambah belanja.",
    });
  } else if (action === "pantau") {
    nextActions.push({
      priority: "medium",
      title: loc === "en" ? "Accumulate delivery data" : "Akumulasi data penayangan",
      why: loc === "en" ? "Current data volume is below statistical stability threshold." : "Volume data saat ini masih di bawah ambang kestabilan statistik.",
      do: loc === "en" ? "Maintain existing budget for 3–5 days without editing creative." : "Pertahankan budget saat ini selama 3–5 hari tanpa mengubah materi.",
      stop_loss: effectiveTargetCpr
        ? (loc === "en" ? "Re-evaluate if spend reaches 2x target CPR with zero conversions." : "Evaluasi ulang jika belanja mencapai 2x target CPR tanpa hasil.")
        : (loc === "en" ? "A numeric stop-loss is unavailable because target CPR is not configured." : "Stop-loss numerik tidak dihitung karena target CPR belum diatur."),
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
      do: loc === "en" ? "Pause the test if the pattern holds. Creative content is not in this evidence." : "Jeda uji jika polanya bertahan. Isi creative tidak ada pada evidence ini.",
      stop_loss: loc === "en" ? "Only re-enable with refreshed creative angle." : "Aktifkan kembali hanya setelah sudut penawaran diperbarui.",
    });
  } else {
    const hasFrequency = typeof input.frequency === "number" && Number.isFinite(input.frequency) && input.frequency > 0;
    const linkCtr = impressions > 0 ? (linkClicks / impressions) * 100 : null;
    const stopLossCpr = actualCpr === null ? null : Math.round((actualCpr * 1.3) / 100) * 100;
    nextActions.push({
      priority: "medium",
      title: loc === "en" ? "Maintain stable budget" : "Pertahankan budget stabil",
      why: hasFrequency
        ? `${effectiveTargetCpr ? `CPR aktual ${formatRupiah(actualCpr || 0)} terkendali sesuai target` : `Target CPR belum ditetapkan; CPR aktual ${formatRupiah(actualCpr || 0)}`} dengan frekuensi ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(input.frequency!)}x ${input.frequency! < 2.5 ? "masih di bawah" : "telah mencapai atau melewati"} batas 2,5x.`
        : `${effectiveTargetCpr ? `Biaya per hasil aktual (${formatRupiah(actualCpr || 0)}) terkendali sesuai target` : `Target CPR belum ditetapkan; biaya per hasil aktual ${formatRupiah(actualCpr || 0)}`} dengan rasio klik tautan (CTR) ${linkCtr === null ? "yang belum dapat dihitung" : `sebesar ${formatIdPercent(linkCtr)}`}.`,
      do: loc === "en" ? "Monitor CPR daily to preserve current efficiency." : "Pantau CPR harian untuk menjaga efisiensi saat ini.",
      stop_loss: hasFrequency
        ? `Evaluasi ulang jika CPR melewati ${formatRupiah(stopLossCpr || 0)} (+30% dari CPR saat ini) atau frekuensi melampaui 2,5x.`
        : `Evaluasi ulang atau rotasi materi iklan jika Biaya per Hasil (CPR) melonjak melewati ${formatRupiah(stopLossCpr || 0)} (+30% dari CPR saat ini) atau CTR tautan turun di bawah 0,80%.`,
    });
  }

  if (input.analysisScope === "ad") {
    const ctrText = impressions > 0 ? formatIdPercent((linkClicks / impressions) * 100) : "tidak tersedia";
    uncertaintyNotes.push(`Diagnosis iklan: ${impressions} impresi, ${linkClicks} klik tautan, CTR ${ctrText}, hasil ${results ?? "null"}, CPR ${actualCpr === null ? "null" : formatRupiah(actualCpr)}. Creative, audience, dan placement tidak tersedia.`);
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
    entityStatus,
    analysisScope,
    periodConfidence: classifyPeriodConfidence(durationDays),
    scaleEligible: qualifiesForScaleVerdict({
      performanceStatus,
      dataStatus,
      results,
      targetCpr: effectiveTargetCpr,
      frequency: input.frequency,
      durationDays,
      entityStatus,
    }),
    causalDiagnostics: diagnoseCausalFriction({
      linkCtr: reportedLinkCtr ?? (impressions > 0 ? (linkClicks / impressions) * 100 : null),
      actualCpr,
      targetCpr: effectiveTargetCpr,
      results,
    }),
  };
}
