"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleMobileMenu, closeMobileMenu, mobileMenuOpen } = useSidebar();
  const pathname = usePathname();
  const studioBleed = pathname === "/studio" || pathname === "/reviews" || pathname === "/enhancer";

  return (
    <div className={`solar-ambient bg-zinc-50 dark:bg-zinc-950 flex flex-col ${studioBleed ? "h-dvh overflow-hidden" : "min-h-screen"}`}>
      <Header onMenuToggle={toggleMobileMenu} />
      <Suspense
        fallback={
          <aside className="hidden lg:fixed lg:inset-y-0 lg:top-14 lg:z-30 lg:flex lg:w-60 border-r border-zinc-200/80 bg-zinc-50 dark:border-zinc-800/70 dark:bg-zinc-950" />
        }
      >
        <Sidebar isOpen={mobileMenuOpen} onClose={closeMobileMenu} />
      </Suspense>
      <div
        className={`flex flex-col flex-1 min-h-0 min-w-0 transition-[padding] duration-300 ease-in-out ${
          isCollapsed ? "lg:pl-[68px]" : "lg:pl-60"
        }`}
      >
        <main
          className={
            studioBleed
              ? "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden p-0"
              : "p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto min-w-0"
          }
        >
          <Suspense
            fallback={
              <div role="status" className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Loading...
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}
