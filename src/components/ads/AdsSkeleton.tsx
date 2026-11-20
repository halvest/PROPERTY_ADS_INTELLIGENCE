import React from "react";

export function AdsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-16 animate-pulse">
      {/* 1. Header & Account Switcher Skeleton */}
      <div className="surface-card flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2.5">
            <div className="h-7 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-3">
              <div className="h-8 w-64 rounded-lg bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-6 w-28 rounded-full bg-zinc-100 dark:bg-zinc-800/60" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-28 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-9 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>

        {/* Filter Bar Skeleton */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          <div className="h-8 w-24 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-8 w-36 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-8 w-28 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-8 w-48 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>

      {/* 2. KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-8 w-8 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div className="mt-3 h-8 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-2 h-3 w-24 rounded bg-zinc-100 dark:bg-zinc-800/70" />
            <div className="mt-4 h-6 w-full rounded bg-zinc-50 dark:bg-zinc-800/40" />
          </div>
        ))}
      </div>

      {/* 3. Performance Trend Chart Skeleton */}
      <div className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1.5">
            <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-56 rounded bg-zinc-100 dark:bg-zinc-800/60" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-16 rounded-md bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-7 w-16 rounded-md bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
        <div className="h-64 w-full rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50" />
      </div>

      {/* 4. Table Inventory Skeleton */}
      <div className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-48 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0"
            >
              <div className="flex items-center gap-3 w-1/3">
                <div className="h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <div className="space-y-1.5 w-full">
                  <div className="h-3.5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-2.5 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
              <div className="h-4 w-16 rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-16 rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-7 w-20 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

