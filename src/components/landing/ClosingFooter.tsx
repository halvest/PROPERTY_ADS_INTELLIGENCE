import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import type { TranslationDictionary } from "@/lib/i18n/types";

type Landing = TranslationDictionary["landing"];

export function ClosingCta({ landing }: { landing: Landing }) {
  const c = landing.cta;

  return (
    <section className="border-b border-line/60 bg-background py-14 sm:py-18 lg:py-20" aria-labelledby="cta-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-7 rounded-3xl bg-[#171a2b] p-6 text-white sm:p-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12 lg:p-12">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">
              <span className="h-px w-6 bg-indigo-300" aria-hidden="true" />
              {c.eyebrow}
            </p>
            <h2 id="cta-title" className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-[2.7rem]">
              {c.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{c.subtitle}</p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:min-w-52 lg:flex-col">
            <Link
              href="/register"
              className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-3"
            >
              <span>{c.primary}</span>
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </Link>
            <Link href="/login" className="px-3 py-2 text-center text-sm font-medium text-slate-300 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-indigo-300">
              {c.secondary}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter({ landing }: { landing: Landing }) {
  const f = landing.footer;
  const anchors = ["#fitur", "#kalkulator", "#cara-kerja", "#keamanan", "#faq"];

  return (
    <footer className="border-t border-line/60 bg-subtle/30">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-8 gap-y-10 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(150px,0.65fr)_minmax(150px,0.65fr)] lg:px-8">
        <div className="col-span-2 max-w-md sm:col-span-1">
          <Link href="/" className="inline-flex items-center gap-3 transition-opacity hover:opacity-80">
            <BrandLogo size="md" />
            <span className="text-lg font-semibold tracking-tight text-foreground">HD Creative</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">{f.description}</p>
        </div>

        <nav aria-label={f.productTitle}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{f.productTitle}</h3>
          <ul className="mt-4 space-y-2.5">
            {f.productLinks.map((label, i) => (
              <li key={label}>
                <a
                  href={anchors[i]}
                  className="inline-flex min-h-6 items-center text-sm text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={f.accountTitle}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{f.accountTitle}</h3>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link
                href="/login"
                className="inline-flex min-h-6 items-center text-sm text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                {f.login}
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                className="inline-flex min-h-6 items-center text-sm text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                {f.register}
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard"
                className="inline-flex min-h-6 items-center text-sm text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                {f.dashboard}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted sm:px-6 lg:px-8">
          <p>© 2026 {f.rights}</p>
        </div>
      </div>
    </footer>
  );
}
