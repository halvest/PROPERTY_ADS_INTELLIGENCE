"use client";

import React, { useEffect } from "react";
import { downloadStudioImage } from "@/components/creative-studio/export-utils";

export interface StudioLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  aspectRatio?: string;
  title?: string;
}

export function StudioLightbox({
  isOpen,
  onClose,
  imageUrl,
  aspectRatio = "4:5",
  title = "Generasi Visual AI",
}: StudioLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 p-4 text-zinc-100 backdrop-blur-md animate-in fade-in duration-150"
    >
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-400">
            {aspectRatio}  |  Preview HD
          </span>
          <span className="text-xs font-medium text-zinc-200">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadStudioImage(imageUrl, "png", aspectRatio)}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
          >
            Unduh PNG
          </button>
          <button
            type="button"
            onClick={() => downloadStudioImage(imageUrl, "webp", aspectRatio)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            WebP
          </button>
          <button
            type="button"
            onClick={() => downloadStudioImage(imageUrl, "jpeg", aspectRatio)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            JPG
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
            aria-label="Tutup"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Center Stage */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-4"
        onClick={onClose}
      >
        <img
          src={imageUrl}
          alt={title}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}
