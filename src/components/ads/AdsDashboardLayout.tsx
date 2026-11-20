"use client";

import React from "react";

interface AdsDashboardLayoutProps {
  title: string;
  subtitle?: string;
  adAccountSelector: React.ReactNode;
  dateRangeFilter?: React.ReactNode;
  syncButton?: React.ReactNode;
  activeAccountDetails?: {
    currency?: string;
    timezone?: string;
  };
  children: React.ReactNode;
}

export function AdsDashboardLayout({
  title,
  subtitle,
  adAccountSelector,
  dateRangeFilter,
  syncButton,
  activeAccountDetails,
  children,
}: AdsDashboardLayoutProps) {
  return (
    <div className="relative min-h-screen w-full pb-20">
      <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-8 xl:px-10 space-y-6">
        {/* Control Bar Header (Natural Document Flow) */}
        <header className="relative mb-6 flex flex-col gap-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-2xs transition-all">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {title}
                </h1>

                {activeAccountDetails?.currency && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06]">
                    {activeAccountDetails.currency}
                    {activeAccountDetails.timezone ? ` · ${activeAccountDetails.timezone}` : ""}
                  </span>
                )}
              </div>

              {subtitle && (
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {subtitle}
                </p>
              )}

              {/* Account Selector & Connection Metadata */}
              <div className="pt-0.5 flex flex-wrap items-center gap-2.5">
                {adAccountSelector}
              </div>
            </div>

            {/* Action Group: Filters & Sync Button */}
            <div className="flex flex-wrap items-center gap-3 self-start xl:self-center">
              {dateRangeFilter}
              {syncButton}
            </div>
          </div>
        </header>

        {/* 3. Main Dashboard Content Slot */}
        <main className="space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
