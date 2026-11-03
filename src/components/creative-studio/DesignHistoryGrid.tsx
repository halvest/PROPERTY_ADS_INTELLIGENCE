"use client";

import React, { useState, useEffect } from "react";
import { AdCompositionEngine } from "@/lib/ai/creative-studio/composition-engine";
import type { HistoricalGenerationItem, ComposedAdLayout, CreativeStrategy, AspectRatio, StylePreset } from "@/lib/ai/creative-studio/types";

interface DesignHistoryGridProps {
  onLoadCreative: (item: {
    layout: ComposedAdLayout;
    strategy: CreativeStrategy;
    aspectRatio: AspectRatio;
    stylePreset: StylePreset;
    projectName: string;
  }) => void;
  onRefreshStats?: () => void;
}

export function DesignHistoryGrid({ onLoadCreative }: DesignHistoryGridProps) {
  const [history, setHistory] = useState<HistoricalGenerationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/creative-studio/projects?limit=30");
      const json = await res.json();
      if (res.ok && json.success) {
        setHistory(json.data || []);
      }
    } catch {
      // Non-blocking history load
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Hapus desain iklan ini dari riwayat?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/creative-studio/projects?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
      }
    } catch {
      // Non-blocking delete error
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelect = (item: HistoricalGenerationItem) => {
    const brief = {
      projectName: item.project?.project_name || "Properti",
      headline: item.project?.headline || item.prompt_used || "Exclusive Property",
      subheadline: item.project?.subheadline || "",
      propertyType: item.project?.property_type || "Rumah Tinggal",
      propertyLocation: item.project?.property_location || "",
      startingPrice: item.project?.starting_price ? `Rp ${Number(item.project.starting_price).toLocaleString("id-ID")}` : "",
      promoHeadline: item.project?.promo_headline || "",
      ctaText: item.project?.cta_text || "Hubungi Sales",
      aspectRatio: item.aspect_ratio,
      stylePreset: item.style_preset,
      assets: [],
    };

    const imageUrl = item.final_composed_url || item.raw_image_url;
    const layout = AdCompositionEngine.composeAd(
      brief,
      item.creative_direction,
      imageUrl,
      item.aspect_ratio
    );
    layout.finalComposedUrl = imageUrl;
    layout.isPureGeneratedImage = true;
    layout.adArchetypeId = item.creative_direction?.adArchetypeId || item.style_preset;

    onLoadCreative({
      layout,
      strategy: item.creative_direction,
      aspectRatio: item.aspect_ratio,
      stylePreset: item.style_preset,
      projectName: item.project?.project_name || "Properti",
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
        <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
          Belum Ada Riwayat Desain Iklan
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
          Desain iklan properti yang dibuat menggunakan Muse AI Studio akan tersimpan secara otomatis di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Galeri Desain Tersimpan ({history.length})
        </h3>
        <button
          type="button"
          onClick={fetchHistory}
          className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Segarkan Galeri
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {history.map((item) => (
          <div
            key={item.id}
            onClick={() => handleSelect(item)}
            className="group cursor-pointer rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs hover:shadow-lg transition-all hover:border-sky-500/50 flex flex-col justify-between"
          >
            {/* Visual Preview */}
            <div className="aspect-[4/3] bg-zinc-950 relative overflow-hidden">
              <img
                src={item.final_composed_url || item.raw_image_url}
                alt={item.project?.project_name || "Desain Iklan"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              {/* Aspect Ratio Badge */}
              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/10">
                {item.aspect_ratio}
              </span>

              {/* Quality Score Badge */}
              {item.quality_score?.overall && (
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                  {item.quality_score.overall}/100
                </span>
              )}

              {/* Project title overlay */}
              <div className="absolute bottom-2 left-3 right-3 text-white">
                <span className="text-[10px] text-sky-300 font-bold uppercase tracking-wider block">
                  {item.project?.property_type || "Properti"}
                </span>
                <h4 className="text-sm font-bold truncate">
                  {item.project?.project_name || "Grand Harmoni"}
                </h4>
              </div>
            </div>

            {/* Content Details & Delete Button */}
            <div className="p-3.5 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{new Date(item.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="px-2.5 py-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition-colors"
                >
                  Muat ke Studio
                </button>
                <button
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={(e) => handleDelete(item.id, e)}
                  title="Hapus Desain"
                  className="p-1 text-zinc-400 hover:text-rose-500 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
