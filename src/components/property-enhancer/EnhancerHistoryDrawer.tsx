"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface EnhancementHistoryItem {
  id: string;
  original_image_url: string;
  enhanced_image_url: string | null;
  original_width: number | null;
  original_height: number | null;
  output_width: number | null;
  output_height: number | null;
  file_name: string;
  enhancement_mode: string;
  preset: string;
  created_at: string;
}

export interface EnhancerHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectHistory: (item: EnhancementHistoryItem) => void;
}

export function EnhancerHistoryDrawer({
  isOpen,
  onClose,
  onSelectHistory,
}: EnhancerHistoryDrawerProps) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [items, setItems] = useState<EnhancementHistoryItem[] | null>(null);
  const isLoading = isOpen && items === null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    fetch("/api/property-enhancer/history")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setItems(json.data);
        } else {
          setItems([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
      setItems(null);
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const listItems = items ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {isEn ? "Enhancement History" : "Riwayat Peningkatan"}
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {isEn
                ? "Previously processed property photos in this workspace."
                : "Daftar foto properti yang telah diproses sebelumnya."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label={isEn ? "Close" : "Tutup"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 dark:border-neutral-700 dark:border-t-white rounded-full animate-spin" />
              <span>{isEn ? "Loading history..." : "Memuat riwayat..."}</span>
            </div>
          ) : listItems.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-400">
              {isEn
                ? "No photo history in this workspace yet."
                : "Belum ada riwayat foto pada ruang kerja ini."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {listItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col justify-between gap-3 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.enhanced_image_url || item.original_image_url}
                      alt={item.file_name}
                      className="w-14 h-14 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700 shrink-0 bg-neutral-100 dark:bg-neutral-800"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                        {item.file_name}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 block mt-0.5">
                        {item.output_width && item.output_height
                          ? `${item.output_width} × ${item.output_height} px`
                          : isEn
                          ? "Enhanced"
                          : "Ditingkatkan"}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">
                        {new Date(item.created_at).toLocaleDateString(isEn ? "en-US" : "id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectHistory(item);
                      onClose();
                    }}
                    className="w-full py-1.5 px-3 rounded-md text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer text-center"
                  >
                    {isEn ? "Open in Editor" : "Buka di Editor"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
