"use client";

import React, { useState, useEffect, useCallback } from "react";
import type {
  ScrapedCompetitorAd,
  MarketPulseSummary,
  LongevityPhase,
  FunnelType,
} from "@/lib/ads-spying/types";
import { MarketPulseBanner } from "@/components/ads-spying/MarketPulseBanner";
import { CompetitorAdCard } from "@/components/ads-spying/CompetitorAdCard";

const POPULAR_KEYWORDS = [
  "rumah bsd",
  "rumah bintaro",
  "rumah bandung",
  "rumah surabaya",
  "apartemen jakarta",
  "cluster mewah",
  "promo dp 0%",
];

export default function AdsSpyingAiPage() {
  const [keyword, setKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [longevityPhase, setLongevityPhase] = useState<LongevityPhase | "ALL">("ALL");
  const [funnelType, setFunnelType] = useState<FunnelType | "ALL">("ALL");
  const [isScalingOnly, setIsScalingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"longevity" | "scaling" | "recency">("longevity");

  const [ads, setAds] = useState<ScrapedCompetitorAd[]>([]);
  const [pulse, setPulse] = useState<MarketPulseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);

  // 1. Fetch Ads & Market Pulse
  const fetchAds = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeKeyword) params.set("keyword", activeKeyword);
      if (longevityPhase !== "ALL") params.set("longevity_phase", longevityPhase);
      if (funnelType !== "ALL") params.set("funnel_type", funnelType);
      if (isScalingOnly) params.set("is_scaling_only", "true");
      params.set("sort_by", sortBy);

      const res = await fetch(`/api/ads-spying/ads?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setAds(data.ads || []);
        setPulse(data.pulse || null);
      }
    } catch (err) {
      console.error("[AdsSpyingAiPage] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeKeyword, longevityPhase, funnelType, isScalingOnly, sortBy]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // 2. Handle Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveKeyword(keyword.trim());
  };

  const handleSelectPillKeyword = (kw: string) => {
    setKeyword(kw);
    setActiveKeyword(kw);
  };

  // 3. Trigger Scrape Job
  const handleTriggerScrape = async () => {
    const targetKw = activeKeyword || keyword.trim() || "rumah bsd";
    setIsScraping(true);
    setScrapeMessage(null);
    try {
      const res = await fetch("/api/ads-spying/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: targetKw }),
      });
      const data = await res.json();
      if (data.success) {
        setScrapeMessage(data.message || `Scrape sinkronisasi '${targetKw}' selesai.`);
        fetchAds();
      }
    } catch {
      setScrapeMessage("Gagal memicu worker scraper.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleAdUpdated = (updated: ScrapedCompetitorAd) => {
    setAds((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 pb-4 dark:border-zinc-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <span>Ads Spying AI</span>
            <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              Meta Ad Library ID
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Intelijen kompetitor properti Indonesia: pantau iklan tahan lama (Evergreen), dekonstruksi skrip WhatsApp, dan safe zone Meta Ads.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTriggerScrape}
          disabled={isScraping}
          className="btn-solar flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          {isScraping ? (
            <>
              <div className="h-3.5 w-3.5 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin" />
              <span>Menyadap GraphQL...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Sinkronisasi Scraper</span>
            </>
          )}
        </button>
      </div>

      {scrapeMessage && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 flex items-center justify-between animate-in fade-in">
          <span>✨ {scrapeMessage}</span>
          <button
            type="button"
            onClick={() => setScrapeMessage(null)}
            className="text-amber-700 hover:text-amber-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Search Omnibar & Quick Keyword Chips */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <svg
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-zinc-400 dark:text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Cari kompetitor atau kata kunci: e.g. 'rumah bsd', 'bintaro', 'summarecon', 'dp 0%', 'villa bali'..."
            className="w-full rounded-2xl border border-zinc-200/90 bg-white py-3 pl-10 pr-24 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 shadow-2xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <button
            type="submit"
            className="btn-solar absolute right-2 rounded-xl px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
          >
            Cari Iklan
          </button>
        </form>

        {/* Quick Keyword Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
            Topik Populer:
          </span>
          {POPULAR_KEYWORDS.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => handleSelectPillKeyword(kw)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium shrink-0 transition-all cursor-pointer ${
                activeKeyword === kw
                  ? "bg-amber-500/20 text-amber-700 border border-amber-500/50 dark:text-amber-300 font-semibold"
                  : "bg-white border border-zinc-200/90 text-zinc-600 hover:border-amber-500/40 hover:bg-amber-50/20 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
              }`}
            >
              #{kw}
            </button>
          ))}
          {activeKeyword && (
            <button
              type="button"
              onClick={() => {
                setActiveKeyword("");
                setKeyword("");
              }}
              className="rounded-full bg-zinc-200 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
            >
              Reset Filter ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Market Pulse Aggregator Banner */}
      {pulse && <MarketPulseBanner pulse={pulse} keyword={activeKeyword} />}

      {/* 4. Deterministic Winning Radar & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex flex-wrap items-center gap-2">
          {/* Longevity Filter Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl dark:bg-zinc-850">
            <button
              type="button"
              onClick={() => setLongevityPhase("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                longevityPhase === "ALL"
                  ? "bg-white text-zinc-950 font-semibold shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Semua Fase
            </button>
            <button
              type="button"
              onClick={() => setLongevityPhase("EVERGREEN")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                longevityPhase === "EVERGREEN"
                  ? "bg-emerald-600 text-white font-semibold shadow-xs"
                  : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-zinc-800"
              }`}
            >
              <span>🏆</span>
              <span>Evergreen (≥ 15h)</span>
            </button>
            <button
              type="button"
              onClick={() => setLongevityPhase("VALIDATING")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                longevityPhase === "VALIDATING"
                  ? "bg-blue-600 text-white font-semibold shadow-xs"
                  : "text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-zinc-800"
              }`}
            >
              Validating (5–14h)
            </button>
            <button
              type="button"
              onClick={() => setLongevityPhase("TESTING")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                longevityPhase === "TESTING"
                  ? "bg-white text-zinc-950 font-semibold shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Testing (1–4h)
            </button>
          </div>

          {/* Funnel Type Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 hidden sm:inline">Funnel:</span>
            <select
              value={funnelType}
              onChange={(e) => setFunnelType(e.target.value as FunnelType | "ALL")}
              className="rounded-xl border border-zinc-200/90 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="ALL">Semua Funnel</option>
              <option value="CTWA">📲 CTWA WhatsApp</option>
              <option value="LANDING_PAGE">📄 Landing Page</option>
              <option value="LEAD_FORM">📋 Instant Lead Form</option>
            </select>
          </div>

          {/* Scaling Only Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer select-none pl-2">
            <input
              type="checkbox"
              checked={isScalingOnly}
              onChange={(e) => setIsScalingOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-amber-500 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <span>🔥 Hanya Scaling (≥ 3 Varian)</span>
          </label>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Urutkan:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "longevity" | "scaling" | "recency")}
            className="rounded-xl border border-zinc-200/90 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-800 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value="longevity">Durasi Terlama (Longevity Winner)</option>
            <option value="scaling">Varian Terbanyak (Aggressive Scaling)</option>
            <option value="recency">Tanggal Mulai Terbaru</option>
          </select>
        </div>
      </div>

      {/* 5. Competitor Ads Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[520px] rounded-2xl border border-zinc-200/80 bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/40 animate-pulse flex flex-col justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-32 rounded bg-zinc-300 dark:bg-zinc-700" />
                  <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
              <div className="h-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-zinc-300 dark:bg-zinc-700" />
                <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      ) : ads.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-12 text-center space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Tidak Ada Iklan yang Sesuai Filter
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Tidak ditemukan iklan kompetitor dengan kata kunci atau filter yang Anda pilih. Coba reset filter atau gunakan kata kunci lain.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveKeyword("");
              setKeyword("");
              setLongevityPhase("ALL");
              setFunnelType("ALL");
              setIsScalingOnly(false);
            }}
            className="btn-solar inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ads.map((ad) => (
            <CompetitorAdCard key={ad.id} ad={ad} onAdUpdated={handleAdUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
