"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  addToast: (type: ToastType, title: string, message: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4500) => {
      // Avoid duplicate toasts with identical message
      setToasts((prev) => {
        const existing = prev.find((t) => t.message === message && t.type === type);
        if (existing) return prev;

        const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newItem: ToastItem = { id, type, message, title, duration };

        if (duration > 0) {
          setTimeout(() => {
            dismissToast(id);
          }, duration);
        }

        return [...prev, newItem];
      });
    },
    [dismissToast]
  );

  const success = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast("success", message, title, duration);
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast("error", message, title, duration || 6000);
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast("warning", message, title, duration);
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) => {
      showToast("info", message, title, duration);
    },
    [showToast]
  );

  const addToast = useCallback(
    (type: ToastType, title: string, message: string, duration?: number) => {
      showToast(type, message, title, duration);
    },
    [showToast]
  );

  const value = useMemo(
    () => ({
      showToast,
      addToast,
      success,
      error,
      warning,
      info,
      dismissToast,
    }),
    [showToast, addToast, success, error, warning, info, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex max-w-sm w-full flex-col gap-2 pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              t.type === "success"
                ? "border-emerald-500/20 bg-white/95 text-zinc-900 dark:border-emerald-500/30 dark:bg-zinc-900/95 dark:text-zinc-100"
                : t.type === "error"
                ? "border-rose-500/20 bg-white/95 text-zinc-900 dark:border-rose-500/30 dark:bg-zinc-900/95 dark:text-zinc-100"
                : t.type === "warning"
                ? "border-amber-500/20 bg-white/95 text-zinc-900 dark:border-amber-500/30 dark:bg-zinc-900/95 dark:text-zinc-100"
                : "border-zinc-200 bg-white/95 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-100"
            }`}
          >
            {/* Clean SVG icon based on type */}
            <div className="shrink-0 mt-0.5">
              {t.type === "success" && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
              {t.type === "error" && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </div>
              )}
              {t.type === "warning" && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
              {t.type === "info" && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              {t.title && (
                <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {t.title}
                </h5>
              )}
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {t.message}
              </p>
            </div>

            {/* Dismiss button */}
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              aria-label="Tutup notifikasi"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
