"use client";

import React, { useState, useRef, useMemo, useSyncExternalStore } from "react";
import type { PerformanceAnalysisOutput } from "@/app/api/ai/analyze-performance/route";
import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";
import type { RealAdRow } from "@/app/(dashboard)/ads/page";
import { useToast } from "@/components/ui/Toast";
import { useAiQuota } from "@/hooks/useAiQuota";
import { IdempotencyKeyManager } from "@/lib/ai/idempotency-key";
import { formatDisplayCurrency, type DisplayLocale } from "@/lib/format/display-currency";
import { AccountIntelligenceReportView } from "@/components/dashboard/AccountIntelligenceReport";
import { accountReportSupersedesLegacyDecision } from "@/lib/ai/account-intelligence/status";
import { cqplForScope } from "@/lib/crm/crm-analysis-context";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface AIAdsPerformanceAnalystProps {
  campaigns: CampaignDetailData[];
  ads: RealAdRow[];
  accountName?: string | null;
  adAccountId?: string | null;
  currency?: string;
  timezone?: string;
  currentDateRange?: string;
  lastSyncedAt?: string | null;
  canSync?: boolean;
  isSyncing?: boolean;
  onTriggerSync?: (range: { period: string; since?: string; until?: string }) => void;
}

export function cleanEntityName(raw?: string | null): string {
  if (!raw) return "";
  let name = raw.trim();

  // Strip common noisy prefixes
  name = name
    .replace(/^Postingan Instagram:\s*/i, "IG Post · ")
    .replace(/^Instagram post:\s*/i, "IG Post · ")
    .replace(/^Postingan Facebook:\s*/i, "FB Post · ")
    .replace(/^Facebook post:\s*/i, "FB Post · ")
    .replace(/^Postingan:\s*/i, "Post · ");

  // Strip leading and trailing quotes e.g. "..."
  name = name.replace(/^["'“”«»]\s*/, "").replace(/\s*["'“”«»]$/, "");
  name = name.replace(/^(IG Post · |FB Post · |Post · )["'“”«»]/, "$1").replace(/["'“”«»]$/, "");

  // Remove emoji noise
  name = name.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");
  name = name.replace(/\s+/g, " ").trim();

  return name || raw;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 96;
  const h = 28;
  const pad = 3;
  const coords = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (w - pad * 2) + pad;
    const y = h - ((val - min) / range) * (h - pad * 2) - pad;
    return { x, y };
  });
  const points = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoints = `${coords[0].x.toFixed(1)},${h} ${points} ${coords[coords.length - 1].x.toFixed(1)},${h}`;
  const last = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-20 sm:w-24 shrink-0 overflow-visible" aria-hidden="true">
      <polygon points={areaPoints} fill={color} fillOpacity="0.12" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill={color} />
    </svg>
  );
}

type AnalystPeriod = "1d" | "3d" | "7d" | "14d" | "30d" | "custom";

export function pageRangeToAnalystPeriod(dateRange?: string | null): {
  period: AnalystPeriod;
  customSince: string;
  customUntil: string;
} | null {
  if (!dateRange) return null;
  if (dateRange === "today" || dateRange === "1d") return { period: "1d", customSince: "", customUntil: "" };
  if (dateRange === "3d" || dateRange === "7d" || dateRange === "14d" || dateRange === "30d") {
    return { period: dateRange, customSince: "", customUntil: "" };
  }
  const match = dateRange.match(/^(\d{4}-\d{2}-\d{2})[:_](\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { period: "custom", customSince: match[1], customUntil: match[2] };
}

export function formatAccountMoney(amount: number, currency?: string | null, locale: DisplayLocale = "id"): string {
  return formatDisplayCurrency(amount, currency, locale);
}

function formatAnalystMetric(
  metric: PerformanceAnalysisOutput["metrics"][number],
  currency?: string | null,
  locale: DisplayLocale = "id"
): string {
  const intlLocale = locale === "id" ? "id-ID" : "en-US";
  if (metric.display === "—" || metric.display === "Unavailable") return locale === "id" ? "Belum tersedia" : "Unavailable";
  if (metric.key === "spend" || metric.key === "cpr") {
    if (metric.key === "cpr" && metric.display === "Tidak tersedia") {
      return locale === "id" ? metric.display : "Unavailable";
    }
    return formatAccountMoney(metric.value, currency, locale);
  }
  if (metric.key === "results") {
    return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 }).format(metric.value);
  }
  if (metric.display === "Tidak tersedia") return locale === "id" ? metric.display : "Unavailable";
  return `${new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(metric.value)}%`;
}

const ANALYST_METRIC_LABELS_ID: Record<PerformanceAnalysisOutput["metrics"][number]["key"], string> = {
  spend: "Total Belanja",
  results: "Hasil Konversi",
  cpr: "Biaya per Hasil (CPR)",
  ctr: "CTR Tautan",
};

const ANALYST_METRIC_LABELS_EN: Record<PerformanceAnalysisOutput["metrics"][number]["key"], string> = {
  spend: "Total Spend",
  results: "Conversion Results",
  cpr: "Cost per Result (CPR)",
  ctr: "Link CTR",
};

function formatRelativeSyncTime(value: string, locale: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return locale === "id" ? "waktu tidak valid" : "invalid time";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return locale === "id" ? "baru saja" : "just now";
  if (minutes < 60) return locale === "id" ? `${minutes} menit lalu` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === "id" ? `${hours} jam lalu` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return locale === "id" ? `${days} hari lalu` : `${days} days ago`;
}

const TARGET_CPR_PRESETS = [
  { value: 10000, labelId: "Rp10rb", labelEn: "10K" },
  { value: 25000, labelId: "Rp25rb", labelEn: "25K" },
  { value: 50000, labelId: "Rp50rb", labelEn: "50K" },
  { value: 100000, labelId: "Rp100rb", labelEn: "100K" },
];

export function AIAdsPerformanceAnalyst({
  campaigns = [],
  ads = [],
  accountName = "Meta Ads",
  adAccountId = null,
  currency = "IDR",
  timezone = "Asia/Jakarta",
  currentDateRange,
  lastSyncedAt = null,
  canSync = false,
  isSyncing = false,
  onTriggerSync,
}: AIAdsPerformanceAnalystProps) {
  const accountCurrency = currency?.trim() || "IDR";
  const { addToast } = useToast();
  const { locale } = useI18n();
  const { quota, refresh: refreshQuota } = useAiQuota();

  // Selector states
  const [scope, setScope] = useState<"account" | "campaign" | "ad">("account");
  const mappedPagePeriod = pageRangeToAnalystPeriod(currentDateRange);
  const period: AnalystPeriod = mappedPagePeriod?.period ?? "30d";
  const customSince = mappedPagePeriod?.customSince ?? "";
  const customUntil = mappedPagePeriod?.customUntil ?? "";
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedAdId, setSelectedAdId] = useState<string>("");
  const [showArchivedCampaigns, setShowArchivedCampaigns] = useState(false);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");
  const [adSearchQuery, setAdSearchQuery] = useState("");

  const targetCprStorageKey = adAccountId
    ? `haspro_target_cpr_${encodeURIComponent(adAccountId)}`
    : null;
  // Keep the target isolated to the selected ad account. useSyncExternalStore
  // keeps the localStorage read hydration-safe and listens for same-tab saves.
  const storedTargetCpr = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener("target-cpr-storage-change", onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("target-cpr-storage-change", onStoreChange);
      };
    },
    () => {
      if (!targetCprStorageKey) return null;
      try {
        const saved = window.localStorage.getItem(targetCprStorageKey);
        const parsed = saved ? Number(saved) : NaN;
        return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      } catch {
        return null;
      }
    },
    () => null
  );
  const targetCpr = storedTargetCpr;
  const [targetCprDraft, setTargetCprDraft] = useState<{ key: string | null; value: string }>({ key: null, value: "" });
  const targetCprInput = targetCprDraft.key === targetCprStorageKey
    ? targetCprDraft.value
    : targetCpr ? String(targetCpr) : "";

  // Accordions
  const [showExtraMetrics, setShowExtraMetrics] = useState(false);
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);

  // Request & Output states. An analysis is only shown for the account it
  // was computed for; switching accounts hides the previous account's result.
  const [storedAnalysis, setAnalysis] = useState<PerformanceAnalysisOutput | null>(null);
  const [analysisAccountId, setAnalysisAccountId] = useState<string | null>(null);
  const analysis =
    analysisAccountId === (adAccountId || null) ? storedAnalysis : null;
  const [lastAnalyzedScopeContext, setLastAnalyzedScopeContext] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Concurrency guard
  const isAnalyzingRef = useRef(false);
  const idempotencyRef = useRef(new IdempotencyKeyManager());

  const saveTargetCpr = (val: number | null) => {
    try {
      if (targetCprStorageKey) {
        if (val && val > 0) {
          localStorage.setItem(targetCprStorageKey, String(val));
        } else {
          localStorage.removeItem(targetCprStorageKey);
        }
        window.dispatchEvent(new Event("target-cpr-storage-change"));
      }
    } catch {
      // Ignore
    }
    setTargetCprDraft({ key: targetCprStorageKey, value: val ? String(val) : "" });
    if (val) {
      addToast(
        "success",
        locale === "id" ? "Target CPR Tersimpan" : "Target CPR Saved",
        `Target diatur ke ${formatAccountMoney(val, accountCurrency)}`
      );
    } else {
      addToast(
        "info",
        locale === "id" ? "Target CPR Direset" : "Target CPR Reset",
        locale === "id" ? "Target CPR dikembalikan ke mode tanpa target" : "Target CPR reset to no target"
      );
    }
  };

  // Effective Campaign ID (auto-selects first active or available campaign)
  const effectiveCampaignId = useMemo(() => {
    if (selectedCampaignId && campaigns.some((c) => c.id === selectedCampaignId)) {
      return selectedCampaignId;
    }
    const firstActive = campaigns.find((c) => c.status === "ACTIVE");
    return firstActive?.id || campaigns[0]?.id || "";
  }, [selectedCampaignId, campaigns]);

  // Grouped campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const q = campaignSearchQuery.toLowerCase().trim();
      const matchName = cleanEntityName(c.name).toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
      const isArchived = c.status === "ARCHIVED" || c.status === "DELETED";
      if (!showArchivedCampaigns && isArchived) return false;
      return matchName;
    });
  }, [campaigns, campaignSearchQuery, showArchivedCampaigns]);

  // Filtered ads
  const filteredAds = useMemo(() => {
    return ads.filter((a) => {
      const q = adSearchQuery.toLowerCase().trim();
      const matchName = cleanEntityName(a.adName).toLowerCase().includes(q) || a.adName.toLowerCase().includes(q);
      return matchName;
    });
  }, [ads, adSearchQuery]);

  // Effective Ad ID (auto-selects first active or available ad)
  const effectiveAdId = useMemo(() => {
    if (selectedAdId && ads.some((a) => a.id === selectedAdId)) {
      return selectedAdId;
    }
    // Prefer active ad from selected campaign
    const fromSelectedCampaign = ads.find(
      (a) => a.campaignId === effectiveCampaignId && (a.adSettingStatus === "ACTIVE" || a.deliveryStatus === "DELIVERING")
    );
    if (fromSelectedCampaign) return fromSelectedCampaign.id;

    const firstActive = ads.find((a) => a.adSettingStatus === "ACTIVE" || a.deliveryStatus === "DELIVERING");
    return firstActive?.id || ads[0]?.id || "";
  }, [selectedAdId, ads, effectiveCampaignId]);

  // Active target name for context
  const activeTargetName = useMemo(() => {
    if (scope === "account") {
      return cleanEntityName(accountName) || (locale === "id" ? "Seluruh Akun" : "All Accounts");
    }
    if (scope === "campaign") {
      const cmp = campaigns.find((c) => c.id === effectiveCampaignId);
      return cmp ? cleanEntityName(cmp.name) : (locale === "id" ? "Campaign Terpilih" : "Selected Campaign");
    }
    if (scope === "ad") {
      const ad = ads.find((a) => a.id === effectiveAdId);
      return ad ? cleanEntityName(ad.adName) : (locale === "id" ? "Iklan Terpilih" : "Selected Ad");
    }
    return locale === "id" ? "Seluruh Akun" : "All Accounts";
  }, [scope, effectiveCampaignId, effectiveAdId, campaigns, ads, accountName, locale]);

  // Live Scope Preview Metrics (authentic data from current props)
  const liveScopePreview = useMemo(() => {
    if (scope === "campaign") {
      const cmp = campaigns.find((c) => c.id === effectiveCampaignId);
      const spend = cmp?.spend ?? 0;
      const impressions = cmp?.impressions ?? 0;
      const linkClicks = cmp?.linkClicks ?? 0;
      const results = cmp?.results ?? 0;
      const cpr = cmp?.costPerResult ?? (results > 0 ? spend / results : null);
      const ctr = cmp?.linkCtr ?? (impressions > 0 ? (linkClicks / impressions) * 100 : 0);
      const cvr = linkClicks > 0 ? (results / linkClicks) * 100 : 0;
      return {
        spend,
        impressions,
        linkClicks,
        results,
        cpr,
        ctr,
        cvr,
        status: cmp?.status || "UNKNOWN",
        subLabel: cmp ? `${cmp.activeAdsCount}/${cmp.totalAdsCount} Ads` : "—",
      };
    }
    if (scope === "ad") {
      const ad = ads.find((a) => a.id === effectiveAdId);
      const spend = ad?.spend ?? 0;
      const impressions = ad?.impressions ?? 0;
      const linkClicks = ad?.linkClicks ?? 0;
      const results = ad?.results ?? 0;
      const cpr = ad?.costPerResult ?? (results > 0 ? spend / results : null);
      const ctr = ad?.linkCtr ?? (impressions > 0 ? (linkClicks / impressions) * 100 : 0);
      const cvr = linkClicks > 0 ? (results / linkClicks) * 100 : 0;
      return {
        spend,
        impressions,
        linkClicks,
        results,
        cpr,
        ctr,
        cvr,
        status: ad?.deliveryStatus === "DELIVERING" ? "ACTIVE" : ad?.adSettingStatus || "PAUSED",
        subLabel: ad ? cleanEntityName(ad.campaignName) : "—",
      };
    }
    // Account scope
    const spend = campaigns.reduce((acc, c) => acc + (c.spend || 0), 0);
    const impressions = campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0);
    const linkClicks = campaigns.reduce((acc, c) => acc + (c.linkClicks || 0), 0);
    const results = campaigns.reduce((acc, c) => acc + (c.results || 0), 0);
    const cpr = results > 0 ? spend / results : null;
    const ctr = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
    const cvr = linkClicks > 0 ? (results / linkClicks) * 100 : 0;
    const activeCampaignCount = campaigns.filter((c) => c.status === "ACTIVE").length;
    return {
      spend,
      impressions,
      linkClicks,
      results,
      cpr,
      ctr,
      cvr,
      status: activeCampaignCount > 0 ? "ACTIVE" : "PAUSED",
      subLabel: `${campaigns.length} Campaigns · ${ads.length} Ads`,
    };
  }, [scope, campaigns, ads, effectiveCampaignId, effectiveAdId]);

  const periodText = useMemo(() => {
    switch (period) {
      case "1d":
        return locale === "id" ? "1 Hari (Monitoring)" : "1 Day (Monitoring)";
      case "3d":
        return locale === "id" ? "3 Hari (Diagnostik)" : "3 Days (Diagnostic)";
      case "7d":
        return locale === "id" ? "7 Hari (Evaluasi Rutin)" : "7 Days (Routine)";
      case "14d":
        return locale === "id" ? "14 Hari (Evaluasi Mendalam)" : "14 Days (In-Depth)";
      case "30d":
        return locale === "id" ? "30 Hari (Evaluasi Bisnis)" : "30 Days (Business)";
      case "custom":
        return customSince && customUntil
          ? `${customSince} – ${customUntil}`
          : locale === "id"
          ? "Rentang Khusus"
          : "Custom Range";
      default:
        return locale === "id" ? "7 Hari (Rutin)" : "7 Days (Routine)";
    }
  }, [period, customSince, customUntil, locale]);

  const scopeText =
    scope === "account"
      ? locale === "id" ? "Akun" : "Account"
      : scope === "campaign"
      ? locale === "id" ? "Kampanye" : "Campaign"
      : locale === "id" ? "Iklan" : "Ad";
  const currentSelectionLabel = `${periodText} · ${scopeText}: ${activeTargetName}`;

  const isSelectionStale =
    analysis !== null &&
    lastAnalyzedScopeContext !== null &&
    lastAnalyzedScopeContext !== currentSelectionLabel;

  // Manual Trigger Only
  const runPerformanceAnalysis = async () => {
    if (isAnalyzingRef.current || isLoading) return;
    if (quota?.remaining === 0) {
      setError(locale === "id" ? "Kuota analisis gratis Anda telah habis. Lihat waktu reset di Pengaturan." : "Your free analysis quota is exhausted. Check the reset time in Settings.");
      return;
    }
    isAnalyzingRef.current = true;
    setIsLoading(true);
    setError(null);

    const targetId = scope === "campaign" ? effectiveCampaignId : scope === "ad" ? effectiveAdId : undefined;

    try {
      const analysisContext = `analyze-performance:${scope}:${targetId || "account"}:${period}:${customSince || ""}:${customUntil || ""}:${adAccountId || ""}`;
      const res = await fetch("/api/ai/analyze-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyRef.current.keyFor(analysisContext) },
        body: JSON.stringify({
          scope,
          period,
          dateRange: currentDateRange || undefined,
          targetId,
          adAccountId: adAccountId || undefined,
          customSince: period === "custom" && customSince ? customSince : undefined,
          customUntil: period === "custom" && customUntil ? customUntil : undefined,
          targetCpr: targetCpr || undefined,
          locale,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || (locale === "id" ? "Gagal memproses analisis performa iklan." : "Failed to process ad performance analysis."));
      }

      const json = await res.json();
      if (json.success && json.data) {
        idempotencyRef.current.complete(analysisContext);
        setAnalysis(json.data);
        setAnalysisAccountId(adAccountId || null);
        setLastAnalyzedScopeContext(currentSelectionLabel);
        addToast(
          "success",
          locale === "id" ? "Analisis Selesai" : "Analysis Complete",
          locale === "id"
            ? `Evaluasi performa untuk ${currentSelectionLabel} berhasil diperbarui.`
            : `Performance evaluation for ${currentSelectionLabel} has been updated.`
        );
        setError(null);
        void refreshQuota();
      } else {
        throw new Error(locale === "id" ? "Format respons tidak valid." : "Invalid response format.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === "id"
          ? "Terjadi kesalahan saat memproses analisis. Data iklan tetap aman."
          : "An error occurred while processing analysis. Ad data remains safe."
      );
      addToast(
        "error",
        locale === "id" ? "Gagal Analisis Performa" : "Analysis Failed",
        err instanceof Error ? err.message : (locale === "id" ? "Terjadi kesalahan saat memproses analisis." : "An error occurred while processing analysis.")
      );
    } finally {
      setIsLoading(false);
      isAnalyzingRef.current = false;
      void refreshQuota();
    }
  };

  const copyActionToClipboard = (action: PerformanceAnalysisOutput["actions"][0]) => {
    const textToCopy =
      locale === "id"
        ? `[REKOMENDASI ANALISIS IKLAN]\nPrioritas: ${action.priority.toUpperCase()}\nTindakan: ${action.title}\nAlasan Analitis: ${action.why}\nLangkah Eksekusi: ${action.do}\nBatas Aman (Stop-Loss): ${action.stop_loss}`
        : `[AD ANALYSIS RECOMMENDATION]\nPriority: ${action.priority.toUpperCase()}\nAction: ${action.title}\nAnalytical Reason: ${action.why}\nExecution Step: ${action.do}\nStop-Loss Guardrail: ${action.stop_loss}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      addToast(
        "success",
        locale === "id" ? "Aksi Disalin" : "Action Copied",
        locale === "id" ? `"${action.title}" disalin ke clipboard.` : `"${action.title}" copied to clipboard.`
      );
    }
  };

  // Verdict & Action styling (Section E: 3 distinct outputs)
  const actionKey = analysis?.evaluator?.action || (analysis?.verdict.status === "stop" ? "hentikan_sementara" : analysis?.verdict.status === "optimize" ? "optimasi" : "pantau");
  const actionStyleMap: Record<string, { badgeBg: string; badgeText: string; badgeDot: string; borderColor: string; sparkColor: string; glowBg: string }> = {
    pantau: {
      badgeBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      badgeText: locale === "id" ? "PANTAU" : "MONITOR",
      badgeDot: "bg-sky-500",
      borderColor: "border-t-sky-500",
      sparkColor: "#0284c7",
      glowBg: "from-sky-500/10 via-transparent to-transparent",
    },
    periksa_tracking: {
      badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      badgeText: locale === "id" ? "PERIKSA TRACKING" : "CHECK TRACKING",
      badgeDot: "bg-amber-500",
      borderColor: "border-t-amber-500",
      sparkColor: "#f59e0b",
      glowBg: "from-amber-500/10 via-transparent to-transparent",
    },
    optimasi: {
      badgeBg: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
      badgeText: locale === "id" ? "OPTIMASI" : "OPTIMIZE",
      badgeDot: "bg-orange-500",
      borderColor: "border-t-orange-500",
      sparkColor: "#f97316",
      glowBg: "from-orange-500/10 via-transparent to-transparent",
    },
    pertahankan: {
      badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      badgeText: locale === "id" ? "PERTAHANKAN" : "MAINTAIN",
      badgeDot: "bg-emerald-500",
      borderColor: "border-t-emerald-500",
      sparkColor: "#10b981",
      glowBg: "from-emerald-500/10 via-transparent to-transparent",
    },
    kurangi: {
      badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      badgeText: locale === "id" ? "KURANGI BUDGET" : "SCALE DOWN",
      badgeDot: "bg-amber-500",
      borderColor: "border-t-amber-500",
      sparkColor: "#f59e0b",
      glowBg: "from-amber-500/10 via-transparent to-transparent",
    },
    hentikan_sementara: {
      badgeBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      badgeText: locale === "id" ? "HENTIKAN SEMENTARA" : "PAUSE TEMPORARILY",
      badgeDot: "bg-rose-500",
      borderColor: "border-t-rose-500",
      sparkColor: "#e11d48",
      glowBg: "from-rose-500/10 via-transparent to-transparent",
    },
    tinjau_reaktivasi: {
      badgeBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      badgeText: locale === "id" ? "TINJAU HISTORI" : "REVIEW HISTORY",
      badgeDot: "bg-sky-500",
      borderColor: "border-t-sky-500",
      sparkColor: "#0284c7",
      glowBg: "from-sky-500/10 via-transparent to-transparent",
    },
    reaktivasi: {
      badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      badgeText: locale === "id" ? "AKTIFKAN KEMBALI" : "RE-ACTIVATE",
      badgeDot: "bg-emerald-500",
      borderColor: "border-t-emerald-500",
      sparkColor: "#059669",
      glowBg: "from-emerald-500/10 via-transparent to-transparent",
    },
  };
  const activeActionStyle = actionStyleMap[actionKey] || actionStyleMap.pantau;
  const verdictBadgeText: Record<PerformanceAnalysisOutput["verdict"]["status"], string> = {
    scale: locale === "id" ? "TINGKATKAN ANGGARAN" : "SCALE BUDGET",
    maintain: locale === "id" ? "PERTAHANKAN" : "MAINTAIN",
    optimize: locale === "id" ? "OPTIMASI" : "OPTIMIZE",
    stop: locale === "id" ? "JEDA / EVALUASI" : "PAUSE / EVALUATE",
  };
  const activeVerdictBadgeText = analysis ? verdictBadgeText[analysis.verdict.status] : activeActionStyle.badgeText;
  const pausedEntity = analysis?.evaluator?.entity_status === "PAUSED" || analysis?.evaluator?.entity_status === "ARCHIVED";
  const spendValue = analysis?.metrics.find((metric) => metric.key === "spend")?.value ?? 0;
  const primaryBadgeText = !pausedEntity
    ? activeVerdictBadgeText
    : analysis?.evaluator?.action === "reaktivasi"
      ? locale === "id" ? "AKTIFKAN KEMBALI" : "RE-ACTIVATE"
      : analysis?.evaluator?.action === "tinjau_reaktivasi"
      ? locale === "id" ? "TINJAU HISTORI" : "REVIEW HISTORY"
      : analysis?.evaluator?.action === "pantau" || spendValue === 0
        ? locale === "id" ? "DIJEDA (TANPA DATA)" : "PAUSED (NO DATA)"
        : locale === "id" ? "EVALUASI ULANG" : "RE-EVALUATE";

  const dataStatus = analysis?.evaluator?.data_status || "terbatas";
  const dataStatusStyleMap: Record<string, { label: string; bg: string; dot: string }> = {
    cukup: {
      label: locale === "id" ? "Data Memadai" : "Sufficient Data",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      dot: "bg-emerald-500",
    },
    terbatas: {
      label: locale === "id" ? "Data Terbatas" : "Limited Data",
      bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      dot: "bg-amber-500",
    },
    tidak_valid: {
      label: locale === "id" ? "Data Belum Valid" : "Invalid Data",
      bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      dot: "bg-rose-500",
    },
  };
  const activeDataStatusStyle = dataStatusStyleMap[dataStatus] || dataStatusStyleMap.terbatas;

  const performanceStatus = analysis?.evaluator?.performance_status || "belum_dapat_dinilai";
  const performanceStatusStyleMap: Record<string, { label: string; bg: string }> = {
    memenuhi_target: {
      label: analysis?.evaluator?.performance_status === "memenuhi_target" && (analysis.metrics.find((metric) => metric.key === "cpr")?.vs_target === "no_target")
        ? locale === "id" ? "Target belum diatur" : "Target not set"
        : locale === "id" ? "Sesuai Target" : "On Target",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    },
    di_atas_target: {
      label: locale === "id" ? "Biaya di Atas Target" : "Cost Above Target",
      bg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    },
    belum_dapat_dinilai: {
      label: locale === "id" ? "Belum Dapat Dinilai" : "Not Evaluable Yet",
      bg: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    },
  };
  const activePerformanceStatusStyle = performanceStatusStyleMap[performanceStatus] || performanceStatusStyleMap.belum_dapat_dinilai;

  const intlLocale = locale === "id" ? "id-ID" : "en-US";
  const cprComparisonRatio =
    targetCpr && liveScopePreview.cpr && liveScopePreview.cpr > 0
      ? Math.min(100, Math.round((targetCpr / liveScopePreview.cpr) * 100))
      : null;
  const isPreviewCprHealthy =
    targetCpr !== null && liveScopePreview.cpr !== null && liveScopePreview.cpr <= targetCpr;

  return (
    <section
      aria-label="AI Ads Performance Analyst"
      className="w-full min-w-0 space-y-5"
    >
      {/* ================================================================= */}
      {/* COMMAND CENTER & INTERACTIVE SCOPE SELECTOR                       */}
      {/* ================================================================= */}
      <div className="surface-card relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        {/* Ambient Solar & Indigo Glow */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-amber-400/15 via-indigo-500/5 to-transparent blur-3xl dark:from-amber-400/15 dark:via-indigo-500/10"
          aria-hidden="true"
        />

        {/* Top Header Row: Title, Solar Badge & Period Context */}
        <div className="relative mb-5 flex flex-col gap-3 border-b border-zinc-100 pb-5 dark:border-zinc-800/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-600 ring-1 ring-amber-500/25 dark:from-amber-400/15 dark:to-orange-500/10 dark:text-amber-400 dark:ring-amber-400/25 shadow-2xs">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {locale === "id" ? "Analisis Performa AI" : "AI Ads Performance Analyst"}
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Solar Intelligence
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {locale === "id"
                  ? "Ringkasan eksekutif, evaluasi metrik terhadap target CPR, dan rekomendasi taktis berbasis data Meta Ads."
                  : "Executive summary, metric evaluations against target CPR, and tactical recommendations based on selected ad data."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-zinc-50/90 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-200">
              <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="font-semibold">{periodText}</span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{timezone || "Asia/Jakarta"}</span>
            </div>
          </div>
        </div>

        {/* Main Configuration Grid: 3-Card Scope Selector + Target CPR Configurator */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
            {/* Left 7 Cols: Interactive 3-Level Scope Cards */}
            <div className="flex flex-col justify-between space-y-2 lg:col-span-7">
              <div className="flex items-center justify-between px-0.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
                  {locale === "id" ? "1. Pilih Cakupan Analisis (Analysis Scope)" : "1. Select Analysis Scope"}
                </label>
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-[220px]">
                  {activeTargetName}
                </span>
              </div>

              <div
                role="group"
                aria-label={locale === "id" ? "Cakupan analisis" : "Analysis scope"}
                className="grid grid-cols-3 gap-2.5"
              >
                {(
                  [
                    {
                      key: "account" as const,
                      label: locale === "id" ? "Akun" : "Account",
                      badge: `${campaigns.length} Camp`,
                      desc: locale === "id" ? "Audit & peringkat akun" : "Holistic ranking & budget",
                    },
                    {
                      key: "campaign" as const,
                      label: locale === "id" ? "Kampanye" : "Campaign",
                      badge: `${campaigns.filter((c) => c.status === "ACTIVE").length} Active`,
                      desc: locale === "id" ? "Evaluasi 1 kampanye" : "Single campaign deep-dive",
                    },
                    {
                      key: "ad" as const,
                      label: locale === "id" ? "Iklan" : "Ad",
                      badge: `${ads.length} Ads`,
                      desc: locale === "id" ? "Diagnostik materi iklan" : "Creative & hook audit",
                    },
                  ]
                ).map((item) => {
                  const selected = scope === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setScope(item.key)}
                      className={`group relative flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer ${
                        selected
                          ? "border-amber-500/60 bg-gradient-to-br from-amber-50/80 via-white to-white shadow-xs ring-1 ring-amber-500/20 dark:border-amber-400/50 dark:from-amber-950/30 dark:via-zinc-800/90 dark:to-zinc-800/90"
                          : "border-zinc-200/80 bg-zinc-50/60 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                            selected
                              ? "bg-amber-500 text-white shadow-2xs"
                              : "bg-zinc-200/70 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {item.key === "account" && (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            </svg>
                          )}
                          {item.key === "campaign" && (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="12 2 2 7 12 12 22 7 12 2" />
                              <polyline points="2 17 12 22 22 17" />
                              <polyline points="2 12 12 17 22 12" />
                            </svg>
                          )}
                          {item.key === "ad" && (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="3" width="20" height="14" rx="2" />
                              <line x1="8" y1="21" x2="16" y2="21" />
                              <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                          )}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            selected
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-zinc-200/70 text-zinc-500 dark:bg-zinc-700/70 dark:text-zinc-400"
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <p className={`text-xs font-bold ${selected ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-200"}`}>
                          {item.label}
                        </p>
                        <p className="mt-0.5 hidden text-[10px] text-zinc-500 dark:text-zinc-400 sm:block">
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 5 Cols: Target CPR Configurator with Quick Presets */}
            <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40 lg:col-span-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="ai-target-cpr" className="block text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
                    2. Target CPR <span className="font-normal lowercase text-zinc-400">(Cost Per Result)</span>
                  </label>
                  {targetCprStorageKey && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        targetCpr
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-zinc-200/70 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${targetCpr ? "bg-emerald-500" : "bg-zinc-400"}`} />
                      {targetCpr
                        ? locale === "id" ? "Target Aktif" : "Target Active"
                        : locale === "id" ? "Khusus Akun Ini" : "Account Specific"}
                    </span>
                  )}
                </div>

                <div className="flex h-10 items-center overflow-hidden rounded-xl border border-zinc-200/90 bg-white transition-all focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-900">
                  <div className="flex h-full items-center border-r border-zinc-200/90 bg-zinc-50/90 px-3 text-xs font-bold font-mono text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-300">
                    {accountCurrency === "IDR" ? "Rp" : accountCurrency}
                  </div>
                  <input
                    id="ai-target-cpr"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1000"
                    value={targetCprInput}
                    onChange={(event) => setTargetCprDraft({ key: targetCprStorageKey, value: event.target.value })}
                    onBlur={() => {
                      const parsed = Number(targetCprInput);
                      if (!targetCprInput.trim()) saveTargetCpr(null);
                      else if (parsed > 0) saveTargetCpr(parsed);
                      else setTargetCprDraft({ key: targetCprStorageKey, value: targetCpr ? String(targetCpr) : "" });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                    disabled={!targetCprStorageKey}
                    placeholder={locale === "id" ? "Contoh: 10000" : "Example: 10000"}
                    aria-describedby="ai-target-cpr-help"
                    className="w-full bg-transparent px-3 text-sm font-semibold tabular-nums text-zinc-900 outline-none placeholder:font-normal placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-100"
                  />
                  {targetCpr && (
                    <button
                      type="button"
                      onClick={() => saveTargetCpr(null)}
                      className="mr-2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 cursor-pointer"
                      aria-label={locale === "id" ? "Hapus target CPR akun ini" : "Clear this account's CPR target"}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                  {locale === "id" ? "Preset Cepat:" : "Quick Presets:"}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {TARGET_CPR_PRESETS.map((preset) => {
                    const isSelected = targetCpr === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        disabled={!targetCprStorageKey}
                        onClick={() => saveTargetCpr(preset.value)}
                        className={`rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-40 ${
                          isSelected
                            ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-amber-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {locale === "id" ? preset.labelId : preset.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Entity Picker Bar when Campaign or Ad Scope is Selected */}
          {scope !== "account" && (
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                {scope === "campaign" ? (
                  <label className="min-w-0 space-y-1.5">
                    <span className="block px-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                      {locale === "id" ? "Pilih Kampanye untuk Dianalisis" : "Select Campaign to Analyze"}
                    </span>
                    <div className="relative">
                      <select
                        value={effectiveCampaignId}
                        onChange={(event) => setSelectedCampaignId(event.target.value)}
                        className="w-full appearance-none rounded-xl border border-zinc-200/90 bg-white py-2 pl-3 pr-9 text-xs font-semibold text-zinc-800 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 cursor-pointer"
                      >
                        {filteredCampaigns.map((campaign) => (
                          <option key={campaign.id} value={campaign.id}>
                            {cleanEntityName(campaign.name)}{campaign.status === "PAUSED" ? ` (${locale === "id" ? "Dijeda" : "Paused"})` : ""} — {formatAccountMoney(campaign.spend, accountCurrency, locale)}
                          </option>
                        ))}
                        {!filteredCampaigns.length && <option value="">{locale === "id" ? "Tidak ada kampanye" : "No campaigns"}</option>}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </label>
                ) : (
                  <label className="min-w-0 space-y-1.5">
                    <span className="block px-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                      {locale === "id" ? "Pilih Materi Iklan (Ad)" : "Select Ad Creative"}
                    </span>
                    <div className="relative">
                      <select
                        value={effectiveAdId}
                        onChange={(event) => setSelectedAdId(event.target.value)}
                        className="w-full appearance-none rounded-xl border border-zinc-200/90 bg-white py-2 pl-3 pr-9 text-xs font-semibold text-zinc-800 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 cursor-pointer"
                      >
                        {filteredAds.map((ad) => (
                          <option key={ad.id} value={ad.id}>
                            {cleanEntityName(ad.adName)} — {formatAccountMoney(ad.spend, accountCurrency, locale)}
                          </option>
                        ))}
                        {!filteredAds.length && <option value="">{locale === "id" ? "Tidak ada iklan" : "No ads"}</option>}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </label>
                )}

                <label className="space-y-1.5">
                  <span className="block px-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                    {locale === "id" ? "Filter Nama" : "Filter Name"}
                  </span>
                  <div className="relative">
                    <input
                      type="search"
                      value={scope === "campaign" ? campaignSearchQuery : adSearchQuery}
                      onChange={(event) => scope === "campaign" ? setCampaignSearchQuery(event.target.value) : setAdSearchQuery(event.target.value)}
                      placeholder={locale === "id" ? "Cari kata kunci…" : "Search keyword…"}
                      className="w-full rounded-xl border border-zinc-200/90 bg-white py-2 pl-8 pr-3 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:w-48"
                    />
                    <svg className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                </label>

                {scope === "campaign" && campaigns.some((campaign) => campaign.status === "ARCHIVED" || campaign.status === "DELETED") && (
                  <button
                    type="button"
                    onClick={() => setShowArchivedCampaigns((value) => !value)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <span>{showArchivedCampaigns ? (locale === "id" ? "Sembunyikan Arsip" : "Hide Archived") : (locale === "id" ? "Tampilkan Arsip" : "Show Archived")}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action Bar: Sync Status & Analyze CTA */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>
                {locale === "id" ? "Snapshot data Meta: " : "Meta data snapshot: "}
                <time
                  dateTime={lastSyncedAt || undefined}
                  title={lastSyncedAt ? new Date(lastSyncedAt).toLocaleString(locale === "id" ? "id-ID" : "en-US", { timeZone: timezone || "Asia/Jakarta" }) : undefined}
                  className="font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  {lastSyncedAt ? formatRelativeSyncTime(lastSyncedAt, locale) : locale === "id" ? "belum tersedia" : "unavailable"}
                </time>
              </span>

              {canSync && onTriggerSync && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600 hidden sm:inline">|</span>
                  <button
                    type="button"
                    onClick={() => onTriggerSync({ period, since: period === "custom" ? customSince : undefined, until: period === "custom" ? customUntil : undefined })}
                    disabled={isSyncing || (period === "custom" && (!customSince || !customUntil))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    <svg className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6" />
                      <path d="M2.5 11.5a10 10 0 0 1 18.8-4.3L21.5 8M21.5 12.5a10 10 0 0 1-18.8 4.3L2.5 16" />
                    </svg>
                    <span>{isSyncing ? locale === "id" ? "Menyinkronkan…" : "Syncing…" : locale === "id" ? "Sinkronkan Data Terbaru" : "Sync Latest Data"}</span>
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={runPerformanceAnalysis}
              disabled={isLoading || quota?.remaining === 0 || (period === "custom" && (!customSince || !customUntil))}
              title={quota?.remaining === 0 ? (locale === "id" ? "Kuota analisis habis — lihat Pengaturan" : "Analysis quota exhausted — see Settings") : undefined}
              className="btn-solar relative inline-flex min-h-11 w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:cursor-wait disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
                  </svg>
                  <span>{locale === "id" ? "AI Sedang Menganalisis..." : "AI is analyzing..."}</span>
                </>
              ) : (
                <>
                  <span className="text-base" aria-hidden="true">✨</span>
                  <span>{analysis ? locale === "id" ? "Analisis Ulang" : "Re-analyze" : locale === "id" ? "Analisis Performa" : "Analyze Performance"}</span>
                </>
              )}
            </button>
          </div>

          {isSelectionStale && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-xs font-medium text-amber-900 shadow-2xs dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {locale === "id"
                  ? `Cakupan berubah ke "${currentSelectionLabel}". Klik Analisis Ulang untuk memperbarui diagnosis AI.`
                  : `Scope changed to "${currentSelectionLabel}". Click Re-analyze to refresh AI diagnosis.`}
              </span>
              <button
                type="button"
                onClick={runPerformanceAnalysis}
                className="self-start rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-500/30 dark:text-amber-200 sm:self-auto cursor-pointer"
              >
                {locale === "id" ? "Perbarui Sekarang →" : "Refresh Now →"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* PRE-ANALYSIS LIVE TELEMETRY PREVIEW (When !analysis && !isLoading)*/}
      {/* ================================================================= */}
      {!isLoading && !analysis && (
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-zinc-100 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {locale === "id" ? "Pratinjau Data Cakupan" : "Live Scope Telemetry"}
                </span>
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {liveScopePreview.subLabel}
                </span>
              </div>
              <h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">
                {activeTargetName}
              </h3>
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {locale === "id"
                ? "Siap dianalisis · Tekan tombol ✨ Analisis Performa di atas"
                : "Ready for evaluation · Click ✨ Analyze Performance above"}
            </div>
          </div>

          {/* 4 Live Preview Infographic Cards */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Spend */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {locale === "id" ? "Total Belanja (Spend)" : "Total Spend"}
              </span>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatAccountMoney(liveScopePreview.spend, accountCurrency, locale)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {new Intl.NumberFormat(intlLocale).format(liveScopePreview.impressions)} {locale === "id" ? "Impresi" : "Impressions"}
              </p>
            </div>

            {/* 2. Link Clicks & CTR */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {locale === "id" ? "Klik Tautan & CTR" : "Link Clicks & CTR"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                    liveScopePreview.ctr >= 1
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  CTR {liveScopePreview.ctr.toFixed(2)}%
                </span>
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {new Intl.NumberFormat(intlLocale).format(liveScopePreview.linkClicks)}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-full rounded-full ${liveScopePreview.ctr >= 1 ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(100, Math.max(6, (liveScopePreview.ctr / 2) * 100))}%` }}
                />
              </div>
            </div>

            {/* 3. Conversion Results */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {locale === "id" ? "Hasil Konversi" : "Conversion Results"}
                </span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                  CVR {liveScopePreview.cvr.toFixed(1)}%
                </span>
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {new Intl.NumberFormat(intlLocale).format(liveScopePreview.results)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {locale === "id" ? "Konversi dari klik tautan" : "Conversions from link clicks"}
              </p>
            </div>

            {/* 4. Actual CPR vs Target CPR */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {locale === "id" ? "CPR Aktual vs Target" : "Actual vs Target CPR"}
                </span>
                {targetCpr && liveScopePreview.cpr !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isPreviewCprHealthy
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {isPreviewCprHealthy
                      ? locale === "id" ? "Sesuai Target ✓" : "On Target ✓"
                      : locale === "id" ? "Di Atas Target" : "Above Target"}
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {liveScopePreview.cpr !== null
                  ? formatAccountMoney(liveScopePreview.cpr, accountCurrency, locale)
                  : "—"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {targetCpr
                  ? `Target: ${formatAccountMoney(targetCpr, accountCurrency, locale)}`
                  : locale === "id" ? "Target CPR belum diatur" : "Target CPR not set"}
              </p>
              {cprComparisonRatio !== null && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className={`h-full rounded-full ${isPreviewCprHealthy ? "bg-emerald-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.max(10, cprComparisonRatio)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3-Pillar AI Blueprint Strip */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800 sm:grid-cols-3">
            <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50/70 p-3 dark:bg-zinc-800/30">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                01
              </span>
              <div>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {locale === "id" ? "Keputusan Eksekutif & Validitas Data" : "Executive Decision & Data Validity"}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {locale === "id" ? "Rekomendasi Scale, Maintain, Optimize, atau Pause." : "Clear Scale, Maintain, Optimize, or Pause verdict."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50/70 p-3 dark:bg-zinc-800/30">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                02
              </span>
              <div>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {locale === "id" ? "Audit Funnel & Sinyal Diagnostik" : "Funnel Audit & Diagnostic Signals"}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {locale === "id" ? "Deteksi kebocoran CTR, kejenuhan audiens, & anomali CPR." : "Pinpoints CTR drop-offs, creative fatigue, & CPR anomalies."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50/70 p-3 dark:bg-zinc-800/30">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                03
              </span>
              <div>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {locale === "id" ? "Playbook Taktis & Batas Stop-Loss" : "Tactical Playbook & Stop-Loss Caps"}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {locale === "id" ? "Langkah eksekusi konkret beserta batas aman anggaran." : "Step-by-step actions with strict budget guardrails."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <span className="font-bold">
            {locale === "id" ? "Gagal Menganalisis:" : "Analysis Failed:"}
          </span>{" "}
          {error}
        </div>
      )}

      {/* Skeleton Loading State */}
      {isLoading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-6 w-48 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-5 w-32 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="h-44 bg-zinc-100 dark:bg-zinc-800 rounded-xl lg:col-span-5" />
            <div className="h-44 bg-zinc-100 dark:bg-zinc-800 rounded-xl lg:col-span-7" />
          </div>
        </div>
      )}

      {/* Main Analysis Output (4 Blocks) */}
      {!isLoading && analysis && (
        <div className="space-y-5">
          {scope === "account" && analysis.account_intelligence && (
            <AccountIntelligenceReportView
              report={analysis.account_intelligence}
              currency={accountCurrency}
              locale={locale === "en" ? "en" : "id"}
            />
          )}
          {!accountReportSupersedesLegacyDecision(scope, Boolean(analysis.account_intelligence)) && <>
          {/* ======================================================== */}
          {/* BLOK 1 — VERDICT & DECISION CARD (Section E, F, H)       */}
          {/* ======================================================== */}
          <div
            className={`relative overflow-hidden rounded-2xl border border-zinc-200 border-t-4 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 ${activeActionStyle.borderColor}`}
          >
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${activeActionStyle.glowBg}`}
              aria-hidden="true"
            />

            {/* Top Row: 3 Distinct Decision Outputs + Context Metadata */}
            <div className="relative flex flex-col gap-3 border-b border-zinc-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Action Prescribed */}
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold tracking-[0.06em] ${activeActionStyle.badgeBg}`}>
                  <span className={`h-2 w-2 rounded-full ${activeActionStyle.badgeDot}`} />
                  {primaryBadgeText}
                </span>

                {/* 2. Data Sufficiency Status */}
                {analysis.evaluator && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${activeDataStatusStyle.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${activeDataStatusStyle.dot}`} />
                    {activeDataStatusStyle.label}
                  </span>
                )}

                {/* 3. Performance Status */}
                {analysis.evaluator && (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${activePerformanceStatusStyle.bg}`}>
                    {activePerformanceStatusStyle.label}
                  </span>
                )}
              </div>

              {/* Reporting Range & Timezone */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-medium">
                  {analysis.evaluator
                    ? locale === "id"
                      ? `${analysis.evaluator.date_range.since} s/d ${analysis.evaluator.date_range.until} (${analysis.evaluator.duration_days} hari)`
                      : `${analysis.evaluator.date_range.since} to ${analysis.evaluator.date_range.until} (${analysis.evaluator.duration_days} days)`
                    : analysis.meta.period}
                </span>
                <span>·</span>
                <span className="font-mono">{analysis.evaluator?.timezone || timezone || "Asia/Jakarta"}</span>
                {analysis.context_awareness && (
                  <>
                    <span>·</span>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {analysis.context_awareness.analyzed_scope} · {analysis.context_awareness.entity_status} · {locale === "id" ? "keyakinan" : "confidence"} {analysis.context_awareness.period_confidence}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Headline and Subtext */}
            <div className="relative mt-4 space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-snug">
                {analysis.verdict.headline}
              </h2>
              <p className="max-w-4xl text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {analysis.verdict.subtext}
              </p>
            </div>

            {/* Metadata Bar: Learning Status & Tracking Status */}
            {analysis.evaluator && (
              <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3.5 text-[11px] dark:border-zinc-800">
                {scope !== "account" && analysis.evaluator.learning_status && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300">
                    <span className="text-zinc-400">{locale === "id" ? "Fase Pembelajaran:" : "Learning Phase:"}</span>
                    <strong>{analysis.evaluator.learning_status}</strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300">
                  <span className="text-zinc-400">{locale === "id" ? "Sumber Konversi:" : "Conversion Source:"}</span>
                  <strong>{analysis.evaluator.tracking_status}</strong>
                </span>
                {analysis.evaluator.data_status_reason && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    · {analysis.evaluator.data_status_reason}
                  </span>
                )}
              </div>
            )}

            {/* Uncertainty Callout if present */}
            {analysis.evaluator?.uncertainty_notes && analysis.evaluator.uncertainty_notes.length > 0 && (
              <div className="relative mt-3.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200 space-y-1">
                {analysis.evaluator.uncertainty_notes.map((note, nIdx) => (
                  <p key={nIdx} className="leading-relaxed">
                    ⚠️ {note}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* BLOK 2 — METRIK UTAMA (Grid 4 Kartu)                    */}
          {/* ======================================================== */}
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {analysis.metrics.map((m) => {
                const isCpr = m.key === "cpr";
                const isPositiveDelta = (m.delta_pct ?? 0) > 0;
                // For CPR, down is good (green), up is bad (red)
                const isDeltaGood = isCpr ? !isPositiveDelta : isPositiveDelta;
                const isBaselineZero = m.delta_note === "Pembanding 0" || m.delta_note === "Baseline 0" || m.delta_note === "Belum ada data di periode pembanding";

                return (
                  <div
                    key={m.key}
                    className="flex min-w-0 flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
                  >
                    <div>
                      <div className="flex min-h-5 items-center justify-between gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        <span>{locale === "en" ? ANALYST_METRIC_LABELS_EN[m.key] : (m.label || ANALYST_METRIC_LABELS_ID[m.key])}</span>
                        {m.vs_target === "better" && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                            {isCpr ? (locale === "id" ? "Sesuai Target ✓" : "On Target ✓") : m.key === "ctr" ? (locale === "id" ? "Sehat ✓" : "Healthy ✓") : (locale === "id" ? "Optimal" : "Optimal")}
                          </span>
                        )}
                        {m.vs_target === "worse" && (isCpr || m.key === "ctr") && (
                          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                            {isCpr ? (locale === "id" ? "Di Atas Target" : "Above Target") : (locale === "id" ? "Rendah" : "Low")}
                          </span>
                        )}
                        {m.vs_target === "on_target" && m.key === "ctr" && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300 font-bold text-[10px]">{locale === "id" ? "Cukup" : "Fair"}</span>
                        )}
                        {m.vs_target === "no_target" && isCpr && !targetCpr && (
                          <span className="text-zinc-400 font-normal text-[10px]">
                            {locale === "id" ? "Tanpa target" : "No target"}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-end justify-between gap-2">
                        <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                          {formatAnalystMetric(m, accountCurrency, locale)}
                        </div>
                        {m.trend_7d && (
                          <Sparkline data={m.trend_7d} color={activeActionStyle.sparkColor} />
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
                      {isBaselineZero ? (
                        <span className="text-zinc-400 font-medium">
                          {locale === "en" && m.delta_note === "Pembanding 0"
                            ? "Baseline 0"
                            : locale === "en" && m.delta_note === "Belum ada data di periode pembanding"
                            ? "No comparison period data"
                            : m.delta_note}
                        </span>
                      ) : m.delta_pct !== null ? (
                        <div
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono font-bold ${
                            isDeltaGood
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          <span>{isPositiveDelta ? "↑" : "↓"}</span>
                          <span>{m.delta_note}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 font-medium">
                          {locale === "en" && (!m.delta_note || m.delta_note === "Belum ada data di periode pembanding")
                            ? "No comparison period data"
                            : m.delta_note || "Belum ada data di periode pembanding"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {analysis.crm_context && (
              <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {locale === "id" ? "Integrasi Hasil CRM pada Periode Ini" : "CRM Outcomes in This Period"}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                    <p className="text-[11px] text-zinc-500">{locale === "id" ? "Prospek Cakupan" : "Scoped Leads"}</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{analysis.crm_context.totalRecords.value ?? (locale === "id" ? "Tidak tersedia" : "Unavailable")}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                    <p className="text-[11px] text-zinc-500">{locale === "id" ? "Prospek Kualifikasi" : "Qualified Leads"}</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{analysis.crm_context.qualifiedLeads.value ?? (locale === "id" ? "Tidak tersedia" : "Unavailable")}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                    <p className="text-[11px] text-zinc-500">Hot / Warm / Cold</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{analysis.crm_context.temperature.hot.value ?? "—"} / {analysis.crm_context.temperature.warm.value ?? "—"} / {analysis.crm_context.temperature.cold.value ?? "—"}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                    <p className="text-[11px] text-zinc-500">CQPL</p>
                    <p className="mt-1 font-mono text-base font-bold text-zinc-900 dark:text-zinc-100">{cqplForScope(analysis.crm_context).status === "available" && cqplForScope(analysis.crm_context).value !== null ? formatDisplayCurrency(cqplForScope(analysis.crm_context).value, locale === "en" ? "en" : "id") : cqplForScope(analysis.crm_context).message}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] leading-5 text-zinc-500">
                  {locale === "id"
                    ? `Prospek Kualifikasi = Hot + Warm. Cold tidak dihitung. Langsung ${analysis.crm_context.attribution.directAd.value ?? "tidak tersedia"} · kampanye ${analysis.crm_context.attribution.campaign.value ?? "tidak tersedia"}. Angka kampanye bukan hasil satu iklan.`
                    : `Qualified Lead = Hot + Warm. Cold is excluded. Direct ad ${analysis.crm_context.attribution.directAd.value ?? "unavailable"} · campaign ${analysis.crm_context.attribution.campaign.value ?? "unavailable"}. Campaign total is not a single ad's result.`}
                </p>
              </div>
            )}

            {/* Accordion: Supporting Metrics */}
            <div className="rounded-2xl border border-zinc-200/90 bg-white px-4 py-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setShowExtraMetrics(!showExtraMetrics)}
                className="w-full flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider text-zinc-600 hover:text-amber-600 dark:text-zinc-300 dark:hover:text-amber-400 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  {locale === "id" ? "Metrik Pendukung Lengkap (CPM, CPC, Frekuensi, Jangkauan)" : "Supporting Metrics (CPM, CPC, Frequency, Reach)"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold normal-case tracking-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {showExtraMetrics
                    ? locale === "id" ? "Sembunyikan" : "Hide"
                    : locale === "id" ? "Tampilkan" : "Show"}
                  <span aria-hidden="true">{showExtraMetrics ? "−" : "+"}</span>
                </span>
              </button>

              {showExtraMetrics && (
                <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3.5 text-xs sm:grid-cols-3 lg:grid-cols-6 dark:border-zinc-800">
                  {analysis.extra_metrics.map((em) => (
                    <div key={em.label} className="min-w-0 rounded-xl bg-zinc-50/80 p-3 dark:bg-zinc-800/50">
                      <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{em.label}</p>
                      <p className="mt-1 font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-100 text-sm">
                        {em.display}
                      </p>
                      {em.note && (
                        <p className="mt-0.5 text-[10px] text-zinc-400" title={em.note}>
                          {em.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            {/* ======================================================== */}
            {/* BLOK 3 — KEY DIAGNOSTIC SIGNALS (Infographic Stack)      */}
            {/* ======================================================== */}
            <div className="space-y-3.5 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {locale === "id" ? "Sinyal Diagnostik Utama" : "Key Diagnostic Signals"}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {locale === "id" ? "Temuan anomali & indikator kesehatan iklan" : "Anomaly detection & ad health indicators"}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {analysis.watchouts.length} {locale === "id" ? "Sinyal" : "Signals"}
                </span>
              </div>

              <div className="space-y-3">
                {analysis.watchouts.map((w, idx) => {
                  const style =
                    w.severity === "ok"
                      ? {
                          card: "border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-950/20",
                          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                          dot: "bg-emerald-500",
                          label: locale === "id" ? "Sehat" : "Healthy",
                        }
                      : w.severity === "warn"
                      ? {
                          card: "border-amber-500/25 bg-amber-50/40 dark:bg-amber-950/20",
                          badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                          dot: "bg-amber-500",
                          label: locale === "id" ? "Perhatian" : "Watchout",
                        }
                      : {
                          card: "border-rose-500/25 bg-rose-50/40 dark:bg-rose-950/20",
                          badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                          dot: "bg-rose-500",
                          label: locale === "id" ? "Kritis" : "Critical",
                        };

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3.5 space-y-1.5 ${style.card}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                          <span>{w.title}</span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pl-4">
                        {w.insight}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ======================================================== */}
            {/* BLOK 4 — TACTICAL ACTION PLAYBOOK                        */}
            {/* ======================================================== */}
            <div className="space-y-3.5 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {locale === "id" ? "Playbook Tindakan Taktis" : "Tactical Action Playbook"}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {locale === "id" ? "Langkah eksekusi konkret beserta batas aman (stop-loss)" : "Concrete execution steps with strict stop-loss guardrails"}
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  {analysis.actions.length} {locale === "id" ? "Rekomendasi" : "Actions"}
                </span>
              </div>

              <div className="space-y-3.5">
                {analysis.actions.map((act, idx) => {
                  const priorityBadge =
                    act.priority === "high"
                      ? "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300"
                      : act.priority === "medium"
                      ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-800/30"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-900 font-mono text-xs font-bold tabular-nums text-white dark:bg-zinc-100 dark:text-zinc-900">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {act.title}
                          </h4>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${priorityBadge}`}
                          >
                            {act.priority === "high"
                              ? locale === "id" ? "Prioritas Tinggi" : "High Priority"
                              : act.priority === "medium"
                              ? locale === "id" ? "Prioritas Sedang" : "Medium Priority"
                              : locale === "id" ? "Prioritas Rendah" : "Low Priority"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => copyActionToClipboard(act)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                          title={locale === "id" ? "Salin rekomendasi ini" : "Copy this recommendation"}
                        >
                          <svg className="h-3 w-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{locale === "id" ? "Salin" : "Copy"}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 pt-1 text-xs sm:grid-cols-3">
                        <div className="rounded-lg border border-zinc-200/60 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            {locale === "id" ? "1. Alasan Analitis" : "1. Analytical Reason"}
                          </span>
                          <p className="mt-1 leading-relaxed text-zinc-700 dark:text-zinc-300">{act.why}</p>
                        </div>

                        <div className="rounded-lg border border-indigo-500/20 bg-indigo-50/30 p-3 dark:border-indigo-500/20 dark:bg-indigo-950/20">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                            {locale === "id" ? "2. Langkah Eksekusi" : "2. Execution Step"}
                          </span>
                          <p className="mt-1 leading-relaxed font-semibold text-zinc-900 dark:text-zinc-100">{act.do}</p>
                        </div>

                        <div className="rounded-lg border border-rose-500/20 bg-rose-50/30 p-3 dark:border-rose-500/20 dark:bg-rose-950/20">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                            {locale === "id" ? "3. Batas Aman (Stop-Loss)" : "3. Stop-Loss Guardrail"}
                          </span>
                          <p className="mt-1 leading-relaxed text-zinc-700 dark:text-zinc-300">{act.stop_loss}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </>}

          {/* ======================================================== */}
          {/* FOOTER & DISCLOSURE                                     */}
          {/* ======================================================== */}
          <div className="text-[11px] text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <span>
              {locale === "id"
                ? `Sumber: Snapshot Meta Insights · Diperbarui ${new Date(analysis.meta.generated_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: timezone || "Asia/Jakarta" })} WIB · Mesin: ${analysis.meta.engine === "llm" ? "AI + Evaluasi Deterministik" : "Evaluasi Aturan Deterministik"}`
                : `Source: Meta Insights Snapshot · Updated ${new Date(analysis.meta.generated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: timezone || "Asia/Jakarta" })} · Engine: ${analysis.meta.engine === "llm" ? "AI + Deterministic Evaluation" : "Deterministic Rule-Based Evaluation"}`}
            </span>

            <button
              type="button"
              onClick={() => setShowCalculationDetails(!showCalculationDetails)}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 underline cursor-pointer self-start sm:self-auto"
            >
              {showCalculationDetails
                ? locale === "id" ? "Sembunyikan Dasar Perhitungan" : "Hide Calculation Basis"
                : locale === "id" ? "Lihat Dasar Perhitungan" : "View Calculation Basis"}
            </button>
          </div>

          {showCalculationDetails && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 space-y-1.5 leading-relaxed">
              <p className="font-bold text-zinc-800 dark:text-zinc-200">
                {locale === "id" ? "Dasar Perhitungan & Integritas Metrik:" : "Calculation Basis & Metric Integrity:"}
              </p>
              {locale === "id" ? (
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    <strong>Periode Pembanding:</strong>{" "}
                    Perubahan dibandingkan dengan periode sebelumnya yang durasinya setara. Jika data pembanding tidak tersedia atau bernilai nol, perubahan persentase tidak ditampilkan.
                  </li>
                  <li>
                    <strong>Aturan Batas Aman (Stop-Loss):</strong>{" "}
                    Batas CPR dihitung sebesar 130% dari CPR aktual, lalu dibulatkan ke kelipatan Rp 100 terdekat. Batas frekuensi 2,5x hanya digunakan jika frekuensi tersedia.
                  </li>
                  <li>
                    <strong>Target CPR:</strong>{" "}
                    Target CPR dibandingkan dengan CPR aktual (total belanja dibagi total hasil Meta tercatat). Tanpa target, sistem tidak merekomendasikan peningkatan anggaran.
                  </li>
                  <li>
                    <strong>Rekomendasi Materi Iklan:</strong>{" "}
                    Penyegaran materi diprioritaskan saat CTR tautan di bawah 0,80% dan CPR aktual melebihi target. Indikasi kejenuhan hanya digunakan jika frekuensi tersedia dan mencapai 2,5x.
                  </li>
                </ul>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    <strong>Comparison Period:</strong>{" "}
                    Changes are compared against the preceding period of equal duration. If baseline data is unavailable or zero, percentage change is not shown.
                  </li>
                  <li>
                    <strong>Stop-Loss Guardrail Rule:</strong>{" "}
                    The CPR cap is calculated at 130% of actual CPR, rounded to the nearest Rp 100. The 2.5x frequency cap is only applied when frequency data is available.
                  </li>
                  <li>
                    <strong>Target CPR:</strong>{" "}
                    Target CPR is compared against actual CPR (total spend divided by total recorded Meta results). Without a target, the system does not recommend scaling budget.
                  </li>
                  <li>
                    <strong>Creative Recommendations:</strong>{" "}
                    Creative refresh is prioritized when link CTR is below 0.80% and actual CPR exceeds the target. Audience fatigue indicators are only used when frequency is available and reaches 2.5x.
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
