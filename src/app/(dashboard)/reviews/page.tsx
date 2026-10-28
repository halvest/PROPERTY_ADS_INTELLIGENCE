"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AttributionBadge, ScorePill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ReviewQueueItem } from "@/lib/data/types";
import type { AttributionStatus } from "@/domain/attribution/types";

export default function ReviewQueuePage() {
  const { t, locale } = useI18n();
  const { addToast } = useToast();

  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal correction state
  const [activeItem, setActiveItem] = useState<{
    leadId: string;
    leadName: string;
    currentStatus: AttributionStatus;
  } | null>(null);

  const [newStatus, setNewStatus] = useState<AttributionStatus>("verified");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/reviews", { cache: "no-store" });
        const json = await res.json();
        if (ignore) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        setQueue(json.data || []);
        setIsDemo(Boolean(json.isDemo));
      } catch (err) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Gagal memuat antrean";
          setLoadError(msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const handleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    if (!reason.trim()) {
      setErrorMsg(
        locale === "id"
          ? "Alasan koreksi wajib diisi secara eksplisit"
          : "Correction reason is strictly required"
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "attribution",
          leadId: activeItem.leadId,
          previousStatus: activeItem.currentStatus,
          newStatus,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan koreksi review");
      }

      addToast(
        "success",
        locale === "id" ? "Koreksi Berhasil Disimpan" : "Correction Saved",
        locale === "id"
          ? `Koreksi atribusi untuk '${activeItem.leadName}' telah dicatat ke audit log database.`
          : `Attribution correction for '${activeItem.leadName}' has been persisted to the audit log.`
      );
      setActiveItem(null);
      setReason("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      setErrorMsg(msg);
      addToast("error", locale === "id" ? "Gagal Menyimpan" : "Save Failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t.reviews.title}
            </h1>
            {isDemo && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                Demo Queue
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {t.reviews.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <svg
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {locale === "id" ? "Segarkan" : "Refresh"}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {queue.length} {t.reviews.needsReviewCount}
          </span>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="font-medium underline hover:text-rose-900 dark:hover:text-rose-100 cursor-pointer"
          >
            {locale === "id" ? "Coba lagi" : "Retry"}
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <div className="h-4 w-48 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          title={t.reviews.emptyTitle}
          description={t.reviews.emptyDesc}
        />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-500 dark:bg-zinc-900/60 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">{t.reviews.table.prospect}</th>
                  <th className="py-3 px-3 font-semibold">{t.reviews.table.flagReason}</th>
                  <th className="py-3 px-3 font-semibold">{t.reviews.table.buyerScore}</th>
                  <th className="py-3 px-3 font-semibold">{t.reviews.table.salesScore}</th>
                  <th className="py-3 px-3 font-semibold">{t.reviews.table.attributionStatus}</th>
                  <th className="py-3 px-4 font-semibold text-right">{t.reviews.table.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {queue.map((item) => (
                  <tr key={item.leadId} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      <div>{item.leadName}</div>
                      <span className="font-mono text-[10px] text-zinc-400 font-normal">
                        {item.leadId}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                        <svg className="h-3.5 w-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {item.flagReason}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <ScorePill score={item.buyerScore} completeness={item.buyerCompleteness} />
                    </td>

                    <td className="py-3 px-3">
                      <ScorePill score={item.salesScore} />
                    </td>

                    <td className="py-3 px-3">
                      <AttributionBadge status={item.attributionStatus} />
                    </td>

                    <td className="py-3 px-4 text-right space-x-2">
                      <Link
                        href={`/leads/${item.leadId}`}
                        className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                      >
                        {t.reviews.table.openDetailBtn}
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveItem({
                            leadId: item.leadId,
                            leadName: item.leadName,
                            currentStatus: item.attributionStatus,
                          });
                          setNewStatus(item.attributionStatus === "verified" ? "inferred" : "verified");
                          setReason("");
                          setErrorMsg("");
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer shadow-2xs transition-colors"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        {t.reviews.table.correctBtn}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accessible Interactive Correction Modal */}
      {activeItem && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isSubmitting) setActiveItem(null);
          }}
          title={`${t.reviews.table.correctBtn}: ${activeItem.leadName}`}
          description={`${locale === "id" ? "Status saat ini:" : "Current status:"} ${activeItem.currentStatus}`}
        >
          <form onSubmit={handleCorrection} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                {t.leads.detail.newStatusLabel}
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as AttributionStatus)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs font-medium text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="verified">Verified ({locale === "id" ? "Terverifikasi" : "Verified"})</option>
                <option value="inferred">Inferred ({locale === "id" ? "Inferensi" : "Inferred"})</option>
                <option value="unknown">Unknown ({locale === "id" ? "Tidak Diketahui" : "Unknown"})</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                {t.leads.detail.reasonLabel}
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrorMsg("");
                }}
                disabled={isSubmitting}
                placeholder={t.leads.detail.reasonPlaceholder}
                className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {errorMsg && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                disabled={isSubmitting}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {t.leads.detail.saveCorrection}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

