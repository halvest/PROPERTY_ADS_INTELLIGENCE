"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { parseDateRange } from "@/lib/ads/date-utils";

export interface DateRangeFilterProps {
  currentRange: string;
  onChange: (range: string) => void;
  className?: string;
}

export function DateRangeFilter({ currentRange, onChange, className = "" }: DateRangeFilterProps) {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom range inputs
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [customError, setCustomError] = useState("");

  const presets = useMemo(() => [
    { id: "today", label: locale === "id" ? "Hari ini" : "Today" },
    { id: "yesterday", label: locale === "id" ? "Kemarin" : "Yesterday" },
    { id: "7d", label: locale === "id" ? "7 Hari Terakhir" : "Last 7 days" },
    { id: "14d", label: locale === "id" ? "14 Hari Terakhir" : "Last 14 days" },
    { id: "30d", label: locale === "id" ? "30 Hari Terakhir" : "Last 30 days" },
    { id: "this_month", label: locale === "id" ? "Bulan Ini" : "This month" },
    { id: "last_month", label: locale === "id" ? "Bulan Lalu" : "Last month" },
    { id: "all", label: locale === "id" ? "Semua Waktu" : "All time" },
  ], [locale]);

  // Compute active boundaries for human display
  const activeBoundaries = useMemo(() => {
    const { since, until } = parseDateRange(currentRange, "Asia/Jakarta");
    if (!since && !until) {
      return locale === "id" ? "Semua Periode" : "All Time";
    }
    if (since === until) {
      return since;
    }
    return `${since} – ${until}`;
  }, [currentRange, locale]);

  const activeLabel = useMemo(() => {
    const found = presets.find((p) => p.id === currentRange);
    if (found) return found.label;
    if (currentRange.includes(":") || currentRange.includes("_")) {
      return locale === "id" ? `Kustom: ${activeBoundaries}` : `Custom: ${activeBoundaries}`;
    }
    return currentRange;
  }, [currentRange, presets, activeBoundaries, locale]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSince || !customUntil) {
      setCustomError(locale === "id" ? "Pilih tanggal awal dan akhir" : "Select start and end dates");
      return;
    }
    if (customSince > customUntil) {
      setCustomError(locale === "id" ? "Tanggal awal tidak boleh melebihi tanggal akhir" : "Start date cannot be after end date");
      return;
    }
    setCustomError("");
    onChange(`${customSince}:${customUntil}`);
    setShowCustomModal(false);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
        aria-expanded={isOpen}
      >
        <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{activeLabel}</span>
        <span className="hidden md:inline font-mono text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 rounded">
          {activeBoundaries}
        </span>
        <svg className="h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-56 origin-top-right rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="px-2.5 py-1.5 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            {locale === "id" ? "Rentang Laporan (WIB)" : "Reporting Period (WIB)"}
          </div>
          <div className="py-1 space-y-0.5">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onChange(preset.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                  currentRange === preset.id
                    ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/60 dark:text-indigo-300"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{preset.label}</span>
                {currentRange === preset.id && (
                  <svg className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-100 pt-1 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setShowCustomModal(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer font-medium"
            >
              <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>{locale === "id" ? "Pilih Tanggal Kustom..." : "Custom Range..."}</span>
            </button>
          </div>
        </div>
      )}

      {/* Custom Range Dialog */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {locale === "id" ? "Pilih Periode Kustom" : "Select Custom Date Range"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyCustom} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "id" ? "Dari Tanggal (Since):" : "Start Date (Since):"}
                </label>
                <input
                  type="date"
                  value={customSince}
                  onChange={(e) => setCustomSince(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {locale === "id" ? "Sampai Tanggal (Until):" : "End Date (Until):"}
                </label>
                <input
                  type="date"
                  value={customUntil}
                  onChange={(e) => setCustomUntil(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {customError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {customError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
                >
                  {locale === "id" ? "Batal" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                >
                  {locale === "id" ? "Terapkan" : "Apply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

