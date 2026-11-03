"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type EnhancerViewMode = "slider" | "enhanced" | "original";

export interface EnhancerComparisonSliderProps {
  originalUrl: string;
  enhancedUrl: string;
  originalWidth?: number;
  originalHeight?: number;
  enhancedWidth?: number;
  enhancedHeight?: number;
  viewMode?: EnhancerViewMode;
}

export function EnhancerComparisonSlider({
  originalUrl,
  enhancedUrl,
  originalWidth,
  originalHeight,
  enhancedWidth,
  enhancedHeight,
  viewMode = "slider",
}: EnhancerComparisonSliderProps) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);

  // Dynamic aspect ratio calculation to prevent any squashing or zoom jumps
  const initialRatio =
    enhancedWidth && enhancedHeight
      ? enhancedWidth / enhancedHeight
      : originalWidth && originalHeight
      ? originalWidth / originalHeight
      : null;

  const [aspectRatio, setAspectRatio] = useState<number | null>(initialRatio);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  };

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percent);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    },
    [handleMove]
  );

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };

    if (isDragging) {
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("mousemove", handleGlobalMouseMove);
    }
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [isDragging, handleMove]);

  const containerStyle: React.CSSProperties = {
    aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
  };

  // View: Enhanced Only
  if (viewMode === "enhanced") {
    return (
      <div
        className="relative max-h-[calc(100vh-10rem)] max-w-full flex items-center justify-center overflow-hidden rounded-lg shadow-2xl"
        style={containerStyle}
      >
        <img
          src={enhancedUrl}
          alt={isEn ? "Enhanced Result" : "Hasil Akhir"}
          onLoad={handleImageLoad}
          className="w-full h-full object-cover block select-none"
        />
        <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 text-neutral-300 text-[10px] font-medium backdrop-blur-xs border border-white/10 pointer-events-none">
          {isEn ? "Enhanced Result" : "Hasil Akhir"}
        </div>
      </div>
    );
  }

  // View: Original Only
  if (viewMode === "original") {
    return (
      <div
        className="relative max-h-[calc(100vh-10rem)] max-w-full flex items-center justify-center overflow-hidden rounded-lg shadow-2xl"
        style={containerStyle}
      >
        <img
          src={originalUrl}
          alt={isEn ? "Original Photo" : "Foto Asli"}
          onLoad={handleImageLoad}
          className="w-full h-full object-cover block select-none"
        />
        <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 text-neutral-300 text-[10px] font-medium backdrop-blur-xs border border-white/10 pointer-events-none">
          {isEn ? "Original Photo" : "Foto Asli"}
        </div>
      </div>
    );
  }

  // View: Interactive Comparison Slider
  return (
    <div
      ref={containerRef}
      onMouseDown={() => setIsDragging(true)}
      onTouchMove={handleTouchMove}
      onTouchStart={() => setIsDragging(true)}
      onTouchEnd={() => setIsDragging(false)}
      style={containerStyle}
      className="relative max-h-[calc(100vh-10rem)] max-w-full flex items-center justify-center select-none cursor-ew-resize overflow-hidden rounded-lg shadow-2xl"
    >
      {/* 1. Base Layer: Enhanced Result */}
      <img
        src={enhancedUrl}
        alt={isEn ? "Enhanced Photo" : "Foto Hasil Peningkatan"}
        onLoad={handleImageLoad}
        className="w-full h-full object-cover pointer-events-none block select-none"
      />

      {/* 2. Top Layer: Original Photo (Clipped on right via clipPath) */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
        }}
      >
        <img
          src={originalUrl}
          alt={isEn ? "Original Photo" : "Foto Asli"}
          className="w-full h-full object-cover pointer-events-none block select-none"
        />
      </div>

      {/* 3. Divider Line & Thumb */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" />

        {/* Center Drag Handle */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center pointer-events-auto cursor-ew-resize text-neutral-900 border border-neutral-200">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L4.5 12m0 0l3.75-3.75M4.5 12h15m0 0l-3.75 3.75M19.5 12l-3.75-3.75" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/60 text-neutral-300 text-[10px] font-medium backdrop-blur-xs border border-white/10 pointer-events-none">
        {isEn ? "Original" : "Asli"}
      </div>
      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/60 text-neutral-300 text-[10px] font-medium backdrop-blur-xs border border-white/10 pointer-events-none">
        {isEn ? "Enhanced" : "Hasil"}
      </div>
    </div>
  );
}
