"use client";

import React, { useState } from "react";
import type { StudioGenerationItem, StudioMemory } from "@/lib/ai/creative-studio/types";

export interface StudioContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGeneration: StudioGenerationItem | null;
  generations: StudioGenerationItem[];
  onSelectGeneration: (gen: StudioGenerationItem) => void;
  memories: StudioMemory[];
  onOpenMemoryModal: () => void;
}

export function StudioContextPanel({
  isOpen,
  onClose,
  selectedGeneration,
  generations,
  onSelectGeneration,
  memories,
  onOpenMemoryModal,
}: StudioContextPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "history" | "memory">("details");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    if (!selectedGeneration?.prompt_used) return;
    navigator.clipboard.writeText(selectedGeneration.prompt_used);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="fixed top-0 bottom-0 right-0 z-30 flex w-80 flex-col border-l border-zinc-200/80 bg-zinc-50/95 text-zinc-900 transition-all duration-300 dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:text-zinc-100 lg:static">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-zinc-900 dark:text-zinc-50 uppercase">Context Inspector</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
          aria-label="Close inspector"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200/80 bg-zinc-100/60 px-2 py-1 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition cursor-pointer ${
            activeTab === "details"
              ? "bg-white text-zinc-950 font-semibold shadow-xs dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition cursor-pointer ${
            activeTab === "history"
              ? "bg-white text-zinc-950 font-semibold shadow-xs dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          History ({generations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("memory")}
          className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition cursor-pointer ${
            activeTab === "memory"
              ? "bg-white text-zinc-950 font-semibold shadow-xs dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Memory ({memories.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
        {/* Tab 1: Image Details */}
        {activeTab === "details" && (
          <>
            {selectedGeneration ? (
              <div className="space-y-4">
                {/* Image Preview Card */}
                <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <img
                    src={selectedGeneration.final_composed_url || selectedGeneration.raw_image_url}
                    alt="Active visual"
                    className="w-full object-cover max-h-56"
                  />
                  {selectedGeneration.is_fallback && (
                    <div className="absolute top-2 right-2 rounded-md bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-950 shadow-xs">
                      Offline Fallback
                    </div>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="rounded-xl border border-zinc-200/90 bg-white p-3 space-y-2 text-xs shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Aspect Ratio:</span>
                    <span className="font-mono text-zinc-900 dark:text-white">{selectedGeneration.aspect_ratio}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Resolution:</span>
                    <span className="font-mono text-zinc-900 dark:text-white">{selectedGeneration.width} × {selectedGeneration.height}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Model Engine:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{selectedGeneration.model_used || "muse-image-1.0"}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Provider:</span>
                    <span className="text-zinc-800 dark:text-zinc-200">{selectedGeneration.provider || "meta_muse"}</span>
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Prompt Digunakan</span>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 cursor-pointer"
                    >
                      {copied ? "Tersalin!" : "Salin Prompt"}
                    </button>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-800 select-text max-h-48 overflow-y-auto shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-200">
                    {selectedGeneration.prompt_used}
                  </div>
                </div>

                {/* Revision Note */}
                {selectedGeneration.revision_instruction && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Catatan Revisi</span>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200/90">
                      {selectedGeneration.revision_instruction}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
                Pilih gambar pada percakapan untuk melihat metadata detail.
              </div>
            )}
          </>
        )}

        {/* Tab 2: History / Version DAG */}
        {activeTab === "history" && (
          <div className="space-y-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Generasi Percakapan Ini ({generations.length})
            </span>
            {generations.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">Belum ada riwayat gambar.</div>
            ) : (
              <div className="space-y-2">
                {generations.map((gen, idx) => {
                  const isSelected = selectedGeneration?.id === gen.id;
                  return (
                    <div
                      key={gen.id}
                      onClick={() => onSelectGeneration(gen)}
                      className={`flex items-center gap-3 rounded-xl border p-2 transition cursor-pointer ${
                        isSelected
                          ? "border-amber-500/70 bg-amber-500/[0.04] shadow-xs dark:border-amber-500/60 dark:bg-amber-950/20"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 shadow-2xs"
                      }`}
                    >
                      <img
                        src={gen.final_composed_url || gen.raw_image_url}
                        alt="Thumbnail"
                        className="h-12 w-12 shrink-0 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white">Versi #{idx + 1}</span>
                          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{gen.aspect_ratio}</span>
                        </div>
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {gen.revision_instruction || gen.prompt_used}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Active Memory Context */}
        {activeTab === "memory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Active Studio Memory
              </span>
              <button
                type="button"
                onClick={onOpenMemoryModal}
                className="text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 cursor-pointer"
              >
                Kelola
              </button>
            </div>

            {memories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                Belum ada preferensi tersimpan. Klik "Kelola" untuk menambahkan preferensi visual.
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-zinc-200 bg-white p-2.5 text-xs space-y-1 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{m.key}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {m.category.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">{m.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
