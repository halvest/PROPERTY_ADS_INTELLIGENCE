"use client";

import React, { useState } from "react";

export interface WhatsAppScriptCardProps {
  phoneNumber?: string | null;
  scriptText?: string | null;
  destinationUrl?: string | null;
}

export function WhatsAppScriptCard({
  phoneNumber,
  scriptText,
  destinationUrl,
}: WhatsAppScriptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!scriptText) return;
    navigator.clipboard.writeText(scriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!scriptText && !phoneNumber) return null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-3 space-y-2 dark:border-emerald-500/20 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.79 14.07c-.24.68-1.4 1.25-1.92 1.33-.5.08-1.15.11-3.32-.78-2.77-1.15-4.55-3.98-4.69-4.16-.14-.19-1.13-1.5-1.13-2.86 0-1.36.71-2.03.96-2.31.25-.28.56-.35.74-.35.19 0 .37 0 .53.01.17.01.4.07.61.57.23.54.78 1.9.85 2.04.07.14.12.31.02.5-.09.19-.14.3-.28.46-.14.16-.3.35-.43.47-.14.14-.29.29-.12.58.17.29.74 1.22 1.58 1.97 1.09.97 2.01 1.27 2.3 1.41.29.14.46.12.63-.07.17-.19.74-.86.93-1.15.19-.29.38-.24.64-.14.26.1 1.66.78 1.95.92.29.14.48.21.55.33.07.11.07.66-.17 1.34z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Pre-filled WhatsApp Chat Script
          </span>
        </div>

        {phoneNumber && (
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            +{phoneNumber}
          </span>
        )}
      </div>

      {scriptText && (
        <div className="relative rounded-lg bg-white p-2.5 text-xs text-zinc-800 border border-emerald-200/60 shadow-2xs dark:bg-zinc-900 dark:border-emerald-900/60 dark:text-zinc-200">
          <p className="leading-relaxed font-sans italic whitespace-pre-wrap select-text">
            &ldquo;{scriptText}&rdquo;
          </p>

          <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              Skrip otomatis saat calon pembeli klik iklan
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Salin Skrip</span>
                  </>
                )}
              </button>

              {destinationUrl && (
                <a
                  href={destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition"
                  title="Buka tautan WhatsApp di tab baru"
                >
                  Buka WA ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
