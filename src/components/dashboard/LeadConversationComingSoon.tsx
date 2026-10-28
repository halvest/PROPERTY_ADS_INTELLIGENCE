"use client";

import React, { useState } from "react";

export function LeadConversationComingSoon() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-50">
                Analisis Percakapan & Kualitas Lead WhatsApp
              </h3>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Evaluasi mutu percakapan calon pembeli properti, validasi kesiapan beli (Buyer Score), dan responsivitas sales otomatis pasca integrasi WhatsApp Coexistence.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 shrink-0 cursor-pointer self-start sm:self-center"
        >
          {isExpanded ? "Sembunyikan Info ↑" : "Pelajari Fitur Ini ↓"}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">
                1. Atribusi Obrolan Riil
              </span>
              <p className="text-[11px] leading-relaxed">
                Menghubungkan pesan masuk pertama dari iklan Click-to-WhatsApp langsung ke campaign spesifik via parameter referral Meta tanpa data buatan.
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">
                2. Scoring Kesiapan Pembeli
              </span>
              <p className="text-[11px] leading-relaxed">
                Penilaian deterministik kesiapan anggaran, preferensi tipe unit properti, dan urgensi survei lokasi dari bukti obrolan teks riil.
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">
                3. Audit Respons Sales (SLA)
              </span>
              <p className="text-[11px] leading-relaxed">
                Pengukuran waktu respons pertama tim sales internal untuk memastikan prospek potensial segera ditindaklanjuti sebelum dingin.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 italic">
            <span>ℹ️</span>
            <span>
              Prinsip integritas data: HD Creative tidak merekayasa skor pembeli atau estimasi persentase closing jika percakapan belum terhubung secara nyata.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
