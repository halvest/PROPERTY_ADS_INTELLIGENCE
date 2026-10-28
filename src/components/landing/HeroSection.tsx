import Link from "next/link";
import type { TranslationDictionary } from "@/lib/i18n/types";

type Landing = TranslationDictionary["landing"];

function formatSample(locale: "id" | "en", value: number): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US").format(value);
}

function formatMoney(locale: "id" | "en", value: number): string {
  const formatted = formatSample(locale, value);
  return locale === "id" ? `Rp${formatted}` : `IDR ${formatted}`;
}

export function HeroSection({ landing, locale }: { landing: Landing; locale: "id" | "en" }) {
  const h = landing.hero;
  const bars = [38, 52, 44, 66, 58, 74, 62];
  const metrics = [
    { label: h.previewSpend, value: formatMoney(locale, 12500000) },
    { label: h.previewLeads, value: formatSample(locale, 184) },
    { label: h.previewQualified, value: formatSample(locale, 46) },
    { label: h.previewCpql, value: formatMoney(locale, 271739) },
  ];

  return (
    <section className="relative isolate overflow-hidden border-b border-line/70 bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_0%,var(--glow-accent),transparent_45%)] opacity-70"
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:px-8 lg:py-20 xl:gap-20">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent sm:text-sm">
            {h.badge}
          </p>
          <h1 className="mt-5 max-w-[15ch] text-balance text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-[3.6rem]">
            {h.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            {h.subtitle}
          </p>

          <div className="mt-7 flex">
            <Link
              href="/register"
              className="group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-accent px-6 py-3.5 text-[15px] font-semibold text-accent-foreground shadow-[0_10px_24px_rgba(79,70,229,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-accent/95 hover:shadow-[0_14px_30px_rgba(79,70,229,0.34)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-3 min-[440px]:w-auto"
            >
              <span>{h.ctaPrimary}</span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </span>
            </Link>
          </div>

          <p className="mt-5 max-w-lg text-xs leading-5 text-muted sm:text-sm">
            {h.note}
          </p>
        </div>

        <figure
          className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
          aria-label={h.previewLabel}
        >
          <figcaption className="flex min-w-0 items-center justify-between gap-3 border-b border-line/70 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent" aria-hidden="true">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {locale === "id" ? "Performa iklan" : "Ad performance"}
                </p>
                <p className="mt-0.5 text-xs text-muted">HD Creative / Ads</p>
              </div>
            </div>
            <span className="shrink-0 rounded-md border border-line bg-subtle/60 px-2 py-1 text-[10px] font-medium text-muted sm:text-xs">
              {h.previewLabel}
            </span>
          </figcaption>

          <div className="grid grid-cols-2 divide-x divide-y divide-line/70 sm:grid-cols-4 sm:divide-y-0">
            {metrics.map((metric) => (
              <div key={metric.label} className="min-w-0 px-4 py-3.5 sm:px-3.5 sm:py-4 lg:px-4">
                <p className="truncate text-[11px] font-medium text-muted">{metric.label}</p>
                <p className="tnum mt-1.5 truncate text-lg font-semibold tracking-tight text-foreground sm:text-base lg:text-lg">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted">{h.previewChartLabel}</p>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-full bg-accent" />
                {locale === "id" ? "7 hari" : "7 days"}
              </span>
            </div>
            <div className="rounded-xl bg-subtle/55 px-2 py-3 sm:px-4">
              <svg viewBox="0 0 320 88" className="h-24 w-full" role="img" aria-label={h.previewChartLabel}>
                {[20, 46, 72].map((y) => (
                  <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="currentColor" strokeOpacity="0.08" />
                ))}
                {bars.map((height, index) => (
                  <rect
                    key={index}
                    x={12 + index * 44}
                    y={82 - height}
                    width="24"
                    height={height}
                    rx="4"
                    fill="var(--accent)"
                    fillOpacity={index === bars.length - 1 ? "0.9" : "0.5"}
                  />
                ))}
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-line/70 bg-subtle/30 px-4 py-3 text-xs text-muted sm:px-5">
            <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.75h16M4 12h10M4 17.25h7" />
            </svg>
            <span className="min-w-0 truncate">{h.previewAttribution}</span>
          </div>
        </figure>
      </div>
    </section>
  );
}
