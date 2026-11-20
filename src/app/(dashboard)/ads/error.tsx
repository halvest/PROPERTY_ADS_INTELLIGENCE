"use client";

import { useEffect } from "react";
import Link from "next/link";

interface AdsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdsError({ error, reset }: AdsErrorProps) {
  useEffect(() => {
    // Log error telemetry
    console.error("[Ads Dashboard Error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const isRateLimit =
    error.message.includes("Rate Limit") ||
    error.message.includes("Code 17") ||
    error.message.includes("Code 80004") ||
    error.message.includes("429");

  const isAuthError =
    error.message.includes("Code 190") ||
    error.message.includes("UNAUTHORIZED") ||
    error.message.includes("FORBIDDEN") ||
    error.message.includes("Token tidak valid");

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center p-6 text-center">
      <div className="surface-card flex w-full flex-col items-center rounded-2xl border border-zinc-200/90 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
          isRateLimit
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20"
            : isAuthError
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20"
            : "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20"
        }`}>
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {isRateLimit
            ? "Batas Panggilan Meta API Tercapai"
            : isAuthError
            ? "Autentikasi Meta Diperlukan"
            : "Gagal Memuat Dashboard Iklan"}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {isRateLimit
            ? "Akun iklan Anda sedang mengalami pembatasan laju panggilan (Rate Limit). Meta sedang mendinginkan kuota komputasi server. Harap tunggu sejenak lalu muat ulang."
            : isAuthError
            ? "Sesi otorisasi Meta Ads telah kedaluwarsa atau belum memiliki izin yang cukup. Silakan hubungkan ulang akun Meta Anda di menu Pengaturan."
            : error.message || "Terjadi kesalahan yang tidak terduga saat mengambil metrik kampanye."}
        </p>

        {error.digest && (
          <span className="mt-3 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            Digest: {error.digest}
          </span>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
          >
            Coba Lagi
          </button>

          {isAuthError && (
            <Link
              href="/settings"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Buka Pengaturan
            </Link>
          )}

          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Kembali ke Ringkasan
          </Link>
        </div>
      </div>
    </div>
  );
}

