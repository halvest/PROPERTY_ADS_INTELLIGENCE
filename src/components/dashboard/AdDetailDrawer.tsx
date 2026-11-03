"use client";

import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import type { RealAdRow } from "@/app/(dashboard)/ads/page";
import type {
  AIAdAnalysisResponse,
  CoreMetricItem,
} from "@/app/api/ai/analyze-ad/route";
import type { AdDetailResponseData } from "@/app/api/ads/[id]/route";
import { useAiQuota } from "@/hooks/useAiQuota";
import { IdempotencyKeyManager } from "@/lib/ai/idempotency-key";
import {
  formatMetaDateRange,
  formatSmartAdIdentity,
  localizeResultLabel,
  localizeResultUnitLabel,
  resolveAdResultMetric,
  translateMetaTerm,
} from "@/lib/ads/result-metric";
import { formatDisplayCurrency } from "@/lib/format/display-currency";
import { composeAdCardCopy } from "@/lib/ai/ctwa-analysis/ad-card-copy";
import type { TranslationDictionary } from "@/lib/i18n/types";

function X({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function Copy({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function Check({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Sparkles({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function RefreshCw({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function AlertCircle({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ArrowUpRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 10l7-7m0 0l7 7m-7-7v18"
      />
    </svg>
  );
}

function ArrowDownRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 14l-7 7m0 0l-7-7m7 7V3"
      />
    </svg>
  );
}

function PauseCircle({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ShieldCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function SlidersHorizontal({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
      />
    </svg>
  );
}

function Layers({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function Wallet({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function MessageSquare({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}

function ChevronDown({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function Info({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function AlertTriangle({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function CheckCircle2({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function Clock({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function Database({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  );
}

function Activity({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

/**
 * Session-scoped in-memory cache for AI ad analysis.
 * Keyed by `${adId}::${dateRange || "all"}` so reopening the dialog for the same ad and
 * reporting period restores the analysis immediately without calling the AI endpoint or
 * consuming user quota, while avoiding persistent browser storage for sensitive CRM data.
 */
const aiAnalysisSessionCache = new Map<string, AIAdAnalysisResponse>();

function buildAiCacheKey(
  adId: string,
  dateRange?: string,
  locale?: string
): string {
  return `${adId}::${dateRange || "all"}::${locale || "id"}`;
}

interface AdDetailDrawerProps {
  ad: RealAdRow;
  currency?: string;
  lastSyncedAt?: string | null;
  /** Dashboard period preset, forwarded to AI analysis so AI and dashboard aggregate the same range. */
  dateRange?: string;
  onClose: () => void;
}

function MetricCard({
  label,
  value,
  detail,
  highlight = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  highlight?: "slate" | "indigo" | "green" | "amber";
}) {
  const valueColor =
    highlight === "indigo"
      ? "text-indigo-700 dark:text-indigo-300"
      : highlight === "green"
        ? "text-emerald-700 dark:text-emerald-300"
        : highlight === "amber"
          ? "text-amber-700 dark:text-amber-300"
          : "text-zinc-900 dark:text-zinc-100";
  const cardTone =
    highlight === "indigo"
      ? "border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20"
      : highlight === "green"
        ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
        : highlight === "amber"
          ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
          : "border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/50";
  return (
    <div className={`min-w-0 rounded-xl border p-3.5 ${cardTone}`}>
      <dt className="text-[11px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd
        className={`mt-1.5 truncate text-base sm:text-lg font-bold tracking-tight tabular-nums ${valueColor}`}
        title={value}
      >
        {value}
      </dd>
      <dd
        className="mt-1 truncate text-[10px] text-zinc-500 dark:text-zinc-400"
        title={detail}
      >
        {detail}
      </dd>
    </div>
  );
}

function translateRecommendedAction(
  action: string | undefined,
  t: TranslationDictionary["adDrawer"]
): string | null {
  if (!action) return null;
  switch (action.toUpperCase()) {
    case "SCALE":
      return t.actionScale;
    case "MAINTAIN":
      return t.actionMaintain;
    case "OPTIMIZE":
      return t.actionOptimize;
    case "STOP":
      return t.actionStop;
    case "INVESTIGATE":
      return t.actionInvestigate;
    case "RE_ACTIVATE":
      return t.actionReactivate;
    default:
      return action;
  }
}

function translatePeriodConfidence(
  confidence: string | undefined,
  t: TranslationDictionary["adDrawer"]
): { label: string; toneClass: string } | null {
  if (!confidence) return null;
  const upper = confidence.toUpperCase();
  if (upper === "HIGH") {
    return {
      label: t.verdictConfidenceHigh,
      toneClass:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  }
  if (upper === "MEDIUM") {
    return {
      label: t.verdictConfidenceMedium,
      toneClass:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    };
  }
  if (upper === "LOW") {
    return {
      label: t.verdictConfidenceLow,
      toneClass:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    };
  }
  return {
    label: confidence,
    toneClass:
      "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
}

function translateEntityStatus(
  status: string | undefined,
  t: TranslationDictionary["adDrawer"]
): string | null {
  if (!status) return null;
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") return t.verdictEntityActive;
  if (upper === "PAUSED") return t.verdictEntityPaused;
  if (upper === "UNKNOWN") return t.verdictEntityUnknown;
  return status;
}

function localizeCrmText(text: string | undefined | null, locale: string): string {
  if (!text) return "";
  if (locale !== "en") return text;
  return text
    .replace(/Gagal mengambil data CRM/g, "Failed to load CRM data")
    .replace(
      /Pengambilan data CRM gagal\. Angka 0 tidak dipakai sebagai pengganti\./g,
      "CRM data fetch failed. Zero is not used as a substitute."
    )
    .replace(/Data CRM tidak lengkap/g, "Incomplete CRM data")
    .replace(
      /Hasil query terpotong oleh batas halaman\. Angka sebagian tidak ditampilkan sebagai total\./g,
      "Query results were truncated by the page limit. Partial counts are not shown as totals."
    )
    .replace(
      /Langsung (\d[\d.,]*) · Kampanye (\d[\d.,]*) · Workspace (\d[\d.,]*)/g,
      "Direct $1 · Campaign $2 · Workspace $3"
    )
    .replace(
      /Tidak ada prospek CRM pada workspace untuk periode ini\. Atribusi ad set tidak tersedia karena percakapan tidak menyimpan ad set\. Prospek berkualitas tidak dihitung\./g,
      "No CRM prospects in the workspace for this period. Ad set attribution is unavailable because conversations do not store the ad set. Qualified leads are not computed."
    )
    .replace(/Atribusi langsung ke iklan: /g, "Direct attribution to ad: ")
    .replace(/Atribusi ad set: tidak tersedia/g, "Ad set attribution: unavailable")
    .replace(/Atribusi ad set: /g, "Ad set attribution: ")
    .replace(/Hanya kampanye: /g, "Campaign only: ")
    .replace(/Iklan lain: /g, "Other ads: ")
    .replace(/Tanpa atribusi: /g, "Unattributed: ")
    .replace(/Total workspace: /g, "Workspace total: ")
    .replace(/Langsung ke iklan ini (\d+)\./g, "Direct to this ad: $1.")
    .replace(/Ad set tidak tersedia\./g, "Ad set unavailable.")
    .replace(/Ad set (\d+)\./g, "Ad set: $1.")
    .replace(/Hanya kampanye (\d+)\./g, "Campaign only: $1.")
    .replace(/Iklan lain (\d+)\./g, "Other ads: $1.")
    .replace(/Tanpa atribusi (\d+)\./g, "Unattributed: $1.")
    .replace(/Workspace (\d+)\./g, "Workspace: $1.")
    .replace(
      /(\d+) menyebut iklan ini lewat nama dan belum terverifikasi\./g,
      "$1 referenced this ad by name and is unverified."
    )
    .replace(
      /Suhu workspace: (\d+) hot, (\d+) warm, (\d+) cold\. Suhu bukan prospek berkualitas\./g,
      "Workspace temperature: $1 hot, $2 warm, $3 cold. Temperature does not equal qualified leads."
    )
    .replace(
      /Tidak ada tahap tersimpan pada prospek kampanye\./g,
      "No funnel stage recorded for campaign prospects."
    )
    .replace(
      /Tahap pada prospek kampanye, bukan hasil iklan:/g,
      "Stages on campaign prospects (not ad results):"
    )
    .replace(
      /Biaya per prospek hanya memakai atribusi langsung\. Nama kampanye tidak menaikkan prospek menjadi hasil iklan\./g,
      "Cost per prospect uses direct attribution only. Campaign matches do not count as ad results."
    )
    .replace(/Periode: Semua data tersimpan\./g, "Period: All stored data.")
    .replace(/Periode:/g, "Period:")
    .replace(/ s\.d\. /g, " to ")
    .replace(/prospek dari CRM/g, "prospects from CRM")
    .replace(/Belum tersedia/g, "Not available yet")
    .replace(/Tidak tersedia/g, "Not available")
    .replace(
      /Data prospek berasal dari input atau unggahan klien\. Pesan tidak dikumpulkan otomatis\./g,
      "Prospect data comes from client input or uploads. Messages are not collected automatically."
    );
}

function localizeAllMetricRow(
  met: { label: string; value: string; explanation: string },
  locale: string
): { label: string; value: string; explanation: string } {
  if (locale !== "en") return met;
  const labelMap: Record<string, string> = {
    "Total Belanja": "Total Spend",
    "Tayangan (Impressions)": "Impressions",
    "Jangkauan (Reach)": "Unique Reach",
    "Klik Tautan": "Link Clicks",
    "Semua Klik": "All Clicks",
    "CTR Tautan": "Link CTR",
    CPM: "CPM",
    "Percakapan Messaging": "Messaging Conversations",
    "Leads Meta": "Meta Leads",
  };
  const explanationMap: Record<string, string> = {
    "Biaya resmi dari platform Meta.": "Official spend billed by Meta.",
    "Biaya resmi yang ditagihkan platform Meta.": "Official spend billed by Meta.",
    "Frekuensi materi iklan tampil di layar.": "Total times the ad creative was displayed.",
    "Frekuensi materi iklan tampil di layar pengguna.": "Total times the ad creative was displayed.",
    "Jumlah orang unik yang melihat iklan (multi-hari tidak dijumlahkan).":
      "Unique people who saw the ad (multi-day reach is not summed).",
    "Jumlah pengguna unik yang melihat iklan (hanya valid satu hari; multi-hari tidak dijumlahkan).":
      "Unique people who saw the ad (valid for single-day only; multi-day reach is not summed).",
    "Klik tombol/tautan menuju WhatsApp.": "Clicks on the button/link toward WhatsApp.",
    "Klik tombol/tautan spesifik menuju WhatsApp.": "Clicks on the button/link toward WhatsApp.",
    "Seluruh interaksi sentuhan pada postingan iklan.": "All touch interactions on the ad post.",
    "Seluruh sentuhan interaksi pada postingan iklan.": "All touch interactions on the ad post.",
    "Persentase klik tautan dari total tayangan.": "Percentage of link clicks from total impressions.",
    "Persentase penonton yang menekan tautan.": "Percentage of viewers who clicked the link.",
    "Biaya per 1.000 penayangan iklan.": "Auction cost per 1,000 ad impressions.",
    "Biaya lelang per 1.000 tayangan iklan.": "Auction cost per 1,000 ad impressions.",
    "onsite_conversion.messaging_conversation_started_7d — terpisah dari lead.":
      "onsite_conversion.messaging_conversation_started_7d — separated from leads.",
    "lead / lead_grouped / fb_pixel_lead — terpisah dari percakapan messaging.":
      "lead / lead_grouped / fb_pixel_lead — separated from messaging conversations.",
  };
  const localizedValue = met.value
    .replace(/Tidak tersedia/g, "Not available")
    .replace(/Tidak dapat dihitung/g, "Cannot be computed")
    .replace(/(\d[\d.,]*) kali/g, "$1 times")
    .replace(/(\d[\d.,]*) orang/g, "$1 people")
    .replace(/(\d[\d.,]*) klik/g, "$1 clicks")
    .replace(/(\d[\d.,]*) interaksi/g, "$1 interactions");

  return {
    label: labelMap[met.label] || met.label,
    value: localizedValue,
    explanation: explanationMap[met.explanation] || met.explanation,
  };
}

export function AdDetailDrawer({
  ad,
  currency,
  lastSyncedAt,
  dateRange,
  onClose,
}: AdDetailDrawerProps) {
  const { formatNumber, locale, dict } = useI18n();
  const { addToast } = useToast();
  const copy = dict.adsWorkspace;
  const t = dict.adDrawer;
  const { quota, refresh: refreshQuota } = useAiQuota();

  const uiLocale: "id" | "en" = locale === "en" ? "en" : "id";
  const cacheKey = buildAiCacheKey(ad.id, dateRange, uiLocale);

  // Dialog & Focus management refs
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Server-verified ad detail
  const [serverDetail, setServerDetail] = useState<AdDetailResponseData | null>(
    null
  );
  const [isDetailLoading, setIsDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // AI Analysis state — strictly manual trigger, backed by session-level cache
  const [freshAiResult, setFreshAiResult] = useState<{
    key: string;
    data: AIAdAnalysisResponse;
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiErrorState, setAiErrorState] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [drawerTabState, setDrawerTabState] = useState<{
    id: string;
    tab: "metrics" | "ai";
  }>({ id: ad.id, tab: "metrics" });

  const drawerTab = drawerTabState.id === ad.id ? drawerTabState.tab : "metrics";
  const cachedAnalysis = aiAnalysisSessionCache.get(cacheKey) ?? null;
  const aiAnalysis =
    freshAiResult && freshAiResult.key === cacheKey
      ? freshAiResult.data
      : cachedAnalysis;
  const isLoadedFromCache =
    Boolean(cachedAnalysis) &&
    (!freshAiResult || freshAiResult.key !== cacheKey);
  const aiError =
    aiErrorState && aiErrorState.key === cacheKey ? aiErrorState.message : null;

  // Concurrency guard to strictly prevent double-requests
  const isAnalyzingRef = useRef(false);
  const idempotencyRef = useRef(new IdempotencyKeyManager());

  // Format helpers
  const formatMoney = (amount: number | null | undefined) =>
    formatDisplayCurrency(
      amount,
      currency || "IDR",
      locale === "en" ? "en" : "id"
    );
  const formatPercent = (value: number) =>
    `${new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}%`;

  // Body scroll lock, Escape shortcut, Focus trap, and Focus restoration
  useEffect(() => {
    const previousActiveElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move initial focus to the close button for keyboard accessibility
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [onClose]);

  // 1. Fetch server-verified ad detail from /api/ads/[id] (no AI call)
  useEffect(() => {
    let ignore = false;
    async function fetchDetail() {
      setIsDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(
          dateRange
            ? `/api/ads/${ad.id}?dateRange=${encodeURIComponent(dateRange)}`
            : `/api/ads/${ad.id}`
        );
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "LOAD_ERROR");
        }
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          setServerDetail(json.data);
        }
      } catch (err) {
        if (!ignore) {
          setDetailError(
            err instanceof Error ? err.message : "CONNECTION_ERROR"
          );
        }
      } finally {
        if (!ignore) {
          setIsDetailLoading(false);
        }
      }
    }
    void fetchDetail();
    return () => {
      ignore = true;
    };
  }, [ad.id, dateRange]);

  // 2. Trigger AI Ad Analysis — Strictly on manual user button click
  const runAiAnalysis = async () => {
    if (isAnalyzingRef.current || isAiLoading) return;
    if (quota?.remaining === 0) {
      setAiErrorState({
        key: cacheKey,
        message: t.aiQuotaExhaustedError,
      });
      return;
    }
    isAnalyzingRef.current = true;
    setIsAiLoading(true);
    setAiErrorState(null);

    try {
      const analysisContext = `analyze-ad:${ad.id}:${dateRange || "all"}:${uiLocale}`;
      const res = await fetch("/api/ai/analyze-ad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyRef.current.keyFor(analysisContext),
        },
        body: JSON.stringify({
          adId: ad.id,
          adName: serverDetail?.ad.name || ad.adName,
          campaignName: serverDetail?.campaign.name || ad.campaignName,
          campaignObjective:
            serverDetail?.campaign.objective || ad.campaignObjective,
          status: serverDetail?.delivery.deliveryStatus || ad.deliveryStatus,
          dateRange: dateRange || undefined,
          locale: uiLocale,
          metrics: {
            spend: serverDetail?.metrics.spend ?? ad.spend,
            impressions: serverDetail?.metrics.impressions ?? ad.impressions,
            reach: serverDetail?.metrics.reach ?? ad.reach,
            linkClicks:
              serverDetail?.metrics.linkClicks ?? ad.linkClicks ?? 0,
            allClicks: serverDetail?.metrics.allClicks ?? ad.allClicks,
            linkCtr: serverDetail?.metrics.linkCtr ?? ad.linkCtr,
            allCtr: serverDetail?.metrics.allCtr ?? ad.allCtr,
            linkCpc: serverDetail?.metrics.linkCpc ?? ad.linkCpc,
            allCpc: serverDetail?.metrics.allCpc ?? ad.allCpc,
            cpm: serverDetail?.metrics.cpm ?? ad.cpm,
            results: serverDetail?.metrics.results ?? ad.results ?? 0,
            resultType:
              serverDetail?.metrics.resultLabel || ad.resultLabel || "Hasil",
            resultsTrackingStatus: (
              serverDetail?.metrics.resultActionTypes ||
              ad.resultActionTypes ||
              []
            ).some((action) =>
              action.includes("messaging_conversation_started")
            )
              ? "TERVERIFIKASI ADA"
              : "BELUM TERVERIFIKASI",
            costPerResult:
              serverDetail?.metrics.costPerResult ?? ad.costPerResult,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error ||
            (uiLocale === "id"
              ? "Gagal menghubungi layanan AI"
              : "Failed to reach AI service")
        );
      }

      const json = await res.json();
      const analysisData: AIAdAnalysisResponse | undefined =
        json.data || json.analysis;

      if (json.success && analysisData && analysisData.executiveSummary) {
        idempotencyRef.current.complete(
          `analyze-ad:${ad.id}:${dateRange || "all"}:${uiLocale}`
        );
        aiAnalysisSessionCache.set(cacheKey, analysisData);
        setFreshAiResult({ key: cacheKey, data: analysisData });
        setAiErrorState(null);
        addToast(
          "success",
          t.aiToastSuccessTitle,
          t.aiToastSuccessBody.replace("{adName}", ad.adName)
        );
        void refreshQuota();
      } else {
        throw new Error(
          locale === "id"
            ? "Format respons analisis AI tidak valid. Silakan coba kembali."
            : "Invalid AI analysis response format. Please try again."
        );
      }
    } catch (err) {
      // Do not wipe previous valid analysis in session cache if re-analysis failed
      const errMessage = err instanceof Error ? err.message : t.aiErrorTitle;
      setAiErrorState({
        key: cacheKey,
        message: errMessage,
      });
      addToast("error", t.aiToastErrorTitle, errMessage);
    } finally {
      setIsAiLoading(false);
      isAnalyzingRef.current = false;
      void refreshQuota();
    }
  };

  // Effective status representations from server detail or fallback props
  const campaignStatus = serverDetail?.campaign.status || ad.campaignStatus;
  const adStatus = serverDetail?.ad.adSettingStatus || ad.adSettingStatus;
  const deliveryStatus =
    serverDetail?.delivery.deliveryStatus || ad.deliveryStatus;
  const identity = formatSmartAdIdentity(
    {
      adName: serverDetail?.ad.name || ad.adName,
      adSetName: ad.adsetName,
      campaignName: serverDetail?.campaign.name || ad.campaignName,
      providerAdId: serverDetail?.ad.providerAdId || ad.providerAdId,
      creativeFormat: ad.creativeFormat,
    },
    uiLocale
  );

  const metricSource = serverDetail?.metrics;
  const metricSpend = metricSource?.spend ?? ad.spend;
  const metricImpressions = metricSource?.impressions ?? ad.impressions;
  const rawLinkClicks: number | null =
    metricSource !== undefined
      ? metricSource.linkClicks
      : (ad.linkClicks ?? null);
  const metricLinkClicks = rawLinkClicks ?? 0;
  const metricAllClicks = metricSource?.allClicks ?? ad.allClicks;
  const metricCtr =
    metricSource?.linkCtr ??
    ad.linkCtr ??
    (metricImpressions > 0 ? (metricLinkClicks / metricImpressions) * 100 : 0);
  const metricAllCtr =
    metricSource?.allCtr ??
    ad.allCtr ??
    (metricImpressions > 0 ? (metricAllClicks / metricImpressions) * 100 : 0);
  const metricAllCpc =
    metricSource?.allCpc ??
    ad.allCpc ??
    (metricAllClicks > 0 ? metricSpend / metricAllClicks : 0);
  const metricCpm =
    metricSource?.cpm ??
    ad.cpm ??
    (metricImpressions > 0 ? (metricSpend / metricImpressions) * 1000 : 0);

  // Strictly separated CTWA Messaging Conversations vs Meta Leads (Section 5)
  const effectiveActionTypes =
    metricSource?.resultActionTypes ?? ad.resultActionTypes ?? [];
  const isExplicitMessagingResult =
    effectiveActionTypes.length > 0 &&
    effectiveActionTypes.every((act) =>
      act.includes("messaging_conversation_started")
    );

  const metaMessagingConversations: number | null =
    metricSource !== undefined
      ? metricSource.messagingConversations
      : isExplicitMessagingResult
        ? (ad.results ?? null)
        : null;

  const metaCostPerMessaging: number | null =
    metricSource !== undefined
      ? metricSource.costPerMessagingConversation
      : metaMessagingConversations !== null && metaMessagingConversations > 0
        ? metricSpend / metaMessagingConversations
        : null;

  const computedLinkCtr: number | null =
    metricImpressions > 0 && rawLinkClicks !== null
      ? (rawLinkClicks / metricImpressions) * 100
      : (metricSource?.linkCtr ?? ad.linkCtr ?? null);

  const computedLinkCpc: number | null =
    metricSource?.linkCpc ??
    ad.linkCpc ??
    (rawLinkClicks !== null && rawLinkClicks > 0
      ? metricSpend / rawLinkClicks
      : null);

  // Click-to-Messaging Rate: strictly only when linkClicks > 0 and messagingConversations !== null
  const clickToMessagingRate: number | null =
    rawLinkClicks !== null &&
    rawLinkClicks > 0 &&
    metaMessagingConversations !== null
      ? (metaMessagingConversations / rawLinkClicks) * 100
      : null;

  const impressionsToLinkDropoff: number | null =
    metricImpressions > 0 &&
    rawLinkClicks !== null &&
    rawLinkClicks <= metricImpressions
      ? ((metricImpressions - rawLinkClicks) / metricImpressions) * 100
      : null;

  const linkToMessagingDropoff: number | null =
    rawLinkClicks !== null &&
    rawLinkClicks > 0 &&
    metaMessagingConversations !== null &&
    metaMessagingConversations <= rawLinkClicks
      ? ((rawLinkClicks - metaMessagingConversations) / rawLinkClicks) * 100
      : null;

  const metricResult = resolveAdResultMetric(
    {
      spend: metricSpend,
      impressions: metricImpressions,
      conversions: metricSource?.results ?? ad.results,
      linkClicks: metricLinkClicks,
      clicks: metricAllClicks,
      objective: serverDetail?.campaign.objective || ad.campaignObjective,
    },
    uiLocale
  );
  const resultValue =
    metricSource?.resultMetricValue ??
    ad.resultMetricValue ??
    metricResult.value;
  const resultLabel = localizeResultLabel(
    metricSource?.resultMetricLabel ||
      ad.resultMetricLabel ||
      metricResult.label,
    uiLocale
  );
  const resultCost =
    metricSource?.resultMetricCostPerResult ??
    ad.resultMetricCostPerResult ??
    metricResult.costPerResult;
  const resultUnit = localizeResultUnitLabel(
    metricSource?.resultMetricUnitLabel ||
      ad.resultMetricUnitLabel ||
      metricResult.unitLabel,
    uiLocale
  );

  const statusBadgeText =
    deliveryStatus === "DELIVERING"
      ? t.statusActiveDelivering
      : campaignStatus === "PAUSED"
        ? t.statusInactiveCampaignPaused
        : adStatus === "PAUSED"
          ? t.statusInactiveAdPaused
          : campaignStatus === "ARCHIVED" || adStatus === "ARCHIVED"
            ? t.statusInactiveArchived
            : campaignStatus === "DELETED" || adStatus === "DELETED"
              ? t.statusInactiveDeleted
              : `${t.statusDeliveryPrefix} · ${translateMetaTerm(deliveryStatus, uiLocale)}`;

  const statusText =
    campaignStatus === "PAUSED"
      ? t.statusCampaignPaused
      : campaignStatus === "ARCHIVED"
        ? t.statusCampaignArchived
        : campaignStatus === "DELETED"
          ? t.statusCampaignDeleted
          : adStatus === "PAUSED"
            ? t.statusAdPaused
            : adStatus === "ARCHIVED"
              ? t.statusAdArchived
              : adStatus === "DELETED"
                ? t.statusAdDeleted
                : deliveryStatus === "DELIVERING"
                  ? t.statusActiveDelivering
                  : t.statusUnverified;

  const crmBlob = [
    aiAnalysis?.sourceDataStatus?.crmProspects,
    ...(aiAnalysis?.sourceDataStatus?.crmLines || []),
    aiAnalysis?.sourceDataStatus?.note,
  ].filter(Boolean).join(" ");
  const countIn = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = crmBlob.match(pattern);
      if (!match) continue;
      const value = Number(match[1].replace(/[.,]/g, ""));
      if (Number.isFinite(value)) return value;
    }
    return null;
  };
  const crmFailed = /gagal mengambil|failed to load crm/i.test(crmBlob);
  const adCardCopy = composeAdCardCopy({
    locale: uiLocale,
    paused: /paused|dijeda|archived|arsip/i.test(`${campaignStatus || ""} ${adStatus || ""}`),
    spend: metricSpend,
    conversations: metaMessagingConversations,
    costPerConversation: metaCostPerMessaging,
    linkCtr: computedLinkCtr,
    hasTarget: false,
    directProspects: crmFailed ? null : countIn([/Langsung (\d[\d.,]*)/, /Direct (\d[\d.,]*)/]),
    campaignOnly: crmFailed ? null : countIn([/Kampanye (\d[\d.,]*)/, /Campaign only: (\d[\d.,]*)/, /Hanya kampanye:? (\d[\d.,]*)/]),
    crmFailed,
  });

  const dateRangeLabel =
    formatMetaDateRange(
      metricSource?.dateRangeStart,
      metricSource?.dateRangeStop,
      uiLocale
    ) || t.dateRangeUnavailable;
  const providerAdId = serverDetail?.ad.providerAdId || ad.providerAdId;
  const campaignTitle = serverDetail?.campaign.name || ad.campaignName;
  const adSetTitle =
    ad.adsetName && ad.adsetName !== "Ad Set Meta" ? ad.adsetName : "";
  const campaignObjective = translateMetaTerm(
    serverDetail?.campaign.objective || ad.campaignObjective,
    uiLocale
  );

  // 4-Stage Mini Funnel computations for Tab 1 (Metrics)
  const numericResults = resultValue ?? 0;
  const funnelMax = Math.max(
    metricImpressions,
    metricAllClicks,
    metricLinkClicks,
    numericResults,
    1
  );
  const stage1Width = metricImpressions > 0 ? 100 : 0;
  const stage2Width =
    metricAllClicks > 0
      ? Math.max(8, Math.min(100, (metricAllClicks / funnelMax) * 100))
      : 0;
  const stage3Width =
    metricLinkClicks > 0
      ? Math.max(6, Math.min(100, (metricLinkClicks / funnelMax) * 100))
      : 0;
  const stage4Width =
    numericResults > 0
      ? Math.max(4, Math.min(100, (numericResults / funnelMax) * 100))
      : 0;

  const linkIntentRate =
    metricAllClicks > 0 ? (metricLinkClicks / metricAllClicks) * 100 : null;
  const resultConversionRate =
    metricLinkClicks > 0 && resultValue !== null
      ? (resultValue / metricLinkClicks) * 100
      : null;

  // 3-Stage CTWA Funnel bar widths for Tab 2 (AI & CTWA)
  const ctwaMax = Math.max(
    metricImpressions,
    rawLinkClicks ?? 0,
    metaMessagingConversations ?? 0,
    1
  );
  const ctwaBar1 = metricImpressions > 0 ? 100 : 0;
  const ctwaBar2 =
    rawLinkClicks !== null && rawLinkClicks > 0
      ? Math.max(8, Math.min(100, (rawLinkClicks / ctwaMax) * 100))
      : 0;
  const ctwaBar3 =
    metaMessagingConversations !== null && metaMessagingConversations > 0
      ? Math.max(6, Math.min(100, (metaMessagingConversations / ctwaMax) * 100))
      : 0;

  // Localized Core Metric resolver (Section 10: uses coreMetrics[].id & rawValue)
  const resolveLocalizedCoreMetric = (item: CoreMetricItem) => {
    switch (item.id) {
      case "spend":
        return {
          label: t.coreMetricSpendLabel,
          value:
            item.isValid && item.rawValue !== null
              ? formatMoney(item.rawValue)
              : t.coreMetricCannotCompute,
          note: t.coreMetricSpendNote,
          isValid: item.isValid && item.rawValue !== null,
        };
      case "linkClicks":
        return {
          label: t.coreMetricLinkClicksLabel,
          value:
            item.isValid && item.rawValue !== null
              ? `${formatNumber(item.rawValue)} ${t.coreMetricLinkClicksUnit}`
              : t.coreMetricNotAvailable,
          note: t.coreMetricLinkClicksNote,
          isValid: item.isValid && item.rawValue !== null,
        };
      case "linkCpc":
        return {
          label: t.coreMetricLinkCpcLabel,
          value:
            item.isValid && item.rawValue !== null
              ? `${formatMoney(item.rawValue)} ${t.coreMetricLinkCpcUnit}`
              : t.coreMetricCannotCompute,
          note: t.coreMetricLinkCpcNote,
          isValid: item.isValid && item.rawValue !== null,
        };
      case "metaConversations":
        return {
          label: t.coreMetricMetaConvLabel,
          value:
            item.isValid && item.rawValue !== null
              ? `${formatNumber(item.rawValue)} ${t.coreMetricMetaConvUnit}`
              : t.coreMetricNotAvailable,
          note: t.coreMetricMetaConvNote,
          isValid: item.isValid && item.rawValue !== null,
        };
      case "crmLeads":
        return {
          label: t.coreMetricCrmLeadsLabel,
          value:
            item.isValid && item.rawValue !== null
              ? `${formatNumber(item.rawValue)} ${t.coreMetricCrmLeadsUnit}`
              : t.coreMetricNotAvailable,
          note: t.coreMetricCrmLeadsNote,
          isValid: item.isValid && item.rawValue !== null,
        };
      case "costPerCrmLead":
        return {
          label: t.coreMetricCostPerCrmLabel,
          value:
            item.isValid && item.rawValue !== null
              ? `${formatMoney(item.rawValue)} ${t.coreMetricCostPerCrmUnit}`
              : t.coreMetricCannotCompute,
          note: t.coreMetricCostPerCrmNote,
          isValid: item.isValid && item.rawValue !== null,
        };
      default:
        return {
          label: item.label,
          value:
            item.isValid && item.rawValue !== null
              ? formatNumber(item.rawValue)
              : item.formattedValue,
          note: item.note || "",
          isValid: item.isValid,
        };
    }
  };

  const renderBudgetDecisionBadge = (decision: string) => {
    switch (decision) {
      case "NAIKKAN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t.aiDecisionIncrease}
          </span>
        );
      case "PERTAHANKAN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t.aiDecisionMaintain}
          </span>
        );
      case "TAHAN KENAIKAN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {t.aiDecisionHoldIncrease}
          </span>
        );
      case "KURANGI":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
            <ArrowDownRight className="h-3.5 w-3.5" />
            {t.aiDecisionReduce}
          </span>
        );
      case "HENTIKAN SEMENTARA":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <PauseCircle className="h-3.5 w-3.5" />
            {t.aiDecisionPause}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {decision}
          </span>
        );
    }
  };

  // Evaluate funnel bottleneck visibility (Section 9)
  const rawBottleneckStage =
    aiAnalysis?.additionalDetails?.funnelEvaluation?.firstFailingStage?.trim() ||
    null;
  const rawBottleneckExplanation =
    aiAnalysis?.additionalDetails?.funnelEvaluation?.explanation?.trim() ||
    null;
  const hasValidBottleneck = Boolean(
    rawBottleneckStage &&
      rawBottleneckStage !== "-" &&
      rawBottleneckStage !== "—"
  );

  const localizedActionText = translateRecommendedAction(
    aiAnalysis?.recommended_action,
    t
  );
  const confidenceMeta = translatePeriodConfidence(
    aiAnalysis?.context_awareness?.period_confidence,
    t
  );
  const entityStatusText = translateEntityStatus(
    aiAnalysis?.context_awareness?.entity_status,
    t
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sm:p-6 glass-overlay motion-safe:animate-in motion-safe:fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-detail-drawer-title"
        className="flex h-dvh w-full flex-col overflow-hidden bg-white shadow-[var(--shadow-pop)] sm:h-auto sm:max-h-[88vh] sm:w-[calc(100vw-48px)] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-zinc-200/90 dark:bg-zinc-950 dark:sm:border-zinc-800 motion-safe:animate-in motion-safe:zoom-in-95 duration-150"
      >
        {/* ====================================================================
            1. STICKY HEADER (Pinned at Top)
           ==================================================================== */}
        <header className="shrink-0 border-b border-zinc-200/80 bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-6 sm:py-4 dark:border-zinc-800/80 dark:bg-zinc-950/95">
          {/* Row 1: Ad Title + Close Button */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="ad-detail-drawer-title"
                  className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50"
                  title={identity.title}
                >
                  {identity.title}
                </h2>
              </div>

              {/* Row 2: Status Badge, Creative Format, Copy Ad ID, Server Sync, Campaign / Ad Set Metadata */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${
                    deliveryStatus === "DELIVERING"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      deliveryStatus === "DELIVERING"
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                  />
                  {statusBadgeText}
                </span>

                {identity.formatBadge && (
                  <span className="rounded-md border border-zinc-200/80 bg-zinc-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {identity.formatBadge}
                  </span>
                )}

                {providerAdId && (
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title={
                      lastSyncedAt
                        ? `${t.lastSyncedPrefix}: ${lastSyncedAt}`
                        : providerAdId
                    }
                    aria-label={`${t.metadataAdId}: ${providerAdId}`}
                    onClick={() => {
                      if (providerAdId && navigator.clipboard) {
                        void navigator.clipboard.writeText(providerAdId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                        addToast(
                          "success",
                          t.adIdCopiedToastTitle,
                          providerAdId
                        );
                      }
                    }}
                  >
                    {copiedId ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-sans font-semibold text-emerald-700 dark:text-emerald-300">
                          {t.copiedAdId}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 text-zinc-400" />
                        <span className="font-sans">{t.copyAdId}</span>
                      </>
                    )}
                  </button>
                )}

                {isDetailLoading && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    {t.verifyingServer}
                  </span>
                )}
              </div>

              {(campaignTitle || adSetTitle) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {campaignTitle && (
                    <span className="line-clamp-1" title={campaignTitle}>
                      <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                        {t.campaignPrefix}:
                      </strong>{" "}
                      {campaignTitle}
                    </span>
                  )}
                  {adSetTitle && (
                    <span className="line-clamp-1" title={adSetTitle}>
                      <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                        {t.adSetPrefix}:
                      </strong>{" "}
                      {adSetTitle}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label={t.closeDrawer}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* ====================================================================
            2. STICKY TAB NAVIGATION (Pinned Below Header)
           ==================================================================== */}
        <div className="shrink-0 border-b border-zinc-200/80 bg-zinc-50/90 px-4 py-2.5 sm:px-6 dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div
            className="flex max-w-md gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800/90"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={drawerTab === "metrics"}
              onClick={() => setDrawerTabState({ id: ad.id, tab: "metrics" })}
              className={`min-h-9 flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                drawerTab === "metrics"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {copy.metricsTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={drawerTab === "ai"}
              onClick={() => setDrawerTabState({ id: ad.id, tab: "ai" })}
              className={`inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                drawerTab === "ai"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>{copy.aiTab}</span>
              {aiAnalysis && (
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
              )}
            </button>
          </div>
        </div>

        {/* ====================================================================
            3. SCROLLABLE CONTENT BODY (Only This Area Scrolls Vertically)
           ==================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {detailError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <strong className="font-semibold">{t.syncFallbackPrefix}:</strong>{" "}
              {detailError === "LOAD_ERROR"
                ? t.detailLoadError
                : detailError === "CONNECTION_ERROR"
                ? t.detailConnectionError
                : detailError}
              . {t.syncFallbackSuffix}
            </div>
          )}

          {drawerTab === "metrics" && (
            <>
              {/* 1. Delivery Status & Active Period */}
              <section className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                      {t.statusSectionTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>
                        {t.statusEffectiveLabel}:{" "}
                        <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {statusText}
                        </strong>
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span>
                        {t.campaignStatusLabel}:{" "}
                        <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                          {translateMetaTerm(campaignStatus, uiLocale)}
                        </strong>
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span>
                        {t.adStatusLabel}:{" "}
                        <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                          {translateMetaTerm(adStatus, uiLocale)}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {t.activePeriodLabel}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                      {dateRangeLabel}
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. Primary KPIs (4 Core Cards) */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {t.kpiSectionTitle}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {t.kpiSectionSubtitle}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <MetricCard
                    label={t.kpiTotalSpend}
                    value={formatMoney(metricSpend)}
                    detail={t.kpiTotalSpendDetail}
                    highlight="slate"
                  />
                  <MetricCard
                    label={t.kpiResults}
                    value={
                      resultValue === null
                        ? t.kpiNoData
                        : formatNumber(resultValue)
                    }
                    detail={resultLabel}
                    highlight="indigo"
                  />
                  <MetricCard
                    label={t.kpiCostPerResult}
                    value={
                      resultCost === null
                        ? t.kpiNoData
                        : formatMoney(resultCost)
                    }
                    detail={
                      resultCost === null
                        ? t.kpiNoMeasuredResult
                        : `${t.kpiPerUnitPrefix} ${resultUnit}`
                    }
                    highlight="slate"
                  />
                  <MetricCard
                    label={t.kpiLinkCtr}
                    value={formatPercent(metricCtr)}
                    detail={t.kpiLinkCtrDetail}
                    highlight={metricCtr >= 1 ? "green" : "amber"}
                  />
                </dl>
              </section>

              {/* 3. Balanced Two-Column Desktop Split: 4-Stage Mini Funnel + Secondary Efficiency Metrics */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Left Column: 4-Stage Mini Funnel Visualizer */}
                <section className="space-y-4 rounded-xl border border-zinc-200/80 bg-white p-4 lg:col-span-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-800 dark:text-zinc-100">
                      {t.funnelTitle}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t.funnelSubtitle}
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {/* Stage 1: Impressions */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            1. {t.funnelStage1}
                          </span>
                          <span className="ml-2 text-[11px] text-zinc-400">
                            {t.funnelStage1Sub}
                          </span>
                        </div>
                        <span className="font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatNumber(metricImpressions)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-zinc-500 transition-all dark:bg-zinc-400"
                          style={{ width: `${stage1Width}%` }}
                        />
                      </div>
                    </div>

                    {/* Stage 2: Content Interactions (All Clicks) */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            2. {t.funnelStage2}
                          </span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {t.funnelRateFromImpressions}:{" "}
                            {formatPercent(metricAllCtr)}
                          </span>
                        </div>
                        <span className="font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatNumber(metricAllClicks)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${stage2Width}%` }}
                        />
                      </div>
                    </div>

                    {/* Stage 3: Link / WA Clicks */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            3. {t.funnelStage3}
                          </span>
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {t.funnelRateFromClicks}:{" "}
                            {linkIntentRate !== null
                              ? formatPercent(linkIntentRate)
                              : "—"}
                          </span>
                        </div>
                        <span className="font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatNumber(metricLinkClicks)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${stage3Width}%` }}
                        />
                      </div>
                    </div>

                    {/* Stage 4: Conversion Results */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            4. {t.funnelStage4} ({resultLabel})
                          </span>
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {t.funnelRateFromLinkClicks}:{" "}
                            {resultConversionRate !== null
                              ? formatPercent(resultConversionRate)
                              : "—"}
                          </span>
                        </div>
                        <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {resultValue === null
                            ? t.kpiNoData
                            : formatNumber(resultValue)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${stage4Width}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Right Column: Secondary Efficiency Metrics */}
                <section className="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-4 lg:col-span-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-800 dark:text-zinc-100">
                      {t.secondaryTitle}
                    </h4>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                    <MetricCard
                      label={t.metricImpressions}
                      value={formatNumber(metricImpressions)}
                      detail={t.metricImpressionsDetail}
                    />
                    <MetricCard
                      label={t.metricCpm}
                      value={formatMoney(metricCpm)}
                      detail={t.metricCpmDetail}
                    />
                    <MetricCard
                      label={t.metricAllClicks}
                      value={formatNumber(metricAllClicks)}
                      detail={t.metricAllClicksDetail}
                    />
                    <MetricCard
                      label={t.metricAllCtr}
                      value={formatPercent(metricAllCtr)}
                      detail={t.metricAllCtrDetail}
                    />
                    <MetricCard
                      label={t.metricAllCpc}
                      value={formatMoney(metricAllCpc)}
                      detail={t.metricAllCpcDetail}
                    />
                    <MetricCard
                      label={t.metricLinkIntent}
                      value={formatPercent(
                        metricAllClicks > 0
                          ? (metricLinkClicks / metricAllClicks) * 100
                          : 0
                      )}
                      detail={t.metricLinkIntentDetail
                        .replace("{linkClicks}", formatNumber(metricLinkClicks))
                        .replace("{allClicks}", formatNumber(metricAllClicks))}
                    />
                  </dl>
                </section>
              </div>

              {/* 5. Delivery Identity & Technical Metadata */}
              <section className="space-y-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.metadataTitle}
                </h4>
                <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div className="min-w-0">
                    <dt className="text-[10px] text-zinc-400">
                      {t.metadataAdId}
                    </dt>
                    <dd
                      className="mt-0.5 truncate font-mono font-medium text-zinc-800 dark:text-zinc-200"
                      title={providerAdId}
                    >
                      {providerAdId || "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] text-zinc-400">
                      {t.metadataObjective}
                    </dt>
                    <dd
                      className="mt-0.5 truncate font-medium text-zinc-800 dark:text-zinc-200"
                      title={campaignObjective}
                    >
                      {campaignObjective || "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] text-zinc-400">
                      {t.metadataCreativeFormat}
                    </dt>
                    <dd className="mt-0.5 truncate font-medium text-zinc-800 dark:text-zinc-200">
                      {identity.formatBadge || "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] text-zinc-400">
                      {t.metadataSyncSource}
                    </dt>
                    <dd className="mt-0.5 truncate font-medium text-zinc-800 dark:text-zinc-200">
                      {serverDetail
                        ? t.metadataServerVerified
                        : t.metadataCachedSummary}
                    </dd>
                  </div>
                </dl>
              </section>
            </>
          )}

          {drawerTab === "ai" && (
            <>
              {/* ================================================================
                  A. AI COMMAND & QUOTA BAR (Top-Level Section)
                 ================================================================ */}
              <section className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{t.aiSectionTitle}</span>
                      </h3>

                      {/* Status Pill */}
                      {isAiLoading ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                          {t.aiStatusLoading}
                        </span>
                      ) : aiError && !aiAnalysis ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          <AlertCircle className="h-2.5 w-2.5" />
                          {t.aiStatusError}
                        </span>
                      ) : aiAnalysis ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {t.aiStatusAvailable}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {t.aiStatusIdle}
                        </span>
                      )}

                      {/* Quota Badge */}
                      {quota && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            quota.remaining === 0
                              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
                          }`}
                        >
                          {t.aiQuotaBadge
                            .replace("{remaining}", String(quota.remaining))
                            .replace("{limit}", String(quota.limit))}
                        </span>
                      )}

                      {/* Cached in Session Badge */}
                      {aiAnalysis && isLoadedFromCache && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {t.aiCachedBadge}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {t.aiSectionSubtitle}
                    </p>

                    {/* Engine & Timestamp metadata when analysis is available */}
                    {aiAnalysis && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                          <Activity className="h-3 w-3 text-indigo-500" />
                          {aiAnalysis.isLiveAi
                            ? t.aiEngineLive
                            : t.aiEngineRule}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">
                          •
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-zinc-400" />
                          {t.aiAnalyzedAtPrefix}:{" "}
                          {new Date(aiAnalysis.analyzedAt).toLocaleString(
                            locale === "id" ? "id-ID" : "en-US",
                            { dateStyle: "medium", timeStyle: "short" }
                          )}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">
                          •
                        </span>
                        <span className="font-mono text-[10px]">
                          {t.aiModelPrefix}: {aiAnalysis.model}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Single Primary CTA Button (Mulai Analisis AI Sekarang / Analisis Ulang) */}
                  <button
                    type="button"
                    onClick={runAiAnalysis}
                    disabled={isAiLoading || quota?.remaining === 0}
                    className="btn-solar inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isAiLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{t.aiAnalyzingButton}</span>
                      </>
                    ) : aiError && !aiAnalysis ? (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        <span>{t.aiRetryButton}</span>
                      </>
                    ) : aiAnalysis ? (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        <span>{t.aiRerunButton}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>{t.aiStartAnalysisButton}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Explicit Quota Exhausted Inline Banner (Accessible on Mobile & Desktop) */}
                {quota?.remaining === 0 && (
                  <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-0.5">
                      <p className="font-semibold">
                        {t.aiQuotaExhaustedBannerTitle}
                      </p>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                        {t.aiQuotaExhaustedBannerDesc}
                        {quota.resetAt && (
                          <>
                            {" "}
                            <strong className="font-semibold">
                              ({t.aiQuotaResetAtPrefix}:{" "}
                              {new Date(quota.resetAt).toLocaleString(
                                locale === "id" ? "id-ID" : "en-US",
                                { dateStyle: "medium", timeStyle: "short" }
                              )}
                              )
                            </strong>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* ================================================================
                  B. CTWA CONVERSION & ATTRIBUTION SNAPSHOT (P0 — Always Visible)
                 ================================================================ */}
              <section className="space-y-4 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
                {/* Header & Period Metadata */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{t.ctwaSnapshotTitle}</span>
                      </h3>
                      <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {t.ctwaSourceMetaBadge}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t.ctwaSnapshotSubtitle}
                    </p>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <span className="inline-block rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-200">
                      {dateRangeLabel}
                    </span>
                  </div>
                </div>

                {/* Part A: 4 Actual Meta Delivery & CTWA Metric Cards */}
                <dl className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <MetricCard
                    label={t.ctwaImpressionsLabel}
                    value={formatNumber(metricImpressions)}
                    detail={t.ctwaImpressionsSub}
                    highlight="slate"
                  />
                  <MetricCard
                    label={t.ctwaLinkClicksLabel}
                    value={
                      rawLinkClicks !== null ? formatNumber(rawLinkClicks) : "—"
                    }
                    detail={
                      computedLinkCtr !== null
                        ? `${t.ctwaLinkCtrBadge}: ${formatPercent(computedLinkCtr)}`
                        : t.ctwaLinkClicksSub
                    }
                    highlight="indigo"
                  />
                  <MetricCard
                    label={t.ctwaLinkCpcLabel}
                    value={
                      computedLinkCpc !== null
                        ? formatMoney(computedLinkCpc)
                        : "—"
                    }
                    detail={t.ctwaLinkCpcSub}
                    highlight="slate"
                  />
                  <MetricCard
                    label={t.ctwaMessagingLabel}
                    value={
                      metaMessagingConversations !== null
                        ? formatNumber(metaMessagingConversations)
                        : "—"
                    }
                    detail={
                      metaCostPerMessaging !== null
                        ? `${t.ctwaCostPerMessagingLabel}: ${formatMoney(metaCostPerMessaging)}`
                        : metaMessagingConversations === null
                          ? t.ctwaMetricUnavailable
                          : t.ctwaZeroConversations
                    }
                    highlight={
                      metaMessagingConversations !== null &&
                      metaMessagingConversations > 0
                        ? "green"
                        : "slate"
                    }
                  />
                </dl>

                {/* Part B: 3-Stage CTWA Funnel (Horizontal on Desktop/Tablet, Vertical on Mobile) */}
                <div className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      {t.ctwaFunnelFlowTitle}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
                    {/* Stage 1: Impressions */}
                    <div className="space-y-2 rounded-xl border border-zinc-200/70 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {t.ctwaStep1Label}
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatNumber(metricImpressions)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-zinc-600 transition-all dark:bg-zinc-400"
                          style={{ width: `${ctwaBar1}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {t.ctwaImpressionsSub}
                      </p>
                    </div>

                    {/* Stage 2: Link Clicks */}
                    <div className="space-y-2 rounded-xl border border-zinc-200/70 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {t.ctwaStep2Label}
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {rawLinkClicks !== null
                            ? formatNumber(rawLinkClicks)
                            : "—"}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${ctwaBar2}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-indigo-200/80 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {t.ctwaLinkCtrBadge}:{" "}
                          {computedLinkCtr !== null
                            ? formatPercent(computedLinkCtr)
                            : "—"}
                        </span>
                        {impressionsToLinkDropoff !== null && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {t.ctwaDropoffBadge}:{" "}
                            {formatPercent(impressionsToLinkDropoff)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stage 3: Messaging Conversations */}
                    <div className="space-y-2 rounded-xl border border-zinc-200/70 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {t.ctwaStep3Label}
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {metaMessagingConversations !== null
                            ? formatNumber(metaMessagingConversations)
                            : "—"}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${ctwaBar3}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {t.ctwaClickToChatBadge}:{" "}
                          {clickToMessagingRate !== null
                            ? formatPercent(clickToMessagingRate)
                            : "—"}
                        </span>
                        {linkToMessagingDropoff !== null && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {t.ctwaDropoffBadge}:{" "}
                            {formatPercent(linkToMessagingDropoff)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {clickToMessagingRate === null && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {t.ctwaRateUnavailableNote}
                    </p>
                  )}
                </div>

                {/* Percakapan Meta dan catatan tindak lanjut CTWA */}
                <div className="space-y-2.5 pt-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    {t.ctwaAttributionSectionTitle}
                  </h4>
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {/* Panel 1: Meta Platform Results */}
                    <div className="space-y-2 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {t.ctwaMetaPlatformResultsTitle}
                        </span>
                        <span className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {t.ctwaSourceMetaBadge}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="rounded-lg border border-zinc-200/60 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                          <span className="block text-[10px] text-zinc-400">
                            {t.ctwaMessagingLabel}
                          </span>
                          <span className="mt-0.5 block font-mono text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {metaMessagingConversations !== null
                              ? formatNumber(metaMessagingConversations)
                              : "—"}
                          </span>
                        </div>
                        <div className="rounded-lg border border-zinc-200/60 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                          <span className="block text-[10px] text-zinc-400">
                            {t.ctwaCostPerMessagingLabel}
                          </span>
                          <span className="mt-0.5 block font-mono text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {metaCostPerMessaging !== null
                              ? formatMoney(metaCostPerMessaging)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Panel 2: CRM Recorded Prospects */}
                    <div className="space-y-2 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {t.ctwaCrmRecordedProspectsTitle}
                        </span>
                        <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {t.ctwaSourceCrmBadge}
                        </span>
                      </div>

                      {aiAnalysis?.sourceDataStatus ? (
                        <div className="space-y-1.5 pt-0.5">
                          <p className="font-mono text-xs font-bold leading-snug text-zinc-900 dark:text-zinc-100">
                            {localizeCrmText(
                              aiAnalysis.sourceDataStatus.crmProspects,
                              uiLocale
                            ) || "—"}
                          </p>
                          {aiAnalysis.sourceDataStatus.crmLines &&
                            aiAnalysis.sourceDataStatus.crmLines.length > 1 && (
                              <ul className="space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                                {aiAnalysis.sourceDataStatus.crmLines.map(
                                  (line) => (
                                    <li key={line}>
                                      {localizeCrmText(line, uiLocale)}
                                    </li>
                                  )
                                )}
                              </ul>
                            )}
                          {aiAnalysis.sourceDataStatus.note && (
                            <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                              {localizeCrmText(
                                aiAnalysis.sourceDataStatus.note,
                                uiLocale
                              )}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-zinc-300/80 bg-white/80 p-2.5 dark:border-zinc-700 dark:bg-zinc-900/80">
                          <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                            {t.ctwaCrmPendingTitle}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                            {t.ctwaCrmPendingDesc}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* ================================================================
                  LOADING & ERROR STATES (Section 7)
                 ================================================================ */}
              {isAiLoading && (
                <section className="space-y-2.5 rounded-xl border border-indigo-200/80 bg-white p-6 text-center shadow-xs dark:border-indigo-900/60 dark:bg-zinc-900">
                  <div className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {t.aiLoadingTitle}
                  </p>
                  <p className="mx-auto max-w-md text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {t.aiLoadingSubtitle}
                  </p>
                </section>
              )}

              {aiError && (
                <section className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="block font-bold">{t.aiErrorTitle}</span>
                      <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
                        {aiError}
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={runAiAnalysis}
                      disabled={isAiLoading || quota?.remaining === 0}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{t.aiRetryButton}</span>
                    </button>
                  </div>
                </section>
              )}

              {/* ================================================================
                  C. AI DIAGNOSTIC READINESS — EMPTY STATE (Section 6)
                 ================================================================ */}
              {!aiAnalysis && !isAiLoading && (
                <section className="space-y-4 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      <Database className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{t.readinessTitle}</span>
                    </h3>
                    <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t.readinessSubtitle}
                    </p>
                  </div>

                  {/* Part A: Actual Data Snapshot */}
                  <div className="space-y-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t.readinessSnapshotTitle}
                    </span>
                    <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                      <div className="min-w-0">
                        <dt className="text-[10px] text-zinc-400">
                          {t.readinessColPeriod}
                        </dt>
                        <dd className="mt-0.5 truncate font-semibold text-zinc-800 dark:text-zinc-200">
                          {dateRangeLabel}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] text-zinc-400">
                          {t.readinessColStatus}
                        </dt>
                        <dd className="mt-0.5 truncate font-semibold text-zinc-800 dark:text-zinc-200">
                          {statusText}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] text-zinc-400">
                          {t.readinessColSpend}
                        </dt>
                        <dd className="mt-0.5 truncate font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatMoney(metricSpend)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] text-zinc-400">
                          {t.readinessColImpressions}
                        </dt>
                        <dd className="mt-0.5 truncate font-mono font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                          {formatNumber(metricImpressions)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] text-zinc-400">
                          {t.readinessColLinkClicks}
                        </dt>
                        <dd className="mt-0.5 truncate font-mono font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                          {rawLinkClicks !== null
                            ? formatNumber(rawLinkClicks)
                            : "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] text-zinc-400">
                          {t.readinessColObjective}
                        </dt>
                        <dd
                          className="mt-0.5 truncate font-medium text-zinc-800 dark:text-zinc-200"
                          title={campaignObjective}
                        >
                          {campaignObjective || "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Part B: Four Evaluation Pillars */}
                  <div className="space-y-2.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t.readinessPillarsTitle}
                    </span>
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                      {/* Pillar 01 */}
                      <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{t.readinessPillar1Title}</span>
                          </span>
                          <span className="font-mono text-[10px] font-bold text-zinc-400">
                            01
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {t.readinessPillar1Desc}
                        </p>
                      </div>

                      {/* Pillar 02 */}
                      <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{t.readinessPillar2Title}</span>
                          </span>
                          <span className="font-mono text-[10px] font-bold text-zinc-400">
                            02
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {t.readinessPillar2Desc}
                        </p>
                      </div>

                      {/* Pillar 03 */}
                      <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            <Wallet className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{t.readinessPillar3Title}</span>
                          </span>
                          <span className="font-mono text-[10px] font-bold text-zinc-400">
                            03
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {t.readinessPillar3Desc}
                        </p>
                      </div>

                      {/* Pillar 04 */}
                      <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{t.readinessPillar4Title}</span>
                          </span>
                          <span className="font-mono text-[10px] font-bold text-zinc-400">
                            04
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {t.readinessPillar4Desc}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ================================================================
                  D. AI INTELLIGENCE REPORT (When AI Analysis is Available)
                 ================================================================ */}
              {aiAnalysis && !isAiLoading && (
                <div className="space-y-5 text-xs">
                  {/* 1. EXECUTIVE VERDICT & BUDGET DECISION CARD (Section 8) */}
                  <section className="space-y-3.5 rounded-xl border border-indigo-200/90 bg-white p-4 shadow-xs sm:p-5 dark:border-indigo-900/70 dark:bg-zinc-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        {t.verdictCardTitle}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {localizedActionText && (
                          <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {t.verdictActionLabel}: {localizedActionText}
                          </span>
                        )}
                        {renderBudgetDecisionBadge(
                          aiAnalysis.budgetDecision?.decision ||
                            aiAnalysis.actionDecision?.priorityLabel ||
                            "TAHAN KENAIKAN"
                        )}
                      </div>
                    </div>

                    {/* Context Confidence Bar */}
                    {aiAnalysis.context_awareness && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-800/50">
                        {confidenceMeta && (
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${confidenceMeta.toneClass}`}
                          >
                            {t.verdictConfidenceLabel}: {confidenceMeta.label}
                          </span>
                        )}
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {t.verdictObservationLabel}:{" "}
                          <strong className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {aiAnalysis.context_awareness.period_days}{" "}
                            {t.verdictDaysUnit}
                          </strong>
                        </span>
                        {entityStatusText && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">
                              •
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-300">
                              {t.verdictEntityStatusLabel}:{" "}
                              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {entityStatusText}
                              </strong>
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Primary Budget Decision Justification & Executive Summary */}
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3.5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                          {t.aiBudgetDecisionTitle}
                        </span>
                        <p className="text-xs font-semibold leading-relaxed text-zinc-900 dark:text-zinc-100">
                          {adCardCopy.reason}
                        </p>
                      </div>

                      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          {t.aiPerformanceSummaryTitle}
                        </span>
                        <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {adCardCopy.summary}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* 2. FUNNEL BOTTLENECK DIAGNOSIS CARD (Section 9) */}
                  {hasValidBottleneck && (
                    <section className="space-y-2.5 rounded-xl border border-amber-200/90 bg-amber-50/40 p-4 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span>{t.bottleneckCardTitle}</span>
                        </h4>
                        <span className="rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {t.bottleneckAiBadge}
                        </span>
                      </div>
                      <div className="rounded-lg border border-amber-200/80 bg-white p-3 dark:border-amber-900/50 dark:bg-zinc-900">
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {t.bottleneckStageLabel}:{" "}
                          <span className="text-amber-800 dark:text-amber-300">
                            {rawBottleneckStage}
                          </span>
                        </div>
                        {rawBottleneckExplanation && (
                          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                            {rawBottleneckExplanation}
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                  {/* 3. LOCALIZED CORE METRICS GRID (Section 10) */}
                  {aiAnalysis.coreMetrics &&
                    aiAnalysis.coreMetrics.length > 0 && (
                      <section className="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                          {t.aiCoreMetricsTitle}
                        </h4>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {aiAnalysis.coreMetrics.slice(0, 6).map((m) => {
                            const localized = resolveLocalizedCoreMetric(m);
                            return (
                              <div
                                key={m.id}
                                className="space-y-1 rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40"
                              >
                                <span
                                  className="block truncate text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
                                  title={localized.label}
                                >
                                  {localized.label}
                                </span>
                                <span
                                  className={`block truncate font-mono text-xs font-bold tabular-nums ${
                                    localized.isValid
                                      ? "text-zinc-900 dark:text-zinc-100"
                                      : "text-zinc-400 dark:text-zinc-500"
                                  }`}
                                  title={localized.value}
                                >
                                  {localized.value}
                                </span>
                                {localized.note && (
                                  <span className="block text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                                    {localized.note}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                  {/* 4 & 5. BALANCED TWO-COLUMN DESKTOP LAYOUT: KEY FINDINGS & PRIORITY ACTIONS */}
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Key Findings (Max 3, Fact vs Hypothesis) */}
                    {aiAnalysis.keyFindings &&
                      aiAnalysis.keyFindings.length > 0 && (
                        <section className="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                              {t.aiKeyFindingsTitle}
                            </h4>
                            <span className="text-[10px] text-zinc-400">
                              {t.aiKeyFindingsLimit}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {aiAnalysis.keyFindings
                              .slice(0, 3)
                              .map((f, idx) => (
                                <div
                                  key={idx}
                                  className="space-y-2 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-bold leading-snug text-zinc-900 dark:text-zinc-100">
                                      {f.finding}
                                    </span>
                                    {f.isHypothesis ? (
                                      <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                        {t.aiHypothesisBadge}
                                      </span>
                                    ) : (
                                      <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                        {t.aiFactBadge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-2 pt-0.5 text-[11px]">
                                    <div className="rounded-lg border border-zinc-200/60 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                                      <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                                        {t.aiEvidenceLabel}
                                      </span>
                                      <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                                        {f.evidence}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-zinc-200/60 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                                      <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                                        {t.aiImpactLabel}
                                      </span>
                                      <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                                        {f.impact}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </section>
                      )}

                    {/* Priority Actions (Max 3, Ordered by Urgency) */}
                    {aiAnalysis.priorityActions &&
                      aiAnalysis.priorityActions.length > 0 && (
                        <section className="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                              {t.aiPriorityActionsTitle}
                            </h4>
                            <span className="text-[10px] text-zinc-400">
                              {t.aiPriorityActionsSub}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {aiAnalysis.priorityActions
                              .slice(0, 3)
                              .map((act, idx) => (
                                <div
                                  key={idx}
                                  className="space-y-2 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-800/40"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-600 font-mono text-[10px] font-bold text-white">
                                      #{idx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                      {act.action}
                                    </span>
                                  </div>
                                  <div className="space-y-2 pt-0.5">
                                    <div className="rounded-lg border border-zinc-200/60 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                                      <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                                        {t.aiHowToCheckLabel}
                                      </span>
                                      <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                                        {act.howToCheck}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                                      <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                        {t.aiExpectedResultLabel}
                                      </span>
                                      <p className="mt-0.5 font-medium text-emerald-900 dark:text-emerald-200">
                                        {act.expectedResult}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </section>
                      )}
                  </div>

                  {/* 6. CREATIVE DIAGNOSTICS (Section 12) */}
                  {aiAnalysis.additionalDetails?.creativeNotes && (
                    <section className="space-y-2 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{t.aiCreativeNotesTitle}</span>
                      </h4>
                      <p className="rounded-lg border border-zinc-200/70 bg-zinc-50/60 p-3 text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
                        {aiAnalysis.additionalDetails.creativeNotes}
                      </p>
                    </section>
                  )}

                  {/* ================================================================
                      E. COLLAPSIBLE ADDITIONAL DETAILS & ACCESSIBILITY (Section 13)
                     ================================================================ */}
                  {aiAnalysis.additionalDetails && (
                    <section className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                      <button
                        id="ad-drawer-ai-additional-trigger"
                        type="button"
                        aria-expanded={showAdditionalDetails}
                        aria-controls="ad-drawer-ai-additional-details"
                        onClick={() =>
                          setShowAdditionalDetails(!showAdditionalDetails)
                        }
                        className="flex min-h-11 w-full cursor-pointer items-center justify-between p-4 text-xs font-bold text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-zinc-100 dark:hover:bg-zinc-800/50"
                      >
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-zinc-500" />
                          <span>{t.aiAdditionalDetailsTitle}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-normal text-zinc-500">
                          <span>
                            {showAdditionalDetails
                              ? t.aiHideDetails
                              : t.aiOpenDetails}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transform transition-transform ${
                              showAdditionalDetails ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {showAdditionalDetails && (
                        <div
                          id="ad-drawer-ai-additional-details"
                          role="region"
                          aria-labelledby="ad-drawer-ai-additional-trigger"
                          className="space-y-4 border-t border-zinc-100 bg-zinc-50/30 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-950/20"
                        >
                          {/* Facts, Hypotheses & Unknowns */}
                          <div className="space-y-2">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              {t.aiFactsHypothesesTitle}
                            </span>
                            <div className="space-y-2 rounded-lg border border-zinc-200/80 bg-white p-3 text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
                              {aiAnalysis.additionalDetails.facts?.length >
                                0 && (
                                <div>
                                  <strong className="block text-[10px] uppercase text-emerald-700 dark:text-emerald-400">
                                    {t.aiFactsLabel}:
                                  </strong>
                                  <ul className="list-disc space-y-0.5 pl-4 text-zinc-600 dark:text-zinc-400">
                                    {aiAnalysis.additionalDetails.facts.map(
                                      (fact, i) => (
                                        <li key={i}>{fact}</li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                              {aiAnalysis.additionalDetails.hypotheses?.length >
                                0 && (
                                <div className="border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
                                  <strong className="block text-[10px] uppercase text-blue-700 dark:text-blue-400">
                                    {t.aiHypothesesLabel}:
                                  </strong>
                                  <ul className="list-disc space-y-0.5 pl-4 text-zinc-600 dark:text-zinc-400">
                                    {aiAnalysis.additionalDetails.hypotheses.map(
                                      (hyp, i) => (
                                        <li key={i}>{hyp}</li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                              {aiAnalysis.additionalDetails.unknowns?.length >
                                0 && (
                                <div className="border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
                                  <strong className="block text-[10px] uppercase text-amber-700 dark:text-amber-400">
                                    {t.aiUnknownsLabel}:
                                  </strong>
                                  <ul className="list-disc space-y-0.5 pl-4 text-zinc-600 dark:text-zinc-400">
                                    {aiAnalysis.additionalDetails.unknowns.map(
                                      (unk, i) => (
                                        <li key={i}>{unk}</li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* All Metrics Breakdown: Mobile stacked cards + Desktop table */}
                          {aiAnalysis.additionalDetails.allMetrics?.length >
                            0 && (
                            <div className="space-y-1.5">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                {t.aiAllMetricsTitle}
                              </span>

                              {/* Mobile stacked key-value list */}
                              <div className="space-y-2 sm:hidden">
                                {aiAnalysis.additionalDetails.allMetrics.map(
                                  (rawMet, i) => {
                                    const met = localizeAllMetricRow(
                                      rawMet,
                                      uiLocale
                                    );
                                    return (
                                      <div
                                        key={i}
                                        className="rounded-lg border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                                      >
                                        <div className="flex items-baseline justify-between gap-2">
                                          <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                                            {met.label}
                                          </span>
                                          <span className="font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                            {met.value}
                                          </span>
                                        </div>
                                        {met.explanation && (
                                          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                                            {met.explanation}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                )}
                              </div>

                              {/* Desktop table */}
                              <div className="hidden overflow-x-auto rounded-lg border border-zinc-200/80 bg-white sm:block dark:border-zinc-800 dark:bg-zinc-900">
                                <table className="w-full text-left text-[11px]">
                                  <thead className="border-b border-zinc-100 bg-zinc-50/50 text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/30">
                                    <tr>
                                      <th className="px-3 py-2 font-semibold">
                                        {t.aiColMetric}
                                      </th>
                                      <th className="px-3 py-2 font-semibold">
                                        {t.aiColValue}
                                      </th>
                                      <th className="px-3 py-2 font-semibold">
                                        {t.aiColExplanation}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100 text-zinc-700 dark:divide-zinc-800 dark:text-zinc-300">
                                    {aiAnalysis.additionalDetails.allMetrics.map(
                                      (rawMet, i) => {
                                        const met = localizeAllMetricRow(
                                          rawMet,
                                          uiLocale
                                        );
                                        return (
                                          <tr
                                            key={i}
                                            className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                                          >
                                            <td className="px-3 py-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                                              {met.label}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono">
                                              {met.value}
                                            </td>
                                            <td className="px-3 py-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                                              {met.explanation}
                                            </td>
                                          </tr>
                                        );
                                      }
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}

              {/* Safety footnote (no decorative symbols) */}
              <div className="flex items-start gap-2 rounded-lg border border-zinc-200/60 bg-zinc-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:text-zinc-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span>{t.aiDisclaimer}</span>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
