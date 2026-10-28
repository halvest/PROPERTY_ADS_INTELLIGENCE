"use client";

import React, { useState, useRef, useMemo } from "react";
import type { PerformanceAnalysisOutput } from "@/app/api/ai/analyze-performance/route";
import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";
import type { RealAdRow } from "@/app/(dashboard)/ads/page";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface AIAdsPerformanceAnalystProps {
  campaigns: CampaignDetailData[];
  ads: RealAdRow[];
  accountName?: string | null;
  currency?: string;
  timezone?: string;
  currentDateRange?: string;
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

export function AIAdsPerformanceAnalyst({
  campaigns = [],
  ads = [],
  accountName = "Meta Ads",
  currency: _currency = "IDR",
  timezone = "Asia/Jakarta",
  currentDateRange: _currentDateRange,
}: AIAdsPerformanceAnalystProps) {
  void _currency;
  void _currentDateRange;
  const { addToast } = useToast();
  const { locale, formatNumber } = useI18n();

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

  // Target CPR (saved in localStorage; read lazily on first client render)
  const [isMounted] = useState(() => typeof window !== "undefined");
  const [targetCpr, setTargetCpr] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = window.localStorage.getItem("haspro_target_cpr");
      const parsed = saved ? Number(saved) : NaN;
      return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  });
  const [isSettingTargetCpr, setIsSettingTargetCpr] = useState(false);
  const [targetCprInput, setTargetCprInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem("haspro_target_cpr") || "";
    } catch {
      return "";
    }
  });

  // Accordions
  const [showExtraMetrics, setShowExtraMetrics] = useState(false);
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);

  // Request & Output states
  const [analysis, setAnalysis] = useState<PerformanceAnalysisOutput | null>(null);
  const [lastAnalyzedScopeContext, setLastAnalyzedScopeContext] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Concurrency guard
  const isAnalyzingRef = useRef(false);

  const saveTargetCpr = (val: number | null) => {
    setTargetCpr(val);
    try {
      if (val && val > 0) {
        localStorage.setItem("haspro_target_cpr", String(val));
      } else {
        localStorage.removeItem("haspro_target_cpr");
      }
    } catch {
      // Ignore
    }
    setIsSettingTargetCpr(false);
    if (val) {
      addToast(
        "success",
        locale === "id" ? "Target CPR Tersimpan" : "Target CPR Saved",
        locale === "id" ? `Target diatur ke Rp${val.toLocaleString("id-ID")}` : `Target set to Rp${val.toLocaleString("en-US")}`
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

  const activeCampaigns = useMemo(
    () => filteredCampaigns.filter((c) => c.status === "ACTIVE"),
    [filteredCampaigns]
  );
  const pausedCampaigns = useMemo(
    () => filteredCampaigns.filter((c) => c.status === "PAUSED"),
    [filteredCampaigns]
  );
  const archivedCampaigns = useMemo(
    () => filteredCampaigns.filter((c) => c.status === "ARCHIVED" || c.status === "DELETED"),
    [filteredCampaigns]
  );

  // Filtered ads
  const filteredAds = useMemo(() => {
    return ads.filter((a) => {
      const q = adSearchQuery.toLowerCase().trim();
      const matchName = cleanEntityName(a.adName).toLowerCase().includes(q) || a.adName.toLowerCase().includes(q);
      return matchName;
    });
  }, [ads, adSearchQuery]);

  const activeAds = useMemo(
    () => filteredAds.filter((a) => a.adSettingStatus === "ACTIVE" || a.deliveryStatus === "DELIVERING"),
    [filteredAds]
  );
  const pausedAds = useMemo(
    () => filteredAds.filter((a) => !(a.adSettingStatus === "ACTIVE" || a.deliveryStatus === "DELIVERING")),
    [filteredAds]
  );

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
    isAnalyzingRef.current = true;
    setIsLoading(true);
    setError(null);

    const targetId = scope === "campaign" ? effectiveCampaignId : scope === "ad" ? effectiveAdId : undefined;

    try {
      const res = await fetch("/api/ai/analyze-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          period,
          targetId,
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
        setAnalysis(json.data);
        setLastAnalyzedScopeContext(currentSelectionLabel);
        setError(null);
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
    }
  };

  const copyActionToClipboard = (action: PerformanceAnalysisOutput["actions"][0]) => {
    const textToCopy = `[HD CREATIVE ADS — NEXT ACTION]\nPrioritas: ${action.priority.toUpperCase()}\nAksi: ${action.title}\nKenapa: ${action.why}\nLakukan: ${action.do}\nStop-loss: ${action.stop_loss}`;
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

  const dataStatus = analysis?.evaluator?.data_status || "terbatas";
  const dataStatusStyleMap: Record<string, { label: string; bg: string; dot: string }> = {
    cukup: {
      label: locale === "id" ? "Data Cukup" : "Sufficient Data",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      dot: "bg-emerald-500",
    },
    terbatas: {
      label: locale === "id" ? "Data Terbatas" : "Limited Data",
      bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      dot: "bg-amber-500",
    },
    tidak_valid: {
      label: locale === "id" ? "Data Tidak Valid" : "Invalid Data",
      bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      dot: "bg-rose-500",
    },
  };
  const activeDataStatusStyle = dataStatusStyleMap[dataStatus] || dataStatusStyleMap.terbatas;

  const performanceStatus = analysis?.evaluator?.performance_status || "belum_dapat_dinilai";
  const performanceStatusStyleMap: Record<string, { label: string; bg: string }> = {
    memenuhi_target: {
      label: locale === "id" ? "Target Tercapai" : "Target Met",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    },
    di_atas_target: {
      label: locale === "id" ? "Di Atas Target" : "Above Target",
      bg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    },
    belum_dapat_dinilai: {
      label: locale === "id" ? "Belum Dinilai" : "Not Evaluable",
      bg: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    },
  };
  const activePerformanceStatusStyle = performanceStatusStyleMap[performanceStatus] || performanceStatusStyleMap.belum_dapat_dinilai;

  return (
    <section
      aria-label="AI Ads Performance Analyst"
      className="w-full min-w-0 space-y-4 sm:space-y-5"
    >
      {/* 1. Header Kontrol (Kompak 1-Baris) */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {locale === "id" ? "Analisis Performa AI" : "AI Ads Performance Analyst"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {locale === "id"
              ? "Ringkasan dan tindakan berdasarkan data iklan terpilih."
              : "Executive summary and actionable decisions for selected ads."}
          </p>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          {/* Left Controls: Period & Scope */}
          <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-3">
            {/* Period Pills (Section B: 6 Options + Timezone) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1 gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {locale === "id" ? "Periode" : "Period"}
                </p>
                <span className="text-[10px] text-zinc-400 font-mono" title={locale === "id" ? "Zona Waktu Akun" : "Account Timezone"}>
                  {timezone || "Asia/Jakarta"}
                </span>
              </div>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/70 flex-wrap gap-1">
                {(
                  [
                    { key: "1d", labelId: "1 Hari", labelEn: "1 Day", tagId: "Monitoring", tagEn: "Monitoring" },
                    { key: "3d", labelId: "3 Hari", labelEn: "3 Days", tagId: "Diagnostik", tagEn: "Diagnostic" },
                    { key: "7d", labelId: "7 Hari", labelEn: "7 Days", tagId: "Rutin", tagEn: "Routine" },
                    { key: "14d", labelId: "14 Hari", labelEn: "14 Days", tagId: "Mendalam", tagEn: "In-Depth" },
                    { key: "30d", labelId: "30 Hari", labelEn: "30 Days", tagId: "Bisnis", tagEn: "Business" },
                    { key: "custom", labelId: "Kustom", labelEn: "Custom", tagId: "Rentang", tagEn: "Range" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setPeriod(item.key);
                      if (item.key === "custom" && !customSince) {
                        const end = new Date();
                        const start = new Date(end.getTime() - 7 * 86400000);
                        setCustomSince(start.toISOString().slice(0, 10));
                        setCustomUntil(end.toISOString().slice(0, 10));
                      }
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      period === item.key
                        ? "bg-white text-indigo-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-indigo-300 dark:ring-zinc-600"
                        : "text-zinc-500 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-100"
                    }`}
                    title={locale === "id" ? `${item.labelId} — ${item.tagId}` : `${item.labelEn} — ${item.tagEn}`}
                  >
                    <span>{locale === "id" ? item.labelId : item.labelEn}</span>
                  </button>
                ))}
              </div>

              {/* Custom Date Pickers when period === 'custom' */}
              {period === "custom" && (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="text-[10px] text-zinc-400 font-medium">{locale === "id" ? "Mulai:" : "From:"}</span>
                    <input
                      type="date"
                      value={customSince}
                      onChange={(e) => setCustomSince(e.target.value)}
                      className="bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="text-[10px] text-zinc-400 font-medium">{locale === "id" ? "Sampai:" : "To:"}</span>
                    <input
                      type="date"
                      value={customUntil}
                      onChange={(e) => setCustomUntil(e.target.value)}
                      className="bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Scope Pills */}
            <div className="space-y-1.5">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {locale === "id" ? "Cakupan" : "Scope"}
              </p>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/70">
              {(["account", "campaign", "ad"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    scope === s
                      ? "bg-white text-indigo-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-indigo-300 dark:ring-zinc-600"
                      : "text-zinc-500 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-100"
                  }`}
                >
                  {s === "account"
                    ? locale === "id" ? "Akun" : "Account"
                    : s === "campaign"
                    ? locale === "id" ? "Kampanye" : "Campaign"
                    : locale === "id" ? "Iklan" : "Ad"}
                </button>
              ))}
              </div>
            </div>

            {/* Target Dropdown when Scope === 'campaign' */}
            {scope === "campaign" && (
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {locale === "id" ? "Pilih Kampanye" : "Select Campaign"}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="relative">
                    <select
                      value={effectiveCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 max-w-[200px] sm:max-w-[260px] truncate cursor-pointer"
                      title={campaigns.find((c) => c.id === effectiveCampaignId)?.name || (locale === "id" ? "Pilih campaign" : "Select campaign")}
                    >
                      {activeCampaigns.length > 0 && (
                        <optgroup label={locale === "id" ? "Kampanye aktif" : "Active campaigns"}>
                          {activeCampaigns.map((c) => (
                            <option key={c.id} value={c.id} title={c.name}>
                              {cleanEntityName(c.name)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {pausedCampaigns.length > 0 && (
                        <optgroup label={locale === "id" ? "Kampanye dijeda" : "Paused campaigns"}>
                          {pausedCampaigns.map((c) => (
                            <option key={c.id} value={c.id} title={c.name}>
                              {cleanEntityName(c.name)} ({locale === "id" ? "Dijeda" : "Paused"})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {archivedCampaigns.length > 0 && showArchivedCampaigns && (
                        <optgroup label={locale === "id" ? "Kampanye diarsipkan" : "Archived campaigns"}>
                          {archivedCampaigns.map((c) => (
                            <option key={c.id} value={c.id} title={c.name}>
                              {cleanEntityName(c.name)} ({locale === "id" ? "Arsip" : "Archived"})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {filteredCampaigns.length === 0 && (
                        <option disabled value="">
                          {locale === "id" ? "Tidak ada kampanye cocok" : "No matching campaigns"}
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Campaign Search Box */}
                  <div className="relative">
                    <input
                      type="text"
                      value={campaignSearchQuery}
                      onChange={(e) => setCampaignSearchQuery(e.target.value)}
                      placeholder={locale === "id" ? "Cari..." : "Search..."}
                      aria-label="Cari nama campaign"
                      className="w-16 sm:w-20 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    />
                    {campaignSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCampaignSearchQuery("")}
                        className="absolute right-1 top-0.5 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        title={locale === "id" ? "Reset filter" : "Reset filter"}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Archive toggle button */}
                  {campaigns.some((c) => c.status === "ARCHIVED" || c.status === "DELETED") && (
                    <button
                      type="button"
                      onClick={() => setShowArchivedCampaigns((prev) => !prev)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer border ${
                        showArchivedCampaigns
                          ? "bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-600 font-bold"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                      title={showArchivedCampaigns ? (locale === "id" ? "Sembunyikan arsip" : "Hide archive") : (locale === "id" ? "Tampilkan campaign yang diarsipkan" : "Show archived campaigns")}
                    >
                      {showArchivedCampaigns ? (locale === "id" ? "Arsip: On" : "Archive: On") : (locale === "id" ? `+ Arsip (${archivedCampaigns.length})` : `+ Archive (${archivedCampaigns.length})`)}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Target Dropdown when Scope === 'ad' */}
            {scope === "ad" && (
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {locale === "id" ? "Pilih Iklan" : "Select Ad"}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="relative">
                    <select
                      value={effectiveAdId}
                      onChange={(e) => setSelectedAdId(e.target.value)}
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 max-w-[200px] sm:max-w-[260px] truncate cursor-pointer"
                      title={ads.find((a) => a.id === effectiveAdId)?.adName || (locale === "id" ? "Pilih iklan" : "Select ad")}
                    >
                      {activeAds.length > 0 && (
                        <optgroup label={locale === "id" ? "Iklan aktif" : "Active ads"}>
                          {activeAds.map((ad) => (
                            <option key={ad.id} value={ad.id} title={`${ad.adName} (${cleanEntityName(ad.campaignName)})`}>
                              {cleanEntityName(ad.adName)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {pausedAds.length > 0 && (
                        <optgroup label={locale === "id" ? "Iklan dijeda" : "Paused ads"}>
                          {pausedAds.map((ad) => (
                            <option key={ad.id} value={ad.id} title={`${ad.adName} (${cleanEntityName(ad.campaignName)})`}>
                              {cleanEntityName(ad.adName)} ({locale === "id" ? "Dijeda" : "Paused"})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {filteredAds.length === 0 && (
                        <option disabled value="">
                          {locale === "id" ? "Tidak ada iklan cocok" : "No matching ads"}
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Ad Search Box */}
                  <div className="relative">
                    <input
                      type="text"
                      value={adSearchQuery}
                      onChange={(e) => setAdSearchQuery(e.target.value)}
                      placeholder={locale === "id" ? "Cari..." : "Search..."}
                      aria-label="Cari nama iklan"
                      className="w-16 sm:w-20 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    />
                    {adSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAdSearchQuery("")}
                        className="absolute right-1 top-0.5 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        title={locale === "id" ? "Reset filter" : "Reset filter"}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Target CPR Inline Control */}
            <div className="space-y-1.5">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Target CPR</p>
              <div className="relative inline-flex items-center min-h-[34px]">
                {!isMounted ? (
                  <button
                    type="button"
                    onClick={() => setIsSettingTargetCpr(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 cursor-pointer transition-colors"
                    title={locale === "id" ? "Atur target CPR agar verdict akurat" : "Set target CPR for accurate verdict"}
                  >
                    <span>+ {locale === "id" ? "Atur Target CPR" : "Set Target CPR"}</span>
                  </button>
                ) : isSettingTargetCpr ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50/70 px-2.5 py-1 dark:border-indigo-800 dark:bg-indigo-950/50">
                    <span className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-200">Rp</span>
                    <input
                      type="number"
                      value={targetCprInput}
                      onChange={(e) => setTargetCprInput(e.target.value)}
                      placeholder="50000"
                      className="w-20 bg-transparent text-xs font-mono font-bold text-indigo-950 focus:outline-none dark:text-indigo-100"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const num = Number(targetCprInput);
                        if (num > 0) saveTargetCpr(num);
                      }}
                      className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-700 cursor-pointer"
                    >
                      {locale === "id" ? "Simpan" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSettingTargetCpr(false)}
                      className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : targetCpr ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsSettingTargetCpr(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-indigo-700 cursor-pointer transition-colors shadow-2xs"
                      title={locale === "id" ? "Klik untuk mengubah target CPR" : "Click to edit target CPR"}
                    >
                      <strong className="font-mono text-zinc-900 dark:text-zinc-100 font-bold">
                        Rp {targetCpr.toLocaleString(locale === "en" ? "en-US" : "id-ID")}
                      </strong>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium underline">
                        {locale === "id" ? "Ubah" : "Edit"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => saveTargetCpr(null)}
                      className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
                      title={locale === "id" ? "Hapus target CPR" : "Remove target CPR"}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSettingTargetCpr(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 cursor-pointer transition-colors"
                    title={locale === "id" ? "Atur target CPR agar verdict akurat" : "Set target CPR for accurate verdict"}
                  >
                    <span>+ {locale === "id" ? "Atur Target CPR" : "Set Target CPR"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Action: Run Analysis */}
          <button
            type="button"
            onClick={runPerformanceAnalysis}
            disabled={isLoading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900 cursor-pointer transition-colors xl:min-w-40"
          >
            {isLoading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>{locale === "id" ? "Menganalisis..." : "Analyzing..."}</span>
              </>
            ) : analysis ? (
              <span>{locale === "id" ? "Analisis Ulang" : "Re-analyze"}</span>
            ) : (
              <span>{locale === "id" ? "Analisis Performa" : "Analyze Performance"}</span>
            )}
          </button>
        </div>

        {/* Compact Context Chip & Stale Warning */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 text-[11px] text-zinc-500 dark:border-zinc-800">
          <div className="flex items-center gap-2 flex-wrap">
            {analysis ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>
                  {locale === "id" ? "Menampilkan:" : "Showing:"} {analysis.meta.period} · {activeTargetName}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-50 border border-zinc-200/80 px-2.5 py-1 font-medium text-zinc-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-300">
                <span>
                  {locale === "id" ? "Target Analisis:" : "Analysis Target:"} {currentSelectionLabel}
                </span>
              </span>
            )}
          </div>

          {isSelectionStale && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
              <span>
                {locale === "id"
                  ? `⚠️ Filter diubah: ${currentSelectionLabel}. Klik "Analisis Ulang" untuk sinkronisasi data.`
                  : `⚠️ Filter changed: ${currentSelectionLabel}. Click "Re-analyze" to sync data.`}
              </span>
            </span>
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
                  {activeActionStyle.badgeText}
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
                  <span className="text-zinc-400">Learning:</span> {analysis.evaluator.learning_status}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <span className="text-zinc-400">Tracking:</span> {analysis.evaluator.tracking_status}
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
                const isBaselineZero = m.delta_note === "Pembanding 0" || m.delta_note === "Baseline 0";

                return (
                  <div
                    key={m.key}
                    className="flex min-w-0 flex-col justify-between bg-transparent p-4 sm:p-5"
                  >
                    <div>
                      <div className="flex min-h-5 items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <span>{m.label}</span>
                        {m.vs_target === "better" && (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium text-[10px]">
                            {isCpr
                              ? locale === "id" ? "Di bawah target ✓" : "Below target ✓"
                              : locale === "id" ? "Bagus" : "Good"}
                          </span>
                        )}
                        {m.vs_target === "worse" && isCpr && (
                          <span className="text-rose-600 dark:text-rose-400 font-medium text-[10px]">
                            {locale === "id" ? "Di atas target ✗" : "Above target ✗"}
                          </span>
                        )}
                        {m.vs_target === "no_target" && isCpr && !targetCpr && (
                          <span className="text-zinc-400 font-normal text-[10px]">
                            {locale === "id" ? "Tanpa target" : "No target"}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-baseline justify-between gap-1">
                        <div className="text-xl sm:text-2xl font-semibold font-mono tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                          {m.display}
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
                          {m.delta_note || (locale === "id" ? "Data pembanding belum cukup" : "Insufficient comparative data")}
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
                <span>{locale === "id" ? "Metrik pendukung" : "Supporting metrics"}</span>
                <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
                  {showExtraMetrics ? (locale === "id" ? "Sembunyikan" : "Hide") : (locale === "id" ? "Tampilkan" : "Show")}
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
                {locale === "id" ? "Sinyal utama" : "Key signals"}
              </h3>
              <span className="text-xs text-zinc-400">
                {locale === "id" ? "Hingga 3 temuan" : "Up to 3 findings"}
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
                {locale === "id" ? "Tindakan Berikutnya" : "Next Actions"}
              </h3>
              <span className="text-xs text-zinc-400">
                {locale === "id" ? "Tindakan yang disarankan" : "Recommended actions"}
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
                            ? locale === "id" ? "Prioritas Tinggi" : "High Priority"
                            : act.priority === "medium"
                            ? locale === "id" ? "Prioritas Sedang" : "Medium Priority"
                            : locale === "id" ? "Prioritas Rendah" : "Low Priority"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyActionToClipboard(act)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer transition-colors"
                        title={locale === "id" ? "Salin rencana tindakan ini" : "Copy action plan"}
                      >
                        <svg className="h-3 w-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>{locale === "id" ? "Salin tindakan" : "Copy action"}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-700 sm:grid-cols-3 dark:border-zinc-800 dark:text-zinc-300">
                      <div>
                        <span className="text-[11px] font-medium text-zinc-500 block">
                          {locale === "id" ? "Kenapa:" : "Why:"}
                        </span>
                        <p className="mt-0.5 leading-relaxed">{act.why}</p>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-zinc-500 block">
                          {locale === "id" ? "Lakukan:" : "Do:"}
                        </span>
                        <p className="mt-0.5 leading-relaxed font-medium">{act.do}</p>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block">
                          Stop-loss:
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
              {locale === "id"
                ? `Sumber: ${analysis.meta.source} · Diperbarui ${new Date(analysis.meta.generated_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB · Mesin: ${analysis.meta.engine === "llm" ? "AI Strategist" : "Berbasis aturan"}`
                : `Source: ${analysis.meta.source} · Updated ${new Date(analysis.meta.generated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · Engine: ${analysis.meta.engine === "llm" ? "AI Strategist" : "Rule-based"}`}
            </span>

            <button
              type="button"
              onClick={() => setShowCalculationDetails(!showCalculationDetails)}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 underline cursor-pointer self-start sm:self-auto"
            >
              {showCalculationDetails
                ? locale === "id" ? "Tutup dasar perhitungan" : "Hide calculation basis"
                : locale === "id" ? "Lihat dasar perhitungan" : "View calculation basis"}
            </button>
          </div>

          {showCalculationDetails && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 space-y-1.5 leading-relaxed">
              <p className="font-bold text-zinc-800 dark:text-zinc-200">
                {locale === "id" ? "Dasar Perhitungan & Integritas Metrik:" : "Metric Calculation Basis & Integrity:"}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>
                  <strong>{locale === "id" ? "Baseline Pembanding:" : "Comparison Baseline:"}</strong>{" "}
                  {locale === "id"
                    ? "Perubahan persentase hanya ditampilkan jika periode lalu memiliki belanja minimal Rp50.000 dan 5 hasil konversi untuk menghindari distorsi persentase."
                    : "Percentage deltas are only computed when the previous period had at least Rp50,000 spend and 5 conversions to prevent mathematical distortion."}
                </li>
                <li>
                  <strong>{locale === "id" ? "Aturan Stop-loss:" : "Stop-loss Rules:"}</strong>{" "}
                  {locale === "id"
                    ? "Ambang batas mundur ditetapkan otomatis pada 130% dari CPR saat ini dibulatkan ke ratusan terdekat."
                    : "Cut-loss thresholds are automatically bounded at 130% of current CPR rounded to the nearest hundred."}
                </li>
                <li>
                  <strong>Target CPR:</strong>{" "}
                  {locale === "id"
                    ? "Jika target CPR belum diisi, batas rekomendasi maksimal adalah PERTAHANKAN."
                    : "If target CPR is not set, maximum recommendation is capped at MAINTAIN."}
                </li>
                <li>
                  <strong>{locale === "id" ? "Rekomendasi Kreatif:" : "Creative Recommendation:"}</strong>{" "}
                  {locale === "id"
                    ? "Uji materi baru hanya disarankan jika CTR < 0,8% dan CPR di atas target, atau jika frekuensi ≥ 2,5x."
                    : "New creative refresh is recommended only when CTR < 0.8% with CPR above target, or frequency ≥ 2.5x."}
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty State before 1st run */}
      {!isLoading && !analysis && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-bold text-lg">
            ⚡
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Senior Meta Ads Performance Analyst
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {locale === "id"
                ? "Dapatkan verdict instan (Scale / Pertahankan / Optimasi / Stop), metrik utama 10 detik, dan 3 rekomendasi taktis advertiser dengan stop-loss terukur."
                : "Get instant verdicts (Scale / Maintain / Optimize / Stop), 10-second core metrics, and 3 tactical advertiser recommendations with disciplined stop-losses."}
            </p>
          </div>
          <button
            type="button"
            onClick={runPerformanceAnalysis}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer transition-colors"
          >
            <span>
              {locale === "id" ? "Mulai Analisis Performa Sekarang" : "Start Performance Analysis Now"}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
