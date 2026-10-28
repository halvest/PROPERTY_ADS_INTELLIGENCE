import React from "react";

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  formulaLabel?: string;
  sampleSize?: number;
  trendText?: string;
  warningText?: string;
  highlight?: boolean;
}

export function KPICard({
  title,
  value,
  subtitle,
  formulaLabel,
  sampleSize,
  trendText,
  warningText,
  highlight = false,
}: KPICardProps) {
  return (
    <div
      className={`rounded-xl border p-4.5 transition-colors shadow-2xs ${
        highlight
          ? "border-indigo-500/30 bg-indigo-50/40 dark:border-indigo-500/20 dark:bg-indigo-950/20"
          : "border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {title}
        </span>
        {formulaLabel && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            title={`Formula: ${formulaLabel}`}
          >
            {formulaLabel}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        {value === "..." ? (
          <span className="inline-block h-7 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        ) : (
          <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-sans tabular-nums">
            {value}
          </span>
        )}
        {sampleSize !== undefined && (
          <span
            className="text-xs font-mono text-zinc-400 dark:text-zinc-500"
            title="Sample size"
          >
            (n = {sampleSize})
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {subtitle}
        </p>
      )}

      {warningText && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>{warningText}</span>
        </div>
      )}

      {trendText && (
        <p className="mt-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          {trendText}
        </p>
      )}
    </div>
  );
}
