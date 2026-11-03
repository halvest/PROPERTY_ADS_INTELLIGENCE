"use client";

import React, { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Theme } from "@/lib/theme/types";

const emptySubscribe = () => () => {};

function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { dict } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMounted = useMounted();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options: Array<{ id: Theme; label: string; icon: React.ReactNode }> = [
    {
      id: "light",
      label: dict.common.light,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
    },
    {
      id: "dark",
      label: dict.common.dark,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ),
    },
    {
      id: "system",
      label: dict.common.system,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200/80 bg-white/70 text-zinc-600 hover:bg-white hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 transition-colors cursor-pointer"
        aria-label={isMounted ? `${dict.common.theme}: ${theme}` : dict.common.theme}
        aria-expanded={isOpen}
      >
        {/* Deterministic CSS-driven dual SVG: both server and client render identical HTML markup */}
        {/* Sun icon: rendered in DOM and shown in light mode, hidden in dark mode */}
        <svg
          className="h-4 w-4 block dark:hidden text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
          />
        </svg>
        {/* Moon icon: rendered in DOM and hidden in light mode, shown in dark mode */}
        <svg
          className="h-4 w-4 hidden dark:block text-indigo-300"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="glass-popover absolute right-0 z-50 mt-2 w-40 origin-top-right rounded-xl p-1 focus:outline-none">
          {options.map((opt) => {
            const isSelected = isMounted ? theme === opt.id : opt.id === "system";
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-indigo-500/10 font-semibold text-zinc-900 dark:bg-indigo-400/10 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                }`}
              >
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{opt.icon}</span>
                <span className="flex-1 text-left">{opt.label}</span>
                {isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
