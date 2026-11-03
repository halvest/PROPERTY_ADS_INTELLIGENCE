"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useSidebar } from "./SidebarContext";

export interface NavItem {
  name: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactNode;
}

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { dict, locale } = useI18n();
  const {
    isCollapsed,
    toggleCollapse,
    mobileMenuOpen,
    closeMobileMenu,
  } = useSidebar();

  const isDrawerOpen = isOpen !== undefined ? isOpen : mobileMenuOpen;
  const handleClose = onClose || closeMobileMenu;

  // Handle ESC key for mobile drawer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isDrawerOpen && handleClose) {
        handleClose();
      }
    }
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen, handleClose]);

  const navigation: NavItem[] = [
    {
      name: dict.common.overview,
      href: "/dashboard",
      icon: (props) => (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
          />
        </svg>
      ),
    },
    {
      name: dict.common.ads,
      href: "/ads",
      icon: (props) => (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
      ),
    },
    {
      name: dict.common.leads,
      href: "/leads",
      icon: (props) => (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
          />
        </svg>
      ),
    },
    {
      name: dict.common.reviews,
      href: "/studio",
      icon: (props) => (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
          />
        </svg>
      ),
    },
    {
      name: dict.common.enhancer || "Image Enhancer",
      href: "/enhancer",
      icon: (props) => (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      ),
    },
    {
      name: dict.common.settings,
      href: "/settings",
      icon: (props) => (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  /* -------------------------------------------------------------------------- */
  /* 1. Desktop Sidebar Content                                                 */
  /* -------------------------------------------------------------------------- */
  const desktopContent = (
    <div
      className={`flex h-full flex-col justify-between border-r border-zinc-200/80 bg-zinc-50/95 py-3.5 transition-all duration-300 dark:border-zinc-800/70 dark:bg-zinc-950/95 ${
        isCollapsed ? "px-2" : "px-3"
      }`}
    >
      <div className="space-y-3">
        {/* Section Header with Top Minimize/Expand Toggle directly on the Sidebar */}
        {isCollapsed ? (
          <div className="flex items-center justify-center pb-1">
            <button
              type="button"
              onClick={toggleCollapse}
              className="group relative flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              aria-label={locale === "id" ? "Perluas menu (Ctrl+B)" : "Expand sidebar (Ctrl+B)"}
            >
              <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              <div
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 hidden lg:group-hover:flex items-center rounded-lg border border-zinc-200/90 bg-white/95 px-2.5 py-1 text-xs font-semibold text-zinc-900 shadow-lg backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-50 whitespace-nowrap z-50"
              >
                <span>{locale === "id" ? "Perluas menu" : "Expand sidebar"}</span>
                <kbd className="ml-1.5 rounded border border-zinc-200 bg-zinc-100 px-1 py-0.2 text-[10px] font-mono text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  Ctrl+B
                </kbd>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-white dark:border-r-zinc-900" />
              </div>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 pt-0.5 pb-1">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-zinc-500 uppercase dark:text-zinc-500">
              {dict.common.overview}
            </p>
            <button
              type="button"
              onClick={toggleCollapse}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              aria-label={locale === "id" ? "Ciutkan menu (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              title={locale === "id" ? "Ciutkan menu (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/studio" && pathname.startsWith("/reviews")) ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex min-h-10 items-center rounded-xl transition-all ${
                    isCollapsed
                      ? "h-10 w-10 mx-auto justify-center p-0"
                      : "justify-start px-2.5 py-2 text-[13px]"
                  } font-medium ${
                    isActive
                      ? "nav-solar-active font-semibold text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-900/[0.04] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100"
                  }`}
                >
                  <item.icon
                    className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                      isActive
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="ml-3 truncate">{item.name}</span>
                  )}
                </Link>

                {/* Floating Tooltip in Collapsed Mode */}
                {isCollapsed && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 hidden lg:group-hover:flex items-center rounded-lg border border-zinc-200/90 bg-white/95 px-2.5 py-1 text-xs font-semibold text-zinc-900 shadow-lg backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-50 whitespace-nowrap z-50 transition-opacity animate-in fade-in-0 zoom-in-95 duration-150"
                  >
                    <span>{item.name}</span>
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-white dark:border-r-zinc-900" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Desktop Collapse/Expand Trigger */}
      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <button
          type="button"
          onClick={toggleCollapse}
          className={`group relative flex items-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100 cursor-pointer ${
            isCollapsed
              ? "h-10 w-10 mx-auto justify-center"
              : "w-full justify-between px-2.5 py-2 text-xs font-medium"
          }`}
          aria-label={
            isCollapsed
              ? locale === "id"
                ? "Perluas menu (Ctrl+B)"
                : "Expand sidebar (Ctrl+B)"
              : locale === "id"
              ? "Ciutkan menu (Ctrl+B)"
              : "Collapse sidebar (Ctrl+B)"
          }
        >
          {isCollapsed ? (
            <>
              {/* Expand Icon: Right Arrow */}
              <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              {/* Tooltip */}
              <div
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 hidden lg:group-hover:flex items-center rounded-lg border border-zinc-200/90 bg-white/95 px-2.5 py-1 text-xs font-semibold text-zinc-900 shadow-lg backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-50 whitespace-nowrap z-50"
              >
                <span>{locale === "id" ? "Perluas menu" : "Expand sidebar"}</span>
                <kbd className="ml-1.5 rounded border border-zinc-200 bg-zinc-100 px-1 py-0.2 text-[10px] font-mono text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  Ctrl+B
                </kbd>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-white dark:border-r-zinc-900" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                {/* Collapse Icon: Left Arrow */}
                <svg className="h-4 w-4 text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
                <span>{locale === "id" ? "Ciutkan menu" : "Collapse sidebar"}</span>
              </div>
              <kbd className="inline-block rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                Ctrl+B
              </kbd>
            </>
          )}
        </button>
      </div>
    </div>
  );

  /* -------------------------------------------------------------------------- */
  /* 2. Mobile Drawer Content (Always full-width with brand & close button)      */
  /* -------------------------------------------------------------------------- */
  const mobileDrawerContent = (
    <div className="flex h-full flex-col justify-between bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="space-y-4">
        {/* Drawer Header: Logo + Close Button */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 dark:border-zinc-800/80">
          <Link href="/dashboard" onClick={handleClose} className="flex items-center gap-2.5">
            <BrandLogo size="sm" priority />
            <div className="flex flex-col">
              <span className="font-semibold text-sm leading-tight text-zinc-900 dark:text-zinc-100">
                {dict.common.appName}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {dict.common.tagline}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer"
            aria-label={dict.common.close}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section Title */}
        <div className="px-1">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-zinc-500 uppercase dark:text-zinc-500">
            {dict.common.overview}
          </p>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/studio" && pathname.startsWith("/reviews")) ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleClose}
                aria-current={isActive ? "page" : undefined}
                className={`group flex min-h-10 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "nav-solar-active font-semibold text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`h-5 w-5 shrink-0 ${
                      isActive
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Drawer Footer note */}
      <div className="border-t border-zinc-200/70 pt-3 text-center text-[11px] text-zinc-400 dark:border-zinc-800">
        HD Creative © {new Date().getFullYear()}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar with dynamic width and smooth CSS transition */}
      <aside
        className={`hidden lg:fixed lg:inset-y-0 lg:top-14 lg:z-30 lg:flex lg:flex-col transition-[width] duration-300 ease-in-out ${
          isCollapsed ? "lg:w-[68px]" : "lg:w-60"
        }`}
        aria-label="Sidebar navigation"
      >
        {desktopContent}
      </aside>

      {/* Mobile drawer backdrop */}
      {isDrawerOpen && (
        <div
          className="glass-overlay fixed inset-0 z-50 lg:hidden transition-opacity backdrop-blur-xs"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer slide-in panel */}
      {isDrawerOpen && (
        <div
          className="fixed inset-y-0 left-0 z-50 w-72 bg-zinc-50 shadow-2xl lg:hidden dark:bg-zinc-950 transition-transform animate-in slide-in-from-left duration-200"
          role="dialog"
          aria-modal="true"
        >
          {mobileDrawerContent}
        </div>
      )}
    </>
  );
}
