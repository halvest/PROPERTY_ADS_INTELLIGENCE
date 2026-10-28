"use client";

import React, { useState, useMemo } from "react";
import type {
  AdOptimizationRecommendation,
  RecommendationCategory,
} from "@/domain/recommendations/types";
import { updateRecommendationStatus } from "@/lib/data/dashboard-service";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface AdOptimizationRecommendationsProps {
  recommendations: AdOptimizationRecommendation[];
  onRefresh?: () => void;
}

export function AdOptimizationRecommendations({
  recommendations: initialRecommendations,
  onRefresh,
}: AdOptimizationRecommendationsProps) {
  const { addToast } = useToast();
  const { t, formatCurrency, formatDateTime, locale } = useI18n();
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { status: "reviewed" | "dismissed"; reviewedBy: string; reviewedAt: string }>
  >({});
  const [categoryFilter, setCategoryFilter] = useState<"all" | RecommendationCategory>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  const recommendations = useMemo(() => {
    return initialRecommendations.map((rec) => {
      const override = localOverrides[rec.id];
      if (override) {
        return {
          ...rec,
          status: override.status,
          reviewedBy: override.reviewedBy,
          reviewedAt: override.reviewedAt,
        };
      }
      return rec;
    });
  }, [initialRecommendations, localOverrides]);

  const filtered = useMemo(() => {
    return categoryFilter === "all"
      ? recommendations
      : recommendations.filter((r) => r.category === categoryFilter);
  }, [recommendations, categoryFilter]);

  const handleAction = async (id: string, status: "reviewed" | "dismissed") => {
    const target = initialRecommendations.find((r) => r.id === id);
    const adName = target?.adName || (locale === "id" ? "Iklan" : "Ad");
    const note = status === "reviewed"
      ? (locale === "id" ? "Telah ditinjau dan divalidasi" : "Reviewed and validated")
      : (locale === "id" ? "Diabaikan oleh pengguna" : "Dismissed by user");

    setLoadingActionId(id);

    try {
      const res = await fetch("/api/recommendations/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: id, status, note }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        const serverReview = data.review;
        const reviewedBy = serverReview?.reviewerName || (locale === "id" ? "Staf Pemasaran Terautentikasi" : "Authenticated Staff");
        const reviewedAt = serverReview?.updatedAt || new Date().toISOString();

        setLocalOverrides((prev) => ({
          ...prev,
          [id]: { status, reviewedBy, reviewedAt },
        }));

        addToast(
          "success",
          locale === "id" ? "Rekomendasi Diperbarui" : "Recommendation Updated",
          locale === "id"
            ? `Rekomendasi "${adName}" berhasil disimpan sebagai ${status === "reviewed" ? "Ditinjau" : "Diabaikan"}.`
            : `Recommendation "${adName}" saved as ${status === "reviewed" ? "Reviewed" : "Dismissed"}.`
        );

        if (onRefresh) onRefresh();
        return;
      }

      // If unauthenticated (demo/preview user), safely update mock store and inform user
      if (res.status === 401 || res.status === 403) {
        const actorName = locale === "id" ? "Supervisor Demo (Sesi Lokal)" : "Demo Supervisor (Local Session)";
        updateRecommendationStatus({
          recommendationId: id,
          status,
          actorName,
          note,
        });
        setLocalOverrides((prev) => ({
          ...prev,
          [id]: { status, reviewedBy: actorName, reviewedAt: new Date().toISOString() },
        }));

        addToast(
          "info",
          locale === "id" ? "Sesi Demo Diperbarui" : "Demo Session Updated",
          locale === "id"
            ? `Status "${adName}" diperbarui di memori lokal. Login Supabase diperlukan untuk persistensi basis data.`
            : `Status of "${adName}" updated in local state. Sign in required for database persistence.`
        );

        if (onRefresh) onRefresh();
        return;
      }

      // Explicit database or validation failure
      addToast(
        "error",
        locale === "id" ? "Gagal Menyimpan" : "Failed to Save",
        data.error || (locale === "id" ? "Terjadi kesalahan pada basis data." : "Database error occurred.")
      );
    } catch {
      // Offline / network fallback
      const actorName = locale === "id" ? "Pengguna Offline (Sesi Lokal)" : "Offline User (Local Session)";
      updateRecommendationStatus({
        recommendationId: id,
        status,
        actorName,
        note,
      });
      setLocalOverrides((prev) => ({
        ...prev,
        [id]: { status, reviewedBy: actorName, reviewedAt: new Date().toISOString() },
      }));

      addToast(
        "warning",
        locale === "id" ? "Disimpan Offline" : "Saved Offline",
        locale === "id"
          ? "Perubahan disimpan sementara secara lokal karena koneksi jaringan terputus."
          : "Changes saved locally due to network interruption."
      );

      if (onRefresh) onRefresh();
    } finally {
      setLoadingActionId(null);
    }
  };

  const getBadgeStyle = (category: RecommendationCategory) => {
    switch (category) {
      case "scale_candidate":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60";
      case "investigate":
        return "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60";
      case "hold":
        return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60";
      case "insufficient_data":
      default:
        return "bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
    }
  };

  const getCategoryLabel = (category: RecommendationCategory) => {
    switch (category) {
      case "scale_candidate":
        return locale === "id" ? "Scale Candidate (Evaluasi Manual)" : "Scale Candidate (Manual Eval)";
      case "investigate":
        return locale === "id" ? "Investigate (Pemeriksaan)" : "Investigate (Action Required)";
      case "hold":
        return locale === "id" ? "Hold (Pantau)" : "Hold (Monitor)";
      case "insufficient_data":
        return locale === "id" ? "Insufficient Data (Data Kurang)" : "Insufficient Data";
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              {locale === "id" ? "Rekomendasi Optimasi Iklan Deterministik" : "Deterministic Ad Optimization Engine"}
            </h2>
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60 font-mono">
              Rule-Based • No LLM
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {locale === "id"
              ? "Saran penyesuaian anggaran iklan berbasis pembuktian mutu lead, CPQL, dan tingkat verifikasi atribusi."
              : "Budget adjustment recommendations based on verified lead quality, CPQL, and attribution integrity."}
          </p>
        </div>

        {/* Demo/Live Pill */}
        <div className="shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t.common.demoMode}
          </span>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-zinc-400 dark:text-zinc-500 mr-1 text-[11px] font-medium">
          {locale === "id" ? "Kategori:" : "Category:"}
        </span>
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
            categoryFilter === "all"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          {t.common.all} ({recommendations.length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("scale_candidate")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
            categoryFilter === "scale_candidate"
              ? "bg-emerald-700 text-white dark:bg-emerald-600"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          Scale Candidate
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("investigate")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
            categoryFilter === "investigate"
              ? "bg-rose-700 text-white dark:bg-rose-600"
              : "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          Investigate
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("hold")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
            categoryFilter === "hold"
              ? "bg-amber-700 text-white dark:bg-amber-600"
              : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
          }`}
        >
          Hold
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("insufficient_data")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
            categoryFilter === "insufficient_data"
              ? "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          Insufficient Data
        </button>
      </div>

      {/* Recommendations Cards List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
            {locale === "id" ? "Tidak ada rekomendasi dalam kategori yang dipilih." : "No recommendations in the selected category."}
          </div>
        ) : (
          filtered.map((rec) => {
            const isExpanded = expandedId === rec.id;
            const metrics = rec.supportingMetrics;
            const isLoading = loadingActionId === rec.id;

            return (
              <div
                key={rec.id}
                className="rounded-lg border border-zinc-200/90 bg-zinc-50/50 p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/30 dark:hover:border-zinc-700"
              >
                {/* Card Top: Badges & Ad Name */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${getBadgeStyle(
                          rec.category
                        )}`}
                      >
                        {getCategoryLabel(rec.category)}
                      </span>
                      {rec.status !== "active" && (
                        <span className="inline-flex items-center gap-1 rounded bg-zinc-200/80 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                          {rec.status === "reviewed" ? (
                            <>
                              <svg className="h-3 w-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              {locale === "id" ? "Telah Ditinjau" : "Reviewed"}
                            </>
                          ) : (
                            <>
                              <svg className="h-3 w-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {locale === "id" ? "Diabaikan" : "Dismissed"}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {rec.adName}
                    </h3>
                    {rec.campaignName && (
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                        {rec.campaignName}
                      </p>
                    )}
                  </div>

                  {/* Top Key Metrics Preview */}
                  <div className="flex items-center gap-3 text-right text-xs shrink-0 font-mono">
                    <div>
                      <span className="block text-[10px] text-zinc-400 font-sans">{locale === "id" ? "Belanja" : "Spend"}</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatCurrency(metrics.spend)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-400 font-sans">CPQL</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {metrics.cpql !== null ? formatCurrency(metrics.cpql) : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-400 font-sans">Buyer Score</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {metrics.avgBuyerScore !== null ? `${metrics.avgBuyerScore}/100` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recommendation Rationale */}
                <div className="mt-3 rounded-lg bg-white p-3 text-xs text-zinc-700 border border-zinc-200/70 shadow-2xs dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                    {rec.headline}
                  </p>
                  <p className="leading-relaxed text-zinc-600 dark:text-zinc-400 pl-3">
                    {rec.reason}
                  </p>
                </div>

                {/* Audit Attribution Note if reviewed */}
                {rec.status !== "active" && rec.reviewedBy && (
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                    {locale === "id" ? "Status:" : "Status:"} {rec.status} • {rec.reviewedBy} •{" "}
                    {formatDateTime(rec.reviewedAt || "")}
                  </p>
                )}

                {/* Action Row */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 cursor-pointer"
                  >
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {isExpanded
                      ? (locale === "id" ? "Sembunyikan Metrik & Batasan" : "Hide Metrics & Limitations")
                      : (locale === "id" ? "Lihat Metrik Pendukung & Batasan" : "View Supporting Metrics & Limitations")}
                  </button>

                  <div className="flex items-center gap-2">
                    {rec.status !== "reviewed" && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleAction(rec.id, "reviewed")}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-400 dark:border-emerald-800 cursor-pointer disabled:opacity-50"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {locale === "id" ? "Tandai Ditinjau" : "Mark as Reviewed"}
                      </button>
                    )}
                    {rec.status !== "dismissed" && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleAction(rec.id, "dismissed")}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 cursor-pointer disabled:opacity-50"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {locale === "id" ? "Abaikan" : "Dismiss"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Supporting Metrics & Limitations Drawer */}
                {isExpanded && (
                  <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                      {locale === "id" ? "Matriks Metrik Pendukung Deterministik:" : "Deterministic Supporting Metrics:"}
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-zinc-700 dark:text-zinc-300 font-mono">
                      <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 block font-sans">CTR:</span>
                        <span className="font-semibold">{metrics.ctr !== null ? `${metrics.ctr}%` : "—"}</span>
                      </div>
                      <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 block font-sans">CPC:</span>
                        <span className="font-semibold">{formatCurrency(metrics.cpc)}</span>
                      </div>
                      <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 block font-sans">CPM:</span>
                        <span className="font-semibold">{formatCurrency(metrics.cpm)}</span>
                      </div>
                      <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 block font-sans">CPQL (Cost/QL):</span>
                        <span className="font-semibold">{formatCurrency(metrics.cpql)}</span>
                        {metrics.cpqlReason && (
                          <span className="text-[9px] text-zinc-400 block font-sans mt-0.5">
                            ({metrics.cpqlReason})
                          </span>
                        )}
                      </div>
                      <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 block font-sans">Qualified Leads:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {metrics.qualifiedLeadsCount}
                        </span>
                      </div>
                      <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 block font-sans">QL Rate:</span>
                        <span className="font-semibold">
                          {metrics.qualifiedLeadRate !== null ? `${metrics.qualifiedLeadRate}%` : "—"}
                        </span>
                      </div>
                      <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 block font-sans">Verified Attr Rate:</span>
                        <span className="font-semibold">
                          {metrics.verifiedAttributionRate !== null ? `${metrics.verifiedAttributionRate}%` : "—"}
                        </span>
                      </div>
                      <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <span className="text-[10px] text-zinc-400 block font-sans">Sampel Skor (n):</span>
                        <span className="font-semibold">n = {metrics.buyerScoreSampleSize}</span>
                      </div>
                    </div>

                    {rec.missingDataAndLimitations.length > 0 && (
                      <div className="border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                        <span className="font-semibold text-[11px] text-zinc-500 dark:text-zinc-400 block mb-1">
                          {locale === "id" ? "Batasan Analisis & Data yang Hilang:" : "Analysis Limitations & Missing Data:"}
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {rec.missingDataAndLimitations.map((lim, idx) => (
                            <li key={idx}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
