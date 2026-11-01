"use client";

import React, { useState, useRef, useMemo, useSyncExternalStore } from "react";
import type { PerformanceAnalysisOutput } from "@/app/api/ai/analyze-performance/route";
import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";
import type { RealAdRow } from "@/app/(dashboard)/ads/page";
import { useToast } from "@/components/ui/Toast";
import { useAiQuota } from "@/hooks/useAiQuota";
import { IdempotencyKeyManager } from "@/lib/ai/idempotency-key";

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
  const w = 80;
  const h = 24;
  const pad = 2;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * (w - pad * 2) + pad;
      const y = h - ((val - min) / range) * (h - pad * 2) - pad;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-16 sm:w-20 h-6 shrink-0" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function formatAnalystMetric(metric: PerformanceAnalysisOutput["metrics"][number]): string {
  if (metric.display === "—" || metric.display === "Unavailable") return "Belum tersedia";
  if (metric.key === "spend" || metric.key === "cpr") {
    if (metric.key === "cpr" && metric.display === "Tidak tersedia") return metric.display;
    return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(metric.value))}`;
  }
  if (metric.key === "results") {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(metric.value);
  }
  if (metric.display === "Tidak tersedia") return metric.display;
  return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(metric.value)}%`;
}

const ANALYST_METRIC_LABELS: Record<PerformanceAnalysisOutput["metrics"][number]["key"], string> = {
  spend: "Total Belanja",
  results: "Hasil Konversi",
  cpr: "Biaya per Hasil (CPR)",
  ctr: "CTR Tautan",
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

export function AIAdsPerformanceAnalyst({
  campaigns = [],
  ads = [],
  accountName = "Meta Ads",
  adAccountId = null,
  currency: _currency = "IDR",
  timezone = "Asia/Jakarta",
  currentDateRange: _currentDateRange,
  lastSyncedAt = null,
  canSync = false,
  isSyncing = false,
  onTriggerSync,
}: AIAdsPerformanceAnalystProps) {
  void _currency;
  void _currentDateRange;
  const { addToast } = useToast();
  const locale = String("id");
  const { quota, refresh: refreshQuota } = useAiQuota();

  // Selector states
  const [scope, setScope] = useState<"account" | "campaign" | "ad">("account");
  const [period, setPeriod] = useState<"1d" | "3d" | "7d" | "14d" | "30d" | "custom">("7d");
  const [customSince, setCustomSince] = useState<string>("");
  const [customUntil, setCustomUntil] = useState<string>("");
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
        `Target diatur ke Rp ${new Intl.NumberFormat("id-ID").format(val)}`
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
    } finally {
      setIsLoading(false);
      isAnalyzingRef.current = false;
      void refreshQuota();
    }
  };

  const copyActionToClipboard = (action: PerformanceAnalysisOutput["actions"][0]) => {
    const textToCopy = `[REKOMENDASI ANALISIS IKLAN]\nPrioritas: ${action.priority.toUpperCase()}\nTindakan: ${action.title}\nAlasan Analitis: ${action.why}\nLangkah Eksekusi: ${action.do}\nBatas Aman (Stop-Loss): ${action.stop_loss}`;
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
  const actionStyleMap: Record<string, { badgeBg: string; badgeText: string; badgeDot: string; borderColor: string; sparkColor: string }> = {
    pantau: {
      badgeBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      badgeText: locale === "id" ? "PANTAU" : "MONITOR",
      badgeDot: "bg-sky-500",
      borderColor: "border-t-sky-500",
      sparkColor: "#0284c7",
    },
    periksa_tracking: {
      badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      badgeText: locale === "id" ? "PERIKSA TRACKING" : "CHECK TRACKING",
      badgeDot: "bg-amber-500",
      borderColor: "border-t-amber-500",
      sparkColor: "#f59e0b",
    },
    optimasi: {
      badgeBg: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
      badgeText: locale === "id" ? "OPTIMASI" : "OPTIMIZE",
      badgeDot: "bg-orange-500",
      borderColor: "border-t-orange-500",
      sparkColor: "#f97316",
    },
    pertahankan: {
      badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      badgeText: locale === "id" ? "PERTAHANKAN" : "MAINTAIN",
      badgeDot: "bg-emerald-500",
      borderColor: "border-t-emerald-500",
      sparkColor: "#10b981",
    },
    kurangi: {
      badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      badgeText: locale === "id" ? "KURANGI BUDGET" : "SCALE DOWN",
      badgeDot: "bg-amber-500",
      borderColor: "border-t-amber-500",
      sparkColor: "#f59e0b",
    },
    hentikan_sementara: {
      badgeBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      badgeText: locale === "id" ? "HENTIKAN SEMENTARA" : "PAUSE TEMPORARILY",
      badgeDot: "bg-rose-500",
      borderColor: "border-t-rose-500",
      sparkColor: "#e11d48",
    },
  };
  const activeActionStyle = actionStyleMap[actionKey] || actionStyleMap.pantau;
  const verdictBadgeText: Record<PerformanceAnalysisOutput["verdict"]["status"], string> = {
    scale: "TINGKATKAN BUDGET (SCALE)",
    maintain: "PERTAHANKAN",
    optimize: "OPTIMASI",
    stop: "JEDA / EVALUASI",
  };
  const activeVerdictBadgeText = analysis ? verdictBadgeText[analysis.verdict.status] : activeActionStyle.badgeText;

  const dataStatus = analysis?.evaluator?.data_status || "terbatas";
  const dataStatusStyleMap: Record<string, { label: string; bg: string; dot: string }> = {
    cukup: {
      label: "Data Memadai",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      dot: "bg-emerald-500",
    },
    terbatas: {
      label: locale === "id" ? "Data Terbatas" : "Limited Data",
      bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      dot: "bg-amber-500",
    },
    tidak_valid: {
      label: "Data Belum Valid",
      bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      dot: "bg-rose-500",
    },
  };
  const activeDataStatusStyle = dataStatusStyleMap[dataStatus] || dataStatusStyleMap.terbatas;

  const performanceStatus = analysis?.evaluator?.performance_status || "belum_dapat_dinilai";
  const performanceStatusStyleMap: Record<string, { label: string; bg: string }> = {
    memenuhi_target: {
      label: "Sesuai Target",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    },
    di_atas_target: {
      label: "Biaya di Atas Target",
      bg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    },
    belum_dapat_dinilai: {
      label: "Belum Dapat Dinilai",
      bg: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    },
  };
  const activePerformanceStatusStyle = performanceStatusStyleMap[performanceStatus] || performanceStatusStyleMap.belum_dapat_dinilai;

  return (
    <section
      aria-label="AI Ads Performance Analyst"
      className="w-full min-w-0 space-y-4 sm:space-y-5"
    >
      {/* Kontrol Analisis */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
        <div className="mb-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {locale === "id" ? "Analisis Performa AI" : "AI Ads Performance Analyst"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {locale === "id"
              ? "Ringkasan dan tindakan berdasarkan data iklan terpilih."
              : "Executive summary and actionable decisions for selected ads."}
          </p>
        </div>

        <div className="space-y-4">
          {/* Baris 1: cakupan dan periode */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <fieldset className="min-w-0 space-y-2">
              <legend className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {locale === "id" ? "Cakupan" : "Scope"}
              </legend>
              <div role="group" aria-label={locale === "id" ? "Cakupan analisis" : "Analysis scope"} className="inline-flex max-w-full rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/70">
                {(["account", "campaign", "ad"] as const).map((item) => {
                  const selected = scope === item;
                  const label = item === "account"
                    ? locale === "id" ? "Akun" : "Account"
                    : item === "campaign"
                    ? locale === "id" ? "Kampanye" : "Campaign"
                    : locale === "id" ? "Iklan" : "Ad";
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setScope(item)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? "bg-white text-indigo-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-indigo-300 dark:ring-zinc-600" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {locale === "id" ? "Periode" : "Period"}
                </p>
                <span className="text-[10px] text-zinc-400" title={locale === "id" ? "Zona waktu akun iklan" : "Ad account timezone"}>
                  {timezone || "Asia/Jakarta"}
                </span>
              </div>
              <div role="group" aria-label={locale === "id" ? "Periode analisis" : "Analysis period"} className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/70">
                {([
                  { key: "1d", id: "1 Hari", en: "1 Day" },
                  { key: "3d", id: "3 Hari", en: "3 Days" },
                  { key: "7d", id: "7 Hari", en: "7 Days" },
                  { key: "14d", id: "14 Hari", en: "14 Days" },
                  { key: "30d", id: "30 Hari", en: "30 Days" },
                  { key: "custom", id: "Kustom", en: "Custom" },
                ] as const).map((item) => {
                  const selected = period === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setPeriod(item.key);
                        if (item.key === "custom" && !customSince) {
                          const end = new Date();
                          const startDate = new Date(end.getTime() - 7 * 86400000);
                          setCustomSince(startDate.toISOString().slice(0, 10));
                          setCustomUntil(end.toISOString().slice(0, 10));
                        }
                      }}
                      className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? "bg-white text-indigo-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-indigo-300 dark:ring-zinc-600" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
                    >
                      {locale === "id" ? item.id : item.en}
                    </button>
                  );
                })}
              </div>
              <p className="min-h-4 px-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                {["7d", "14d", "30d"].includes(period)
                  ? locale === "id" ? "Data historis (tidak termasuk hari ini)." : "Historical data (today excluded)."
                  : period === "1d"
                  ? locale === "id" ? "Data hari ini mengikuti zona waktu akun." : "Today's data follows the account timezone."
                  : " "}
              </p>
            </fieldset>
          </div>

          {/* Selector entitas mengikuti cakupan yang dipilih */}
          {scope !== "account" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              {scope === "campaign" ? (
                <label className="min-w-0 space-y-1.5">
                  <span className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    {locale === "id" ? "Kampanye" : "Campaign"}
                  </span>
                  <select
                    value={effectiveCampaignId}
                    onChange={(event) => setSelectedCampaignId(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:ring-indigo-950"
                  >
                    {filteredCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {cleanEntityName(campaign.name)}{campaign.status === "PAUSED" ? ` (${locale === "id" ? "Dijeda" : "Paused"})` : ""}
                      </option>
                    ))}
                    {!filteredCampaigns.length && <option value="">{locale === "id" ? "Tidak ada kampanye" : "No campaigns"}</option>}
                  </select>
                </label>
              ) : (
                <label className="min-w-0 space-y-1.5">
                  <span className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    {locale === "id" ? "Iklan" : "Ad"}
                  </span>
                  <select
                    value={effectiveAdId}
                    onChange={(event) => setSelectedAdId(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:ring-indigo-950"
                  >
                    {filteredAds.map((ad) => <option key={ad.id} value={ad.id}>{cleanEntityName(ad.adName)}</option>)}
                    {!filteredAds.length && <option value="">{locale === "id" ? "Tidak ada iklan" : "No ads"}</option>}
                  </select>
                </label>
              )}
              <label className="space-y-1.5">
                <span className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {locale === "id" ? "Cari nama" : "Search name"}
                </span>
                <input
                  type="search"
                  value={scope === "campaign" ? campaignSearchQuery : adSearchQuery}
                  onChange={(event) => scope === "campaign" ? setCampaignSearchQuery(event.target.value) : setAdSearchQuery(event.target.value)}
                  placeholder={locale === "id" ? "Cari…" : "Search…"}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:ring-indigo-950 sm:w-40"
                />
              </label>
              {scope === "campaign" && campaigns.some((campaign) => campaign.status === "ARCHIVED" || campaign.status === "DELETED") && (
                <button type="button" onClick={() => setShowArchivedCampaigns((value) => !value)} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  {showArchivedCampaigns ? (locale === "id" ? "Sembunyikan arsip" : "Hide archived") : (locale === "id" ? "Tampilkan arsip" : "Show archived")}
                </button>
              )}
            </div>
          )}

          {/* Baris 2: periode kustom dan target CPR per akun */}
          <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {period === "custom" ? locale === "id" ? "Rentang Kustom" : "Custom Range" : locale === "id" ? "Tanggal Analisis" : "Analysis Dates"}
              </label>
              {period === "custom" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="shrink-0 text-[10px] text-zinc-400">{locale === "id" ? "Mulai" : "From"}</span>
                    <input type="date" value={customSince} max={customUntil || undefined} onChange={(event) => setCustomSince(event.target.value)} className="min-w-0 w-full bg-transparent text-xs text-zinc-800 outline-none dark:text-zinc-200" />
                  </label>
                  <label className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="shrink-0 text-[10px] text-zinc-400">{locale === "id" ? "Sampai" : "To"}</span>
                    <input type="date" value={customUntil} min={customSince || undefined} onChange={(event) => setCustomUntil(event.target.value)} className="min-w-0 w-full bg-transparent text-xs text-zinc-800 outline-none dark:text-zinc-200" />
                  </label>
                </div>
              ) : (
                <div className="flex min-h-[38px] items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                  {periodText}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ai-target-cpr" className="block px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Target CPR</label>
              <div className="flex min-h-[38px] items-center rounded-lg border border-zinc-200 bg-white px-3 transition-colors focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:ring-indigo-950">
                <span className="mr-2 text-xs font-semibold text-zinc-400">Rp</span>
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
                  className="w-full bg-transparent text-sm font-semibold tabular-nums text-zinc-900 outline-none placeholder:font-normal placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-100"
                />
                {targetCpr && (
                  <button type="button" onClick={() => saveTargetCpr(null)} className="ml-2 rounded px-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100" aria-label={locale === "id" ? "Hapus target CPR akun ini" : "Clear this account's CPR target"}>×</button>
                )}
              </div>
              <p id="ai-target-cpr-help" className="px-0.5 text-[10px] text-zinc-400">
                {targetCprStorageKey
                  ? locale === "id" ? "Tersimpan khusus untuk akun ini." : "Saved for this account only."
                  : locale === "id" ? "Pilih akun iklan untuk menyimpan target." : "Select an ad account to save a target."}
              </p>
            </div>
          </div>

          {/* CTA dan status kesegaran snapshot */}
          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
                  <path d="M12 7v5l3 2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  {locale === "id" ? "Menganalisis snapshot data terakhir (Sinkron Meta: " : "Analyzes the latest data snapshot (Meta sync: "}
                  <time dateTime={lastSyncedAt || undefined} title={lastSyncedAt ? new Date(lastSyncedAt).toLocaleString(locale === "id" ? "id-ID" : "en-US", { timeZone: timezone || "Asia/Jakarta" }) : undefined} className="font-medium text-zinc-700 dark:text-zinc-300">
                    {lastSyncedAt ? formatRelativeSyncTime(lastSyncedAt, locale) : locale === "id" ? "belum tersedia" : "unavailable"}
                  </time>
                  {locale === "id" ? "). Pastikan data sudah tersinkronisasi." : "). Make sure the data is synced."}
                </span>
              </div>
              {canSync && onTriggerSync && (
                <button type="button" onClick={() => onTriggerSync({ period, since: period === "custom" ? customSince : undefined, until: period === "custom" ? customUntil : undefined })} disabled={isSyncing || (period === "custom" && (!customSince || !customUntil))} className="ml-5 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:cursor-wait disabled:opacity-60 dark:text-indigo-400 dark:hover:text-indigo-300">
                  <svg className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M20 7v5h-5M4 17v-5h5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isSyncing ? locale === "id" ? "Menyinkronkan…" : "Syncing…" : locale === "id" ? "Sinkronkan Data Terbaru" : "Sync Latest Data"}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={runPerformanceAnalysis}
              disabled={isLoading || quota?.remaining === 0 || (period === "custom" && (!customSince || !customUntil))}
              title={quota?.remaining === 0 ? (locale === "id" ? "Kuota analisis habis — lihat Pengaturan" : "Analysis quota exhausted — see Settings") : undefined}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900"
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
                  <span aria-hidden="true">✨</span>
                  <span>{analysis ? locale === "id" ? "Analisis Ulang" : "Re-analyze" : locale === "id" ? "Analisis Performa" : "Analyze Performance"}</span>
                </>
              )}
            </button>
          </div>

          {isSelectionStale && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {locale === "id"
                ? `Filter berubah: ${currentSelectionLabel}. Jalankan Analisis Ulang untuk memperbarui hasil.`
                : `Filters changed: ${currentSelectionLabel}. Run the analysis again to update results.`}
            </div>
          )}
        </div>
      </div>
      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <span className="font-bold">
            {locale === "id" ? "Gagal Menganalisis:" : "Analysis Failed:"}
          </span>{" "}
          {error}
        </div>
      )}

      {/* Skeleton Loading State */}
      {isLoading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4 animate-pulse">
          <div className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
            ))}
          </div>
          <div className="h-28 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
          <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
        </div>
      )}

      {/* Main Analysis Output (4 Blocks) */}
      {!isLoading && analysis && (
        <div className="space-y-4 sm:space-y-5">
          {/* ======================================================== */}
          {/* BLOK 1 — VERDICT CARD                                   */}
          {/* ======================================================== */}
          {/* ======================================================== */}
          {/* BLOK 1 — VERDICT & DECISION CARD (Section E, F, H)       */}
          {/* ======================================================== */}
          <div
            className={`rounded-2xl border border-zinc-200 border-t-4 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${activeActionStyle.borderColor}`}
          >
            {/* Top Row: 3 Distinct Decision Outputs + Context Metadata */}
            <div className="flex flex-col gap-3 border-b border-zinc-100 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Action Prescribed */}
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.06em] ${activeActionStyle.badgeBg}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${activeActionStyle.badgeDot}`} />
                  {activeVerdictBadgeText}
                </span>

                {/* 2. Data Sufficiency Status */}
                {analysis.evaluator && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${activeDataStatusStyle.bg}`}>
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

              {/* Reporting Range & Timezone (Section B requirement) */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-medium">
                  {analysis.evaluator ? `${analysis.evaluator.date_range.since} s/d ${analysis.evaluator.date_range.until} (${analysis.evaluator.duration_days} hari)` : analysis.meta.period}
                </span>
                <span>·</span>
                <span className="font-mono">{analysis.evaluator?.timezone || timezone || "Asia/Jakarta"}</span>
              </div>
            </div>

            {/* Headline and Subtext */}
            <div className="mt-3.5 space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-snug">
                {analysis.verdict.headline}
              </h2>
              <p className="max-w-4xl text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {analysis.verdict.subtext}
              </p>
            </div>

            {/* Metadata Bar: Learning Status & Tracking Status (Section F) */}
            {analysis.evaluator && (
              <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-[11px] dark:border-zinc-800">
                <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <span className="text-zinc-400">Fase Learning:</span> {analysis.evaluator.learning_status}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <span className="text-zinc-400">Sumber Konversi:</span> {analysis.evaluator.tracking_status}
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
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 space-y-1">
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
          <div className="space-y-3">
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white divide-x divide-y divide-zinc-100 lg:grid-cols-4 lg:divide-y-0 dark:border-zinc-800 dark:bg-zinc-900 dark:divide-zinc-800">
              {analysis.metrics.map((m) => {
                const isCpr = m.key === "cpr";
                const isPositiveDelta = (m.delta_pct ?? 0) > 0;
                // For CPR, down is good (green), up is bad (red)
                const isDeltaGood = isCpr ? !isPositiveDelta : isPositiveDelta;
                const isBaselineZero = m.delta_note === "Pembanding 0" || m.delta_note === "Baseline 0" || m.delta_note === "Belum ada data di periode pembanding";

                return (
                  <div
                    key={m.key}
                    className="flex min-w-0 flex-col justify-between bg-transparent p-4 sm:p-5"
                  >
                    <div>
                      <div className="flex min-h-5 items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <span>{ANALYST_METRIC_LABELS[m.key]}</span>
                        {m.vs_target === "better" && (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium text-[10px]">
                            {isCpr ? "Sesuai Target ✓" : m.key === "ctr" ? "Sehat" : "Optimal"}
                          </span>
                        )}
                        {m.vs_target === "worse" && (isCpr || m.key === "ctr") && (
                          <span className="text-rose-600 dark:text-rose-400 font-medium text-[10px]">
                            {isCpr ? "Di Atas Target" : "Rendah"}
                          </span>
                        )}
                        {m.vs_target === "on_target" && m.key === "ctr" && (
                          <span className="text-amber-700 dark:text-amber-300 font-medium text-[10px]">Cukup</span>
                        )}
                        {m.vs_target === "no_target" && isCpr && !targetCpr && (
                          <span className="text-zinc-400 font-normal text-[10px]">
                            Target belum ditetapkan
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-baseline justify-between gap-1">
                        <div className="text-xl sm:text-2xl font-semibold font-mono tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                          {formatAnalystMetric(m)}
                        </div>
                        {m.trend_7d && (
                          <Sparkline data={m.trend_7d} color={activeActionStyle.sparkColor} />
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
                      {isBaselineZero ? (
                        <span className="text-zinc-400 font-medium">
                          {m.delta_note}
                        </span>
                      ) : m.delta_pct !== null ? (
                        <div
                          className={`inline-flex items-center gap-1 font-mono font-bold ${
                            isDeltaGood
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          <span>{isPositiveDelta ? "↑" : "↓"}</span>
                          <span>{m.delta_note}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 font-medium">
                          {m.delta_note || "Belum ada data di periode pembanding"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Accordion: Detail Metrik Lainnya */}
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setShowExtraMetrics(!showExtraMetrics)}
                className="w-full flex items-center justify-between gap-3 text-sm font-medium text-zinc-700 hover:text-indigo-700 dark:text-zinc-300 dark:hover:text-indigo-300 cursor-pointer"
              >
                <span>Metrik Pendukung</span>
                <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
                  {showExtraMetrics ? "Sembunyikan" : "Tampilkan"}
                  <span aria-hidden="true">{showExtraMetrics ? "−" : "+"}</span>
                </span>
              </button>

              {showExtraMetrics && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-100 pt-3 text-xs sm:grid-cols-3 lg:grid-cols-6 dark:border-zinc-800">
                  {analysis.extra_metrics.map((em) => (
                    <div key={em.label} className="min-w-0">
                      <p className="text-[11px] text-zinc-500">{em.label}</p>
                      <p className="mt-1 font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 text-sm">
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

          {/* ======================================================== */}
          {/* BLOK 3 — YANG PERLU DIPERHATIKAN                        */}
          {/* ======================================================== */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Sinyal Diagnostik Utama
              </h3>
              <span className="text-xs text-zinc-400">
                Maksimal 3 temuan kunci
              </span>
            </div>

            <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
              {analysis.watchouts.map((w, idx) => {
                const markerColor = w.severity === "ok" ? "bg-emerald-500" : w.severity === "warn" ? "bg-amber-500" : "bg-rose-500";
                return (
                  <div
                    key={idx}
                    className="min-w-0 py-3 sm:px-4 sm:py-1 first:pl-0 last:pr-0 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${markerColor}`} />
                      <span>{w.title}</span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {w.insight}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* BLOK 4 — NEXT ACTION                                    */}
          {/* ======================================================== */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Rekomendasi Tindakan Taktis
              </h3>
              <span className="text-xs text-zinc-400">
                Langkah eksekusi yang disarankan
              </span>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {analysis.actions.map((act, idx) => {
                const priorityBadge =
                  act.priority === "high"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                    : act.priority === "medium"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

                return (
                  <div
                    key={idx}
                    className="py-4 first:pt-3 last:pb-0 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium tabular-nums text-zinc-400">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {act.title}
                        </h4>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${priorityBadge}`}
                        >
                          {act.priority === "high"
                            ? "Prioritas Tinggi"
                            : act.priority === "medium"
                            ? "Prioritas Sedang"
                            : "Prioritas Rendah"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyActionToClipboard(act)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer transition-colors"
                        title="Salin rekomendasi ini"
                      >
                        <svg className="h-3 w-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Salin Rekomendasi</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-700 sm:grid-cols-3 dark:border-zinc-800 dark:text-zinc-300">
                      <div>
                        <span className="text-[11px] font-medium text-zinc-500 block">
                          Alasan Analitis:
                        </span>
                        <p className="mt-0.5 leading-relaxed">{act.why}</p>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-zinc-500 block">
                          Langkah Eksekusi:
                        </span>
                        <p className="mt-0.5 leading-relaxed font-medium">{act.do}</p>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block">
                          Batas Aman (Stop-Loss):
                        </span>
                        <p className="mt-0.5 leading-relaxed text-zinc-700 dark:text-zinc-300">{act.stop_loss}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* FOOTER & DISCLOSURE                                     */}
          {/* ======================================================== */}
          <div className="text-[11px] text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <span>
              {`Sumber: Snapshot Meta Insights · Diperbarui ${new Date(analysis.meta.generated_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: timezone || "Asia/Jakarta" })} WIB · Mesin: ${analysis.meta.engine === "llm" ? "AI + Evaluasi Deterministik" : "Evaluasi Aturan Deterministik (Rule-Based)"}`}
            </span>

            <button
              type="button"
              onClick={() => setShowCalculationDetails(!showCalculationDetails)}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 underline cursor-pointer self-start sm:self-auto"
            >
              {showCalculationDetails ? "Sembunyikan Dasar Perhitungan" : "Lihat Dasar Perhitungan"}
            </button>
          </div>

          {showCalculationDetails && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 space-y-1.5 leading-relaxed">
              <p className="font-bold text-zinc-800 dark:text-zinc-200">
                Dasar Perhitungan & Integritas Metrik:
              </p>
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
                  Target CPR dibandingkan dengan CPR aktual (total belanja dibagi total hasil Meta tercatat). Tanpa target, sistem tidak merekomendasikan peningkatan budget.
                </li>
                <li>
                  <strong>Rekomendasi Materi Iklan:</strong>{" "}
                  Penyegaran materi diprioritaskan saat CTR tautan di bawah 0,80% dan CPR aktual melebihi target. Indikasi kejenuhan hanya digunakan jika frekuensi tersedia dan mencapai 2,5x.
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

    </section>
  );
}
