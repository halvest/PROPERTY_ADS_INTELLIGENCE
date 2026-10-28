import type { TranslationDictionary } from "@/lib/i18n/types";

type Landing = TranslationDictionary["landing"];

export function ProblemSection({ landing }: { landing: Landing }) {
  const p = landing.problem;

  return (
    <section className="border-b border-line/60 bg-subtle/30" aria-labelledby="problem-title">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="h-px w-6 bg-accent" aria-hidden="true" />
            {p.eyebrow}
          </p>
          <h2 id="problem-title" className="mt-4 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[2.75rem]">
            {p.title}
          </h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-muted sm:text-base sm:leading-7">{p.intro}</p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl border border-line/80 bg-surface px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
          <FlowStep label={p.flow[0]} kind="meta" />
          <FlowConnector />
          <FlowStep label={p.flow[1]} kind="whatsapp" />
          <span className="mx-1 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 sm:mx-2 sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            {p.flowGap}
          </span>
          <FlowConnector />
          <FlowStep label={p.flow[2]} kind="sales" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:gap-5">
          <article className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300" aria-hidden="true">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v4m0 3h.01M10 2.75l8 14H2l8-14Z" />
                </svg>
              </span>
              {p.problemLabel}
            </div>
            <h3 className="mt-4 text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">{p.seenTitle}</h3>

            <ol className="mt-5 divide-y divide-line/70">
              {p.seenItems.map((item, index) => (
                <li key={item.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="tnum pt-0.5 text-xs font-semibold text-muted/70">0{index + 1}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-5 rounded-xl bg-subtle/70 px-4 py-3 text-sm leading-6 text-foreground/80">{p.problemSummary}</p>
          </article>

          <article className="relative overflow-hidden rounded-2xl bg-[#171a2b] p-5 text-white sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200">{p.solutionLabel}</p>
                <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold tracking-tight text-white">HD Creative</span>
              </div>
              <h3 className="mt-4 max-w-xl text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{p.unseenTitle}</h3>

              <ol className="mt-5 divide-y divide-white/10">
                {p.unseenItems.map((item, index) => (
                  <li key={item.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-300/10 text-[11px] font-semibold text-indigo-200">0{index + 1}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-200">{p.solutionSummary}</p>
            </div>
          </article>
        </div>

        <p className="mt-5 max-w-5xl text-xs leading-5 text-muted sm:text-sm">{p.note}</p>
      </div>
    </section>
  );
}

function FlowStep({ label, kind }: { label: string; kind: "meta" | "whatsapp" | "sales" }) {
  const icon = {
    meta: <path strokeLinecap="round" strokeLinejoin="round" d="M4 17V7m0 10h16M7 14l3-3 3 2 5-6" />,
    whatsapp: <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a7.5 7.5 0 0 1-11.3 6.46L4 19l1.1-3.45A7.5 7.5 0 1 1 20 11.5Z" />,
    sales: <path strokeLinecap="round" strokeLinejoin="round" d="M16 18.5a4.5 4.5 0 0 0-9 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 6.5a4 4 0 0 0-3.1-3.9M17 6.2a3 3 0 0 1 0 5.6" />,
  }[kind];

  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-subtle text-muted" aria-hidden="true">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{icon}</svg>
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function FlowConnector() {
  return (
    <svg className="h-4 w-4 shrink-0 text-muted/60" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
