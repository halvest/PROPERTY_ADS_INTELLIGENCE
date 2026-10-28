import type { TranslationDictionary } from "@/lib/i18n/types";

type Landing = TranslationDictionary["landing"];

const SECURITY_ICONS = [
  // AES-256 Key Encryption
  <svg key="aes" className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>,
  // HMAC SHA-256 Webhook Verification
  <svg key="hmac" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-2.171 7.27a8.966 8.966 0 01-4.079-1.042L3.75 18l1.02-4.999A8.967 8.967 0 013 9c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9c-1.396 0-2.716-.318-3.896-.884z" />
  </svg>,
  // Multi-tenant PostgreSQL RLS
  <svg key="rls" className="h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>,
  // Read-only Meta Graph API
  <svg key="read-only" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>,
];

export function WorkflowSection({ landing }: { landing: Landing }) {
  const w = landing.workflow;
  return (
    <section id="cara-kerja" className="border-b border-line/60 bg-subtle/30 py-16 sm:py-20 lg:py-24" aria-labelledby="workflow-title">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-5 lg:px-8">
        <div className="flex min-h-[340px] flex-col justify-between rounded-3xl bg-[#171a2b] p-6 text-white sm:min-h-[380px] sm:p-8 lg:p-9">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">
              <span className="h-px w-6 bg-indigo-300" aria-hidden="true" />
              {w.eyebrow}
            </p>
            <h2 id="workflow-title" className="mt-5 max-w-lg text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-[2.65rem]">
              {w.title}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{w.subtitle}</p>
          </div>

          <div className="mt-8 flex items-start gap-3 border-t border-white/10 pt-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-indigo-200" aria-hidden="true">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5 6v5c0 4.7 2.9 8.1 7 10 4.1-1.9 7-5.3 7-10V6l-7-3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <p className="pt-0.5 text-xs leading-5 text-slate-300 sm:text-sm">{w.readOnlyNote}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-2 sm:p-3">
          <ol className="relative divide-y divide-line/70 before:absolute before:bottom-12 before:left-10 before:top-12 before:w-px before:bg-line/80 sm:before:left-[3.25rem]">
            {w.steps.map((step, i) => (
              <li key={step.title} className="relative flex gap-4 p-3 sm:gap-5 sm:p-4">
                <span className="tnum relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface font-mono text-xs font-semibold text-accent sm:h-12 sm:w-12">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 py-0.5 sm:py-1">
                  <h3 className="text-sm font-semibold leading-5 tracking-tight text-foreground sm:text-base">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted sm:text-sm sm:leading-6">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function SecuritySection({ landing }: { landing: Landing }) {
  const s = landing.security;

  return (
    <section id="keamanan" className="border-b border-line/60 bg-background py-16 sm:py-20 lg:py-24" aria-labelledby="security-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              <span className="h-px w-6 bg-accent" aria-hidden="true" />
              {s.eyebrow}
            </p>
            <h2 id="security-title" className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[2.75rem]">
            {s.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted sm:text-base">{s.subtitle}</p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface sm:mt-10 sm:rounded-3xl">
          {s.items.map((item, i) => (
            <article
              key={item.title}
              className={`grid gap-3 p-4 sm:gap-4 sm:p-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)] lg:items-center lg:gap-8 lg:px-6 ${
                i < s.items.length - 1 ? "border-b border-line/70" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="tnum shrink-0 font-mono text-[11px] text-muted/70">0{i + 1}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-subtle">
                  {SECURITY_ICONS[i % SECURITY_ICONS.length]}
                </span>
                <h3 className="text-sm font-semibold leading-5 text-foreground sm:text-base">
                  {item.title}
                </h3>
              </div>
              <p className="pl-8 text-sm leading-6 text-muted sm:pl-12 lg:pl-0">
                {item.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-4 max-w-5xl text-xs leading-5 text-muted sm:text-sm">{s.note}</p>
      </div>
    </section>
  );
}
