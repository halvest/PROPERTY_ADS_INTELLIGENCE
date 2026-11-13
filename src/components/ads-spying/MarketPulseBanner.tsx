"use client";

import React from "react";
import type { MarketPulseSummary } from "@/lib/ads-spying/types";

export interface MarketPulseBannerProps {
  pulse: MarketPulseSummary;
  keyword?: string;
}

export function MarketPulseBanner({ pulse, keyword }: MarketPulseBannerProps) {
  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-zinc-800/90 dark:bg-zinc-900/80 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <span>Market Pulse Radar (Kompetitor Properti Indonesia)</span>
              {keyword && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-mono font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  &ldquo;{keyword}&rdquo;
                </span>
              )}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Metrik deterministik nyata dari GraphQL Meta Ad Library tanpa fabrikasi angka CTR/Spend.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Realtime Ad Library Snapshot (Country: ID)</span>
        </div>
      </div>

      {/* Grid of 5 Pulse Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* 1. Total Ads */}
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Total Iklan Terdeteksi
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
              {pulse.total_ads}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              ({pulse.active_ads} Aktif)
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Rata-rata {pulse.avg_active_days} hari tayang
          </span>
        </div>

        {/* 2. Evergreen Ratio */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 p-3 dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Evergreen Winning Ratio
            </span>
            <span className="text-xs">🏆</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300 font-mono">
              {pulse.evergreen_ratio_pct}%
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              ({pulse.evergreen_count} Iklan)
            </span>
          </div>
          <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">
            Bertahan aktif ≥ 15 hari
          </span>
        </div>

        {/* 3. Aggressive Scaling */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-50/40 p-3 dark:border-amber-500/20 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Aggressive Scaling
            </span>
            <span className="text-xs">🔥</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300 font-mono">
              {pulse.scaling_count}
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              Kampanye
            </span>
          </div>
          <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
            Dijalankan ≥ 3 variasi serentak
          </span>
        </div>

        {/* 4. Top Funnel Destination */}
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Dominan Funnel
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
              {pulse.top_funnel.type}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold font-mono">
              {pulse.top_funnel.percentage}%
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {pulse.top_funnel.type === "CTWA" ? "Click-to-WhatsApp Lead" : pulse.top_funnel.type}
          </span>
        </div>

        {/* 5. Dominant Media Format */}
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40 col-span-2 md:col-span-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Format Media Pilihan
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
              {pulse.dominant_format.format}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold font-mono">
              {pulse.dominant_format.percentage}%
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {pulse.dominant_format.format === "IMAGE" ? "Single Image Poster 4:5" : "Video Format"}
          </span>
        </div>
      </div>

      {/* 6. Top Offer Keywords Badges */}
      {pulse.top_offer_keywords && pulse.top_offer_keywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-1">
            Top Offer Keywords Pasar:
          </span>
          {pulse.top_offer_keywords.map((kw, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            >
              <span>{kw.term}</span>
              <span className="font-mono text-[10px] opacity-75">({kw.count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
