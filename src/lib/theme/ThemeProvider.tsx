"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { Theme, ThemeContextValue } from "./types";

const THEME_STORAGE_KEY = "app_theme";
const THEME_COOKIE_KEY = "app_theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    // Cookie takes priority so the client agrees with the pre-paint ThemeScript.
    const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE_KEY}=([^;]*)`));
    if (match) {
      const cookieTheme = decodeURIComponent(match[1]);
      if (cookieTheme === "light" || cookieTheme === "dark" || cookieTheme === "system") {
        return cookieTheme as Theme;
      }
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Storage access may be blocked
  }
  return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getSystemTheme);

  // Track system preference changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "light" | "dark" = theme === "system" ? systemTheme : theme;

  // Apply theme to DOM and persist
  const applyTheme = useCallback((targetTheme: Theme, currentResolved: "light" | "dark") => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", currentResolved);
    if (currentResolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, targetTheme);
      document.cookie = `${THEME_COOKIE_KEY}=${encodeURIComponent(targetTheme)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Storage blocked
    }
  }, []);

  useEffect(() => {
    applyTheme(theme, resolvedTheme);
  }, [theme, resolvedTheme, applyTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
