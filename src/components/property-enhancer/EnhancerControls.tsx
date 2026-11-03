"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type {
  EnhancementMode,
  PhotographyStyle,
  EnhancementIntensity,
  OutputAspectRatio,
  ArchitecturalStructureLock,
} from "@/lib/ai/property-enhancer/types";

export interface EnhancerControlsProps {
  mode: EnhancementMode;
  onChangeMode: (mode: EnhancementMode) => void;
  style: PhotographyStyle;
  onChangeStyle: (style: PhotographyStyle) => void;
  intensity: EnhancementIntensity;
  onChangeIntensity: (intensity: EnhancementIntensity) => void;
  aspectRatio: OutputAspectRatio;
  onChangeAspectRatio: (ratio: OutputAspectRatio) => void;
  detailNotes: string;
  onChangeDetailNotes: (notes: string) => void;
  structureLock?: ArchitecturalStructureLock;
  onChangeStructureLock?: (lock: ArchitecturalStructureLock) => void;
  onExecute: () => void;
  isProcessing: boolean;
  hasImage: boolean;
}

const MODES: { id: EnhancementMode; labelId: string; labelEn: string }[] = [
  { id: "mode_photorealistic", labelId: "Fotorealistik", labelEn: "Photorealistic" },
  { id: "mode_architectural_photo", labelId: "Arsitektur", labelEn: "Architectural" },
  { id: "mode_premium_visualization", labelId: "Visualisasi", labelEn: "Visualization" },
];

const STYLES: { id: PhotographyStyle; labelId: string; labelEn: string }[] = [
  {
    id: "style_clean_daylight",
    labelId: "Mengikuti Foto Asli (Siang Natural)",
    labelEn: "Match Original (Natural Daylight)",
  },
  { id: "style_bright_morning", labelId: "Pagi Cerah", labelEn: "Bright Morning" },
  { id: "style_golden_hour", labelId: "Sore Keemasan", labelEn: "Warm Golden Hour" },
  { id: "style_blue_hour", labelId: "Senja Biru", labelEn: "Twilight Blue Hour" },
  { id: "style_overcast_editorial", labelId: "Mendung Lembut", labelEn: "Soft Overcast" },
  { id: "style_tropical", labelId: "Tropis Alami", labelEn: "Natural Tropical" },
];

const INTENSITIES: { id: EnhancementIntensity; labelId: string; labelEn: string }[] = [
  { id: "conservative", labelId: "Konservatif", labelEn: "Conservative" },
  { id: "balanced", labelId: "Seimbang", labelEn: "Balanced" },
  { id: "advanced", labelId: "Maksimal", labelEn: "Maximum" },
];

const RATIOS: { id: OutputAspectRatio; labelId: string; labelEn: string }[] = [
  { id: "original", labelId: "Asli", labelEn: "Original" },
  { id: "1:1", labelId: "1:1", labelEn: "1:1" },
  { id: "4:5", labelId: "4:5", labelEn: "4:5" },
  { id: "9:16", labelId: "9:16", labelEn: "9:16" },
  { id: "16:9", labelId: "16:9", labelEn: "16:9" },
];

export function EnhancerControls({
  mode,
  onChangeMode,
  style,
  onChangeStyle,
  intensity,
  onChangeIntensity,
  aspectRatio,
  onChangeAspectRatio,
  detailNotes,
  onChangeDetailNotes,
}: EnhancerControlsProps) {
  const { locale } = useI18n();
  const isEn = locale === "en";

  return (
    <div className="space-y-5">
      {/* Section 2 — Mode Enhancement */}
      <div>
        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
          {isEn ? "Enhancement Mode" : "Mode Peningkatan"}
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          {MODES.map((item) => {
            const isSelected = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeMode(item.id)}
                className={`py-1.5 text-xs font-medium text-center rounded-md transition-all cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                {isEn ? item.labelEn : item.labelId}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3 — Pencahayaan & Atmosfer */}
      <div>
        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
          {isEn ? "Lighting & Atmosphere" : "Pencahayaan & Atmosfer"}
        </label>
        <div className="relative">
          <select
            value={style}
            onChange={(e) => onChangeStyle(e.target.value as PhotographyStyle)}
            className="w-full h-9 px-3 pr-8 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400 cursor-pointer appearance-none"
          >
            {STYLES.map((item) => (
              <option key={item.id} value={item.id}>
                {isEn ? item.labelEn : item.labelId}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2.5 pointer-events-none text-neutral-400">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Section 4 — Intensitas Enhancement */}
      <div>
        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
          {isEn ? "Intensity" : "Intensitas"}
        </label>
        <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-medium">
          {INTENSITIES.map((lvl) => {
            const isSelected = intensity === lvl.id;
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => onChangeIntensity(lvl.id)}
                className={`py-1.5 text-center rounded-md transition-all cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                {isEn ? lvl.labelEn : lvl.labelId}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 5 — Rasio Output */}
      <div>
        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
          {isEn ? "Aspect Ratio" : "Rasio Aspek"}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {RATIOS.map((item) => {
            const isSelected = aspectRatio === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeAspectRatio(item.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {isEn ? item.labelEn : item.labelId}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 6 — Catatan Detail (Optional) */}
      <div>
        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
          {isEn ? "Additional Details (Optional)" : "Detail Tambahan (Opsional)"}
        </label>
        <textarea
          rows={2}
          value={detailNotes}
          onChange={(e) => onChangeDetailNotes(e.target.value)}
          placeholder={
            isEn
              ? "Example: Sharpen natural stone textures and glass reflections..."
              : "Contoh: Pertajam tekstur batu alam dan pantulan kaca..."
          }
          className="w-full text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 resize-none"
        />
      </div>
    </div>
  );
}
