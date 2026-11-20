"use client";

import React, { useState } from "react";
import type { StudioMemory, StudioMemoryCategory } from "@/lib/ai/creative-studio/types";

export interface StudioMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: StudioMemory[];
  onAddMemory: (category: StudioMemoryCategory, key: string, value: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

export function StudioMemoryModal({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
}: StudioMemoryModalProps) {
  const [newCategory, setNewCategory] = useState<StudioMemoryCategory>("user_preference");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddMemory(newCategory, newKey.trim(), newValue.trim());
      setNewKey("");
      setNewValue("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Creative Memory & Preferences</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                AI mengingat preferensi visual dan identitas brand Anda di setiap generasi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Add New Memory Form */}
          <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Tambah Preferensi Baru</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as StudioMemoryCategory)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100"
              >
                <option value="user_preference">User Preference</option>
                <option value="brand_identity">Brand Identity</option>
                <option value="style_guide">Style Guide</option>
                <option value="pinned_context">Pinned Context</option>
              </select>

              <input
                type="text"
                placeholder="Kata kunci (mis: Gaya Pencahayaan)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100 dark:placeholder-zinc-500 sm:col-span-2"
              />
            </div>

            <textarea
              rows={2}
              placeholder="Instruksi preferensi (mis: Selalu gunakan nuansa hangat natural daylight dengan bayangan lembut, hindari kontras terlalu gelap)..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100 dark:placeholder-zinc-500"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newKey.trim() || !newValue.trim() || isSubmitting}
                className="btn-solar rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-xs disabled:opacity-40 cursor-pointer"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan ke Memory"}
              </button>
            </div>
          </form>

          {/* Existing Memories List */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Preferensi Tersimpan ({memories.length})
            </h4>

            {memories.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
                Belum ada preferensi tersimpan. Tambahkan preferensi pertama Anda di atas.
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{m.key}</span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {m.category.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-300 text-[11px] leading-relaxed">{m.value}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteMemory(m.id)}
                      title="Hapus preferensi"
                      className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end border-t border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-750 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
