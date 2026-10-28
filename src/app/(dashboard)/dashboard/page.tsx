"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { KPICard } from "@/components/ui/KPICard";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { OnboardingStatusBar } from "@/components/dashboard/OnboardingStatusBar";
import { FunnelBadge, ScorePill } from "@/components/ui/Badge";
import { CRMLeadsUploadModal } from "@/components/crm/CRMLeadsUploadModal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { LiveDashboardResponse } from "@/lib/data/live-dashboard-service";

export default function DashboardPage() {
  const { t, formatCurrency, formatNumber, locale } = useI18n();
  const { addToast } = useToast();

  const [dateRange, setDateRange] = useState("all");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<LiveDashboardResponse | null>(null);

  // Demo mode is decided by the server (DATA_MODE); the client only reflects
  // the isDemoMode flag returned in the dashboard response.
  const refreshDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/summary?dateRange=${dateRange}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDashboardData(json.data);
          setIsDemoMode(Boolean(json.data.isDemoMode));
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
        const res = await fetch(`/api/dashboard/summary?dateRange=${dateRange}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success && json.data) {
            setDashboardData(json.data);
            setIsDemoMode(Boolean(json.data.isDemoMode));
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
        body: JSON.stringify({ allowDemoFallback: false }),
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
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

        {/* Global Filter & Primary Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: Upload CRM Leads Spreadsheet */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{locale === "id" ? "Unggah Prospek CRM" : "Upload CRM Leads"}</span>
          </button>

          {/* Action 2: Quick Template Download */}
          <a
            href="/api/leads/template?format=xlsx"
            download="template_crm_leads_hdcreative.xlsx"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title={locale === "id" ? "Unduh template Excel resmi" : "Download official Excel template"}
          >
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">{locale === "id" ? "Template .xlsx" : "Template .xlsx"}</span>
          </a>

          {/* Action 3: Date Range Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hidden sm:inline">
              {t.common.period}:
            </span>
            <DateRangeFilter currentRange={dateRange} onChange={setDateRange} />
          </div>

          {/* Action 4: Sync Meta Button */}
          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-50 transition-colors"
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

      {/* 2. Onboarding Status Bar */}
      <OnboardingStatusBar />

      {/* 3. Live vs Demo Environment Banner */}
      {!isDemoMode && state === "not_connected" ? (
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
                  ? "Akun Meta live belum terhubung pada organisasi ini. Anda dapat mengaktifkan 'Mode Demo' untuk meninjau data simulasi eksekutif lengkap, atau menghubungkan akun iklan di Pengaturan."
                  : "Live Meta account is not yet connected for this organization. You can enable Demo Mode to view simulated executive data, or connect your ad account in Settings."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDemoMode(true)}
              className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              {locale === "id" ? "Aktifkan Mode Simulasi Demo" : "Enable Demo Simulation"}
            </button>
            <Link
              href="/settings"
              className="rounded-xl border border-indigo-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800 transition-colors"
            >
              {locale === "id" ? "Buka Pengaturan" : "Open Settings"}
            </Link>
          </div>
        </div>
      ) : isDemoMode ? (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/30 p-3.5 px-4 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">⚠️</span>
            <div>
              <span className="font-bold uppercase tracking-wider text-[11px] bg-amber-200/60 dark:bg-amber-900/50 px-2 py-0.5 rounded-md mr-2 text-amber-900 dark:text-amber-200">
                {locale === "id" ? "Mode Simulasi Demo" : "Demo Simulation"}
              </span>
              <span>
                {locale === "id"
                  ? "Menampilkan portofolio simulasi iklan properti BSD dan data kualifikasi prospek."
                  : "Displaying simulated property advertising portfolio and prospect qualification metrics."}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDemoMode(false)}
            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-amber-500 transition-colors shrink-0 cursor-pointer"
          >
            {locale === "id" ? "Beralih ke Live Data" : "Switch to Live Data"}
          </button>
        </div>
      ) : null}

      {/* 4. Executive Hero Verdict Card */}
      {summary && (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-[#0c0e14]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {locale === "id" ? "Status Portofolio: Sehat & Terkendali" : "Portfolio Status: Healthy & Controlled"}
                </span>
                <span className="text-xs text-zinc-400">
                  • {summary.totalLeads} {locale === "id" ? "Total Prospek Masuk" : "Total Inbound Leads"}
                </span>
              </div>

              <h2 className="mt-2.5 text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {locale === "id"
                  ? "Efektivitas Belanja Iklan Menghasilkan Lead Berkualitas Tinggi"
                  : "Ad Spend Effectiveness Generating High-Quality Buyer Prospects"}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
                {locale === "id"
                  ? `${summary.qualifiedLeads} dari ${summary.totalLeads} prospek terverifikasi memiliki daya beli cocok (Buyer Score ≥ 70) dengan konfirmasi survei lokasi. Biaya per lead potensial (CPQL) tercatat ${summary.cpql !== null ? formatCurrency(summary.cpql) : "—"}.`
                  : `${summary.qualifiedLeads} of ${summary.totalLeads} leads are qualified with confirmed purchase intent (Buyer Score ≥ 70) and scheduled surveys. Cost per qualified lead is ${summary.cpql !== null ? formatCurrency(summary.cpql) : "—"}.`}
              </p>
            </div>

            {/* Quick Metrics Capsule */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 pt-2 md:pt-0">
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 px-4 dark:border-zinc-800/80 dark:bg-zinc-900/60">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  {locale === "id" ? "Total Belanja" : "Total Spend"}
                </span>
                <span className="mt-0.5 text-base sm:text-lg font-bold font-mono text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(summary.totalSpend)}
                </span>
              </div>

              <div className="rounded-xl border border-indigo-500/30 bg-indigo-50/40 p-3 px-4 dark:border-indigo-500/20 dark:bg-indigo-950/20">
                <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 block">
                  {locale === "id" ? "CPQL Efektif" : "Effective CPQL"}
                </span>
                <span className="mt-0.5 text-base sm:text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  {summary.cpql !== null ? formatCurrency(summary.cpql) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Primary KPI Cards Grid (4 Key Dimensions) */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title={t.dashboard.totalSpend}
            value={formatCurrency(summary.totalSpend)}
            subtitle={`${formatNumber(summary.totalImpressions)} ${locale === "id" ? "impresi" : "impressions"} • ${formatNumber(summary.totalClicks)} ${locale === "id" ? "klik" : "clicks"}`}
            formulaLabel="Total Spend"
          />

          <KPICard
            title={t.dashboard.cpqlTitle}
            value={summary.cpql !== null ? formatCurrency(summary.cpql) : "—"}
            subtitle={
              summary.qualifiedLeads > 0
                ? `${summary.qualifiedLeads} ${locale === "id" ? "lead lolos kualifikasi beli" : "leads meet qualification criteria"}`
                : locale === "id" ? "Belum ada lead berkualifikasi pada periode ini" : "No qualified leads in this period"
            }
            formulaLabel="Spend / Qualified"
            highlight
          />

          <KPICard
            title={t.dashboard.buyerScoreTitle}
            value={summary.avgBuyerScore !== null ? `${summary.avgBuyerScore} / 100` : "—"}
            sampleSize={summary.buyerScoreSampleSize}
            subtitle={locale === "id" ? "Kesiapan & daya beli calon pembeli" : "Buyer readiness & purchasing capacity"}
            formulaLabel="Avg Buyer Score"
          />

          <KPICard
            title={t.dashboard.salesScoreTitle}
            value={summary.avgSalesScore !== null ? `${summary.avgSalesScore} / 100` : "—"}
            sampleSize={summary.salesScoreSampleSize}
            subtitle={locale === "id" ? "Kecepatan respons & relevansi konsultasi sales" : "Sales response speed & query relevance"}
            formulaLabel="Avg Sales Score"
          />
        </div>
      )}

      {/* 6. Middle Section: Property Funnel Pipeline & Attribution Integrity */}
      {summary && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column (7 Cols): Property Sales Pipeline */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-[#0c0e14] lg:col-span-7 flex flex-col justify-between">
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
            <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {locale === "id"
                  ? "Tahap funnel diperbarui otomatis via audit pesan dan impor CRM Spreadsheet."
                  : "Funnel stages updated automatically via conversation audit and CRM Spreadsheet import."}
              </span>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
              >
                + {locale === "id" ? "Update Tahap via Excel" : "Update via Excel"}
              </button>
            </div>
          </div>

          {/* Right Column (5 Cols): Attribution Health & Integrations */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-[#0c0e14] lg:col-span-5 flex flex-col justify-between">
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
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  {verifiedPercent}% Verified
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
                <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-500 dark:text-zinc-400">
                  WhatsApp (Soon)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Bottom Section: Top Performing Ads Leaderboard Table */}
      {summary && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-[#0c0e14] transition-colors">
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
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
                <tr>
                  <th className="py-3 pr-4 font-semibold">{t.dashboard.topAdsColumns.adName}</th>
                  <th className="px-3 py-3 font-semibold font-mono">{t.dashboard.topAdsColumns.spend}</th>
                  <th className="px-3 py-3 font-semibold font-mono">{t.dashboard.topAdsColumns.ctr}</th>
                  <th className="px-3 py-3 font-semibold">{t.dashboard.topAdsColumns.attributedLeads}</th>
                  <th className="px-3 py-3 font-semibold">{t.dashboard.topAdsColumns.qualifiedLeads}</th>
                  <th className="px-3 py-3 font-semibold font-mono">{t.dashboard.topAdsColumns.cpql}</th>
                  <th className="px-3 py-3 font-semibold">{t.dashboard.topAdsColumns.buyerScore}</th>
                  <th className="px-3 py-3 font-semibold text-right">{locale === "id" ? "Aksi" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-zinc-800 dark:text-zinc-200">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400 italic">
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
                      <td className="px-3 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {ad.cpql !== null ? formatCurrency(ad.cpql) : "—"}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <ScorePill score={ad.avgBuyerScore} />
                          <span className="text-[10px] text-zinc-400 font-mono">
                            (n={ad.buyerScoreSampleSize})
                          </span>
                        </div>
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

      {/* 8. CRM Leads Upload Modal Component */}
      <CRMLeadsUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          refreshDashboard();
        }}
      />
    </div>
  );
}

