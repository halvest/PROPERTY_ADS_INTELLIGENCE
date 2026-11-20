"use client";

import React, { useState } from "react";
import type { AccountIntelligenceReport } from "@/lib/ai/account-intelligence/engine";
import { formatDisplayCurrency, type DisplayLocale } from "@/lib/format/display-currency";

function money(value: number | null, currency: string, locale: DisplayLocale): string {
  if (value === null) return "—";
  return formatDisplayCurrency(value, currency, locale);
}

function targetLabel(status: string, locale: DisplayLocale): string {
  if (status === "TARGET_NOT_CONFIGURED") return locale === "id" ? "Target belum diatur" : "Target not set";
  if (status === "CPR_UNAVAILABLE") return locale === "id" ? "CPR tidak tersedia" : "CPR unavailable";
  if (status === "BETTER") return locale === "id" ? "Lebih efisien dari target" : "Better than target";
  if (status === "ON_TARGET") return locale === "id" ? "Sesuai kisaran target" : "On target";
  if (status === "WORSE") return locale === "id" ? "Di atas target" : "Above target";
  return status;
}

function formatCategoryBadge(category: string, locale: DisplayLocale): { label: string; className: string } {
  switch (category) {
    case "TOP_PERFORMER":
      return {
        label: locale === "id" ? "Performa Terbaik" : "Top Performer",
        className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
      };
    case "WINNER":
      return {
        label: locale === "id" ? "Pemenang (Winner)" : "Winner",
        className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
      };
    case "STRONG_PERFORMER":
      return {
        label: locale === "id" ? "Performa Kuat" : "Strong Performer",
        className: "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-300",
      };
    case "POTENTIAL_WINNER":
      return {
        label: locale === "id" ? "Potensial" : "Potential Winner",
        className: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:text-cyan-300",
      };
    case "EFFICIENT":
      return {
        label: locale === "id" ? "Efisien" : "Efficient",
        className: "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-300",
      };
    case "STABLE":
      return {
        label: locale === "id" ? "Stabil" : "Stable",
        className: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
      };
    case "GATHERING_DATA":
      return {
        label: locale === "id" ? "Mengumpulkan Data" : "Gathering Data",
        className: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300",
      };
    case "NEEDS_OPTIMIZATION":
    case "AVERAGE":
      return {
        label: locale === "id" ? "Perlu Optimasi" : "Needs Optimization",
        className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
      };
    case "UNDERPERFORMING":
    case "LOSING":
      return {
        label: locale === "id" ? "Kurang Efisien" : "Underperforming",
        className: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
      };
    case "INSUFFICIENT_DATA":
      return {
        label: locale === "id" ? "Data Belum Cukup" : "Insufficient Data",
        className: "bg-zinc-500/10 text-zinc-600 border-zinc-300 dark:text-zinc-400 dark:border-zinc-700",
      };
    case "UNRANKED":
    default:
      return {
        label: locale === "id" ? "Belum Diperingkat" : "Unranked",
        className: "bg-zinc-500/10 text-zinc-600 border-zinc-300 dark:text-zinc-400 dark:border-zinc-700",
      };
  }
}

function formatActionBadge(action: string, locale: DisplayLocale): { label: string; className: string } {
  switch (action) {
    case "SCALE":
      return {
        label: locale === "id" ? "Tingkatkan Budget" : "Scale Budget",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "MAINTAIN":
      return {
        label: locale === "id" ? "Pertahankan" : "Maintain",
        className: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
      };
    case "OPTIMIZE":
      return {
        label: locale === "id" ? "Optimasi" : "Optimize",
        className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
      };
    case "PAUSE":
    case "REDUCE_BUDGET":
      return {
        label: action === "PAUSE" ? (locale === "id" ? "Jeda Iklan" : "Pause") : (locale === "id" ? "Kurangi Budget" : "Reduce Budget"),
        className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
      };
    case "HISTORICAL_REVIEW":
      return {
        label: locale === "id" ? "Tinjau Histori" : "Historical Review",
        className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
      };
    case "SET_TARGET_CPR":
      return {
        label: locale === "id" ? "Atur Target CPR" : "Set Target CPR",
        className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
      };
    case "MONITOR":
    default:
      return {
        label: locale === "id" ? "Pantau" : "Monitor",
        className: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
      };
  }
}

function formatConfidencePill(level: string, locale: DisplayLocale): { label: string; color: string; barWidth: string } {
  const norm = level.toLowerCase();
  if (norm === "high" || norm === "tinggi") {
    return {
      label: locale === "id" ? "Tinggi" : "High",
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      barWidth: "w-full bg-emerald-500",
    };
  }
  if (norm === "medium" || norm === "sedang") {
    return {
      label: locale === "id" ? "Sedang" : "Medium",
      color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
      barWidth: "w-2/3 bg-amber-500",
    };
  }
  return {
    label: locale === "id" ? "Rendah" : "Low",
    color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
    barWidth: "w-1/3 bg-rose-500",
  };
}

function StatusDotPill({ status, configuredStatus, locale }: { status: string; configuredStatus?: string; locale: DisplayLocale }) {
  const isActive = status === "ACTIVE";
  const isPaused = status === "PAUSED" || status === "CAMPAIGN_PAUSED" || status === "ADSET_PAUSED";
  const label = isActive
    ? locale === "id" ? "Aktif" : "Active"
    : isPaused
    ? locale === "id" ? "Dijeda" : "Paused"
    : status;

  const hasMismatch = configuredStatus && configuredStatus !== status;

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
          isActive
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : isPaused
            ? "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : isPaused ? "bg-zinc-400" : "bg-amber-500"}`} />
        {label}
      </span>
      {hasMismatch && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {locale === "id" ? `Setelan: ${configuredStatus}` : `Config: ${configuredStatus}`}
        </span>
      )}
    </div>
  );
}

export function AccountIntelligenceReportView({
  report,
  currency,
  locale,
}: {
  report: AccountIntelligenceReport;
  currency: string;
  locale: DisplayLocale;
}) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [rankingTab, setRankingTab] = useState<"campaigns" | "ads">("campaigns");

  const summary = report.account_summary;
  const meta = report.analysis_metadata;
  const intel = report.intelligence;

  const toggleCheck = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const maxCampaignSpend = Math.max(...report.campaign_rankings.map((c) => c.spend), 1);
  const maxAdSpend = Math.max(...report.ad_rankings.map((a) => a.spend), 1);

  const dataConf = formatConfidencePill(intel.confidence.data, locale);
  const perfConf = formatConfidencePill(intel.confidence.performance, locale);
  const decConf = formatConfidencePill(intel.confidence.decision, locale);

  const activeCampaignRatio =
    summary.total_campaigns > 0 ? Math.round((summary.active_campaigns / summary.total_campaigns) * 100) : 0;
  const deliveryAdRatio =
    meta.analyzed_ad_count > 0 ? Math.round((meta.ads_with_delivery / meta.analyzed_ad_count) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ================================================================= */}
      {/* 1. EXECUTIVE DIAGNOSIS & ACCOUNT OVERVIEW HERO                    */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-amber-500/10 via-indigo-500/5 to-transparent blur-3xl"
          aria-hidden="true"
        />

        {/* Top Header Row */}
        <div className="relative flex flex-col gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {locale === "id" ? "Intelijen Akun Menyeluruh" : "Holistic Account Intelligence"}
              </span>
              {meta.account_id && (
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {meta.account_id}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-xl">
              {meta.account_name}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-1.5 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300">
              <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>
                {meta.period_start} → {meta.period_end}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="font-mono text-[11px] text-zinc-500">{meta.timezone}</span>
            </span>
          </div>
        </div>

        {/* Executive Summary Highlight Box */}
        <div className="mt-4 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-50/60 via-white to-amber-50/30 p-4 dark:border-indigo-500/20 dark:from-indigo-950/25 dark:via-zinc-900 dark:to-amber-950/10">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {locale === "id" ? "Ringkasan Diagnosis Eksekutif" : "Executive Diagnostic Summary"}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {intel.creative_fatigue.note}
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-100">
                {intel.executive_summary}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {meta.scope_note}
              </p>
            </div>
          </div>
        </div>

        {/* 3 Confidence Gauges + Inventory Status Bar */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Confidence 1: Data */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Keyakinan Data" : "Data Confidence"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${dataConf.color}`}>
                {dataConf.label}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className={`h-full rounded-full ${dataConf.barWidth}`} />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {meta.campaigns_with_delivery}/{meta.analyzed_campaign_count} campaign · {meta.ads_with_delivery}/{meta.analyzed_ad_count} {locale === "id" ? "iklan aktif tayang" : "ads with delivery"}
            </p>
          </div>

          {/* Confidence 2: Performance */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Validitas Performa" : "Performance Validity"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${perfConf.color}`}>
                {perfConf.label}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className={`h-full rounded-full ${perfConf.barWidth}`} />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {summary.results_comparable
                ? locale === "id" ? "Hasil seragam & dapat dibandingkan" : "Comparable conversion results"
                : locale === "id" ? "Objektif berbeda (tidak digabung)" : "Mixed objectives (unblended)"}
            </p>
          </div>

          {/* Confidence 3: Decision */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Kesiapan Keputusan" : "Decision Readiness"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${decConf.color}`}>
                {decConf.label}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className={`h-full rounded-full ${decConf.barWidth}`} />
            </div>
            <p className="mt-1.5 line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400" title={intel.confidence.explanation}>
              {intel.confidence.explanation}
            </p>
          </div>

          {/* Operational Delivery Ratio */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Status Tayang Efektif" : "Effective Delivery"}
              </span>
              <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {deliveryAdRatio}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(6, deliveryAdRatio))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {locale === "id"
                ? `Efektif aktif: ${meta.effective_active_ads} · Dijeda: ${meta.effective_paused_ads}`
                : `Effective active: ${meta.effective_active_ads} · Paused: ${meta.effective_paused_ads}`}
            </p>
          </div>
        </div>

        {/* Warnings if Long Period or Uncomparable Results */}
        {(meta.long_period_warning || meta.result_comparability === "ACCOUNT_RESULT_NOT_COMPARABLE") && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {meta.long_period_warning && (
              <div className="flex-1 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <span className="font-bold">⚠️ {locale === "id" ? "Rentang Historis Panjang:" : "Long Historical Window:"}</span>{" "}
                {meta.long_period_warning}
              </div>
            )}
            {meta.result_comparability === "ACCOUNT_RESULT_NOT_COMPARABLE" && (
              <div className="flex-1 rounded-xl border border-sky-200/90 bg-sky-50/80 px-3.5 py-2.5 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
                <span className="font-bold">ℹ️ {locale === "id" ? "Hasil Lintas Objektif:" : "Cross-Objective Results:"}</span>{" "}
                {locale === "id"
                  ? "Akun memiliki beberapa jenis konversi berbeda sehingga CPR gabungan tingkat akun tidak dihitung agar evaluasi tetap akurat."
                  : "Account runs multiple distinct conversion types; blended account CPR is omitted to keep evaluations accurate."}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* 2. 8-METRIC ACCOUNT SUMMARY INFOGRAFIK GRID                       */}
      {/* ================================================================= */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* 1. Total Spend */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {locale === "id" ? "Total Belanja" : "Total Spend"}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {money(summary.total_spend, currency, locale)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {report.budget_analysis.top_spending_campaign
              ? `${report.budget_analysis.top_spending_campaign.share_pct}% → ${report.budget_analysis.top_spending_campaign.name}`
              : locale === "id" ? "Seluruh campaign aktif" : "All active campaigns"}
          </p>
        </div>

        {/* 2. Total Results */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {locale === "id" ? "Total Hasil" : "Total Results"}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {summary.results_comparable
              ? summary.total_results !== null
                ? new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US").format(summary.total_results)
                : "—"
              : locale === "id" ? "Tidak digabung" : "Unblended"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {summary.results_comparable
              ? locale === "id" ? "Konversi terverifikasi Meta" : "Meta verified conversions"
              : locale === "id" ? "Lihat rincian per campaign" : "See per-campaign breakdown"}
          </p>
        </div>

        {/* 3. Account Blended CPR */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {locale === "id" ? "CPR Rata-Rata Akun" : "Account Blended CPR"}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {money(summary.blended_cpr, currency, locale)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {summary.blended_cpr !== null
              ? locale === "id" ? "Biaya rata-rata per hasil" : "Blended cost per result"
              : locale === "id" ? "Evaluasi CPR di level objek" : "Evaluated at entity level"}
          </p>
        </div>

        {/* 4. Average Link CTR */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {locale === "id" ? "CTR Tautan" : "Link CTR"}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {summary.average_ctr === null ? "—" : `${summary.average_ctr}%`}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {summary.average_ctr !== null && summary.average_ctr >= 1
              ? locale === "id" ? "Di atas patokan 1,0% ✓" : "Above 1.0% benchmark ✓"
              : locale === "id" ? "Patokan sehat ≥ 1,0%" : "Healthy benchmark ≥ 1.0%"}
          </p>
        </div>

        {/* 5. Campaign Inventory Pill */}
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">{locale === "id" ? "Campaign Tersimpan" : "Stored Campaigns"}</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{summary.total_campaigns}</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div className="h-full bg-emerald-500" style={{ width: `${activeCampaignRatio}%` }} />
          </div>
        </div>

        {/* 6. Active Campaigns */}
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">{locale === "id" ? "Campaign Aktif" : "Active Campaigns"}</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{summary.active_campaigns}</span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">
            {meta.campaigns_with_delivery} {locale === "id" ? "memiliki tayangan" : "with delivery"}
          </p>
        </div>

        {/* 7. Paused Campaigns */}
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">{locale === "id" ? "Campaign Dijeda" : "Paused Campaigns"}</span>
            <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{summary.paused_campaigns}</span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">
            {meta.excluded_campaign_count} {locale === "id" ? "tanpa aktivitas periode ini" : "idle in period"}
          </p>
        </div>

        {/* 8. Total Ads */}
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">{locale === "id" ? "Total Materi Iklan" : "Total Ads"}</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{summary.total_ads}</span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">
            {meta.ads_with_delivery} {locale === "id" ? "aktif tayang" : "delivered"} · {meta.excluded_ad_count} {locale === "id" ? "tanpa tayang" : "idle"}
          </p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 3. BUDGET CONCENTRATION & KEY DIAGNOSTIC FINDINGS                 */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left 5 Cols: Budget Distribution & Key Insights */}
        <div className="space-y-4 lg:col-span-5">
          {/* Budget Allocation Card */}
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {locale === "id" ? "Distribusi & Konsentrasi Anggaran" : "Budget Concentration & Spend"}
              </h3>
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {money(report.budget_analysis.total_spend, currency, locale)}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {report.budget_analysis.allocation_note}
            </p>

            {/* Top Campaign Share Visual Bar */}
            {report.budget_analysis.top_spending_campaign && (
              <div className="mt-3.5 rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {report.budget_analysis.top_spending_campaign.name}
                  </span>
                  <span className="shrink-0 rounded-md bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                    {report.budget_analysis.top_spending_campaign.share_pct}% {locale === "id" ? "Porsi Belanja" : "Spend Share"}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-amber-500"
                    style={{ width: `${Math.min(100, Math.max(4, report.budget_analysis.top_spending_campaign.share_pct))}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <span>{locale === "id" ? "Perbandingan Periode Lalu:" : "Previous Period Comparison:"}</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {report.comparison.status === "COMPARISON_DATA_UNAVAILABLE"
                  ? locale === "id" ? "Belum tersedia di snapshot" : "Unavailable in snapshot"
                  : `${money(report.comparison.previous_spend, currency, locale)} (${report.comparison.note})`}
              </span>
            </div>
          </section>

          {/* Key Insights Bullet Card */}
          {report.key_insights.length > 0 && (
            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {locale === "id" ? "Sorotan Utama Akun" : "Key Account Highlights"}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {report.key_insights.map((item, idx) => (
                  <li key={item.text} className="flex items-start gap-2.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      {idx + 1}
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right 7 Cols: Structured Diagnostic Findings */}
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {locale === "id" ? "Temuan Diagnostik & Bukti Data" : "Diagnostic Findings & Data Evidence"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Klik setiap temuan untuk melihat observasi, diagnosis, dan bukti metrik." : "Click any finding to inspect observation, diagnosis, and metric evidence."}
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {intel.key_findings.length} {locale === "id" ? "Temuan" : "Findings"}
            </span>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {intel.key_findings.map((finding, fIdx) => {
              const sev = finding.severity.toLowerCase();
              const sevBadge =
                sev === "high" || sev === "critical"
                  ? "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300"
                  : sev === "medium" || sev === "warn"
                  ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300"
                  : "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300";

              return (
                <details
                  key={finding.title}
                  open={fIdx === 0}
                  className="group rounded-xl border border-zinc-200/90 bg-zinc-50/40 transition-all open:bg-white open:shadow-2xs dark:border-zinc-800 dark:bg-zinc-800/30 dark:open:bg-zinc-900"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${sevBadge}`}>
                        {finding.severity}
                      </span>
                      <span className="text-sm font-semibold">{finding.title}</span>
                    </div>
                    <span className="shrink-0 text-zinc-400 transition-transform group-open:rotate-180">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </summary>

                  <div className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-3 text-xs dark:border-zinc-800">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {locale === "id" ? "Observasi Faktual" : "Factual Observation"}
                        </span>
                        <p className="mt-1 leading-relaxed text-zinc-700 dark:text-zinc-300">{finding.observation}</p>
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {locale === "id" ? "Diagnosis & Dampak Bisnis" : "Diagnosis & Business Impact"}
                        </span>
                        <p className="mt-1 leading-relaxed text-zinc-700 dark:text-zinc-300">{finding.diagnosis}</p>
                        {finding.business_impact && (
                          <p className="mt-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                            → {finding.business_impact}
                          </p>
                        )}
                      </div>
                    </div>

                    {finding.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {finding.evidence.map((item) => (
                          <span
                            key={`${finding.title}-${item.metric}`}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            <strong className="text-zinc-800 dark:text-zinc-100">{item.metric}:</strong> {String(item.value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </div>

      {/* ================================================================= */}
      {/* 4. INTERACTIVE CAMPAIGN & AD RANKING INFOGRAFIK TABLE             */}
      {/* ================================================================= */}
      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {locale === "id" ? "Peringkat Performa Berdasarkan Level Meta Ads" : "Performance Ranking by Meta Ads Level"}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {locale === "id"
                ? "Objek dengan aktivitas tayang diurutkan berdasarkan efisiensi CPR dan kontribusi hasil."
                : "Entities with delivery ranked by CPR efficiency and result contribution."}
            </p>
          </div>

          {/* Segmented Switcher: Campaigns vs Ads */}
          <div className="inline-flex rounded-xl border border-zinc-200/90 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setRankingTab("campaigns")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                rankingTab === "campaigns"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>Campaigns</span>
              <span className="rounded-full bg-zinc-200/80 px-1.5 py-0.2 font-mono text-[10px] dark:bg-zinc-600">
                {report.campaign_rankings.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRankingTab("ads")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                rankingTab === "ads"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>{locale === "id" ? "Materi Iklan (Ads)" : "Ads"}</span>
              <span className="rounded-full bg-zinc-200/80 px-1.5 py-0.2 font-mono text-[10px] dark:bg-zinc-600">
                {report.ad_rankings.length}
              </span>
            </button>
          </div>
        </div>

        {/* Campaigns Ranking Table */}
        {rankingTab === "campaigns" ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="px-3 py-2.5">Campaign</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">{locale === "id" ? "Belanja" : "Spend"}</th>
                  <th className="px-3 py-2.5 text-right">{locale === "id" ? "Hasil" : "Results"}</th>
                  <th className="px-3 py-2.5 text-right">CPR</th>
                  <th className="px-3 py-2.5 text-right">Target CPR</th>
                  <th className="pl-3 py-2.5 text-right">{locale === "id" ? "Evaluasi & Aksi" : "Evaluation & Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {report.campaign_rankings.slice(0, 30).map((item) => {
                  const catBadge = formatCategoryBadge(item.category, locale);
                  const actBadge = formatActionBadge(item.action, locale);
                  const spendRatio = Math.min(100, Math.max(4, Math.round((item.spend / maxCampaignSpend) * 100)));

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 pr-3 font-mono font-bold text-zinc-500">
                        {report.campaign_rankings.length < 2 ? "—" : `#${item.rank}`}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                        <p className="font-mono text-[10px] text-zinc-400">ID: {item.providerId}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusDotPill status={item.effectiveStatus} locale={locale} />
                      </td>
                      <td className="px-3 py-3 min-w-[140px]">
                        <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          {money(item.spend, currency, locale)}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${spendRatio}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {item.results === null ? "—" : item.results}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {money(item.cpr, currency, locale)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {item.target.status === "TARGET_NOT_CONFIGURED" ? (
                          <span className="text-[11px] text-zinc-400">
                            {locale === "id" ? "Belum diatur" : "Not set"}
                          </span>
                        ) : (
                          <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
                            {money(item.target.value, currency, locale)}
                          </span>
                        )}
                      </td>
                      <td className="pl-3 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${catBadge.className}`}>
                            {catBadge.label}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${actBadge.className}`}>
                            {actBadge.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Ads Ranking Table */
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="px-3 py-2.5">{locale === "id" ? "Materi Iklan" : "Ad"}</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">{locale === "id" ? "Belanja" : "Spend"}</th>
                  <th className="px-3 py-2.5 text-right">{locale === "id" ? "Hasil" : "Results"}</th>
                  <th className="px-3 py-2.5 text-right">CPR</th>
                  <th className="px-3 py-2.5 text-right">CTR</th>
                  <th className="pl-3 py-2.5 text-right">{locale === "id" ? "Kinerja" : "Category"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {report.ad_rankings.slice(0, 30).map((item) => {
                  const catBadge = formatCategoryBadge(item.category, locale);
                  const spendRatio = Math.min(100, Math.max(4, Math.round((item.spend / maxAdSpend) * 100)));

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 pr-3 font-mono font-bold text-zinc-500">
                        {report.ad_rankings.length < 2 ? "—" : `#${item.rank}`}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                        <p className="text-[11px] text-zinc-500">{item.campaignName}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusDotPill
                          status={item.effectiveStatus}
                          configuredStatus={item.configuredStatus}
                          locale={locale}
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[140px]">
                        <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          {money(item.spend, currency, locale)}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${spendRatio}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {item.results === null ? "—" : item.results}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {money(item.cpr, currency, locale)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {item.ctr === null ? "—" : `${item.ctr}%`}
                      </td>
                      <td className="pl-3 py-3 text-right">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${catBadge.className}`}>
                          {catBadge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* 5. STRATEGIC PLAYBOOK & INTERACTIVE ACTION PLAN CHECKLIST         */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Strategic Recommendations (7 cols) */}
        <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-7">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {locale === "id" ? "Rekomendasi Strategis & Taktis" : "Strategic & Tactical Playbook"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {locale === "id"
                ? "Langkah optimasi berbasis bukti yang disusun menurut prioritas dampak."
                : "Evidence-backed optimization steps ordered by impact priority."}
            </p>
          </div>

          {intel.strategic_recommendations.length > 0 ? (
            <div className="space-y-3">
              {intel.strategic_recommendations.map((item) => {
                const actBadge = formatActionBadge(item.action_type, locale);
                return (
                  <article
                    key={`${item.object_id}-${item.action_type}`}
                    className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${actBadge.className}`}>
                          {actBadge.label}
                        </span>
                        <span className="font-mono text-[11px] font-semibold uppercase text-zinc-400">
                          {item.priority}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {locale === "id" ? "Evaluasi:" : "Evaluate:"} {item.evaluation_period}
                      </span>
                    </div>

                    <h4 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">{item.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{item.reason}</p>

                    {item.execution_steps.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-zinc-200/70 pt-2.5 dark:border-zinc-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {locale === "id" ? "Langkah Eksekusi:" : "Execution Steps:"}
                        </span>
                        <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                          {item.execution_steps.map((step) => (
                            <li key={step} className="flex items-start gap-2">
                              <span className="text-amber-500 font-bold">→</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {report.recommendations.map((item) => {
                const actBadge = formatActionBadge(item.action, locale);
                return (
                  <article
                    key={`${item.objectId}-${item.action}`}
                    className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${actBadge.className}`}>
                        {actBadge.label}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {targetLabel(item.targetStatus, locale)}
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {item.objectLevel === "campaign" ? "Campaign" : "Iklan"}: {item.objectName}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{item.recommendedAction}</p>
                    <p className="mt-2 font-mono text-[11px] text-zinc-500">
                      CPR {money(item.cpr, currency, locale)} · {locale === "id" ? "Hasil" : "Results"} {item.results ?? "—"} · {locale === "id" ? "Belanja" : "Spend"} {money(item.spend, currency, locale)}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Interactive Action Plan Checklist & Historical Reviews (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {locale === "id" ? "Daftar Tindakan (Action Plan)" : "Action Plan Checklist"}
              </h3>
              <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {Object.values(checkedItems).filter(Boolean).length}/{report.action_plan.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Centang langkah yang sudah Anda tindak lanjuti." : "Check off items as you execute them."}
            </p>

            <ul className="mt-3 space-y-2">
              {report.action_plan.map((item) => {
                const key = item.object_id + item.item;
                const isChecked = Boolean(checkedItems[key]);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => toggleCheck(key)}
                      className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left text-xs transition-all cursor-pointer ${
                        isChecked
                          ? "border-emerald-500/30 bg-emerald-50/40 text-zinc-400 line-through dark:bg-emerald-950/20 dark:text-zinc-500"
                          : "border-zinc-200/80 bg-zinc-50/50 text-zinc-800 hover:border-amber-500/40 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isChecked
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                        }`}
                      >
                        {isChecked && (
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className="leading-relaxed">{item.item}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {report.data_quality.warnings.length > 0 && (
              <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {locale === "id" ? "Catatan Kualitas Data:" : "Data Quality Notes:"}
                </span>
                <ul className="mt-1.5 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {report.data_quality.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Historical Reviews for Paused Entities */}
          {report.historical_reviews.length > 0 && (
            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {locale === "id" ? "Tinjauan Histori Objek Dijeda" : "Paused Entities Historical Review"}
              </h3>
              <div className="mt-3 space-y-2.5">
                {report.historical_reviews.map((item) => (
                  <article
                    key={`hist-${item.objectId}-${item.action}`}
                    className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.objectName}</span>
                      <StatusDotPill status={item.currentStatus} locale={locale} />
                    </div>
                    <p className="mt-1.5 leading-relaxed text-zinc-600 dark:text-zinc-300">{item.recommendedAction}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
