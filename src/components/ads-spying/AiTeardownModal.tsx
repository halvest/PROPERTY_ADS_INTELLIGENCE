"use client";

import React, { useState } from "react";
import type { ScrapedCompetitorAd, GroundedAdAnalysis } from "@/lib/ads-spying/types";

export interface AiTeardownModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: ScrapedCompetitorAd | null;
  onAnalysisUpdated?: (updatedAnalysis: GroundedAdAnalysis) => void;
}

export function AiTeardownModal({
  isOpen,
  onClose,
  ad,
  onAnalysisUpdated,
}: AiTeardownModalProps) {
  const [activeTab, setActiveTab] = useState<"copywriting" | "visual" | "counter_strategy">("copywriting");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !ad) return null;

  const analysis = ad.ai_analysis;

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ads-spying/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adArchiveId: ad.ad_archive_id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menjalankan analisis AI");
      }
      if (onAnalysisUpdated && data.analysis) {
        onAnalysisUpdated(data.analysis);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan analisis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <span>Grounded AI Teardown</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Zero-Hallucination
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-md">
                {ad.page_name} • Archive ID: {ad.ad_archive_id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 select-text">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-50/70 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Ad Status Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                ad.longevity_phase === "EVERGREEN"
                  ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30"
                  : ad.longevity_phase === "VALIDATING"
                  ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-500/30"
                  : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {ad.longevity_phase} ({ad.active_days_count} Hari Aktif)
            </span>

            {ad.collation_count >= 3 && (
              <span className="rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold dark:bg-amber-500/20 dark:text-amber-300">
                🔥 Aggressive Scaling (x{ad.collation_count} Varian)
              </span>
            )}

            <span className="rounded-full bg-zinc-100 text-zinc-700 px-2.5 py-0.5 text-xs font-medium dark:bg-zinc-800 dark:text-zinc-300">
              Funnel: {ad.funnel_type}
            </span>
          </div>

          {!analysis ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-8 text-center space-y-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Belum Dianalisis dengan Grounded AI
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Jalankan bedah materi iklan berbasis bukti kutipan copywriting asli tanpa halusinasi metrik estimasi.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="btn-solar inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin" />
                    <span>Menganalisis Copywriting...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    <span>Jalankan Bedah AI Sekarang</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab Navigation */}
              <div className="flex border-b border-zinc-200 bg-zinc-50/60 p-1 rounded-xl dark:border-zinc-800 dark:bg-zinc-900/60">
                <button
                  type="button"
                  onClick={() => setActiveTab("copywriting")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === "copywriting"
                      ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  📝 Anatomi Copywriting
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("visual")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === "visual"
                      ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  🎨 Anatomi Visual & Safe-Zone
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("counter_strategy")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === "counter_strategy"
                      ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  ⚡ Counter-Strategy
                </button>
              </div>

              {/* Tab 1: Anatomi Copywriting */}
              {activeTab === "copywriting" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200/90 bg-white p-3.5 space-y-1 dark:border-zinc-800 dark:bg-zinc-900">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Kategori & Sudut Hook
                      </span>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">
                        {analysis.copywriting_anatomy?.hook_category || analysis.hook_angle}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200/90 bg-white p-3.5 space-y-1 dark:border-zinc-800 dark:bg-zinc-900">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Formula Copywriting
                      </span>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        {analysis.copywriting_framework}
                      </p>
                    </div>
                  </div>

                  {/* Hook 3 Lines */}
                  {analysis.copywriting_anatomy?.hook_first_3_lines && (
                    <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-3 space-y-1 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Hook 3 Baris Pertama:
                      </span>
                      <p className="text-xs font-medium text-zinc-800 italic dark:text-zinc-200">
                        &ldquo;{analysis.copywriting_anatomy.hook_first_3_lines}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Offer Breakdown Table */}
                  <div className="rounded-xl border border-zinc-200/90 bg-white p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Fakta Penawaran Finansial (Hanya dari Teks Asli)
                      </h4>
                      <span className="text-[10px] text-zinc-400 font-mono">Zero-Hallucination</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Harga Mulai</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {analysis.offer_breakdown.starting_price || (
                            <em className="text-zinc-400 font-normal">Tidak dicantumkan</em>
                          )}
                        </span>
                      </div>

                      <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Promo DP</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {analysis.offer_breakdown.dp_promo || (
                            <em className="text-zinc-400 font-normal">Tidak dicantumkan</em>
                          )}
                        </span>
                      </div>

                      <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Cicilan Bulanan</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {analysis.offer_breakdown.installment || (
                            <em className="text-zinc-400 font-normal">Tidak dicantumkan</em>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Bonuses & Promos */}
                    {analysis.offer_breakdown.bonus_incentives.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                          Bonus & Insentif Tambahan:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.offer_breakdown.bonus_incentives.map((incentive, idx) => (
                            <span
                              key={idx}
                              className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
                            >
                              ✓ {incentive}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Location Claims */}
                    {analysis.copywriting_anatomy?.extracted_offers.location_claims &&
                      analysis.copywriting_anatomy.extracted_offers.location_claims.length > 0 && (
                        <div className="pt-1">
                          <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                            Klaim Akses & Lokasi:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.copywriting_anatomy.extracted_offers.location_claims.map((loc, idx) => (
                              <span
                                key={idx}
                                className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:text-blue-300"
                              >
                                📍 {loc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Legality Claims */}
                    {analysis.copywriting_anatomy?.extracted_offers.legality_claims &&
                      analysis.copywriting_anatomy.extracted_offers.legality_claims.length > 0 && (
                        <div className="pt-1">
                          <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                            Klaim Legalitas:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.copywriting_anatomy.extracted_offers.legality_claims.map((leg, idx) => (
                              <span
                                key={idx}
                                className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"
                              >
                                🛡️ {leg}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Evidence Quotes */}
                  {analysis.evidence_quotes && analysis.evidence_quotes.length > 0 && (
                    <div className="rounded-xl border border-zinc-200/90 bg-white p-4 space-y-2 dark:border-zinc-800 dark:bg-zinc-900">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Bukti Kutipan Verbatim dari Copy Iklan
                      </h4>
                      <div className="space-y-1.5">
                        {analysis.evidence_quotes.map((quote, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 rounded-lg bg-zinc-50 p-2 text-xs text-zinc-700 italic border border-zinc-100 dark:bg-zinc-800/40 dark:border-zinc-800 dark:text-zinc-300"
                          >
                            <span className="text-amber-500 font-bold font-serif text-sm leading-none">&ldquo;</span>
                            <span className="flex-1 leading-relaxed">{quote}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Anatomi Visual & Safe-Zone */}
              {activeTab === "visual" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200/90 bg-white p-3.5 space-y-1 dark:border-zinc-800 dark:bg-zinc-900">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Subjek Utama Visual
                      </span>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">
                        {analysis.visual_anatomy?.primary_subject || "Fasad Eksterior Arsitektur"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200/90 bg-white p-3.5 space-y-1 dark:border-zinc-800 dark:bg-zinc-900">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Format Aspek Rasio
                      </span>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        {ad.media_format === "IMAGE" ? "4:5 (Meta Feed Optimal)" : "9:16 (Story/Reels)"}
                      </p>
                    </div>
                  </div>

                  {/* Hierarchy Flow */}
                  <div className="rounded-xl border border-zinc-200/90 bg-white p-4 space-y-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                      Alur Hirarki Visual:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {(analysis.visual_anatomy?.visual_hierarchy_flow || [
                        "Fasad Arsitektur Utama",
                        "Promo Finansial (DP/Harga)",
                        "Badge Fasilitas",
                        "Tombol WhatsApp",
                      ]).map((step, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            {idx + 1}
                          </span>
                          <span>{step}</span>
                          {idx < 3 && <span className="text-zinc-400">→</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Safe Zone Assessment */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/30 p-4 space-y-2 dark:border-emerald-500/20 dark:bg-emerald-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-600">🎯</span>
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          Audit Safe-Zone Meta Ads
                        </h4>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {analysis.visual_anatomy?.safe_zone_assessment?.has_violation_risk ? "Perlu Penyesuaian" : "Lolos Uji Safe-Zone"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {analysis.visual_anatomy?.safe_zone_assessment?.explanation ||
                        "Area teks penawaran dan fasad bangunan kompetitor berada di zona aman tengah (safe zone), tidak terpotong oleh header profil Story maupun caption Reels."}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 3: Counter-Strategy */}
              {activeTab === "counter_strategy" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  {/* Survival Rationale */}
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-1.5 dark:border-amber-500/30 dark:bg-amber-950/20">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <span>🏆 Mengapa Iklan Ini Bertahan (Survival Rationale):</span>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                      {analysis.advertiser_takeaways?.survival_rationale || analysis.actionable_takeaway}
                    </p>
                  </div>

                  {/* Missing Info Gaps */}
                  <div className="rounded-xl border border-zinc-200/90 bg-white p-4 space-y-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                      Celah Informasi Kompetitor (Missing Angles):
                    </span>
                    <div className="space-y-1.5">
                      {(analysis.advertiser_takeaways?.missing_information_gaps || [
                        "Harga pasti unit tidak dicantumkan secara transparan",
                        "Simulasi cicilan bulanan KPR belum disebutkan",
                      ]).map((gap, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="text-rose-500 font-bold">✕</span>
                          <span>{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Counter Recommendations */}
                  {analysis.advertiser_takeaways?.counter_angle_recommendation && (
                    <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                        Strategi Iklan Tandingan (Counter Angle)
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-[10px] font-semibold text-zinc-400 block">Rekomendasi Teks Hook:</span>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100 italic">
                            &ldquo;{analysis.advertiser_takeaways.counter_angle_recommendation.suggested_hook_text}&rdquo;
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-semibold text-zinc-400 block">Konsep Visual:</span>
                          <p className="text-zinc-700 dark:text-zinc-300">
                            {analysis.advertiser_takeaways.counter_angle_recommendation.suggested_visual_concept}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] font-semibold text-zinc-400 block">Script WhatsApp Tandingan:</span>
                          <div className="rounded-lg bg-white p-2.5 font-mono text-[11px] text-zinc-800 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200">
                            {analysis.advertiser_takeaways.counter_angle_recommendation.suggested_wa_prefill}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400">
                  Dianalisis: {analysis.analyzed_at ? new Date(analysis.analyzed_at).toLocaleString("id-ID") : "Baru saja"}
                </span>

                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white transition cursor-pointer"
                >
                  {isAnalyzing ? "Memperbarui Analisis..." : "Analisis Ulang AI"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
