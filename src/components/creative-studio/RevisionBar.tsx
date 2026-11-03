"use client";

import React, { useState } from "react";

interface RevisionBarProps {
  onRevise: (instruction: string) => void;
  isRevising: boolean;
  disabled?: boolean;
}

const QUICK_SUGGESTIONS = [
  "✨ Aksen Emas Mewah",
  "🏷️ Tonjolkan DP 0% & Free PPN",
  "🌅 Suasana Senja Golden Hour",
  "🌿 Gaya Emerald Century 21",
  "👑 Gaya Metro Regency",
  "📱 Perbesar No WhatsApp",
];

export function RevisionBar({ onRevise, isRevising, disabled }: RevisionBarProps) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isRevising || disabled) return;
    onRevise(instruction.trim());
    setInstruction("");
  };

  const handleQuickClick = (text: string) => {
    if (isRevising || disabled) return;
    onRevise(text);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 sm:p-3.5 space-y-2.5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">🪄</span>
          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            Revisi AI Art Director
          </h4>
        </div>
        <span className="text-[10px] text-zinc-400">
          Ubah warna, lighting, penawaran secara instan
        </span>
      </div>

      {/* Input & Action Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={disabled || isRevising}
          placeholder="Contoh: 'Tolong buat warna headline lebih emas dan letakkan badge di kanan'..."
          className="flex-1 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!instruction.trim() || isRevising || disabled}
          className="px-3.5 py-2 rounded-xl font-bold text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          {isRevising ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Memproses...</span>
            </>
          ) : (
            <span>Terapkan</span>
          )}
        </button>
      </form>

      {/* Quick Action Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-bold text-zinc-400 mr-0.5">
          Aksi Cepat:
        </span>
        {QUICK_SUGGESTIONS.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled || isRevising}
            onClick={() => handleQuickClick(suggestion)}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
