"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { EnhancerDropzone } from "@/components/property-enhancer/EnhancerDropzone";
import { EnhancerControls } from "@/components/property-enhancer/EnhancerControls";
import {
  EnhancerComparisonSlider,
  type EnhancerViewMode,
} from "@/components/property-enhancer/EnhancerComparisonSlider";
import {
  EnhancerHistoryDrawer,
  type EnhancementHistoryItem,
} from "@/components/property-enhancer/EnhancerHistoryDrawer";
import type {
  EnhancementMode,
  PhotographyStyle,
  EnhancementIntensity,
  OutputAspectRatio,
  ArchitecturalStructureLock,
  EnhancementJobResult,
} from "@/lib/ai/property-enhancer/types";
import { DEFAULT_STRUCTURE_LOCK } from "@/lib/ai/property-enhancer/presets";

async function downloadEnhancedImage(
  url: string,
  format: "png" | "jpeg" | "webp",
  fileName: string = "enhanced-architecture"
) {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for download"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.drawImage(img, 0, 0);
    const mime =
      format === "png"
        ? "image/png"
        : format === "webp"
        ? "image/webp"
        : "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, 0.95);

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${fileName}.${format === "jpeg" ? "jpg" : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    // Fallback: direct download link
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.${format === "jpeg" ? "jpg" : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export default function PropertyImageEnhancerPage() {
  const { showToast } = useToast();
  const { locale } = useI18n();
  const isEn = locale === "en";

  // Source image states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Enhancement controls
  const [mode, setMode] = useState<EnhancementMode>("mode_photorealistic");
  const [style, setStyle] = useState<PhotographyStyle>("style_clean_daylight");
  const [intensity, setIntensity] = useState<EnhancementIntensity>("balanced");
  const [aspectRatio, setAspectRatio] = useState<OutputAspectRatio>("original");
  const [detailNotes, setDetailNotes] = useState("");
  const [structureLock, setStructureLock] = useState<ArchitecturalStructureLock>({
    ...DEFAULT_STRUCTURE_LOCK,
  });

  // Processing & result states
  const [isProcessing, setIsProcessing] = useState(false);
  const [enhancementResult, setEnhancementResult] = useState<EnhancementJobResult | null>(null);
  const [sessionHistory, setSessionHistory] = useState<EnhancementJobResult[]>([]);

  // Viewport states
  const [viewMode, setViewMode] = useState<EnhancerViewMode>("slider");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"controls" | "stage">("controls");

  // Handle file select
  const handleSelectFile = (file: File) => {
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setOriginalPreviewUrl(objectUrl);
    setEnhancementResult(null);

    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = objectUrl;

    showToast(
      "info",
      isEn
        ? `Photo "${file.name}" loaded and ready to enhance.`
        : `Foto "${file.name}" berhasil dimuat. Siap diproses.`,
      isEn ? "File Ready" : "File Siap"
    );
  };

  // Reset current state
  const handleClear = () => {
    setSelectedFile(null);
    setOriginalPreviewUrl(null);
    setImageDimensions(null);
    setEnhancementResult(null);
    setDetailNotes("");
    setStructureLock({ ...DEFAULT_STRUCTURE_LOCK });
  };

  // Execute Enhancement
  const handleExecute = async () => {
    if (!selectedFile && !originalPreviewUrl) {
      showToast(
        "error",
        isEn
          ? "Please upload a photo or 3D render first."
          : "Harap unggah file foto atau render 3D terlebih dahulu",
        isEn ? "No File Selected" : "File Belum Ada"
      );
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      formData.append("mode", mode);
      formData.append("style", style);
      formData.append("intensity", intensity);
      formData.append("aspectRatio", aspectRatio);
      if (detailNotes.trim()) {
        formData.append("detailNotes", detailNotes.trim());
      }
      formData.append("structureLock", JSON.stringify(structureLock));

      const res = await fetch("/api/property-enhancer/process", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
            (isEn ? "Failed to process architectural enhancement" : "Gagal memproses peningkatan arsitektur")
        );
      }

      const data: EnhancementJobResult = json.data;
      setEnhancementResult(data);
      setSessionHistory((prev) => [data, ...prev.filter((i) => i.id !== data.id)]);
      setViewMode("slider");
      setMobilePane("stage");

      showToast(
        "success",
        isEn
          ? `Enhancement complete (${data.enhancedWidth} × ${data.enhancedHeight} px).`
          : `Peningkatan selesai (${data.enhancedWidth} × ${data.enhancedHeight} px).`,
        isEn ? "Complete" : "Selesai"
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : isEn
          ? "An error occurred while processing the image"
          : "Terjadi kesalahan saat memproses gambar";
      showToast("error", msg, isEn ? "Failed" : "Gagal");
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore item from History Drawer
  const handleSelectHistory = (item: EnhancementHistoryItem) => {
    setOriginalPreviewUrl(item.original_image_url);
    if (item.enhanced_image_url) {
      const parsedMode = (
        ["mode_photorealistic", "mode_architectural_photo", "mode_premium_visualization"].includes(
          item.enhancement_mode
        )
          ? item.enhancement_mode
          : "mode_photorealistic"
      ) as EnhancementMode;

      const parsedStyle = (
        [
          "style_golden_hour",
          "style_clean_daylight",
          "style_blue_hour",
          "style_tropical",
          "style_overcast_editorial",
          "style_bright_morning",
        ].includes(item.preset)
          ? item.preset
          : "style_clean_daylight"
      ) as PhotographyStyle;

      setMode(parsedMode);
      setStyle(parsedStyle);

      const restored: EnhancementJobResult = {
        id: item.id,
        originalUrl: item.original_image_url,
        enhancedUrl: item.enhanced_image_url,
        originalWidth: item.original_width || 1280,
        originalHeight: item.original_height || 960,
        enhancedWidth: item.output_width || 1280,
        enhancedHeight: item.output_height || 960,
        originalFileSize: 0,
        enhancedFileSize: 0,
        mode: parsedMode,
        style: parsedStyle,
        intensity: "balanced",
        aspectRatio: "original",
        structureLock: { ...DEFAULT_STRUCTURE_LOCK },
        analysis: {
          width: item.original_width || 1280,
          height: item.original_height || 960,
          aspectRatio: 1.33,
          format: "jpeg",
          fileSizeBytes: 0,
          buildingType: isEn ? "Modern House" : "Rumah Modern",
          estimatedFloors: "2_floors",
          roofType: "flat_parapet",
          facadeMaterials: [],
          lightingCondition: "daylight",
          cameraPerspective: "eye_level_straight",
          dominantColors: [],
          isCgiRender: true,
          confidenceScore: 0.9,
          analysisSummary: isEn ? "Loaded from history." : "Dimuat dari riwayat.",
        },
        scorecard: {
          overallScore: 92,
          architecturalFidelityScore: 95,
          photographicRealismScore: 90,
          technicalQualityScore: 92,
          checks: [],
          flagsForReview: [],
          isFidelityGuaranteed: true,
        },
        modelUsed: "muse-image-1.0",
        provider: "meta_muse_api",
        processingTimeMs: 120,
        status: "completed",
        createdAt: item.created_at,
      };

      setEnhancementResult(restored);
      setSessionHistory((prev) => [restored, ...prev.filter((i) => i.id !== restored.id)]);
      setViewMode("slider");
      setMobilePane("stage");
      showToast(
        "success",
        isEn
          ? `Photo "${item.file_name}" loaded from history`
          : `Foto "${item.file_name}" dimuat dari riwayat`,
        isEn ? "Loaded" : "Dimuat"
      );
    }
  };

  const handleDownload = (format: "png" | "jpeg" | "webp") => {
    if (!enhancementResult?.enhancedUrl) return;
    const baseName = selectedFile?.name?.replace(/\.[^.]+$/, "") || "enhanced-architecture";
    downloadEnhancedImage(enhancementResult.enhancedUrl, format, `${baseName}-enhanced`);
  };

  // Dimensions & Status Label for Top Bar
  const statusLabel = enhancementResult
    ? `${enhancementResult.enhancedWidth} × ${enhancementResult.enhancedHeight} px  |  ${
        isEn ? "Structure Lock Active" : "Kunci Struktur Aktif"
      }`
    : originalPreviewUrl && imageDimensions
    ? `${isEn ? "Source Photo" : "Foto Sumber"}  |  ${imageDimensions.width} × ${imageDimensions.height} px`
    : isEn
    ? "No image yet"
    : "Belum ada gambar";

  return (
    <div className="flex h-full min-h-0 w-full select-none flex-col overflow-hidden bg-white dark:bg-neutral-900 lg:flex-row">
      <div className="grid shrink-0 grid-cols-2 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane("controls")}
          className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${mobilePane === "controls" ? "border-neutral-950 text-neutral-950 dark:border-white dark:text-white" : "border-transparent text-neutral-500"}`}
        >
          {isEn ? "Controls" : "Kontrol"}
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("stage")}
          className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${mobilePane === "stage" ? "border-neutral-950 text-neutral-950 dark:border-white dark:text-white" : "border-transparent text-neutral-500"}`}
        >
          {isEn ? "Preview" : "Pratinjau"}
        </button>
      </div>
      {/* =========================================================================
          PART 1: Left Control Sidebar (Compact, Scannable, Zero Scroll Clutter)
         ========================================================================= */}
      <div className={`${mobilePane === "controls" ? "flex" : "hidden"} h-full min-h-0 w-full min-w-0 flex-col border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:flex lg:w-[min(420px,38vw)] lg:shrink-0 lg:border-r`}>
        {/* 1. Minimal Top Bar */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-3 dark:border-neutral-800 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {isEn ? "AI Photo Enhancer" : "Peningkat Foto AI"}
            </span>
            <span className="hidden shrink-0 rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 sm:inline">
              {isEn ? "Structure Lock" : "Kunci Struktur"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              aria-label={isEn ? "History" : "Riwayat"}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-white sm:px-2.5"
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
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="hidden sm:inline">{isEn ? "History" : "Riwayat"}</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              aria-label={isEn ? "Reset" : "Atur Ulang"}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-white sm:px-2.5"
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
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              <span className="hidden sm:inline">{isEn ? "Reset" : "Atur Ulang"}</span>
            </button>
          </div>
        </div>

        {/* 2. Scrollable Controls Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3 sm:p-4">
          {/* Section 1 — Sumber Gambar */}
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
              {isEn ? "Source Image" : "Sumber Gambar"}
            </label>
            <EnhancerDropzone
              onSelectFile={handleSelectFile}
              selectedFile={selectedFile}
              previewUrl={originalPreviewUrl}
              onClear={handleClear}
              isProcessing={isProcessing}
              imageDimensions={imageDimensions}
            />
          </div>

          {/* Sections 2 to 6 — Modes, Styles, Intensity, Ratio, Details */}
          <EnhancerControls
            mode={mode}
            onChangeMode={setMode}
            style={style}
            onChangeStyle={setStyle}
            intensity={intensity}
            onChangeIntensity={setIntensity}
            aspectRatio={aspectRatio}
            onChangeAspectRatio={setAspectRatio}
            detailNotes={detailNotes}
            onChangeDetailNotes={setDetailNotes}
            structureLock={structureLock}
            onChangeStructureLock={setStructureLock}
            onExecute={handleExecute}
            isProcessing={isProcessing}
            hasImage={Boolean(selectedFile || originalPreviewUrl)}
          />
        </div>

        {/* 3. Sticky Bottom Action Bar */}
        <div className="shrink-0 border-t border-neutral-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-neutral-800 dark:bg-neutral-900 sm:p-4">
          <button
            type="button"
            onClick={handleExecute}
            disabled={isProcessing || (!selectedFile && !originalPreviewUrl)}
            className="w-full h-10 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-neutral-400 border-t-white dark:border-neutral-600 dark:border-t-neutral-900 rounded-full animate-spin" />
                <span>{isEn ? "Processing Image..." : "Memproses Gambar..."}</span>
              </>
            ) : (
              <span>{isEn ? "Enhance Photo" : "Proses Peningkatan"}</span>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          PART 2: Right Interactive Before/After Stage (Pure Workspace)
         ========================================================================= */}
      <div className={`${mobilePane === "stage" ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-neutral-950 text-neutral-200 lg:flex`}>
        {/* 1. Top Stage Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-2 sm:px-5">
          <span className="min-w-0 truncate text-[11px] font-mono text-neutral-400 sm:text-xs">
            {statusLabel}
          </span>

          <div className="flex max-w-full items-center gap-1.5 overflow-x-auto">
            {enhancementResult && (
              <div className="flex items-center p-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-medium mr-1">
                <button
                  type="button"
                  onClick={() => setViewMode("slider")}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    viewMode === "slider"
                      ? "bg-neutral-800 text-white shadow-xs"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <span className="sm:hidden">Slider</span>
                  <span className="hidden sm:inline">
                    {isEn ? "Comparison Slider" : "Slider Perbandingan"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("enhanced")}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    viewMode === "enhanced"
                      ? "bg-neutral-800 text-white shadow-xs"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {isEn ? "Enhanced Result" : "Hasil Akhir"}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("original")}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    viewMode === "original"
                      ? "bg-neutral-800 text-white shadow-xs"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {isEn ? "Original Photo" : "Foto Asli"}
                </button>
              </div>
            )}

            {(enhancementResult || originalPreviewUrl) && (
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
                <span className="hidden sm:inline">{isEn ? "Fullscreen" : "Layar Penuh"}</span>
              </button>
            )}

            <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

            <button
              type="button"
              disabled={!enhancementResult || isProcessing}
              onClick={() => handleDownload("png")}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-800 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span className="sm:hidden">PNG</span>
              <span className="hidden sm:inline">{isEn ? "Download PNG" : "Unduh PNG"}</span>
            </button>
            <button
              type="button"
              disabled={!enhancementResult || isProcessing}
              onClick={() => handleDownload("jpeg")}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-800 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span className="sm:hidden">JPG</span>
              <span className="hidden sm:inline">{isEn ? "Download JPG" : "Unduh JPG"}</span>
            </button>
            <button
              type="button"
              disabled={!enhancementResult || isProcessing}
              onClick={() => handleDownload("webp")}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-800 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span className="sm:hidden">WebP</span>
              <span className="hidden sm:inline">{isEn ? "Download WebP" : "Unduh WebP"}</span>
            </button>
          </div>
        </div>

        {/* 2. Center Canvas Viewport */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-3 sm:p-6">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-neutral-700 border-t-neutral-200 animate-spin" />
              <span className="text-xs font-medium text-neutral-400 tracking-wide">
                {isEn
                  ? "Processing architectural enhancement..."
                  : "Memproses peningkatan arsitektur..."}
              </span>
            </div>
          ) : enhancementResult && (enhancementResult.originalUrl || originalPreviewUrl) ? (
            <EnhancerComparisonSlider
              originalUrl={enhancementResult.originalUrl || originalPreviewUrl!}
              enhancedUrl={enhancementResult.enhancedUrl}
              originalWidth={enhancementResult.originalWidth || imageDimensions?.width}
              originalHeight={enhancementResult.originalHeight || imageDimensions?.height}
              enhancedWidth={enhancementResult.enhancedWidth}
              enhancedHeight={enhancementResult.enhancedHeight}
              viewMode={viewMode}
            />
          ) : originalPreviewUrl ? (
            <div className="relative max-h-full max-w-full flex items-center justify-center">
              <img
                src={originalPreviewUrl}
                alt={isEn ? "Source Photo" : "Foto Sumber"}
                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              />
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 text-neutral-300 text-[10px] font-medium backdrop-blur-xs border border-white/10 pointer-events-none">
                {isEn ? "Source Photo" : "Foto Sumber"}
              </div>
            </div>
          ) : (
            <div className="flex max-w-sm flex-col items-center justify-center gap-2.5 px-4 text-center text-neutral-500">
              <svg
                className="w-5 h-5 text-neutral-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              <span className="text-xs font-medium">
                {isEn
                  ? "Upload a photo or 3D render in the left panel to begin."
                  : "Unggah foto atau render 3D di panel kiri untuk memulai."}
              </span>
            </div>
          )}
        </div>

        {/* 3. Bottom History Filmstrip (Only shown when session has >= 1 generated results) */}
        {sessionHistory.length >= 1 && (
          <div className="h-[60px] border-t border-neutral-800 bg-neutral-900/60 px-4 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mr-1 shrink-0">
              {isEn ? "Session History" : "Riwayat Sesi"}
            </span>
            <div className="flex items-center gap-2">
              {sessionHistory.map((item, idx) => {
                const isActive = enhancementResult?.id === item.id;
                return (
                  <button
                    key={item.id || idx}
                    type="button"
                    onClick={() => {
                      setEnhancementResult(item);
                      setViewMode("slider");
                    }}
                    className={`relative w-11 h-11 rounded-lg overflow-hidden border transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? "border-white ring-2 ring-white/30"
                        : "border-neutral-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={item.enhancedUrl}
                      alt={isEn ? `Version ${idx + 1}` : `Versi ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 right-0 px-1 text-[9px] font-mono bg-black/80 text-white leading-tight">
                      {idx + 1}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Fullscreen Modal */}
      {isFullscreen && (enhancementResult || originalPreviewUrl) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <span className="text-xs font-mono text-neutral-400">
              {statusLabel}
            </span>
            <div className="flex items-center gap-2">
              {enhancementResult && (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownload("png")}
                    className="px-2.5 py-1 text-xs font-medium rounded border border-neutral-700 text-neutral-200 hover:bg-neutral-800 cursor-pointer"
                  >
                    {isEn ? "Download PNG" : "Unduh PNG"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload("jpeg")}
                    className="px-2.5 py-1 text-xs font-medium rounded border border-neutral-700 text-neutral-200 hover:bg-neutral-800 cursor-pointer"
                  >
                    {isEn ? "Download JPG" : "Unduh JPG"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload("webp")}
                    className="px-2.5 py-1 text-xs font-medium rounded border border-neutral-700 text-neutral-200 hover:bg-neutral-800 cursor-pointer"
                  >
                    {isEn ? "Download WebP" : "Unduh WebP"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                aria-label={isEn ? "Close fullscreen" : "Tutup layar penuh"}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {enhancementResult ? (
              <EnhancerComparisonSlider
                originalUrl={enhancementResult.originalUrl || originalPreviewUrl!}
                enhancedUrl={enhancementResult.enhancedUrl}
                originalWidth={enhancementResult.originalWidth || imageDimensions?.width}
                originalHeight={enhancementResult.originalHeight || imageDimensions?.height}
                enhancedWidth={enhancementResult.enhancedWidth}
                enhancedHeight={enhancementResult.enhancedHeight}
                viewMode={viewMode}
              />
            ) : (
              <img
                src={originalPreviewUrl!}
                alt={isEn ? "Source Photo Fullscreen" : "Foto Sumber Layar Penuh"}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}

      {/* 5. History Drawer */}
      <EnhancerHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectHistory={handleSelectHistory}
      />
    </div>
  );
}
