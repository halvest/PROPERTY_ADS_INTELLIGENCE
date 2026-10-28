"use client";

import React from "react";
import type { AttributionStatus } from "@/domain/attribution/types";
import type { FunnelStage } from "@/domain/funnel/stages";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function DemoBadge({ className = "" }: { className?: string }) {
  const { dict } = useI18n();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/30 ${className}`}
      title={dict.common.demoBadgeTooltip}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      <span>{dict.common.demoMode}</span>
    </span>
  );
}

export function AttributionBadge({ status }: { status: AttributionStatus }) {
  const { dict } = useI18n();

  switch (status) {
    case "verified":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30"
          title={dict.attribution.verifiedTooltip}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
          <span>{dict.attribution.verified}</span>
        </span>
      );
    case "inferred":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30"
          title={dict.attribution.inferredTooltip}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
          <span>{dict.attribution.inferred}</span>
        </span>
      );
    case "unknown":
    default:
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"
          title={dict.attribution.unknownTooltip}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          <span>{dict.attribution.unknown}</span>
        </span>
      );
  }
}

export function FunnelBadge({ stage }: { stage: FunnelStage }) {
  const { dict } = useI18n();

  const stageConfig: Record<FunnelStage, { label: string; colorClass: string }> = {
    baru: {
      label: dict.funnel.baru,
      colorClass:
        "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-500/30",
    },
    dihubungi: {
      label: dict.funnel.dihubungi,
      colorClass:
        "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-400 dark:ring-purple-500/30",
    },
    prospek: {
      label: dict.funnel.prospek,
      colorClass:
        "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-500/30",
    },
    survei: {
      label: dict.funnel.survei,
      colorClass:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/30",
    },
    closing: {
      label: dict.funnel.closing,
      colorClass:
        "bg-teal-50 text-teal-800 ring-teal-600/30 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-500/40 font-semibold",
    },
    batal: {
      label: dict.funnel.batal,
      colorClass:
        "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-500/30",
    },
  };

  const current = stageConfig[stage] || {
    label: stage,
    colorClass: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${current.colorClass}`}
    >
      {current.label}
    </span>
  );
}

export function ScorePill({
  score,
  completeness,
}: {
  score: number | null;
  completeness?: number;
}) {
  if (score === null || typeof score === "undefined" || Number.isNaN(score)) {
    return (
      <span
        className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-500"
        title="Belum dapat dinilai karena data tidak lengkap"
      >
        —
      </span>
    );
  }

  let color = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ring-zinc-300 dark:ring-zinc-700";
  if (score >= 80) {
    color = "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30";
  } else if (score >= 60) {
    color = "bg-blue-50 text-blue-800 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-500/30";
  } else if (score >= 40) {
    color = "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30";
  } else {
    color = "bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-500/30";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${color}`}
    >
      <span>{score}</span>
      {completeness !== undefined && completeness < 100 && (
        <span
          className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400"
          title={`Data completeness: ${completeness}%`}
        >
          ({completeness}%)
        </span>
      )}
    </span>
  );
}
