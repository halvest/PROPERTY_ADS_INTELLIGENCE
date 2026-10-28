"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface DeliveryDiagnosticsProps {
  campaignCounts: { total: number; active: number; paused: number; archived: number; other: number };
  adCounts: {
    total: number;
    active: number;
    campaignPaused: number;
    adPaused: number;
    archived: number;
    deleted: number;
    unknown: number;
  };
  className?: string;
}

export function DeliveryDiagnosticsPanel({ campaignCounts, adCounts, className = "" }: DeliveryDiagnosticsProps) {
  const { formatNumber, locale } = useI18n();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const campaignRows = [
    [locale === "id" ? "Aktif" : "Active", campaignCounts.active],
    [locale === "id" ? "Dijeda" : "Paused", campaignCounts.paused],
    [locale === "id" ? "Diarsipkan" : "Archived", campaignCounts.archived],
    [locale === "id" ? "Lainnya / belum diketahui" : "Other / unknown", campaignCounts.other],
  ] as const;
  const deliveryRows = [
    [locale === "id" ? "Terverifikasi menayangkan" : "Verified delivering", adCounts.active],
    [locale === "id" ? "Campaign induk dijeda" : "Parent campaign paused", adCounts.campaignPaused],
    [locale === "id" ? "Iklan dijeda" : "Ad paused", adCounts.adPaused],
    [locale === "id" ? "Diarsipkan" : "Archived", adCounts.archived],
    [locale === "id" ? "Dihapus" : "Deleted", adCounts.deleted],
    [locale === "id" ? "Belum diketahui" : "Unknown", adCounts.unknown],
  ] as const;
  const campaignClassified = campaignRows.reduce((total, [, value]) => total + value, 0);
  const deliveryClassified = deliveryRows.reduce((total, [, value]) => total + value, 0);

  return (
    <section className={`rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${className}`} aria-labelledby="delivery-diagnostics-title">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 id="delivery-diagnostics-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {locale === "id" ? "Diagnostik Penayangan" : "Delivery Diagnostics"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {locale === "id" ? "Status campaign induk dan delivery efektif" : "Parent campaign status and effective delivery"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          aria-expanded={isExpanded}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
        >
          {isExpanded
            ? (locale === "id" ? "Tutup" : "Close")
            : (locale === "id" ? "Lihat detail" : "View details")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 px-4 py-3 sm:grid-cols-3 dark:border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500">
            {locale === "id" ? "Status campaign induk" : "Parent campaign status"}
          </p>
          <p className="mt-1 text-sm font-medium tabular-nums">
            {campaignCounts.active} {locale === "id" ? "aktif" : "active"}{" "}
            <span className="text-zinc-400">/ {campaignCounts.total}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">
            {locale === "id" ? "Delivery efektif" : "Effective delivery"}
          </p>
          <p className="mt-1 text-sm font-medium tabular-nums">
            {adCounts.active} {locale === "id" ? "menayangkan" : "delivering"}{" "}
            <span className="text-zinc-400">/ {adCounts.total}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">
            {locale === "id" ? "Status klasifikasi" : "Classification status"}
          </p>
          <p className="mt-1 text-sm font-medium tabular-nums">
            {deliveryClassified} / {adCounts.total} {locale === "id" ? "iklan" : "ads"}
          </p>
        </div>
      </div>

      {isExpanded && (
        <div className="grid gap-5 border-t border-zinc-100 px-4 py-4 sm:grid-cols-2 dark:border-zinc-800">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
                {locale === "id" ? "Campaign induk" : "Parent campaigns"}
              </h3>
              <span className="text-zinc-500">
                {campaignClassified} {locale === "id" ? "dari" : "of"} {campaignCounts.total} {locale === "id" ? "terklasifikasi" : "classified"}
              </span>
            </div>
            <dl className="space-y-1.5">
              {campaignRows.map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs">
                  <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
                  <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
                {locale === "id" ? "Status delivery efektif" : "Effective delivery status"}
              </h3>
              <span className="text-zinc-500">
                {deliveryClassified} {locale === "id" ? "dari" : "of"} {adCounts.total} {locale === "id" ? "terklasifikasi" : "classified"}
              </span>
            </div>
            <dl className="space-y-1.5">
              {deliveryRows.map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs">
                  <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
                  <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
