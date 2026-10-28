"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface CTWAFunnelPanelProps {
  impressions: number;
  linkClicks: number;
  conversations: number | null;
  linkCtr: number | null;
  results?: number | null;
  resultLabel?: string;
}

export function CTWAFunnelPanel({
  impressions,
  linkClicks,
  conversations,
  linkCtr,
  results,
  resultLabel = "Hasil",
}: CTWAFunnelPanelProps) {
  const { formatNumber, locale } = useI18n();

  const isMessaging = Boolean(conversations && conversations > 0);
  const effectiveCount = isMessaging ? conversations : (results ?? null);

  const localizedResultName = isMessaging
    ? locale === "id"
      ? "Percakapan"
      : "Conversations"
    : locale === "id"
    ? resultLabel || "Hasil"
    : resultLabel?.toLowerCase() === "hasil"
    ? "Results"
    : resultLabel || "Results";

  const formattedRate = (val: number) => {
    const s = val.toFixed(2);
    return locale === "id" ? `${s.replace(".", ",")}%` : `${s}%`;
  };

  const calculatedCtr =
    linkCtr !== null
      ? formattedRate(linkCtr)
      : impressions > 0
      ? formattedRate((linkClicks / impressions) * 100)
      : "0,00%";

  const clickToResultRate =
    effectiveCount !== null && linkClicks > 0
      ? formattedRate((effectiveCount / linkClicks) * 100)
      : "0,00%";

  return (
    <section
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#0c0e14]"
      aria-labelledby="ctwa-funnel-title"
    >
      {/* Header */}
      <div>
        <h2
          id="ctwa-funnel-title"
          className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          {locale === "id" ? "Funnel konversi hasil" : "Result conversion funnel"}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {locale === "id"
            ? "Dari tayangan sampai hasil. Data langsung dari Meta Marketing API."
            : "From impressions to results. Sourced directly from Meta Marketing API."}
        </p>
      </div>

      {/* 3-Stage Connected Funnel Flow (matching reference image) */}
      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-2 lg:gap-3">
        {/* Stage 1: Tayangan (Impressions) */}
        <div className="flex-1 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 sm:p-5 transition-colors dark:border-zinc-800/80 dark:bg-[#11141d]">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {locale === "id" ? "Tayangan" : "Impressions"}
          </p>
          <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatNumber(impressions)}
          </p>
        </div>

        {/* Transition Connector 1: CTR & Arrow */}
        <div className="flex flex-col items-center justify-center shrink-0 px-1 py-1 text-center">
          <span className="inline-flex items-center rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            CTR {calculatedCtr}
          </span>
          <div className="my-1 text-zinc-400 dark:text-zinc-600">
            <svg width="42" height="10" viewBox="0 0 42 10" fill="none" aria-hidden="true">
              <path d="M0 5H39M39 5L33 1.5M39 5L33 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {locale === "id" ? "klik / tayangan" : "clicks / impressions"}
          </span>
        </div>

        {/* Stage 2: Klik Tautan (Link Clicks) */}
        <div className="flex-1 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 sm:p-5 transition-colors dark:border-zinc-800/80 dark:bg-[#11141d]">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {locale === "id" ? "Klik tautan" : "Link clicks"}
          </p>
          <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatNumber(linkClicks)}
          </p>
        </div>

        {/* Transition Connector 2: Conv Rate & Arrow */}
        <div className="flex flex-col items-center justify-center shrink-0 px-1 py-1 text-center">
          <span className="inline-flex items-center rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            {clickToResultRate}
          </span>
          <div className="my-1 text-zinc-400 dark:text-zinc-600">
            <svg width="42" height="10" viewBox="0 0 42 10" fill="none" aria-hidden="true">
              <path d="M0 5H39M39 5L33 1.5M39 5L33 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {locale === "id" ? `hasil / klik` : `results / clicks`}
          </span>
        </div>

        {/* Stage 3: Hasil dari Meta (Highlighted Box) */}
        <div className="flex-1 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 sm:p-5 transition-colors dark:border-zinc-800/80 dark:bg-[#11141d]">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {locale === "id" ? `Hasil dari Meta` : `Meta ${localizedResultName}`}
          </p>
          <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            {effectiveCount === null ? "—" : formatNumber(effectiveCount)}
          </p>
        </div>
      </div>
    </section>
  );
}
