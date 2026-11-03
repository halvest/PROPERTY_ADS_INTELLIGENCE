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
    <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-200 select-none overflow-hidden">
      {/* 1. Top Minimal Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 bg-neutral-900/60 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[11px] font-mono text-neutral-400 sm:text-xs">
            {resolutionText}
          </span>
          {showOriginal && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {isEn ? "Original Reference Photo" : "Foto Acuan Asli"}
            </span>
          )}
        </div>

        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto">
          {effectiveReferenceUrl && (
            <button
              type="button"
              onClick={() => setShowOriginal((prev) => !prev)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showOriginal
                  ? "bg-neutral-800 text-white border-neutral-600"
                  : "bg-transparent text-neutral-300 border-neutral-800 hover:bg-neutral-800 hover:text-white"
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
                  : "Bandingkan"}
              </span>
            </button>
          )}

          {activeGeneratedUrl && (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-800 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
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

          <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

          <button
            type="button"
            disabled={!activeGeneratedUrl || isGenerating}
            onClick={() => handleDownload("png")}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-800 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            PNG
          </button>
          <button
            type="button"
            disabled={!activeGeneratedUrl || isGenerating}
            onClick={() => handleDownload("jpeg")}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-800 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            JPG
          </button>
          <button
            type="button"
            disabled={!activeGeneratedUrl || isGenerating}
            onClick={() => handleDownload("webp")}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-800 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            WebP
          </button>
        </div>
      </div>

      {/* 2. Center Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-neutral-700 border-t-neutral-200 animate-spin" />
            <span className="text-xs font-medium text-neutral-400 tracking-wide">
              {isEn ? "Processing image..." : "Memproses gambar..."}
            </span>
          </div>
        ) : displayUrl ? (
          <div className="flex h-full max-h-full w-full items-center justify-center">
            <img
              src={displayUrl}
              alt={isEn ? "AI Property Design Output" : "Hasil Desain Properti AI"}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-opacity duration-200"
            />
          </div>
        ) : (
          <div className="text-center">
            <span className="text-xs text-neutral-500 font-medium">
              {isEn ? "No image yet" : "Belum ada gambar"}
            </span>
          </div>
        )}
      </div>

      {/* 3. Fullscreen Modal */}
      {isFullscreen && displayUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <span className="text-xs font-mono text-neutral-400">
              {resolutionText}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownload("png")}
                className="px-2.5 py-1 text-xs font-medium rounded border border-neutral-700 text-neutral-200 hover:bg-neutral-800 cursor-pointer"
              >
                {isEn ? "Download PNG" : "Unduh PNG"}
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                aria-label={isEn ? "Close fullscreen" : "Tutup layar penuh"}
                className="p-1.5 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
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
              className="max-h-full max-w-full object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
