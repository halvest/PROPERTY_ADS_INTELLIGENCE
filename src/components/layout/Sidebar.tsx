"use client";

import React, { useEffect, useState } from "react";
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

export interface NavGroup {
  label: string;
  items: NavItem[];
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
  const isId = locale === "id";
  const {
    isCollapsed,
    toggleCollapse,
    mobileMenuOpen,
    closeMobileMenu,
  } = useSidebar();

  const [tip, setTip] = useState<{ text: string; top: number } | null>(null);

  const isDrawerOpen = isOpen !== undefined ? isOpen : mobileMenuOpen;
  const handleClose = onClose || closeMobileMenu;

  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const previousOverflow = document.body.style.overflow === "unset" ? "" : document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isDrawerOpen, handleClose]);

  const navGroups: NavGroup[] = [
    {
      label: isId ? "Umum" : "General",
      items: [
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
          name: dict.common.ctwaLeads || "CTWA Leads",
          href: "/ctwa-leads",
          icon: (props) => (
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
          ),
        },
        {
          name: dict.common.pipeline || "Pipeline",
          href: "/pipeline",
          icon: (props) => (
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          ),
        },
      ],
    },
    {
      label: isId ? "Integrasi & Tim" : "Team & Integrations",
      items: [
        {
          name: dict.common.connections || "WhatsApp Connections",
          href: "/connections",
          icon: (props) => (
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" {...props}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
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
      ],
    },
  ];

  const isNavItemActive = (item: NavItem): boolean =>
    pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

  const railEase =
    "duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:delay-0";
  const labelClass = `block min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] motion-reduce:transition-none motion-reduce:delay-0 ${
    isCollapsed
      ? "max-w-0 opacity-0 duration-200 ease-out"
      : "max-w-[164px] opacity-100 delay-100 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
  }`;

  /* -------------------------------------------------------------------------- */
  /* 1. Desktop Sidebar Content (Modern Solar Theme — Light & Dark Compatible)  */
  /* -------------------------------------------------------------------------- */
  const desktopContent = (
    <div className="flex h-full flex-col justify-between border-r border-zinc-200/80 bg-zinc-50/95 py-3 dark:border-zinc-800/70 dark:bg-zinc-950/95">
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden no-scrollbar">
        <button
          type="button"
          onClick={toggleCollapse}
          onMouseEnter={(event) => {
            if (!isCollapsed) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setTip({
              text: isId ? "Luaskan menu" : "Expand menu",
              top: rect.top + rect.height / 2,
            });
          }}
          onMouseLeave={() => setTip(null)}
          className="group mb-1 flex h-11 w-full cursor-pointer items-center rounded-xl text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
          aria-label={
            isCollapsed
              ? isId
                ? "Luaskan menu (Ctrl+B)"
                : "Expand menu (Ctrl+B)"
              : isId
                ? "Ciutkan menu (Ctrl+B)"
                : "Collapse menu (Ctrl+B)"
          }
          aria-expanded={!isCollapsed}
        >
          <span className="flex h-11 w-[68px] shrink-0 items-center justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/90 bg-white shadow-2xs transition-[transform,border-color,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:border-indigo-400/80 group-hover:bg-indigo-50 group-hover:shadow-[0_0_0_3px_rgba(234,170,32,0.18)] dark:border-zinc-700 dark:bg-zinc-900 dark:group-hover:border-indigo-400/60 dark:group-hover:bg-indigo-950/40">
              <svg
                className={`h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                  isCollapsed ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </span>
          </span>
          <span className={`${labelClass} text-[13px] font-medium`}>
            {isId ? "Ciutkan menu" : "Collapse menu"}
          </span>
        </button>

        {/* Grouped Navigation Sections */}
        {navGroups.map((group, groupIdx) => (
          <div key={group.label} className="space-y-0.5">
            <div
              className={`overflow-hidden transition-[max-height,opacity] ${railEase} ${
                isCollapsed ? "max-h-0 opacity-0" : "max-h-8 opacity-100"
              }`}
            >
              <p className="pb-1 pl-[68px] pr-3 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
                {group.label}
              </p>
            </div>
            {isCollapsed && groupIdx > 0 ? (
              <div className="mx-auto my-1 h-px w-6 bg-zinc-200/80 dark:bg-zinc-800" />
            ) : null}

            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isNavItemActive(item);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onMouseEnter={(event) => {
                      if (!isCollapsed) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      setTip({ text: item.name, top: rect.top + rect.height / 2 });
                    }}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(event) => {
                      if (!isCollapsed) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      setTip({ text: item.name, top: rect.top + rect.height / 2 });
                    }}
                    onBlur={() => setTip(null)}
                    className={`group relative flex h-10 items-center rounded-xl transition-colors ${
                      isActive
                        ? "nav-solar-active font-semibold text-zinc-900 dark:text-zinc-50"
                        : "font-medium text-zinc-600 hover:bg-zinc-900/[0.04] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100"
                    }`}
                  >
                    <span className="flex h-10 w-[68px] shrink-0 items-center justify-center">
                      <item.icon
                        className={`h-[18px] w-[18px] shrink-0 ${
                          isActive
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
                        }`}
                      />
                    </span>
                    <span className={labelClass}>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </div>
  );

  /* -------------------------------------------------------------------------- */
  /* 2. Mobile Drawer Content                                                   */
  /* -------------------------------------------------------------------------- */
  const mobileDrawerContent = (
    <div className="flex h-full flex-col justify-between bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 dark:border-zinc-800/80">
          <Link href="/dashboard" onClick={handleClose} className="flex items-center gap-2.5">
            <BrandLogo size="sm" priority />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
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

        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
              {group.label}
            </p>
            <nav className="space-y-1">
              {group.items.map((item) => {
                const isActive = isNavItemActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleClose}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "nav-solar-active font-semibold text-zinc-900 dark:text-zinc-50"
                        : "font-medium text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 shrink-0 ${
                        isActive
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-200/70 pt-3 text-center text-[11px] text-zinc-400 dark:border-zinc-800" suppressHydrationWarning>
        HD Creative © {new Date().getFullYear()}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:fixed lg:inset-y-0 lg:top-14 lg:z-30 lg:flex lg:flex-col overflow-hidden transition-[width] ${railEase} ${
          isCollapsed ? "lg:w-[68px]" : "lg:w-60"
        }`}
        aria-label="Sidebar navigation"
      >
        {desktopContent}
      </aside>

      {tip && isCollapsed ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[60] hidden -translate-y-1/2 items-center whitespace-nowrap rounded-lg border border-zinc-200/90 bg-white/95 px-2.5 py-1 text-xs font-semibold text-zinc-900 shadow-lg lg:flex dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-50"
          style={{ top: tip.top, left: 76 }}
        >
          {tip.text}
        </div>
      ) : null}

      <div
        className={`glass-overlay fixed inset-0 z-50 transition-opacity lg:hidden ${railEase} ${
          isDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-zinc-50 shadow-2xl transition-transform lg:hidden dark:bg-zinc-950 ${railEase} ${
          isDrawerOpen ? "translate-x-0" : "pointer-events-none -translate-x-full"
        }`}
        role="dialog"
        aria-modal={isDrawerOpen}
        aria-hidden={!isDrawerOpen}
        inert={!isDrawerOpen}
      >
        {mobileDrawerContent}
      </div>
    </>
  );
}
