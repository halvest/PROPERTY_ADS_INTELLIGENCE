"use client";

import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { RealAdRow } from "@/app/(dashboard)/ads/page";
import type { AIAdAnalysisResponse } from "@/app/api/ai/analyze-ad/route";
import type { AdDetailResponseData } from "@/app/api/ads/[id]/route";

interface AdDetailDrawerProps {
  ad: RealAdRow;
  currency?: string;
  lastSyncedAt?: string | null;
  onClose: () => void;
}

export function AdDetailDrawer({
  ad,
  currency = "IDR",
  lastSyncedAt,
  onClose,
}: AdDetailDrawerProps) {
  const { formatNumber, locale } = useI18n();

  // Server-verified ad detail
  const [serverDetail, setServerDetail] = useState<AdDetailResponseData | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  // AI Analysis state — strictly manual
  const [aiAnalysis, setAiAnalysis] = useState<AIAdAnalysisResponse | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  // Concurrency guard to strictly prevent double-requests
  const isAnalyzingRef = useRef(false);

  // Format currency helper
  const formatMoney = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
    const intlLocale = locale === "id" ? "id-ID" : "en-US";
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: new Intl.NumberFormat(intlLocale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits,
    }).format(amount);
  };

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 1. Fetch server-verified ad detail from /api/ads/[id] (no AI call)
  useEffect(() => {
    let ignore = false;
    async function fetchDetail() {
      setIsDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(`/api/ads/${ad.id}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Gagal memuat detail iklan dari server");
        }
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          setServerDetail(json.data);
        }
      } catch (err) {
        if (!ignore) {
          setDetailError(err instanceof Error ? err.message : "Kesalahan koneksi detail");
        }
      } finally {
        if (!ignore) {
          setIsDetailLoading(false);
        }
      }
    }
    void fetchDetail();
    return () => {
      ignore = true;
    };
  }, [ad.id]);

  // 2. Trigger AI Ad Analysis — Strictly on manual user button click
  const runAiAnalysis = async () => {
    // Prevent double-clicks or concurrent requests
    if (isAnalyzingRef.current || isAiLoading) return;
    isAnalyzingRef.current = true;
    setIsAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/ai/analyze-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adId: ad.id,
          adName: ad.adName,
          campaignName: ad.campaignName,
          status: ad.deliveryStatus,
          metrics: {
            spend: ad.spend,
            impressions: ad.impressions,
            reach: ad.reach,
            linkClicks: ad.linkClicks,
            allClicks: ad.allClicks,
            linkCtr: ad.linkCtr,
            allCtr: ad.allCtr,
            linkCpc: ad.linkCpc,
            allCpc: ad.allCpc,
            cpm: ad.cpm,
            results: ad.results,
            resultType: ad.resultLabel || "Hasil",
            resultsTrackingStatus: ad.resultActionTypes?.some((action) => action.includes("messaging_conversation_started")) ? "TERVERIFIKASI ADA" : "BELUM TERVERIFIKASI",
            costPerResult: ad.costPerResult,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menghubungi AI service");
      }

      const json = await res.json();
      const analysisData: AIAdAnalysisResponse | undefined = json.data || json.analysis;

      if (json.success && analysisData && analysisData.executiveSummary) {
        setAiAnalysis(analysisData);
        setAiError(null);
      } else {
        throw new Error("Format respons analisis AI tidak valid. Silakan coba kembali.");
      }
    } catch (err) {
      // Do not wipe previous valid analysis if re-analysis failed
      setAiError(
        err instanceof Error ? err.message : "Analisis belum berhasil dibuat. Data iklan tetap tersedia. Silakan coba kembali."
      );
    } finally {
      setIsAiLoading(false);
      isAnalyzingRef.current = false;
    }
  };

  // Effective status representations from server detail or fallback props
  const campaignStatus = serverDetail?.campaign.status || ad.campaignStatus;
  const campaignStatusLabel =
    serverDetail?.campaign.statusLabel ||
    (campaignStatus === "ACTIVE"
      ? "Aktif"
      : campaignStatus === "PAUSED"
      ? "Dijeda"
      : campaignStatus === "ARCHIVED"
      ? "Diarsipkan"
      : "Tidak diketahui");
  const deliveryStatus = serverDetail?.delivery.deliveryStatus || ad.deliveryStatus;
  const deliveryLabel = serverDetail?.delivery.deliveryLabel || ad.deliveryLabel;
  const deliveryReason = serverDetail?.delivery.deliveryReason || ad.deliveryReason || "Penayangan Meta";
  const renderVerificationBadge = (status: string) => {
    switch (status) {
      case "TERVERIFIKASI ADA":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            TERVERIFIKASI ADA
          </span>
        );
      case "TERVERIFIKASI NOL":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            TERVERIFIKASI NOL
          </span>
        );
      case "BELUM TERVERIFIKASI":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            BELUM TERVERIFIKASI
          </span>
        );
      case "DATA TIDAK KONSISTEN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            DATA TIDAK KONSISTEN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 border border-zinc-200">
            {status}
          </span>
        );
    }
  };




  const renderBudgetDecisionBadge = (decision: string) => {
    switch (decision) {
      case "NAIKKAN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            NAIKKAN ANGGARAN
          </span>
        );
      case "PERTAHANKAN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            PERTAHANKAN ANGGARAN
          </span>
        );
      case "TAHAN KENAIKAN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            TAHAN KENAIKAN ANGGARAN
          </span>
        );
      case "KURANGI":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800 border border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            KURANGI ANGGARAN
          </span>
        );
      case "HENTIKAN SEMENTARA":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            HENTIKAN SEMENTARA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 border border-zinc-200">
            {decision}
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-detail-drawer-title"
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800"
      >
        {/* Sticky Header */}
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-zinc-100 bg-white/95 px-6 py-4.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="ad-detail-drawer-title"
                className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate"
                title={ad.adName}
              >
                {ad.adName}
              </h2>
              {/* Separate Status Badges (Section 2) */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    campaignStatus === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                  }`}
                  title="Status Campaign Induk Meta"
                >
                  Campaign: {campaignStatusLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    deliveryStatus === "DELIVERING"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800"
                  }`}
                  title="Status Penayangan Efektif Iklan"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      deliveryStatus === "DELIVERING" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                    }`}
                  />
                  Delivery: {deliveryLabel}
                </span>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 font-mono">
              <span>Meta Ad ID: {ad.providerAdId}</span>
              <span>•</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-sans truncate max-w-[260px]">
                {ad.campaignName}
              </span>
              <span className="font-sans">· ID campaign {serverDetail?.campaign.providerCampaignId || "—"}</span>
              <span className="font-sans">· Ad set: {ad.adsetName || "—"} ({ad.adsetId || "ID tidak tersedia"})</span>
              {ad.campaignObjective && (
                <>
                  <span>•</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {ad.campaignObjective}
                  </span>
                </>
              )}
              {lastSyncedAt && (
                <>
                  <span>•</span>
                  <span className="text-[10px] text-zinc-400">
                    Sinkronisasi: {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta", timeZoneName: "short" }).format(new Date(lastSyncedAt))}
                  </span>
                </>
              )}
              {isDetailLoading && (
                <span className="text-[10px] text-blue-500 inline-flex items-center gap-1 font-sans">
                  <svg className="h-2.5 w-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Memverifikasi server...
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer transition-colors"
            aria-label="Tutup panel"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {detailError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Info Sinkronisasi: {detailError}. Menggunakan metrik ringkasan iklan yang tersedia.
            </div>
          )}
          {/* 1. Status Delivery & Periode Rekonsiliasi */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  Diagnostik Delivery Iklan
                </span>
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {deliveryReason}
                </p>
              </div>
              <div className="text-left sm:text-right text-[11px] text-zinc-500">
                {serverDetail?.metrics.dateRangeStart && serverDetail?.metrics.dateRangeStop ? (
                  <span>
                    Data Insights: {serverDetail.metrics.dateRangeStart} s/d {serverDetail.metrics.dateRangeStop}
                  </span>
                ) : lastSyncedAt ? (
                  <span>Sinkronisasi Terakhir: {new Date(lastSyncedAt).toLocaleString("id-ID")}</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* 2. Core Metrics Performance Grid */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Metrik Kinerja Aktual
            </h3>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Belanja</dt>
                <dd className="mt-1 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {formatMoney(ad.spend)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">{ad.resultLabel || "Hasil"}</dt>
                <dd className="mt-1 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {formatNumber(ad.results)}
                </dd>
                {ad.resultActionTypes && ad.resultActionTypes.length > 0 && <dd className="mt-0.5 text-[9px] text-zinc-400">Action: {ad.resultActionTypes.join(", ")}</dd>}
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">Biaya per Hasil</dt>
                <dd className="mt-1 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {formatMoney(ad.costPerResult)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">Jangkauan (Reach)</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatNumber(ad.reach)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">Tayangan (Impresi)</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatNumber(ad.impressions)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">Frekuensi</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {ad.frequency !== null ? `${ad.frequency}x` : "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">Klik Tautan</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatNumber(ad.linkClicks)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">CTR Tautan</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {ad.linkCtr !== null ? `${ad.linkCtr}%` : "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">CPC Tautan</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatMoney(ad.linkCpc)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">CPM (Per 1.000)</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatMoney(ad.cpm)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">Semua Klik</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatNumber(ad.allClicks)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">CTR Semua Klik</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {ad.allCtr !== null ? `${ad.allCtr}%` : "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">CPC Semua Klik</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">{formatMoney(ad.allCpc)}</dd>
              </div>
            </dl>
          </section>

          {/* 3. Utama: Analisis Kinerja & Rekomendasi AI (Manual Click Only) */}
          <section className="rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
                  Analisis Kinerja & Rekomendasi AI
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Evaluasi kinerja iklan properti, rasio CTWA, efektivitas biaya, dan prioritas optimasi.
                </p>
              </div>

              {/* Action Button: Analisis AI / Analisis Ulang */}
              <button
                type="button"
                onClick={runAiAnalysis}
                disabled={isAiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
              >
                {isAiLoading ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Menganalisis...</span>
                  </>
                ) : aiAnalysis ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Analisis Ulang</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Analisis AI</span>
                  </>
                )}
              </button>
            </div>

            {/* State 1: Belum Dianalisis (Idle) */}
            {!aiAnalysis && !isAiLoading && !aiError && (
              <div className="rounded-lg border border-dashed border-indigo-200 bg-white/70 p-5 text-center dark:border-indigo-900/60 dark:bg-zinc-900/60 space-y-3">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Analisis AI belum dijalankan. Klik tombol di bawah untuk mengevaluasi kinerja iklan dan mendapatkan rekomendasi optimasi.
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Analisis mengevaluasi daya tarik kreatif (CTR), efisiensi CPC, funnel pesan WhatsApp, dan keputusan prioritas tindakan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runAiAnalysis}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 cursor-pointer transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Mulai Analisis AI Sekarang</span>
                </button>
              </div>
            )}

            {/* State 2: Sedang Dianalisis (Loading) */}
            {isAiLoading && (
              <div className="rounded-lg bg-white p-6 text-center dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-950 space-y-2">
                <div className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Menganalisis performa iklan...
                </p>
                <p className="text-[11px] text-zinc-500">
                  Mengevaluasi CTR, CPC, rasio CTWA, dan menyusun prioritas tindakan properti.
                </p>
              </div>
            )}

            {/* State 4: Gagal (Error) */}
            {aiError && (
              <div className="rounded-lg bg-rose-50 p-4 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900 space-y-2">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <span className="font-bold block">Analisis belum berhasil dibuat. Data iklan tetap tersedia.</span>
                    <p className="text-[11px] mt-0.5 text-rose-600 dark:text-rose-400">{aiError}</p>
                  </div>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={runAiAnalysis}
                    disabled={isAiLoading}
                    className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 cursor-pointer transition-colors"
                  >
                    <span>Coba Lagi</span>
                  </button>
                </div>
              </div>
            )}

            {/* State 3: Berhasil (Success) */}
            {aiAnalysis && !isAiLoading && (
              <div className="space-y-4 text-xs">
                {/* Header Context & Timestamp */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pb-1 border-b border-indigo-100 dark:border-indigo-900/60">
                  <span>
                    Dianalisis pada: {new Date(aiAnalysis.analyzedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <span className="font-mono text-[10px]">
                    Model: {aiAnalysis.model}
                  </span>
                </div>

                {/* A. Ringkasan Kinerja (Maksimal 3-4 baris) */}
                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-1.5 shadow-xs">
                  <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-bold text-[11px] uppercase tracking-wider">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Ringkasan Kinerja</span>
                  </div>
                  <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                    {aiAnalysis.performanceSummary || aiAnalysis.executiveSummary}
                  </p>
                </div>

                {/* B. Status Hasil WhatsApp */}
                {aiAnalysis.whatsappStatus && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-bold">
                        Status Hasil WhatsApp
                      </span>
                      {renderVerificationBadge(aiAnalysis.whatsappStatus.verificationStatus)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <p className="text-[10px] text-zinc-400">Menurut Meta</p>
                        <p className="mt-0.5 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {aiAnalysis.whatsappStatus.chatAccordingToMeta}
                        </p>
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <p className="text-[10px] text-zinc-400">Pesan Masuk Riil</p>
                        <p className="mt-0.5 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {aiAnalysis.whatsappStatus.verifiedInboundMessages || "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                        <p className="text-[10px] text-zinc-400">Leads CRM</p>
                        <p className="mt-0.5 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {aiAnalysis.whatsappStatus.crmLeads || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* C. Keputusan Anggaran */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-bold">
                      Keputusan Anggaran
                    </span>
                    {renderBudgetDecisionBadge(
                      aiAnalysis.budgetDecision?.decision ||
                      (aiAnalysis.actionDecision?.priorityLabel) ||
                      "TAHAN KENAIKAN"
                    )}
                  </div>
                  <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                    {aiAnalysis.budgetDecision?.reason || aiAnalysis.actionDecision?.justification}
                  </p>
                </div>

                {/* D. Maksimal 3 Temuan Penting */}
                {aiAnalysis.keyFindings && aiAnalysis.keyFindings.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                        Temuan Penting
                      </h4>
                      <span className="text-[10px] text-zinc-400">Maksimal 3 poin utama</span>
                    </div>
                    <div className="space-y-2.5">
                      {aiAnalysis.keyFindings.slice(0, 3).map((f, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {f.finding}
                            </span>
                            {f.isHypothesis && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                Hipotesis
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] space-y-0.5 text-zinc-600 dark:text-zinc-300">
                            <p><strong>Bukti:</strong> {f.evidence}</p>
                            <p><strong>Dampak:</strong> {f.impact}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* E. Maksimal 3 Tindakan Prioritas */}
                {aiAnalysis.priorityActions && aiAnalysis.priorityActions.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                        Tindakan Prioritas
                      </h4>
                      <span className="text-[10px] text-zinc-400">Terurut berdasarkan urgensi</span>
                    </div>
                    <div className="space-y-2.5">
                      {aiAnalysis.priorityActions.slice(0, 3).map((act, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-1 text-[11px]"
                        >
                          <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                            #{idx + 1}. {act.action}
                          </div>
                          <p className="text-zinc-600 dark:text-zinc-300">
                            <strong className="text-zinc-800 dark:text-zinc-200">Cara Memeriksa:</strong> {act.howToCheck}
                          </p>
                          <p className="text-emerald-700 dark:text-emerald-400">
                            <strong>Hasil Diharapkan:</strong> {act.expectedResult}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* F. Metrik Utama (Maksimal 6 Metrik) */}
                {aiAnalysis.coreMetrics && aiAnalysis.coreMetrics.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                      Metrik Utama
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {aiAnalysis.coreMetrics.slice(0, 6).map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-0.5"
                        >
                          <span className="text-[10px] text-zinc-500 block truncate" title={m.label}>
                            {m.label}
                          </span>
                          <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 block">
                            {m.formattedValue}
                          </span>
                          {m.note && (
                            <span className="text-[9px] text-zinc-400 italic block leading-tight">
                              {m.note}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* G. Detail Tambahan (Collapsible) */}
                {aiAnalysis.additionalDetails && (
                  <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                      className="w-full flex items-center justify-between p-4 text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span>Detail Tambahan & Evaluasi Funnel</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-normal text-zinc-500">
                        <span>{showAdditionalDetails ? "Sembunyikan" : "Buka Detail"}</span>
                        <svg
                          className={`h-4 w-4 transform transition-transform ${showAdditionalDetails ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {showAdditionalDetails && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 space-y-4 text-xs bg-zinc-50/30 dark:bg-zinc-950/20">
                        {/* 1. Evaluasi Funnel */}
                        {aiAnalysis.additionalDetails.funnelEvaluation && (
                          <div className="space-y-1.5">
                            <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider block">
                              Evaluasi Funnel Penjualan Properti
                            </span>
                            <div className="rounded-lg border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 space-y-1">
                              <div className="text-zinc-900 dark:text-zinc-100 font-bold">
                                Tahap Pertama Bermasalah: {aiAnalysis.additionalDetails.funnelEvaluation.firstFailingStage}
                              </div>
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                {aiAnalysis.additionalDetails.funnelEvaluation.explanation}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 2. Fakta, Hipotesis, dan Informasi Belum Diketahui */}
                        <div className="space-y-2">
                          <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider block">
                            Fakta, Hipotesis & Keterbatasan Data
                          </span>
                          <div className="rounded-lg border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 space-y-2 text-[11px]">
                            {aiAnalysis.additionalDetails.facts?.length > 0 && (
                              <div>
                                <strong className="text-zinc-800 dark:text-zinc-200 block text-[10px] uppercase text-emerald-700 dark:text-emerald-400">Fakta Aktual:</strong>
                                <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400">
                                  {aiAnalysis.additionalDetails.facts.map((fact, i) => (
                                    <li key={i}>{fact}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {aiAnalysis.additionalDetails.hypotheses?.length > 0 && (
                              <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                                <strong className="text-zinc-800 dark:text-zinc-200 block text-[10px] uppercase text-blue-700 dark:text-blue-400">Hipotesis Diuji:</strong>
                                <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400">
                                  {aiAnalysis.additionalDetails.hypotheses.map((hyp, i) => (
                                    <li key={i}>{hyp}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {aiAnalysis.additionalDetails.unknowns?.length > 0 && (
                              <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                                <strong className="text-zinc-800 dark:text-zinc-200 block text-[10px] uppercase text-amber-700 dark:text-amber-400">Informasi Belum Diketahui:</strong>
                                <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400">
                                  {aiAnalysis.additionalDetails.unknowns.map((unk, i) => (
                                    <li key={i}>{unk}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 3. Rincian Seluruh Metrik */}
                        {aiAnalysis.additionalDetails.allMetrics?.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider block">
                              Rincian Seluruh Metrik
                            </span>
                            <div className="overflow-x-auto rounded-lg border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                              <table className="w-full text-left text-[11px]">
                                <thead className="border-b border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/30 text-[10px] text-zinc-500">
                                  <tr>
                                    <th className="py-2 px-3 font-semibold">Metrik</th>
                                    <th className="py-2 px-3 font-semibold">Nilai</th>
                                    <th className="py-2 px-3 font-semibold">Keterangan</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  {aiAnalysis.additionalDetails.allMetrics.map((met, i) => (
                                    <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                                      <td className="py-1.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">{met.label}</td>
                                      <td className="py-1.5 px-3 font-mono">{met.value}</td>
                                      <td className="py-1.5 px-3 text-zinc-500 dark:text-zinc-400 text-[10px]">{met.explanation}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* 4. Catatan Materi Iklan */}
                        {aiAnalysis.additionalDetails.creativeNotes && (
                          <div className="space-y-1 pt-1">
                            <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider block">
                              Catatan Materi Iklan
                            </span>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
                              {aiAnalysis.additionalDetails.creativeNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Safety footnote */}
          <p className="text-[10px] text-zinc-400 italic">
            *Rekomendasi AI bersifat asistif untuk memandu marketer properti. HD Creative tidak mengubah alokasi anggaran, bidding, atau status iklan Meta tanpa persetujuan manual Anda.
          </p>
        </div>
      </section>
    </div>
  );
}
