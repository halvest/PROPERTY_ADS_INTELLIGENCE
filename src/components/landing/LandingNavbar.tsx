import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { NavbarActions } from "./NavbarActions";
import type { TranslationDictionary } from "@/lib/i18n/types";

type Landing = TranslationDictionary["landing"];

export function LandingNavbar({ landing }: { landing: Landing }) {
  const links = [
    { href: "#fitur", label: landing.nav.features },
    { href: "#kalkulator", label: landing.nav.calculator },
    { href: "#cara-kerja", label: landing.nav.howItWorks },
    { href: "#keamanan", label: landing.nav.security },
    { href: "#faq", label: landing.nav.faq },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80" aria-label="HD Creative">
          <BrandLogo size="sm" priority />
          <span className="hidden truncate text-sm font-semibold tracking-tight text-foreground min-[420px]:inline">
            HD Creative
          </span>
        </Link>
        <nav aria-label="Landing" className="hidden items-center gap-0.5 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted transition-all hover:bg-accent/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NavbarActions />
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent sm:inline-flex"
          >
            {landing.nav.login}
          </Link>
          <Link
            href="/register"
            className="btn-glow inline-flex rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-foreground focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            {landing.nav.getStarted}
          </Link>
        </div>
      </div>
    </header>
  );
}
