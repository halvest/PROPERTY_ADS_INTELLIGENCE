"use client";

import React, { useId } from "react";

export interface KPICardProps {
  label: string;
  value: string | number;
  hint?: string;
  trendData?: Array<number | null | undefined>;
  trendPercent?: number;
  trendDirection?: "up" | "down" | "neutral";
  accentColor?: "emerald" | "indigo" | "amber" | "rose" | "violet";
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function PremiumKPICard({
  label,
  value,
  hint,
  trendData = [],
  trendPercent,
  trendDirection = "neutral",
  accentColor = "indigo",
  icon,
  isLoading = false,
}: KPICardProps) {
  const gradientId = useId();

  const colorMap = {
    indigo: {
      stroke: "#6366f1",
      gradientFrom: "rgba(99, 102, 241, 0.22)",
      gradientTo: "rgba(99, 102, 241, 0.0)",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/20",
    },
    emerald: {
      stroke: "#10b981",
      gradientFrom: "rgba(16, 185, 129, 0.22)",
      gradientTo: "rgba(16, 185, 129, 0.0)",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20",
    },
    amber: {
      stroke: "#f59e0b",
      gradientFrom: "rgba(245, 158, 11, 0.22)",
      gradientTo: "rgba(245, 158, 11, 0.0)",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20",
    },
    rose: {
      stroke: "#f43f5e",
      gradientFrom: "rgba(244, 63, 94, 0.22)",
      gradientTo: "rgba(244, 63, 94, 0.0)",
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20",
    },
    violet: {
      stroke: "#8b5cf6",
      gradientFrom: "rgba(139, 92, 246, 0.22)",
      gradientTo: "rgba(139, 92, 246, 0.0)",
      iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-inset ring-violet-500/20",
    },
  }[accentColor];

  const reported = trendData.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const points = reported.length > 1 ? reported : reported.length === 1 ? [reported[0], reported[0]] : null;
  const min = points ? Math.min(...points) : 0;
  const max = points ? Math.max(...points) : 0;
  const range = max - min || 1;
  const step = points && points.length > 1 ? 100 / (points.length - 1) : 100;

  const coords = (points ?? [])
    .map((val, idx) => {
      const x = idx * step;
      const y = 40 - ((val - min) / range) * 30 - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const closedArea = `0,44 ${coords} 100,44`;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl border border-zinc-200/60 dark:border-white/[0.08] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)] transition-all duration-300 hover:shadow-lg hover:border-zinc-300/80 dark:hover:border-white/20 hover:-translate-y-0.5">
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${colorMap.iconBg}`}>
                {icon}
              </span>
            )}
            <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
              {label}
            </span>
          </div>

          {trendPercent !== undefined && !isLoading && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                trendDirection === "up"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20"
                  : trendDirection === "down"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/60 dark:border-rose-500/20"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {trendDirection === "up" ? "↑" : trendDirection === "down" ? "↓" : "•"}
              {Math.abs(trendPercent)}%
            </span>
          )}
        </div>

        {/* Main Metric Value */}
        <div className="mt-4 flex items-baseline justify-between">
          {isLoading ? (
            <div className="h-9 w-36 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />
          ) : (
            <span className="text-2xl sm:text-[1.85rem] font-bold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
              {value}
            </span>
          )}
        </div>

        {/* Context Subtitle */}
        <p className="mt-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 line-clamp-1" title={hint}>
          {isLoading ? (
            <span className="inline-block h-3.5 w-44 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ) : (
            hint || "\u00A0"
          )}
        </p>
      </div>

      {/* Integrated Ambient Sparkline (Respecting Card Bottom Padding) */}
      <div className="relative mt-4 h-11 w-full overflow-hidden rounded-lg pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
        {isLoading ? (
          <div className="h-full w-full rounded-lg bg-zinc-100/70 dark:bg-zinc-800/50 animate-pulse" />
        ) : points ? (
          <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="h-full w-full block">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorMap.gradientFrom} />
                <stop offset="100%" stopColor={colorMap.gradientTo} />
              </linearGradient>
            </defs>
            <polygon fill={`url(#${gradientId})`} points={closedArea} />
            <polyline
              fill="none"
              stroke={colorMap.stroke}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={coords}
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
}

export function SecondaryMetricsTicker({
  metrics,
  isLoading = false,
}: {
  metrics: Array<{ label: string; value: string | number; sub?: string }>;
  isLoading?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white/75 dark:bg-zinc-900/75 backdrop-blur-md border border-zinc-200/60 dark:border-white/[0.08] p-1.5 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.03)]">
      <div className="flex items-stretch divide-x divide-zinc-200/60 dark:divide-white/[0.06]">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="flex-1 min-w-[155px] px-5 py-3.5 text-center transition-colors rounded-xl hover:bg-zinc-50/70 dark:hover:bg-white/[0.02]"
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {m.label}
            </span>
            <span className="block mt-1 text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
              {isLoading ? (
                <span className="inline-block h-5 w-20 mx-auto rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              ) : (
                m.value
              )}
            </span>
            {m.sub && (
              <span className="block mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 line-clamp-1" title={m.sub}>
                {m.sub}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
