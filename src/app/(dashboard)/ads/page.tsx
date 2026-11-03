"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { formatOptionalNumber } from "@/lib/ads/display";
import {
  formatSmartAdIdentity,
  localizeDeliveryLabel,
  localizeResultLabel,
  localizeResultUnitLabel,
  resolveAdResultMetric,
  translateMetaTerm,
} from "@/lib/ads/result-metric";
import { formatAccountMask, formatDisplayCurrency, syncFreshnessClass } from "@/lib/format/display-currency";

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

function MetricIcon({ accent = false, children }: { accent?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${accent ? "bg-indigo-500/15 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 shadow-[0_0_18px_var(--glow-strong)] dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/20" : "bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-200/70 dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/[0.06]"}`}>
      {children}
    </span>
  );
}

function MetricSpark({ data, accent = false }: { data: number[]; accent?: boolean }) {
  const points = data.length > 1 ? data : [data[0] ?? 0, data[0] ?? 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? 100 / (points.length - 1) : 100;
  const coords = points.map((value, index) => {
    const x = index * step;
    const y = 28 - ((value - min) / range) * 24 - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="mt-3 h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
        className={accent ? "text-[var(--chart-1)]" : "text-zinc-300 dark:text-zinc-600"}
      />
    </svg>
  );
}

const metricCardClass = "surface-card group rounded-2xl border border-zinc-200/90 bg-white p-4 transition duration-200 hover:border-indigo-300/70 hover:shadow-[0_10px_28px_-12px_rgba(24,24,27,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-400/25 dark:hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]";
const metricLabelClass = "text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400";
const metricValueClass = "mt-2 text-[1.5rem] sm:text-[1.65rem] font-semibold leading-none tracking-[-0.02em] text-zinc-950 tabular-nums dark:text-zinc-50";
const metricHintClass = "mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400";

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
  const { formatNumber, locale, dict } = useI18n();
  const uiLocale: "id" | "en" = locale === "en" ? "en" : "id";
  const copy = dict.adsWorkspace;
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
  const [diagnosticTab, setDiagnosticTab] = useState<"funnel" | "delivery">("funnel");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"inventory" | "trends" | "analyst">("inventory");
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
          addToast(
            "warning",
            locale === "id" ? "Sinkronisasi Berhasil dengan Catatan" : "Sync Succeeded with Warnings",
            syncWarnings.join(" ")
          );
        } else if (!silent) {
          addToast(
            "success",
            locale === "id" ? "Sinkronisasi Berhasil" : "Sync Successful",
            locale === "id"
              ? `Meta Ads sinkron: ${count} record berhasil diproses dan disimpan ke basis data.`
              : `Meta Ads synced: ${count} records processed and saved to the database.`
          );
        }
        if (!liveAccountInsight || !fullAccountScope) await fetchAds({ silent: true });
      } else if (res.ok && data.status === "partial") {
        const insights = data.syncResult?.insightsSynced ?? 0;
        if (!silent) addToast(
          "warning",
          locale === "id" ? "Sinkronisasi Sebagian" : "Partial Sync",
          locale === "id"
            ? `Data akun diperbarui, tetapi sinkronisasi belum lengkap. Insights tersimpan: ${insights}. Coba lagi atau periksa detail koneksi Meta.`
            : `Account data updated, but sync is incomplete. Insights saved: ${insights}. Try again or check Meta connection details.`
        );
        if (!liveAccountInsight || !fullAccountScope) await fetchAds({ silent: true });
      } else {
        if (!silent) addToast(
          "error",
          locale === "id" ? "Sinkronisasi Gagal" : "Sync Failed",
          data.message || (locale === "id" ? "Gagal melakukan sinkronisasi Meta Marketing API." : "Failed to sync Meta Marketing API.")
        );
      }
    } catch (err) {
      if (!silent) addToast(
        "error",
        locale === "id" ? "Kesalahan Jaringan" : "Network Error",
        err instanceof Error ? err.message : "Network error"
      );
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, apiData, dateRange, selectedAdAccountId, selectedCampaignId, campaignStatusFilter, deliveryStatusFilter, objectiveFilter, fetchAds, addToast, locale]);

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
    (amount: number | null | undefined) =>
      formatDisplayCurrency(amount, adAccount?.currency || kpis?.currency || "IDR", locale === "en" ? "en" : "id"),
    [adAccount?.currency, kpis?.currency, locale]
  );

  const getLocalizedResultLabel = useCallback(
    (rawLabel?: string | null) => localizeResultLabel(rawLabel, uiLocale),
    [uiLocale]
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
    addToast(
      "info",
      locale === "id" ? "Filter Direset" : "Filters Reset",
      locale === "id"
        ? "Semua kriteria filter telah dikembalikan ke default."
        : "All filter criteria have been reset to default."
    );
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
  const linkCvrCaption = insightsAvailable && totalLinkClicks > 0 ? formatRate(clickConversionRate) : "—";
  const activeCampaignCount = kpis?.activeCampaigns ?? 0;
  const campaignHealthClass = activeCampaignCount > 0
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
  const dropdownFilterCount = [
    selectedCampaignId !== "all",
    deliveryStatusFilter !== "all",
    campaignStatusFilter !== "all",
    objectiveFilter !== "all",
  ].filter(Boolean).length;
  const filterButtonLabel = dropdownFilterCount > 0 ? `${copy.filter} (${dropdownFilterCount})` : copy.filter;
  const tableShellClass = totalPages > 1
    ? "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900"
    : "hidden overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 md:block";
  const averageResultsPerDay = displayedTotalResults / daysCount;
  const oneDecimal = (value: number) => new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
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

  const spendCaption = dateRangeContextText
    ? dateRangeContextText.replace(/^(Periode|Period)\s+/i, "")
    : (locale === "id" ? "Total pada periode ini" : "Total for this period");
  const resultUnitLabel = locale === "id"
    ? (kpis?.resultLabel || "Hasil")
    : getLocalizedResultLabel(kpis?.resultLabel);
  const resultCaption = displayedTotalResults > 0
    ? resultUnitLabel
    : (locale === "id" ? "Belum ada hasil" : "No results yet");

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
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-16">
      {/* 1. Header & Organization Reporting Context */}
      <div className="solar-header surface-card flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
            {copy.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(apiData?.availableAdAccounts?.length ?? 0) > 0 ? (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span>{copy.adAccount}:</span>
                <select
                  value={selectedAdAccountId || adAccount?.id || ""}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedAdAccountId(nextId);
                    setSelectedCampaignId("all");
                    setCurrentPage(1);
                    setActiveDetailAdId(null);
                    const accName = (apiData?.availableAdAccounts || []).find((acc) => acc.id === nextId)?.name || nextId;
                    addToast(
                      "info",
                      locale === "id" ? "Beralih Akun Iklan" : "Switched Ad Account",
                      locale === "id" ? `Memuat data untuk ${accName}` : `Loading data for ${accName}`
                    );
                  }}
                  className="max-w-[16rem] truncate rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 transition-colors hover:border-zinc-300 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-600 cursor-pointer"
                  aria-label={copy.selectAccount}
                >
                  {(apiData?.availableAdAccounts || []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.id} ({formatAccountMask(acc.id)})
                    </option>
                  ))}
                </select>
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${syncFreshnessClass(adAccount?.lastSyncedAt || apiData?.lastSyncedAt)}`} />
                  {copy.connected}{" "}
                  {formatRelativeSyncTime(adAccount?.lastSyncedAt || apiData?.lastSyncedAt, locale)}
                </span>
              </label>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                {copy.notConnected}
              </span>
            )}
            {adAccount && (
              <>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 ring-1 ring-inset ring-zinc-200/80 dark:ring-zinc-700/60">
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
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 dark:hover:bg-zinc-800 px-3.5 text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
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
            {copy.auditData}
          </button>

          {/* Sinkronkan Meta (Primary) */}
          <button
            type="button"
            onClick={() => handleTriggerSync()}
            disabled={isSyncing || !apiData?.canSync || !adAccount}
            className="btn-solar inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <svg
              className={`h-3.5 w-3.5 ${
                isSyncing ? "animate-spin" : "opacity-80"
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
              ? locale === "id" ? "Menyinkronkan..." : "Syncing..."
              : copy.syncMeta}
          </button>
        </div>
      </div>
      </div>

      {/* Fetch state: loading / error / stale (stored data, not live) */}
      {isLoading && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs animate-pulse">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
            </svg>
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {locale === "id" ? "Memuat dan menyinkronkan data performa iklan..." : "Loading and syncing ad performance data..."}
          </span>
          <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">
            · {locale === "id" ? "Mengambil snapshot metrik Meta Marketing API" : "Fetching Meta Marketing API snapshot"}
          </span>
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit max-w-full overflow-x-auto flex-nowrap gap-0.5 rounded-xl border border-zinc-200/80 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {[
            { id: "today", label: copy.today },
            { id: "7d", label: copy.days7 },
            { id: "14d", label: copy.days14 },
            { id: "30d", label: copy.days30 },
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
                aria-pressed={isActive}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-indigo-400/20 dark:shadow-[0_0_0_1px_rgba(245,184,46,0.08),0_2px_8px_-2px_rgba(0,0,0,0.4)]"
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
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${dateRange.includes(":") || showCustomDateRange
              ? "bg-white text-indigo-700 shadow-xs ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-indigo-300 dark:ring-indigo-400/20"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
          >
            {copy.custom}
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
              addToast(
                "info",
                locale === "id" ? "Filter Periode Diterapkan" : "Date Filter Applied",
                `${customDateStart} ${locale === "id" ? "s/d" : "to"} ${customDateEnd}`
              );
            }}
            className="surface-card flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end"
          >
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{locale === "id" ? "Mulai" : "Start"}</span>
              <input type="date" required value={customDateStart} max={customDateEnd || undefined} onChange={(event) => setCustomDateStart(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{locale === "id" ? "Sampai" : "End"}</span>
              <input type="date" required value={customDateEnd} min={customDateStart || undefined} onChange={(event) => setCustomDateEnd(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" />
            </label>
            <button type="submit" disabled={!customDateStart || !customDateEnd || customDateStart > customDateEnd} className="btn-solar rounded-lg px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
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

      {/* Workspace Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-0 overflow-x-auto no-scrollbar" role="tablist" aria-label={locale === "id" ? "Navigasi Workspace Iklan" : "Ads Workspace Navigation"}>
        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspaceTab === "inventory"}
          onClick={() => setActiveWorkspaceTab("inventory")}
          className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeWorkspaceTab === "inventory"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {copy.tabInventory}
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
            {processedAds.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspaceTab === "trends"}
          onClick={() => setActiveWorkspaceTab("trends")}
          className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeWorkspaceTab === "trends"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {copy.tabTrends}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspaceTab === "analyst"}
          onClick={() => setActiveWorkspaceTab("analyst")}
          className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeWorkspaceTab === "analyst"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {copy.tabAnalyst}
          <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 text-[9px] font-bold tracking-wider">
            AI
          </span>
        </button>
      </div>

      {/* TAB 1: Inventaris & Performa Iklan */}
      {activeWorkspaceTab === "inventory" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Contextual Notice Bar (Consolidating the 5 alert banners into a single bar) */}
          {!isLoading && (() => {
            if (apiData?.insightsState === "no_account_selected") {
              return (
                <div role="status" className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{copy.noticeNoAccount}</span>
                </div>
              );
            }
            if (apiData?.insightsState === "no_data_for_period") {
              return (
                <div role="status" className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{copy.noticeNoData}</span>
                </div>
              );
            }
            if (apiData?.accountMetricsState === "range_not_supported") {
              return (
                <div role="status" className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
                  <svg className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{copy.noticeRangeNotSupported}</span>
                </div>
              );
            }
            if (apiData?.accountMetricsState === "filtered_scope") {
              return (
                <div role="status" className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
                  <svg className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{copy.noticeFilteredScope}</span>
                </div>
              );
            }
            if (apiData?.accountMetricsState === "source_unavailable") {
              return (
                <div role="status" className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{copy.noticeSourceUnavailable}</span>
                </div>
              );
            }
            return null;
          })()}

          {/* KPI Scope Caption & Unique Reach Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <p>
              {locale === "id"
                ? "KPI di bawah merupakan agregat akun iklan terpilih, pada periode terpilih (total akun sebelum filter)."
                : "The KPIs below represent the aggregate of the selected ad account for the selected period (total account before filters)."}
            </p>
            <div
              className="inline-flex items-center gap-1.5"
              title={
                locale === "id"
                  ? "Jumlah akun unik yang dijangkau. Untuk periode lebih dari satu hari, nilai tidak ditampilkan karena data harian tidak dapat dijumlahkan untuk memperoleh jangkauan unik periode tersebut."
                  : "Unique accounts reached. For multi-day periods, value is not shown because daily reach cannot be summed."
              }
            >
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {locale === "id" ? "Jangkauan" : "Reach"}:
              </span>
              <span className="font-mono font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                {formatOptionalNumber(kpis?.totalReach, formatNumber)}
              </span>
              {kpis?.frequency != null && (
                <span className="text-zinc-400">
                  ({kpis.frequency.toFixed(2)}x)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={metricCardClass}>
          <MetricIcon accent>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M12 3v18M16.5 7.5c0-1.5-1.8-3-4.5-3S7.5 6 7.5 7.5 9.3 10.5 12 10.5s4.5 1.5 4.5 3-1.8 3-4.5 3-4.5-1.5-4.5-3" /></svg>
          </MetricIcon>
          <div className={`mt-3 ${metricLabelClass}`}>{copy.spend}</div>
          <div className={metricValueClass}>
            {isLoading ? (
              <div className="my-1 h-7 w-28 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 animate-pulse" />
            ) : insightsAvailable ? (
              formatAdCurrency(kpis?.totalSpend)
            ) : (
              "—"
            )}
          </div>
          <div className={metricHintClass}>
            {isLoading ? (
              <div className="h-3.5 w-36 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ) : (
              spendCaption
            )}
          </div>
          <MetricSpark data={dailyTrend.map((point) => point.spend)} accent />
        </div>
        <div className={metricCardClass}>
          <MetricIcon>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4 19c.4-2.4 2.2-4 4.5-4s4.1 1.6 4.5 4m2-6c2 .4 3.4 1.8 3.8 4" /></svg>
          </MetricIcon>
          <div className={`mt-3 ${metricLabelClass}`}>{copy.conversionResults}</div>
          <div className={metricValueClass}>
            {isLoading ? (
              <div className="my-1 h-7 w-20 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 animate-pulse" />
            ) : (
              formatNumber(displayedTotalResults)
            )}
          </div>
          <div className={`${metricHintClass} line-clamp-1`} title={resultCaption}>
            {isLoading ? (
              <div className="h-3.5 w-32 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ) : (
              resultCaption
            )}
          </div>
          <MetricSpark data={dailyTrend.map((point) => point.results ?? point.conversations ?? 0)} accent />
        </div>
        <div className={metricCardClass}>
          <MetricIcon>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M5 19 19 5M9 5h10v10" /></svg>
          </MetricIcon>
          <div className={`mt-3 ${metricLabelClass}`}>{copy.costPerResult}</div>
          <div className={metricValueClass}>
            {isLoading ? (
              <div className="my-1 h-7 w-28 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 animate-pulse" />
            ) : displayedCostPerResult !== null ? (
              formatAdCurrency(displayedCostPerResult)
            ) : (
              "—"
            )}
          </div>
          <div className={metricHintClass}>
            {isLoading ? (
              <div className="h-3.5 w-28 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ) : (
              copy.avgCostPerResult
            )}
          </div>
          <MetricSpark data={dailyTrend.map((point) => { const results = point.results ?? point.conversations ?? 0; return results > 0 ? point.spend / results : 0; })} />
        </div>
        <div className={metricCardClass}>
          <MetricIcon>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M4 15.5 9 10l3.5 3.5L20 6" /></svg>
          </MetricIcon>
          <div className={`mt-3 ${metricLabelClass}`}>{copy.linkCtr}</div>
          <div className={metricValueClass}>
            {isLoading ? (
              <div className="my-1 h-7 w-20 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 animate-pulse" />
            ) : insightsAvailable ? (
              formatRate(kpis?.linkCtr)
            ) : (
              "—"
            )}
          </div>
          <div className={metricHintClass}>
            {isLoading ? (
              <div className="h-3.5 w-36 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ) : (
              `${formatNumber(totalLinkClicks)} ${locale === "id" ? "klik tautan" : "link clicks"} · CVR ${linkCvrCaption}`
            )}
          </div>
          <MetricSpark data={dailyTrend.map((point) => point.impressions > 0 ? (point.linkClicks / point.impressions) * 100 : 0)} />
        </div>
      </div>

      <div className="surface-card grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-white px-4 py-3.5 transition-colors hover:bg-zinc-50/70 dark:bg-zinc-900 dark:hover:bg-zinc-900/80">
          <div className={metricLabelClass}>{copy.impressions}</div>
          <div className="mt-1.5 text-[15px] font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            {isLoading ? <div className="h-5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" /> : insightsAvailable ? formatNumber(totalImpressions) : "—"}
          </div>
          <div className={metricHintClass}>{locale === "id" ? "Rata-rata" : "Average"} {formatNumber(Math.round(totalImpressions / daysCount))} / {locale === "id" ? "hari" : "day"}</div>
        </div>
        <div className="bg-white px-4 py-3.5 transition-colors hover:bg-zinc-50/70 dark:bg-zinc-900 dark:hover:bg-zinc-900/80">
          <div className={metricLabelClass}>CPM</div>
          <div className="mt-1.5 text-[15px] font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            {isLoading ? <div className="h-5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" /> : insightsAvailable && totalImpressions > 0 && kpis?.cpm != null ? formatAdCurrency(kpis.cpm) : "—"}
          </div>
          <div className={metricHintClass}>{locale === "id" ? "Biaya / 1.000 tayangan" : "Cost / 1,000 impressions"}</div>
        </div>
        <div className="bg-white px-4 py-3.5 transition-colors hover:bg-zinc-50/70 dark:bg-zinc-900 dark:hover:bg-zinc-900/80">
          <div className={metricLabelClass}>{copy.allClicks}</div>
          <div className="mt-1.5 text-[15px] font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            {isLoading ? <div className="h-5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" /> : insightsAvailable ? formatNumber(totalAllClicks) : "—"}
          </div>
          <div className={`${metricHintClass} truncate`}>CTR {insightsAvailable && totalImpressions > 0 ? formatRate(kpis?.allCtr) : "—"} · CPC {insightsAvailable && totalAllClicks > 0 && kpis?.allCpc != null ? formatAdCurrency(kpis.allCpc) : "—"}</div>
        </div>
        <div className="bg-white px-4 py-3.5 transition-colors hover:bg-zinc-50/70 dark:bg-zinc-900 dark:hover:bg-zinc-900/80">
          <div className={metricLabelClass}>{copy.linkIntent}</div>
          <div className="mt-1.5 text-[15px] font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            {isLoading ? <div className="h-5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" /> : insightsAvailable && totalAllClicks > 0 ? formatRate(intentClickRate) : "—"}
          </div>
          <div className={`${metricHintClass} truncate`}>{formatNumber(totalLinkClicks)} {locale === "id" ? "tautan dari" : "link clicks of"} {formatNumber(totalAllClicks)} {locale === "id" ? "klik" : "clicks"}</div>
        </div>
        <div className="bg-white px-4 py-3.5 transition-colors hover:bg-zinc-50/70 dark:bg-zinc-900 dark:hover:bg-zinc-900/80">
          <div className={metricLabelClass}>{copy.linkCpc}</div>
          <div className="mt-1.5 text-[15px] font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            {isLoading ? <div className="h-5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" /> : insightsAvailable && totalLinkClicks > 0 && kpis?.linkCpc != null ? formatAdCurrency(kpis.linkCpc) : "—"}
          </div>
          <div className={metricHintClass}>{locale === "id" ? "Rata-rata" : "Average"} {formatNumber(Math.round(totalLinkClicks / daysCount))} {locale === "id" ? "klik / hari" : "clicks / day"}</div>
        </div>
        <div className="bg-white px-4 py-3.5 transition-colors hover:bg-zinc-50/70 dark:bg-zinc-900 dark:hover:bg-zinc-900/80">
          <div className={metricLabelClass}>{copy.cvr}</div>
          <div className="mt-1.5 text-[15px] font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
            {isLoading ? <div className="h-5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" /> : insightsAvailable && totalLinkClicks > 0 ? formatRate(clickConversionRate) : "—"}
          </div>
          <div className={metricHintClass}>{locale === "id" ? "Rata-rata" : "Average"} {oneDecimal(averageResultsPerDay)} {locale === "id" ? "hasil / hari" : "results / day"}</div>
        </div>
      </div>

      {/* Filter Toolbar yang Terletak Tepat di Atas Tabel Iklan */}
      <section
        aria-label={locale === "id" ? "Filter dan Kontrol Tabel Iklan" : "Ad Table Filters and Controls"}
        className="space-y-2.5 static xl:sticky xl:top-14 xl:z-20 bg-transparent py-1"
      >
        <div className="glass-surface rounded-xl border p-3.5 shadow-[var(--shadow-card)] space-y-3">
          {/* Top Row: Search Input + Prioritized Filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1">
              <label htmlFor="search-input" className="sr-only">
                {copy.searchLabel}
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
                placeholder={copy.searchPlaceholder}
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
                  title={copy.resetAll}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 md:hidden dark:border-zinc-700 dark:text-zinc-200"
              onClick={() => setMobileFiltersOpen(true)}
            >
              {filterButtonLabel}
            </button>
            </div>

            {mobileFiltersOpen && (
              <button type="button" className="fixed inset-0 z-40 bg-zinc-950/40 md:hidden" aria-label={copy.closeFilters} onClick={() => setMobileFiltersOpen(false)} />
            )}
            <div className={`${mobileFiltersOpen ? "fixed inset-x-0 bottom-0 z-50 max-h-[80vh] space-y-3 overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" : "hidden"} md:static md:z-auto md:flex md:flex-wrap md:items-center md:gap-2.5 md:space-y-0 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none flex-1`}>
              {mobileFiltersOpen && (
                <div className="flex items-center justify-between md:hidden">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.filter}</p>
                  <button type="button" onClick={() => setMobileFiltersOpen(false)} className="text-xs font-semibold text-indigo-600">{copy.applyFilters}</button>
                </div>
              )}
              {/* 1. Campaign Searchable Dropdown */}
              <div className="w-full md:w-auto md:flex-1 md:min-w-[170px]">
                <CampaignSearchableDropdown
                  campaigns={campaigns}
                  selectedCampaignId={selectedCampaignId}
                  className="w-full min-w-0"
                  onSelectCampaign={(id) => {
                    setSelectedCampaignId(id);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* 2. Status Penayangan (Delivery) */}
              <div className="relative w-full md:w-auto md:flex-1 md:min-w-[170px]">
                <label className="sr-only" htmlFor="delivery-status-filter">
                  {copy.deliveryFilter}
                </label>
                <select
                  id="delivery-status-filter"
                  value={deliveryStatusFilter}
                  onChange={(e) => {
                    setDeliveryStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  title={copy.deliveryFilter}
                  className={`w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors truncate ${
                    deliveryStatusFilter !== "all"
                      ? "border-indigo-300 bg-indigo-50/70 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <option value="all">{copy.allDelivery}</option>
                  <option value="DELIVERING">{copy.delivering}</option>
                  <option value="NOT_DELIVERING">{copy.notDelivering}</option>
                  <option value="CAMPAIGN_PAUSED">{copy.campaignPaused}</option>
                  <option value="AD_PAUSED">{copy.adPaused}</option>
                  <option value="ARCHIVED">{copy.archived}</option>
                  <option value="DELETED">{copy.deleted}</option>
                  <option value="UNKNOWN">{copy.unknown}</option>
                </select>
              </div>

              {/* 3. Status Campaign Induk */}
              <div className="relative w-full md:w-auto md:flex-1 md:min-w-[170px]">
                <label className="sr-only" htmlFor="campaign-status-filter">
                  {copy.parentFilter}
                </label>
                <select
                  id="campaign-status-filter"
                  value={campaignStatusFilter}
                  onChange={(e) => {
                    setCampaignStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  title={copy.parentFilter}
                  className={`w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors truncate ${
                    campaignStatusFilter !== "all"
                      ? "border-indigo-300 bg-indigo-50/70 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <option value="all">{copy.allParent}</option>
                  <option value="ACTIVE">{copy.parentActive}</option>
                  <option value="PAUSED">{copy.parentPaused}</option>
                  <option value="ARCHIVED">{copy.parentArchived}</option>
                  <option value="DELETED">{copy.parentDeleted}</option>
                  <option value="UNKNOWN">{copy.parentUnknown}</option>
                </select>
              </div>

              {/* 4. Objective */}
              <div className="relative w-full md:w-auto md:flex-1 md:min-w-[170px]">
                <label className="sr-only" htmlFor="objective-filter">
                  {copy.objective}
                </label>
                <select
                  id="objective-filter"
                  value={objectiveFilter}
                  onChange={(e) => {
                    setObjectiveFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  title={copy.objective}
                  className={`w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-medium shadow-2xs cursor-pointer select-none transition-colors truncate ${
                    objectiveFilter !== "all"
                      ? "border-indigo-300 bg-indigo-50/70 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <option value="all">{copy.allObjectives}</option>
                  {[
                    ...new Set(
                      campaigns
                        .map((c) => c.objective)
                        .filter((obj): obj is string => Boolean(obj))
                    ),
                  ].map((obj) => (
                    <option key={obj} value={obj}>
                      {translateMetaTerm(obj, uiLocale)}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Secondary Row: Active Filter Chips & Accurate Count Summary */}
          <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            {/* Active Filter Chips */}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-zinc-400">{copy.activeFilters}:</span>
              {!hasActiveFilters && dateRange === "30d" ? (
                <span className="text-[11px] text-zinc-400 italic">
                  {locale === "id"
                    ? `Semua filter default (30 hari terakhir${dateRangeContextText ? ` · ${dateRangeContextText.replace(/^(Periode|Period)\s+/i, "")}` : ""} · belanja > 0)`
                    : `All default filters (Last 30 days${dateRangeContextText ? ` · ${dateRangeContextText.replace(/^(Periode|Period)\s+/i, "")}` : ""} · spend > 0)`}
                </span>
              ) : (
                <>
                  {!showOnlyWithSpend && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {copy.allSpendShown}
                    </span>
                  )}
                  {deliveryStatusFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                      <span>{copy.deliveryFilterLabel}: {deliveryStatusFilter}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryStatusFilter("all");
                          setCurrentPage(1);
                        }}
                        className="hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                        title={copy.resetAll}
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {campaignStatusFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                      <span>{copy.parentFilterLabel}: {campaignStatusFilter}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCampaignStatusFilter("all");
                          setCurrentPage(1);
                        }}
                        className="hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                        title={copy.resetAll}
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {objectiveFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                      <span>{translateMetaTerm(objectiveFilter, uiLocale)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setObjectiveFilter("all");
                          setCurrentPage(1);
                        }}
                        className="hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                        title={copy.resetAll}
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {searchQuery.trim() && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 max-w-[180px]">
                      <span className="truncate">{copy.searchFilterLabel}: &ldquo;{searchQuery}&rdquo;</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        title={copy.resetAll}
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
                        className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        title={copy.resetTo30Days}
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
                    {copy.resetAll}
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
                aria-label={copy.spendOnly}
              />
              <span aria-hidden="true" className={`relative h-4 w-7 rounded-full transition-colors ${showOnlyWithSpend ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${showOnlyWithSpend ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </span>
              <span>{copy.spendOnly}</span>
            </label>

            {/* Filtered Count Indicator */}
            <div className="shrink-0 whitespace-nowrap text-left text-[11px] font-medium text-zinc-500 dark:text-zinc-400 lg:text-right">
              {copy.showing}{" "}
              <strong className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {processedAds.length}
              </strong>{" "}
              {copy.of}{" "}
              <span className="font-mono">{rawAds?.length ?? 0}</span> {copy.ofAds}
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Detailed Ad Performance Table with Explicit Separation of Campaign Status & Delivery Status */}
      {isLoading ? (
        <div className="space-y-4">
          {/* Mobile Loading Card Skeletons */}
          <div className="space-y-3 md:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 animate-pulse space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/50">
                  <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Loading Table Skeleton */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs">
                <thead className="bg-zinc-50/90 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-900/90 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th scope="col" className="sticky left-0 z-20 bg-zinc-50 px-4 py-3.5 text-left font-semibold dark:bg-zinc-900">{copy.adAndCampaign}</th>
                    <th scope="col" className="px-4 py-3.5 text-left font-semibold">{copy.deliveryStatus}</th>
                    <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">{copy.totalSpend}</th>
                    <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">{copy.resultsAndCpr}</th>
                    <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">{copy.impressionsCol}</th>
                    <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">{copy.ctrCol}</th>
                    <th scope="col" className="text-right tabular-nums px-4 py-3.5 font-semibold">{copy.cpcCol}</th>
                    <th scope="col" className="sticky right-0 z-20 bg-zinc-50 px-4 py-3 text-right font-semibold dark:bg-zinc-900">{copy.actions}</th>
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
        </div>
      ) : processedAds.length === 0 ? (
        <EmptyState
          title={hasActiveFilters || (showOnlyWithSpend && (rawAds?.length ?? 0) > 0) ? copy.noAdsMatch : copy.noAdsYet}
          description={
            showOnlyWithSpend && (rawAds?.length ?? 0) > 0 && processedAds.length === 0
              ? locale === "id"
                ? "Tidak ada iklan dengan belanja pada periode ini. Matikan toggle untuk melihat seluruh inventaris iklan."
                : "No ads with spend in this period. Turn off the spend-only toggle to see all ads."
              : hasActiveFilters
              ? locale === "id"
                ? "Coba sesuaikan kata kunci pencarian, status delivery, atau rentang tanggal pelaporan."
                : "Try adjusting search keywords, delivery status, or the reported date range."
              : locale === "id"
                ? "Sinkronkan akun Meta Ads Anda untuk memuat kampanye dan performa iklan properti."
                : "Sync your Meta Ads account to load campaigns and property ad performance."
          }
          onReset={resetAllFilters}
        />
      ) : (<>
        <div className="space-y-3 md:hidden">
          {paginatedAds.map((ad) => {
            const identity = formatSmartAdIdentity(
              {
                adName: ad.adName,
                adSetName: ad.adsetName,
                campaignName: ad.campaignName,
                providerAdId: ad.providerAdId,
                creativeFormat: ad.creativeFormat,
              },
              uiLocale
            );
            const resolved = resolveAdResultMetric(
              {
                spend: ad.spend,
                impressions: ad.impressions,
                conversions: ad.results,
                linkClicks: ad.linkClicks,
                clicks: ad.allClicks,
                objective: ad.campaignObjective,
              },
              uiLocale
            );
            const resultValue = ad.resultMetricValue ?? resolved.value;
            const resultCost = ad.resultMetricCostPerResult ?? resolved.costPerResult;
            return (
              <button
                key={ad.adId}
                type="button"
                onClick={() => setActiveDetailAdId(ad.id)}
                className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-2xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={identity.title}>{identity.title}</p>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{localizeDeliveryLabel(ad.deliveryLabel, uiLocale)}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500" title={ad.campaignName}>{ad.campaignName}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-2.5 text-xs dark:bg-zinc-800/50">
                  <div><p className="text-[10px] text-zinc-500">{copy.totalSpend}</p><p className="font-mono font-semibold tabular-nums">{ad.hasInsights ? formatAdCurrency(ad.spend) : "—"}</p></div>
                  <div><p className="text-[10px] text-zinc-500">{copy.conversionResults}</p><p className="font-mono font-semibold tabular-nums">{resultValue ?? "—"}</p></div>
                  <div><p className="text-[10px] text-zinc-500">{copy.costPerResult}</p><p className="font-mono font-semibold tabular-nums">{resultCost === null ? "—" : formatAdCurrency(resultCost)}</p></div>
                  <div><p className="text-[10px] text-zinc-500">{copy.ctrCol} · {copy.cpcCol}</p><p className="font-mono font-semibold tabular-nums">{ad.linkCtr !== null ? formatRate(ad.linkCtr) : "—"} · {ad.linkCpc !== null ? formatAdCurrency(ad.linkCpc) : "—"}</p></div>
                </div>
              </button>
            );
          })}
        </div>
        <div className={tableShellClass}>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="bg-zinc-50/90 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-900/90 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th scope="col" className="px-4 py-3.5 text-left font-semibold">
                    {copy.adAndCampaign}
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-left font-semibold">
                    {copy.deliveryStatus}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("spend")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    {copy.totalSpend} {sortBy === "spend" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("results")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    {copy.resultsAndCpr} {sortBy === "results" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("impressions")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    {copy.impressionsCol} {sortBy === "impressions" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("linkCtr")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    {copy.ctrCol} {sortBy === "linkCtr" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleHeaderSort("linkCpc")}
                    className="text-right tabular-nums px-4 py-3.5 font-semibold cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    {copy.cpcCol} {sortBy === "linkCpc" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    {copy.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800 dark:divide-zinc-800 dark:text-zinc-200">
                {paginatedAds.map((ad) => {
                  const isDelivering = ad.deliveryStatus === "DELIVERING";
                  const identity = formatSmartAdIdentity(
                    {
                      adName: ad.adName,
                      adSetName: ad.adsetName,
                      campaignName: ad.campaignName,
                      providerAdId: ad.providerAdId,
                      creativeFormat: ad.creativeFormat,
                    },
                    uiLocale
                  );
                  const resolvedResultMetric = resolveAdResultMetric(
                    {
                      spend: ad.spend,
                      impressions: ad.impressions,
                      conversions: ad.results,
                      linkClicks: ad.linkClicks,
                      clicks: ad.allClicks,
                      objective: ad.campaignObjective,
                    },
                    uiLocale
                  );
                  const resultMetricValue = ad.resultMetricValue ?? resolvedResultMetric.value;
                  const resultMetricLabel = localizeResultLabel(ad.resultMetricLabel || resolvedResultMetric.label, uiLocale);
                  const resultMetricCost = ad.resultMetricCostPerResult ?? resolvedResultMetric.costPerResult;
                  const resultMetricUnit = localizeResultUnitLabel(ad.resultMetricUnitLabel || resolvedResultMetric.unitLabel, uiLocale);

                  return (
                    <tr
                      key={ad.adId}
                      tabIndex={0}
                      role="button"
                      className="cursor-pointer transition-colors hover:bg-zinc-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-zinc-800/40"
                      onClick={() => setActiveDetailAdId(ad.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveDetailAdId(ad.id);
                        }
                      }}
                    >
                      <td className="sticky left-0 z-10 max-w-[300px] bg-white px-4 py-3 text-left dark:bg-zinc-900">
                        <div className="min-w-0 text-left">
                          {identity.formatBadge && (
                            <span className="mb-1 inline-block rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                              {identity.formatBadge}
                            </span>
                          )}
                          <div className="line-clamp-1 text-left text-[13px] font-semibold text-slate-900 dark:text-zinc-100" title={identity.title}>
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
                            {localizeDeliveryLabel(ad.deliveryLabel, uiLocale)}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono text-zinc-900 dark:text-zinc-100 font-semibold">
                        {ad.hasInsights ? formatAdCurrency(ad.spend) : <span className="font-sans text-xs font-normal text-zinc-400">{copy.noData}</span>}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono">
                        {resultMetricValue !== null ? (
                          <>
                            <span className="block text-right font-semibold text-slate-900 dark:text-zinc-100">{formatNumber(resultMetricValue)}</span>
                            <span className="mt-0.5 block text-right font-sans text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                              {resultMetricLabel} · {resultMetricCost === null ? copy.costUnavailable : `${formatAdCurrency(resultMetricCost)}/${resultMetricUnit}`}
                            </span>
                          </>
                        ) : (
                          <span className="block text-right font-sans text-[10px] font-normal text-zinc-400">{copy.noData}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono">
                        {ad.hasInsights ? <span className="block text-right">{formatNumber(ad.impressions)}</span> : <span className="block text-right font-sans text-[10px] font-normal text-zinc-400">{copy.noData}</span>}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono">
                        {ad.linkCtr !== null ? (
                          <span className="block text-right font-semibold text-zinc-900 dark:text-zinc-100">{formatRate(ad.linkCtr)}</span>
                        ) : (
                          <span className="block text-right font-sans text-[10px] text-zinc-400">{copy.noData}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums px-4 py-3.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {ad.linkCpc !== null ? <span className="block text-right">{formatAdCurrency(ad.linkCpc)}</span> : <span className="block text-right font-sans text-[10px] text-zinc-400">{copy.noClicksYet}</span>}
                      </td>
                      <td className="sticky right-0 z-10 bg-white px-4 py-3 text-right dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveDetailAdId(ad.id);
                          }}
                          aria-label={`${copy.detail} ${ad.adName}`}
                          title={locale === "id" ? "Buka detail iklan & analisis AI" : "Open ad details & AI analysis"}
                          className="inline-flex h-8 items-center gap-1.5 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                        >
                          <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>{copy.detail}</span>
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
                {Math.min(safeCurrentPage * ITEMS_PER_PAGE, processedAds.length)} {copy.of} {processedAds.length} {copy.ofAds}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {copy.previous}
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
                  {copy.next}
                </button>
              </div>
            </div>
          )}
        </div>
      </>)}
      </div>
      )}

      {/* TAB 2: Tren & Funnel CTWA */}
      {activeWorkspaceTab === "trends" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <PerformanceTrendChart
            dailyTrend={apiData?.dailyTrend || []}
            currency={adAccount?.currency || kpis?.currency || "IDR"}
            timezone={adAccount?.timezone || "UTC"}
            conversationDataAvailable={!kpis?.conversationDataIncomplete}
            resultLabel={kpis?.resultLabel || copy.conversionResults}
          />
          <div className="surface-card overflow-hidden rounded-2xl border border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200/70 px-3 py-2 dark:border-zinc-800" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={diagnosticTab === "funnel"}
                onClick={() => setDiagnosticTab("funnel")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  diagnosticTab === "funnel"
                    ? "bg-indigo-500/12 text-zinc-900 ring-1 ring-inset ring-indigo-500/30 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/25"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {copy.funnelTab}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={diagnosticTab === "delivery"}
                onClick={() => setDiagnosticTab("delivery")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  diagnosticTab === "delivery"
                    ? "bg-indigo-500/12 text-zinc-900 ring-1 ring-inset ring-indigo-500/30 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/25"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {copy.deliveryTab}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${campaignHealthClass}`}>
                  {activeCampaignCount}/{kpis?.totalCampaigns ?? 0}
                </span>
              </button>
            </div>
            {diagnosticTab === "funnel" ? (
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
            ) : (
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
                className="border-0 shadow-none"
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AI Performance Analyst */}
      {activeWorkspaceTab === "analyst" && (
        <div className="space-y-4 animate-in fade-in duration-150">
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
