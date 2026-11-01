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
  classifiedAds: number;
  className?: string;
}

export function DeliveryDiagnosticsPanel({ campaignCounts, adCounts, classifiedAds, className = "" }: DeliveryDiagnosticsProps) {
  const { formatNumber, locale } = useI18n();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const safeClassifiedAds = Math.min(Math.max(classifiedAds || 0, 0), adCounts.total);
  const isFullyClassified = adCounts.total > 0 && safeClassifiedAds === adCounts.total;

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

  const metrics = [
    {
      title: locale === "id" ? "Status Kampanye" : "Campaign Status",
      value: <>{formatNumber(campaignCounts.active)} <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{locale === "id" ? "aktif" : "active"}</span><span className="px-1 text-slate-300 dark:text-zinc-600">/</span>{formatNumber(campaignCounts.total)} <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{locale === "id" ? "kampanye" : "campaigns"}</span></>,
      description: locale === "id" ? "Jumlah kampanye yang diaktifkan di Meta Ads" : "Campaigns enabled in Meta Ads",
      icon: "campaign",
    },
    {
      title: locale === "id" ? "Penayangan Materi Iklan" : "Ad Delivery",
      value: <>{formatNumber(adCounts.active)} <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{locale === "id" ? "tayang" : "delivering"}</span><span className="px-1 text-slate-300 dark:text-zinc-600">/</span>{formatNumber(adCounts.total)} <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{locale === "id" ? "iklan" : "ads"}</span></>,
      description: locale === "id" ? "Materi iklan yang aktif mendistribusikan impresi" : "Ads actively delivering impressions",
      icon: "delivery",
    },
    {
      title: locale === "id" ? "Kelengkapan Pemetaan Data" : "Data Mapping Coverage",
      value: <>{formatNumber(safeClassifiedAds)} <span className="px-1 text-slate-300 dark:text-zinc-600">/</span>{formatNumber(adCounts.total)} <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">{locale === "id" ? "terpetakan" : "mapped"}</span></>,
      description: locale === "id" ? "Iklan dengan objektif Meta dan data Insights terhubung" : "Ads with a mapped Meta objective and linked Insights",
      icon: "mapping",
    },
  ];

  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`} aria-labelledby="delivery-diagnostics-title">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 id="delivery-diagnostics-title" className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-lg">
            {locale === "id" ? "Status Pengiriman & Kesehatan Akun" : "Delivery Status & Account Health"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            {locale === "id" ? "Pemantauan keaktifan kampanye, penayangan materi iklan, dan kelengkapan atribusi data" : "Monitor campaign activity, ad delivery, and data attribution coverage"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${campaignCounts.active > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${campaignCounts.active > 0 ? "bg-emerald-500" : "bg-amber-500"}`} />
            {campaignCounts.active > 0
              ? `${formatNumber(campaignCounts.active)} ${locale === "id" ? "Kampanye Aktif Menayangkan" : "Active Campaigns Delivering"}`
              : locale === "id" ? "Semua Kampanye Nonaktif / Dijeda" : "All Campaigns Inactive / Paused"}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            aria-expanded={isExpanded}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isExpanded ? (locale === "id" ? "Tutup detail" : "Hide details") : (locale === "id" ? "Lihat detail" : "View details")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 sm:grid-cols-3 sm:p-5">
        {metrics.map((metric) => (
          <article key={metric.title} className="min-w-0 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">{metric.title}</p>
            <div className="mt-2 flex min-h-7 flex-wrap items-center gap-x-1 font-sans text-lg font-semibold tabular-nums tracking-tight text-slate-900 dark:text-zinc-100">
              {metric.value}
              {metric.icon === "mapping" && isFullyClassified && (
                <span className="ml-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">100% Valid</span>
              )}
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-slate-500 dark:text-zinc-400">{metric.description}</p>
          </article>
        ))}
      </div>

      {isExpanded && (
        <div className="grid gap-5 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 dark:border-zinc-800 sm:px-6">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <h3 className="font-semibold text-slate-800 dark:text-zinc-200">{locale === "id" ? "Status kampanye" : "Campaign status"}</h3>
              <span className="text-slate-500 dark:text-zinc-400">{formatNumber(campaignClassified)} {locale === "id" ? "dari" : "of"} {formatNumber(campaignCounts.total)}</span>
            </div>
            <dl className="space-y-1.5">
              {campaignRows.map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs">
                  <dt className="text-slate-600 dark:text-zinc-400">{label}</dt>
                  <dd className="font-sans font-semibold tabular-nums text-slate-900 dark:text-zinc-100">{formatNumber(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <h3 className="font-semibold text-slate-800 dark:text-zinc-200">{locale === "id" ? "Status penayangan iklan" : "Ad delivery status"}</h3>
              <span className="text-slate-500 dark:text-zinc-400">{formatNumber(deliveryClassified)} {locale === "id" ? "dari" : "of"} {formatNumber(adCounts.total)}</span>
            </div>
            <dl className="space-y-1.5">
              {deliveryRows.map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs">
                  <dt className="text-slate-600 dark:text-zinc-400">{label}</dt>
                  <dd className="font-sans font-semibold tabular-nums text-slate-900 dark:text-zinc-100">{formatNumber(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
