"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";
import { CampaignSearchableDropdown } from "@/components/dashboard/CampaignSearchableDropdown";
import { FetchGuard } from "@/lib/ads/fetch-guard";
import { formatDateInTimezone, parseDateRange } from "@/lib/ads/date-utils";
import { formatOptionalNumber } from "@/lib/ads/display";
import { matchesInventoryFilters } from "@/lib/ads/inventory-filters";
import type { RealAdRow } from "@/lib/ads/ad-row";
import {
  localizeDeliveryLabel,
  localizeResultLabel,
  localizeResultUnitLabel,
  objectiveFilterKey,
  objectiveFilterLabel,
} from "@/lib/ads/result-metric";
import { formatAccountMask, formatDisplayCurrency, syncFreshnessClass } from "@/lib/format/display-currency";
import { PremiumKPICard, SecondaryMetricsTicker } from "@/components/ads/PremiumKPICard";
import { PremiumAdsTable, type PremiumAdRow } from "@/components/ads/PremiumAdsTable";
import { AdsDashboardLayout } from "@/components/ads/AdsDashboardLayout";

const DeliveryDiagnosticsPanel = dynamic(
  () => import("@/components/dashboard/DeliveryDiagnosticsPanel").then((mod) => mod.DeliveryDiagnosticsPanel),
  { loading: () => null }
);
const AdDetailDrawer = dynamic(
  () => import("@/components/dashboard/AdDetailDrawer").then((mod) => mod.AdDetailDrawer),
  { loading: () => null }
);
const AIAdsPerformanceAnalyst = dynamic(
  () => import("@/components/dashboard/AIAdsPerformanceAnalyst").then((mod) => mod.AIAdsPerformanceAnalyst),
  { loading: () => null }
);
const TrendsAndFunnelTab = dynamic(
  () => import("@/components/ads/TrendsAndFunnelTab").then((mod) => mod.TrendsAndFunnelTab),
  { loading: () => null }
);

export type { RealAdRow };

export interface AdsIntelligenceApiResponse {
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
      currency: string | null;
      status: string;
      timezone?: string | null;
      lastSyncedAt?: string | null;
    } | null;
    availableAdAccounts?: Array<{
      id: string;
      name: string | null;
      status: string;
      currency?: string | null;
      timezone?: string | null;
      lastSyncedAt?: string | null;
      isSelected?: boolean;
    }>;
    lastSyncedAt: string | null;
    kpis: {
      totalSpend: number | null;
      totalResults: number | null;
      totalConversations: number | null;
      conversationDataIncomplete: boolean;
      resultLabel?: string;
      resultTypeDescription?: string | null;
      resultBreakdown?: Array<{ type: string; label: string; category: string; count: number; costPerResult: number | null }>;
      costPerResult: number | null;
      totalReach: number | null;
      totalImpressions: number | null;
      frequency: number | null;
      linkClicks: number | null;
      linkCtr: number | null;
      linkCpc: number | null;
      allClicks: number | null;
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
      spend: number | null;
      impressions: number | null;
      reach: number | null;
      linkClicks: number | null;
      allClicks?: number | null;
      results: number | null;
      conversations?: number | null;
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

const ADS_PAGE_DICT = {
  id: {
    title: "Performa Iklan",
    subtitle: "Pemantauan kampanye real-time, atribusi konversi, dan efisiensi biaya Meta Ads.",
    adAccount: "Akun Iklan",
    selectAccount: "Pilih akun iklan",
    connected: "Terhubung · Sinkron otomatis",
    notConnected: "Belum ada akun iklan terhubung. Hubungkan Meta di Pengaturan.",
    syncMeta: "Sinkronkan Meta",
    syncing: "Menyinkronkan...",
    today: "Hari Ini",
    days7: "7 Hari",
    days14: "14 Hari",
    days30: "30 Hari",
    custom: "Kustom",
    startDate: "Mulai",
    endDate: "Sampai",
    applyRange: "Terapkan Periode",
    cancel: "Batal",
    activeRange: "Rentang aktif:",
    invalidDateRange: "Tanggal mulai harus sebelum atau sama dengan tanggal akhir.",
    dateFilterAppliedTitle: "Filter Periode Diterapkan",
    dateRangeConnector: "s/d",
    switchedAccountTitle: "Beralih Akun Iklan",
    switchedAccountDesc: (name: string) => `Memuat data untuk ${name}`,
    filtersResetTitle: "Filter Direset",
    filtersResetDesc: "Semua kriteria filter telah dikembalikan ke pengaturan awal.",
    loadFailedError: (err: string) => `Gagal memuat data. ${err} Data akun sebelumnya tidak ditampilkan sebagai data akun ini.`,
    retry: "Coba Lagi",
    workspaceNavAria: "Navigasi Workspace Iklan",
    tabInventory: "Inventaris & Performa Iklan",
    tabTrends: "Tren & Funnel CTWA",
    tabAnalyst: "Audit Performa Akun",
    funnelTab: "Funnel Konversi",
    deliveryTab: "Kesehatan Penayangan",
    scopeCaption: "KPI di bawah merupakan agregat akun iklan terpilih, pada periode terpilih (total akun sebelum filter tabel).",
    reachLabel: "Jangkauan",
    reachTooltip: "Jumlah akun unik yang dijangkau. Untuk periode lebih dari satu hari, nilai tidak ditampilkan karena data harian tidak dapat dijumlahkan untuk memperoleh jangkauan unik periode tersebut.",
    periodPrefix: "Periode",
    spend: "Total Belanja",
    spendDefaultHint: "Total belanja pada periode terpilih",
    conversionResults: "Hasil Konversi",
    noResultsYet: "Belum ada hasil pada periode ini",
    costPerResult: "Biaya per Hasil",
    avgCostPerResult: "Rata-rata biaya per hasil konversi",
    linkCtr: "CTR Tautan",
    linkClicksUnit: "klik tautan",
    impressions: "Tayangan",
    cpm: "CPM",
    cpmSub: "Biaya per 1.000 tayangan",
    allClicks: "Semua Klik",
    linkIntent: "Rasio Minat Tautan",
    linkCpc: "CPC Tautan",
    cvr: "Konversi Klik (CVR)",
    avgPrefix: "Rata-rata",
    perDay: "/ hari",
    clicksUnit: "klik",
    clicksPerDay: "klik / hari",
    resultsPerDay: "hasil / hari",
    searchPlaceholder: "Cari nama iklan, kampanye, atau ID...",
    spendOnly: "Hanya iklan berbelanja",
    allDelivery: "Semua Status Penayangan",
    delivering: "Menayangkan",
    notDelivering: "Tidak Tayang",
    campaignPaused: "Kampanye Dijeda",
    adPaused: "Iklan Dijeda",
    archived: "Diarsipkan",
    deleted: "Dihapus",
    unknown: "Belum Diketahui",
    allParent: "Semua Status Induk",
    parentActive: "Kampanye Aktif",
    parentPaused: "Kampanye Dijeda",
    parentArchived: "Kampanye Diarsipkan",
    parentDeleted: "Kampanye Dihapus",
    parentUnknown: "Status Belum Diketahui",
    allObjectives: "Semua Objektif",
    objective: "Objektif Kampanye",
    deliveryFilter: "Filter Status Penayangan",
    parentFilter: "Filter Status Induk",
    activeFilters: "Filter Aktif",
    campaignFilterChip: "Kampanye",
    deliveryFilterChip: "Penayangan",
    parentFilterChip: "Status Induk",
    resetAll: "Reset Semua",
    showing: "Menampilkan",
    of: "dari",
    ofAds: "iklan",
    page: "Halaman",
    previous: "Sebelumnya",
    next: "Berikutnya",
    adAndCampaign: "Nama Iklan & Kampanye",
    deliveryStatus: "Status Tayang",
    totalSpend: "Total Belanja",
    resultsAndCpr: "Hasil & CPR",
    impressionsCol: "Tayangan",
    ctrCol: "CTR Tautan",
    cpcCol: "CPC Tautan",
    detail: "Detail",
    noAdsMatch: "Tidak ada iklan yang memenuhi kriteria filter",
    noAdsYet: "Belum ada data iklan pada periode ini",
    costUnavailable: "Biaya belum tersedia",
    noClicksYet: "Belum ada klik",
  },
  en: {
    title: "Ads Performance",
    subtitle: "Real-time campaign monitoring, conversion attribution, and Meta Ads cost efficiency.",
    adAccount: "Ad Account",
    selectAccount: "Select ad account",
    connected: "Connected · Auto-synced",
    notConnected: "No ad account connected. Connect Meta in Settings.",
    syncMeta: "Sync Meta",
    syncing: "Syncing...",
    today: "Today",
    days7: "7 Days",
    days14: "14 Days",
    days30: "30 Days",
    custom: "Custom",
    startDate: "Start",
    endDate: "End",
    applyRange: "Apply Range",
    cancel: "Cancel",
    activeRange: "Active range:",
    invalidDateRange: "Start date must be on or before end date.",
    dateFilterAppliedTitle: "Date Filter Applied",
    dateRangeConnector: "to",
    switchedAccountTitle: "Switched Ad Account",
    switchedAccountDesc: (name: string) => `Loading data for ${name}`,
    filtersResetTitle: "Filters Reset",
    filtersResetDesc: "All filter criteria have been reset to default.",
    loadFailedError: (err: string) => `Failed to load data. ${err} Previous account data is not shown as this account's data.`,
    retry: "Retry",
    workspaceNavAria: "Ads Workspace Navigation",
    tabInventory: "Ad Inventory & Performance",
    tabTrends: "Trends & CTWA Funnel",
    tabAnalyst: "Account Performance Audit",
    funnelTab: "Conversion Funnel",
    deliveryTab: "Delivery Health",
    scopeCaption: "KPI metrics below represent the aggregate of the selected ad account for the active date range.",
    reachLabel: "Unique Reach",
    reachTooltip: "Unique accounts reached during this period.",
    periodPrefix: "Period",
    spend: "Total Spend",
    spendDefaultHint: "Total spend for selected period",
    conversionResults: "Conversion Results",
    noResultsYet: "No results in this period",
    costPerResult: "Cost per Result",
    avgCostPerResult: "Average cost per conversion result",
    linkCtr: "Link CTR",
    linkClicksUnit: "link clicks",
    impressions: "Impressions",
    cpm: "CPM",
    cpmSub: "Cost per 1,000 impressions",
    allClicks: "All Clicks",
    linkIntent: "Link Intent Ratio",
    linkCpc: "Link CPC",
    cvr: "Click Conversion (CVR)",
    avgPrefix: "Average",
    perDay: "/ day",
    clicksUnit: "clicks",
    clicksPerDay: "clicks / day",
    resultsPerDay: "results / day",
    searchPlaceholder: "Search ad name, campaign, or ID...",
    spendOnly: "Ads with spend only",
    allDelivery: "All Delivery Statuses",
    delivering: "Delivering",
    notDelivering: "Not Delivering",
    campaignPaused: "Campaign Paused",
    adPaused: "Ad Paused",
    archived: "Archived",
    deleted: "Deleted",
    unknown: "Unknown",
    allParent: "All Parent Statuses",
    parentActive: "Active Campaign",
    parentPaused: "Paused Campaign",
    parentArchived: "Archived Campaign",
    parentDeleted: "Deleted Campaign",
    parentUnknown: "Unknown Status",
    allObjectives: "All Objectives",
    objective: "Campaign Objective",
    deliveryFilter: "Delivery Status Filter",
    parentFilter: "Parent Status Filter",
    activeFilters: "Active Filters",
    campaignFilterChip: "Campaign",
    deliveryFilterChip: "Delivery",
    parentFilterChip: "Parent Status",
    resetAll: "Reset All",
    showing: "Showing",
    of: "of",
    ofAds: "ads",
    page: "Page",
    previous: "Previous",
    next: "Next",
    adAndCampaign: "Ad & Campaign Name",
    deliveryStatus: "Delivery Status",
    totalSpend: "Total Spend",
    resultsAndCpr: "Results & CPR",
    impressionsCol: "Impressions",
    ctrCol: "Link CTR",
    cpcCol: "Link CPC",
    detail: "Details",
    noAdsMatch: "No ads match your active filters",
    noAdsYet: "No ad data available for this period",
    costUnavailable: "Cost unavailable",
    noClicksYet: "No clicks yet",
  },
} as const;

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

const INITIAL_ADS_CACHE_KEY = "dateRange=30d";

export default function AdsIntelligencePage({
  initialData = null,
}: {
  initialData?: AdsIntelligenceApiResponse["data"] | null;
}) {
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
  const [sortBy] = useState<
    "spend" | "linkClicks" | "linkCtr" | "linkCpc" | "impressions" | "results"
  >("spend");
  const [sortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Selected Ad for Detail Drawer
  const [activeDetailAdId, setActiveDetailAdId] = useState<string | null>(null);

  // Network & Reconciliation State (Sync state is strictly isolated per adAccountId)
  const [isLoading, setIsLoading] = useState(!initialData);
  const [syncLabelReady, setSyncLabelReady] = useState(false);
  const [syncingByAccount, setSyncingByAccount] = useState<Record<string, boolean>>({});
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"inventory" | "trends" | "analyst">("inventory");
  const handleSelectWorkspaceTab = useCallback((nextTab: "inventory" | "trends" | "analyst") => {
    setActiveWorkspaceTab((prev) => (prev === nextTab ? prev : nextTab));
  }, []);
  const [apiData, setApiData] = useState<AdsIntelligenceApiResponse["data"] | null>(initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchGuardRef = useRef(new FetchGuard());
  const adsCacheRef = useRef(new Map<string, AdsIntelligenceApiResponse["data"]>());
  if (initialData && !adsCacheRef.current.has(INITIAL_ADS_CACHE_KEY)) {
    adsCacheRef.current.set(INITIAL_ADS_CACHE_KEY, initialData);
  }
  const autoSyncAttemptedAtRef = useRef(new Map<string, number>());
  const activeAccountIdRef = useRef<string>("");

  useEffect(() => {
    setSyncLabelReady(true);
  }, []);

  const currentEffectiveAccountId = selectedAdAccountId || apiData?.adAccount?.id || "";
  useEffect(() => {
    activeAccountIdRef.current = currentEffectiveAccountId;
  }, [currentEffectiveAccountId]);
  const isSyncing = Boolean(currentEffectiveAccountId && syncingByAccount[currentEffectiveAccountId]);

  // Single guarded fetch path. Starting a fetch aborts the previous one and
  // invalidates its sequence, so a stale response for a previously selected
  // account can never overwrite the latest context.
  const fetchAds = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const guard = fetchGuardRef.current;
      const { seq, signal } = guard.begin();
      const params = new URLSearchParams();
      if (dateRange) params.set("dateRange", dateRange);
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
        if (signal.aborted || !guard.isCurrent(seq)) return; // superseded or aborted request
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
        if (!signal.aborted && guard.isCurrent(seq)) setIsLoading(false);
      }
    },
    [dateRange, selectedAdAccountId, addToast, locale]
  );

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
    const targetId = selectedAdAccountId || apiData?.adAccount?.id || "";
    if (!targetId || syncingByAccount[targetId] || !apiData?.canSync || !apiData.adAccount) return;
    const syncPeriod = requestedRange?.period || dateRange;
    if (syncPeriod === "all") return;
    setSyncingByAccount((prev) => ({ ...prev, [targetId]: true }));
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
          targetAdAccountId: targetId,
          ...(datePreset ? { datePreset } : {}),
          ...(syncTimeRange.since && syncTimeRange.until ? { timeRange: syncTimeRange } : {}),
        }),
      });
      const data = await res.json();
      const isStillActiveAccount = activeAccountIdRef.current === targetId;
      const liveAccountInsight = data.syncResult?.accountInsights?.[0] as {
        reach?: string | number | null;
        frequency?: string | number | null;
        actions?: Array<{ action_type: string; value: string }>;
      } | undefined;
      if (liveAccountInsight && isStillActiveAccount) {
        const reach = liveAccountInsight.reach == null ? null : Number(liveAccountInsight.reach);
        const frequency = liveAccountInsight.frequency == null ? null : Number(liveAccountInsight.frequency);
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
        if (!liveAccountInsight && activeAccountIdRef.current === targetId) {
          await fetchAds({ silent: true });
        }
      } else if (res.ok && data.status === "partial") {
        const insights = data.syncResult?.insightsSynced ?? 0;
        if (!silent) addToast(
          "warning",
          locale === "id" ? "Sinkronisasi Sebagian" : "Partial Sync",
          locale === "id"
            ? `Data akun diperbarui, tetapi sinkronisasi belum lengkap. Insights tersimpan: ${insights}. Coba lagi atau periksa detail koneksi Meta.`
            : `Account data updated, but sync is incomplete. Insights saved: ${insights}. Try again or check Meta connection details.`
        );
        if (!liveAccountInsight && activeAccountIdRef.current === targetId) {
          await fetchAds({ silent: true });
        }
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
      setSyncingByAccount((prev) => {
        if (!prev[targetId]) return prev;
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    }
  }, [syncingByAccount, apiData, dateRange, selectedAdAccountId, fetchAds, addToast, locale]);

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
    let list = rawAds.filter((ad) =>
      matchesInventoryFilters(ad, {
        selectedCampaignId,
        campaignStatusFilter,
        deliveryStatusFilter,
        objectiveFilter,
      })
    );

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
      const missing = sortOrder === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      const numeric = (value: number | null | undefined) =>
        typeof value === "number" && Number.isFinite(value) ? value : missing;
      let valA = missing;
      let valB = missing;

      switch (sortBy) {
        case "spend":
          valA = numeric(a.spend);
          valB = numeric(b.spend);
          break;
        case "linkClicks":
          valA = numeric(a.linkClicks);
          valB = numeric(b.linkClicks);
          break;
        case "linkCtr":
          valA = numeric(a.linkCtr);
          valB = numeric(b.linkCtr);
          break;
        case "linkCpc":
          valA = numeric(a.linkCpc);
          valB = numeric(b.linkCpc);
          break;
        case "impressions":
          valA = numeric(a.impressions);
          valB = numeric(b.impressions);
          break;
        case "results":
          valA = numeric(a.resultMetricValue ?? a.results);
          valB = numeric(b.resultMetricValue ?? b.results);
          break;
      }

      if (sortOrder === "asc") {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      }
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    });

    return list;
  }, [rawAds, selectedCampaignId, campaignStatusFilter, deliveryStatusFilter, objectiveFilter, searchQuery, showOnlyWithSpend, sortBy, sortOrder]);

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
  const displayedTotalResults = kpis?.totalResults ?? dailyTrend.reduce<number | null>((sum, point) => {
    const reported = point.results != null ? point.results : point.conversations;
    if (typeof reported !== "number" || !Number.isFinite(reported)) return sum;
    return (sum ?? 0) + reported;
  }, null);
  const displayedCostPerResult = displayedTotalResults != null && displayedTotalResults > 0 && kpis?.totalSpend != null
    ? kpis.totalSpend / displayedTotalResults
    : null;
  const daysCount = Math.max(dailyTrend.length, 1);
  const totalImpressions = kpis?.totalImpressions ?? null;
  const totalLinkClicks = kpis?.linkClicks ?? null;
  const totalAllClicks = kpis?.allClicks ?? null;
  const intentClickRate = totalAllClicks != null && totalAllClicks > 0 && totalLinkClicks != null ? (totalLinkClicks / totalAllClicks) * 100 : null;
  const clickConversionRate = totalLinkClicks != null && totalLinkClicks > 0 && displayedTotalResults != null && displayedTotalResults > 0
    ? (displayedTotalResults / totalLinkClicks) * 100
    : null;
  const linkCvrCaption = insightsAvailable && totalLinkClicks != null && totalLinkClicks > 0 ? formatRate(clickConversionRate) : "—";
  const activeCampaignCount = kpis?.activeCampaigns ?? 0;
  const campaignHealthClass = activeCampaignCount > 0
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
  const averageResultsPerDay = displayedTotalResults != null ? displayedTotalResults / daysCount : null;
  const oneDecimal = (value: number) => new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  const t = ADS_PAGE_DICT[uiLocale];
  const dateRangeContext = apiData?.dateRangeContext;
  const dateRangeContextText = useMemo(() => {
    if (!dateRangeContext?.since || !dateRangeContext?.until) {
      return null;
    }
    const sinceStr = formatReportDate(dateRangeContext.since, false);
    const untilStr = formatReportDate(dateRangeContext.until, true);
    return `${t.periodPrefix} ${sinceStr} – ${untilStr}`;
  }, [dateRangeContext, formatReportDate, t.periodPrefix]);

  const spendCaption = dateRangeContextText || t.spendDefaultHint;
  const resultUnitLabel = getLocalizedResultLabel(kpis?.resultLabel);
  const resultCaption = displayedTotalResults != null && displayedTotalResults > 0 ? resultUnitLabel : t.noResultsYet;

  const deliveryStatusLabelMap: Record<string, string> = useMemo(
    () => ({
      DELIVERING: t.delivering,
      NOT_DELIVERING: t.notDelivering,
      CAMPAIGN_PAUSED: t.campaignPaused,
      AD_PAUSED: t.adPaused,
      ARCHIVED: t.archived,
      DELETED: t.deleted,
      UNKNOWN: t.unknown,
    }),
    [t]
  );

  const parentStatusLabelMap: Record<string, string> = useMemo(
    () => ({
      ACTIVE: t.parentActive,
      PAUSED: t.parentPaused,
      ARCHIVED: t.parentArchived,
      DELETED: t.parentDeleted,
      UNKNOWN: t.parentUnknown,
    }),
    [t]
  );

  const formattedAdsArray: PremiumAdRow[] = useMemo(() => {
    return paginatedAds.map((ad) => {
      const resultMetricValue = ad.resultMetricValue ?? ad.results;
      const resultMetricCost = ad.resultMetricCostPerResult ?? ad.costPerResult;
      const resultMetricUnit = localizeResultUnitLabel(ad.resultMetricUnitLabel, uiLocale);

      return {
        id: ad.id,
        adId: ad.adId,
        adName: ad.adName,
        campaignName: ad.campaignName,
        deliveryStatus: ad.deliveryStatus,
        deliveryLabel: localizeDeliveryLabel(
          ad.deliveryLabel,
          ad.deliveryStatus,
          ad.campaignStatus,
          ad.adSettingStatus,
          uiLocale
        ),
        spendFormatted: ad.hasInsights ? formatAdCurrency(ad.spend) : "—",
        spendRaw: ad.hasInsights && typeof ad.spend === "number" ? ad.spend : null,
        resultsFormatted: resultMetricValue !== null ? formatNumber(resultMetricValue) : "—",
        cprFormatted:
          resultMetricCost !== null
            ? `${formatAdCurrency(resultMetricCost)} / ${resultMetricUnit}`
            : resultMetricValue !== null
            ? t.costUnavailable
            : "—",
        impressionsFormatted: ad.hasInsights ? formatNumber(ad.impressions) : "—",
        ctrFormatted: ad.linkCtr !== null ? formatRate(ad.linkCtr) : "—",
        cpcFormatted: ad.linkCpc !== null ? formatAdCurrency(ad.linkCpc) : t.noClicksYet,
      };
    });
  }, [
    paginatedAds,
    uiLocale,
    formatAdCurrency,
    formatNumber,
    formatRate,
    t.costUnavailable,
    t.noClicksYet,
  ]);

  const adAccountSelectorNode = (
    <div className="flex flex-wrap items-center gap-2.5">
            {(apiData?.availableAdAccounts?.length ?? 0) > 0 ? (
        <div className="inline-flex flex-wrap items-center gap-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          <span className="text-zinc-500 dark:text-zinc-400">{t.adAccount}:</span>
          <div className="relative">
                <select
                  value={selectedAdAccountId || adAccount?.id || ""}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    activeAccountIdRef.current = nextId;
                    setSelectedAdAccountId(nextId);
                    setSelectedCampaignId("all");
                    setCampaignStatusFilter("all");
                    setDeliveryStatusFilter("all");
                    setObjectiveFilter("all");
                    setSearchQuery("");
                    setCurrentPage(1);
                    setActiveDetailAdId(null);
                    setLoadError(null);
                    setShowCustomDateRange(false);
                    const accName =
                      (apiData?.availableAdAccounts || []).find((acc) => acc.id === nextId)?.name || nextId;
                    addToast("info", t.switchedAccountTitle, t.switchedAccountDesc(accName));
                  }}
              className="appearance-none h-9 max-w-[18rem] truncate bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/[0.08] rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-sm cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
              aria-label={t.selectAccount}
                >
                  {(apiData?.availableAdAccounts || []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                  {acc.name || acc.id} ({formatAccountMask(acc.id)})
                    </option>
                  ))}
                </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${syncFreshnessClass(
                adAccount?.lastSyncedAt || apiData?.lastSyncedAt
              )}`}
            />
            {t.connected}{" "}
            {syncLabelReady
              ? formatRelativeSyncTime(adAccount?.lastSyncedAt || apiData?.lastSyncedAt, uiLocale)
              : ""}
          </span>
        </div>
      ) : (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
          {t.notConnected}
        </span>
      )}
    </div>
  );

  const dateRangeSelectorNode = (
    <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100/80 p-1 dark:border-white/[0.08] dark:bg-zinc-800/80">
      {[
        { id: "today", label: t.today },
        { id: "7d", label: t.days7 },
        { id: "14d", label: t.days14 },
        { id: "30d", label: t.days30 },
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
                ? "bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-indigo-400/20"
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
        className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
          dateRange.includes(":") || showCustomDateRange
            ? "bg-white text-indigo-700 shadow-xs ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-indigo-300 dark:ring-indigo-400/20"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        {t.custom}
          </button>
          </div>
  );

  const syncButtonNode = (
    <button
      type="button"
      onClick={() => handleTriggerSync()}
      disabled={isSyncing || !apiData?.canSync || !adAccount}
      className="btn-solar inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-xs"
    >
      <svg
        className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : "opacity-80"}`}
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
      {isSyncing ? t.syncing : t.syncMeta}
    </button>
  );

  const todayInAccountTz = useMemo(
    () => (syncLabelReady ? formatDateInTimezone(new Date(), adAccount?.timezone || "Asia/Jakarta") : ""),
    [adAccount?.timezone, syncLabelReady]
  );
  const isCustomDateInvalid =
    Boolean(customDateStart && customDateEnd) &&
    (customDateStart > customDateEnd || customDateEnd > todayInAccountTz);

  return (
    <AdsDashboardLayout
      title={t.title}
      subtitle={t.subtitle}
      adAccountSelector={adAccountSelectorNode}
      dateRangeFilter={dateRangeSelectorNode}
      syncButton={syncButtonNode}
      activeAccountDetails={{
        currency: adAccount?.currency || undefined,
        timezone: adAccount?.timezone || undefined,
      }}
    >
      {/* Custom Date Range Picker Form */}
        {showCustomDateRange && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!customDateStart || !customDateEnd || isCustomDateInvalid) return;
              setDateRange(`${customDateStart}:${customDateEnd}`);
              setCurrentPage(1);
              setShowCustomDateRange(false);
            addToast(
              "info",
              t.dateFilterAppliedTitle,
              `${customDateStart} ${t.dateRangeConnector} ${customDateEnd}`
            );
            }}
          className="surface-card flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 backdrop-blur-md p-4 dark:border-white/[0.08] dark:bg-zinc-900/90 sm:flex-row sm:items-end shadow-xs"
          >
            <label className="space-y-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t.startDate}
            </span>
            <input
              type="date"
              required
              value={customDateStart}
              max={customDateEnd && customDateEnd < todayInAccountTz ? customDateEnd : todayInAccountTz}
              onChange={(event) => setCustomDateStart(event.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            />
            </label>
            <label className="space-y-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t.endDate}
            </span>
            <input
              type="date"
              required
              value={customDateEnd}
              min={customDateStart || undefined}
              max={todayInAccountTz}
              onChange={(event) => setCustomDateEnd(event.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            />
            </label>
          <button
            type="submit"
            disabled={!customDateStart || !customDateEnd || isCustomDateInvalid}
            className="btn-solar rounded-lg px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {t.applyRange}
            </button>
          <button
            type="button"
            onClick={() => setShowCustomDateRange(false)}
            className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            {t.cancel}
            </button>
            {dateRange.includes(":") && (
            <span className="text-[11px] font-medium text-zinc-500 sm:ml-auto">
              {t.activeRange} {dateRange.replace(":", " – ")}
              </span>
            )}
            {isCustomDateInvalid && (
            <span role="alert" className="text-[11px] text-rose-600">
              {t.invalidDateRange}
            </span>
            )}
          </form>
        )}

      {/* Fetch Error Banner */}
      {!isLoading && loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 backdrop-blur-sm px-5 py-3.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 shadow-xs"
        >
          <span>{t.loadFailedError(loadError)}</span>
          <button
            type="button"
            onClick={() => fetchAds()}
            className="rounded-lg border border-rose-300 px-3 py-1 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40 cursor-pointer"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Workspace Tabs Navigation (Zero-Jitter Fixed-Geometry Segmented Control) */}
      <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <div
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100/90 p-1 dark:border-zinc-800 dark:bg-zinc-900"
          role="tablist"
          aria-label={t.workspaceNavAria}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspaceTab === "inventory"}
            onClick={() => handleSelectWorkspaceTab("inventory")}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 ${
              activeWorkspaceTab === "inventory"
                ? "border-zinc-200/90 bg-white text-zinc-900 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                : "border-transparent bg-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <svg className="h-3.5 w-3.5 shrink-0 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>{t.tabInventory}</span>
            <span
              className={`inline-flex h-5 min-w-[22px] items-center justify-center rounded-md px-1.5 text-[11px] font-mono font-semibold tabular-nums transition-colors duration-150 ${
                activeWorkspaceTab === "inventory"
                  ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                  : "bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {processedAds.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspaceTab === "trends"}
            onClick={() => handleSelectWorkspaceTab("trends")}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 ${
              activeWorkspaceTab === "trends"
                ? "border-zinc-200/90 bg-white text-zinc-900 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                : "border-transparent bg-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <svg className="h-3.5 w-3.5 shrink-0 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" />
            </svg>
            <span>{t.tabTrends}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspaceTab === "analyst"}
            onClick={() => handleSelectWorkspaceTab("analyst")}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 ${
              activeWorkspaceTab === "analyst"
                ? "border-zinc-200/90 bg-white text-zinc-900 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                : "border-transparent bg-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <svg className="h-3.5 w-3.5 shrink-0 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
            <span>{t.tabAnalyst}</span>
          </button>
        </div>
      </div>

      {/* Stable Tab Viewport Container (Prevents Scrollbar & Height Collapse Jitter) */}
      <div className="min-h-[640px]">
      {/* TAB 1: Inventaris & Performa Iklan */}
      {activeWorkspaceTab === "inventory" && (
      <div
        role="tabpanel"
        className="space-y-6 tab-panel-enter"
      >
          {/* Contextual Notice Bar */}
          {!isLoading && (() => {
            if (apiData?.insightsState === "no_account_selected") {
              return (
                <div
                  role="status"
                  className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-3.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{copy.noticeNoAccount}</span>
            </div>
              );
            }
            if (apiData?.insightsState === "no_data_for_period") {
              return (
                <div
                  role="status"
                  className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-3.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{copy.noticeNoData}</span>
          </div>
              );
            }
            if (apiData?.accountMetricsState === "range_not_supported") {
              return (
                <div
                  role="status"
                  className="flex items-center gap-2.5 rounded-2xl border border-sky-200 bg-sky-50/80 px-5 py-3.5 text-xs font-medium text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200"
                >
                  <svg className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{copy.noticeRangeNotSupported}</span>
        </div>
              );
            }
            if (apiData?.accountMetricsState === "filtered_scope") {
              return (
                <div
                  role="status"
                  className="flex items-center gap-2.5 rounded-2xl border border-sky-200 bg-sky-50/80 px-5 py-3.5 text-xs font-medium text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200"
                >
                  <svg className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{copy.noticeFilteredScope}</span>
            </div>
              );
            }
            if (apiData?.accountMetricsState === "source_unavailable") {
              return (
                <div
                  role="status"
                  className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-3.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{copy.noticeSourceUnavailable}</span>
            </div>
              );
            }
            return null;
          })()}

          {/* Scope Caption & Unique Reach Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <p>{t.scopeCaption}</p>
            <div className="inline-flex items-center gap-1.5" title={t.reachTooltip}>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {locale === "id" ? "Jangkauan" : "Reach"}:
            </span>
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatOptionalNumber(kpis?.totalReach, formatNumber)}
              </span>
              {kpis?.frequency != null && (
                <span className="text-zinc-400">
                  ({kpis.frequency.toFixed(2)}x)
                </span>
              )}
        </div>
      </div>

          {/* 3. 4 Premium KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <PremiumKPICard
              label={t.spend}
              value={insightsAvailable ? formatAdCurrency(kpis?.totalSpend) : "—"}
              hint={spendCaption}
              trendData={dailyTrend.map((point) => point.spend)}
              accentColor="indigo"
              isLoading={isLoading}
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 3v18M16.5 7.5c0-1.5-1.8-3-4.5-3S7.5 6 7.5 7.5 9.3 10.5 12 10.5s4.5 1.5 4.5 3-1.8 3-4.5 3-4.5-1.5-4.5-3" />
                </svg>
              }
            />

            <PremiumKPICard
              label={t.conversionResults}
              value={formatNumber(displayedTotalResults)}
              hint={resultCaption}
              trendData={dailyTrend.map((point) => point.results ?? point.conversations ?? 0)}
              accentColor="emerald"
              isLoading={isLoading}
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4 19c.4-2.4 2.2-4 4.5-4s4.1 1.6 4.5 4m2-6c2 .4 3.4 1.8 3.8 4" />
                </svg>
              }
            />

            <PremiumKPICard
              label={t.costPerResult}
              value={displayedCostPerResult !== null ? formatAdCurrency(displayedCostPerResult) : "—"}
              hint={t.avgCostPerResult}
              trendData={dailyTrend.map((point) => {
                const results = point.results ?? point.conversations ?? null;
                if (results == null || results <= 0 || point.spend == null) return null;
                return point.spend / results;
              })}
              accentColor="amber"
              isLoading={isLoading}
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M5 19 19 5M9 5h10v10" />
                </svg>
              }
            />

            <PremiumKPICard
              label={t.linkCtr}
              value={insightsAvailable ? formatRate(kpis?.linkCtr) : "—"}
              hint={`${formatNumber(totalLinkClicks)} ${t.linkClicksUnit} · CVR ${linkCvrCaption}`}
              trendData={dailyTrend.map((point) => (
                point.impressions != null && point.impressions > 0 && point.linkClicks != null
                  ? (point.linkClicks / point.impressions) * 100
                  : null
              ))}
              accentColor="violet"
              isLoading={isLoading}
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M4 15.5 9 10l3.5 3.5L20 6" />
                </svg>
              }
            />
          </div>

          {/* 4. Secondary Metrics Ticker */}
          <SecondaryMetricsTicker
            isLoading={isLoading}
            metrics={[
              {
                label: t.impressions,
                value: insightsAvailable ? formatNumber(totalImpressions) : "—",
                sub: `${t.avgPrefix} ${totalImpressions != null ? formatNumber(Math.round(totalImpressions / daysCount)) : "—"} ${t.perDay}`,
              },
              {
                label: t.cpm,
                value: insightsAvailable && totalImpressions != null && totalImpressions > 0 && kpis?.cpm != null ? formatAdCurrency(kpis.cpm) : "—",
                sub: t.cpmSub,
              },
              {
                label: t.allClicks,
                value: insightsAvailable ? formatNumber(totalAllClicks) : "—",
                sub: `CTR ${insightsAvailable && totalImpressions != null && totalImpressions > 0 ? formatRate(kpis?.allCtr) : "—"} · CPC ${insightsAvailable && totalAllClicks != null && totalAllClicks > 0 && kpis?.allCpc != null ? formatAdCurrency(kpis.allCpc) : "—"}`,
              },
              {
                label: t.linkIntent,
                value: insightsAvailable && totalAllClicks != null && totalAllClicks > 0 ? formatRate(intentClickRate) : "—",
                sub: `${formatNumber(totalLinkClicks)} / ${formatNumber(totalAllClicks)} ${t.clicksUnit}`,
              },
              {
                label: t.linkCpc,
                value: insightsAvailable && totalLinkClicks != null && totalLinkClicks > 0 && kpis?.linkCpc != null ? formatAdCurrency(kpis.linkCpc) : "—",
                sub: `${t.avgPrefix} ${totalLinkClicks != null ? formatNumber(Math.round(totalLinkClicks / daysCount)) : "—"} ${t.clicksPerDay}`,
              },
              {
                label: t.cvr,
                value: insightsAvailable && totalLinkClicks != null && totalLinkClicks > 0 ? formatRate(clickConversionRate) : "—",
                sub: `${t.avgPrefix} ${averageResultsPerDay != null ? oneDecimal(averageResultsPerDay) : "—"} ${t.resultsPerDay}`,
              },
            ]}
          />

          {/* 5. Premium Ads Table */}
          <PremiumAdsTable
            ads={formattedAdsArray}
            totalFilteredCount={processedAds.length}
            totalRawCount={rawAds?.length ?? 0}
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
                  setCurrentPage(1);
                }}
            showOnlyWithSpend={showOnlyWithSpend}
            onToggleSpendOnly={(checked) => {
              setShowOnlyWithSpend(checked);
                    setCurrentPage(1);
                  }}
            onSelectAd={(id) => setActiveDetailAdId(id)}
            isLoading={isLoading}
            activeFilterChips={
              <div className="space-y-2.5">
                {/* Dropdown Filters Row */}
                <div className="relative z-40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* 1. Campaign Searchable Dropdown */}
                  <div className="relative min-w-0">
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
                  <div className="relative min-w-0">
                    <label className="sr-only" htmlFor="delivery-status-filter">
                      {t.deliveryFilter}
                    </label>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5" />
                      </svg>
                    </span>
                    <select
                      id="delivery-status-filter"
                      value={deliveryStatusFilter}
                      onChange={(e) => {
                        setDeliveryStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      title={t.deliveryFilter}
                      className={`appearance-none h-9 w-full min-w-0 rounded-lg border pl-8 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/5 shadow-2xs cursor-pointer select-none transition-colors truncate ${
                        deliveryStatusFilter !== "all"
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
                      }`}
                    >
                      <option value="all">{t.allDelivery}</option>
                      <option value="DELIVERING">{t.delivering}</option>
                      <option value="NOT_DELIVERING">{t.notDelivering}</option>
                      <option value="CAMPAIGN_PAUSED">{t.campaignPaused}</option>
                      <option value="AD_PAUSED">{t.adPaused}</option>
                      <option value="ARCHIVED">{t.archived}</option>
                      <option value="DELETED">{t.deleted}</option>
                      <option value="UNKNOWN">{t.unknown}</option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* 3. Status Campaign Induk */}
                  <div className="relative min-w-0">
                    <label className="sr-only" htmlFor="campaign-status-filter">
                      {t.parentFilter}
                    </label>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </span>
                    <select
                      id="campaign-status-filter"
                      value={campaignStatusFilter}
                      onChange={(e) => {
                        setCampaignStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      title={t.parentFilter}
                      className={`appearance-none h-9 w-full min-w-0 rounded-lg border pl-8 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/5 shadow-2xs cursor-pointer select-none transition-colors truncate ${
                        campaignStatusFilter !== "all"
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
                      }`}
                    >
                      <option value="all">{t.allParent}</option>
                      <option value="ACTIVE">{t.parentActive}</option>
                      <option value="PAUSED">{t.parentPaused}</option>
                      <option value="ARCHIVED">{t.parentArchived}</option>
                      <option value="DELETED">{t.parentDeleted}</option>
                      <option value="UNKNOWN">{t.parentUnknown}</option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* 4. Objective */}
                  <div className="relative min-w-0">
                    <label className="sr-only" htmlFor="objective-filter">
                      {t.objective}
                    </label>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                    </span>
                    <select
                      id="objective-filter"
                      value={objectiveFilter}
                      onChange={(e) => {
                        setObjectiveFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      title={t.objective}
                      className={`appearance-none h-9 w-full min-w-0 rounded-lg border pl-8 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/5 shadow-2xs cursor-pointer select-none transition-colors truncate ${
                        objectiveFilter !== "all"
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
                      }`}
                    >
                      <option value="all">{t.allObjectives}</option>
                      {Array.from(
                        new Map(
                          campaigns.flatMap((campaign) => {
                            const key = objectiveFilterKey(campaign.objective);
                            return key ? [[key, objectiveFilterLabel(key, uiLocale)] as const] : [];
                          })
                        )
                      ).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Active Filter Chips & Reset All */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-500">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{t.activeFilters}:</span>

                    {selectedCampaignId !== "all" && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                        <span>{t.campaignFilterChip}: {campaigns.find((c) => c.id === selectedCampaignId)?.name || selectedCampaignId}</span>
                      <button
                        type="button"
                        onClick={() => {
                            setSelectedCampaignId("all");
                          setCurrentPage(1);
                        }}
                          className="hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  )}

                    {deliveryStatusFilter !== "all" && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                        <span>{t.deliveryFilterChip}: {deliveryStatusLabelMap[deliveryStatusFilter] || deliveryStatusFilter}</span>
                      <button
                        type="button"
                        onClick={() => {
                            setDeliveryStatusFilter("all");
                          setCurrentPage(1);
                        }}
                          className="hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  )}

                    {campaignStatusFilter !== "all" && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                        <span>{t.parentFilterChip}: {parentStatusLabelMap[campaignStatusFilter] || campaignStatusFilter}</span>
                      <button
                        type="button"
                        onClick={() => {
                            setCampaignStatusFilter("all");
                          setCurrentPage(1);
                        }}
                          className="hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  )}

                    {objectiveFilter !== "all" && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                        <span>{objectiveFilterLabel(objectiveFilter, uiLocale)}</span>
                      <button
                        type="button"
                        onClick={() => {
                            setObjectiveFilter("all");
                          setCurrentPage(1);
                        }}
                          className="hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  )}

                      <button
                        type="button"
                        onClick={() => {
                        setSelectedCampaignId("all");
                        setCampaignStatusFilter("all");
                        setDeliveryStatusFilter("all");
                        setObjectiveFilter("all");
                        setSearchQuery("");
                          setDateRange("30d");
                        setShowOnlyWithSpend(true);
                          setCurrentPage(1);
                        addToast("info", t.filtersResetTitle, t.filtersResetDesc);
                      }}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline ml-1 cursor-pointer"
                  >
                      {t.resetAll}
                  </button>
                  </div>
              )}
            </div>
            }
            i18n={{
              searchPlaceholder: t.searchPlaceholder,
              spendOnly: t.spendOnly,
              adAndCampaign: t.adAndCampaign,
              status: t.deliveryStatus,
              spend: t.totalSpend,
              resultsAndCpr: t.resultsAndCpr,
              impressions: t.impressionsCol,
              ctr: t.ctrCol,
              cpc: t.cpcCol,
              actionDetail: t.detail,
              noResults: hasActiveFilters ? t.noAdsMatch : t.noAdsYet,
              showing: t.showing,
              of: t.of,
              ofAds: t.ofAds,
              page: t.page,
              prev: t.previous,
              next: t.next,
            }}
          />
      </div>
      )}

      {/* TAB 2: Tren & Funnel CTWA */}
      {activeWorkspaceTab === "trends" && (
        <div
          role="tabpanel"
          className="space-y-6 tab-panel-enter"
        >
          <TrendsAndFunnelTab
            key={adAccount?.id || selectedAdAccountId || "default-account"}
            dailyTrend={apiData?.dailyTrend || []}
            campaigns={campaigns}
            ads={apiData?.ads || []}
            accountMetrics={{
              spend: kpis?.totalSpend ?? null,
              impressions: kpis?.totalImpressions ?? null,
              allClicks: kpis?.allClicks ?? null,
              linkClicks: kpis?.linkClicks ?? null,
              results: displayedTotalResults,
              allCpc: kpis?.allCpc ?? null,
              linkCpc: kpis?.linkCpc ?? null,
              cpm: kpis?.cpm ?? null,
              costPerResult: displayedCostPerResult,
            }}
            currency={adAccount?.currency || kpis?.currency || "IDR"}
            resultLabel={getLocalizedResultLabel(kpis?.resultLabel)}
          />

          <div className="surface-card overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 px-5 py-3.5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {t.deliveryTab}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${campaignHealthClass}`}>
                  {activeCampaignCount}/{kpis?.totalCampaigns ?? 0}
                </span>
              </div>
            </div>
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
          </div>
        </div>
      )}

      {/* TAB 3: Audit Performa Akun */}
      {activeWorkspaceTab === "analyst" && (
        <div
          role="tabpanel"
          className="space-y-6 tab-panel-enter"
        >
          <AIAdsPerformanceAnalyst
            key={adAccount?.id || selectedAdAccountId || "default-analyst"}
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
      </div>

      {/* Slide-out Ad Detail Drawer */}
      {selectedAd && (
        <AdDetailDrawer
          ad={selectedAd}
          currency={adAccount?.currency || kpis?.currency || ""}
          lastSyncedAt={apiData?.lastSyncedAt}
          dateRange={dateRange}
          onClose={() => setActiveDetailAdId(null)}
        />
      )}
    </AdsDashboardLayout>
  );
}
