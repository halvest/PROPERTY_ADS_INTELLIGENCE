import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type AuthPageShellProps = {
  appName: string;
  brandHeadline: string;
  brandSubheadline: string;
  children: ReactNode;
};

export function AuthPageShell({
  appName,
  brandHeadline,
  brandSubheadline,
  children,
}: AuthPageShellProps) {
  return (
    <main className="min-h-dvh bg-white text-zinc-950 dark:bg-[#090b12] dark:text-zinc-50 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.88fr)]">
      <aside className="relative hidden min-h-dvh overflow-hidden bg-[#141827] text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-20 xl:py-12">
        <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
          <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-white/[0.08]" />
          <div className="absolute -right-24 -top-24 h-[25rem] w-[25rem] rounded-full border border-white/[0.08]" />
          <div className="absolute -right-8 -top-8 h-[16rem] w-[16rem] rounded-full border border-white/[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_18%,rgba(100,116,255,0.26),transparent_42%)]" />
        </div>

        <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-3">
          <BrandLogo size="md" priority />
          <span className="text-sm font-semibold tracking-tight">{appName}</span>
        </Link>

        <div className="relative z-10 max-w-xl py-16">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
            Analisis iklan properti
          </div>
          <h2 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-[-0.04em] xl:text-5xl">
            {brandHeadline}
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/65">
            {brandSubheadline}
          </p>

          <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.055] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Alur analisis</span>
              <span className="font-mono">01 — 03</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["01", "Iklan"],
                ["02", "Percakapan"],
                ["03", "Kualitas lead"],
              ].map(([number, label], index) => (
                <div key={number} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[10px] font-semibold text-white/80">
                      {number}
                    </span>
                    {index < 2 && <span className="h-px flex-1 bg-white/15" />}
                  </div>
                  <p className="mt-2 text-xs font-medium text-white/80">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} {appName}
        </p>
      </aside>

      <section className="relative flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:min-h-dvh lg:px-12 lg:py-4">
        <header className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="inline-flex items-center gap-2 lg:hidden">
            <BrandLogo size="sm" priority />
            <span className="text-sm font-semibold tracking-tight">{appName}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-8 sm:py-10 lg:py-2">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 lg:hidden">
              <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">{brandHeadline}</p>
              <p className="mt-1.5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{brandSubheadline}</p>
            </div>
            {children}
            <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500 lg:mt-3">
              <Link href="/" className="transition-colors hover:text-zinc-700 dark:hover:text-zinc-300">Kembali ke HD Creative</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
