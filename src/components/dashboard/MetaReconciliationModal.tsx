"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface MetricComparisonItem {
  metricName: string;
  metaSourceValue: number;
  persistedDbValue: number;
  difference: number;
  variancePercent: number;
  status: "EXACT_MATCH" | "REALTIME_ACCUMULATION" | "VARIANCE_DETECTED" | "UNAVAILABLE";
  explanation: string;
}

export interface DiagnosticsReport {
  adAccountId: string;
  accountName: string;
  timezone: string;
  currency: string;
  apiVersion: string;
  reportingPeriod: {
    preset: string;
    since: string | null;
    until: string | null;
  };
  lastSyncedAt: string | null;
  reconciliationStatus: "VERIFIED_ACCURATE" | "NEEDS_SYNC" | "ATTENTION_REQUIRED";
  summary: string;
  metrics: MetricComparisonItem[];
  metaAdsCount: number;
  dbAdsCount: number;
  timestamp: string;
}

interface MetaReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: string;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export function MetaReconciliationModal({
  isOpen,
  onClose,
  dateRange,
  onTriggerSync,
  isSyncing = false,
}: MetaReconciliationModalProps) {
  const { formatCurrency, formatNumber } = useI18n();
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ads/diagnostics?dateRange=${encodeURIComponent(dateRange)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setReport(json.data);
      } else {
        setError(json.error || "Gagal memuat data rekonsiliasi Meta");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kesalahan koneksi ke server");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(`/api/ads/diagnostics?dateRange=${encodeURIComponent(dateRange)}`);
          const json = await res.json();
          if (!ignore) {
            if (res.ok && json.success) {
              setReport(json.data);
            } else {
              setError(json.error || "Gagal memuat data rekonsiliasi Meta");
            }
          }
        } catch (err) {
          if (!ignore) {
            setError(err instanceof Error ? err.message : "Kesalahan koneksi ke server");
          }
        } finally {
          if (!ignore) {
            setLoading(false);
          }
        }
      })();
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, dateRange]);

  if (!isOpen) return null;

  const formatValue = (metricName: string, val: number) => {
    if (metricName.toLowerCase().includes("spend")) {
      return formatCurrency(val);
    }
    return formatNumber(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden text-zinc-800 dark:text-zinc-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconciliation-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-4 bg-zinc-50/70 dark:bg-zinc-900/80">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="reconciliation-modal-title"
                className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50"
              >
                Audit Rekonsiliasi Data Meta Ads
              </h2>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 uppercase tracking-wider">
                Ground Truth Verified
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Audit matematis langsung antara basis data lokal dasbor vs respons resmi Meta Marketing API (Ads Manager).
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
              <p className="text-zinc-500 text-xs font-medium">
                Mengambil data terkini langsung dari Meta Marketing API...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <p className="font-semibold text-xs mb-1">Gagal Menjalankan Audit Rekonsiliasi</p>
              <p className="text-[11px]">{error}</p>
              <button
                type="button"
                onClick={fetchDiagnostics}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          ) : report ? (
            <>
              {/* Account & Audit Parameters Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 text-[11px]">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Akun Meta Ads</span>
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {report.accountName}
                  </span>
                  <span className="text-[10px] text-zinc-400 block font-mono">
                    {report.adAccountId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Zona Waktu & Mata Uang</span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {report.timezone}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    {report.currency} (IDR) • API {report.apiVersion}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Rentang Tanggal Dilaporkan</span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {report.reportingPeriod.since || "Awal"} s/d {report.reportingPeriod.until || "Kini"}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    Preset: <span className="font-mono font-medium">{report.reportingPeriod.preset}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Atribusi Meta</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    Account Attribution
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    CTWA: 7-day click / 1-day view
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              <div
                className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                  report.reconciliationStatus === "VERIFIED_ACCURATE"
                    ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                    : report.reconciliationStatus === "NEEDS_SYNC"
                    ? "border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200"
                    : "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {report.reconciliationStatus === "VERIFIED_ACCURATE" ? (
                    <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {report.reconciliationStatus === "VERIFIED_ACCURATE"
                        ? "Rekonsiliasi Sempurna (100% Identik)"
                        : report.reconciliationStatus === "NEEDS_SYNC"
                        ? "Iklan Sedang Berjalan (Akumulasi Real-Time)"
                        : "Perhatian Diperlukan"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs opacity-90 leading-relaxed">
                    {report.summary}
                  </p>
                </div>
              </div>

              {/* Metrics Table */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold text-[11px]">
                        <th className="py-2.5 px-3">Metrik Utama</th>
                        <th className="py-2.5 px-3 text-right">Meta API (Ground Truth)</th>
                        <th className="py-2.5 px-3 text-right">Database Dasbor</th>
                        <th className="py-2.5 px-3 text-right">Selisih</th>
                        <th className="py-2.5 px-3 text-right">Variansi</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Keterangan Teknis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px]">
                      {report.metrics.map((m) => {
                        const isMatch = m.status === "EXACT_MATCH";
                        const isRealtime = m.status === "REALTIME_ACCUMULATION";
                        return (
                          <tr
                            key={m.metricName}
                            className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors ${
                              isMatch ? "" : isRealtime ? "bg-amber-50/20 dark:bg-amber-950/10" : "bg-rose-50/20 dark:bg-rose-950/10"
                            }`}
                          >
                            <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                              {m.metricName}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                              {formatValue(m.metricName, m.metaSourceValue)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                              {formatValue(m.metricName, m.persistedDbValue)}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-mono font-medium ${
                                m.difference === 0
                                  ? "text-zinc-400"
                                  : m.difference > 0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              {m.difference === 0
                                ? "0"
                                : `${m.difference > 0 ? "+" : ""}${formatValue(m.metricName, m.difference)}`}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-medium">
                              {m.variancePercent.toFixed(2)}%
                            </td>
                            <td className="py-2 px-3 text-center">
                              {isMatch ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Identik
                                </span>
                              ) : isRealtime ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Real-time
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  Selisih
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400 text-[10px] max-w-[240px]">
                              {m.explanation}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Explanatory Footer Card */}
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-3 border border-zinc-200/80 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1.5">
                <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Catatan Integritas Data & Atribusi Meta:
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[10px]">
                  <li>
                    <strong>Ground Truth Meta:</strong> Seluruh metrik dihitung langsung dari endpoint resmi Meta Marketing API v21.0 dengan parameter <code className="font-mono bg-zinc-200/60 dark:bg-zinc-700 px-1 rounded">use_account_attribution_setting=true</code>.
                  </li>
                  <li>
                    <strong>Iklan Berjalan Aktif (Today):</strong> Jika rentang waktu mencakup hari ini, impresi dan belanja terus bertambah di server Meta setiap menit. Menekan tombol <em>Sinkronkan Meta</em> akan segera menyerap data akumulasi terbaru ke database dasbor.
                  </li>
                  <li>
                    <strong>Hasil Percakapan (CTWA):</strong> Menggunakan action type resmi Meta <code className="font-mono bg-zinc-200/60 dark:bg-zinc-700 px-1 rounded">onsite_conversion.messaging_conversation_started_7d</code> tanpa substitusi klik atau estimasi buatan.
                  </li>
                </ul>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-5 py-3.5 bg-zinc-50/70 dark:bg-zinc-900/80">
          <div className="text-[10px] text-zinc-400 font-mono">
            {report?.timestamp ? `Audit dijalankan: ${new Date(report.timestamp).toLocaleTimeString("id-ID")}` : ""}
          </div>

          <div className="flex items-center gap-2">
            {onTriggerSync && (
              <button
                type="button"
                onClick={async () => {
                  onTriggerSync();
                  // Re-fetch diagnostics shortly after sync starts
                  setTimeout(fetchDiagnostics, 3000);
                }}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-semibold shadow-2xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                <svg
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {isSyncing ? "Menyinkronkan..." : "Sinkronkan & Perbarui"}
              </button>
            )}

            <button
              type="button"
              onClick={fetchDiagnostics}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              Muat Ulang Audit
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
