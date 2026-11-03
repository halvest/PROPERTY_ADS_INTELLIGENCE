"use client";

import React from "react";
import type { CreativeVariationItem } from "@/lib/ai/creative-studio/types";

interface VariationsPickerProps {
  variations: CreativeVariationItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function VariationsPicker({
  variations,
  selectedIndex,
  onSelect,
}: VariationsPickerProps) {
  if (!variations || variations.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest block">
            A/B/C Multi-Variant Engine
          </span>
          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            3 Variasi Desain Iklan Siap Tayang
          </h4>
        </div>
        <span className="text-[11px] text-zinc-500 font-medium">
          Pilih variasi untuk melihat di kanvas
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {variations.map((v, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={v.id || idx}
              type="button"
              onClick={() => onSelect(idx)}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20 shadow-xs"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-950/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: v.accentColor || "#38bdf8" }}
                  />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {v.label}
                  </span>
                </div>
                {isSelected && (
                  <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-sm bg-sky-500/10">
                    Aktif
                  </span>
                )}
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium line-clamp-2">
                "{v.headline}"
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

