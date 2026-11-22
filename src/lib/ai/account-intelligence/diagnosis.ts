import type { AccountIntelligenceReport, AccountRecommendation } from "@/lib/ai/account-intelligence/engine";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface IntelligenceEvidence {
  metric: string;
  value: string | number;
  source: string;
}

export interface IntelligenceFinding {
  title: string;
  headline?: string;
  summaryShort?: string;
  category: "performance" | "comparison" | "creative" | "conversion" | "budget" | "status";
  severity: "critical" | "high" | "medium" | "low";
  certainty: "confirmed" | "hypothesis" | "unknown";
  observation: string;
  evidence: IntelligenceEvidence[];
  diagnosis: string;
  business_impact: string;
  limitations: string[];
}

export interface StrategicRecommendation {
  title: string;
  priority: AccountRecommendation["priority"];
  action_type: string;
  object_id: string;
  reason: string;
  evidence: string[];
  execution_steps: string[];
  expected_outcome: string;
  success_metrics: string[];
  evaluation_period: string;
  risks: string[];
  prerequisites: string[];
}

export interface AdvertisingIntelligence {
  executive_summary: string;
  executive_pulse?: string;
  confidence: {
    data: ConfidenceLevel;
    performance: ConfidenceLevel;
    decision: ConfidenceLevel;
    explanation: string;
  };
  key_findings: IntelligenceFinding[];
  opportunities: Array<{ title: string; opportunity: string; evidence: string[]; expected_impact: string; prerequisites: string[] }>;
  strategic_recommendations: StrategicRecommendation[];
  data_gaps: Array<{ field: string; importance: "high" | "medium" | "low"; impact_on_analysis: string }>;
  concentration: { campaign_name: string; share_pct: number; note: string } | null;
  creative_fatigue: {
    status: "META_EVENT_UNAVAILABLE" | "PERFORMANCE_INDICATION" | "INSUFFICIENT_EVIDENCE";
    note: string;
  };
}

function rupiah(value: number | null): string {
  if (value === null) return "null";
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

function compactRp(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (abs >= 1_000) return `Rp ${Math.round(value / 1_000).toLocaleString("id-ID")}rb`;
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function buildAdvertisingIntelligence(report: Omit<AccountIntelligenceReport, "intelligence">): AdvertisingIntelligence {
  const meta = report.analysis_metadata;
  const summary = report.account_summary;
  const findings: IntelligenceFinding[] = [];
  const top = report.budget_analysis.top_spending_campaign;
  const concentration = top && meta.campaigns_with_delivery >= 2 && top.share_pct >= 50
    ? {
        campaign_name: top.name,
        share_pct: top.share_pct,
        note: `${top.name} menyerap ${top.share_pct}% belanja periode. Konsentrasi bukan otomatis masalah. Risikonya adalah ketergantungan akun pada satu objek.`,
      }
    : null;

  if (meta.all_campaigns_paused) {
    findings.push({
      title: "Seluruh campaign yang teridentifikasi sedang dijeda",
      headline: "Nonaktif (Referensi Historis) · Tidak memerlukan tindakan operasional.",
      summaryShort: "Nonaktif (Referensi Historis) · Tidak memerlukan tindakan operasional.",
      category: "status",
      severity: "high",
      certainty: "confirmed",
      observation: "Tidak ada campaign aktif pada sinkronisasi terbaru.",
      evidence: [
        { metric: "paused_campaigns", value: summary.paused_campaigns, source: "campaign.status" },
        { metric: "effective_active_ads", value: meta.effective_active_ads, source: "effective status resolver" },
      ],
      diagnosis: "Angka periode adalah histori, bukan delivery yang sedang berjalan.",
      business_impact: "Tidak ada belanja baru yang bisa dioptimalkan sampai ada objek yang benar-benar aktif.",
      limitations: ["Alasan jeda di Ads Manager tidak tersimpan di snapshot."],
    });
  }

  if (!summary.results_comparable) {
    findings.push({
      title: "Hasil akun tidak sejenis",
      headline: "Multi-Objektif · Evaluasi CPR dipisahkan per jenis hasil.",
      summaryShort: "Multi-Objektif · Evaluasi CPR dipisahkan per jenis hasil.",
      category: "conversion",
      severity: "high",
      certainty: "confirmed",
      observation: "Campaign pada periode ini memakai jenis hasil yang berbeda.",
      evidence: [{ metric: "result_comparability", value: meta.result_comparability, source: "account engine" }],
      diagnosis: "Total hasil dan CPR akun tidak dijumlahkan.",
      business_impact: "Keputusan akun tidak boleh memakai satu CPR campuran.",
      limitations: [],
    });
  }

  if (report.campaign_rankings.some((item) => item.target.status === "TARGET_NOT_CONFIGURED")) {
    findings.push({
      title: "Sebagian target CPR belum diatur",
      headline: "Target CPR Belum Diisi · Atur target agar batas efisiensi aktif.",
      summaryShort: "Target CPR Belum Diisi · Atur target agar batas efisiensi aktif.",
      category: "performance",
      severity: "medium",
      certainty: "confirmed",
      observation: "Ada campaign tanpa target CPR.",
      evidence: [{ metric: "target_status", value: "TARGET_NOT_CONFIGURED", source: "target resolver" }],
      diagnosis: "Peringkat relatif tetap ada, tetapi tidak ada klaim sesuai target.",
      business_impact: "Stop-loss dan keputusan skala tidak punya ambang yang dikonfigurasi pengguna.",
      limitations: [],
    });
  }

  if (report.comparison.status === "COMPARISON_DATA_UNAVAILABLE") {
    findings.push({
      title: "Perbandingan periode tidak tersedia",
      headline: "Tanpa Pembanding Periode Lalu · Evaluasi berbasis target & peer saat ini.",
      summaryShort: "Tanpa Pembanding Periode Lalu · Evaluasi berbasis target & peer saat ini.",
      category: "comparison",
      severity: "low",
      certainty: "unknown",
      observation: "Tidak ada periode pembanding dengan durasi yang sama.",
      evidence: [{ metric: "comparison_status", value: "COMPARISON_DATA_UNAVAILABLE", source: "account engine" }],
      diagnosis: "Arah membaik atau memburuk tidak dapat disimpulkan.",
      business_impact: "Tren tidak dipakai sebagai dasar skala atau pemangkasan.",
      limitations: ["Persentase perubahan tidak dihitung."],
    });
  }

  if (concentration) {
    findings.push({
      title: "Belanja terkonsentrasi",
      headline: `Konsentrasi Anggaran · ${concentration.share_pct}% pada ${concentration.campaign_name} — Siapkan kampanye cadangan.`,
      summaryShort: `Konsentrasi Anggaran · ${concentration.share_pct}% pada ${concentration.campaign_name} — Siapkan kampanye cadangan.`,
      category: "budget",
      severity: "medium",
      certainty: "confirmed",
      observation: concentration.note,
      evidence: [
        { metric: "spend_share_pct", value: concentration.share_pct, source: "ad insight partition" },
        { metric: "campaign", value: concentration.campaign_name, source: "campaign ranking" },
      ],
      diagnosis: "Akun bergantung pada satu campaign untuk sebagian besar belanja periode.",
      business_impact: "Gangguan pada campaign itu mengubah hasil akun secara besar.",
      limitations: ["Anggaran yang dialokasikan tidak tersedia, jadi utilisasi budget tidak dihitung."],
    });
  }

    for (const wasted of report.budget_analysis.wasted_spend_campaigns.slice(0, 2)) {
    if (wasted.spend == null) continue;
    findings.push({
      title: `${wasted.name} berbelanja tanpa hasil`,
      headline: `Spend Tanpa Hasil · ${compactRp(wasted.spend)} (0 konversi) pada ${wasted.name} — Hentikan penayangan.`,
      summaryShort: `Spend Tanpa Hasil · ${compactRp(wasted.spend)} (0 konversi) — Hentikan penayangan.`,
      category: "performance",
      severity: "high",
      certainty: "confirmed",
      observation: `${wasted.name} menghabiskan ${rupiah(wasted.spend)} dengan hasil ${wasted.results ?? 0}.`,
      evidence: [
        { metric: "spend", value: wasted.spend, source: "period insights" },
        { metric: "results", value: wasted.results ?? 0, source: "primary result" },
      ],
      diagnosis: "CPR tidak dihitung karena hasil nol. Pola ini perlu ditinjau terhadap jenis hasil campaign tersebut.",
      business_impact: "Belanja periode tidak menghasilkan jenis hasil yang dipilih.",
      limitations: ["Hasil di luar jenis utama campaign tidak digabung ke angka ini."],
    });
  }

  /**
   * SAFEGUARD 3A & AUDIT PATCH 2 — Creative Bottleneck (Golden Offer) Detection:
   * Rule: link_ctr < 0.8% AND CVR > 20% AND link_clicks >= 30 AND CPR <= Target.
   * Protects profitable high-CVR campaigns from being penalized, while enforcing
   * a strict link_clicks >= 30 denominator floor to eliminate micro-sample noise.
   */
  const goldenOfferEntity = [...report.campaign_rankings, ...report.ad_rankings].find((item) => {
    const ctr = item.ctr;
    const linkClicks = item.linkClicks ?? 0;
    const cvr =
      item.cvr !== undefined && item.cvr !== null
        ? item.cvr
        : linkClicks > 0 && item.results !== null
        ? Number(((item.results / linkClicks) * 100).toFixed(2))
        : null;
    const isProfitableCpr =
      item.cpr !== null &&
      item.cpr > 0 &&
      (item.target.value !== null ? item.cpr <= item.target.value : (item.results ?? 0) >= 5);
    return (
      ctr !== null &&
      ctr < 0.8 &&
      cvr !== null &&
      cvr >= 20 &&
      linkClicks >= 30 &&
      isProfitableCpr
    );
  });

  if (goldenOfferEntity) {
    const resolvedCvr =
      goldenOfferEntity.cvr ??
      (goldenOfferEntity.linkClicks && goldenOfferEntity.results !== null
        ? Number(((goldenOfferEntity.results / goldenOfferEntity.linkClicks) * 100).toFixed(2))
        : 0);
    findings.push({
      title: `Creative Bottleneck (Golden Offer): ${goldenOfferEntity.name}`,
      headline: `Konversi Tinggi, CTR Rendah · CTR ${fmtPct(goldenOfferEntity.ctr)} / CVR ${fmtPct(resolvedCvr)} — Pertahankan penawaran, uji variasi hook visual.`,
      summaryShort: `Konversi Tinggi, CTR Rendah · CTR ${fmtPct(goldenOfferEntity.ctr)} / CVR ${fmtPct(resolvedCvr)} — Pertahankan penawaran, uji variasi hook visual.`,
      category: "creative",
      severity: "medium",
      certainty: "confirmed",
      observation: `${goldenOfferEntity.name} mencatat CTR tautan rendah (${goldenOfferEntity.ctr}%), tetapi CVR konversi sangat tinggi (${resolvedCvr}%) dengan CPR efisien (${rupiah(goldenOfferEntity.cpr)}).`,
      evidence: [
        { metric: "link_ctr", value: goldenOfferEntity.ctr ?? "null", source: "entity ranking" },
        { metric: "cvr_pct", value: resolvedCvr, source: "results / link_clicks" },
        { metric: "cpr", value: goldenOfferEntity.cpr ?? "null", source: "entity ranking" },
      ],
      diagnosis:
        "Penawaran (Offer/CVR) sangat kuat, tetapi materi visual gagal menarik klik. Jangan matikan kampanye ini. Duplikasi dan ganti hook visual/video.",
      business_impact:
        "Potensi skala konversi sangat besar apabila daya tarik visual (hook) ditingkatkan tanpa mengubah penawaran inti.",
      limitations: ["Variasi hook visual baru tetap perlu diuji terpisah agar algoritma kampanye asli tidak terganggu."],
    });
  } else if (summary.average_ctr !== null && summary.average_ctr < 0.8 && summary.total_impressions != null && summary.total_impressions >= 1000) {
    findings.push({
      title: "CTR tautan akun rendah",
      headline: `CTR Akun Rendah (Hipotesis) · CTR ${fmtPct(summary.average_ctr)} — Uji variasi hook visual atau penawaran.`,
      summaryShort: `CTR Akun Rendah (Hipotesis) · CTR ${fmtPct(summary.average_ctr)} — Uji variasi hook visual atau penawaran.`,
      category: "creative",
      severity: "medium",
      certainty: "hypothesis",
      observation: `CTR tautan akun ${summary.average_ctr}% dari ${summary.total_impressions} impresi.`,
      evidence: [{ metric: "link_ctr", value: summary.average_ctr, source: "ad insight aggregate" }],
      diagnosis: "Respons klik perlu dibandingkan dengan iklan sejenis. Creative, penawaran, audiens, atau placement sama-sama mungkin.",
      business_impact: "Biaya per klik dan volume hasil bisa tertekan, tetapi komponen penyebabnya belum terpisah.",
      limitations: ["Asset visual, headline, audience, dan placement tidak dikirim ke diagnosis ini."],
    });
  }

  /**
   * SAFEGUARD 3B — Traffic Leak (Clickbait) Detection:
   * IF (link_ctr > 1.5% AND CVR < 2% AND Spend >= Rp 100,000) OR (link_ctr >= 1.2% AND Results === 0 AND Spend >= Rp 100,000):
   * Flags high-CTR ads that fail to convert post-click traffic.
   */
  const trafficLeakEntity = [...report.ad_rankings, ...report.campaign_rankings].find((item) => {
    const ctr = item.ctr;
    const cvr =
      item.cvr !== undefined && item.cvr !== null
        ? item.cvr
        : item.linkClicks && item.linkClicks > 0 && item.results !== null
        ? Number(((item.results / item.linkClicks) * 100).toFixed(2))
        : item.results === 0
        ? 0
        : null;
    return (
      item.spend != null &&
      item.spend >= 100_000 &&
      ctr != null &&
      ((ctr > 1.5 && cvr != null && cvr < 2) || (ctr >= 1.2 && (item.results ?? 0) === 0))
    );
  });

  if (trafficLeakEntity) {
    const resolvedCvr =
      trafficLeakEntity.cvr ??
      (trafficLeakEntity.linkClicks && trafficLeakEntity.results !== null
        ? Number(((trafficLeakEntity.results / trafficLeakEntity.linkClicks) * 100).toFixed(2))
        : 0);
    findings.push({
      title: `${trafficLeakEntity.name} mendapat klik tanpa hasil (Traffic Leak)`,
      headline: `Drop-off Pasca-Klik · CTR ${fmtPct(trafficLeakEntity.ctr)} / CVR ${fmtPct(resolvedCvr)} — Evaluasi kesesuaian pesan iklan dengan halaman tujuan/WhatsApp.`,
      summaryShort: `Drop-off Pasca-Klik · CTR ${fmtPct(trafficLeakEntity.ctr)} / CVR ${fmtPct(resolvedCvr)} — Evaluasi kesesuaian pesan iklan dengan halaman tujuan/WhatsApp.`,
      category: "conversion",
      severity: "high",
      certainty: "hypothesis",
      observation: `${trafficLeakEntity.name} punya CTR ${trafficLeakEntity.ctr}%, CVR ${resolvedCvr}%, dan hasil ${trafficLeakEntity.results ?? 0} pada belanja ${rupiah(trafficLeakEntity.spend)}.`,
      evidence: [
        { metric: "link_ctr", value: trafficLeakEntity.ctr ?? "null", source: "entity ranking" },
        { metric: "cvr_pct", value: resolvedCvr, source: "results / link_clicks" },
        { metric: "results", value: trafficLeakEntity.results ?? 0, source: "primary result" },
      ],
      diagnosis:
        "Iklan bersifat clickbait. Banyak klik tetapi audiens langsung keluar dari Landing Page/WhatsApp. Periksa relevansi janji iklan dengan penawaran asli.",
      business_impact: "Belanja menghasilkan traffic yang belum menjadi hasil utama.",
      limitations: ["Landing page view dan CRM tidak tersedia pada laporan ini."],
    });
  }

  const frequencies = report.ad_rankings.filter((item) => item.frequency !== null && item.ctr !== null);
  const ctrMedian = median(frequencies.map((item) => item.ctr as number));
  const fatigued = frequencies.find((item) => (item.frequency as number) >= 2.5 && ctrMedian !== null && (item.ctr as number) < ctrMedian);
  const creative_fatigue = fatigued
    ? {
        status: "PERFORMANCE_INDICATION" as const,
        note: `${fatigued.name} punya frekuensi ${fatigued.frequency} dan CTR di bawah median iklan yang dibandingkan. Ini indikasi performa, bukan notifikasi creative fatigue dari Meta.`,
      }
    : {
        status: "INSUFFICIENT_EVIDENCE" as const,
        note: "Frekuensi dan CTR yang cukup untuk indikasi fatigue tidak tersedia, dan event creative_fatigue Meta tidak ada di snapshot.",
      };

  if (fatigued) {
    findings.push({
      title: "Indikasi fatigue berbasis performa",
      headline: `Indikasi Jenuh · Frekuensi ${fatigued.frequency}x / CTR ${fmtPct(fatigued.ctr)} → Siapkan materi visual segar.`,
      summaryShort: `Indikasi Jenuh · Frekuensi ${fatigued.frequency}x / CTR ${fmtPct(fatigued.ctr)} → Siapkan materi visual segar.`,
      category: "creative",
      severity: "medium",
      certainty: "hypothesis",
      observation: creative_fatigue.note,
      evidence: [
        { metric: "frequency", value: fatigued.frequency ?? "null", source: "single-day reach" },
        { metric: "link_ctr", value: fatigued.ctr ?? "null", source: "ad ranking" },
      ],
      diagnosis: "Pola frekuensi naik dan CTR relatif rendah perlu dicek pada jendela harian. Bukan fakta bahwa materi sudah lelah.",
      business_impact: "Penayangan berulang dapat menekan respons, jika polanya bertahan.",
      limitations: ["Event resmi Meta creative_fatigue tidak tersimpan."],
    });
  }

  const dataGaps: AdvertisingIntelligence["data_gaps"] = [
    {
      field: "crm_funnel",
      importance: "high",
      impact_on_analysis: "Data kualifikasi prospek hilir (CRM Hot/Warm/Cold) tidak terhubung langsung ke peringkat objek akun.",
    },
  ];
  if (report.comparison.status === "COMPARISON_DATA_UNAVAILABLE") {
    dataGaps.push({
      field: "previous_period",
      importance: "medium",
      impact_on_analysis: "Periode pembanding dengan durasi yang sama tidak ada, jadi perubahan antarperiode tidak dihitung.",
    });
  }

  const sourceRecs = [...report.recommendations, ...report.historical_reviews].slice(0, 5);
  const strategic_recommendations: StrategicRecommendation[] = sourceRecs.map((item) => ({
    title: `${item.action} · ${item.objectName}`,
    priority: item.priority,
    action_type: item.action,
    object_id: item.objectId,
    reason: item.reason,
    evidence: [
      `status efektif ${item.currentStatus}`,
      `belanja ${rupiah(item.spend)}`,
      `hasil ${item.results ?? "null"}`,
      `CPR ${rupiah(item.cpr)}`,
      `target ${item.targetStatus}`,
    ],
    execution_steps: [
      item.recommendedAction,
      "Jangan mengubah status atau anggaran di Meta dari laporan ini.",
      item.action === "REACTIVATION_CANDIDATE"
        ? "Validasi budget, jenis hasil, dan kondisi bisnis sebelum membahas aktivasi."
        : "Ukur ulang pada jendela evaluasi sebelum tindakan berikutnya.",
    ],
    expected_outcome: item.expectedImpact,
    success_metrics: item.cpr !== null ? ["CPR jenis hasil yang sama", "volume hasil", "belanja periode"] : ["volume hasil", "belanja periode"],
    evaluation_period: meta.long_period_warning ? "7, 14, atau 30 hari" : "7 sampai 14 hari berikutnya",
    risks: [item.risk === "high" ? "Risiko pemborosan atau keputusan yang tidak stabil." : item.monitoring],
    prerequisites: [
      item.targetStatus === "TARGET_NOT_CONFIGURED" ? "Atur target CPR sebelum klaim efisiensi." : "Target objek sudah tersedia.",
      item.currentStatus === "PAUSED" ? "Objek tidak sedang delivery." : "Status efektif mendukung tindakan operasional.",
    ],
  }));

  const activeCount = report.campaign_rankings.filter((item) => item.effectiveStatus === "ACTIVE").length;
  const performance: ConfidenceLevel = summary.total_impressions != null && summary.total_impressions >= 1000 && (summary.total_results ?? 0) >= 5 && summary.results_comparable
    ? "high"
    : meta.campaigns_with_delivery > 0
      ? "medium"
      : "low";
  const decision: ConfidenceLevel = meta.all_campaigns_paused || !summary.results_comparable || meta.long_period_warning || activeCount === 0
    ? "low"
    : report.campaign_rankings.every((item) => item.target.status !== "TARGET_NOT_CONFIGURED")
      ? "medium"
      : "low";

  const executive_summary = [
    `Periode ${meta.period_start} sampai ${meta.period_end}. Belanja akun ${rupiah(summary.total_spend)}.`,
    summary.results_comparable
      ? `Hasil sejenis ${summary.total_results ?? "null"} dengan CPR ${rupiah(summary.blended_cpr)}.`
      : "Hasil tidak sejenis, jadi CPR akun tidak dihitung.",
    `Iklan efektif aktif: ${meta.effective_active_ads}. Iklan efektif dijeda: ${meta.effective_paused_ads}.`,
    findings[0] ? findings[0].observation : "Belum ada temuan tambahan di luar ringkasan metrik.",
  ].join(" ");

  const hc = summary.health_counts;
  const executive_pulse = meta.all_campaigns_paused
    ? "Nonaktif (Referensi Historis) · Tidak memerlukan tindakan operasional."
    : !summary.results_comparable
      ? "Multi-Objektif · Evaluasi CPR dipisahkan per jenis hasil."
      : `${compactRp(summary.total_spend)} · ${summary.total_results ?? 0} hasil @ ${compactRp(summary.blended_cpr)} — ${
          hc
            ? `${hc.scaleCount} Efisien · ${hc.optimizeCount} Optimasi · ${hc.wasteCount} Kritis · ${hc.holdCount} Observasi`
            : "Pantau performa aktif"
        }.`;

  return {
    executive_summary,
    executive_pulse,
    confidence: {
      data: meta.data_confidence,
      performance,
      decision,
      explanation: `Keyakinan data mengikuti kelengkapan snapshot (${meta.data_confidence}). Keyakinan performa ${performance} karena volume dan kesebandingan hasil. Keyakinan keputusan ${decision} karena status operasional, target, dan panjang periode.`,
    },
    key_findings: findings.slice(0, 6),
    opportunities: report.key_insights.slice(0, 3).map((item) => ({
      title: item.object_name || "Peluang akun",
      opportunity: item.text,
      evidence: [item.object_id || "account"],
      expected_impact: "Dampak tidak dihitung sebagai proyeksi. Ukuran keberhasilannya adalah CPR dan volume jenis hasil yang sama.",
      prerequisites: ["Jenis hasil tetap sama.", "Tidak ada perubahan status otomatis."],
    })),
    strategic_recommendations,
    data_gaps: dataGaps,
    concentration,
    creative_fatigue,
  };
}
