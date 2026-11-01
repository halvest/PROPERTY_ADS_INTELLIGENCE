"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { FetchGuard } from "@/lib/ads/fetch-guard";
import { parseDateRange } from "@/lib/ads/date-utils";
import { describeMetaAction } from "@/lib/marketing/meta/action-catalog";
import { formatSmartAdIdentity, resolveAdResultMetric, translateMetaTerm } from "@/lib/ads/result-metric";

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
  reach: number | null;
  frequency: number | null;
  results: number | null;
  conversations?: number | null;
  resultActionTypes?: string[];
  resultLabel?: string;
  resultMetricValue?: number | null;
  resultMetricLabel?: string;
  resultMetricCostPerResult?: number | null;
  resultMetricKind?: "conversion" | "link_click" | "interaction" | "zero" | "unavailable";
  resultMetricUnitLabel?: string;
  resultTypeDescription?: string | null;
  creativeFormat?: string | null;
  resultDetails?: Array<{ type: string; label: string; category: string; count: number; costPerResult: number | null }>;
  costPerResult: number | null;
  linkClicks: number | null;
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
  hasInsights?: boolean;
}

interface AdsIntelligenceApiResponse {
  success: boolean;
  data: {
    organizationId: string;
    organizationName: string;
    canSync?: boolean;
    insightsState: "available" | "no_data_for_period" | "no_account_selected";
    liveAccountActions?: Array<{ action_type: string; value: string }>;
    accountMetricsState: "available" | "sync_required" | "source_unavailable" | "filtered_scope" | "range_not_supported" | "no_account_selected";
    adAccount: {
      id: string;
      name: string | null;
      currency: string;
      status: string;
      timezone?: string;
      lastSyncedAt?: string | null;
    } | null;
    availableAdAccounts?: Array<{
      id: string;
      name: string | null;
      status: string;
      currency?: string;
      timezone?: string;
      lastSyncedAt?: string | null;
      isSelected?: boolean;
    }>;
    lastSyncedAt: string | null;
    kpis: {
      totalSpend: number;
      totalResults: number | null;
      totalConversations: number | null;
      conversationDataIncomplete: boolean;
      resultLabel?: string;
      resultTypeDescription?: string | null;
      resultBreakdown?: Array<{ type: string; label: string; category: string; count: number; costPerResult: number | null }>;
      costPerResult: number | null;
      totalReach: number | null;
      totalImpressions: number;
      frequency: number | null;
      linkClicks: number | null;
      linkCtr: number | null;
      linkCpc: number | null;
      allClicks: number;
      allCtr: number | null;
      allCpc: number | null;
      cpm: number | null;
      hasInsights?: boolean;
      currency: string;
      totalCampaigns: number;
      activeCampaigns: number;
      pausedCampaigns: number;
      archivedCampaigns?: number;
      otherCampaigns?: number;
      totalAds: number;
      classifiedAds?: number;
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
      reach: number | null;
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
      return [0, 0];
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

function formatRelativeSyncTime(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return locale === "id" ? "Baru saja" : "Just now";
  if (minutes < 60) return locale === "id" ? `${minutes} menit lalu` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === "id" ? `${hours} jam lalu` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return locale === "id" ? `${days} hari lalu` : `${days} days ago`;
}

export default function AdsIntelligencePage() {
  const { formatNumber, locale } = useI18n();
  const { addToast } = useToast();

  // Filters State: default to "30d" for an active, operational marketing view
  const [dateRange, setDateRange] = useState("30d");
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("all");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string>("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>("all");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyWithSpend, setShowOnlyWithSpend] = useState(true);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>("");

  // Sorting & Pagination State
  const [sortBy, setSortBy] = useState<
    "spend" | "linkClicks" | "linkCtr" | "linkCpc" | "impressions" | "results"
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchGuardRef = useRef(new FetchGuard());
  const adsCacheRef = useRef(new Map<string, AdsIntelligenceApiResponse["data"]>());
  const autoSyncAttemptedAtRef = useRef(new Map<string, number>());

  // Single guarded fetch path. Starting a fetch aborts the previous one and
  // invalidates its sequence, so a stale response for a previously selected
  // account can never overwrite the latest context.
  const fetchAds = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const guard = fetchGuardRef.current;
      const { seq, signal } = guard.begin();
      const params = new URLSearchParams();
      if (dateRange) params.set("dateRange", dateRange);
      if (selectedCampaignId !== "all") params.set("campaignId", selectedCampaignId);
      if (campaignStatusFilter !== "all") params.set("campaignStatus", campaignStatusFilter);
      if (deliveryStatusFilter !== "all") params.set("deliveryStatus", deliveryStatusFilter);
      if (objectiveFilter !== "all") params.set("objective", objectiveFilter);
      if (selectedAdAccountId) params.set("adAccountId", selectedAdAccountId);
      const cacheKey = params.toString();
      const cached = adsCacheRef.current.get(cacheKey);
      setIsLoading(!cached);
      setLoadError(null);
      setApiData(cached || null);
      try {
        const res = await fetch(`/api/ads?${params.toString()}`, { signal, cache: "no-store" });
        if (!guard.isCurrent(seq)) return;
        if (res.ok) {
          const json: AdsIntelligenceApiResponse = await res.json();
          if (!guard.isCurrent(seq)) return;
          if (json.success && json.data) {
            adsCacheRef.current.set(cacheKey, json.data);
            setApiData(json.data);
          } else {
            setApiData(cached || null);
            setLoadError(cached ? null : locale === "id" ? "Data iklan tidak tersedia." : "Ad data is unavailable.");
          }
        } else {
          const err = await res.json().catch(() => ({}));
          setApiData(cached || null);
          setLoadError(cached ? null : err.error || (locale === "id" ? "Gagal memuat data iklan." : "Failed to load ad data."));
          if (!opts.silent) {
            addToast("error", locale === "id" ? "Gagal Memuat Data" : "Failed to Load Data", err.error || "");
          }
        }
      } catch (err) {
        if (!guard.isCurrent(seq)) return; // superseded or aborted request
        setApiData(cached || null);
        setLoadError(cached ? null : locale === "id" ? "Kesalahan jaringan saat memuat data iklan." : "Network error while loading ad data.");
        if (!opts.silent) {
          addToast(
            "error",
            locale === "id" ? "Kesalahan Jaringan" : "Network Error",
            err instanceof Error ? err.message : ""
          );
        }
      } finally {
        if (guard.isCurrent(seq)) setIsLoading(false);
      }
    },
    [dateRange, selectedCampaignId, campaignStatusFilter, deliveryStatusFilter, objectiveFilter, selectedAdAccountId, addToast, locale]
  );

  const refreshData = useCallback(() => void fetchAds(), [fetchAds]);

  // Context changes clear the previous account's data immediately so it is
  // never displayed under the new account's identity while loading.
  useEffect(() => {
    const guard = fetchGuardRef.current;
    async function load() {
      await fetchAds({ silent: true });
    }
    void load();
    return () => guard.cancel();
  }, [fetchAds]);

  const runMetaSync = useCallback(async (
    silent = false,
    requestedRange?: { period: string; since?: string; until?: string }
  ) => {
    if (isSyncing || !apiData?.canSync || !apiData.adAccount) return;
    const syncPeriod = requestedRange?.period || dateRange;
    if (syncPeriod === "all") return;
    setIsSyncing(true);
    try {
      const customRange = requestedRange?.since && requestedRange.until
        ? { since: requestedRange.since, until: requestedRange.until }
        : undefined;
      const syncTimeRange = customRange || parseDateRange(
        syncPeriod,
        apiData.adAccount.timezone || "Asia/Jakarta"
      );
      const datePreset = ({ today: "today", "1d": "today", "7d": "last_7d", "14d": "last_14d", "30d": "last_30d" } as Record<string, string>)[syncPeriod];
      const res = await fetch("/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAdAccountId: selectedAdAccountId || apiData.adAccount.id,
          ...(datePreset ? { datePreset } : {}),
          ...(syncTimeRange.since && syncTimeRange.until ? { timeRange: syncTimeRange } : {}),
        }),
      });
      const data = await res.json();
      const liveAccountInsight = data.syncResult?.accountInsights?.[0] as {
        reach?: string | number | null;
        frequency?: string | number | null;
        actions?: Array<{ action_type: string; value: string }>;
      } | undefined;
      const fullAccountScope = selectedCampaignId === "all" && campaignStatusFilter === "all" && deliveryStatusFilter === "all" && objectiveFilter === "all";
      if (liveAccountInsight && fullAccountScope) {
        const reach = liveAccountInsight.reach == null ? null : Number(liveAccountInsight.reach);
        const frequency = liveAccountInsight.frequency == null ? null : Number(liveAccountInsight.frequency);
        const targetId = selectedAdAccountId || apiData.adAccount.id;
        const applyLiveMetrics = (current: AdsIntelligenceApiResponse["data"]) => ({
          ...current,
          lastSyncedAt: data.status === "success" ? data.syncResult?.syncedAt || current.lastSyncedAt : current.lastSyncedAt,
          adAccount: current.adAccount ? { ...current.adAccount, lastSyncedAt: data.status === "success" ? data.syncResult?.syncedAt || current.adAccount.lastSyncedAt : current.adAccount.lastSyncedAt } : null,
          accountMetricsState: reach !== null || frequency !== null ? "available" as const : current.accountMetricsState,
          liveAccountActions: liveAccountInsight.actions || current.liveAccountActions,
          kpis: { ...current.kpis, totalReach: reach, frequency },
        });
        await fetchAds({ silent: true });
        const params = new URLSearchParams();
        if (dateRange) params.set("dateRange", dateRange);
        if (selectedCampaignId !== "all") params.set("campaignId", selectedCampaignId);
        if (campaignStatusFilter !== "all") params.set("campaignStatus", campaignStatusFilter);
        if (deliveryStatusFilter !== "all") params.set("deliveryStatus", deliveryStatusFilter);
        if (objectiveFilter !== "all") params.set("objective", objectiveFilter);
        if (selectedAdAccountId) params.set("adAccountId", selectedAdAccountId);
        const cached = adsCacheRef.current.get(params.toString());
        if (cached?.adAccount?.id === targetId) adsCacheRef.current.set(params.toString(), applyLiveMetrics(cached));
        setApiData((current) => current?.adAccount?.id === targetId ? applyLiveMetrics(current) : current);
      }
      if (res.ok && data.status === "success") {
        const count = data.syncResult?.recordsProcessed ?? 0;
        const syncWarnings = data.syncResult?.warnings as string[] | undefined;
        if (!silent && syncWarnings?.length) {
          addToast("warning", "Sinkronisasi Berhasil dengan Catatan", syncWarnings.join(" "));
        } else if (!silent) {
          addToast(
            "success",
            "Sinkronisasi Berhasil",
            `Meta Ads sinkron: ${count} record berhasil diproses dan disimpan ke basis data.`
          );
        }
        if (!liveAccountInsight || !fullAccountScope) await fetchAds({ silent: true });
      } else if (res.ok && data.status === "partial") {
        const insights = data.syncResult?.insightsSynced ?? 0;
        if (!silent) addToast(
          "warning",
          "Sinkronisasi Sebagian",
          `Data akun diperbarui, tetapi sinkronisasi belum lengkap. Insights tersimpan: ${insights}. Coba lagi atau periksa detail koneksi Meta.`
        );
        if (!liveAccountInsight || !fullAccountScope) await fetchAds({ silent: true });
      } else {
        if (!silent) addToast(
          "error",
          "Sinkronisasi Gagal",
          data.message || "Gagal melakukan sinkronisasi Meta Marketing API."
        );
      }
    } catch (err) {
      if (!silent) addToast(
        "error",
        "Kesalahan Jaringan",
        err instanceof Error ? err.message : "Network error"
      );
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, apiData, dateRange, selectedAdAccountId, selectedCampaignId, campaignStatusFilter, deliveryStatusFilter, objectiveFilter, fetchAds, addToast]);

  const handleTriggerSync = (range?: { period: string; since?: string; until?: string }) => void runMetaSync(false, range);

  useEffect(() => {
    if (!apiData?.canSync || !apiData.adAccount || dateRange === "all") return;
    const cacheKey = `${selectedAdAccountId || apiData.adAccount.id}:${dateRange}`;
    const last = apiData.adAccount.lastSyncedAt || apiData.lastSyncedAt;
    const stale = !last || Date.now() - new Date(last).getTime() > 5 * 60_000;
    const metricsMissing = apiData.accountMetricsState !== "filtered_scope" && (
      apiData.accountMetricsState === "sync_required" || apiData.accountMetricsState === "source_unavailable" || apiData.kpis.totalReach == null || apiData.kpis.frequency == null
    );
    const attemptedAt = autoSyncAttemptedAtRef.current.get(cacheKey) || 0;
    if ((!stale && !metricsMissing) || Date.now() - attemptedAt < 5 * 60_000 || isSyncing) return;
    autoSyncAttemptedAtRef.current.set(cacheKey, Date.now());
    void runMetaSync(true);
  }, [apiData, dateRange, selectedAdAccountId, isSyncing, runMetaSync]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void fetchAds({ silent: true });
    };
    const interval = window.setInterval(refreshIfVisible, 5 * 60_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [fetchAds]);

  // Filter & Sort Ads in memory
  const rawAds = apiData?.ads;
  const processedAds = useMemo(() => {
    if (!rawAds) return [];
    let list = [...rawAds];

    if (showOnlyWithSpend) {
      list = list.filter((ad) => ad.spend != null && Number.isFinite(ad.spend) && ad.spend > 0);
    }

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
          valA = a.linkClicks ?? -1;
          valB = b.linkClicks ?? -1;
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
        case "results":
          valA = a.resultMetricValue ?? a.results ?? -1;
          valB = b.resultMetricValue ?? b.results ?? -1;
          break;
      }

      if (sortOrder === "asc") {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      }
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    });

    return list;
  }, [rawAds, searchQuery, showOnlyWithSpend, sortBy, sortOrder]);

  // Paginated ads slice
  const totalPages = Math.ceil(processedAds.length / ITEMS_PER_PAGE);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const paginatedAds = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return processedAds.slice(start, start + ITEMS_PER_PAGE);
  }, [processedAds, safeCurrentPage]);

  const kpis = apiData?.kpis;
  const insightsAvailable = apiData?.insightsState === "available";
  const rawCampaigns = apiData?.campaigns;
  const campaigns = useMemo(() => rawCampaigns || [], [rawCampaigns]);
  const adAccount = apiData?.adAccount;

  const formatAdCurrency = useCallback(
    (amount: number | null | undefined) => {
      if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
      const intlLocale = locale === "id" ? "id-ID" : "en-US";
      const currency = adAccount?.currency || kpis?.currency;
      if (!currency) return amount.toLocaleString(intlLocale, { maximumFractionDigits: 2 });
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
        return "";
      }
      if (locale === "id") return desc;
      return desc
        .replace(/Percakapan WhatsApp/g, "WhatsApp conversations")
        .replace(/Koneksi pesan/g, "Messaging connections")
        .replace(/Balasan pertama/g, "First replies")
        .replace(/Prospek website/g, "Website leads")
        .replace(/Prospek/g, "Leads")
        .replace(/Kunjungan halaman/g, "Landing page views")
        .replace(/Klik tautan/g, "Link clicks");
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
    searchQuery.trim().length > 0 ||
    !showOnlyWithSpend;

  const resetAllFilters = () => {
    setSelectedCampaignId("all");
    setCampaignStatusFilter("all");
    setDeliveryStatusFilter("all");
    setObjectiveFilter("all");
    setSearchQuery("");
    setDateRange("30d");
    setShowOnlyWithSpend(true);
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

  const formatRate = useCallback(
    (value: number | null | undefined) => {
      if (value === null || value === undefined || isNaN(value)) return "—";
      const formatted = value.toFixed(2);
      return locale === "id" ? `${formatted.replace(".", ",")}%` : `${formatted}%`;
    },
    [locale]
  );

  const dailyTrend = useMemo(() => apiData?.dailyTrend || [], [apiData?.dailyTrend]);
  const displayedTotalResults = kpis?.totalResults ?? dailyTrend.reduce(
    (sum, point) => sum + (point.results > 0 ? point.results : point.conversations ?? 0),
    0
  );
  const displayedCostPerResult = displayedTotalResults > 0
    ? (kpis?.totalSpend || 0) / displayedTotalResults
    : null;
  const daysCount = Math.max(dailyTrend.length, 1);
  const totalImpressions = kpis?.totalImpressions ?? 0;
  const totalLinkClicks = kpis?.linkClicks ?? 0;
  const totalAllClicks = kpis?.allClicks ?? 0;
  const intentClickRate = totalAllClicks > 0 ? (totalLinkClicks / totalAllClicks) * 100 : 0;
  const clickConversionRate = totalLinkClicks > 0 && displayedTotalResults > 0
    ? (displayedTotalResults / totalLinkClicks) * 100
    : 0;
  const averageResultsPerDay = displayedTotalResults / daysCount;
  const oneDecimal = (value: number) => new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  const liveActionSummary = (apiData?.liveAccountActions || [])
    .map((action) => ({ ...describeMetaAction(action.action_type), count: Number(action.value) || 0 }))
    .filter((action) => action.count > 0 && action.category !== "other" && action.category !== "link_click")
    .sort((a, b) => b.count - a.count)
    .filter((action, index, all) => all.findIndex((candidate) => candidate.label === action.label) === index)
    .slice(0, 2)
    .map((action) => `${formatNumber(action.count)} ${action.label}`)
    .join(" · ");
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
    const days = dailyTrend.length || 1;
    const average = (kpis?.totalSpend || 0) / days;
    return `${locale === "id" ? "Rata-rata" : "Average"} ${formatAdCurrency(average)} / ${locale === "id" ? "hari" : "day"}`;
  }, [dailyTrend.length, kpis?.totalSpend, formatAdCurrency, locale]);

  const dateRangeContext = apiData?.dateRangeContext;
  const dateRangeContextText = useMemo(() => {
    if (!dateRangeContext?.since || !dateRangeContext?.until) {
      return null;
    }
    const sinceStr = formatReportDate(dateRangeContext.since, false);
    const untilStr = formatReportDate(dateRangeContext.until, true);
    const prefix = locale === "id" ? "Periode" : "Period";
    return `${prefix} ${sinceStr} – ${untilStr}`;
  }, [dateRangeContext, formatReportDate, locale]);

  const periodChipLabel = useMemo(() => {
    const labels: Record<string, { id: string; en: string }> = {
      today: { id: "Hari Ini", en: "Today" },
      yesterday: { id: "Kemarin", en: "Yesterday" },
      "7d": { id: "7 Hari Terakhir", en: "Last 7 Days" },
      "14d": { id: "14 Hari Terakhir", en: "Last 14 Days" },
      "30d": { id: "30 Hari Terakhir", en: "Last 30 Days" },
      this_month: { id: "Bulan Ini", en: "This Month" },
      last_month: { id: "Bulan Lalu", en: "Last Month" },
      all: { id: "Semua Waktu", en: "All Time" },
      maximum: { id: "Semua Waktu", en: "All Time" },
    };
    if (labels[dateRange]) return locale === "id" ? labels[dateRange].id : labels[dateRange].en;
    if (dateRange.includes(":") || dateRange.includes("_")) {
      return dateRangeContextText?.replace(/^(Periode|Period)\s+/i, "") || dateRange.replace(/[:_]/, " – ");
    }
    return dateRange;
  }, [dateRange, dateRangeContextText, locale]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-20">
      {/* 1. Header & Organization Reporting Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Ads Performance
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(apiData?.availableAdAccounts?.length ?? 0) > 0 ? (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span>{locale === "id" ? "Akun Iklan:" : "Ad Account:"}</span>
                <select
                  value={selectedAdAccountId || adAccount?.id || ""}
                  onChange={(e) => {
                    setSelectedAdAccountId(e.target.value);
                    setSelectedCampaignId("all");
                    setCurrentPage(1);
                    setActiveDetailAdId(null);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 cursor-pointer"
                  aria-label={locale === "id" ? "Pilih akun iklan" : "Select ad account"}
                >
                  {(apiData?.availableAdAccounts || []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.id} · {acc.id.replace(/^act_/, "act_•••")}
                    </option>
                  ))}
                </select>
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {locale === "id" ? "Terhubung · Sinkron otomatis" : "Connected · Auto-sync"}{" "}
                  {formatRelativeSyncTime(adAccount?.lastSyncedAt || apiData?.lastSyncedAt, locale)}
                </span>
              </label>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                {locale === "id"
                  ? "Belum ada akun iklan terhubung. Hubungkan Meta di Pengaturan."
                  : "No ad account connected. Connect Meta in Settings."}
              </span>
            )}
            {adAccount && (
              <>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                  {adAccount.currency || "Currency unavailable"} · {adAccount.timezone || "Timezone unavailable"}
                </span>
              </>
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
            onClick={() => handleTriggerSync()}
            disabled={isSyncing || !apiData?.canSync || !adAccount}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
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
              ? locale === "id" ? "Memperbarui..." : "Refreshing..."
              : locale === "id" ? "Refresh Paksa" : "Force Refresh"}
          </button>
        </div>
      </div>

      {/* Fetch state: loading / error / stale (stored data, not live) */}
      {isLoading && (
        <div role="status" className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {locale === "id" ? "Memuat data akun iklan…" : "Loading ad account data…"}
        </div>
      )}
      {!isLoading && loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <span>
            {locale === "id"
              ? `Gagal memuat data. ${loadError} Data akun sebelumnya tidak ditampilkan sebagai data akun ini.`
              : `Failed to load data. ${loadError} Previous account data is not shown as this account's data.`}
          </span>
          <button type="button" onClick={() => refreshData()} className="rounded-lg border border-rose-300 px-2.5 py-1 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40 cursor-pointer">
            {locale === "id" ? "Coba Lagi" : "Retry"}
          </button>
        </div>
      )}

      {/* Period Filter Tabs & Date Range Context */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100 p-1 dark:border-zinc-800/80 dark:bg-zinc-900/90">
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
                  setShowCustomDateRange(false);
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
          <button
            type="button"
            aria-pressed={dateRange.includes(":") || showCustomDateRange}
            onClick={() => {
              const existingRange = dateRange.split(":");
              setCustomDateStart(existingRange.length === 2 ? existingRange[0] : "");
              setCustomDateEnd(existingRange.length === 2 ? existingRange[1] : "");
              setShowCustomDateRange((open) => !open);
            }}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${dateRange.includes(":") || showCustomDateRange
              ? "bg-white text-indigo-700 shadow-xs dark:bg-zinc-800 dark:text-indigo-300 dark:border dark:border-zinc-700/80"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
          >
            {locale === "id" ? "Kustom" : "Custom"}
          </button>
          </div>

          {dateRangeContextText && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {dateRangeContextText}
            </div>
          )}
        </div>

        {showCustomDateRange && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!customDateStart || !customDateEnd || customDateStart > customDateEnd) return;
              setDateRange(`${customDateStart}:${customDateEnd}`);
              setCurrentPage(1);
              setShowCustomDateRange(false);
            }}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end"
          >
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{locale === "id" ? "Mulai" : "Start"}</span>
              <input type="date" required value={customDateStart} max={customDateEnd || undefined} onChange={(event) => setCustomDateStart(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{locale === "id" ? "Sampai" : "End"}</span>
              <input type="date" required value={customDateEnd} min={customDateStart || undefined} onChange={(event) => setCustomDateEnd(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" />
            </label>
            <button type="submit" disabled={!customDateStart || !customDateEnd || customDateStart > customDateEnd} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {locale === "id" ? "Terapkan Periode" : "Apply Range"}
            </button>
            <button type="button" onClick={() => setShowCustomDateRange(false)} className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {locale === "id" ? "Batal" : "Cancel"}
            </button>
            {dateRange.includes(":") && (
              <span className="text-[11px] text-zinc-500 sm:ml-auto">
                {locale === "id" ? "Rentang aktif:" : "Active range:"} {dateRange.replace(":", " – ")}
              </span>
            )}
            {customDateStart && customDateEnd && customDateStart > customDateEnd && (
              <span role="alert" className="text-[11px] text-rose-600">{locale === "id" ? "Tanggal mulai harus sebelum tanggal akhir." : "Start date must be on or before end date."}</span>
            )}
          </form>
        )}
      </div>

      {/* 2. Executive Performance Summary (4 Cards with Sparklines) */}
      {apiData?.insightsState === "no_data_for_period" && (
        <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {locale === "id"
            ? "Belum ada Insights tersimpan untuk periode ini. Pembaruan otomatis sedang mengambil data dari Meta; angka tetap ditandai tidak tersedia sampai Meta mengembalikannya."
            : "No Insights are stored for this period yet. Automatic refresh is requesting Meta data; values remain unavailable until Meta returns them."}
        </div>
      )}
      {apiData?.insightsState === "no_account_selected" && (
        <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {locale === "id" ? "Pilih akun iklan untuk memuat campaign dan Insights." : "Select an ad account to load campaigns and Insights."}
        </div>
      )}
      {apiData?.accountMetricsState === "range_not_supported" && (
        <div role="status" className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
          {locale === "id"
            ? "Jangkauan dan frekuensi akun membutuhkan periode tanggal yang terbatas. Pilih 7, 14, atau 30 hari lalu sinkronkan Meta."
            : "Account reach and frequency require a bounded date range. Choose 7, 14, or 30 days, then sync Meta."}
        </div>
      )}
      {apiData?.accountMetricsState === "filtered_scope" && (
        <div role="status" className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
          {locale === "id"
            ? "Jangkauan unik dan frekuensi tingkat akun hanya ditampilkan saat semua kampanye dalam akun dipilih. Hapus filter kampanye/status/tujuan agar cakupannya sesuai."
            : "Account-level unique reach and frequency are shown only for the full ad account. Clear campaign, status, or objective filters to use that scope."}
        </div>
      )}
      {apiData?.accountMetricsState === "source_unavailable" && (
        <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {locale === "id"
            ? "Meta belum mengembalikan jangkauan atau frekuensi untuk akun dan periode ini. Nilai tidak diperkirakan dari penjumlahan data iklan."
            : "Meta did not return reach or frequency for this account and period. These values are not estimated by adding ad-level data."}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Belanja Iklan */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d12]/90 backdrop-blur-sm p-4.5 flex flex-col justify-between shadow-2xs">
          <div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Belanja Iklan" : "Ad Spend"}
            </span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-sans tabular-nums">
              {isLoading ? "..." : insightsAvailable ? formatAdCurrency(kpis?.totalSpend) : "—"}
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
              {locale === "id" ? "Hasil Iklan (Konversi)" : "Ad Results (Conversions)"}
            </span>
            <div className="mt-2 flex items-baseline">
              {isLoading ? (
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">...</span>
              ) : (
                <>
                  <span className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 font-sans tabular-nums">
                    {formatNumber(displayedTotalResults)}
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
              title={(kpis?.resultBreakdown || []).map((item) => `${item.label}: ${item.count} · ${locale === "id" ? "Biaya/hasil" : "Cost/result"} ${formatAdCurrency(item.costPerResult)}`).join("\n") || getLocalizedResultTypeDescription(kpis?.resultTypeDescription)}
            >
              {getLocalizedResultTypeDescription(kpis?.resultTypeDescription) || getLocalizedResultTypeDescription(liveActionSummary) || (displayedTotalResults > 0 ? `${locale === "id" ? "Rata-rata" : "Average"} ${oneDecimal(averageResultsPerDay)} ${locale === "id" ? "hasil / hari" : "results / day"}` : (locale === "id" ? "Belum ada hasil" : "No results yet"))}
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
                : displayedCostPerResult !== null
                ? formatAdCurrency(displayedCostPerResult)
                : "—"}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Per Hasil Aktual" : "Per Actual Result"}
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
              {isLoading ? "..." : formatRate(kpis?.linkCtr ?? 0)}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {isLoading
                ? "..."
                : `${formatNumber(totalLinkClicks)} ${
                    locale === "id" ? "klik tautan" : "link clicks"
                  } · CVR ${displayedTotalResults > 0 && totalLinkClicks > 0 ? formatRate(clickConversionRate) : locale === "id" ? "0%" : "0%"}`}
            </div>
          </div>
          <PerformanceSparkline id="ctr" data={ctrTrend} />
        </div>
      </div>

      {/* Funnel & Pacing Diagnostic Bar */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white/70 dark:bg-[#0c0d12]/90 backdrop-blur-sm px-5 py-3.5 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-3.5 gap-x-4 items-center">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">{locale === "id" ? "Tayangan" : "Impressions"}</div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">{formatNumber(totalImpressions)}</div>
            <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{locale === "id" ? "Rata-rata" : "Average"} {formatNumber(Math.round(totalImpressions / daysCount))} / {locale === "id" ? "hari" : "day"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">CPM</div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">{formatAdCurrency(kpis?.cpm ?? 0)}</div>
            <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{locale === "id" ? "Biaya / 1.000 tayangan" : "Cost / 1,000 impressions"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">{locale === "id" ? "Semua Klik" : "All Clicks"}</div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">{formatNumber(totalAllClicks)}</div>
            <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">CTR {formatRate(kpis?.allCtr ?? 0)} · CPC {formatAdCurrency(kpis?.allCpc ?? 0)}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">{locale === "id" ? "Rasio Niat Klik" : "Link Intent Rate"}</div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">{totalAllClicks > 0 ? formatRate(intentClickRate) : "0%"}</div>
            <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{formatNumber(totalLinkClicks)} {locale === "id" ? "tautan dari" : "link clicks of"} {formatNumber(totalAllClicks)} {locale === "id" ? "klik" : "clicks"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">{locale === "id" ? "CPC Tautan" : "Link CPC"}</div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">{formatAdCurrency(kpis?.linkCpc ?? 0)}</div>
            <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{locale === "id" ? "Rata-rata" : "Average"} {formatNumber(Math.round(totalLinkClicks / daysCount))} {locale === "id" ? "klik / hari" : "clicks / day"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">{locale === "id" ? "Konversi Klik (CVR)" : "Click Conversion (CVR)"}</div>
            <div className="mt-1 text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">{totalLinkClicks > 0 && displayedTotalResults > 0 ? formatRate(clickConversionRate) : "0%"}</div>
            <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{locale === "id" ? "Rata-rata" : "Average"} {oneDecimal(averageResultsPerDay)} {locale === "id" ? "hasil / hari" : "results / day"}</div>
          </div>
        </div>
      </div>

      {/* 3. Performance Trend Time-Series Chart */}
      <PerformanceTrendChart
        dailyTrend={apiData?.dailyTrend || []}
        currency={adAccount?.currency || kpis?.currency || ""}
        timezone={adAccount?.timezone || "UTC"}
        conversationDataAvailable={!kpis?.conversationDataIncomplete}
        resultLabel={kpis?.resultLabel || "Hasil"}
      />

      <CTWAFunnelPanel
        impressions={kpis?.totalImpressions ?? 0}
        allClicks={kpis?.allClicks ?? 0}
        linkClicks={kpis?.linkClicks ?? 0}
        totalResults={displayedTotalResults}
        allCpc={kpis?.allCpc ?? 0}
        linkCpc={kpis?.linkCpc ?? 0}
        cpm={kpis?.cpm ?? 0}
        costPerResult={displayedCostPerResult}
        currency={adAccount?.currency || kpis?.currency || "IDR"}
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
        classifiedAds={kpis?.classifiedAds ?? 0}
      />

      {/* 5. AI Ads Performance Analyst (On-Demand Intelligence) */}
      <AIAdsPerformanceAnalyst
        campaigns={campaigns}
        ads={apiData?.ads || []}
        accountName={adAccount?.name || adAccount?.id}
        adAccountId={selectedAdAccountId || adAccount?.id || null}
        currency={adAccount?.currency || kpis?.currency || ""}
        timezone={adAccount?.timezone || "UTC"}
        currentDateRange={dateRange}
        lastSyncedAt={adAccount?.lastSyncedAt || apiData?.lastSyncedAt || null}
        canSync={Boolean(apiData?.canSync && adAccount)}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerSync}
      />

      {/* 5. Filter Toolbar yang Terletak Tepat di Atas Tabel Iklan */}
      <section
        aria-label="Filter dan Kontrol Tabel Iklan"
        className="space-y-2.5 static xl:sticky xl:top-14 xl:z-20 bg-transparent py-1"
      >
        <div className="rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          {/* Top Row: Search Input + Prioritized Filters */}
          <div className="grid grid-cols-1 gap-3">
            {/* Search Input */}
            <div className="relative w-full min-w-0">
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
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {/* 1. Campaign Searchable Dropdown */}
              <CampaignSearchableDropdown
                campaigns={campaigns}
                selectedCampaignId={selectedCampaignId}
                className="w-full min-w-0"
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
                  className={`w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors truncate ${
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
                  className={`w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors truncate ${
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
                  className={`w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors truncate ${
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
                      {translateMetaTerm(obj)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Rentang Tanggal */}
              <DateRangeFilter fullWidth currentRange={dateRange} onChange={setDateRange} />
            </div>
          </div>

          {/* Secondary Row: Active Filter Chips & Accurate Count Summary */}
          <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            {/* Active Filter Chips */}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-zinc-400">Filter Aktif:</span>
              {!hasActiveFilters && dateRange === "30d" ? (
                <span className="text-[11px] text-zinc-400 italic">
                  Semua filter default (30 hari terakhir{dateRangeContextText ? ` · ${dateRangeContextText.replace(/^(Periode|Period)\s+/i, "")}` : ""} · belanja &gt; 0)
                </span>
              ) : (
                <>
                  {!showOnlyWithSpend && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Semua status belanja ditampilkan
                    </span>
                  )}
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
                      <span>{translateMetaTerm(objectiveFilter)}</span>
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
                      <span title={dateRangeContextText || periodChipLabel}>{locale === "id" ? "Periode:" : "Period:"} {periodChipLabel}</span>
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

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:justify-end">
            <label className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-700 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={showOnlyWithSpend}
                onChange={(event) => {
                  setShowOnlyWithSpend(event.target.checked);
                  setCurrentPage(1);
                }}
                className="peer sr-only"
                aria-label={locale === "id" ? "Tampilkan hanya iklan dengan belanja atau tayangan" : "Show only ads with spend or impressions"}
              />
              <span aria-hidden="true" className={`relative h-4 w-7 rounded-full transition-colors ${showOnlyWithSpend ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${showOnlyWithSpend ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </span>
              <span>{locale === "id" ? "Tampilkan hanya yang memiliki belanja/tayangan" : "Only show ads with spend/impressions"}</span>
            </label>

            {/* Filtered Count Indicator */}
            <div className="shrink-0 whitespace-nowrap text-left text-[11px] font-medium text-zinc-500 dark:text-zinc-400 lg:text-right">
              Menampilkan{" "}
              <strong className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {processedAds.length}
              </strong>{" "}
              dari{" "}
              <span className="font-mono">{rawAds?.length ?? 0}</span> iklan
            </div>
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
                  <th scope="col" className="sticky left-0 z-20 bg-zinc-50 px-4 py-3.5 text-left font-semibold dark:bg-zinc-900">Nama Iklan & Kampanye</th>
                  <th scope="col" className="px-4 py-3.5 text-left font-semibold">Status Tayang</th>
                  <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">Total Belanja</th>
                  <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">Hasil & Biaya</th>
                  <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">Tayangan</th>
                  <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">Rasio Klik (CTR)</th>
                  <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">Biaya / Klik</th>
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
          title={hasActiveFilters || (showOnlyWithSpend && (rawAds?.length ?? 0) > 0) ? "Tidak ada iklan yang memenuhi filter" : "Belum ada data iklan"}
          description={
            showOnlyWithSpend && (rawAds?.length ?? 0) > 0 && processedAds.length === 0
              ? "Tidak ada iklan dengan belanja pada periode ini. Matikan toggle untuk melihat seluruh inventaris iklan."
              : hasActiveFilters
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
                  <th scope="col" className="px-4 py-3.5 text-left font-semibold">
                    Nama Iklan & Kampanye
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-left font-semibold">
                    Status Tayang
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("spend")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Total Belanja {sortBy === "spend" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("results")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Hasil & Biaya {sortBy === "results" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("impressions")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Tayangan {sortBy === "impressions" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("linkCtr")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Rasio Klik (CTR) {sortBy === "linkCtr" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("linkCpc")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Biaya / Klik {sortBy === "linkCpc" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800 dark:divide-zinc-800 dark:text-zinc-200">
                {paginatedAds.map((ad) => {
                  const isDelivering = ad.deliveryStatus === "DELIVERING";
                  const identity = formatSmartAdIdentity({
                    adName: ad.adName,
                    adSetName: ad.adsetName,
                    campaignName: ad.campaignName,
                    providerAdId: ad.providerAdId,
                    creativeFormat: ad.creativeFormat,
                  });
                  const resolvedResultMetric = resolveAdResultMetric({
                    spend: ad.spend,
                    impressions: ad.impressions,
                    conversions: ad.results,
                    linkClicks: ad.linkClicks,
                    clicks: ad.allClicks,
                    objective: ad.campaignObjective,
                  });
                  const resultMetricValue = ad.resultMetricValue ?? resolvedResultMetric.value;
                  const resultMetricLabel = ad.resultMetricLabel || resolvedResultMetric.label;
                  const resultMetricCost = ad.resultMetricCostPerResult ?? resolvedResultMetric.costPerResult;
                  const resultMetricUnit = ad.resultMetricUnitLabel || resolvedResultMetric.unitLabel;

                  return (
                    <tr
                      key={ad.adId}
                      className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 cursor-pointer"
                      onClick={() => setActiveDetailAdId(ad.id)}
                    >
                      <td className="sticky left-0 z-10 max-w-[300px] bg-white px-4 py-3 text-left dark:bg-zinc-900">
                        <div className="min-w-0 text-left">
                          {identity.formatBadge && (
                            <span className="mb-1 inline-block rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                              {identity.formatBadge}
                            </span>
                          )}
                          <div className="truncate text-left text-[13px] font-semibold text-slate-900 dark:text-zinc-100" title={identity.title}>
                            {identity.title}
                          </div>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-zinc-400" title={identity.subtitle}>
                          <span className="font-mono">{identity.subtitle}</span>
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

                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono text-zinc-900 dark:text-zinc-100 font-semibold">
                        {ad.hasInsights ? formatAdCurrency(ad.spend) : <span className="font-sans text-xs font-normal text-zinc-400">Belum ada data</span>}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono">
                        {resultMetricValue !== null ? (
                          <>
                            <span className="block text-right font-semibold text-slate-900 dark:text-zinc-100">{formatNumber(resultMetricValue)}</span>
                            <span className="mt-0.5 block text-right font-sans text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                              {resultMetricLabel} · {resultMetricCost === null ? "Biaya belum tersedia" : `${formatAdCurrency(resultMetricCost)}/${resultMetricUnit}`}
                            </span>
                          </>
                        ) : (
                          <span className="block text-right font-sans text-[10px] font-normal text-zinc-400">Belum ada data</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono">
                        {ad.hasInsights ? <span className="block text-right">{formatNumber(ad.impressions)}</span> : <span className="block text-right font-sans text-[10px] font-normal text-zinc-400">Belum ada data</span>}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono">
                        {ad.linkCtr !== null ? (
                          <span className="block text-right font-semibold text-zinc-900 dark:text-zinc-100">{formatRate(ad.linkCtr)}</span>
                        ) : (
                          <span className="block text-right font-sans text-[10px] text-zinc-400">Belum ada data</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {ad.linkCpc !== null ? <span className="block text-right">{formatAdCurrency(ad.linkCpc)}</span> : <span className="block text-right font-sans text-[10px] text-zinc-400">Belum ada klik</span>}
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
        </div>
      )}

      {/* 7. Slide-out Ad Detail Drawer with Live Server /api/ads/[id] and AI Performance Analysis */}
      {selectedAd && (
        <AdDetailDrawer
          ad={selectedAd}
          currency={adAccount?.currency || kpis?.currency || ""}
          lastSyncedAt={apiData?.lastSyncedAt}
          dateRange={dateRange}
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
