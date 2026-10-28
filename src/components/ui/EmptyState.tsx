"use client";

import React from "react";
import { Button } from "./Button";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function EmptyState({
  title,
  description,
  onReset,
  resetLabel,
  icon,
}: {
  title?: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
  icon?: React.ReactNode;
}) {
  const { dict } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 sm:p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 shadow-2xs dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500">
        {icon || (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        )}
      </div>

      <h3 className="mt-3.5 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title || dict.ads.emptyTitle}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {description || dict.ads.emptyDesc}
      </p>

      {onReset && (
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            {resetLabel || dict.common.reset}
          </Button>
        </div>
      )}
    </div>
  );
}
