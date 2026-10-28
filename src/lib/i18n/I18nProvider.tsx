"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { Locale, TranslationDictionary } from "./types";
import { idDictionary } from "./dictionaries/id";
import { enDictionary } from "./dictionaries/en";

const LOCALE_STORAGE_KEY = "app_locale";
const LOCALE_COOKIE_KEY = "app_locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dict: TranslationDictionary;
  t: TranslationDictionary;
  formatCurrency: (amount: number | null) => string;
  formatNumber: (num: number | null) => string;
  formatDate: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: string | Date | number) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getClientStoredLocale(): Locale {
  if (typeof window === "undefined") return "id";
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "id" || stored === "en") return stored;

    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_KEY}=([^;]*)`));
    if (match) {
      const cookieLocale = decodeURIComponent(match[1]);
      if (cookieLocale === "id" || cookieLocale === "en") return cookieLocale;
    }
  } catch {
    // Storage access blocked or restricted
  }
  return "id";
}

export function I18nProvider({
  children,
  initialLocale = "id",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  // Always initialize with initialLocale (matching SSR/static HTML) to avoid hydration mismatch
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Synchronize with stored client preference and subscribe to cross-tab / window changes
  useEffect(() => {
    const syncStoredLocale = () => {
      const stored = getClientStoredLocale();
      if (stored && stored !== initialLocale) {
        setLocaleState(stored);
      }
    };

    // Schedule after mount to prevent synchronous cascading re-renders
    const timer = setTimeout(syncStoredLocale, 0);

    window.addEventListener("storage", syncStoredLocale);
    window.addEventListener("localechange", syncStoredLocale);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", syncStoredLocale);
      window.removeEventListener("localechange", syncStoredLocale);
    };
  }, [initialLocale]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const dict = useMemo(() => {
    return locale === "en" ? enDictionary : idDictionary;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLocale;
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
        document.cookie = `${LOCALE_COOKIE_KEY}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
        window.dispatchEvent(new Event("localechange"));
      } catch {
        // Storage blocked
      }
    }
  }, []);

  const formatCurrency = useCallback(
    (amount: number | null): string => {
      if (amount === null || typeof amount === "undefined" || Number.isNaN(amount)) {
        return "—";
      }
      const intlLocale = locale === "id" ? "id-ID" : "en-US";
      return `Rp ${Math.round(amount).toLocaleString(intlLocale)}`;
    },
    [locale]
  );

  const formatNumber = useCallback(
    (num: number | null): string => {
      if (num === null || typeof num === "undefined" || Number.isNaN(num)) {
        return "—";
      }
      const intlLocale = locale === "id" ? "id-ID" : "en-US";
      return new Intl.NumberFormat(intlLocale).format(num);
    },
    [locale]
  );

  const formatDate = useCallback(
    (date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
      if (!date) return "—";
      const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
      if (Number.isNaN(d.getTime())) return "—";

      const intlLocale = locale === "id" ? "id-ID" : "en-US";
      return new Intl.DateTimeFormat(intlLocale, options || {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(d);
    },
    [locale]
  );

  const formatDateTime = useCallback(
    (date: string | Date | number): string => {
      if (!date) return "—";
      const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
      if (Number.isNaN(d.getTime())) return "—";

      const intlLocale = locale === "id" ? "id-ID" : "en-US";
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      dict,
      t: dict,
      formatCurrency,
      formatNumber,
      formatDate,
      formatDateTime,
    }),
    [locale, setLocale, dict, formatCurrency, formatNumber, formatDate, formatDateTime]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
