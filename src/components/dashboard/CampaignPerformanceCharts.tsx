"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface CampaignComparisonItem {
  id: string;
  name: string;
  status: string;
  spend: number;
  results: number;
  impressions: number;
  linkClicks: number;
  linkCtr: number | null;
  linkCpc: number | null;
}

export interface DailyTrendItem {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  results: number;
}

interface CampaignPerformanceChartsProps {
  campaigns: CampaignComparisonItem[];
  dailyTrend?: DailyTrendItem[];
  campaignStatusDistribution: {
    active: number;
    paused: number;
    total: number;
  };
  adDeliveryDistribution: {
    active: number;
    campaignPaused: number;
    adPaused: number;
    total: number;
  };
  funnelMetrics: {
    impressions: number;
    allClicks: number;
    linkClicks: number;
    results: number;
  };
}

export function CampaignPerformanceCharts({
  campaigns,
  dailyTrend = [],
  campaignStatusDistribution,
  adDeliveryDistribution,
  funnelMetrics,
}: CampaignPerformanceChartsProps) {
  const { formatCurrency, formatNumber, locale } = useI18n();
  const [viewMode, setViewMode] = React.useState<"campaigns" | "timeline">(
    dailyTrend.length > 1 ? "timeline" : "campaigns"
  );

  // Find max spend for bar normalization
  const maxSpend = Math.max(...campaigns.map((c) => c.spend), 1);
  const activeCampaigns = campaigns.filter((c) => c.spend > 0 || c.status === "ACTIVE");
  const displayCampaigns = activeCampaigns.length > 0 ? activeCampaigns.slice(0, 5) : campaigns.slice(0, 5);

  // Daily trend calculations
  const maxDailySpend = Math.max(...dailyTrend.map((d) => d.spend), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Campaign Comparison (Spend & Link Clicks) */}
      <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-4.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {viewMode === "campaigns"
                    ? (locale === "id" ? "Perbandingan Performa Campaign" : "Campaign Performance Comparison")
                    : (locale === "id" ? "Tren Metrik Harian (Meta Insights)" : "Daily Metrics Trend (Meta Insights)")}
                </h3>
                {dailyTrend.length > 1 && (
                  <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setViewMode("timeline")}
                      className={`px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
                        viewMode === "timeline"
                          ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      {locale === "id" ? "Tren Harian" : "Daily Trend"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("campaigns")}
                      className={`px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
                        viewMode === "campaigns"
                          ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      {locale === "id" ? "Per Campaign" : "By Campaign"}
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {viewMode === "campaigns"
                  ? (locale === "id" ? "Alokasi belanja iklan (Spend) dan perolehan klik tautan (Link Clicks) per campaign." : "Ad spend allocation and link clicks per campaign.")
                  : (locale === "id" ? "Dinamika belanja iklan riil dan perolehan konversi harian dari Meta." : "Real ad spend dynamics and daily conversion delivery from Meta.")}
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              Meta Insights
            </span>
          </div>

          {viewMode === "timeline" && dailyTrend.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1.5 scrollbar-thin">
                {dailyTrend.map((d) => {
                  const spendPercent = Math.min(Math.round((d.spend / maxDailySpend) * 100), 100);
                  const formattedDate = new Date(`${d.date}T00:00:00`).toLocaleDateString(
                    locale === "en" ? "en-US" : "id-ID",
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    }
                  );
                  return (
                    <div key={d.date} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                          {formattedDate} ({d.date})
                        </span>
                        <div className="text-right shrink-0 font-mono text-[11px] space-x-2">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {formatCurrency(d.spend)}
                          </span>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            • {formatNumber(d.linkClicks)} {locale === "en" ? "link clicks" : "klik tautan"}
                          </span>
                          {d.results > 0 && (
                            <span className="inline-flex items-center rounded bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              {d.results} CTWA
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 flex">
                        <div
                          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500"
                          style={{ width: `${Math.max(spendPercent, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3.5">
              {displayCampaigns.map((cmp) => {
                const spendPercent = Math.min(Math.round((cmp.spend / maxSpend) * 100), 100);
                return (
                  <div key={cmp.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                            cmp.status === "ACTIVE" ? "bg-emerald-500" : "bg-zinc-400"
                          }`}
                          title={cmp.status === "ACTIVE" ? (locale === "en" ? "Active Campaign" : "Campaign Aktif") : (locale === "en" ? "Paused Campaign" : "Campaign Dijeda")}
                        />
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate text-[11px]">
                          {cmp.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono text-[11px] space-x-2">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(cmp.spend)}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">
                          ({formatNumber(cmp.linkClicks)} {locale === "en" ? "link clicks" : "klik tautan"})
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 flex">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cmp.status === "ACTIVE" ? "bg-indigo-600 dark:bg-indigo-500" : "bg-zinc-400 dark:bg-zinc-600"
                        }`}
                        style={{ width: `${Math.max(spendPercent, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                      <span>
                        CTR: {cmp.linkCtr !== null ? `${cmp.linkCtr}%` : "—"}
                      </span>
                      <span>
                        CPC: {cmp.linkCpc !== null ? formatCurrency(cmp.linkCpc) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
          <span>{locale === "en" ? "*Data weighted from real Meta Marketing API metrics" : "*Data dihitung berbobot dari metrik riil Meta Marketing API"}</span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> {locale === "en" ? "Active" : "Aktif"}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-zinc-400 inline-block" /> {locale === "en" ? "Paused" : "Dijeda"}
            </span>
          </span>
        </div>
      </div>

      {/* 2. Delivery & Entity Distribution Breakdown */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between">
        <div>
          <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {locale === "en" ? "Delivery Breakdown" : "Distribusi Penayangan (Delivery)"}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {locale === "en" ? "Campaign status accuracy vs real ad delivery status." : "Akurasi status campaign vs status penayangan riil iklan."}
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {/* Campaign Level Breakdown */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {locale === "en" ? "Campaign Status" : "Status Campaign"} ({campaignStatusDistribution.total})
                </span>
                <span className="text-zinc-500 font-mono text-[11px]">
                  {campaignStatusDistribution.active} {locale === "en" ? "Active" : "Aktif"} • {campaignStatusDistribution.paused} {locale === "en" ? "Paused" : "Dijeda"}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{
                    width: `${
                      campaignStatusDistribution.total > 0
                        ? (campaignStatusDistribution.active / campaignStatusDistribution.total) * 100
                        : 0
                    }%`,
                  }}
                  title={locale === "en" ? "Active Campaign" : "Campaign Aktif"}
                />
                <div
                  className="bg-zinc-300 dark:bg-zinc-700 h-full"
                  style={{
                    width: `${
                      campaignStatusDistribution.total > 0
                        ? (campaignStatusDistribution.paused / campaignStatusDistribution.total) * 100
                        : 0
                    }%`,
                  }}
                  title={locale === "en" ? "Paused Campaign" : "Campaign Dijeda"}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {campaignStatusDistribution.total > 0
                    ? Math.round((campaignStatusDistribution.active / campaignStatusDistribution.total) * 100)
                    : 0}
                  % {locale === "en" ? "Active" : "Aktif"}
                </span>
                <span className="text-zinc-500">
                  {campaignStatusDistribution.total > 0
                    ? Math.round((campaignStatusDistribution.paused / campaignStatusDistribution.total) * 100)
                    : 0}
                  % {locale === "en" ? "Paused" : "Dijeda"}
                </span>
              </div>
            </div>

            {/* Ad Delivery Breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {locale === "en" ? "Ad Delivery Status" : "Status Delivery Iklan"} ({adDeliveryDistribution.total})
                </span>
                <span className="text-zinc-500 font-mono text-[11px]">
                  {adDeliveryDistribution.active} {locale === "en" ? "Delivering" : "Menayangkan"}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{
                    width: `${
                      adDeliveryDistribution.total > 0
                        ? (adDeliveryDistribution.active / adDeliveryDistribution.total) * 100
                        : 0
                    }%`,
                  }}
                  title={locale === "en" ? "Delivering" : "Aktif Menayangkan"}
                />
                <div
                  className="bg-amber-400 dark:bg-amber-600 h-full"
                  style={{
                    width: `${
                      adDeliveryDistribution.total > 0
                        ? (adDeliveryDistribution.campaignPaused / adDeliveryDistribution.total) * 100
                        : 0
                    }%`,
                  }}
                  title={locale === "en" ? "Campaign Paused" : "Campaign Dijeda"}
                />
              </div>
              <div className="space-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {locale === "en" ? "Active Delivering:" : "Aktif Menayangkan:"}
                  </span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {adDeliveryDistribution.active} {locale === "en" ? "ads" : "iklan"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {locale === "en" ? "Campaign Paused (Not Delivering):" : "Campaign Dijeda (Tidak Tayang):"}
                  </span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {adDeliveryDistribution.campaignPaused} {locale === "en" ? "ads" : "iklan"}
                  </span>
                </div>
              </div>
            </div>

            {/* CTWA Traffic Funnel Snapshot */}
            <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 text-[11px] space-y-1">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 block text-[10px] uppercase tracking-wider">
                {locale === "en" ? "Meta CTWA Conversion Funnel" : "Alur Konversi CTWA Meta"}
              </span>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>{locale === "en" ? "Impressions:" : "Tayangan:"}</span>
                <span className="font-mono font-medium">{formatNumber(funnelMetrics.impressions)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>{locale === "en" ? "Link Clicks:" : "Klik Tautan:"}</span>
                <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                  {formatNumber(funnelMetrics.linkClicks)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>{locale === "en" ? "Meta Message Results:" : "Hasil Pesan Meta:"}</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {funnelMetrics.results} {locale === "en" ? "conversations" : "percakapan"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[10px] text-zinc-400 italic">
          {locale === "en"
            ? "*Ads in paused campaigns will not deliver new impressions on Meta."
            : "*Iklan dalam campaign yang dijeda tidak akan menayangkan impresi baru di Meta."}
        </p>
      </div>
    </div>
  );
}
