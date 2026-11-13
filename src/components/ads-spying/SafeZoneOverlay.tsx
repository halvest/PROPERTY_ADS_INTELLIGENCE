"use client";

import React, { useState } from "react";

export interface SafeZoneOverlayProps {
  aspectRatio?: "4:5" | "9:16" | "1:1" | "16:9" | string;
  children: React.ReactNode;
}

export function SafeZoneOverlay({ aspectRatio = "4:5", children }: SafeZoneOverlayProps) {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div className="relative group overflow-hidden rounded-xl bg-zinc-950">
      {children}

      {/* Toggle Button in Top-Left */}
      <button
        type="button"
        onClick={() => setShowOverlay((prev) => !prev)}
        className={`absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-all cursor-pointer shadow-sm ${
          showOverlay
            ? "bg-amber-500 text-zinc-950 font-bold border border-amber-400"
            : "bg-black/60 text-zinc-200 border border-white/20 hover:bg-black/80 hover:text-white"
        }`}
        title="Bandingkan tata letak teks iklan dengan Zona Aman Meta Ads"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        <span>{showOverlay ? "Safe Zone: ON" : "Safe Zone Overlay"}</span>
      </button>

      {/* Visual Safe Zone Grid Overlay */}
      {showOverlay && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between border-2 border-dashed border-amber-400/80 animate-in fade-in duration-150">
          {/* Top Danger Zone (Instagram Profile Header & Meta Sponsor Bar) */}
          <div className="flex items-center justify-center bg-rose-500/25 border-b border-rose-400/60 p-2 text-center backdrop-blur-xs">
            <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono font-semibold text-rose-300">
              ⚠️ Zona Bahaya Atas (Header Akun & Sponsored Bar)
            </span>
          </div>

          {/* Central Safe Active Canvas */}
          <div className="flex-1 flex items-center justify-center border-y border-emerald-400/40 bg-emerald-500/5">
            <span className="rounded-full bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 text-[11px] font-mono font-semibold text-emerald-300 shadow-sm">
              ✅ Zona Aman Teks & Harga ({aspectRatio})
            </span>
          </div>

          {/* Bottom Danger Zone (Meta CTA Bar & Reels Caption Area) */}
          <div className="flex items-center justify-center bg-rose-500/25 border-t border-rose-400/60 p-2.5 text-center backdrop-blur-xs">
            <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono font-semibold text-rose-300">
              ⚠️ Zona Bahaya Bawah (Tombol WhatsApp & Caption)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
