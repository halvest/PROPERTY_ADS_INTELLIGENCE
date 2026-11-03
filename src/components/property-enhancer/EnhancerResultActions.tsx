"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { EnhancementJobResult } from "@/lib/ai/property-enhancer/types";
import { MODE_DEFINITIONS, STYLE_DEFINITIONS } from "@/lib/ai/property-enhancer/presets";

export interface EnhancerResultActionsProps {
  result: EnhancementJobResult;
  onEnhanceAgain: () => void;
  onNewPhoto: () => void;
}

export function EnhancerResultActions({
  result,
  onEnhanceAgain,
  onNewPhoto,
}: EnhancerResultActionsProps) {
  const router = useRouter();

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = result.enhancedUrl;
    a.download = `Architectural_Photo_${result.style}_${result.enhancedWidth}x${result.enhancedHeight}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUseInAdComposer = () => {
    try {
      sessionStorage.setItem("property_ad_facade_url", result.enhancedUrl);
    } catch {
      // Ignore sessionStorage errors
    }
    router.push("/reviews");
  };

  const modeDef = MODE_DEFINITIONS[result.mode];
  const styleDef = STYLE_DEFINITIONS[result.style];

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 text-xs">
        <div>
          <span className="text-[10px] text-neutral-400 block font-medium">Resolusi Full-Frame</span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {result.enhancedWidth} × {result.enhancedHeight} px
          </span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-400 block font-medium">Durasi Sintesis</span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {result.processingTimeMs} ms
          </span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-400 block font-medium">Mode Enhancement</span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-[11px] truncate block">
            {modeDef?.badge || result.mode}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-400 block font-medium">Atmosfer Fotografi</span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
            {styleDef?.name || result.style}
          </span>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <button
          type="button"
          onClick={handleDownload}
          className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-lg font-medium text-xs bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition-colors cursor-pointer text-center"
        >
          Unduh Foto Full-Frame (JPG)
        </button>

        <button
          type="button"
          onClick={handleUseInAdComposer}
          className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-lg font-medium text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 shadow-xs transition-colors cursor-pointer text-center"
        >
          Gunakan di Creative Studio
        </button>

        <button
          type="button"
          onClick={onNewPhoto}
          className="w-full sm:w-auto py-2.5 px-4 rounded-lg font-medium text-xs border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer text-center"
        >
          Render Lain
        </button>
      </div>
    </div>
  );
}
