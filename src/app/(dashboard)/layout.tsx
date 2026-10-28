"use client";

import React, { useState, Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#090a0c] flex flex-col">
      <Header onMenuToggle={() => setMobileMenuOpen(true)} />
      <Suspense fallback={<aside className="hidden lg:fixed lg:inset-y-0 lg:top-14 lg:z-30 lg:flex lg:w-60 bg-white dark:bg-[#090a0c]" />}>
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
      </Suspense>
      <div className="lg:pl-60 flex flex-col flex-1">
        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          <Suspense fallback={<div className="p-8 text-center text-xs text-zinc-400">Loading...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
