"use client";

import { useState } from "react";
import type { TranslationDictionary } from "@/lib/i18n/types";

type Landing = TranslationDictionary["landing"];

export function FaqAccordion({ landing }: { landing: Landing }) {
  const f = landing.faq;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="border-b border-line/60 bg-subtle/30 py-16 sm:py-20 lg:py-24" aria-labelledby="faq-title">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-8">
        <div className="max-w-lg">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="h-px w-6 bg-accent" aria-hidden="true" />
            {f.eyebrow}
          </p>
          <h2 id="faq-title" className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[2.65rem]">
            {f.title}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted sm:text-base">{f.subtitle}</p>
        </div>

        <div className="border-t border-line/80">
          {f.items.map((item, index) => {
            const open = openIndex === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;

            return (
              <article key={item.question} className="border-b border-line/80">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="group flex min-h-16 w-full items-center gap-3 py-4 text-left focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 sm:gap-4 sm:py-5"
                  >
                    <span className="tnum w-7 shrink-0 font-mono text-[11px] text-muted/70 sm:w-8 sm:text-xs">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={`min-w-0 flex-1 text-sm font-semibold leading-6 transition-colors sm:text-base ${open ? "text-accent" : "text-foreground group-hover:text-accent"}`}>
                      {item.question}
                    </span>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition-all ${open ? "rotate-45 border-accent/30 text-accent" : "group-hover:border-accent/30 group-hover:text-accent"}`} aria-hidden="true">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="accordion-panel"
                  data-open={open ? "true" : "false"}
                >
                  <div>
                    <div className="pb-5 pl-10 pr-11 sm:pb-6 sm:pl-12 sm:pr-14">
                      <p className="max-w-3xl text-sm leading-6 text-muted sm:text-[15px] sm:leading-7">{item.answer}</p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
