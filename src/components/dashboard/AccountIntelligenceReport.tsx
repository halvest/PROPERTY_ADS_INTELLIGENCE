"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  AccountIntelligenceReport,
  RankedCampaign,
  RankedAd,
  PriorityActionItem,
} from "@/lib/ai/account-intelligence/engine";
import { formatDisplayCurrency } from "@/lib/format/display-currency";

interface AccountIntelligenceReportProps {
  report: AccountIntelligenceReport;
  currency?: string;
  locale?: "id" | "en";
}

type DrillDownEntity =
  | { kind: "campaign"; item: RankedCampaign }
  | { kind: "ad"; item: RankedAd };

function formatMoney(amount: number | null | undefined, currency = "IDR", locale = "id"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  return formatDisplayCurrency(amount, currency, locale === "en" ? "en" : "id");
}

function formatNum(value: number | null | undefined, locale = "id"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID").format(value);
}

function formatPct(value: number | null | undefined, locale = "id"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

/**
 * Standardized Soft-Tinted Semantic Action Badge (Fase 2.2 & Fase 3.1):
 * Max 2 words: Naikkan Budget, Pertahankan, Optimasi, Kurangi Budget, Nonaktifkan, Arsip Historis, Observasi.
 */
function getActionPillStyle(item: RankedCampaign | RankedAd): {
  label: string;
  className: string;
} {
  const fallbackLabel =
    item.effectiveStatus !== "ACTIVE"
      ? "Arsip Historis"
      : item.action === "SCALE"
        ? "Naikkan Budget"
        : item.action === "PAUSE"
          ? "Nonaktifkan"
          : item.action === "REDUCE_BUDGET"
            ? "Kurangi Budget"
            : item.action === "OPTIMIZE"
              ? "Optimasi"
              : item.category === "INSUFFICIENT_DATA" || item.category === "GATHERING_DATA"
                ? "Observasi"
                : "Pertahankan";

  const label = item.actionLabel || fallbackLabel;

  if (item.effectiveStatus !== "ACTIVE" || label === "Arsip Historis") {
    return {
      label: "Arsip Historis",
      className:
        "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20",
    };
  }
  if (item.funnelSignal === "material_waste" || item.action === "PAUSE" || label === "Nonaktifkan") {
    return {
      label: "Nonaktifkan",
      className:
        "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/25",
    };
  }
  if (item.action === "REDUCE_BUDGET" || label === "Kurangi Budget") {
    return {
      label: "Kurangi Budget",
      className:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25",
    };
  }
  if (
    item.funnelSignal === "golden_offer" ||
    item.funnelSignal === "traffic_leak" ||
    item.action === "OPTIMIZE" ||
    label === "Optimasi"
  ) {
    return {
      label: "Optimasi",
      className:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25",
    };
  }
  if (item.action === "SCALE" || label === "Naikkan Budget") {
    return {
      label: "Naikkan Budget",
      className:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25",
    };
  }
  if (label === "Observasi") {
    return {
      label: "Observasi",
      className:
        "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20",
    };
  }
  return {
    label: "Pertahankan",
    className:
      "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-400/25",
  };
}

function getPriorityIndicatorStyle(item: PriorityActionItem): {
  dotClass: string;
  pillLabel: string;
  pillClass: string;
} {
  if (item.priority === "CRITICAL" || item.funnelSignal === "material_waste" || item.action === "PAUSE") {
    return {
      dotClass: "bg-rose-500",
      pillLabel: item.actionLabel || "Nonaktifkan",
      pillClass:
        "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/25",
    };
  }
  if (item.action === "SCALE" || item.actionLabel === "Naikkan Budget") {
    return {
      dotClass: "bg-emerald-500",
      pillLabel: item.actionLabel || "Naikkan Budget",
      pillClass:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25",
    };
  }
  return {
    dotClass: "bg-amber-500",
    pillLabel: item.actionLabel || "Optimasi",
    pillClass:
      "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25",
  };
}

export function AccountIntelligenceReportView({
  report,
  currency = "IDR",
  locale = "id",
}: AccountIntelligenceReportProps) {
  const [activeLevel, setActiveLevel] = useState<"campaigns" | "ads">("campaigns");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ALL" | "PAUSED">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");
  const [popoverOpenScope, setPopoverOpenScope] = useState<string | null>(null);
  const [selectedEntityState, setSelectedEntityState] = useState<{
    scopeKey: string;
    entity: DrillDownEntity;
  } | null>(null);

  const meta = report.analysis_metadata;
  const summary = report.account_summary;
  const reportScopeKey = `${meta.account_id || ""}:${meta.period_start}:${meta.period_end}`;

  const showDataNotesPopover = popoverOpenScope === reportScopeKey;
  const setShowDataNotesPopover = (updater: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof updater === "function" ? updater(showDataNotesPopover) : updater;
    setPopoverOpenScope(nextVal ? reportScopeKey : null);
  };

  const selectedEntity =
    selectedEntityState && selectedEntityState.scopeKey === reportScopeKey
      ? selectedEntityState.entity
      : null;
  const setSelectedEntity = (entity: DrillDownEntity | null) => {
    setSelectedEntityState(entity ? { scopeKey: reportScopeKey, entity } : null);
  };

  // Allow closing "Detail Audit" drawer with Escape key
  useEffect(() => {
    if (!selectedEntity) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedEntityState(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEntity]);
  const dataWarnings = report.data_quality?.warnings ?? [];
  const hc = useMemo(() => {
    if (summary.health_counts) return summary.health_counts;
    const entities = report.campaign_rankings.length > 0 ? report.campaign_rankings : report.ad_rankings;
    let activeCount = 0;
    let scaleCount = 0;
    let wasteCount = 0;
    let optimizeCount = 0;
    let holdCount = 0;
    let historicalCount = 0;
    let historicalGoodCount = 0;
    let historicalNeutralCount = 0;
    let historicalUnderperformingCount = 0;

    for (const e of entities) {
      if (e.effectiveStatus === "ACTIVE") {
        activeCount += 1;
        if (e.funnelSignal === "material_waste" || e.action === "PAUSE" || e.action === "REDUCE_BUDGET") {
          wasteCount += 1;
        } else if (e.action === "SCALE") {
          scaleCount += 1;
        } else if (
          e.funnelSignal === "golden_offer" ||
          e.funnelSignal === "traffic_leak" ||
          e.action === "OPTIMIZE" ||
          e.category === "NEEDS_OPTIMIZATION"
        ) {
          optimizeCount += 1;
        } else {
          holdCount += 1;
        }
      } else {
        historicalCount += 1;
        if (e.category === "TOP_PERFORMER" || e.category === "EFFICIENT" || e.category === "WINNER") {
          historicalGoodCount += 1;
        } else if (e.category === "UNDERPERFORMING" || e.category === "LOSING") {
          historicalUnderperformingCount += 1;
        } else {
          historicalNeutralCount += 1;
        }
      }
    }

    return {
      activeCount,
      scaleCount,
      wasteCount,
      optimizeCount,
      holdCount,
      historicalCount,
      historicalGoodCount,
      historicalNeutralCount,
      historicalUnderperformingCount,
    };
  }, [report.ad_rankings, report.campaign_rankings, summary.health_counts]);

  // Auto-fallback to ALL if there are 0 active campaigns so the table is never blank when all campaigns are paused
  const effectiveStatusFilter =
    statusFilter === "ACTIVE" && meta.all_campaigns_paused ? "ALL" : statusFilter;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCampaigns = useMemo(() => {
    return report.campaign_rankings.filter((c) => {
      if (effectiveStatusFilter === "ACTIVE" && c.effectiveStatus !== "ACTIVE") return false;
      if (effectiveStatusFilter === "PAUSED" && c.effectiveStatus === "ACTIVE") return false;
      if (normalizedQuery) {
        const hay = `${c.name} ${c.resultLabel} ${c.objective || ""}`.toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [report.campaign_rankings, effectiveStatusFilter, normalizedQuery]);

  const filteredAds = useMemo(() => {
    return report.ad_rankings.filter((a) => {
      if (effectiveStatusFilter === "ACTIVE" && a.effectiveStatus !== "ACTIVE") return false;
      if (effectiveStatusFilter === "PAUSED" && a.effectiveStatus === "ACTIVE") return false;
      if (normalizedQuery) {
        const hay = `${a.name} ${a.campaignName || ""} ${a.resultLabel}`.toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [report.ad_rankings, effectiveStatusFilter, normalizedQuery]);

  // Group campaigns by objective when multi-objective is present
  const campaignObjectiveGroups = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; items: RankedCampaign[]; totalSpend: number; totalResults: number }
    >();
    for (const item of filteredCampaigns) {
      const key = item.resultKind || "unknown";
      const existing = groups.get(key) ?? {
        label: item.resultLabel,
        items: [],
        totalSpend: 0,
        totalResults: 0,
      };
      existing.items.push(item);
      existing.totalSpend = item.spend == null ? existing.totalSpend : existing.totalSpend + item.spend;
      existing.totalResults += item.results ?? 0;
      groups.set(key, existing);
    }
    return Array.from(groups.entries());
  }, [filteredCampaigns]);

  const priorityActions = useMemo(() => {
    if (report.priority_actions && report.priority_actions.length > 0) {
      return report.priority_actions.slice(0, 5);
    }
    return [];
  }, [report.priority_actions]);

  const openEntityById = (objectLevel: "campaign" | "ad", objectId: string) => {
    if (objectLevel === "campaign") {
      const found = report.campaign_rankings.find((c) => c.id === objectId);
      if (found) setSelectedEntity({ kind: "campaign", item: found });
    } else {
      const found = report.ad_rankings.find((a) => a.id === objectId);
      if (found) setSelectedEntity({ kind: "ad", item: found });
    }
  };

  // Top Data Quality Pill (Fase 3.3 #1)
  const dataQualityBadge = useMemo(() => {
    if (meta.all_campaigns_paused) {
      return {
        label: "Status: Arsip Historis (Nonaktif)",
        tone: "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20",
      };
    }
    if (!summary.results_comparable) {
      return {
        label: "Kualitas Data: Multi-Objektif",
        tone: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-400/25",
      };
    }
    if (meta.data_confidence === "high") {
      return {
        label: "Kualitas Data: Tinggi",
        tone: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25",
      };
    }
    if (meta.data_confidence === "medium") {
      return {
        label: "Kualitas Data: Sedang",
        tone: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25",
      };
    }
    return {
      label: "Kualitas Data: Terbatas",
      tone: "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20",
    };
  }, [meta.all_campaigns_paused, meta.data_confidence, summary.results_comparable]);

  // Representative target CPR for Account CPR comparison when comparable
  const accountTargetCpr = useMemo(() => {
    if (!summary.results_comparable) return null;
    const configured = report.campaign_rankings.find((c) => c.target.value !== null && c.target.value > 0);
    return configured?.target.value ?? null;
  }, [report.campaign_rankings, summary.results_comparable]);

  const accountCprDeltaText = useMemo(() => {
    if (!summary.results_comparable) return "Lihat per Objektif";
    if (summary.blended_cpr === null) return "Belum ada konversi pada periode ini";
    if (accountTargetCpr && accountTargetCpr > 0) {
      const diffPct = Math.round(((summary.blended_cpr - accountTargetCpr) / accountTargetCpr) * 100);
      if (diffPct <= 0) {
        return `${Math.abs(diffPct)}% lebih efisien dari target (${formatMoney(accountTargetCpr, currency, locale)})`;
      }
      return `+${diffPct}% di atas target (${formatMoney(accountTargetCpr, currency, locale)})`;
    }
    return `Terhitung dari ${formatNum(summary.total_results, locale)} ${summary.result_label || "hasil"}`;
  }, [accountTargetCpr, currency, locale, summary.blended_cpr, summary.result_label, summary.results_comparable, summary.total_results]);

  return (
    <div className="space-y-5">
      {/* =====================================================================
          1. TOP ACTION BAR + COMPACT DATA QUALITY PILL (Zero Banner Clutter)
         ===================================================================== */}
      <div className="relative rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ${dataQualityBadge.tone}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {dataQualityBadge.label}
            </span>

            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
              {report.intelligence.executive_pulse || report.intelligence.executive_summary}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline-block font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {meta.period_start} — {meta.period_end}
            </span>

            {dataWarnings.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDataNotesPopover((prev) => !prev)}
                  aria-expanded={showDataNotesPopover}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <svg
                    className="h-3.5 w-3.5 text-zinc-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Catatan Data ({dataWarnings.length})</span>
                </button>

                {showDataNotesPopover && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-80 sm:w-96 rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Kualitas & Batasan Data Snapshot
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDataNotesPopover(false)}
                        className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                    <ul className="mt-2.5 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                      {dataWarnings.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. KPI EXECUTIVE STRIP (4 Symmetric Cards, Uniform Height)
         ===================================================================== */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Pengeluaran */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Pengeluaran
          </span>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatMoney(summary.total_spend, currency, locale)}
          </p>
          <p className="mt-1.5 text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
            {formatNum(summary.total_impressions, locale)} impresi · CTR{" "}
            {formatPct(summary.average_ctr, locale)}
          </p>
        </div>

        {/* Card 2: Total Hasil */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Hasil
          </span>
          {summary.results_comparable ? (
            <>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatNum(summary.total_results, locale)}
              </p>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {summary.result_label || "Konversi utama"} · Klik tautan{" "}
                <span className="font-mono tabular-nums">{formatNum(summary.total_link_clicks, locale)}</span>
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(summary.result_breakdown_by_kind ?? []).slice(0, 3).map((g) => (
                  <span
                    key={g.kind}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-zinc-800 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    {formatNum(g.results, locale)} {g.label}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Multi-Objektif · Hasil tidak digabung lintas objektif
              </p>
            </>
          )}
        </div>

        {/* Card 3: CPR Akun */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            CPR Akun
          </span>
          {summary.results_comparable ? (
            <>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatMoney(summary.blended_cpr, currency, locale)}
              </p>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {accountCprDeltaText}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-base font-semibold text-zinc-800 dark:text-zinc-200">
                Lihat per Objektif
              </p>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Evaluasi CPR dipisahkan per jenis hasil di tabel bawah
              </p>
            </>
          )}
        </div>

        {/* Card 4: Distribusi Status */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Distribusi Status
          </span>

          {hc.activeCount === 0 && hc.historicalCount > 0 ? (
            <>
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-400/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                    {hc.historicalCount} Arsip Historis (Dijeda)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                  {hc.historicalGoodCount > 0 && (
                    <span className="inline-flex items-center rounded-md bg-emerald-50/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/20">
                      {hc.historicalGoodCount} Performa Baik
                    </span>
                  )}
                  {hc.historicalNeutralCount > 0 && (
                    <span className="inline-flex items-center rounded-md bg-zinc-100/90 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-500/15 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-400/20">
                      {hc.historicalNeutralCount} Stabil / Perlu Evaluasi
                    </span>
                  )}
                  {hc.historicalUnderperformingCount > 0 && (
                    <span className="inline-flex items-center rounded-md bg-amber-50/80 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/20">
                      {hc.historicalUnderperformingCount} Kurang Efisien
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Seluruh kampanye periode ini nonaktif. Angka tetap masuk rekap sebagai referensi.
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25">
                  {hc.scaleCount} Efisien
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25">
                  {hc.optimizeCount} Optimasi
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/25">
                  {hc.wasteCount} Kritis
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20">
                  {hc.holdCount} Observasi
                </span>
              </div>
              <p className="mt-1.5 text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                {hc.activeCount} aktif · {hc.historicalCount} arsip historis
              </p>
            </>
          )}
        </div>
      </div>

      {/* =====================================================================
          3. PANEL "PRIORITAS TINDAKAN" (Max 3–5 Active Items by Spend Impact)
         ===================================================================== */}
      {priorityActions.length > 0 && (
        <section className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Prioritas Tindakan
              </h3>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300">
                {priorityActions.length} prioritas aktif
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Diurutkan berdasarkan dampak pengeluaran (hanya kampanye/iklan aktif)
            </span>
          </div>

          <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {priorityActions.map((act) => {
              const pStyle = getPriorityIndicatorStyle(act);

              return (
                <button
                  key={`${act.objectLevel}:${act.objectId}`}
                  type="button"
                  onClick={() => openEntityById(act.objectLevel, act.objectId)}
                  className="group flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 rounded-lg px-2 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${pStyle.dotClass}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {act.objectName}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 shrink-0">
                          {act.objectLevel === "campaign" ? "Kampanye" : "Iklan"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300 truncate">
                        {act.summaryShort}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:inline-block font-mono text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatMoney(act.spend, currency, locale)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${pStyle.pillClass}`}
                    >
                      {pStyle.pillLabel}
                    </span>
                    <span className="text-xs text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                      →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          4. TABEL EVALUASI (Segmented Tabs + Status Filter + Search + 6 Columns)
         ===================================================================== */}
      <section className="rounded-xl border border-zinc-200/80 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        {/* Table Control Bar */}
        <div className="flex flex-col gap-3 border-b border-zinc-200/80 px-4 py-3.5 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Segmented Tabs (Ringkasan Kampanye | Detail Iklan) */}
          <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800 self-start">
            <button
              type="button"
              onClick={() => setActiveLevel("campaigns")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeLevel === "campaigns"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Ringkasan Kampanye ({filteredCampaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveLevel("ads")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeLevel === "ads"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Detail Iklan ({filteredAds.length})
            </button>
          </div>

          {/* Right: Compact Search Input + Quick Status Filters (Aktif | Semua | Nonaktif) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial sm:w-56">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeLevel === "campaigns"
                    ? "Cari nama kampanye..."
                    : "Cari nama iklan / kampanye..."
                }
                aria-label="Cari kampanye atau iklan"
                className="h-8 w-full rounded-lg border border-zinc-200/80 bg-zinc-50 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
              />
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
              {(
                [
                  { id: "ACTIVE", label: "Aktif" },
                  { id: "ALL", label: "Semua" },
                  { id: "PAUSED", label: "Nonaktif" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    effectiveStatusFilter === f.id
                      ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-100"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===================================================================
            TAB A: RINGKASAN KAMPANYE (Max 6 Core Columns)
           =================================================================== */}
        {activeLevel === "campaigns" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                  <th scope="col" className="px-4 py-3 text-left">
                    Nama & Objektif
                  </th>
                  <th scope="col" className="px-3 py-3 text-right tabular-nums">
                    Spend
                  </th>
                  <th scope="col" className="px-3 py-3 text-right tabular-nums">
                    Hasil
                  </th>
                  <th scope="col" className="px-3 py-3 text-right tabular-nums">
                    CPR vs Target
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">
                    Diagnosis Ringkas
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-zinc-500">
                      Tidak ada kampanye pada filter ini.
                    </td>
                  </tr>
                ) : (
                  campaignObjectiveGroups.map(([groupKey, group]) => (
                    <React.Fragment key={groupKey}>
                      {!summary.results_comparable && campaignObjectiveGroups.length > 1 && (
                        <tr className="bg-zinc-50/90 dark:bg-zinc-800/50">
                          <td
                            colSpan={6}
                            className="px-4 py-2 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300"
                          >
                            Objektif: {group.label} ·{" "}
                            <span className="font-mono tabular-nums">
                              {group.items.length} kampanye · Spend{" "}
                              {formatMoney(group.totalSpend, currency, locale)} ·{" "}
                              {formatNum(group.totalResults, locale)} {group.label}
                            </span>
                          </td>
                        </tr>
                      )}
                      {group.items.map((c) => {
                        const isLive = c.effectiveStatus === "ACTIVE";
                        const pill = getActionPillStyle(c);
                        const targetNote = c.target.value
                          ? `Target ${formatMoney(c.target.value, currency, locale)}`
                          : "Target belum diatur";

                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedEntity({ kind: "campaign", item: c })}
                            className="group cursor-pointer transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                          >
                            {/* Col 1: Nama & Objektif */}
                            <td className="px-4 py-3.5 max-w-[260px]">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${
                                    isLive ? "bg-emerald-500" : "bg-zinc-400"
                                  }`}
                                  title={isLive ? "Aktif" : "Nonaktif"}
                                />
                                <span
                                  className="font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                                  title={c.name}
                                >
                                  {c.name}
                                </span>
                              </div>
                              <p className="pl-4 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                                {c.resultLabel} · {isLive ? "Aktif" : "Nonaktif"}
                              </p>
                            </td>

                            {/* Col 2: Spend */}
                            <td className="px-3 py-3.5 text-right font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                              {formatMoney(c.spend, currency, locale)}
                            </td>

                            {/* Col 3: Hasil */}
                            <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatNum(c.results, locale)}
                              </span>
                              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                                {c.resultLabel}
                              </span>
                            </td>

                            {/* Col 4: CPR vs Target */}
                            <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                              <span
                                className={`font-semibold ${
                                  c.target.status === "BETTER"
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : c.target.status === "WORSE"
                                      ? "text-rose-700 dark:text-rose-400"
                                      : "text-zinc-900 dark:text-zinc-100"
                                }`}
                              >
                                {formatMoney(c.cpr, currency, locale)}
                              </span>
                              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                                {targetNote}
                              </span>
                            </td>

                            {/* Col 5: Diagnosis Ringkas */}
                            <td className="px-3 py-3.5 max-w-[280px]">
                              <p
                                className="font-medium text-zinc-900 dark:text-zinc-100 truncate"
                                title={c.summaryShort || c.diagnosisLabel}
                              >
                                {c.diagnosisLabel || c.reason}
                              </p>
                              <p className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                                CTR {formatPct(c.ctr, locale)} · CVR {formatPct(c.cvr, locale)}
                              </p>
                            </td>

                            {/* Col 6: Tindakan */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <span
                                  className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${pill.className}`}
                                >
                                  {pill.label}
                                </span>
                                <span className="text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                                  →
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================================================================
            TAB B: DETAIL IKLAN (Max 6 Core Columns)
           =================================================================== */}
        {activeLevel === "ads" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                  <th scope="col" className="px-4 py-3 text-left">
                    Nama Iklan & Kampanye
                  </th>
                  <th scope="col" className="px-3 py-3 text-right tabular-nums">
                    Spend
                  </th>
                  <th scope="col" className="px-3 py-3 text-right tabular-nums">
                    Hasil & CPR
                  </th>
                  <th scope="col" className="px-3 py-3 text-right tabular-nums">
                    Funnel (CTR · CVR)
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">
                    Diagnosis Ringkas
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {filteredAds.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-zinc-500">
                      Tidak ada materi iklan pada filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredAds.map((ad) => {
                    const isLive = ad.effectiveStatus === "ACTIVE";
                    const pill = getActionPillStyle(ad);
                    const funnelColor =
                      ad.funnelSignal === "golden_offer"
                        ? "text-amber-700 dark:text-amber-300 font-semibold"
                        : ad.funnelSignal === "traffic_leak"
                          ? "text-rose-700 dark:text-rose-400 font-semibold"
                          : "text-zinc-800 dark:text-zinc-200";

                    return (
                      <tr
                        key={ad.id}
                        onClick={() => setSelectedEntity({ kind: "ad", item: ad })}
                        className="group cursor-pointer transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                      >
                        {/* Col 1: Nama Iklan & Kampanye */}
                        <td className="px-4 py-3.5 max-w-[260px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                isLive ? "bg-emerald-500" : "bg-zinc-400"
                              }`}
                              title={isLive ? "Aktif" : "Nonaktif"}
                            />
                            <span
                              className="font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                              title={ad.name}
                            >
                              {ad.name}
                            </span>
                          </div>
                          <p
                            className="pl-4 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate"
                            title={ad.campaignName || "Kampanye"}
                          >
                            {ad.campaignName || "Kampanye"} · {isLive ? "Aktif" : "Nonaktif"}
                          </p>
                        </td>

                        {/* Col 2: Spend */}
                        <td className="px-3 py-3.5 text-right font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatMoney(ad.spend, currency, locale)}
                        </td>

                        {/* Col 3: Hasil & CPR */}
                        <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {formatNum(ad.results, locale)} {ad.resultLabel}
                          </span>
                          <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                            {formatMoney(ad.cpr, currency, locale)}
                          </span>
                        </td>

                        {/* Col 4: Funnel (CTR · CVR) */}
                        <td className={`px-3 py-3.5 text-right font-mono tabular-nums ${funnelColor}`}>
                          <div>CTR {formatPct(ad.ctr, locale)}</div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            CVR {formatPct(ad.cvr, locale)}
                          </div>
                        </td>

                        {/* Col 5: Diagnosis Ringkas */}
                        <td className="px-3 py-3.5 max-w-[280px]">
                          <p
                            className="font-medium text-zinc-900 dark:text-zinc-100 truncate"
                            title={ad.summaryShort || ad.diagnosisLabel}
                          >
                            {ad.diagnosisLabel || ad.reason}
                          </p>
                          <p className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                            {formatNum(ad.impressions, locale)} imp · CPC{" "}
                            {formatMoney(ad.cpc, currency, locale)}
                          </p>
                        </td>

                        {/* Col 6: Tindakan */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <span
                              className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${pill.className}`}
                            >
                              {pill.label}
                            </span>
                            <span className="text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                              →
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =====================================================================
          5. SLIDE-OVER DETAIL DRAWER ("Detail Audit", max-w-lg, Sticky Header)
         ===================================================================== */}
      {selectedEntity && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-2xs"
          onClick={() => setSelectedEntity(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Detail Audit ${selectedEntity.item.name}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-lg flex-col border-l border-zinc-200/80 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden"
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-200/80 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Detail Audit · {selectedEntity.kind === "campaign" ? "Kampanye" : "Materi Iklan"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      getActionPillStyle(selectedEntity.item).className
                    }`}
                  >
                    {getActionPillStyle(selectedEntity.item).label}
                  </span>
                </div>
                <h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                  {selectedEntity.item.name}
                </h3>
                {selectedEntity.kind === "ad" && selectedEntity.item.campaignName && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    Kampanye: {selectedEntity.item.campaignName}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntity(null)}
                className="rounded-lg border border-zinc-200/80 p-1.5 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Tutup Detail Audit"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body: Ordered Blocks 1 -> 2 -> 3 -> 4 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* BLOK 1: Ringkasan Tindakan & Alasan Utama */}
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  1. Ringkasan Tindakan & Alasan Utama
                </span>
                <p className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {selectedEntity.item.summaryShort || selectedEntity.item.diagnosisLabel}
                </p>
                <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {selectedEntity.item.reason}
                </p>
              </div>

              {/* BLOK 2: Grid Metrik Utama (Spend, Hasil, CPR, Target CPR, CTR, CVR, CPC, Impresi, Frekuensi) */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  2. Grid Metrik Utama
                </h4>
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">Spend</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatMoney(selectedEntity.item.spend, currency, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">Hasil</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatNum(selectedEntity.item.results, locale)} {selectedEntity.item.resultLabel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">CPR Aktual</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatMoney(selectedEntity.item.cpr, currency, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">Target CPR</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {selectedEntity.item.target.value
                        ? formatMoney(selectedEntity.item.target.value, currency, locale)
                        : "Belum diatur"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">CTR Tautan</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatPct(selectedEntity.item.ctr, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">CVR Konversi</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatPct(selectedEntity.item.cvr, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">CPC</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatMoney(selectedEntity.item.cpc, currency, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">Impresi</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatNum(selectedEntity.item.impressions, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase text-zinc-400">Frekuensi</span>
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {selectedEntity.item.frequency !== null && selectedEntity.item.frequency !== undefined
                        ? `${selectedEntity.item.frequency.toFixed(2)}x`
                        : "— (multi-hari)"}
                    </p>
                  </div>
                </div>
              </div>

              {/* BLOK 3: Komposisi Skor Efisiensi (CPR 45%, Volume 30%, Reliabilitas 15%, CTR 5%, CPC 5%) */}
              <div className="rounded-xl border border-zinc-200/80 p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    3. Komposisi Skor Efisiensi
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {selectedEntity.item.score.total}/100
                  </span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {[
                    {
                      label: "Efisiensi CPR (Bobot 45%)",
                      val: selectedEntity.item.score.cpr,
                    },
                    {
                      label: "Volume Hasil (Bobot 30%)",
                      val: selectedEntity.item.score.volume,
                    },
                    {
                      label: "Reliabilitas Sampel (Bobot 15%)",
                      val: selectedEntity.item.score.confidence,
                    },
                    {
                      label: "CTR Tautan (Bobot 5%)",
                      val: selectedEntity.item.score.ctr,
                    },
                    {
                      label: "Efisiensi CPC (Bobot 5%)",
                      val: selectedEntity.item.score.cpc,
                    },
                  ].map((comp) => (
                    <div key={comp.label} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-600 dark:text-zinc-400">{comp.label}</span>
                        <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {comp.val}/100
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-zinc-800 dark:bg-zinc-200"
                          style={{ width: `${Math.max(4, Math.min(100, comp.val))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BLOK 4: Langkah Evaluasi & Batasan Data */}
              <div className="rounded-xl border border-zinc-200/80 p-4 dark:border-zinc-800 space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  4. Langkah Evaluasi & Batasan Data
                </span>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Catatan Alokasi Anggaran
                  </span>
                  <p className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {report.budget_analysis.allocation_note}
                  </p>
                </div>
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Sumber Spend Kanonik: Level Iklan ({report.data_quality.canonical_spend_level}) · Status Efektif:{" "}
                  {selectedEntity.item.effectiveStatus} (Konfigurasi: {selectedEntity.item.configuredStatus})
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
