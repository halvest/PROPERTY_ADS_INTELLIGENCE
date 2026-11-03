"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { KPICard } from "@/components/ui/KPICard";
import { OnboardingStatusBar } from "@/components/dashboard/OnboardingStatusBar";
import { FunnelBadge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { LiveDashboardResponse } from "@/lib/data/live-dashboard-service";

export default function DashboardPage() {
  const { t, formatCurrency, formatNumber, locale } = useI18n();
  const { addToast } = useToast();

  const [dateRange, setDateRange] = useState("30d");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dashboardData, setDashboardData] = useState<LiveDashboardResponse | null>(null);

  const periodPills = [
    { id: "today", label: t.adsWorkspace.today },
    { id: "7d", label: t.adsWorkspace.days7 },
    { id: "14d", label: t.adsWorkspace.days14 },
    { id: "30d", label: t.adsWorkspace.days30 },
  ];

  const refreshDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/summary?dateRange=${encodeURIComponent(dateRange)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDashboardData(json.data);
        }
      }
    } catch {
      // Non-blocking fetch error
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/dashboard/summary?dateRange=${encodeURIComponent(dateRange)}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success && json.data) {
            setDashboardData(json.data);
          }
        }
      } catch {
        // Non-blocking fetch error
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [dateRange]);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        const count = data.syncResult?.recordsProcessed ?? 0;
        addToast(
          "success",
          locale === "id" ? "Sinkronisasi Berhasil" : "Sync Successful",
          locale === "id"
            ? `Meta Marketing API sinkron: ${count} record berhasil diproses dan disimpan.`
            : `Meta Marketing API synced: ${count} records processed.`
        );
        refreshDashboard();
      } else {
        addToast(
          "error",
          locale === "id" ? "Sinkronisasi Gagal" : "Sync Failed",
          data.message || (locale === "id" ? "Gagal melakukan sinkronisasi Meta Marketing API." : "Failed to sync Meta Marketing API.")
        );
      }
    } catch (err) {
      addToast(
        "error",
        locale === "id" ? "Kesalahan Jaringan" : "Network Error",
        err instanceof Error ? err.message : "Network error"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const funnelStages: FunnelStage[] = [
    "baru",
    "dihubungi",
    "prospek",
    "survei",
    "closing",
    "batal",
  ];

  const state = dashboardData?.state || "not_connected";
  const summary = dashboardData?.summary;
  const leaderboard = dashboardData?.leaderboard || [];
  const funnelCounts = dashboardData?.funnelCounts || {
    baru: 0,
    dihubungi: 0,
    prospek: 0,
    survei: 0,
    closing: 0,
    batal: 0,
  };

  const verifiedPercent = summary?.attributionCoverage?.verifiedPercentage ?? 0;
  const verifiedCount = summary?.attributionCoverage?.verifiedCount ?? 0;
  const inferredCount = summary?.attributionCoverage?.inferredCount ?? 0;
  const unknownCount = summary?.attributionCoverage?.unknownCount ?? 0;

  // Calculate total pipeline leads
  const totalPipelineLeads = Object.values(funnelCounts).reduce((acc, count) => acc + count, 0);

  return (
    <div className={`space-y-6 max-w-7xl mx-auto pb-12 transition-opacity ${isLoading ? "opacity-80" : "opacity-100"}`}>
      {/* 1. Header & Context Actions Bar */}
      <div className="solar-header surface-card flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t.dashboard.title}
            </h1>
            {dashboardData?.selectedAdAccount && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/80">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {dashboardData.selectedAdAccount.name || dashboardData.selectedAdAccount.id}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {t.dashboard.subtitle}
          </p>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="inline-flex min-w-0 max-w-full overflow-x-auto flex-nowrap gap-0.5 rounded-xl border border-zinc-200/80 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-950/60">
            {periodPills.map((pill) => {
              const isActive = dateRange === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setDateRange(pill.id);
                    setShowCustomRange(false);
                  }}
                  aria-pressed={isActive}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-600"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={dateRange.includes(":") || showCustomRange}
              onClick={() => {
                const existing = dateRange.split(":");
                setCustomStart(existing.length === 2 ? existing[0] : "");
                setCustomEnd(existing.length === 2 ? existing[1] : "");
                setShowCustomRange((open) => !open);
              }}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                dateRange.includes(":") || showCustomRange
                  ? "bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-600"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {t.adsWorkspace.custom}
            </button>
          </div>

          {/* Action 4: Sync Meta Button */}
          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700/80 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <svg
              className={`h-3.5 w-3.5 text-zinc-500 ${isSyncing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isSyncing ? (locale === "id" ? "Sinkron..." : "Syncing...") : (locale === "id" ? "Sinkronkan" : "Sync Now")}</span>
          </button>
        </div>
        </div>
        {showCustomRange && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!customStart || !customEnd || customStart > customEnd) return;
              setDateRange(`${customStart}:${customEnd}`);
              setShowCustomRange(false);
            }}
            className="flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:flex-row sm:items-end"
          >
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{locale === "id" ? "Mulai" : "Start"}</span>
              <input type="date" required value={customStart} max={customEnd || undefined} onChange={(event) => setCustomStart(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{locale === "id" ? "Sampai" : "End"}</span>
              <input type="date" required value={customEnd} min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" />
            </label>
            <button type="submit" disabled={!customStart || !customEnd || customStart > customEnd} className="btn-solar rounded-lg px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
              {locale === "id" ? "Terapkan" : "Apply"}
            </button>
            {customStart && customEnd && customStart > customEnd && (
              <span role="alert" className="text-[11px] text-rose-600">{locale === "id" ? "Tanggal mulai harus sebelum tanggal akhir." : "Start date must be on or before end date."}</span>
            )}
          </form>
        )}
      </div>

      {/* 2. Onboarding Status Bar */}
      <OnboardingStatusBar />

      {/* 3. Connection state */}
      {!isLoading && state === "not_connected" ? (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-950/20 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              💡
            </span>
            <div>
              <h2 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                {locale === "id" ? "Koneksi Meta Ads Langsung Belum Aktif" : "Direct Meta Ads Connection Not Active"}
              </h2>
              <p className="mt-0.5 text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                {locale === "id"
                  ? "Akun Meta belum terhubung pada organisasi ini. Hubungkan akun iklan di Pengaturan untuk memuat data aktual."
                  : "Meta is not connected for this organization. Connect an ad account in Settings to load actual data."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/settings"
              className="rounded-xl border border-indigo-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800 transition-colors"
            >
              {locale === "id" ? "Buka Pengaturan" : "Open Settings"}
            </Link>
          </div>
        </div>
      ) : null}

      {/* Loading Skeleton during Initial Dashboard Load */}
      {isLoading && !dashboardData && (
        <div className="space-y-6 animate-pulse" aria-label="Loading dashboard data">
          <div className="h-28 rounded-2xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="h-64 rounded-2xl border border-zinc-200/90 bg-white p-5 lg:col-span-7 dark:border-zinc-800 dark:bg-zinc-900" />
            <div className="h-64 rounded-2xl border border-zinc-200/90 bg-white p-5 lg:col-span-5 dark:border-zinc-800 dark:bg-zinc-900" />
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard
            title={t.dashboard.totalSpend}
            value={formatCurrency(summary.totalSpend)}
            subtitle={`${formatNumber(summary.totalImpressions)} ${locale === "id" ? "impresi" : "impressions"} · ${formatNumber(summary.totalClicks)} ${locale === "id" ? "klik" : "clicks"}`}
          />
          <KPICard
            title={locale === "id" ? "Prospek CRM" : "CRM prospects"}
            value={formatNumber(summary.totalLeads)}
            subtitle={locale === "id" ? "Pada akun dan periode ini" : "In this account and period"}
          />
          <KPICard
            title={locale === "id" ? "Qualified Leads" : "Qualified leads"}
            value={formatNumber(summary.qualifiedLeads)}
            subtitle={locale === "id" ? "Hot + Warm. Cold tidak dihitung." : "Hot + Warm. Cold is excluded."}
          />
          <KPICard
            title="CQPL"
            value={summary.cpql !== null ? formatCurrency(summary.cpql) : (locale === "id" ? "Tidak dapat dihitung" : "Cannot calculate")}
            subtitle={
              summary.cpql !== null && summary.totalSpend === 0
                ? (locale === "id" ? "Spend pada periode ini nol." : "Spend in this period is zero.")
                : (locale === "id" ? "Spend akun dibagi qualified lead." : "Account spend divided by qualified leads.")
            }
            highlight
          />
        </div>
      )}

      {/* 6. Middle Section: Property Funnel Pipeline & Attribution Integrity */}
      {summary && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column (7 Cols): Property Sales Pipeline */}
          <div className="rounded-2xl surface-card border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 surface-card lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {t.dashboard.pipelineTitle}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {t.dashboard.pipelineSubtitle}
                  </p>
                </div>
                <Link
                  href="/leads"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  <span>{t.dashboard.viewPipelineDetails}</span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {/* 6 Funnel Stage Cards */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {funnelStages.map((stage) => {
                  const count = funnelCounts[stage] || 0;
                  const percent = totalPipelineLeads > 0 ? Math.round((count / totalPipelineLeads) * 100) : 0;

                  return (
                    <div
                      key={stage}
                      className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 transition-colors dark:border-zinc-800/80 dark:bg-zinc-900/50"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <FunnelBadge stage={stage} />
                        <span className="text-[10px] font-mono text-zinc-400">
                          {percent}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="font-mono text-xl font-bold text-zinc-900 dark:text-zinc-50">
                          {count}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {locale === "id" ? "prospek" : "leads"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Pipeline Note & Upload Button */}
            <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {locale === "id"
                  ? "Tahap mengikuti catatan CRM. Pesan tidak mengubah tahap secara otomatis."
                  : "Stages follow the CRM record. Messages do not move a stage automatically."}
              </span>
            </div>
          </div>

          {/* Right Column (5 Cols): Attribution Health & Integrations */}
          <div className="rounded-2xl surface-card border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 surface-card lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {t.dashboard.attributionTitle}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {t.dashboard.attributionSubtitle}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold font-mono border ${verifiedPercent > 0 ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"}`}>
                  {verifiedPercent}% {locale === "id" ? "langsung" : "direct"}
                </span>
              </div>

              {/* Attribution Progress Breakdown */}
              <div className="mt-4 space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {t.dashboard.verifiedAttribution}
                    </span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {verifiedCount} {locale === "id" ? "prospek" : "leads"}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${summary.totalLeads > 0 ? (verifiedCount / summary.totalLeads) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      {t.dashboard.inferredAttribution}
                    </span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {inferredCount} {locale === "id" ? "prospek" : "leads"}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${summary.totalLeads > 0 ? (inferredCount / summary.totalLeads) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-zinc-400" />
                      {t.dashboard.unknownAttribution}
                    </span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {unknownCount} {locale === "id" ? "prospek" : "leads"}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-zinc-400 dark:bg-zinc-600 rounded-full transition-all duration-300"
                      style={{
                        width: `${summary.totalLeads > 0 ? (unknownCount / summary.totalLeads) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Source Status Badges */}
            <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">
                {locale === "id" ? "Konektor Aktif:" : "Active Source:"}
              </span>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                  Spreadsheet CRM
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Bottom Section: Top Performing Ads Leaderboard Table */}
      {summary && (
        <div className="rounded-2xl surface-card border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 surface-card transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                {t.dashboard.leaderboardTitle}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t.dashboard.leaderboardSubtitle}
              </p>
            </div>
            <Link
              href="/ads"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              <span>{t.dashboard.viewLeaderboardRecommendations}</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
                <tr>
                  <th className="py-3 pr-4 font-semibold">{t.dashboard.topAdsColumns.adName}</th>
                  <th className="px-3 py-3 font-semibold font-mono">{t.dashboard.topAdsColumns.spend}</th>
                  <th className="px-3 py-3 font-semibold font-mono">{t.dashboard.topAdsColumns.ctr}</th>
                  <th className="px-3 py-3 font-semibold">{t.dashboard.topAdsColumns.attributedLeads}</th>
                  <th className="px-3 py-3 font-semibold">{t.dashboard.topAdsColumns.qualifiedLeads}</th>
                  <th className="px-3 py-3 font-semibold font-mono">{t.dashboard.topAdsColumns.cpql}</th>
                  <th className="px-3 py-3 font-semibold text-right">{locale === "id" ? "Aksi" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-zinc-800 dark:text-zinc-200">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400 italic">
                      {locale === "id" ? "Belum ada iklan dengan data pembelanjaan pada periode ini." : "No ad spend records for this period."}
                    </td>
                  </tr>
                ) : (
                  leaderboard.slice(0, 5).map((ad) => (
                    <tr key={ad.adId} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/60 transition-colors">
                      <td className="py-3.5 pr-4">
                        <div className="max-w-xs sm:max-w-sm truncate font-semibold text-zinc-900 dark:text-zinc-100" title={ad.adName}>
                          {ad.adName}
                        </div>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                          {ad.campaignName}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(ad.spend)}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-zinc-600 dark:text-zinc-400">
                        {ad.ctr !== null ? `${ad.ctr}%` : "—"}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{ad.attributedLeadsCount}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            ({ad.attributionBreakdown.verified}V/{ad.attributionBreakdown.inferred}I)
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {ad.qualifiedLeadsCount}
                      </td>
                      <td className="px-3 py-3.5 font-mono font-semibold text-zinc-800 dark:text-zinc-100" title={ad.cpql === null ? (locale === "id" ? "Tidak dapat dihitung" : "Cannot calculate") : undefined}>
                        {ad.cpql !== null ? formatCurrency(ad.cpql) : "—"}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <Link
                          href={`/ads`}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-indigo-400 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <span>{locale === "id" ? "Analisis AI" : "AI Audit"}</span>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

