"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { ScrapedCompetitorAd, GroundedAdAnalysis } from "@/lib/ads-spying/types";
import { SafeZoneOverlay } from "./SafeZoneOverlay";
import { WhatsAppScriptCard } from "./WhatsAppScriptCard";
import { AiTeardownModal } from "./AiTeardownModal";

export interface CompetitorAdCardProps {
  ad: ScrapedCompetitorAd;
  onAdUpdated?: (updated: ScrapedCompetitorAd) => void;
}

function renderHighlightedText(text: string) {
  if (!text) return null;
  const regex = /(Rp[\s\d.,]+|[\d.,]+\s*(?:Juta|Miliar|jt|M)|(?:\d+[\s]*%)|(?:DP\s*[\d%a-zA-Z]+)|(?:\d+\s*(?:KM|Menit|Meter|m2|LB|LT)))/gi;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (regex.test(part)) {
      return (
        <span
          key={i}
          className="rounded bg-amber-500/15 px-1 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export function CompetitorAdCard({ ad, onAdUpdated }: CompetitorAdCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTeardownOpen, setIsTeardownOpen] = useState(false);

  const mediaItem = ad.cos_media_urls?.[0];
  const primaryMediaUrl = mediaItem?.url || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080";
  const isVideo = ad.media_format === "VIDEO" || mediaItem?.type === "video";

  const formattedStartDate = new Date(ad.start_date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handleAnalysisUpdated = (analysis: GroundedAdAnalysis) => {
    const updated = {
      ...ad,
      ai_analysis: analysis,
      ai_analyzed_at: new Date().toISOString(),
    };
    if (onAdUpdated) onAdUpdated(updated);
  };

  return (
    <>
      <div className="flex flex-col rounded-2xl border border-zinc-200/90 bg-white shadow-2xs transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/90 dark:bg-zinc-900 overflow-hidden">
        {/* 1. Header: Page Info & Longevity Status */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={ad.page_profile_uri || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=80"}
                alt={ad.page_name}
                className="h-10 w-10 shrink-0 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
              />
              <div className="min-w-0">
                <h3 className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1">
                  <span>{ad.page_name}</span>
                  <svg className="h-3.5 w-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </h3>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Tayang sejak {formattedStartDate}
                </span>
              </div>
            </div>

            {/* Longevity Phase Pill */}
            <div className="shrink-0">
              {ad.longevity_phase === "EVERGREEN" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <span>🏆</span>
                  <span>EVERGREEN ({ad.active_days_count} Hari)</span>
                </span>
              ) : ad.longevity_phase === "VALIDATING" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  <span>⚡</span>
                  <span>VALIDATING ({ad.active_days_count} Hari)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                  <span>TESTING ({ad.active_days_count} Hari)</span>
                </span>
              )}
            </div>
          </div>

          {/* Aggressive Scaling Alert if >= 3 */}
          {ad.collation_count >= 3 && (
            <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
              <span className="flex items-center gap-1.5">
                <span>🔥</span>
                <span className="font-semibold">AGGRESSIVE SCALING:</span>
                <span>{ad.collation_count} variasi iklan aktif serentak</span>
              </span>
              <span className="font-mono text-[10px] text-amber-700/80 dark:text-amber-400/80">
                Collation ID: {ad.collation_id || "Active"}
              </span>
            </div>
          )}
        </div>

        {/* 2. Media Stage with SafeZoneOverlay */}
        <div className="relative bg-zinc-950">
          <SafeZoneOverlay aspectRatio={ad.media_format === "IMAGE" ? "4:5" : "9:16"}>
            <div className="relative flex items-center justify-center aspect-[4/5] max-h-[380px] w-full overflow-hidden">
              {isVideo ? (
                <video
                  src={primaryMediaUrl}
                  controls
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={primaryMediaUrl}
                  alt={ad.headline_title || ad.page_name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
                  loading="lazy"
                />
              )}

              {/* Format Badge (Top Right) */}
              <div className="absolute top-2.5 right-2.5 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono text-white border border-white/20">
                {ad.media_format}
              </div>
            </div>
          </SafeZoneOverlay>
        </div>

        {/* 3. Copywriting & Content Body */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            {ad.headline_title && (
              <h4 className="text-xs font-bold text-zinc-900 leading-snug line-clamp-2 dark:text-zinc-100">
                {ad.headline_title}
              </h4>
            )}

            {ad.original_body_text && (
              <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                <p className={isExpanded ? "whitespace-pre-wrap select-text" : "line-clamp-3 select-text"}>
                  {renderHighlightedText(ad.original_body_text)}
                </p>
                {ad.original_body_text.length > 140 && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="mt-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer"
                  >
                    {isExpanded ? "Tutup Teks ▲" : "Lihat Selengkapnya ▼"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 4. Funnel & Destination X-Ray (WhatsApp Pre-filled Script or Landing Page) */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {ad.funnel_type === "CTWA" && ad.decoded_wa_text ? (
              <WhatsAppScriptCard
                phoneNumber={ad.decoded_wa_number}
                scriptText={ad.decoded_wa_text}
                destinationUrl={ad.destination_url}
              />
            ) : (
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs border border-zinc-100 dark:bg-zinc-850 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Tujuan:</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {ad.destination_domain || ad.funnel_type}
                  </span>
                </div>
                {ad.destination_url && (
                  <a
                    href={ad.destination_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-600 hover:underline dark:text-amber-400 shrink-0 ml-2"
                  >
                    Kunjungi ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 5. Footer Action Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <a
                href={`https://www.facebook.com/ads/library/?id=${ad.ad_archive_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
                title="Buka transparansi Meta Ad Library resmi"
              >
                Meta Ad Archive ↗
              </a>

              <Link
                href={`/studio?prompt=${encodeURIComponent(`Gaya penawaran dari ${ad.page_name}: ${ad.headline_title || ad.original_body_text?.slice(0, 90) || ""}`)}`}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/90 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:border-amber-500/40 hover:bg-amber-50/20 hover:text-amber-700 dark:border-zinc-700/80 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:text-amber-300 transition"
                title="Gunakan materi penawaran kompetitor ini ke Creative Studio"
              >
                <span>🎨</span>
                <span>Jadikan Referensi</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setIsTeardownOpen(true)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
                ad.ai_analysis
                  ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300"
                  : "btn-solar"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{ad.ai_analysis ? "✓ Teranalisis • Lihat AI Teardown" : "⚡ Bedah Anatomi AI"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grounded AI Teardown Modal */}
      <AiTeardownModal
        isOpen={isTeardownOpen}
        onClose={() => setIsTeardownOpen(false)}
        ad={ad}
        onAnalysisUpdated={handleAnalysisUpdated}
      />
    </>
  );
}
