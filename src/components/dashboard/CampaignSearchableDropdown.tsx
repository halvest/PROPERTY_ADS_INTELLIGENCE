"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";

export interface CampaignSearchableDropdownProps {
  campaigns: CampaignDetailData[];
  selectedCampaignId: string;
  onSelectCampaign: (campaignId: string) => void;
  className?: string;
}

export function CampaignSearchableDropdown({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  className = "",
}: CampaignSearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Currently selected campaign object
  const selectedCampaign = useMemo(() => {
    if (selectedCampaignId === "all") return null;
    return campaigns.find((c) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // Logically sort campaigns: Active first, then Paused, then Archived / Others
  const sortedCampaigns = useMemo(() => {
    const list = [...campaigns];
    list.sort((a, b) => {
      const getPriority = (status: string) => {
        const s = (status || "").toUpperCase();
        if (s === "ACTIVE") return 1;
        if (s === "PAUSED") return 2;
        if (s === "ARCHIVED") return 3;
        return 4;
      };
      const priorityDiff = getPriority(a.status) - getPriority(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name, "id-ID");
    });
    return list;
  }, [campaigns]);

  // Filter campaigns by query
  const filteredCampaigns = useMemo(() => {
    if (!searchQuery.trim()) return sortedCampaigns;
    const q = searchQuery.toLowerCase().trim();
    return sortedCampaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.providerCampaignId.toLowerCase().includes(q) ||
        (c.objective && c.objective.toLowerCase().includes(q))
    );
  }, [sortedCampaigns, searchQuery]);

  const handleSelect = (id: string) => {
    onSelectCampaign(id);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCampaign("all");
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "ACTIVE") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Aktif
        </span>
      );
    }
    if (s === "PAUSED") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          Dijeda
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        Arsip
      </span>
    );
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button with Ellipsis Control and Tooltip */}
      <button
        type="button"
        id="campaign-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={selectedCampaign ? `Campaign: ${selectedCampaign.name}` : "Filter berdasarkan campaign Meta"}
        className={`group flex items-center justify-between gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs transition-colors cursor-pointer select-none max-w-[210px] sm:max-w-[260px] ${
          selectedCampaignId !== "all"
            ? "border-indigo-300 bg-indigo-50/70 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <svg
            className={`h-3.5 w-3.5 shrink-0 ${
              selectedCampaignId !== "all" ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span className="truncate">
            {selectedCampaign ? selectedCampaign.name : "Semua Campaign"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {selectedCampaignId !== "all" && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onSelectCampaign("all");
                }
              }}
              title="Hapus filter campaign"
              className="rounded p-0.5 hover:bg-indigo-200/60 dark:hover:bg-indigo-900/60 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-labelledby="campaign-dropdown-trigger"
          className="absolute left-0 mt-1.5 w-72 sm:w-80 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 z-50 overflow-hidden flex flex-col"
          style={{ maxHeight: "360px" }}
        >
          {/* Internal Search Header */}
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama campaign..."
                className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-7 text-xs text-zinc-800 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Campaign List */}
          <div className="overflow-y-auto flex-1 divide-y divide-zinc-50 dark:divide-zinc-800/50 max-h-64 p-1">
            {/* Opsi: Semua Campaign */}
            {!searchQuery && (
              <button
                type="button"
                onClick={() => handleSelect("all")}
                className={`w-full text-left flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
                  selectedCampaignId === "all"
                    ? "bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                    : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Semua Campaign</span>
                  <span className="text-[10px] text-zinc-400">({campaigns.length})</span>
                </div>
                {selectedCampaignId === "all" && (
                  <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )}

            {/* Campaign Items */}
            {filteredCampaigns.length > 0 ? (
              filteredCampaigns.map((c) => {
                const isSelected = selectedCampaignId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    title={c.name}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer group space-y-1 ${
                      isSelected
                        ? "bg-indigo-50 font-bold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate block font-medium" title={c.name}>
                        {c.name}
                      </span>
                      {isSelected && (
                        <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(c.status)}
                        {c.totalAdsCount !== undefined && (
                          <span>{c.totalAdsCount} iklan</span>
                        )}
                      </div>
                      {c.objective && (
                        <span className="font-mono text-[9px] uppercase tracking-wider truncate max-w-[100px]">
                          {c.objective}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 px-4 text-center space-y-1">
                <svg className="h-5 w-5 mx-auto text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Tidak ada campaign yang cocok
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Coba kata kunci pencarian yang lain.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
