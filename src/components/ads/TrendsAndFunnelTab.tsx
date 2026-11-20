"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { formatDisplayCurrency } from "@/lib/format/display-currency";
import { localizeResultLabel } from "@/lib/ads/result-metric";
import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";
import type { DailyTrendPoint } from "@/components/dashboard/PerformanceTrendChart";
import type { RealAdRow } from "@/app/(dashboard)/ads/page";

export interface TrendsAndFunnelTabProps {
  dailyTrend: DailyTrendPoint[];
  campaigns: CampaignDetailData[];
  ads: RealAdRow[];
  accountMetrics: {
    spend: number;
    impressions: number;
    allClicks: number;
    linkClicks: number;
    results: number;
    allCpc: number | null;
    linkCpc: number | null;
    cpm: number | null;
    costPerResult: number | null;
  };
  currency?: string;
  resultLabel?: string;
}

type EntityLevel = "campaign" | "adset" | "ad";
type ChartTabMode = "spend_results" | "clicks_ctr" | "impressions_clicks" | "efficiency_cpr";
type SortKey = "spend" | "results" | "linkCtr" | "cpr";

interface DailyPoint {
  date: string;
  spend: number;
  impressions: number;
  allClicks: number;
  linkClicks: number;
  results: number;
}

interface CleanEntityRow {
  id: string;
  name: string;
  subLabel: string;
  level: EntityLevel;
  campaignId: string;
  adsetId?: string;
  childCount?: number;
  spend: number;
  impressions: number;
  allClicks: number;
  linkClicks: number;
  results: number;
  cpm: number | null;
  allCtr: number;
  linkCtr: number;
  linkCpc: number | null;
  intentRatio: number;
  cvr: number;
  cpr: number | null;
  spendShare: number;
  resultShare: number;
}

/**
 * Computes a human-friendly rounded upper bound (e.g. 40K, 80K, 120K or 10, 20, 30)
 * so Y-axis grid labels are always clean and proportional.
 */
function getNiceMax(val: number, steps = 4): number {
  if (!Number.isFinite(val) || val <= 0) return steps * 10;
  const rawStep = val / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;

  let niceStep = 1;
  if (norm <= 1) niceStep = 1;
  else if (norm <= 1.5) niceStep = 1.5;
  else if (norm <= 2) niceStep = 2;
  else if (norm <= 2.5) niceStep = 2.5;
  else if (norm <= 3) niceStep = 3;
  else if (norm <= 4) niceStep = 4;
  else if (norm <= 5) niceStep = 5;
  else if (norm <= 7.5) niceStep = 7.5;
  else niceStep = 10;

  return niceStep * mag * steps;
}

/**
 * Fritsch-Carlson Monotone Cubic Hermite Spline (d3.curveMonotoneX equivalent).
 * Guarantees a silky-smooth curve that passes through every point and NEVER
 * overshoots below zero (baseline) or above local peaks.
 */
function getMonotoneCubicPath(points: Array<{ x: number; y: number }>): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (n === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const deltaX = points[i + 1].x - points[i].x;
    const deltaY = points[i + 1].y - points[i].y;
    dx.push(deltaX);
    dy.push(deltaY);
    m.push(deltaX !== 0 ? deltaY / deltaX : 0);
  }

  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = m[0];
  tangents[n - 1] = m[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (m[i - 1] + m[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / m[i];
      const beta = tangents[i + 1] / m[i];
      const hypot = Math.hypot(alpha, beta);
      if (hypot > 3) {
        const tau = 3 / hypot;
        tangents[i] = tau * alpha * m[i];
        tangents[i + 1] = tau * beta * m[i];
      }
    }
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const segDx = dx[i] / 3;
    const cp1x = p0.x + segDx;
    const cp1y = p0.y + tangents[i] * segDx;
    const cp2x = p1.x - segDx;
    const cp2y = p1.y - tangents[i + 1] * segDx;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }

  return path;
}

function getMonotoneAreaPath(points: Array<{ x: number; y: number }>, bottomY: number): string {
  if (points.length < 2) return "";
  const curve = getMonotoneCubicPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

const DICT = {
  id: {
    campaignLabel: "Kampanye",
    adsetLabel: "Ad Set",
    adLabel: "Iklan (Ad)",
    allCampaigns: "Semua Kampanye",
    allAdSets: "Semua Ad Set",
    allAds: "Semua Iklan",
    resetFilter: "Reset ke Seluruh Akun",
    activeView: "Cakupan Analisis:",
    allAccount: "Seluruh Akun Iklan",
    trendTitle: "Tren Performa Harian",
    trendSub: "Pilih metrik di bawah dan arahkan kursor pada grafik untuk menginspeksi rincian harian.",
    tabSpendResults: "Belanja vs Hasil",
    tabClicksCtr: "Klik Tautan vs CTR",
    tabImpressionsClicks: "Tayangan vs Interaksi",
    tabEfficiencyCpr: "Efisiensi Biaya (CPR & CPC)",
    spend: "Total Belanja",
    impressions: "Tayangan",
    allClicks: "Semua Klik",
    linkClicks: "Klik Tautan",
    results: "Hasil Konversi",
    linkCtr: "CTR Tautan",
    linkCpc: "CPC Tautan",
    cpr: "Biaya / Hasil",
    noTrend: "Belum ada data harian pada periode ini.",
    funnelTitle: "Arsitektur Funnel Konversi (4 Tahap)",
    funnelSub: "Klik tahap mana pun untuk menginspeksi rasio konversi, biaya unit, dan efisiensi antar tahap.",
    stage1: "Tayangan (Impressions)",
    stage1Desc: "Jangkauan impresi iklan di layar audiens",
    stage2: "Semua Klik (Interaksi)",
    stage2Desc: "Klik konten, profil, geser foto, atau baca caption",
    stage3: "Klik Tautan (Menuju WA/Web)",
    stage3Desc: "Audiens yang menekan tombol CTA menuju WhatsApp / Web",
    stage4: "Hasil Konversi",
    stage4Desc: "Percakapan WhatsApp / prospek terealisasi",
    bridge1to2: "Rasio Interaksi (All CTR)",
    bridge2to3: "Rasio Niat Klik Tautan (Intent Ratio)",
    bridge3to4: "Rasio Konversi Pasca-Klik (CVR)",
    benchmarkTitle: "Tolok Ukur Efisiensi Funnel",
    hookMetricName: "Hook Kreatif (Link CTR)",
    intentMetricName: "Ketepatan CTA (Intent Ratio)",
    cvrMetricName: "Konversi Pasca-Klik (CVR)",
    targetLabel: "Target",
    statusOptimal: "Optimal",
    statusWarn: "Perlu Optimasi",
    statusLow: "Di Bawah Target",
    diagnosisHealthy: "Distribusi Funnel Optimal — Daya tarik materi iklan (CTR) dan konversi pasca-klik (CVR) berada di atas ambang target.",
    diagnosisLowCtr: "CTR Tautan Di Bawah Target (< 1,0%) — Volume tayangan tinggi namun rasio klik tautan masih rendah. Evaluasi hook visual dan headline.",
    diagnosisLowCvr: "Drop-off Pasca-Klik — Volume klik tautan memadai, namun rasio konversi menjadi hasil masih di bawah 8%. Evaluasi halaman tujuan atau alur sapaan WhatsApp.",
    DiagnosisNoData: "Belum ada tayangan iklan pada cakupan ini.",
    breakdownTitle: "Komparasi Performa per Level Meta Ads",
    breakdownSub: "Klik baris untuk memfokuskan grafik di atas, atau gunakan tombol rincian untuk menelusuri Ad Set dan Iklan.",
    tabCampaign: "Kampanye",
    tabAdSet: "Ad Set",
    tabAd: "Iklan",
    searchPlaceholder: "Cari nama kampanye, ad set, atau iklan...",
    sortBySpend: "Urut: Belanja Tertinggi",
    sortByResults: "Urut: Hasil Terbanyak",
    sortByCtr: "Urut: CTR Tertinggi",
    sortByCpr: "Urut: Biaya/Hasil Terendah",
    budgetShareLabel: "Porsi Spend",
    resultShareLabel: "Porsi Hasil",
    drillToAdSets: "Lihat Ad Set →",
    drillToAds: "Lihat Iklan →",
    focusedBadge: "Fokus Aktif",
    clickToFocus: "Klik untuk Fokus",
    funnelStripTitle: "Rincian Funnel:",
    prev: "Sebelumnya",
    next: "Berikutnya",
  },
  en: {
    campaignLabel: "Campaign",
    adsetLabel: "Ad Set",
    adLabel: "Ad",
    allCampaigns: "All Campaigns",
    allAdSets: "All Ad Sets",
    allAds: "All Ads",
    resetFilter: "Reset to Full Account",
    activeView: "Analysis Scope:",
    allAccount: "Entire Ad Account",
    trendTitle: "Daily Performance Trend",
    trendSub: "Select a metric tab below and hover over the chart to inspect daily performance.",
    tabSpendResults: "Spend vs Results",
    tabClicksCtr: "Link Clicks vs CTR",
    tabImpressionsClicks: "Impressions vs Clicks",
    tabEfficiencyCpr: "Cost Efficiency (CPR & CPC)",
    spend: "Total Spend",
    impressions: "Impressions",
    allClicks: "All Clicks",
    linkClicks: "Link Clicks",
    results: "Conversion Results",
    linkCtr: "Link CTR",
    linkCpc: "Link CPC",
    cpr: "Cost / Result",
    noTrend: "No daily data available for this period.",
    funnelTitle: "Conversion Funnel Architecture (4 Stages)",
    funnelSub: "Click any stage to inspect conversion bridges, unit costs, and stage-to-stage efficiency.",
    stage1: "Impressions",
    stage1Desc: "Total ad views across Feeds, Stories & Reels",
    stage2: "All Clicks (Interactions)",
    stage2Desc: "Content taps, swipes, profile views, or caption reads",
    stage3: "Link Clicks (To WA/Web)",
    stage3Desc: "High-intent clicks on the CTA button to WhatsApp / Web",
    stage4: "Conversion Results",
    stage4Desc: "Completed WhatsApp chats or leads",
    bridge1to2: "Engagement Rate (All CTR)",
    bridge2to3: "CTA Click Intent (Link / All Clicks)",
    bridge3to4: "Post-Click Conversion (CVR)",
    benchmarkTitle: "Funnel Efficiency Benchmarks",
    hookMetricName: "Creative Hook (Link CTR)",
    intentMetricName: "CTA Intent Ratio",
    cvrMetricName: "Post-Click Conversion (CVR)",
    targetLabel: "Target",
    statusOptimal: "Optimal",
    statusWarn: "Needs Attention",
    statusLow: "Below Target",
    diagnosisHealthy: "Optimal Funnel Distribution — Both Creative Hook (Link CTR) and Post-Click Conversion (CVR) are performing above benchmark.",
    diagnosisLowCtr: "Link CTR Below Target (< 1.0%) — High impressions, but link click rate is below benchmark. Evaluate opening visual hook and headline.",
    diagnosisLowCvr: "Post-Click Drop-off — Strong link clicks, but conversion to results is below 8%. Evaluate destination page or WhatsApp greeting flow.",
    DiagnosisNoData: "No impressions recorded for this scope yet.",
    breakdownTitle: "Performance Comparison by Meta Ads Level",
    breakdownSub: "Click any row to focus the charts above, or drill down into its child Ad Sets and Ads.",
    tabCampaign: "Campaigns",
    tabAdSet: "Ad Sets",
    tabAd: "Ads",
    searchPlaceholder: "Search campaign, ad set, or ad name...",
    sortBySpend: "Sort: Highest Spend",
    sortByResults: "Sort: Most Results",
    sortByCtr: "Sort: Highest CTR",
    sortByCpr: "Sort: Lowest Cost/Result",
    budgetShareLabel: "Spend Share",
    resultShareLabel: "Results Share",
    drillToAdSets: "View Ad Sets →",
    drillToAds: "View Ads →",
    focusedBadge: "Active Focus",
    clickToFocus: "Click to Focus",
    funnelStripTitle: "Funnel Summary:",
    prev: "Previous",
    next: "Next",
  },
} as const;

export function TrendsAndFunnelTab({
  dailyTrend = [],
  campaigns = [],
  ads = [],
  accountMetrics,
  currency = "IDR",
  resultLabel,
}: TrendsAndFunnelTabProps) {
  const { locale, formatNumber } = useI18n();
  const uiLocale: "id" | "en" = locale === "en" ? "en" : "id";
  const t = DICT[uiLocale];

  // 1. Simple 3-level filter state: Campaign -> Ad Set -> Ad
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const [selectedAdSetId, setSelectedAdSetId] = useState<string>("all");
  const [selectedAdId, setSelectedAdId] = useState<string>("all");

  // 2. Enterprise Chart State
  const [chartMode, setChartMode] = useState<ChartTabMode>("spend_results");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 3. Interactive Funnel Stage Selection
  const [activeFunnelStep, setActiveFunnelStep] = useState<number>(3);

  // 4. Breakdown Explorer State
  const [activeTabLevel, setActiveTabLevel] = useState<EntityLevel>("campaign");
  const [sortBy, setSortBy] = useState<SortKey>("spend");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const PER_PAGE = 6;

  const formatMoney = useCallback(
    (val: number | null | undefined) => formatDisplayCurrency(val, currency, uiLocale),
    [currency, uiLocale]
  );

  const formatPct = useCallback(
    (val: number) => {
      const safe = Number.isFinite(val) ? val : 0;
      const str = safe.toFixed(2);
      return uiLocale === "id" ? `${str.replace(".", ",")}%` : `${str}%`;
    },
    [uiLocale]
  );

  const formatCompactCurrency = useCallback(
    (amount: number) => {
      if (amount === 0) return "Rp0";
      if (amount >= 1_000_000) {
        const v = amount / 1_000_000;
        const s = v % 1 === 0 ? String(v) : uiLocale === "id" ? v.toFixed(1).replace(".", ",") : v.toFixed(1);
        return `Rp${s}${uiLocale === "id" ? "jt" : "M"}`;
      }
      if (amount >= 1_000) {
        const v = amount / 1_000;
        return `Rp${v.toFixed(0)}${uiLocale === "id" ? "rb" : "K"}`;
      }
      return `Rp${Math.round(amount)}`;
    },
    [uiLocale]
  );

  const formatCompactCount = useCallback(
    (val: number) => {
      if (val === 0) return "0";
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 10_000) return `${(val / 1_000).toFixed(0)}K`;
      if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
      return formatNumber(Math.round(val));
    },
    [formatNumber]
  );

  const formatDateShort = useCallback(
    (dateStr: string) => {
      try {
        const d = new Date(`${dateStr}T00:00:00Z`);
        const day = d.getUTCDate();
        const month = d.toLocaleDateString(uiLocale === "en" ? "en-US" : "id-ID", {
          month: "short",
          timeZone: "UTC",
        });
        return `${day} ${month}`;
      } catch {
        return dateStr.slice(5);
      }
    },
    [uiLocale]
  );

  const formatDateFull = useCallback(
    (dateStr: string) => {
      try {
        const d = new Date(`${dateStr}T00:00:00Z`);
        return d.toLocaleDateString(uiLocale === "en" ? "en-US" : "id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
      } catch {
        return dateStr;
      }
    },
    [uiLocale]
  );

  const unitLabel = localizeResultLabel(resultLabel, uiLocale);

  // Build Campaign, Ad Set, and Ad lists with full funnel & share metrics
  const hierarchy = useMemo(() => {
    const activeAds = ads.filter((a) => (a.spend || 0) > 0 || (a.impressions || 0) > 0);
    const sourceAds = activeAds.length > 0 ? activeAds : ads;

    const totalAccountSpend = Math.max(
      1,
      accountMetrics.spend || sourceAds.reduce((s, a) => s + (a.spend || 0), 0) || 1
    );
    const totalAccountResults = Math.max(
      1,
      accountMetrics.results ||
        sourceAds.reduce((s, a) => s + (a.resultMetricValue ?? a.results ?? 0), 0) ||
        1
    );

    const adRows: CleanEntityRow[] = sourceAds
      .map((a) => {
        const spend = a.spend || 0;
        const impressions = a.impressions || 0;
        const allClicks = a.allClicks || 0;
        const linkClicks = a.linkClicks || 0;
        const results = a.resultMetricValue ?? a.results ?? 0;
        const adsetKey = a.adsetId || `adset:${a.campaignId}:${a.adsetName || "utama"}`;
        const adsetTitle =
          a.adsetName && a.adsetName !== "Ad Set Meta" ? a.adsetName : `${a.campaignName} (Ad Set)`;

        return {
          id: a.id,
          name: a.adName,
          subLabel: `${a.campaignName} ➔ ${adsetTitle}`,
          level: "ad" as const,
          campaignId: a.campaignId,
          adsetId: adsetKey,
          spend,
          impressions,
          allClicks,
          linkClicks,
          results,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
          allCtr: impressions > 0 ? (allClicks / impressions) * 100 : 0,
          linkCtr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
          linkCpc: linkClicks > 0 ? spend / linkClicks : null,
          intentRatio: allClicks > 0 ? (linkClicks / allClicks) * 100 : 0,
          cvr: linkClicks > 0 ? (results / linkClicks) * 100 : 0,
          cpr: results > 0 ? spend / results : null,
          spendShare: (spend / totalAccountSpend) * 100,
          resultShare: (results / totalAccountResults) * 100,
        };
      })
      .sort((a, b) => b.spend - a.spend);

    const adSetMap = new Map<string, CleanEntityRow>();
    adRows.forEach((ad) => {
      const key = ad.adsetId || `adset:${ad.campaignId}`;
      const rawAd = sourceAds.find((r) => r.id === ad.id);
      const adsetTitle =
        rawAd?.adsetName && rawAd.adsetName !== "Ad Set Meta"
          ? rawAd.adsetName
          : `${rawAd?.campaignName || "Kampanye"} — Ad Set`;

      const existing = adSetMap.get(key);
      if (existing) {
        existing.spend += ad.spend;
        existing.impressions += ad.impressions;
        existing.allClicks += ad.allClicks;
        existing.linkClicks += ad.linkClicks;
        existing.results += ad.results;
        existing.childCount = (existing.childCount || 1) + 1;
      } else {
        adSetMap.set(key, {
          id: key,
          name: adsetTitle,
          subLabel: rawAd?.campaignName || "",
          level: "adset",
          campaignId: ad.campaignId,
          adsetId: key,
          childCount: 1,
          spend: ad.spend,
          impressions: ad.impressions,
          allClicks: ad.allClicks,
          linkClicks: ad.linkClicks,
          results: ad.results,
          cpm: null,
          allCtr: 0,
          linkCtr: 0,
          linkCpc: null,
          intentRatio: 0,
          cvr: 0,
          cpr: null,
          spendShare: 0,
          resultShare: 0,
        });
      }
    });

    const adSetRows = Array.from(adSetMap.values())
      .map((row) => ({
        ...row,
        cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null,
        allCtr: row.impressions > 0 ? (row.allClicks / row.impressions) * 100 : 0,
        linkCtr: row.impressions > 0 ? (row.linkClicks / row.impressions) * 100 : 0,
        linkCpc: row.linkClicks > 0 ? row.spend / row.linkClicks : null,
        intentRatio: row.allClicks > 0 ? (row.linkClicks / row.allClicks) * 100 : 0,
        cvr: row.linkClicks > 0 ? (row.results / row.linkClicks) * 100 : 0,
        cpr: row.results > 0 ? row.spend / row.results : null,
        spendShare: (row.spend / totalAccountSpend) * 100,
        resultShare: (row.results / totalAccountResults) * 100,
      }))
      .sort((a, b) => b.spend - a.spend);

    const campaignRows: CleanEntityRow[] = campaigns
      .filter((c) => (c.spend || 0) > 0 || (c.impressions || 0) > 0)
      .map((c) => {
        const spend = c.spend || 0;
        const impressions = c.impressions || 0;
        const allClicks = c.allClicks || 0;
        const linkClicks = c.linkClicks || 0;
        const results = c.results || 0;
        const campAdSetsCount = adSetRows.filter((as) => as.campaignId === c.id).length;

        return {
          id: c.id,
          name: c.name,
          subLabel: `${Math.max(1, campAdSetsCount)} Ad Set · ${c.totalAdsCount || 0} Ads`,
          level: "campaign" as const,
          campaignId: c.id,
          childCount: Math.max(1, campAdSetsCount),
          spend,
          impressions,
          allClicks,
          linkClicks,
          results,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
          allCtr: impressions > 0 ? (allClicks / impressions) * 100 : 0,
          linkCtr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
          linkCpc: linkClicks > 0 ? spend / linkClicks : null,
          intentRatio: allClicks > 0 ? (linkClicks / allClicks) * 100 : 0,
          cvr: linkClicks > 0 ? (results / linkClicks) * 100 : 0,
          cpr: results > 0 ? spend / results : null,
          spendShare: (spend / totalAccountSpend) * 100,
          resultShare: (results / totalAccountResults) * 100,
        };
      })
      .sort((a, b) => b.spend - a.spend);

    return { campaigns: campaignRows, adSets: adSetRows, ads: adRows };
  }, [campaigns, ads, accountMetrics.spend, accountMetrics.results]);

  const filteredAdSetOptions = useMemo(() => {
    if (selectedCampaignId === "all") return hierarchy.adSets;
    return hierarchy.adSets.filter((as) => as.campaignId === selectedCampaignId);
  }, [hierarchy.adSets, selectedCampaignId]);

  const filteredAdOptions = useMemo(() => {
    let list = hierarchy.ads;
    if (selectedCampaignId !== "all") {
      list = list.filter((a) => a.campaignId === selectedCampaignId);
    }
    if (selectedAdSetId !== "all") {
      list = list.filter((a) => a.adsetId === selectedAdSetId);
    }
    return list;
  }, [hierarchy.ads, selectedCampaignId, selectedAdSetId]);

  // Active Scope (Metrics + Authentic Daily Series)
  const activeScope = useMemo(() => {
    let matchingRawAds = ads;
    let scopeName: string = t.allAccount;

    if (selectedAdId !== "all") {
      matchingRawAds = ads.filter((a) => a.id === selectedAdId);
      const found = hierarchy.ads.find((a) => a.id === selectedAdId);
      if (found) scopeName = found.name;
    } else if (selectedAdSetId !== "all") {
      matchingRawAds = ads.filter((a) => {
        const key = a.adsetId || `adset:${a.campaignId}:${a.adsetName || "utama"}`;
        return key === selectedAdSetId;
      });
      const found = hierarchy.adSets.find((as) => as.id === selectedAdSetId);
      if (found) scopeName = found.name;
    } else if (selectedCampaignId !== "all") {
      matchingRawAds = ads.filter((a) => a.campaignId === selectedCampaignId);
      const found = hierarchy.campaigns.find((c) => c.id === selectedCampaignId);
      if (found) scopeName = found.name;
    }

    const isFullAccount =
      selectedCampaignId === "all" && selectedAdSetId === "all" && selectedAdId === "all";

    let rawSeries: DailyPoint[] = [];
    const hasAdDaily = matchingRawAds.some((a) => (a.dailySeries?.length ?? 0) > 0);

    if (isFullAccount || !hasAdDaily) {
      rawSeries = dailyTrend.map((d) => ({
        date: d.date,
        spend: d.spend || 0,
        impressions: d.impressions || 0,
        allClicks: d.allClicks || 0,
        linkClicks: d.linkClicks || 0,
        results: d.results > 0 ? d.results : d.conversations ?? 0,
      }));
    } else {
      const dateMap = new Map<string, DailyPoint>();
      dailyTrend.forEach((d) => {
        dateMap.set(d.date, {
          date: d.date,
          spend: 0,
          impressions: 0,
          allClicks: 0,
          linkClicks: 0,
          results: 0,
        });
      });
      matchingRawAds.forEach((ad) => {
        (ad.dailySeries || []).forEach((pt) => {
          const cur = dateMap.get(pt.date) || {
            date: pt.date,
            spend: 0,
            impressions: 0,
            allClicks: 0,
            linkClicks: 0,
            results: 0,
          };
          cur.spend += pt.spend || 0;
          cur.impressions += pt.impressions || 0;
          cur.allClicks += pt.allClicks || 0;
          cur.linkClicks += pt.linkClicks || 0;
          cur.results += pt.results || 0;
          dateMap.set(pt.date, cur);
        });
      });
      rawSeries = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    let series = rawSeries;
    if (rawSeries.length > 14) {
      const firstActive = rawSeries.findIndex(
        (p) => p.spend > 0 || p.impressions > 0 || p.linkClicks > 0 || p.results > 0
      );
      let lastActive = -1;
      for (let i = rawSeries.length - 1; i >= 0; i--) {
        const p = rawSeries[i];
        if (p.spend > 0 || p.impressions > 0 || p.linkClicks > 0 || p.results > 0) {
          lastActive = i;
          break;
        }
      }
      if (firstActive !== -1 && lastActive !== -1 && lastActive >= firstActive) {
        const startIdx = Math.max(0, firstActive - 1);
        const endIdx = Math.min(rawSeries.length - 1, lastActive + 1);
        series = rawSeries.slice(startIdx, endIdx + 1);
      }
    }

    const spend = isFullAccount
      ? accountMetrics.spend || 0
      : matchingRawAds.reduce((s, a) => s + (a.spend || 0), 0);
    const impressions = isFullAccount
      ? accountMetrics.impressions || 0
      : matchingRawAds.reduce((s, a) => s + (a.impressions || 0), 0);
    const allClicks = isFullAccount
      ? accountMetrics.allClicks || 0
      : matchingRawAds.reduce((s, a) => s + (a.allClicks || 0), 0);
    const linkClicks = isFullAccount
      ? accountMetrics.linkClicks || 0
      : matchingRawAds.reduce((s, a) => s + (a.linkClicks || 0), 0);
    const results = isFullAccount
      ? accountMetrics.results || 0
      : matchingRawAds.reduce((s, a) => s + (a.resultMetricValue ?? a.results ?? 0), 0);

    const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
    const allCtr = impressions > 0 ? (allClicks / impressions) * 100 : 0;
    const allCpc = allClicks > 0 ? spend / allClicks : null;
    const linkCtr = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
    const linkCpc = linkClicks > 0 ? spend / linkClicks : null;
    const intentRatio = allClicks > 0 ? (linkClicks / allClicks) * 100 : 0;
    const cvr = linkClicks > 0 ? (results / linkClicks) * 100 : 0;
    const cpr = results > 0 ? spend / results : null;

    return {
      scopeName,
      isFiltered: !isFullAccount,
      spend,
      impressions,
      allClicks,
      linkClicks,
      results,
      cpm,
      allCtr,
      allCpc,
      linkCtr,
      linkCpc,
      intentRatio,
      cvr,
      cpr,
      series,
    };
  }, [
    selectedCampaignId,
    selectedAdSetId,
    selectedAdId,
    ads,
    hierarchy,
    dailyTrend,
    accountMetrics,
    t.allAccount,
  ]);

  // Chart Geometry & Projections (Proportional 920 x 300 Canvas)
  const svgW = 920;
  const svgH = 300;
  const pad = { left: 72, right: 64, top: 28, bottom: 42 };
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;
  const bottomY = pad.top + plotH;

  const series = activeScope.series;

  const chartData = useMemo(() => {
    const leftSeries = series.map((p) => {
      if (chartMode === "spend_results") return p.spend;
      if (chartMode === "clicks_ctr") return p.linkClicks;
      if (chartMode === "impressions_clicks") return p.impressions;
      return p.results > 0 ? p.spend / p.results : 0;
    });

    const rightSeries = series.map((p) => {
      if (chartMode === "spend_results") return p.results;
      if (chartMode === "clicks_ctr") return p.impressions > 0 ? (p.linkClicks / p.impressions) * 100 : 0;
      if (chartMode === "impressions_clicks") return p.allClicks;
      return p.linkClicks > 0 ? p.spend / p.linkClicks : 0;
    });

    const rawMaxLeft = Math.max(0, ...leftSeries);
    const rawMaxRight = Math.max(0, ...rightSeries);

    const maxLeft =
      chartMode === "spend_results" || chartMode === "efficiency_cpr"
        ? Math.max(getNiceMax(rawMaxLeft, 4), 100_000)
        : Math.max(getNiceMax(rawMaxLeft, 4), 20);

    const maxRight =
      chartMode === "clicks_ctr"
        ? Math.max(getNiceMax(rawMaxRight, 4), 4)
        : chartMode === "efficiency_cpr"
        ? Math.max(getNiceMax(rawMaxRight, 4), 10_000)
        : Math.max(getNiceMax(rawMaxRight, 4), 8);

    const palette =
      chartMode === "spend_results"
        ? {
            leftColor: "#2563eb",
            rightColor: "#059669",
            leftLabel: t.spend,
            rightLabel: unitLabel,
          }
        : chartMode === "clicks_ctr"
        ? {
            leftColor: "#7c3aed",
            rightColor: "#d97706",
            leftLabel: t.linkClicks,
            rightLabel: t.linkCtr,
          }
        : chartMode === "impressions_clicks"
        ? {
            leftColor: "#0284c7",
            rightColor: "#e11d48",
            leftLabel: t.impressions,
            rightLabel: t.allClicks,
          }
        : {
            leftColor: "#0d9488",
            rightColor: "#ea580c",
            leftLabel: t.cpr,
            rightLabel: t.linkCpc,
          };

    return { leftSeries, rightSeries, maxLeft, maxRight, palette };
  }, [series, chartMode, t, unitLabel]);

  const getX = useCallback(
    (index: number) => {
      if (series.length < 2) return pad.left + plotW / 2;
      return pad.left + (index / (series.length - 1)) * plotW;
    },
    [series.length, pad.left, plotW]
  );

  const getYLeft = useCallback(
    (val: number) => {
      return bottomY - (chartData.maxLeft > 0 ? (val / chartData.maxLeft) * plotH : 0);
    },
    [bottomY, chartData.maxLeft, plotH]
  );

  const getYRight = useCallback(
    (val: number) => {
      return bottomY - (chartData.maxRight > 0 ? (val / chartData.maxRight) * plotH : 0);
    },
    [bottomY, chartData.maxRight, plotH]
  );

  const leftCoords = useMemo(
    () => chartData.leftSeries.map((v, i) => ({ x: getX(i), y: getYLeft(v) })),
    [chartData.leftSeries, getX, getYLeft]
  );

  const rightCoords = useMemo(
    () => chartData.rightSeries.map((v, i) => ({ x: getX(i), y: getYRight(v) })),
    [chartData.rightSeries, getX, getYRight]
  );

  const leftLinePath = useMemo(() => getMonotoneCubicPath(leftCoords), [leftCoords]);
  const leftAreaPath = useMemo(() => getMonotoneAreaPath(leftCoords, bottomY), [leftCoords, bottomY]);
  const rightLinePath = useMemo(() => getMonotoneCubicPath(rightCoords), [rightCoords]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || series.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const svgX = ratio * svgW;

    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < series.length; i++) {
      const dist = Math.abs(svgX - getX(i));
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setHoveredIdx(closest);
  };

  const formatLeftAxisTick = (val: number) => {
    if (chartMode === "spend_results" || chartMode === "efficiency_cpr") {
      return formatCompactCurrency(val);
    }
    return formatCompactCount(val);
  };

  const formatRightAxisTick = (val: number) => {
    if (chartMode === "clicks_ctr") {
      return `${val.toFixed(1)}%`;
    }
    if (chartMode === "efficiency_cpr") {
      return formatCompactCurrency(val);
    }
    return formatCompactCount(val);
  };

  const formatLeftTooltipValue = (val: number) => {
    if (chartMode === "spend_results" || chartMode === "efficiency_cpr") {
      return formatMoney(val);
    }
    return formatNumber(Math.round(val));
  };

  const formatRightTooltipValue = (val: number) => {
    if (chartMode === "clicks_ctr") {
      return formatPct(val);
    }
    if (chartMode === "efficiency_cpr") {
      return val > 0 ? formatMoney(val) : "—";
    }
    return formatNumber(Math.round(val));
  };

  const safeHoveredIdx =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < series.length ? hoveredIdx : null;
  const activePoint = safeHoveredIdx !== null ? series[safeHoveredIdx] : null;
  const activeHoverX = safeHoveredIdx !== null ? getX(safeHoveredIdx) : 0;
  const activeLeftY = safeHoveredIdx !== null ? leftCoords[safeHoveredIdx].y : 0;
  const activeRightY = safeHoveredIdx !== null ? rightCoords[safeHoveredIdx].y : 0;
  const isTooltipRightSide = safeHoveredIdx !== null && safeHoveredIdx > series.length * 0.55;

  const dateRangeBadge = useMemo(() => {
    if (series.length === 0) return "";
    return `${formatDateShort(series[0].date)} – ${formatDateShort(series[series.length - 1].date)}`;
  }, [series, formatDateShort]);

  // Sorted & filtered breakdown rows
  const tableRows = useMemo(() => {
    let list: CleanEntityRow[] = [];
    if (activeTabLevel === "campaign") {
      list = [...hierarchy.campaigns];
    } else if (activeTabLevel === "adset") {
      list =
        selectedCampaignId !== "all"
          ? hierarchy.adSets.filter((as) => as.campaignId === selectedCampaignId)
          : [...hierarchy.adSets];
    } else {
      list = [...hierarchy.ads];
      if (selectedCampaignId !== "all") {
        list = list.filter((a) => a.campaignId === selectedCampaignId);
      }
      if (selectedAdSetId !== "all") {
        list = list.filter((a) => a.adsetId === selectedAdSetId);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.subLabel.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === "spend") return b.spend - a.spend;
      if (sortBy === "results") return b.results - a.results || b.linkClicks - a.linkClicks;
      if (sortBy === "linkCtr") return b.linkCtr - a.linkCtr;
      const cprA = a.cpr ?? Number.POSITIVE_INFINITY;
      const cprB = b.cpr ?? Number.POSITIVE_INFINITY;
      return cprA - cprB;
    });

    return list;
  }, [activeTabLevel, hierarchy, selectedCampaignId, selectedAdSetId, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedRows = tableRows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const maxRowSpend = Math.max(1, ...tableRows.map((r) => r.spend));
  const maxRowClicks = Math.max(1, ...tableRows.map((r) => r.linkClicks));
  const maxRowResults = Math.max(1, ...tableRows.map((r) => r.results));

  // Funnel stages data with restrained executive SaaS styling (Linear / Stripe / Northbeam standard)
  const funnelStages = useMemo(() => {
    return [
      {
        step: 1,
        label: t.stage1,
        desc: t.stage1Desc,
        value: activeScope.impressions,
        rateBadge: "100%",
        unitCostLabel: "CPM",
        unitCostVal: activeScope.cpm !== null ? formatMoney(activeScope.cpm) : "—",
        topWidthPct: 100,
        bottomWidthPct: 78,
        barClass: "bg-zinc-700 dark:bg-zinc-300",
        ringClass: "border-zinc-900 bg-zinc-50/80 dark:border-zinc-100 dark:bg-zinc-800/70",
        badgeClass: "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300",
        bridgeLabel: null as string | null,
        bridgeRate: null as number | null,
      },
      {
        step: 2,
        label: t.stage2,
        desc: t.stage2Desc,
        value: activeScope.allClicks,
        rateBadge: `CTR ${formatPct(activeScope.allCtr)}`,
        unitCostLabel: "CPC All",
        unitCostVal: activeScope.allCpc !== null ? formatMoney(activeScope.allCpc) : "—",
        topWidthPct: 74,
        bottomWidthPct: 58,
        barClass: "bg-zinc-700 dark:bg-zinc-300",
        ringClass: "border-zinc-900 bg-zinc-50/80 dark:border-zinc-100 dark:bg-zinc-800/70",
        badgeClass: "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300",
        bridgeLabel: t.bridge1to2,
        bridgeRate: activeScope.allCtr,
      },
      {
        step: 3,
        label: t.stage3,
        desc: t.stage3Desc,
        value: activeScope.linkClicks,
        rateBadge: `Link CTR ${formatPct(activeScope.linkCtr)}`,
        unitCostLabel: "Link CPC",
        unitCostVal: activeScope.linkCpc !== null ? formatMoney(activeScope.linkCpc) : "—",
        topWidthPct: 50,
        bottomWidthPct: 38,
        barClass: "bg-indigo-600 dark:bg-indigo-500",
        ringClass: "border-indigo-600/80 bg-indigo-50/30 dark:border-indigo-400/70 dark:bg-indigo-950/20",
        badgeClass: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-950/50 dark:text-indigo-300",
        bridgeLabel: t.bridge2to3,
        bridgeRate: activeScope.intentRatio,
      },
      {
        step: 4,
        label: `${t.stage4} (${unitLabel})`,
        desc: t.stage4Desc,
        value: activeScope.results,
        rateBadge: `CVR ${formatPct(activeScope.cvr)}`,
        unitCostLabel: "CPR",
        unitCostVal: activeScope.cpr !== null ? formatMoney(activeScope.cpr) : "—",
        topWidthPct: 28,
        bottomWidthPct: 24,
        barClass: "bg-emerald-600 dark:bg-emerald-500",
        ringClass: "border-emerald-600/80 bg-emerald-50/30 dark:border-emerald-400/70 dark:bg-emerald-950/20",
        badgeClass: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300",
        bridgeLabel: t.bridge3to4,
        bridgeRate: activeScope.cvr,
      },
    ];
  }, [activeScope, t, unitLabel, formatMoney, formatPct]);

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. FILTER HIERARKI 3-LEVEL META ADS (KAMPANYE -> AD SET -> IKLAN)
         ===================================================================== */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Kampanye */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              {t.campaignLabel} ({hierarchy.campaigns.length})
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCampaignId(val);
                setSelectedAdSetId("all");
                setSelectedAdId("all");
                if (val !== "all") setActiveTabLevel("adset");
                setPage(1);
              }}
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/80 px-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              <option value="all">{t.allCampaigns}</option>
              {hierarchy.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({formatMoney(c.spend)})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Ad Set */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              {t.adsetLabel} ({filteredAdSetOptions.length})
            </label>
            <select
              value={selectedAdSetId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAdSetId(val);
                setSelectedAdId("all");
                if (val !== "all") {
                  const found = hierarchy.adSets.find((as) => as.id === val);
                  if (found) setSelectedCampaignId(found.campaignId);
                  setActiveTabLevel("ad");
                }
                setPage(1);
              }}
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/80 px-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              <option value="all">{t.allAdSets}</option>
              {filteredAdSetOptions.map((as) => (
                <option key={as.id} value={as.id}>
                  {as.name} ({formatMoney(as.spend)})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Iklan (Ad) */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              {t.adLabel} ({filteredAdOptions.length})
            </label>
            <select
              value={selectedAdId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAdId(val);
                if (val !== "all") {
                  const found = hierarchy.ads.find((a) => a.id === val);
                  if (found) {
                    setSelectedCampaignId(found.campaignId);
                    if (found.adsetId) setSelectedAdSetId(found.adsetId);
                  }
                }
                setPage(1);
              }}
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/80 px-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              <option value="all">{t.allAds}</option>
              {filteredAdOptions.map((ad) => (
                <option key={ad.id} value={ad.id}>
                  {ad.name} ({formatMoney(ad.spend)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeScope.isFiltered && (
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400">{t.activeView}</span>
              <span className="rounded-lg bg-indigo-50 dark:bg-indigo-500/15 px-2.5 py-1 font-bold text-indigo-700 dark:text-indigo-300 max-w-md truncate">
                {activeScope.scopeName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCampaignId("all");
                setSelectedAdSetId("all");
                setSelectedAdId("all");
                setActiveTabLevel("campaign");
              }}
              className="text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
            >
              ✕ {t.resetFilter}
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. ENTERPRISE DAILY PERFORMANCE TREND STUDIO (STRIPE / VERCEL GRADE)
         ===================================================================== */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t.trendTitle}
              </h3>
              <span className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 truncate max-w-[240px]">
                {activeScope.scopeName}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {t.trendSub}
            </p>
          </div>

          {dateRangeBadge && (
            <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-800/60 px-3 py-1.5 text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-200">
              <svg className="h-3.5 w-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{dateRangeBadge}</span>
            </div>
          )}
        </div>

        {/* 4 Interactive KPI Metric Selector Tabs (Color-Synchronized Dual-Axis Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/70 dark:divide-zinc-800 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          {(
            [
              {
                id: "spend_results" as const,
                title: t.tabSpendResults,
                primaryLabel: t.spend,
                primaryVal: formatMoney(activeScope.spend),
                leftHex: "#2563eb",
                secondaryLabel: unitLabel,
                secondaryVal: formatNumber(activeScope.results),
                rightHex: "#059669",
                activeBg: "bg-blue-50/35 dark:bg-blue-950/20",
                badgeClass: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-300",
              },
              {
                id: "clicks_ctr" as const,
                title: t.tabClicksCtr,
                primaryLabel: t.linkClicks,
                primaryVal: formatNumber(activeScope.linkClicks),
                leftHex: "#7c3aed",
                secondaryLabel: t.linkCtr,
                secondaryVal: formatPct(activeScope.linkCtr),
                rightHex: "#d97706",
                activeBg: "bg-violet-50/35 dark:bg-violet-950/20",
                badgeClass: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:bg-violet-950/60 dark:text-violet-300",
              },
              {
                id: "impressions_clicks" as const,
                title: t.tabImpressionsClicks,
                primaryLabel: t.impressions,
                primaryVal: formatNumber(activeScope.impressions),
                leftHex: "#0284c7",
                secondaryLabel: t.allClicks,
                secondaryVal: formatNumber(activeScope.allClicks),
                rightHex: "#e11d48",
                activeBg: "bg-sky-50/35 dark:bg-sky-950/20",
                badgeClass: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-950/60 dark:text-sky-300",
              },
              {
                id: "efficiency_cpr" as const,
                title: t.tabEfficiencyCpr,
                primaryLabel: t.cpr,
                primaryVal: activeScope.cpr !== null ? formatMoney(activeScope.cpr) : "—",
                leftHex: "#0d9488",
                secondaryLabel: t.linkCpc,
                secondaryVal: activeScope.linkCpc !== null ? formatMoney(activeScope.linkCpc) : "—",
                rightHex: "#ea580c",
                activeBg: "bg-teal-50/35 dark:bg-teal-950/20",
                badgeClass: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/60 dark:text-teal-300",
              },
            ] as const
          ).map((tab) => {
            const isActive = chartMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartMode(tab.id)}
                style={{
                  borderTopColor: isActive ? tab.leftHex : "transparent",
                }}
                className={`group text-left px-5 py-4 transition-colors duration-150 cursor-pointer border-t-[3px] focus-visible:outline-none ${
                  isActive
                    ? `${tab.activeBg} shadow-2xs`
                    : "hover:bg-white/80 dark:hover:bg-zinc-800/40 opacity-80 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold truncate ${
                      isActive
                        ? "text-zinc-900 dark:text-zinc-50"
                        : "text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200"
                    }`}
                  >
                    {tab.title}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-opacity ${
                      isActive ? `${tab.badgeClass} opacity-100` : "opacity-0 group-hover:opacity-60 text-zinc-400"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tab.leftHex }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tab.rightHex }}
                    />
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
                  {/* Left Axis Metric */}
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-full">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-zinc-900"
                        style={{ backgroundColor: tab.leftHex }}
                      />
                      <span className="truncate">{tab.primaryLabel}</span>
                    </span>
                    <p
                      className="mt-0.5 text-sm sm:text-[15px] font-bold font-mono tabular-nums truncate"
                      style={{ color: isActive ? tab.leftHex : undefined }}
                    >
                      <span className={isActive ? "" : "text-zinc-900 dark:text-zinc-100"}>
                        {tab.primaryVal}
                      </span>
                    </p>
                  </div>

                  {/* Right Axis Metric */}
                  <div className="min-w-0 border-l border-zinc-200/70 dark:border-zinc-800 pl-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-full">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-zinc-900"
                        style={{ backgroundColor: tab.rightHex }}
                      />
                      <span className="truncate">{tab.secondaryLabel}</span>
                    </span>
                    <p
                      className="mt-0.5 text-sm sm:text-[15px] font-bold font-mono tabular-nums truncate"
                      style={{ color: tab.rightHex }}
                    >
                      {tab.secondaryVal}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Dual-Axis Legend Strip Above SVG Canvas */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 px-6 py-2.5 text-[11px]">
          <div className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: chartData.palette.leftColor }}
            />
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {chartData.palette.leftLabel}
            </span>
            <span className="text-zinc-400">(Sumbu Kiri · Garis Area)</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: chartData.palette.rightColor }}
            />
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {chartData.palette.rightLabel}
            </span>
            <span className="text-zinc-400">(Sumbu Kanan · Garis Pembanding)</span>
          </div>
        </div>

        {/* High-Precision Proportional SVG Canvas */}
        {series.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-500">{t.noTrend}</div>
        ) : (
          <div
            className="relative w-full px-2 pt-3 pb-2 sm:px-4"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="h-auto w-full cursor-crosshair select-none overflow-visible"
              onMouseMove={handleSvgMouseMove}
              onTouchMove={(e) => {
                if (e.touches.length > 0 && svgRef.current) {
                  const rect = svgRef.current.getBoundingClientRect();
                  const ratio = (e.touches[0].clientX - rect.left) / rect.width;
                  const svgX = ratio * svgW;
                  let closest = 0;
                  let minDist = Infinity;
                  for (let i = 0; i < series.length; i++) {
                    const dist = Math.abs(svgX - getX(i));
                    if (dist < minDist) {
                      minDist = dist;
                      closest = i;
                    }
                  }
                  setHoveredIdx(closest);
                }
              }}
            >
              <defs>
                <linearGradient id="proPrimaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartData.palette.leftColor} stopOpacity="0.24" />
                  <stop offset="68%" stopColor={chartData.palette.leftColor} stopOpacity="0.05" />
                  <stop offset="100%" stopColor={chartData.palette.leftColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0, 1, 2, 3, 4].map((step) => {
                const ratio = step / 4;
                const y = bottomY - ratio * plotH;
                const leftVal = ratio * chartData.maxLeft;
                const rightVal = ratio * chartData.maxRight;

                return (
                  <g key={`grid-${step}`}>
                    <line
                      x1={pad.left}
                      x2={svgW - pad.right}
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray={step === 0 ? undefined : "4 4"}
                      className={
                        step === 0
                          ? "text-zinc-300 dark:text-zinc-700"
                          : "text-zinc-200/70 dark:text-zinc-800/80"
                      }
                    />
                    <text
                      x={pad.left - 12}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-zinc-400 dark:fill-zinc-500 font-mono text-[10.5px] font-medium tabular-nums"
                    >
                      {formatLeftAxisTick(leftVal)}
                    </text>
                    <text
                      x={svgW - pad.right + 12}
                      y={y + 4}
                      textAnchor="start"
                      className="fill-zinc-400 dark:fill-zinc-500 font-mono text-[10.5px] font-medium tabular-nums"
                    >
                      {formatRightAxisTick(rightVal)}
                    </text>
                  </g>
                );
              })}

              {leftAreaPath && <path d={leftAreaPath} fill="url(#proPrimaryAreaGrad)" />}
              {leftLinePath && (
                <path
                  d={leftLinePath}
                  fill="none"
                  stroke={chartData.palette.leftColor}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {rightLinePath && (
                <path
                  d={rightLinePath}
                  fill="none"
                  stroke={chartData.palette.rightColor}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {series.length <= 35 &&
                leftCoords.map((pt, idx) => (
                  <g key={`nodes-${series[idx].date}`}>
                    {chartData.leftSeries[idx] > 0 && (
                      <circle cx={pt.x} cy={pt.y} r="2.5" fill={chartData.palette.leftColor} />
                    )}
                    {chartData.rightSeries[idx] > 0 && (
                      <circle
                        cx={rightCoords[idx].x}
                        cy={rightCoords[idx].y}
                        r="2.5"
                        fill={chartData.palette.rightColor}
                      />
                    )}
                  </g>
                ))}

              {series.map((pt, idx) => {
                const labelStep = Math.max(1, Math.ceil((series.length - 1) / 7));
                if (idx % labelStep !== 0 && idx !== series.length - 1) return null;
                const posX = getX(idx);
                return (
                  <text
                    key={`xlabel-${pt.date}`}
                    x={posX}
                    y={svgH - 12}
                    textAnchor="middle"
                    className={`font-mono text-[11px] transition-colors ${
                      safeHoveredIdx === idx
                        ? "fill-zinc-900 font-bold dark:fill-zinc-100"
                        : "fill-zinc-400 dark:fill-zinc-500"
                    }`}
                  >
                    {formatDateShort(pt.date)}
                  </text>
                );
              })}

              {safeHoveredIdx !== null && activePoint && (
                <g className="pointer-events-none">
                  <line
                    x1={activeHoverX}
                    x2={activeHoverX}
                    y1={pad.top}
                    y2={bottomY}
                    stroke="currentColor"
                    className="text-zinc-400 dark:text-zinc-500"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={activeHoverX}
                    cy={activeLeftY}
                    r="9"
                    fill={chartData.palette.leftColor}
                    fillOpacity="0.18"
                  />
                  <circle
                    cx={activeHoverX}
                    cy={activeLeftY}
                    r="5"
                    className="fill-white dark:fill-zinc-900"
                    stroke={chartData.palette.leftColor}
                    strokeWidth="2.5"
                  />
                  <circle
                    cx={activeHoverX}
                    cy={activeRightY}
                    r="9"
                    fill={chartData.palette.rightColor}
                    fillOpacity="0.18"
                  />
                  <circle
                    cx={activeHoverX}
                    cy={activeRightY}
                    r="5"
                    className="fill-white dark:fill-zinc-900"
                    stroke={chartData.palette.rightColor}
                    strokeWidth="2.5"
                  />
                </g>
              )}
            </svg>

            {safeHoveredIdx !== null && activePoint && (
              <div
                className="pointer-events-none absolute z-30 min-w-[230px] rounded-2xl border border-zinc-200/90 bg-white/95 p-3.5 text-zinc-900 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.16)] backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-100"
                style={{
                  top: "14px",
                  left: isTooltipRightSide
                    ? `calc(${((activeHoverX / svgW) * 100).toFixed(2)}% - 16px)`
                    : `calc(${((activeHoverX / svgW) * 100).toFixed(2)}% + 16px)`,
                  transform: isTooltipRightSide ? "translateX(-100%)" : "translateX(0)",
                }}
              >
                <div className="mb-2.5 flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">
                    {formatDateFull(activePoint.date)}
                  </p>
                  <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    CTR {formatPct(activePoint.impressions > 0 ? (activePoint.linkClicks / activePoint.impressions) * 100 : 0)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: chartData.palette.leftColor }}
                      />
                      <span>{chartData.palette.leftLabel}</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {formatLeftTooltipValue(chartData.leftSeries[safeHoveredIdx])}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: chartData.palette.rightColor }}
                      />
                      <span>{chartData.palette.rightLabel}</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {formatRightTooltipValue(chartData.rightSeries[safeHoveredIdx])}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-1.5 mt-1.5 dark:border-zinc-800 text-[11px]">
                    <span className="text-zinc-400">{t.spend} / {unitLabel}</span>
                    <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                      {formatMoney(activePoint.spend)} · {formatNumber(activePoint.results)} {unitLabel}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* =====================================================================
          3. NEXT-LEVEL INTERACTIVE FUNNEL INFOGRAPHIC (KIRI) & LEVEL EXPLORER (KANAN)
         ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* KIRI (5 KOLOM): EXECUTIVE CONVERSION FUNNEL ARCHITECTURE */}
        <div className="xl:col-span-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t.funnelTitle}
              </h3>
              <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[180px]">
                {activeScope.scopeName}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {t.funnelSub}
            </p>
          </div>

          {/* Interactive 4-Stage Executive Pipeline */}
          <div className="space-y-1.5">
            {funnelStages.map((st, idx) => {
              const isSelected = activeFunnelStep === st.step;
              return (
                <React.Fragment key={st.step}>
                  {/* Conversion Bridge Pill Between Stages */}
                  {idx > 0 && st.bridgeLabel && st.bridgeRate !== null && (
                    <div className="flex items-center justify-center py-0.5">
                      <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/70 px-2.5 py-0.5 text-[11px]">
                        <span className="text-zinc-400 font-mono">↓</span>
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                          {st.bridgeLabel}:
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatPct(st.bridgeRate)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Interactive Stage Card + Left-Aligned Proportional Bar */}
                  <div
                    onClick={() => setActiveFunnelStep(st.step)}
                    className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? `${st.ringClass} shadow-2xs`
                        : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-mono font-semibold ${
                            st.step === 4
                              ? "bg-emerald-600 text-white"
                              : "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {st.step}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {st.label}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {st.desc}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-base font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                          {formatNumber(st.value)}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold tabular-nums ${st.badgeClass}`}
                          >
                            {st.rateBadge}
                          </span>
                          <span className="rounded-md bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
                            {st.unitCostLabel}: {st.unitCostVal}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Clean Left-Aligned Proportional Progress Track */}
                    <div className="mt-3">
                      <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${st.barClass} transition-all duration-300`}
                          style={{ width: `${st.topWidthPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* 3 Visual Benchmark Gauges (Hook CTR, Intent Ratio, Post-Click CVR) */}
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t.benchmarkTitle}
            </p>

            <div className="space-y-3">
              {[
                {
                  name: t.hookMetricName,
                  val: activeScope.linkCtr,
                  target: 1.0,
                  maxScale: 2.5,
                  status:
                    activeScope.linkCtr >= 1.0
                      ? t.statusOptimal
                      : activeScope.linkCtr >= 0.7
                      ? t.statusWarn
                      : t.statusLow,
                  tone:
                    activeScope.linkCtr >= 1.0
                      ? "emerald"
                      : activeScope.linkCtr >= 0.7
                      ? "amber"
                      : "rose",
                },
                {
                  name: t.intentMetricName,
                  val: activeScope.intentRatio,
                  target: 60.0,
                  maxScale: 100.0,
                  status:
                    activeScope.intentRatio >= 60.0
                      ? t.statusOptimal
                      : activeScope.intentRatio >= 40.0
                      ? t.statusWarn
                      : t.statusLow,
                  tone:
                    activeScope.intentRatio >= 60.0
                      ? "emerald"
                      : activeScope.intentRatio >= 40.0
                      ? "amber"
                      : "rose",
                },
                {
                  name: t.cvrMetricName,
                  val: activeScope.cvr,
                  target: 10.0,
                  maxScale: 30.0,
                  status:
                    activeScope.cvr >= 10.0
                      ? t.statusOptimal
                      : activeScope.cvr >= 5.0
                      ? t.statusWarn
                      : t.statusLow,
                  tone:
                    activeScope.cvr >= 10.0
                      ? "emerald"
                      : activeScope.cvr >= 5.0
                      ? "amber"
                      : "rose",
                },
              ].map((bm) => {
                const fillPct = Math.min(100, Math.max(4, (bm.val / bm.maxScale) * 100));
                const targetPosPct = Math.min(95, (bm.target / bm.maxScale) * 100);
                return (
                  <div key={bm.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                        {bm.name}
                      </span>
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {formatPct(bm.val)}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          ({t.targetLabel} ≥{formatPct(bm.target)})
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-sans font-semibold ${
                            bm.tone === "emerald"
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : bm.tone === "amber"
                              ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300"
                              : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300"
                          }`}
                        >
                          {bm.status}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-1.5 w-full rounded-full bg-zinc-200/80 dark:bg-zinc-700/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-zinc-800 dark:bg-zinc-200 transition-all duration-300"
                        style={{ width: `${fillPct}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-indigo-600 dark:bg-indigo-400"
                        style={{ left: `${targetPosPct}%` }}
                        title={`${t.targetLabel}: ${formatPct(bm.target)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Executive Diagnosis Callout (Zero Emoji) */}
          <div className="flex items-start gap-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                activeScope.impressions === 0
                  ? "bg-zinc-400"
                  : activeScope.linkCtr < 1.0
                  ? "bg-amber-500"
                  : activeScope.linkClicks >= 10 && activeScope.cvr < 8
                  ? "bg-rose-500"
                  : "bg-emerald-500"
              }`}
            />
            <span>
              {activeScope.impressions === 0
                ? t.DiagnosisNoData
                : activeScope.linkCtr < 1.0
                ? t.diagnosisLowCtr
                : activeScope.linkClicks >= 10 && activeScope.cvr < 8
                ? t.diagnosisLowCvr
                : t.diagnosisHealthy}
            </span>
          </div>
        </div>

        {/* KANAN (7 KOLOM): INFOGRAPHIC PERFORMANCE COMPARISON BY META ADS LEVEL */}
        <div className="xl:col-span-7 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs space-y-4">
          {/* Header & Level Tabs */}
          <div className="flex flex-col gap-3 border-b border-zinc-100 dark:border-white/[0.06] pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  {t.breakdownTitle}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t.breakdownSub}
                </p>
              </div>

              {/* Level Switcher Pills */}
              <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 self-start">
                {(
                  [
                    { id: "campaign", label: `${t.tabCampaign} (${hierarchy.campaigns.length})` },
                    { id: "adset", label: `${t.tabAdSet} (${filteredAdSetOptions.length})` },
                    { id: "ad", label: `${t.tabAd} (${filteredAdOptions.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTabLevel(tab.id);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activeTabLevel === tab.id
                        ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Sort Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t.searchPlaceholder}
                className="h-9 flex-1 min-w-[180px] rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 px-3 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />

              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortKey);
                  setPage(1);
                }}
                className="h-9 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                <option value="spend">{t.sortBySpend}</option>
                <option value="results">{t.sortByResults}</option>
                <option value="linkCtr">{t.sortByCtr}</option>
                <option value="cpr">{t.sortByCpr}</option>
              </select>
            </div>
          </div>

          {/* Infographic Entity Cards List */}
          <div className="space-y-3">
            {pagedRows.map((row, idx) => {
              const rank = (safePage - 1) * PER_PAGE + idx + 1;
              const isSelected =
                selectedCampaignId === row.id ||
                selectedAdSetId === row.id ||
                selectedAdId === row.id;

              const spendPct = Math.max(4, (row.spend / maxRowSpend) * 100);
              const clickPct = Math.max(4, (row.linkClicks / maxRowClicks) * 100);
              const resultPct = row.results > 0 ? Math.max(5, (row.results / maxRowResults) * 100) : 0;

              return (
                <div
                  key={row.id}
                  onClick={() => {
                    if (row.level === "campaign") {
                      setSelectedCampaignId(selectedCampaignId === row.id ? "all" : row.id);
                      setSelectedAdSetId("all");
                      setSelectedAdId("all");
                    } else if (row.level === "adset") {
                      setSelectedCampaignId(row.campaignId);
                      setSelectedAdSetId(selectedAdSetId === row.id ? "all" : row.id);
                      setSelectedAdId("all");
                    } else {
                      setSelectedCampaignId(row.campaignId);
                      if (row.adsetId) setSelectedAdSetId(row.adsetId);
                      setSelectedAdId(selectedAdId === row.id ? "all" : row.id);
                    }
                  }}
                  className={`rounded-xl border p-4 transition-all cursor-pointer space-y-3.5 ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-50/70 dark:border-zinc-100 dark:bg-zinc-800/60 shadow-2xs"
                      : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/35"
                  }`}
                >
                  {/* Card Top Header: Rank + Name + Share Pill + Drill-down Button */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 text-[11px] font-mono font-semibold tabular-nums">
                        #{rank}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {row.name}
                          </p>
                          {isSelected && (
                            <span className="rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2 py-0.5 text-[10px] font-semibold shrink-0">
                              {t.focusedBadge}
                            </span>
                          )}
                        </div>
                        {row.subLabel && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {row.subLabel}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-mono font-semibold tabular-nums text-zinc-700 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300">
                        {formatPct(row.spendShare)} {t.budgetShareLabel}
                      </span>

                      {row.level === "campaign" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCampaignId(row.id);
                            setSelectedAdSetId("all");
                            setSelectedAdId("all");
                            setActiveTabLevel("adset");
                            setPage(1);
                          }}
                          className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          {t.drillToAdSets}
                        </button>
                      )}

                      {row.level === "adset" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCampaignId(row.campaignId);
                            setSelectedAdSetId(row.id);
                            setSelectedAdId("all");
                            setActiveTabLevel("ad");
                            setPage(1);
                          }}
                          className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          {t.drillToAds}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3 Executive Metric Columns with Restrained Progress Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* 1. Spend & CPM */}
                    <div className="rounded-lg bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 p-3 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          {t.spend}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                          CPM {row.cpm !== null ? formatCompactCurrency(row.cpm) : "—"}
                        </span>
                      </div>
                      <p className="text-sm font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatMoney(row.spend)}
                      </p>
                      <div className="h-1.5 w-full rounded-full bg-zinc-200/80 dark:bg-zinc-700/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-800 dark:bg-zinc-200 transition-all duration-300"
                          style={{ width: `${spendPct}%` }}
                        />
                      </div>
                    </div>

                    {/* 2. Link Clicks, CTR & CPC */}
                    <div className="rounded-lg bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 p-3 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          {t.linkClicks}
                        </span>
                        <span className="text-[10px] font-mono font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                          CTR {formatPct(row.linkCtr)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="text-sm font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                          {formatNumber(row.linkClicks)}
                        </p>
                        <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                          CPC {row.linkCpc !== null ? formatCompactCurrency(row.linkCpc) : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-200/80 dark:bg-zinc-700/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                          style={{ width: `${clickPct}%` }}
                        />
                      </div>
                    </div>

                    {/* 3. Conversion Results, CVR & CPR */}
                    <div className="rounded-lg bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 p-3 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">
                          {unitLabel}
                        </span>
                        <span className="text-[10px] font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                          CVR {formatPct(row.cvr)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="text-sm font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                          {formatNumber(row.results)}
                        </p>
                        <span className="text-[10px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                          CPR {row.cpr !== null ? formatCompactCurrency(row.cpr) : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-200/80 dark:bg-zinc-700/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                          style={{ width: `${resultPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clean Monochromatic Funnel Strip Inside Each Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/70 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/60 px-3 py-2 text-[11px] font-mono tabular-nums">
                    <span className="font-sans font-medium text-zinc-500 dark:text-zinc-400">
                      {t.funnelStripTitle}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <span>
                        <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCompactCount(row.impressions)}</strong> Imp
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span>
                        <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCompactCount(row.allClicks)}</strong> All ({formatPct(row.allCtr)})
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span>
                        <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCompactCount(row.linkClicks)}</strong> Link ({formatPct(row.linkCtr)})
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {formatNumber(row.results)} {unitLabel} ({formatPct(row.cvr)})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-white/[0.06] text-xs">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 font-semibold disabled:opacity-40 cursor-pointer"
              >
                ← {t.prev}
              </button>
              <span className="font-mono text-zinc-500">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 font-semibold disabled:opacity-40 cursor-pointer"
              >
                {t.next} →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
