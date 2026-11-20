"use client";

import React, { useState } from "react";
import type {
  ComposedAdLayout,
  AspectRatio,
  CreativeStrategy,
  CreativeVariationItem,
  QualityScoreReport,
} from "@/lib/ai/creative-studio/types";
import { downloadStudioImage } from "./export-utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface CreativeCanvasProps {
  // Conversational Studio Props
  imageUrl?: string | null;
  referenceImageUrl?: string | null;
  aspectRatio?: string;
  isGenerating?: boolean;
  onDownload?: (format: "png" | "jpeg" | "webp") => void;

  // Legacy Props for Compatibility
  layout?: ComposedAdLayout | null;
  strategy?: CreativeStrategy | null;
  lockedRatio?: AspectRatio | null;
  onChangeAspectRatio?: (ratio: AspectRatio) => void;
  onExport?: (format: "png" | "jpeg") => void;
  reasoningSummary?: string | null;
  variations?: CreativeVariationItem[];
  selectedVariationIdx?: number;
  onSelectVariation?: (idx: number) => void;
  score?: QualityScoreReport | null;
  hasReferenceImage?: boolean;
  promos?: string[];
  onSelectThemePreset?: (presetId: string) => void;
  activeThemePresetId?: string;
}

const RESOLUTION_MAP_ID: Record<string, string> = {
  "1:1": "1:1  |  1080 x 1080",
  "4:5": "4:5  |  1080 x 1350",
  "2:3": "2:3  |  1024 x 1536",
  "9:16": "9:16  |  1080 x 1920",
  "16:9": "16:9  |  1920 x 1080",
  auto: "Otomatis  |  Resolusi Asli",
};

const RESOLUTION_MAP_EN: Record<string, string> = {
  "1:1": "1:1  |  1080 x 1080",
  "4:5": "4:5  |  1080 x 1350",
  "2:3": "2:3  |  1024 x 1536",
  "9:16": "9:16  |  1080 x 1920",
  "16:9": "16:9  |  1920 x 1080",
  auto: "Auto  |  Native Resolution",
};

export function CreativeCanvas({
  imageUrl,
  referenceImageUrl,
  aspectRatio = "4:5",
  isGenerating = false,
  onDownload,
  layout,
  onExport,
  hasReferenceImage: legacyHasRef,
}: CreativeCanvasProps) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [showOriginal, setShowOriginal] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Resolve active image source (supports both direct studio URL and legacy layout)
  const activeGeneratedUrl =
    imageUrl ||
    layout?.finalComposedUrl ||
    layout?.backgroundImageUrl ||
    layout?.backgroundUrl ||
    null;

  const effectiveReferenceUrl =
    referenceImageUrl ||
    (legacyHasRef && layout?.backgroundUrl ? layout.backgroundUrl : null);

  const displayUrl =
    showOriginal && effectiveReferenceUrl
      ? effectiveReferenceUrl
      : activeGeneratedUrl;

  const resolutionMap = isEn ? RESOLUTION_MAP_EN : RESOLUTION_MAP_ID;
  const resolutionText =
    resolutionMap[aspectRatio] ||
    `${aspectRatio}  |  1080 x 1350`;

  const handleDownload = (format: "png" | "jpeg" | "webp") => {
    if (onDownload) {
      onDownload(format);
      return;
    }
    if (activeGeneratedUrl) {
      downloadStudioImage(activeGeneratedUrl, format, aspectRatio);
      return;
    }
    if (onExport && (format === "png" || format === "jpeg")) {
      onExport(format);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-100 text-zinc-900 select-none overflow-hidden dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      {/* 1. Top Minimal Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200/90 bg-white/90 px-3 py-2 sm:px-4 backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-900/80">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[11px] font-mono text-zinc-600 dark:text-zinc-400 sm:text-xs">
            {resolutionText}
          </span>
          {showOriginal && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {isEn ? "Original Reference Photo" : "Foto Acuan Asli"}
            </span>
          )}
          {showSafeZone && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              Safe Zone ON
            </span>
          )}
        </div>

        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto">
          {/* Compare Reference Photo Toggle */}
          {effectiveReferenceUrl && (
            <button
              type="button"
              onClick={() => setShowOriginal((prev) => !prev)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                showOriginal
                  ? "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-300"
                  : "bg-white text-zinc-700 border-zinc-200/90 hover:bg-zinc-50 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-850 dark:hover:text-white"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
              <span className="hidden sm:inline">
                {showOriginal
                  ? isEn
                    ? "View AI Result"
                    : "Lihat Hasil AI"
                  : isEn
                  ? "Compare"
                  : "Bandingkan Foto"}
              </span>
            </button>
          )}

          {/* Safe Zone Overlay Toggle */}
          {activeGeneratedUrl && (
            <button
              type="button"
              onClick={() => setShowSafeZone((prev) => !prev)}
              title={isEn ? "Toggle Meta Ads Safe Zones" : "Tampilkan Panduan Zona Aman Meta Ads"}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                showSafeZone
                  ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : "bg-white text-zinc-700 border-zinc-200/90 hover:bg-zinc-50 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-850 dark:hover:text-white"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <span className="hidden sm:inline">
                {isEn ? "Safe Zone" : "Zona Aman"}
              </span>
            </button>
          )}

          {/* Fullscreen Button */}
          {activeGeneratedUrl && (
              <button
                type="button"
              onClick={() => setIsFullscreen(true)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                />
              </svg>
              <span className="hidden sm:inline">
                {isEn ? "Fullscreen" : "Layar Penuh"}
              </span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />

          {/* Download Buttons */}
          <button
            type="button"
            disabled={!activeGeneratedUrl || isGenerating}
            onClick={() => handleDownload("png")}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 dark:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
          >
            PNG
              </button>
              <button
                type="button"
            disabled={!activeGeneratedUrl || isGenerating}
            onClick={() => handleDownload("jpeg")}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
              >
                JPG
              </button>
          <button
            type="button"
            disabled={!activeGeneratedUrl || isGenerating}
            onClick={() => handleDownload("webp")}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
          >
            WebP
          </button>
        </div>
      </div>

      {/* 2. Center Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6 bg-zinc-100/60 dark:bg-zinc-950">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full border-3 border-amber-500/30 border-t-amber-500 animate-spin" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 tracking-wide">
              {isEn ? "Synthesizing property ad creative..." : "Merender materi iklan properti via AI Engine..."}
            </span>
          </div>
        ) : displayUrl ? (
          <div className="relative flex h-full max-h-full w-full items-center justify-center">
            <div className="relative max-h-full max-w-full flex items-center justify-center">
              <img
                src={displayUrl}
                alt={isEn ? "AI Property Design Output" : "Hasil Desain Properti AI"}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl border border-zinc-200/90 dark:border-zinc-800 transition-opacity duration-200"
              />

              {/* Meta Ads Safe Zone Guide Overlay */}
              {showSafeZone && (
                <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden flex flex-col justify-between border-2 border-dashed border-amber-400/80 animate-in fade-in duration-150">
                  {/* Top Danger Zone (Instagram Profile & Sponsored Header) */}
                  <div className="flex items-center justify-center bg-rose-500/20 border-b border-rose-400/60 p-2 text-center backdrop-blur-xs">
                    <span className="rounded bg-black/75 px-2 py-0.5 text-[10px] font-mono font-semibold text-rose-300 shadow-sm">
                      ⚠️ {isEn ? "Top Danger Zone (Meta Header & Sponsored Bar)" : "Zona Bahaya Atas (Header Akun & Sponsored Bar)"}
                    </span>
                </div>

                  {/* Central Active Zone */}
                  <div className="flex-1 flex items-center justify-center border-y border-emerald-400/30 bg-emerald-500/5">
                    <span className="rounded bg-black/60 px-2.5 py-1 text-[10px] font-mono font-semibold text-emerald-300">
                      ✓ {isEn ? "Safe Zone (Headline, Fasad & Key Specs)" : "Zona Aman Utama (Headline, Fasad & Spesifikasi)"}
                    </span>
                  </div>

                  {/* Bottom Danger Zone (Meta CTA & Caption) */}
                  <div className="flex items-center justify-center bg-rose-500/20 border-t border-rose-400/60 p-2 text-center backdrop-blur-xs">
                    <span className="rounded bg-black/75 px-2 py-0.5 text-[10px] font-mono font-semibold text-rose-300 shadow-sm">
                      ⚠️ {isEn ? "Bottom Danger Zone (Meta CTA Button & Caption)" : "Zona Bahaya Bawah (Tombol CTA & Caption Instagram)"}
                    </span>
                  </div>
                </div>
              )}
              </div>
          </div>
        ) : (
          <div className="max-w-md text-center space-y-3 p-6 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                {isEn ? "Ready-to-Run Ad Creative Canvas" : "Kanvas Materi Iklan Properti Siap Tayang"}
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {isEn
                  ? "Select a property ad archetype on the left panel or attach a property facade photo to render high-converting Meta Ads visual."
                  : "Pilih formula arketipe iklan properti di panel kiri atau lampirkan foto fasad rumah untuk merender visual iklan Meta Ads profesional."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Fullscreen Modal */}
      {isFullscreen && displayUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <span className="text-xs font-mono text-zinc-400">
              {resolutionText}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownload("png")}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer transition"
              >
                {isEn ? "Download PNG" : "Unduh PNG"}
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                aria-label={isEn ? "Close fullscreen" : "Tutup layar penuh"}
                className="p-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <img
              src={displayUrl}
              alt={isEn ? "Fullscreen Preview" : "Pratinjau Layar Penuh"}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
            />
          </div>
      </div>
      )}
    </div>
  );
}
