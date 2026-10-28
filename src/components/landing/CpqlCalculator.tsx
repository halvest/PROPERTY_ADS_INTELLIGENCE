"use client";

import { useMemo, useState } from "react";
import type { TranslationDictionary } from "@/lib/i18n/types";

type Landing = TranslationDictionary["landing"];

const MAX_SIMULATION_SPEND = 10_000_000;
const BUDGET_PRESETS = [1_000_000, 3_000_000, 5_000_000, MAX_SIMULATION_SPEND];

export function CpqlCalculator({
  landing,
  locale,
}: {
  landing: Landing;
  locale: "id" | "en";
}) {
  const c = landing.calculator;
  const intl = locale === "id" ? "id-ID" : "en-US";
  const [spend, setSpend] = useState(5_000_000);
  const [chats, setChats] = useState(250);
  const [share, setShare] = useState(25);

  const fmtMoney = (value: number | null) =>
    value === null
      ? "—"
      : `${locale === "id" ? "Rp" : "IDR "}${new Intl.NumberFormat(intl, {
          maximumFractionDigits: 0,
        }).format(value)}`;
  const fmtNum = (value: number) => new Intl.NumberFormat(intl).format(value);
  const fmtPct = (value: number) =>
    `${new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(value)}%`;
  const presetLabel = (value: number) =>
    locale === "id" ? `${fmtNum(value / 1_000_000)} jt` : `IDR ${fmtNum(value / 1_000_000)}m`;

  const { cpl, qualified, cpql, otherSpend } = useMemo(() => {
    const safeChats = Math.max(chats, 0);
    const qualifiedCount = Math.floor((safeChats * share) / 100);
    return {
      cpl: safeChats > 0 ? spend / safeChats : null,
      qualified: qualifiedCount,
      cpql: qualifiedCount > 0 ? spend / qualifiedCount : null,
      otherSpend: spend * (1 - share / 100),
    };
  }, [spend, chats, share]);

  const sliderClass =
    "h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4";

  return (
    <section id="kalkulator" className="border-b border-line/60 bg-subtle/30 py-16 sm:py-20 lg:py-24" aria-labelledby="calc-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="h-px w-6 bg-accent" aria-hidden="true" />
            {c.eyebrow}
          </p>
          <h2 id="calc-title" className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[2.75rem]">
            {c.title}
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted sm:text-base">{c.subtitle}</p>
        </div>

        <div className="mt-8 grid overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_36px_rgba(15,23,42,0.05)] lg:grid-cols-[1.05fr_0.95fr] lg:rounded-3xl">
          <div className="min-w-0 p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">{c.presetLabel}</h3>
              <span className="rounded-full border border-line bg-subtle/60 px-2.5 py-1 text-[11px] font-medium text-muted">{c.simulationLabel}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {BUDGET_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpend(value)}
                  aria-pressed={spend === value}
                  className={`min-h-9 rounded-lg border px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
                    spend === value
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-line bg-surface text-muted hover:border-accent/40 hover:text-foreground"
                  }`}
                >
                  {presetLabel(value)}
                </button>
              ))}
            </div>

            <div className="mt-6 divide-y divide-line/70">
              <SliderControl
                id="calc-spend"
                label={c.spendLabel}
                value={fmtMoney(spend)}
                minLabel={fmtMoney(1_000_000)}
                maxLabel={fmtMoney(MAX_SIMULATION_SPEND)}
                min={1_000_000}
                max={MAX_SIMULATION_SPEND}
                step={500_000}
                current={spend}
                onChange={setSpend}
                sliderClass={sliderClass}
              />
              <SliderControl
                id="calc-chats"
                label={c.chatsLabel}
                value={`${fmtNum(chats)} ${c.chatUnit}`}
                minLabel={`10 ${c.chatUnit}`}
                maxLabel={`${fmtNum(2_000)} ${c.chatUnit}`}
                min={10}
                max={2_000}
                step={10}
                current={chats}
                onChange={setChats}
                sliderClass={sliderClass}
              />
              <SliderControl
                id="calc-share"
                label={c.qualifiedShareLabel}
                value={fmtPct(share)}
                minLabel="5%"
                maxLabel="90%"
                min={5}
                max={90}
                step={5}
                current={share}
                onChange={setShare}
                sliderClass={sliderClass}
                note={c.assumptionNote}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col bg-[#171a2b] p-5 text-white sm:p-7 lg:p-8" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-300">{c.outputLabel}</p>
              <svg className="h-5 w-5 text-indigo-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 18V6m0 12h16M7 14l4-4 3 2 5-6" />
              </svg>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <p className="text-xs font-medium text-indigo-200">{c.cpqlLabel}</p>
              <p className="tnum mt-2 break-words text-3xl font-semibold tracking-tight text-white sm:text-4xl">{fmtMoney(cpql)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{c.cpqlNote}</p>
              {cpql === null && <p className="mt-2 text-xs text-amber-200">{c.cpqlUnavailable}</p>}
            </div>

            <div className="mt-3 grid grid-cols-2 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.025]">
              <div className="min-w-0 p-3.5 sm:p-4">
                <p className="text-[11px] leading-4 text-slate-400">{c.cplLabel}</p>
                <p className="tnum mt-1.5 break-words text-lg font-semibold text-white sm:text-xl">{fmtMoney(cpl)}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">{c.cplNote}</p>
              </div>
              <div className="min-w-0 p-3.5 sm:p-4">
                <p className="text-[11px] leading-4 text-slate-400">{c.qualifiedCountLabel}</p>
                <p className="tnum mt-1.5 text-lg font-semibold text-white sm:text-xl">{fmtNum(qualified)}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">{fmtPct(share)} {c.qualifiedShareShort}</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-medium text-slate-300">{c.remainderSpendLabel}</p>
                <p className="tnum text-sm font-semibold text-amber-200">{fmtMoney(otherSpend)}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div className="h-full rounded-full bg-amber-300" style={{ width: `${100 - share}%` }} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                <span className="font-medium text-slate-300">{fmtPct(100 - share)}</span> {c.remainderSpendNote}
              </p>
            </div>

            <p className="mt-auto border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">{c.resultNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderControl({
  id,
  label,
  value,
  minLabel,
  maxLabel,
  min,
  max,
  step,
  current,
  onChange,
  sliderClass,
  note,
}: {
  id: string;
  label: string;
  value: string;
  minLabel: string;
  maxLabel: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (value: number) => void;
  sliderClass: string;
  note?: string;
}) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
        <span className="tnum text-sm font-semibold text-foreground">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) => onChange(Number(event.target.value))}
        className={sliderClass}
      />
      <div className="mt-1.5 flex justify-between gap-3 text-[10px] tabular-nums text-muted">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {note && <p className="mt-2 text-xs leading-5 text-muted">{note}</p>}
    </div>
  );
}
