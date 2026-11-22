"use client";

import React from "react";

export interface PremiumAdRow {
  id: string;
  adId: string;
  adName: string;
  campaignName: string;
  deliveryStatus: "ACTIVE" | "PAUSED" | "CAMPAIGN_PAUSED" | "NOT_DELIVERING" | string;
  deliveryLabel: string;
  spendFormatted: string;
  spendRaw?: number | null;
  resultsFormatted: string;
  cprFormatted: string;
  impressionsFormatted: string;
  ctrFormatted: string;
  cpcFormatted: string;
}

interface PremiumAdsTableProps {
  ads: PremiumAdRow[];
  totalFilteredCount: number;
  totalRawCount: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showOnlyWithSpend: boolean;
  onToggleSpendOnly: (checked: boolean) => void;
  onSelectAd: (adId: string) => void;
  isLoading?: boolean;
  activeFilterChips?: React.ReactNode;
  i18n: {
    searchPlaceholder: string;
    spendOnly: string;
    adAndCampaign: string;
    status: string;
    spend: string;
    resultsAndCpr: string;
    impressions: string;
    ctr: string;
    cpc: string;
    actionDetail: string;
    noResults: string;
    showing: string;
    of: string;
    ofAds: string;
    page?: string;
    prev: string;
    next: string;
  };
}

export function PremiumAdsTable({
  ads,
  totalFilteredCount,
  totalRawCount,
  currentPage,
  totalPages,
  onPageChange,
  searchQuery,
  onSearchChange,
  showOnlyWithSpend,
  onToggleSpendOnly,
  onSelectAd,
  isLoading = false,
  activeFilterChips,
  i18n,
}: PremiumAdsTableProps) {
  const maxPageSpend = React.useMemo(() => {
    let max = 0;
    for (const a of ads) {
      if (typeof a.spendRaw === "number" && a.spendRaw > max) {
        max = a.spendRaw;
      }
    }
    return max;
  }, [ads]);

  const renderStatusBadge = (status: string, label: string) => {
    const isLive = status === "ACTIVE" || status === "DELIVERING";
    const isPaused =
      status === "PAUSED" ||
      status === "CAMPAIGN_PAUSED" ||
      status === "AD_PAUSED" ||
      status === "NOT_DELIVERING";

    return (
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
          isLive
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25"
            : isPaused
            ? "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20"
            : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isLive
              ? "bg-emerald-500"
              : isPaused
              ? "bg-zinc-400 dark:bg-zinc-500"
              : "bg-amber-500"
          }`}
        />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="relative rounded-2xl border border-zinc-200/80 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
      {/* =====================================================================
          1. UNIFIED EXECUTIVE TOOLBAR & FILTER HEADER
         ===================================================================== */}
      <div className="relative z-30 flex flex-col gap-3.5 border-b border-zinc-200/80 bg-zinc-50/40 p-4 sm:px-5 sm:py-4 dark:border-zinc-800 dark:bg-zinc-900/50 rounded-t-2xl">
        {/* Top Row: Search Input + Spend Filter Toggle + Count Pill */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={i18n.searchPlaceholder}
              className="h-9 w-full rounded-lg border border-zinc-200/90 bg-white pl-9 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 shadow-2xs transition-all focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
            {/* Tactile Spend-Only Filter Pill */}
            <label
              className={`inline-flex h-9 items-center gap-2.5 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer select-none ${
                showOnlyWithSpend
                  ? "border-zinc-300 bg-white text-zinc-900 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-200/80 bg-zinc-100/70 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400"
              }`}
            >
              <input
                type="checkbox"
                checked={showOnlyWithSpend}
                onChange={(e) => onToggleSpendOnly(e.target.checked)}
                className="sr-only peer"
              />
              <span
                className={`relative h-4 w-7 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow-2xs after:transition-transform ${
                  showOnlyWithSpend
                    ? "bg-zinc-900 dark:bg-indigo-600 after:translate-x-3"
                    : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              />
              <span>{i18n.spendOnly}</span>
            </label>

            {/* Count Summary Badge */}
            <div className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-3 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <span>{i18n.showing}</span>
              <strong className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {totalFilteredCount}
              </strong>
              <span>{i18n.of}</span>
              <span className="font-mono font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                {totalRawCount}
              </span>
              <span>{i18n.ofAds}</span>
            </div>
          </div>
        </div>

        {/* Second Row: Integrated Filter Dropdowns & Active Chips */}
        {activeFilterChips && (
          <div className="relative z-30 overflow-visible pt-1">
            {activeFilterChips}
          </div>
        )}
      </div>

      {/* =====================================================================
          2. HIGH-PRECISION META ADS PERFORMANCE TABLE
         ===================================================================== */}
      <div className="relative z-10 overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
              <th scope="col" className="px-5 py-3 text-left">
                {i18n.adAndCampaign}
              </th>
              <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">
                {i18n.status}
              </th>
              <th scope="col" className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                {i18n.spend}
              </th>
              <th scope="col" className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                {i18n.resultsAndCpr}
              </th>
              <th scope="col" className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                {i18n.impressions}
              </th>
              <th scope="col" className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                {i18n.ctr}
              </th>
              <th scope="col" className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                {i18n.cpc}
              </th>
              <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">
                <span className="sr-only">{i18n.actionDetail}</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-44 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-2.5 w-28 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-6 w-24 rounded-md bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="h-3.5 w-20 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="h-3.5 w-20 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="h-3.5 w-14 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="h-3.5 w-12 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="h-3.5 w-14 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="h-7 w-16 ml-auto rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                </tr>
              ))
            ) : ads.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-14 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400"
                >
                  {i18n.noResults}
                </td>
              </tr>
            ) : (
              ads.map((ad) => {
                const isLive =
                  ad.deliveryStatus === "ACTIVE" || ad.deliveryStatus === "DELIVERING";
                const spendBarPct =
                  maxPageSpend > 0 && typeof ad.spendRaw === "number" && ad.spendRaw > 0
                    ? Math.max(6, Math.min(100, Math.round((ad.spendRaw / maxPageSpend) * 100)))
                    : 0;

                return (
                  <tr
                    key={ad.adId}
                    onClick={() => onSelectAd(ad.id)}
                    className="group cursor-pointer transition-colors duration-150 hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40"
                  >
                    {/* Col 1: Ad Name + Campaign Name with Creative Visual Anchor */}
                    <td className="px-5 py-3.5 max-w-[320px]">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors ${
                            isLive
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/20"
                              : "bg-zinc-100 text-zinc-500 ring-zinc-500/15 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"
                          }`}
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                          >
                            <rect x="3" y="4" width="18" height="16" rx="2.5" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 9l5 3-5 3V9z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                            title={ad.adName}
                          >
                            {ad.adName}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            <svg
                              className="h-3 w-3 shrink-0 text-zinc-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                              />
                            </svg>
                            <span className="truncate" title={ad.campaignName}>
                              {ad.campaignName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Status Tayang */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderStatusBadge(ad.deliveryStatus, ad.deliveryLabel)}
                    </td>

                    {/* Col 3: Total Belanja + Proportional Micro-Bar */}
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                        {ad.spendFormatted}
                      </span>
                      {spendBarPct > 0 && (
                        <div className="mt-1.5 ml-auto h-1 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-zinc-800 dark:bg-zinc-300"
                            style={{ width: `${spendBarPct}%` }}
                          />
                        </div>
                      )}
                    </td>

                    {/* Col 4: Hasil & CPR */}
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                        {ad.resultsFormatted}
                      </span>
                      <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {ad.cprFormatted}
                      </span>
                    </td>

                    {/* Col 5: Tayangan */}
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                      {ad.impressionsFormatted}
                    </td>

                    {/* Col 6: CTR Tautan */}
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-zinc-100/90 px-2 py-0.5 text-xs font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-500/15 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-400/15">
                        {ad.ctrFormatted}
                      </span>
                    </td>

                    {/* Col 7: CPC Tautan */}
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-medium text-zinc-600 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                      {ad.cpcFormatted}
                    </td>

                    {/* Col 8: Non-Wrapping Tactile Detail Button */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-2xs transition-all group-hover:border-zinc-900 group-hover:bg-zinc-900 group-hover:text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:group-hover:border-zinc-100 dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900">
                        <span>{i18n.actionDetail}</span>
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================================================
          3. FOOTER PAGINATION BAR
         ===================================================================== */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 rounded-b-2xl">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {i18n.page || "Halaman"}{" "}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
              {currentPage}
            </strong>{" "}
            {i18n.of} <span className="font-mono tabular-nums">{totalPages}</span>
          </span>

          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              ← {i18n.prev}
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              {i18n.next} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
