"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";
import { MetaReconciliationModal } from "@/components/dashboard/MetaReconciliationModal";
import { PerformanceTrendChart } from "@/components/dashboard/PerformanceTrendChart";
import { CTWAFunnelPanel } from "@/components/dashboard/CTWAFunnelPanel";
import { DeliveryDiagnosticsPanel } from "@/components/dashboard/DeliveryDiagnosticsPanel";
import { AdDetailDrawer } from "@/components/dashboard/AdDetailDrawer";
import { CampaignSearchableDropdown } from "@/components/dashboard/CampaignSearchableDropdown";
import { AIAdsPerformanceAnalyst } from "@/components/dashboard/AIAdsPerformanceAnalyst";

export interface RealAdRow {
  id: string;
  adId: string;
  adName: string;
  providerAdId: string;
  campaignId: string;
  campaignName: string;
  campaignObjective: string | null;
  campaignStatus: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | string;
  campaignStatusLabel?: string;
  adSettingStatus: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
  adSettingLabel?: string;
  deliveryStatus: "DELIVERING" | "NOT_DELIVERING" | "UNKNOWN" | string;
  deliveryLabel: string;
  deliveryReason?: string;
  adsetId: string | null;
  adsetName: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number | null;
  results: number;
  conversations?: number;
  resultActionTypes?: string[];
  resultLabel?: string;
  resultTypeDescription?: string | null;
  costPerResult: number | null;
  linkClicks: number;
  linkCtr: number | null;
  linkCpc: number | null;
  allClicks: number;
  allCtr: number | null;
  allCpc: number | null;
  cpm: number | null;
  qualityRanking: string | null;
  engagementRateRanking: string | null;
  conversionRateRanking: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdsIntelligenceApiResponse {
  success: boolean;
  data: {
    organizationId: string;
    organizationName: string;
    adAccount: {
      id: string;
      name: string | null;
      currency: string;
      status: string;
      timezone?: string;
    } | null;
    lastSyncedAt: string | null;
    kpis: {
      totalSpend: number;
      totalResults: number;
      totalConversations: number;
      conversationDataIncomplete: boolean;
      resultLabel?: string;
      resultTypeDescription?: string | null;
      costPerResult: number | null;
      totalReach: number;
      totalImpressions: number;
      frequency: number | null;
      linkClicks: number;
      linkCtr: number | null;
      linkCpc: number | null;
      allClicks: number;
      allCtr: number | null;
      allCpc: number | null;
      cpm: number | null;
      currency: string;
      totalCampaigns: number;
      activeCampaigns: number;
      pausedCampaigns: number;
      archivedCampaigns?: number;
      otherCampaigns?: number;
      totalAds: number;
      deliveringAds?: number;
      notDeliveringAds?: number;
      unknownDeliveryAds?: number;
      activeAds: number;
      campaignPausedAds?: number;
      adPausedAds?: number;
      archivedAds?: number;
      deletedAds?: number;
      pausedAds: number;
      filteredAdsCount: number;
    };
    campaigns: CampaignDetailData[];
    comparison: CampaignDetailData[];
    ads: RealAdRow[];
    dailyTrend?: Array<{
      date: string;
      spend: number;
      impressions: number;
      reach: number;
      linkClicks: number;
      allClicks?: number;
      results: number;
      conversations?: number;
    }>;
    dateRangeContext?: {
      dateRange: string;
      since: string | null;
      until: string | null;
      earliestDate?: string | null;
      latestDate?: string | null;
      timezone: string;
    };
  };
}

const ITEMS_PER_PAGE = 10;

function PerformanceSparkline({
  id,
  data,
  isHighlight = false,
}: {
  id: string;
  data: number[];
  isHighlight?: boolean;
}) {
  const points = useMemo(() => {
    if (!data || data.length === 0) {
      return [10, 15, 12, 18, 14, 22, 20];
    }
    if (data.length === 1) {
      return [data[0], data[0]];
    }
    return data;
  }, [data]);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 240;
  const h = 48;
  const pad = 4;

  const coords = points.map((val, i) => {
    const x = (i / (points.length - 1)) * (w - pad * 2) + pad;
    const y = h - ((val - min) / range) * (h - pad * 2) - pad;
    return { x, y };
  });

  const pathD = coords.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = arr[i - 1];
    const midX = (prev.x + pt.x) / 2;
    return `${acc} C ${midX.toFixed(1)} ${prev.y.toFixed(1)}, ${midX.toFixed(1)} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${h} L ${coords[0].x.toFixed(1)} ${h} Z`;
  const gradId = `spark-grad-${id}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-11 mt-3 overflow-visible pointer-events-none select-none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {isHighlight ? (
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>
        ) : (
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#71717a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#71717a" stopOpacity="0.0" />
          </linearGradient>
        )}
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={pathD}
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isHighlight ? "stroke-indigo-500 dark:stroke-indigo-400" : "stroke-zinc-400 dark:stroke-zinc-500"}
      />
    </svg>
  );
}

export default function AdsIntelligencePage() {
  const { formatNumber, locale } = useI18n();
  const { addToast } = useToast();

  // Filters State: default to "30d" for an active, operational marketing view
  const [dateRange, setDateRange] = useState("30d");
  const [selectedCampaignId, setSelectedCampaignId] = useState("all");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string>("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>("all");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting & Pagination State
  const [sortBy, setSortBy] = useState<
    "spend" | "linkClicks" | "linkCtr" | "linkCpc" | "impressions" | "reach" | "results"
  >("spend");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Selected Ad for Detail Drawer
  const [activeDetailAdId, setActiveDetailAdId] = useState<string | null>(null);

  // Network & Reconciliation State
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [apiData, setApiData] = useState<AdsIntelligenceApiResponse["data"] | null>(null);

  // Manual Refresh / Sync trigger
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange) params.set("dateRange", dateRange);
      if (selectedCampaignId !== "all") params.set("campaignId", selectedCampaignId);
      if (campaignStatusFilter !== "all") params.set("campaignStatus", campaignStatusFilter);
      if (deliveryStatusFilter !== "all") params.set("deliveryStatus", deliveryStatusFilter);
      if (objectiveFilter !== "all") params.set("objective", objectiveFilter);

      const res = await fetch(`/api/ads?${params.toString()}`);
      if (res.ok) {
        const json: AdsIntelligenceApiResponse = await res.json();
        if (json.success && json.data) {
          setApiData(json.data);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        addToast("error", "Gagal Memuat Data", err.error || "Gagal menghubungi server");
      }
    } catch (err) {
      addToast(
        "error",
        "Kesalahan Jaringan",
        err instanceof Error ? err.message : "Tidak dapat memuat data iklan"
      );
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, selectedCampaignId, campaignStatusFilter, deliveryStatusFilter, objectiveFilter, addToast]);

  // Initial and reactive data load
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateRange) params.set("dateRange", dateRange);
        if (selectedCampaignId !== "all") params.set("campaignId", selectedCampaignId);
        if (campaignStatusFilter !== "all") params.set("campaignStatus", campaignStatusFilter);
        if (deliveryStatusFilter !== "all") params.set("deliveryStatus", deliveryStatusFilter);
        if (objectiveFilter !== "all") params.set("objective", objectiveFilter);

        const res = await fetch(`/api/ads?${params.toString()}`);
        if (res.ok) {
          const json: AdsIntelligenceApiResponse = await res.json();
          if (isMounted && json.success && json.data) {
            setApiData(json.data);
          }
        }
      } catch {
        // Non-blocking fetch error
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [dateRange, selectedCampaignId, campaignStatusFilter, deliveryStatusFilter, objectiveFilter]);

  // Trigger Real Sync from Meta Marketing API
  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowDemoFallback: false }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        const count = data.syncResult?.recordsProcessed ?? 0;
        addToast(
          "success",
          "Sinkronisasi Berhasil",
          `Meta Ads sinkron: ${count} record berhasil diproses dan disimpan ke basis data.`
        );
        refreshData();
      } else {
        addToast(
          "error",
          "Sinkronisasi Gagal",
          data.message || "Gagal melakukan sinkronisasi Meta Marketing API."
        );
      }
    } catch (err) {
      addToast(
        "error",
        "Kesalahan Jaringan",
        err instanceof Error ? err.message : "Network error"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter & Sort Ads in memory
  const rawAds = apiData?.ads;
  const processedAds = useMemo(() => {
    if (!rawAds) return [];
    let list = [...rawAds];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.adName.toLowerCase().includes(q) ||
          a.campaignName.toLowerCase().includes(q) ||
          a.providerAdId.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (sortBy) {
        case "spend":
          valA = a.spend;
          valB = b.spend;
          break;
        case "linkClicks":
          valA = a.linkClicks;
          valB = b.linkClicks;
          break;
        case "linkCtr":
          valA = a.linkCtr ?? -1;
          valB = b.linkCtr ?? -1;
          break;
        case "linkCpc":
          valA = a.linkCpc ?? 999999999;
          valB = b.linkCpc ?? 999999999;
          break;
        case "impressions":
          valA = a.impressions;
          valB = b.impressions;
          break;
        case "reach":
          valA = a.reach;
          valB = b.reach;
          break;
        case "results":
          valA = a.results;
          valB = b.results;
          break;
      }

      if (sortOrder === "asc") {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      }
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    });

    return list;
  }, [rawAds, searchQuery, sortBy, sortOrder]);

  // Paginated ads slice
  const totalPages = Math.ceil(processedAds.length / ITEMS_PER_PAGE);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const paginatedAds = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return processedAds.slice(start, start + ITEMS_PER_PAGE);
  }, [processedAds, safeCurrentPage]);

  const kpis = apiData?.kpis;
  const rawCampaigns = apiData?.campaigns;
  const campaigns = useMemo(() => rawCampaigns || [], [rawCampaigns]);
  const adAccount = apiData?.adAccount;

  const formatAdCurrency = useCallback(
    (amount: number | null | undefined) => {
      if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
      const currency = adAccount?.currency || kpis?.currency || "IDR";
      const intlLocale = locale === "id" ? "id-ID" : "en-US";
      if (currency === "IDR") {
        return `Rp ${Math.round(amount).toLocaleString(intlLocale)}`;
      }
      return new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    },
    [adAccount?.currency, kpis?.currency, locale]
  );

  const getLocalizedResultLabel = useCallback(
    (rawLabel?: string | null) => {
      if (!rawLabel) return locale === "id" ? "Hasil" : "Results";
      if (locale === "id") return rawLabel;
      const lower = rawLabel.toLowerCase();
      if (lower === "hasil") return "Results";
      if (lower === "pesan") return "Messages";
      if (lower === "klik tautan") return "Link Clicks";
      if (lower === "tayangan") return "Impressions";
      if (lower === "percakapan") return "Conversations";
      return rawLabel;
    },
    [locale]
  );

  const getLocalizedResultTypeDescription = useCallback(
    (desc?: string | null) => {
      if (!desc) {
        return locale === "id"
          ? "Sebagian jenis hasil belum teridentifikasi"
          : "Some result types not yet identified";
      }
      if (locale === "id") return desc;
      const lower = desc.toLowerCase().trim();
      if (lower.includes("belum teridentifikasi")) {
        return "Some result types not yet identified";
      }
      if (lower.includes("percakapan whatsapp")) {
        return "Meta WhatsApp Conversations";
      }
      if (lower.includes("prospek") || lower.includes("leads")) {
        return "Meta Leads";
      }
      if (lower.includes("penjualan") || lower.includes("sales")) {
        return "Sales Campaign Results";
      }
      if (lower.includes("traffic")) {
        return "Meta Traffic Campaign Results";
      }
      return desc;
    },
    [locale]
  );

  const selectedAd = useMemo(
    () => rawAds?.find((ad) => ad.id === activeDetailAdId) ?? null,
    [rawAds, activeDetailAdId]
  );

  const hasActiveFilters =
    selectedCampaignId !== "all" ||
    campaignStatusFilter !== "all" ||
    deliveryStatusFilter !== "all" ||
    objectiveFilter !== "all" ||
    searchQuery.trim().length > 0;

  const resetAllFilters = () => {
    setSelectedCampaignId("all");
    setCampaignStatusFilter("all");
    setDeliveryStatusFilter("all");
    setObjectiveFilter("all");
    setSearchQuery("");
    setDateRange("30d");
    setCurrentPage(1);
  };

  const handleHeaderSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const formatReportDate = useCallback(
    (value: string | null | undefined, includeYear = true) => {
      if (!value) return null;
      return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
        day: "numeric",
        month: "short",
        ...(includeYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
      }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
    },
    [locale]
  );

  const formatSyncDate = useCallback(
    (value: string | null | undefined) => {
      if (!value) return null;
      return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: adAccount?.timezone || "Asia/Jakarta",
        timeZoneName: "short",
      }).format(new Date(value));
    },
    [adAccount?.timezone, locale]
  );

  const formatRate = useCallback(
    (value: number | null | undefined) => {
      if (value === null || value === undefined || isNaN(value)) return "—";
      const formatted = value.toFixed(2);
      return locale === "id" ? `${formatted.replace(".", ",")}%` : `${formatted}%`;
    },
    [locale]
  );

  const formatFrequency = useCallback(
    (val: number | null | undefined) => {
      if (val === null || val === undefined || isNaN(val)) return "—";
      const formatted = val.toFixed(2);
      return locale === "id" ? `${formatted.replace(".", ",")}x` : `${formatted}x`;
    },
    [locale]
  );

  const dailyTrend = useMemo(() => apiData?.dailyTrend || [], [apiData?.dailyTrend]);
  const spendTrend = useMemo(() => dailyTrend.map((d) => d.spend), [dailyTrend]);
  const resultsTrend = useMemo(
    () => dailyTrend.map((d) => d.results ?? d.conversations ?? 0),
    [dailyTrend]
  );
  const cprTrend = useMemo(
    () =>
      dailyTrend.map((d) => {
        const res = d.results ?? d.conversations ?? 0;
        return res > 0 ? d.spend / res : 0;
      }),
    [dailyTrend]
  );
  const ctrTrend = useMemo(
    () =>
      dailyTrend.map((d) =>
        d.impressions > 0 ? (d.linkClicks / d.impressions) * 100 : 0
      ),
    [dailyTrend]
  );

  const spendSubtitle = useMemo(() => {
    if (dateRange === "today") return locale === "id" ? "Hari ini" : "Today";
    if (dateRange === "7d") return locale === "id" ? "Total 7 hari" : "Total 7 days";
    if (dateRange === "14d") return locale === "id" ? "Total 14 hari" : "Total 14 days";
    if (dateRange === "30d") return locale === "id" ? "Total 30 hari" : "Total 30 days";
    return locale === "id" ? `Total ${dateRange}` : `Total ${dateRange}`;
  }, [dateRange, locale]);

  const dateRangeContext = apiData?.dateRangeContext;
  const dateRangeContextText = useMemo(() => {
    if (!dateRangeContext?.since || !dateRangeContext?.until) {
      return null;
    }
    const sinceStr = formatReportDate(dateRangeContext.since, false);
    const untilStr = formatReportDate(dateRangeContext.until, true);
    const prefix = locale === "id" ? "Periode" : "Period";
    let text = `${prefix} ${sinceStr} – ${untilStr}`;

    if (
      dateRangeContext.earliestDate &&
      dateRangeContext.since &&
      dateRangeContext.earliestDate > dateRangeContext.since
    ) {
      const earliestStr = formatReportDate(dateRangeContext.earliestDate, false);
      const availableText =
        locale === "id"
          ? `data tersedia sejak ${earliestStr}`
          : `data available since ${earliestStr}`;
      text += ` · ${availableText}`;
    }
    return text;
  }, [dateRangeContext, formatReportDate, locale]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-20">
      {/* 1. Header & Organization Reporting Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Ads Performance
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {adAccount && (
              <>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60">
                  {adAccount.name || adAccount.id}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                  {adAccount.currency} · {adAccount.timezone || "Asia/Jakarta"}
                </span>
              </>
            )}
            {apiData?.lastSyncedAt && (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  {locale === "id" ? "Sinkron" : "Synced"}{" "}
                  {formatSyncDate(apiData.lastSyncedAt)}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Audit Data (Secondary) */}
          <button
            type="button"
            onClick={() => setIsReconciliationOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-3.5 py-2 text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
          >
            <svg
              className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {locale === "id" ? "Audit Data" : "Audit Data"}
          </button>

          {/* Sinkronkan Meta (Primary) */}
          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 px-4 py-2 text-xs font-semibold shadow-sm cursor-pointer transition-colors disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${
                isSyncing ? "animate-spin text-indigo-500" : "text-zinc-300 dark:text-zinc-700"
              }`}
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
            {isSyncing
              ? locale === "id"
                ? "Menyinkronkan..."
                : "Syncing..."
              : locale === "id"
              ? "Sinkronkan Meta"
              : "Sync Meta"}
          </button>
        </div>
      </div>

      {/* Period Filter Tabs & Date Range Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80">
          {[
            { id: "today", label: locale === "id" ? "Hari ini" : "Today" },
            { id: "7d", label: locale === "id" ? "7 hari" : "7 days" },
            { id: "14d", label: locale === "id" ? "14 hari" : "14 days" },
            { id: "30d", label: locale === "id" ? "30 hari" : "30 days" },
          ].map((pill) => {
            const isActive = dateRange === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setDateRange(pill.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white dark:border dark:border-zinc-700/80"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {dateRangeContextText && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {dateRangeContextText}
          </div>
        )}
      </div>

      {/* 2. Executive Performance Summary (4 Cards with Sparklines) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Belanja Iklan */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d12]/90 backdrop-blur-sm p-4.5 flex flex-col justify-between shadow-2xs">
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Belanja Iklan" : "Ad Spend"}
            </span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-sans tabular-nums">
              {isLoading ? "..." : formatAdCurrency(kpis?.totalSpend ?? 0)}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {spendSubtitle}
            </div>
          </div>
          <PerformanceSparkline id="spend" data={spendTrend} />
        </div>

        {/* Card 2: Hasil Iklan (Highlighted with top indigo border) */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 border-t-2 border-t-indigo-500 dark:border-t-indigo-500 bg-white dark:bg-[#0c0d12]/90 backdrop-blur-sm p-4.5 flex flex-col justify-between shadow-2xs relative">
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id"
                ? `${kpis?.resultLabel || "Hasil"} Iklan`
                : `Ad ${getLocalizedResultLabel(kpis?.resultLabel)}`}
            </span>
            <div className="mt-2 flex items-baseline">
              {isLoading ? (
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">...</span>
              ) : (
                <>
                  <span className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 font-sans tabular-nums">
                    {formatNumber(kpis?.totalResults ?? 0)}
                  </span>
                  <span className="ml-1.5 text-sm font-normal text-indigo-600/80 dark:text-indigo-400/80">
                    {locale === "id"
                      ? (kpis?.resultLabel ? kpis.resultLabel.toLowerCase() : "hasil")
                      : getLocalizedResultLabel(kpis?.resultLabel).toLowerCase()}
                  </span>
                </>
              )}
            </div>
            <div
              className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1"
              title={getLocalizedResultTypeDescription(kpis?.resultTypeDescription)}
            >
              {getLocalizedResultTypeDescription(kpis?.resultTypeDescription)}
            </div>
          </div>
          <PerformanceSparkline id="results" data={resultsTrend} isHighlight={true} />
        </div>

        {/* Card 3: Biaya per Hasil */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d12]/90 backdrop-blur-sm p-4.5 flex flex-col justify-between shadow-2xs">
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id"
                ? `Biaya per ${kpis?.resultLabel || "Hasil"}`
                : `Cost per ${getLocalizedResultLabel(kpis?.resultLabel).replace(/s$/, "")}`}
            </span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-sans tabular-nums">
              {isLoading
                ? "..."
                : kpis?.costPerResult !== null && kpis?.costPerResult !== undefined
                ? formatAdCurrency(kpis.costPerResult)
                : "—"}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Berdasarkan hasil aktual" : "Based on actual results"}
            </div>
          </div>
          <PerformanceSparkline id="cpr" data={cprTrend} />
        </div>

        {/* Card 4: CTR Tautan */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d12]/90 backdrop-blur-sm p-4.5 flex flex-col justify-between shadow-2xs">
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "CTR Tautan" : "Link CTR"}
            </span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-sans tabular-nums">
              {isLoading ? "..." : formatRate(kpis?.linkCtr)}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {isLoading
                ? "..."
                : `${formatNumber(kpis?.linkClicks ?? 0)} ${
                    locale === "id" ? "klik tautan" : "link clicks"
                  }`}
            </div>
          </div>
          <PerformanceSparkline id="ctr" data={ctrTrend} />
        </div>
      </div>

      {/* Secondary Metric Strip (7 columns matching reference media_1793110930939.png) */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white/70 dark:bg-[#0c0d12]/90 backdrop-blur-sm px-5 py-3.5 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 xl:grid-cols-[1.15fr_0.85fr_0.85fr_0.85fr_0.85fr_0.75fr_1.7fr] gap-y-3.5 gap-x-4 items-center">
          {/* 1. Reach harian (akumulasi) */}
          <div className="min-w-0">
            <div
              className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate"
              title={
                locale === "id"
                  ? "Penjumlahan reach harian pada iklan terpilih; audiens antarhari dan antariklan dapat tumpang tindih"
                  : "Sum of daily reach across selected ads; audiences may overlap across days"
              }
            >
              {locale === "id" ? "Reach harian (akumulasi)" : "Daily reach (accumulated)"}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {formatNumber(kpis?.totalReach ?? 0)}
            </div>
          </div>

          {/* 2. Tayangan */}
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
              {locale === "id" ? "Tayangan" : "Impressions"}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {formatNumber(kpis?.totalImpressions ?? 0)}
            </div>
          </div>

          {/* 3. Klik tautan */}
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
              {locale === "id" ? "Klik tautan" : "Link clicks"}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {formatNumber(kpis?.linkClicks ?? 0)}
            </div>
          </div>

          {/* 4. CPC tautan */}
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
              {locale === "id" ? "CPC tautan" : "Link CPC"}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {formatAdCurrency(kpis?.linkCpc ?? null)}
            </div>
          </div>

          {/* 5. CPM */}
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
              CPM
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {formatAdCurrency(kpis?.cpm ?? null)}
            </div>
          </div>

          {/* 6. Frekuensi */}
          <div className="min-w-0">
            <div
              className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate"
              title={
                locale === "id"
                  ? "Rata-rata frekuensi tayangan terhadap jangkauan (impressions / reach)"
                  : "Average impression frequency (impressions / reach)"
              }
            >
              {locale === "id" ? "Frekuensi" : "Frequency"}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
              {formatFrequency(kpis?.frequency)}
            </div>
          </div>

          {/* 7. Semua klik */}
          <div className="col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-1 min-w-0">
            <div
              className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate"
              title={
                locale === "id"
                  ? "Klik, CTR, dan CPC semua jenis"
                  : "All clicks, CTR, and CPC across all action types"
              }
            >
              {locale === "id" ? "Semua klik" : "All clicks"}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 tabular-nums whitespace-nowrap overflow-hidden">
              <span>{formatNumber(kpis?.allClicks ?? 0)}</span>
              <span className="font-sans text-xs font-normal text-zinc-500 dark:text-zinc-400">
                · CTR {formatRate(kpis?.allCtr)} · CPC {formatAdCurrency(kpis?.allCpc ?? null)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Performance Trend Time-Series Chart */}
      <PerformanceTrendChart
        dailyTrend={apiData?.dailyTrend || []}
        currency={adAccount?.currency || kpis?.currency || "IDR"}
        timezone={adAccount?.timezone || "Asia/Jakarta"}
        conversationDataAvailable={!kpis?.conversationDataIncomplete}
        resultLabel={kpis?.resultLabel || "Hasil"}
      />

      <CTWAFunnelPanel
        impressions={kpis?.totalImpressions ?? 0}
        linkClicks={kpis?.linkClicks ?? 0}
        conversations={kpis?.conversationDataIncomplete ? null : kpis?.totalConversations ?? 0}
        linkCtr={kpis?.linkCtr ?? null}
        results={kpis?.totalResults}
        resultLabel={kpis?.resultLabel || "Hasil"}
      />

      {/* 4. Delivery Diagnostics Panel */}
      <DeliveryDiagnosticsPanel
        campaignCounts={{
          total: kpis?.totalCampaigns ?? 0,
          active: kpis?.activeCampaigns ?? 0,
          paused: kpis?.pausedCampaigns ?? 0,
          archived: kpis?.archivedCampaigns ?? 0,
          other: kpis?.otherCampaigns ?? 0,
        }}
        adCounts={{
          total: kpis?.totalAds ?? 0,
          active: kpis?.deliveringAds ?? (kpis?.activeAds ?? 0),
          campaignPaused: kpis?.campaignPausedAds ?? 0,
          adPaused: kpis?.adPausedAds ?? 0,
          archived: kpis?.archivedAds ?? 0,
          deleted: kpis?.deletedAds ?? 0,
          unknown: kpis?.unknownDeliveryAds ?? 0,
        }}
      />

      {/* 5. AI Ads Performance Analyst (On-Demand Intelligence) */}
      <AIAdsPerformanceAnalyst
        campaigns={campaigns}
        ads={apiData?.ads || []}
        accountName={adAccount?.name || adAccount?.id}
        currency={adAccount?.currency || kpis?.currency || "IDR"}
        timezone={adAccount?.timezone || "Asia/Jakarta"}
        currentDateRange={dateRange}
      />

      {/* 5. Filter Toolbar yang Terletak Tepat di Atas Tabel Iklan */}
      <section
        aria-label="Filter dan Kontrol Tabel Iklan"
        className="space-y-2.5 static lg:sticky lg:top-14 lg:z-20 bg-zinc-50/95 dark:bg-[#090a0c]/95 backdrop-blur-xs py-1"
      >
        <div className="rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          {/* Top Row: Search Input + Prioritized Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative w-full lg:w-72 shrink-0">
              <label htmlFor="search-input" className="sr-only">
                Cari iklan
              </label>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama iklan, campaign, atau ID..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-8 text-xs text-zinc-800 placeholder-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                  title="Hapus pencarian"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Controls Row: Prioritized: 1. Campaign, 2. Status Penayangan, 3. Status Campaign Induk, 4. Objective, 5. Rentang Tanggal */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Campaign Searchable Dropdown */}
              <CampaignSearchableDropdown
                campaigns={campaigns}
                selectedCampaignId={selectedCampaignId}
                onSelectCampaign={(id) => {
                  setSelectedCampaignId(id);
                  setCurrentPage(1);
                }}
              />

              {/* 2. Status Penayangan (Delivery) */}
              <div className="relative">
                <label className="sr-only" htmlFor="delivery-status-filter">
                  Status Penayangan (Delivery)
                </label>
                <select
                  id="delivery-status-filter"
                  value={deliveryStatusFilter}
                  onChange={(e) => {
                    setDeliveryStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  title="Filter Status Penayangan"
                  className={`rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors max-w-[160px] sm:max-w-[170px] truncate ${
                    deliveryStatusFilter !== "all"
                      ? "border-indigo-300 bg-indigo-50/70 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <option value="all">Semua Penayangan</option>
                  <option value="DELIVERING">Menayangkan</option>
                  <option value="NOT_DELIVERING">Tidak Tayang</option>
                  <option value="CAMPAIGN_PAUSED">Campaign Dijeda</option>
                  <option value="AD_PAUSED">Iklan Dijeda</option>
                  <option value="ARCHIVED">Diarsipkan</option>
                  <option value="DELETED">Dihapus</option>
                  <option value="UNKNOWN">Belum diketahui</option>
                </select>
              </div>

              {/* 3. Status Campaign Induk */}
              <div className="relative">
                <label className="sr-only" htmlFor="campaign-status-filter">
                  Status Campaign Induk
                </label>
                <select
                  id="campaign-status-filter"
                  value={campaignStatusFilter}
                  onChange={(e) => {
                    setCampaignStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  title="Filter Status Campaign Induk"
                  className={`rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors max-w-[160px] sm:max-w-[170px] truncate ${
                    campaignStatusFilter !== "all"
                      ? "border-indigo-300 bg-indigo-50/70 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <option value="all">Semua Status Campaign</option>
                  <option value="ACTIVE">Campaign Aktif</option>
                  <option value="PAUSED">Campaign Dijeda</option>
                  <option value="ARCHIVED">Campaign Diarsipkan</option>
                  <option value="DELETED">Campaign Dihapus</option>
                  <option value="UNKNOWN">Status Belum Diketahui</option>
                </select>
              </div>

              {/* 4. Objective */}
              <div className="relative">
                <label className="sr-only" htmlFor="objective-filter">
                  Objective
                </label>
                <select
                  id="objective-filter"
                  value={objectiveFilter}
                  onChange={(e) => {
                    setObjectiveFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  title="Filter Objective Kampanye"
                  className={`rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors max-w-[150px] sm:max-w-[160px] truncate ${
                    objectiveFilter !== "all"
                      ? "border-indigo-300 bg-indigo-50/70 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <option value="all">Semua Objective</option>
                  {[
                    ...new Set(
                      campaigns
                        .map((c) => c.objective)
                        .filter((obj): obj is string => Boolean(obj))
                    ),
                  ].map((obj) => (
                    <option key={obj} value={obj}>
                      {obj}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Rentang Tanggal */}
              <DateRangeFilter currentRange={dateRange} onChange={setDateRange} />

              {/* Reset Filter Button (Only when active) */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 cursor-pointer transition-colors shrink-0"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Secondary Row: Active Filter Chips & Accurate Count Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
            {/* Active Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-medium text-zinc-400">Filter Aktif:</span>
              {!hasActiveFilters && dateRange === "30d" ? (
                <span className="text-[11px] text-zinc-400 italic">Semua filter default (30 hari terakhir)</span>
              ) : (
                <>
                  {deliveryStatusFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                      <span>Penayangan: {deliveryStatusFilter}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryStatusFilter("all");
                          setCurrentPage(1);
                        }}
                        className="hover:text-indigo-900 cursor-pointer"
                        title="Hapus filter delivery"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {campaignStatusFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                      <span>Status Induk: {campaignStatusFilter}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCampaignStatusFilter("all");
                          setCurrentPage(1);
                        }}
                        className="hover:text-indigo-900 cursor-pointer"
                        title="Hapus filter status campaign"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {objectiveFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                      <span>Objective: {objectiveFilter}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setObjectiveFilter("all");
                          setCurrentPage(1);
                        }}
                        className="hover:text-indigo-900 cursor-pointer"
                        title="Hapus filter objective"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {searchQuery.trim() && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 max-w-[180px]">
                      <span className="truncate">Cari: &ldquo;{searchQuery}&rdquo;</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        className="hover:text-zinc-900 cursor-pointer"
                        title="Hapus pencarian"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {dateRange !== "30d" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                      <span>Periode: {dateRange}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDateRange("30d");
                          setCurrentPage(1);
                        }}
                        className="hover:text-zinc-900 cursor-pointer"
                        title="Kembalikan ke 30 hari"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline ml-1 cursor-pointer"
                  >
                    Reset Semua
                  </button>
                </>
              )}
            </div>

            {/* Filtered Count Indicator */}
            <div className="shrink-0 text-right text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Menampilkan{" "}
              <strong className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {processedAds.length}
              </strong>{" "}
              dari{" "}
              <span className="font-mono">{rawAds?.length ?? 0}</span> iklan
            </div>
          </div>
        </div>
      </section>

      {/* 6. Detailed Ad Performance Table with Explicit Separation of Campaign Status & Delivery Status */}
      {isLoading ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="bg-zinc-50/90 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-900/90 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th scope="col" className="sticky left-0 z-20 bg-zinc-50 px-4 py-3 text-left font-semibold dark:bg-zinc-900">Iklan</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">Status</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Belanja</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Hasil</th>
                  <th scope="col" title="Reach dijumlahkan dari insight harian per iklan; audiens dapat tumpang tindih" className="px-3 py-3 text-right font-semibold">Reach* / Tayangan</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">CTR Tautan</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">CPC Tautan</th>
                  <th scope="col" className="sticky right-0 z-20 bg-zinc-50 px-4 py-3 text-right font-semibold dark:bg-zinc-900">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-3.5 w-44 bg-zinc-200 dark:bg-zinc-800 rounded mb-1" />
                      <div className="h-2.5 w-28 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-4 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="h-3.5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="h-3.5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="h-3.5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="h-3.5 w-10 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="h-3.5 w-14 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-7 w-14 bg-zinc-200 dark:bg-zinc-800 rounded-md ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : processedAds.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? "Tidak ada iklan yang memenuhi filter" : "Belum ada data iklan"}
          description={
            hasActiveFilters
              ? "Coba sesuaikan kata kunci pencarian, status delivery, atau rentang tanggal pelaporan."
              : "Sinkronkan akun Meta Ads Anda untuk memuat kampanye dan performa iklan properti."
          }
          onReset={resetAllFilters}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="bg-zinc-50/90 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-900/90 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Iklan
                  </th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">
                    Status
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("spend")}
                    className="px-3 py-3 text-right font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Belanja {sortBy === "spend" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("results")}
                    className="px-3 py-3 text-right font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Hasil {sortBy === "results" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("reach")}
                    className="px-3 py-3 text-right font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Reach / Tayangan {sortBy === "reach" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("linkCtr")}
                    className="px-3 py-3 text-right font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    CTR Tautan {sortBy === "linkCtr" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("linkCpc")}
                    className="px-3 py-3 text-right font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    CPC Tautan {sortBy === "linkCpc" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800 dark:divide-zinc-800 dark:text-zinc-200">
                {paginatedAds.map((ad) => {
                  const isDelivering = ad.deliveryStatus === "DELIVERING";

                  return (
                    <tr
                      key={ad.adId}
                      className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 cursor-pointer"
                      onClick={() => setActiveDetailAdId(ad.id)}
                    >
                      <td className="sticky left-0 z-10 max-w-[280px] bg-white px-4 py-3 dark:bg-zinc-900">
                        <div className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100" title={ad.adName}>
                          {ad.adName}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-zinc-400" title={`${ad.providerAdId} · ${ad.campaignName}`}>
                          <span className="font-mono">ID {ad.providerAdId}</span>
                          <span className="mx-1.5">·</span>
                          <span>{ad.campaignName}</span>
                        </div>
                      </td>

                      {/* Effective delivery status */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex flex-col items-start gap-0.5">
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              isDelivering
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : ad.deliveryStatus === "NOT_DELIVERING"
                                ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
                            {ad.deliveryLabel}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-100 font-semibold">
                        {formatAdCurrency(ad.spend)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {ad.results > 0 ? (
                            <span className="text-emerald-700 dark:text-emerald-400">{formatNumber(ad.results)} {ad.resultLabel || "Hasil"}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </div>
                        {ad.resultTypeDescription && (
                          <div className="mt-0.5 text-[10px] text-zinc-500 font-normal">
                            {ad.resultTypeDescription}
                          </div>
                        )}
                        <div className="mt-0.5 text-[10px] text-zinc-400">
                          {ad.costPerResult !== null ? `Biaya/hasil: ${formatAdCurrency(ad.costPerResult)}` : "Biaya/hasil: —"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">
                        <div>
                          <span className="mr-1 text-[10px] text-zinc-400" title="Akumulasi reach harian per iklan">Reach*</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatNumber(ad.reach)}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-400">
                          <span className="mr-1">Impr.</span>
                          {formatNumber(ad.impressions)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">
                        {ad.linkCtr !== null ? (
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatRate(ad.linkCtr)}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                        {ad.linkCpc !== null ? formatAdCurrency(ad.linkCpc) : "—"}
                      </td>
                      <td className="sticky right-0 z-10 bg-white px-4 py-3 text-right dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveDetailAdId(ad.id)}
                          aria-label={`Detail ${ad.adName}`}
                          title="Buka detail iklan & analisis AI"
                          className="inline-flex h-8 items-center gap-1.5 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                        >
                          <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <span className="text-zinc-500 dark:text-zinc-400">
                {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(safeCurrentPage * ITEMS_PER_PAGE, processedAds.length)} dari {processedAds.length} iklan
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  Sebelumnya
                </button>
                <span className="font-mono tabular-nums text-zinc-500 px-1">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={safeCurrentPage === totalPages}
                  className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
          <p className="border-t border-zinc-100 px-4 py-2 text-[10px] text-zinc-400 dark:border-zinc-800">* Reach merupakan akumulasi reach harian per iklan, bukan jangkauan unik periode.</p>
        </div>
      )}

      {/* 7. Slide-out Ad Detail Drawer with Live Server /api/ads/[id] and AI Performance Analysis */}
      {selectedAd && (
        <AdDetailDrawer
          ad={selectedAd}
          currency={adAccount?.currency || kpis?.currency || "IDR"}
          lastSyncedAt={apiData?.lastSyncedAt}
          onClose={() => setActiveDetailAdId(null)}
        />
      )}

      {/* 8. Meta Data Reconciliation Diagnostics Modal */}
      <MetaReconciliationModal
        isOpen={isReconciliationOpen}
        onClose={() => setIsReconciliationOpen(false)}
        dateRange={dateRange}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing}
      />
    </div>
  );
}
