"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TranslationDictionary } from "@/lib/i18n/types";

type Landing = TranslationDictionary["landing"];

const FEATURE_CONFIG = [
  {
    tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  {
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  },
  {
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  },
  {
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7.5L19 8.25v12A1.5 1.5 0 0 1 17.5 21.75h-10A1.5 1.5 0 0 1 6 20.25v-15A1.5 1.5 0 0 1 7.5 3.75ZM14 4v4.5h4.5M9 13h6m-6 3.5h6" />,
  },
];

export function FeaturesSection({ landing }: { landing: Landing }) {
  const f = landing.features;
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(true);

  const updateControls = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    setCanScrollBack(carousel.scrollLeft > 2);
    setCanScrollForward(carousel.scrollLeft + carousel.clientWidth < carousel.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    updateControls();
    carousel.addEventListener("scroll", updateControls, { passive: true });
    window.addEventListener("resize", updateControls);
    return () => {
      carousel.removeEventListener("scroll", updateControls);
      window.removeEventListener("resize", updateControls);
    };
  }, [updateControls]);

  function scrollCarousel(direction: -1 | 1) {
    const carousel = carouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({ left: direction * carousel.clientWidth * 0.82, behavior: "smooth" });
  }

  return (
    <section id="fitur" className="border-b border-line/60 bg-background py-16 sm:py-20 lg:py-24" aria-labelledby="features-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              <span className="h-px w-6 bg-accent" aria-hidden="true" />
              {f.eyebrow}
            </p>
            <h2 id="features-title" className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[2.75rem]">
              {f.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted sm:text-base">{f.subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
            <p className="text-xs text-muted sm:hidden">{f.carouselHint}</p>
            <div className="flex items-center gap-2" aria-label={f.carouselControlsLabel}>
              <button
                type="button"
                onClick={() => scrollCarousel(-1)}
                disabled={!canScrollBack}
                aria-label={f.previous}
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-foreground transition-colors hover:border-accent/40 hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6 7-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel(1)}
                disabled={!canScrollForward}
                aria-label={f.next}
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-foreground transition-colors hover:border-accent/40 hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-7 7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div
          ref={carouselRef}
          role="region"
          aria-label={f.carouselLabel}
          tabIndex={0}
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
        >
          {f.items.map((item, index) => {
            const config = FEATURE_CONFIG[index % FEATURE_CONFIG.length];
            return (
              <article
                key={item.title}
                className="flex min-h-[290px] w-[86%] shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/30 sm:w-[calc((100%-1rem)/2)] sm:p-6 xl:w-[calc((100%-2rem)/3)]"
              >
                <div className="flex items-center justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${config.tone}`} aria-hidden="true">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{config.icon}</svg>
                  </span>
                  <span className="tnum font-mono text-xs text-muted/70">
                    {String(index + 1).padStart(2, "0")} / {String(f.items.length).padStart(2, "0")}
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-semibold leading-snug tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-muted">{item.description}</p>

                <div className="mt-auto border-t border-line/70 pt-4 mt-5">
                  <p className="text-xs leading-5 text-muted">{item.footer}</p>
                  {item.statuses && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {item.statuses.map((status, statusIndex) => (
                        <span
                          key={status}
                          className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                            statusIndex === 0
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-subtle text-muted"
                          }`}
                        >
                          {status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="hidden text-xs text-muted sm:block">{f.carouselHint}</p>
      </div>
    </section>
  );
}
