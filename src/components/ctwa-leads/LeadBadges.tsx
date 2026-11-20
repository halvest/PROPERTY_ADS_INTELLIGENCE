"use client";

import React from "react";
import {
  STAGE_LABELS,
  TEMPERATURE_LABELS,
  type LeadTemperature,
  type PipelineStage,
} from "@/lib/ctwa-leads/types";

const TEMPERATURE_STYLES: Record<LeadTemperature, string> = {
  hot: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/60 dark:text-rose-200",
  warm: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-200",
  cold: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-950/60 dark:text-sky-200",
  junk: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
};

const STAGE_STYLES: Record<PipelineStage, string> = {
  new_inquiry:
    "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  contacted:
    "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/50 dark:text-blue-200",
  qualified:
    "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-950/50 dark:text-indigo-200",
  survey:
    "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-500/40 dark:bg-violet-950/50 dark:text-violet-200",
  closing:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200",
  won: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-200",
  lost: "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500",
};

const ACTOR_STYLES: Record<"ai" | "human" | "system", string> = {
  ai: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-950/60 dark:text-indigo-300",
  human:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-300",
  system:
    "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function TemperatureBadge({
  temperature,
  size = "sm",
}: {
  temperature: LeadTemperature;
  size?: "xs" | "sm";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border font-semibold uppercase tracking-wide ${
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      } ${TEMPERATURE_STYLES[temperature]}`}
    >
      {TEMPERATURE_LABELS[temperature]}
    </span>
  );
}

export function PipelineStageBadge({
  stage,
  locked = false,
  size = "sm",
}: {
  stage: PipelineStage;
  locked?: boolean;
  size?: "xs" | "sm";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-medium ${
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      } ${STAGE_STYLES[stage]}`}
    >
      <span>{STAGE_LABELS[stage]}</span>
      {locked && (
        <svg
          className="h-3 w-3 shrink-0 opacity-80"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-label="Manual stage locked"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      )}
    </span>
  );
}

export function ActorTypeBadge({ actor }: { actor: "ai" | "human" | "system" }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ACTOR_STYLES[actor]}`}
    >
      {actor}
    </span>
  );
}

export function AnalysisOnlyCoexistenceBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
      <svg
        className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
      <span>
        Read-only transcript synced via WhatsApp Coexistence. Reply directly from WhatsApp Business App.
      </span>
    </div>
  );
}
