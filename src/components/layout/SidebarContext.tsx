"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  toggleCollapse: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const STORAGE_KEY = "hd_sidebar_collapsed";
const TOGGLE_EVENT = "hd_sidebar_toggle";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(TOGGLE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TOGGLE_EVENT, callback);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isCollapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const setIsCollapsed = useCallback((val: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
      window.dispatchEvent(new Event(TOGGLE_EVENT));
    } catch {
      // Ignore localStorage restrictions
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    const next = !getSnapshot();
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(TOGGLE_EVENT));
    } catch {
      // Ignore
    }
  }, []);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed,
        toggleCollapse,
        mobileMenuOpen,
        setMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    return {
      isCollapsed: false,
      setIsCollapsed: () => {},
      toggleCollapse: () => {},
      mobileMenuOpen: false,
      setMobileMenuOpen: () => {},
      toggleMobileMenu: () => {},
      closeMobileMenu: () => {},
    };
  }
  return context;
}
