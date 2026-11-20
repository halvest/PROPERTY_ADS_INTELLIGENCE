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
  const renderStatusBadge = (status: string, label: string) => {
    const isLive = status === "ACTIVE" || status === "DELIVERING";
    const isPaused = status === "PAUSED" || status === "CAMPAIGN_PAUSED" || status === "AD_PAUSED";

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
          isLive
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20"
            : isPaused
            ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400 border-zinc-200/80 dark:border-white/[0.06]"
            : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/60 dark:border-amber-500/20"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isLive
              ? "bg-emerald-500 animate-pulse"
              : isPaused
              ? "bg-zinc-400 dark:bg-zinc-500"
              : "bg-amber-500"
          }`}
        />
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Compact Filter & Search Toolbar (Elevated Stacking Context for Dropdown Menus) */}
      <div className="relative z-40 overflow-visible flex flex-col gap-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200/60 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input with Shortcut Icon */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={i18n.searchPlaceholder}
              className="w-full h-9 pl-10 pr-4 text-xs rounded-xl bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-white/[0.06] focus:border-indigo-500/50 dark:focus:border-indigo-400/50 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none transition-all placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Spend Only Micro-Switch & Count Info */}
          <div className="flex flex-wrap items-center gap-4 justify-between sm:justify-end">
            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-300 select-none">
              <span>{i18n.spendOnly}</span>
              <input
                type="checkbox"
                checked={showOnlyWithSpend}
                onChange={(e) => onToggleSpendOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative h-4 w-7 rounded-full bg-zinc-300 dark:bg-zinc-700 peer-checked:bg-indigo-600 transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow-xs after:transition-transform peer-checked:after:translate-x-3" />
            </label>

            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {i18n.showing}{" "}
              <strong className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">{totalFilteredCount}</strong>{" "}
              {i18n.of} <span className="font-mono">{totalRawCount}</span> {i18n.ofAds}
            </span>
          </div>
        </div>

        {/* Active Filter Dropdowns & Chips slot */}
        {activeFilterChips && (
          <div className="relative z-40 overflow-visible pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
            {activeFilterChips}
          </div>
        )}
      </div>

      {/* 2. Borderless Data Table */}
      <div className="relative z-10 overflow-hidden rounded-2xl bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl border border-zinc-200/60 dark:border-white/[0.08] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-zinc-900/60 text-[11px] font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                <th scope="col" className="px-6 py-4 text-left">{i18n.adAndCampaign}</th>
                <th scope="col" className="px-4 py-4 text-left">{i18n.status}</th>
                <th scope="col" className="px-4 py-4 text-right tabular-nums">{i18n.spend}</th>
                <th scope="col" className="px-4 py-4 text-right tabular-nums">{i18n.resultsAndCpr}</th>
                <th scope="col" className="px-4 py-4 text-right tabular-nums">{i18n.impressions}</th>
                <th scope="col" className="px-4 py-4 text-right tabular-nums">{i18n.ctr}</th>
                <th scope="col" className="px-4 py-4 text-right tabular-nums">{i18n.cpc}</th>
                <th scope="col" className="px-6 py-4 text-right"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100/80 dark:divide-white/[0.05]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-3.5 w-48 rounded bg-zinc-200 dark:bg-zinc-800 mb-1.5" />
                      <div className="h-2.5 w-28 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                    </td>
                    <td className="px-4 py-4"><div className="h-5 w-24 rounded-full bg-zinc-100 dark:bg-zinc-800" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-3.5 w-20 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-3.5 w-20 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-3.5 w-14 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-3.5 w-12 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-3.5 w-14 ml-auto rounded bg-zinc-100 dark:bg-zinc-800" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-7 w-16 ml-auto rounded-lg bg-zinc-100 dark:bg-zinc-800" /></td>
                  </tr>
                ))
              ) : ads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {i18n.noResults}
                  </td>
                </tr>
              ) : (
                ads.map((ad) => (
                  <tr
                    key={ad.adId}
                    onClick={() => onSelectAd(ad.id)}
                    className="group cursor-pointer transition-colors duration-150 hover:bg-zinc-50/80 dark:hover:bg-white/[0.025]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {ad.adName}
                      </p>
                      <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                        {ad.campaignName}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {renderStatusBadge(ad.deliveryStatus, ad.deliveryLabel)}
                    </td>

                    <td className="px-4 py-4 text-right font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {ad.spendFormatted}
                    </td>

                    <td className="px-4 py-4 text-right tabular-nums">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {ad.resultsFormatted}
                      </span>
                      <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {ad.cprFormatted}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-right font-mono text-zinc-600 dark:text-zinc-300 tabular-nums">
                      {ad.impressionsFormatted}
                    </td>

                    <td className="px-4 py-4 text-right tabular-nums font-medium text-zinc-700 dark:text-zinc-200">
                      {ad.ctrFormatted}
                    </td>

                    <td className="px-4 py-4 text-right tabular-nums font-medium text-zinc-500 dark:text-zinc-400">
                      {ad.cpcFormatted}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {i18n.actionDetail}
                        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-100 dark:border-white/[0.06] bg-zinc-50/40 dark:bg-zinc-900/40">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {i18n.page || "Page"} <strong className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">{currentPage}</strong> {i18n.of}{" "}
              <span className="font-mono">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                {i18n.prev}
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                {i18n.next}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
