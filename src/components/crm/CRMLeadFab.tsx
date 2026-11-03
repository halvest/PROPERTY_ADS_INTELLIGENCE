"use client";

import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface CRMLeadFabProps {
  onOpenManual: () => void;
  onOpenUpload: () => void;
}

export function CRMLeadFab({ onOpenManual, onOpenUpload }: CRMLeadFabProps) {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
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

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <>
      {/* Backdrop overlay for focus and easy dismiss on mobile/desktop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 dark:bg-black/40 backdrop-blur-2xs transition-opacity duration-200"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating Container (Fixed Bottom-Right) */}
      <div className="fixed bottom-6 right-6 z-40 sm:bottom-8 sm:right-8 flex flex-col items-end select-none">
        {/* Expanded Action Menu */}
        {isOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            aria-label={locale === "id" ? "Menu Tambah Prospek" : "Add Lead Menu"}
            className="mb-3 w-72 sm:w-80 rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in slide-in-from-bottom-4 duration-200"
          >
            {/* Header label */}
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/80 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {locale === "id" ? "Tambah Prospek CRM" : "Add CRM Lead"}
              </span>
            </div>

            <div className="space-y-1">
              {/* Option A: Tambah Lead Manual */}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleAction(onOpenManual)}
                className="w-full flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/70 cursor-pointer group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v6m3-3h-6m-1.5-1.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM3.75 20.25a7.5 7.5 0 0115 0" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors block truncate">
                    {locale === "id" ? "Tambah Lead Manual" : "Add Lead Manually"}
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">
                    {locale === "id" ? "Input form data prospek satu per satu" : "Input prospect data one by one"}
                  </span>
                </div>
              </button>

              {/* Option B: Upload Leads via Template */}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleAction(onOpenUpload)}
                className="w-full flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/70 cursor-pointer group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors block truncate">
                    {locale === "id" ? "Upload Leads via Template" : "Upload Leads via Template"}
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">
                    {locale === "id" ? "Impor file spreadsheet .xlsx atau .csv" : "Import spreadsheet file (.xlsx or .csv)"}
                  </span>
                </div>
              </button>
            </div>

            {/* Quick Template Download Links Footer */}
            <div className="mt-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 px-2 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 dark:text-zinc-500 font-medium">
                {locale === "id" ? "Template:" : "Template:"}
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <a
                  href="/api/leads/template?format=xlsx"
                  download="template_crm_leads_hdcreative.xlsx"
                  className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold transition-colors"
                >
                  .XLSX
                </a>
                <a
                  href="/api/leads/template?format=csv"
                  download="template_crm_leads_hdcreative.csv"
                  className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold transition-colors"
                >
                  .CSV
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Primary FAB Trigger Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={isOpen ? (locale === "id" ? "Tutup menu" : "Close menu") : (locale === "id" ? "Tambah Lead" : "Add Lead")}
          className={`group flex items-center gap-2 rounded-full px-4.5 py-3 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer ${
            isOpen
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 scale-100"
              : "bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 hover:-translate-y-0.5"
          }`}
        >
          {/* Animated Icon: Plus morphs to X */}
          <div
            className={`transition-transform duration-200 ease-out ${
              isOpen ? "rotate-45" : "rotate-0"
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>

          <span className="text-xs font-semibold tracking-wide">
            {isOpen
              ? locale === "id"
                ? "Tutup"
                : "Close"
              : locale === "id"
              ? "Tambah Lead"
              : "Add Lead"}
          </span>
        </button>
      </div>
    </>
  );
}

