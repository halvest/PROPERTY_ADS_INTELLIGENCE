"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { formatDisplayCurrency } from "@/lib/format/display-currency";

interface CTWAFunnelPanelProps {
  impressions: number;
  allClicks: number;
  linkClicks: number;
  totalResults: number;
  allCpc: number | null;
  linkCpc: number | null;
  cpm: number | null;
  costPerResult: number | null;
  currency?: string;
}

type Tone = "amber" | "emerald" | "blue";

export function CTWAFunnelPanel({
  impressions,
  allClicks,
  linkClicks,
  totalResults,
  allCpc,
  linkCpc,
  cpm,
  costPerResult,
  currency = "IDR",
}: CTWAFunnelPanelProps) {
  const { formatNumber, locale } = useI18n();
  const [isEvidenceOpen, setIsEvidenceOpen] = React.useState(false);

  const idLocale = locale === "id";
  const safeImpressions = Math.max(0, impressions || 0);
  const safeAllClicks = Math.max(0, allClicks || 0);
  const safeLinkClicks = Math.max(0, linkClicks || 0);
  const safeResults = Math.max(0, totalResults || 0);
  const calculatedAllCtr = safeImpressions > 0 ? (safeAllClicks / safeImpressions) * 100 : 0;
  const calculatedLinkCtr = safeImpressions > 0 ? (safeLinkClicks / safeImpressions) * 100 : 0;
  const effectiveAllCtr = calculatedAllCtr;
  const effectiveLinkCtr = calculatedLinkCtr;
  const intentRate = safeAllClicks > 0 ? (safeLinkClicks / safeAllClicks) * 100 : 0;
  const cvr = safeLinkClicks > 0 ? (safeResults / safeLinkClicks) * 100 : 0;
  const totalResultRate = safeImpressions > 0 ? (safeResults / safeImpressions) * 100 : 0;
  const nonLinkInteractions = safeAllClicks - safeLinkClicks;

  const formatPct = (value: number) => `${value.toFixed(2).replace(".", idLocale ? "," : ".")}%`;
  const money = (value: number | null) => formatDisplayCurrency(value, currency, idLocale ? "id" : "en");

  let summary: React.ReactNode;
  let recommendation: string;
  if (effectiveLinkCtr < 1 && cvr >= 25) {
    summary = idLocale ? (
      <>Konversi klik ke hasil sangat kuat di angka <strong>{formatPct(cvr)}</strong> (<strong>{formatNumber(safeResults)} hasil</strong> dari <strong>{formatNumber(safeLinkClicks)} klik tautan</strong>), namun CTR tautan masih <strong>{formatPct(effectiveLinkCtr)}</strong> (<strong>{formatNumber(nonLinkInteractions)} dari {formatNumber(safeAllClicks)} interaksi</strong> berhenti berinteraksi pada konten/caption tanpa menekan tombol tautan).</>
    ) : (
      <>Click-to-result conversion is strong at <strong>{formatPct(cvr)}</strong> (<strong>{formatNumber(safeResults)} results</strong> from <strong>{formatNumber(safeLinkClicks)} link clicks</strong>), while link CTR is <strong>{formatPct(effectiveLinkCtr)}</strong> (<strong>{formatNumber(nonLinkInteractions)} of {formatNumber(safeAllClicks)} interactions</strong> engaged with the ad content/caption without clicking the link button).</>
    );
    recommendation = idLocale
      ? "Hipotesis, bukan fakta: CTR tautan lebih rendah daripada rasio klik ke hasil. Visual, penawaran, audiens, dan placement tidak ada pada data ini, jadi hook tidak dapat disimpulkan."
      : "Focus: Strengthen the opening visual hook or the first 3 seconds of video, and make the main offer/CTA immediately visible in the first 2 caption lines.";
  } else if (effectiveLinkCtr >= 1 && cvr < 15) {
    summary = idLocale ? (
      <>Iklan menarik trafik klik tautan yang tinggi: CTR <strong>{formatPct(effectiveLinkCtr)}</strong> (<strong>{formatNumber(safeLinkClicks)} klik</strong> dari <strong>{formatNumber(safeImpressions)} tayangan</strong>), namun baru <strong>{formatPct(cvr)}</strong> (<strong>{formatNumber(safeResults)} hasil</strong>) berlanjut menjadi konversi.</>
    ) : (
      <>The ad attracts strong link traffic: CTR is <strong>{formatPct(effectiveLinkCtr)}</strong> (<strong>{formatNumber(safeLinkClicks)} clicks</strong> from <strong>{formatNumber(safeImpressions)} impressions</strong>), but only <strong>{formatPct(cvr)}</strong> (<strong>{formatNumber(safeResults)} results</strong>) convert.</>
    );
    recommendation = idLocale
      ? "Fokus Optimasi: Evaluasi kesesuaian janji iklan dengan sapaan otomatis WhatsApp atau kecepatan muat landing page."
      : "Focus: Check the ad promise against the WhatsApp greeting or landing-page load speed.";
  } else if (effectiveLinkCtr >= 1 && cvr >= 25) {
    summary = idLocale ? (
      <>Seluruh tahapan funnel berjalan sangat sehat. CTR tautan mencapai <strong>{formatPct(effectiveLinkCtr)}</strong> (<strong>{formatNumber(safeLinkClicks)} klik</strong> dari <strong>{formatNumber(safeImpressions)} tayangan</strong>, di atas target 1%) dengan rasio konversi <strong>{formatPct(cvr)}</strong> (<strong>{formatNumber(safeResults)} hasil</strong>, di atas target 25%).</>
    ) : (
      <>Every funnel stage is performing strongly. Link CTR is <strong>{formatPct(effectiveLinkCtr)}</strong> (<strong>{formatNumber(safeLinkClicks)} clicks</strong> from <strong>{formatNumber(safeImpressions)} impressions</strong>, above the 1% target), with a <strong>{formatPct(cvr)}</strong> conversion rate (<strong>{formatNumber(safeResults)} results</strong>, above the 25% target).</>
    );
    recommendation = idLocale
      ? "Fokus Optimasi: Pertahankan materi iklan pemenang dan pertimbangkan penambahan budget bertahap (scaling)."
      : "Focus: Keep the winning creative and consider scaling the budget gradually.";
  } else {
    summary = idLocale ? (
      <>Dari <strong>{formatNumber(safeImpressions)} tayangan</strong>, tercatat <strong>{formatNumber(safeLinkClicks)} klik tautan</strong> (CTR <strong>{formatPct(effectiveLinkCtr)}</strong>) dan <strong>{formatNumber(safeResults)} hasil</strong> (CVR <strong>{formatPct(cvr)}</strong>).</>
    ) : (
      <>From <strong>{formatNumber(safeImpressions)} impressions</strong>, there were <strong>{formatNumber(safeLinkClicks)} link clicks</strong> (CTR <strong>{formatPct(effectiveLinkCtr)}</strong>) and <strong>{formatNumber(safeResults)} results</strong> (CVR <strong>{formatPct(cvr)}</strong>).</>
    );
    recommendation = idLocale
      ? "Fokus Optimasi: Uji variasi visual, CTA, dan pengalaman setelah klik untuk meningkatkan tahap funnel yang masih di bawah benchmark."
      : "Focus: Test creative, CTA, and post-click experience to improve stages below benchmark.";
  }

  const stages = [
    {
      number: 1,
      title: idLocale ? "Tayangan" : "Impressions",
      ratio: idLocale ? "Basis 100%" : "100% Baseline",
      ratioTone: "slate",
      value: safeImpressions,
      fill: 100,
      fillClass: "bg-slate-700",
      unitCost: `CPM ${money(cpm)}`,
      context: idLocale ? "Paparan iklan" : "Ad exposure",
      valueClass: "text-slate-900 dark:text-white",
    },
    {
      number: 2,
      title: idLocale ? "Interaksi Konten" : "Content Interactions",
      ratio: `CTR ${formatPct(effectiveAllCtr)}`,
      ratioTone: "slate",
      value: safeAllClicks,
      fill: Math.max(effectiveAllCtr * 4, 15),
      fillClass: "bg-blue-500",
      unitCost: `CPC ${money(allCpc)}`,
      context: idLocale ? "Interaksi konten & caption" : "Ad content & caption interactions",
      valueClass: "text-slate-900 dark:text-white",
    },
    {
      number: 3,
      title: idLocale ? "Klik Tautan" : "Link Clicks",
      ratio: `${idLocale ? "Niat" : "Intent"} ${formatPct(intentRate)}`,
      ratioTone: "slate",
      value: safeLinkClicks,
      fill: Math.max(intentRate, 12),
      fillClass: "bg-indigo-500",
      unitCost: `${idLocale ? "CPC Tautan" : "Link CPC"} ${money(linkCpc)}`,
      context: `${idLocale ? "CTR Tautan" : "Link CTR"} ${formatPct(effectiveLinkCtr)}`,
      valueClass: "text-slate-900 dark:text-white",
    },
    {
      number: 4,
      title: idLocale ? "Hasil Konversi" : "Conversion Results",
      ratio: `CVR ${formatPct(cvr)}`,
      ratioTone: "indigo",
      value: safeResults,
      fill: Math.max(cvr, 12),
      fillClass: "bg-indigo-600",
      unitCost: `${idLocale ? "Biaya/Hasil" : "Cost/Result"} ${money(costPerResult)}`,
      context: `${formatPct(totalResultRate)} ${idLocale ? "dari tayangan" : "of impressions"}`,
      valueClass: "text-indigo-600 dark:text-indigo-400",
    },
  ] as const;

  const cvrStatus: { label: string; tone: Tone } = cvr >= 25
    ? { label: idLocale ? "Sangat Tinggi" : "Very High", tone: "emerald" }
    : cvr >= 15
      ? { label: idLocale ? "Normal" : "Normal", tone: "blue" }
      : { label: idLocale ? "Rendah" : "Low", tone: "amber" };

  return (
    <section className="p-4" aria-labelledby="ctwa-funnel-title">
      <h2 id="ctwa-funnel-title" className="sr-only">
        {idLocale ? "Funnel Konversi & Biaya per Tahap" : "Conversion Funnel & Cost by Stage"}
      </h2>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => (
          <article key={stage.number} className={`rounded-xl border px-3 py-2 ${stage.number === 4 ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/70 dark:bg-indigo-950/20" : "border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-950/40"}`}>
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${stage.number === 4 ? "bg-amber-500 text-zinc-950 font-bold shadow-xs" : "bg-white text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>{stage.number}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-xs font-semibold text-slate-700 dark:text-zinc-200">{stage.title}</h3>
                  <p className={`shrink-0 font-mono text-sm font-semibold tabular-nums tracking-tight ${stage.valueClass}`}>{formatNumber(stage.value)}</p>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
                  <span className={stage.ratioTone === "indigo" ? "font-semibold text-indigo-700 dark:text-indigo-300" : ""}>{stage.ratio}</span>
                  {" · "}{stage.unitCost}
                </p>
              </div>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white dark:bg-zinc-800" aria-label={`${Math.round(stage.fill)}% progress`}>
              <div className={`h-full rounded-full ${stage.fillClass}`} style={{ width: `${Math.min(stage.fill, 100)}%` }} />
            </div>
          </article>
        ))}
      </div>

      <section className="mt-3 rounded-xl border border-slate-200 border-l-[3px] border-l-indigo-500 bg-slate-50/70 px-3 py-3 dark:border-zinc-800 dark:border-l-indigo-400 dark:bg-zinc-900/60" aria-labelledby="funnel-diagnosis-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="funnel-diagnosis-title" className="text-xs font-semibold tracking-tight text-slate-800 dark:text-zinc-100">
            {idLocale ? "Diagnosis Funnel Otomatis" : "Automatic Funnel Diagnosis"}
          </h3>
          <button
            type="button"
            onClick={() => setIsEvidenceOpen((open) => !open)}
            aria-expanded={isEvidenceOpen}
            aria-controls="funnel-evidence-grid"
            className="rounded-md px-2 py-1 text-[10px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
          >
            {isEvidenceOpen
              ? idLocale ? "Tutup Rumus & Benchmark ▴" : "Close formulas & benchmarks ▴"
              : idLocale ? "Lihat Rumus & Benchmark ▾" : "View formulas & benchmarks ▾"}
          </button>
        </div>
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-700 dark:text-zinc-300">{summary}</p>
        <p className="mt-2.5 rounded-lg bg-indigo-50/70 px-3 py-2 text-xs font-medium leading-relaxed text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200">{recommendation}</p>

        {isEvidenceOpen && (
          <div id="funnel-evidence-grid" className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200/80 pt-4 md:grid-cols-3 dark:border-zinc-700">
            <EvidenceCard
              title={idLocale ? "1. CTR Tautan" : "1. Link CTR"}
              status={calculatedLinkCtr < 1 ? idLocale ? "Di Bawah Target" : "Below Target" : idLocale ? "Optimal" : "Optimal"}
              tone={calculatedLinkCtr < 1 ? "amber" : "emerald"}
              actual={formatPct(calculatedLinkCtr)}
              target={idLocale ? "≥ 1,00%" : "≥ 1.00%"}
              formula={`${formatNumber(safeLinkClicks)} ${idLocale ? "klik tautan" : "link clicks"} ÷ ${formatNumber(safeImpressions)} ${idLocale ? "tayangan" : "impressions"} = ${formatPct(calculatedLinkCtr)}`}
              description={idLocale ? "Proporsi tayangan yang menghasilkan klik tautan." : "Share of impressions that generated a link click."}
              locale={locale}
            />
            <EvidenceCard
              title={idLocale ? "2. Rasio Niat Klik" : "2. Link Intent Rate"}
              status={intentRate >= 25 ? idLocale ? "Optimal" : "Optimal" : idLocale ? "Perlu Optimasi" : "Needs Optimization"}
              tone={intentRate >= 25 ? "emerald" : "amber"}
              actual={formatPct(intentRate)}
              target={idLocale ? "≥ 25,00%" : "≥ 25.00%"}
              formula={`${formatNumber(safeLinkClicks)} ${idLocale ? "klik tautan" : "link clicks"} ÷ ${formatNumber(safeAllClicks)} ${idLocale ? "semua interaksi konten" : "all content interactions"} = ${formatPct(intentRate)}`}
              description={idLocale ? `${formatNumber(nonLinkInteractions)} klik/interaksi materi iklan tidak berlanjut ke klik CTA.` : `${formatNumber(nonLinkInteractions)} ad-content clicks/interactions did not continue to a CTA click.`}
              locale={locale}
            />
            <EvidenceCard
              title={idLocale ? "3. Konversi Hasil (CVR)" : "3. Result Conversion (CVR)"}
              status={cvrStatus.label}
              tone={cvrStatus.tone}
              actual={formatPct(cvr)}
              target={idLocale ? "≥ 25,00%" : "≥ 25.00%"}
              formula={`${formatNumber(safeResults)} ${idLocale ? "hasil" : "results"} ÷ ${formatNumber(safeLinkClicks)} ${idLocale ? "klik tautan" : "link clicks"} = ${formatPct(cvr)}`}
              description={idLocale ? "Proporsi klik tautan yang menjadi konversi Meta." : "Share of link clicks that became Meta conversions."}
              locale={locale}
            />
          </div>
        )}
      </section>
    </section>
  );
}

function EvidenceCard({
  title,
  status,
  tone,
  actual,
  target,
  formula,
  description,
  locale,
}: {
  title: string;
  status: string;
  tone: Tone;
  actual: string;
  target: string;
  formula: string;
  description: string;
  locale: string;
}) {
  const toneClass: Record<Tone, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300",
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300",
  };

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950/70">
      <div className="flex items-center justify-between gap-2">
        <h4 className="truncate whitespace-nowrap text-xs font-semibold text-slate-800 dark:text-zinc-100">{title}</h4>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${toneClass[tone]}`}>{status}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <p className="text-slate-500 dark:text-zinc-400">{locale === "id" ? "Aktual" : "Actual"} <strong className="ml-1 font-semibold tabular-nums text-slate-900 dark:text-zinc-100">{actual}</strong></p>
        <p className="text-right text-slate-500 dark:text-zinc-400">{locale === "id" ? "Target" : "Target"} <strong className="ml-1 font-semibold tabular-nums text-slate-700 dark:text-zinc-200">{target}</strong></p>
      </div>
      <p className="mt-2 truncate rounded bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600 dark:bg-zinc-900 dark:text-zinc-300" title={formula}>{formula}</p>
      <p className="mt-2 text-xs leading-4 text-slate-500 dark:text-zinc-400">{description}</p>
    </article>
  );
}
