"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { formatDisplayCurrency } from "@/lib/format/display-currency";
import { localizeResultLabel } from "@/lib/ads/result-metric";

export interface DailyTrendPoint {
  date: string;
  spend: number;
  impressions: number;
  reach: number | null;
  linkClicks: number;
  allClicks?: number;
  results: number;
  conversations?: number;
}

interface PerformanceTrendChartProps {
  dailyTrend: DailyTrendPoint[];
  currency?: string;
  timezone?: string;
  className?: string;
  conversationDataAvailable?: boolean;
  resultLabel?: string;
}

/**
 * Generates straight line segments between points with clean vertices
 * matching the high-precision reference design (Stripe/Linear style).
 */
function getPolylinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")}`;
}

/**
 * Creates closed area path under the polyline for SVG linear gradient fills.
 */
function getPolylineAreaPath(points: Array<{ x: number; y: number }>, bottomY: number): string {
  if (points.length < 2) return "";
  const line = getPolylinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
}

/**
 * Calculates a clean upper bound rounded to readable increments (e.g. 40k, 80k, 120k).
 */
function getNiceMax(val: number, minSteps = 3): number {
  if (val <= 0) return minSteps * 10;
  const rawStep = val / minSteps;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  let niceStep = 1;
  if (normalized <= 1) niceStep = 1;
  else if (normalized <= 1.5) niceStep = 1.5;
  else if (normalized <= 2) niceStep = 2;
  else if (normalized <= 2.5) niceStep = 2.5;
  else if (normalized <= 4) niceStep = 4;
  else if (normalized <= 5) niceStep = 5;
  else if (normalized <= 8) niceStep = 8;
  else niceStep = 10;

  return niceStep * magnitude * minSteps;
}

/**
 * Formats IDR amounts compactly (e.g., Rp0, Rp40rb/Rp40K, Rp1,2jt/Rp1.2M).
 */
function formatCompactIdr(amount: number, locale: "id" | "en" = "id"): string {
  if (amount === 0) return "Rp0";
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    const numStr = val % 1 === 0 ? String(val) : locale === "id" ? val.toFixed(1).replace(".", ",") : val.toFixed(1);
    return `Rp${numStr}${locale === "id" ? "jt" : "M"}`;
  }
  if (amount >= 1_000) {
    const val = amount / 1_000;
    const numStr = val % 1 === 0 ? String(val) : val.toFixed(0);
    return `Rp${numStr}${locale === "id" ? "rb" : "K"}`;
  }
  return `Rp${amount}`;
}

export function PerformanceTrendChart({
  dailyTrend = [],
  currency = "IDR",
  className = "",
  conversationDataAvailable: _conversationDataAvailable = true,
  resultLabel = "Hasil",
}: PerformanceTrendChartProps) {
  void _conversationDataAvailable;
  const { locale } = useI18n();
  const uiLocale: "id" | "en" = locale === "en" ? "en" : "id";

  const [hoveredIndexState, setHoveredIndex] = useState<number | null>(null);
  const hoveredIndex =
    hoveredIndexState !== null && hoveredIndexState < dailyTrend.length
      ? hoveredIndexState
      : null;
  const svgRef = useRef<SVGSVGElement | null>(null);

  // SVG Geometry Dimensions
  const width = 860;
  const height = 300;
  const pad = { left: 68, right: 36, top: 26, bottom: 44 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const bottomY = pad.top + plotHeight;

  // Maximum metrics with nice upper bounds
  const rawMaxSpend = Math.max(...dailyTrend.map((p) => p.spend), 0);
  const rawMaxResults = Math.max(
    ...dailyTrend.map((p) => (p.results > 0 ? p.results : p.conversations ?? 0)),
    0
  );

  const maxSpend = useMemo(() => {
    return Math.max(getNiceMax(rawMaxSpend, 3), 120000);
  }, [rawMaxSpend]);

  const maxResults = useMemo(() => {
    return Math.max(getNiceMax(rawMaxResults, 3), 24);
  }, [rawMaxResults]);

  // Coordinate projection functions
  const getX = useCallback(
    (index: number) => {
      if (dailyTrend.length < 2) return pad.left + plotWidth / 2;
      return pad.left + (index / (dailyTrend.length - 1)) * plotWidth;
    },
    [dailyTrend.length, pad.left, plotWidth]
  );

  const getYSpend = useCallback(
    (val: number) => {
      return pad.top + plotHeight - (maxSpend > 0 ? (val / maxSpend) * plotHeight : 0);
    },
    [maxSpend, pad.top, plotHeight]
  );

  const getYResults = useCallback(
    (val: number) => {
      return pad.top + plotHeight - (maxResults > 0 ? (val / maxResults) * plotHeight : 0);
    },
    [maxResults, pad.top, plotHeight]
  );

  // Plot Points
  const spendPoints = useMemo(() => {
    return dailyTrend.map((p, i) => ({ x: getX(i), y: getYSpend(p.spend) }));
  }, [dailyTrend, getX, getYSpend]);

  const resultPoints = useMemo(() => {
    return dailyTrend.map((p, i) => {
      const val = p.results > 0 ? p.results : p.conversations ?? 0;
      return { x: getX(i), y: getYResults(val) };
    });
  }, [dailyTrend, getX, getYResults]);

  // Straight line paths with rounded joins matching the reference image
  const spendPath = useMemo(() => getPolylinePath(spendPoints), [spendPoints]);
  const spendAreaPath = useMemo(() => getPolylineAreaPath(spendPoints, bottomY), [spendPoints, bottomY]);
  const resultsPath = useMemo(() => getPolylinePath(resultPoints), [resultPoints]);

  const formatCurrencyVal = (val: number) =>
    formatDisplayCurrency(val, currency || "IDR", locale === "en" ? "en" : "id");

  // Date Formatting Helpers
  const formatDateDayMonth = useCallback(
    (dateStr: string) => {
      try {
        const d = new Date(`${dateStr}T00:00:00Z`);
        const day = d.getUTCDate();
        const month = d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
          month: "short",
          timeZone: "UTC",
        });
        return `${day} ${month}`;
      } catch {
        return dateStr;
      }
    },
    [locale]
  );

  const formatFullDate = useCallback(
    (dateStr: string) => {
      try {
        const d = new Date(`${dateStr}T00:00:00Z`);
        return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
      } catch {
        return dateStr;
      }
    },
    [locale]
  );

  // Subtitle Date Range (e.g. 19 Okt–1 Nov)
  const dateRangeSubtitle = useMemo(() => {
    if (dailyTrend.length === 0) return "";
    const first = formatDateDayMonth(dailyTrend[0].date);
    const last = formatDateDayMonth(dailyTrend[dailyTrend.length - 1].date);
    return `${first}–${last}`;
  }, [dailyTrend, formatDateDayMonth]);

  const xAxisLabelStep = Math.max(1, Math.ceil((dailyTrend.length - 1) / 7));

  const displayResultName = localizeResultLabel(resultLabel, uiLocale);

  // Mouse Move Event Listener for Nearest Point Snapping
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || dailyTrend.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseXRatio = (e.clientX - rect.left) / rect.width;
    const svgX = mouseXRatio * width;

    let closestIndex = 0;
    let minDistance = Infinity;
    for (let i = 0; i < dailyTrend.length; i++) {
      const pointX = getX(i);
      const dist = Math.abs(svgX - pointX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }
    setHoveredIndex(closestIndex);
  };

  // Tooltip position & data
  const activePoint = hoveredIndex !== null ? dailyTrend[hoveredIndex] : null;
  const activeResults =
    activePoint ? (activePoint.results > 0 ? activePoint.results : activePoint.conversations ?? 0) : 0;
  const activeHoverX = hoveredIndex !== null ? getX(hoveredIndex) : 0;
  const activeSpendY = hoveredIndex !== null ? getYSpend(activePoint?.spend ?? 0) : 0;
  const activeResultsY = hoveredIndex !== null ? getYResults(activeResults) : 0;

  // Tooltip position: position tooltip to the left if point is on the right side of the graph
  const isRightSide = hoveredIndex !== null && hoveredIndex > dailyTrend.length / 2;

  return (
    <section
      className={`surface-card overflow-hidden rounded-2xl border border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      aria-labelledby="daily-trend-title"
    >
      {/* 1. Card Header */}
      <div className="flex flex-col gap-3 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="daily-trend-title"
            className="text-[15px] sm:text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            {locale === "id" ? "Tren performa harian" : "Daily performance trend"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {locale === "id"
              ? `Belanja dan hasil per hari${dateRangeSubtitle ? `, ${dateRangeSubtitle}` : ""}. Arahkan kursor ke grafik untuk detail.`
              : `Spend and results per day${dateRangeSubtitle ? `, ${dateRangeSubtitle}` : ""}. Hover over the graph for details.`}
          </p>
        </div>

        {/* Date Range Badge with chevron (matching reference image top-right pill) */}
        <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-800/60 dark:text-zinc-200 shadow-2xs">
          <svg className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          <span>{dateRangeSubtitle || (locale === "id" ? "Periode Aktif" : "Active Period")}</span>
          <svg className="h-3 w-3 text-zinc-400 shrink-0 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 2. Interactive SVG Graph Area */}
      {dailyTrend.length === 0 ? (
        <div className="py-16 text-center text-xs text-zinc-500">
          {locale === "id"
            ? "Tidak ada data harian pada periode ini."
            : "No daily data available for this period."}
        </div>
      ) : (
        <div
          className="relative w-full px-2 pb-1 sm:px-4"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full cursor-crosshair select-none"
            role="img"
            aria-label={locale === "id" ? "Grafik tren performa harian" : "Daily performance trend chart"}
            onMouseMove={handleMouseMove}
            onTouchMove={(e) => {
              if (e.touches.length > 0 && svgRef.current) {
                const rect = svgRef.current.getBoundingClientRect();
                const mouseXRatio = (e.touches[0].clientX - rect.left) / rect.width;
                const svgX = mouseXRatio * width;
                let closestIndex = 0;
                let minDistance = Infinity;
                for (let i = 0; i < dailyTrend.length; i++) {
                  const dist = Math.abs(svgX - getX(i));
                  if (dist < minDistance) {
                    minDistance = dist;
                    closestIndex = i;
                  }
                }
                setHoveredIndex(closestIndex);
              }
            }}
          >
            <defs>
              {/* Gradient Fill under Belanja curve matching reference image */}
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.22" />
                <stop offset="65%" stopColor="var(--chart-1)" stopOpacity="0.05" />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Vertical Dashed Gridlines at each data point (Key feature matching reference image) */}
            {dailyTrend.map((point, index) => {
              const posX = getX(index);
              return (
                <line
                  key={`vgrid-${point.date}`}
                  x1={posX}
                  x2={posX}
                  y1={pad.top}
                  y2={bottomY}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  className="text-zinc-200/70 dark:text-zinc-800/70"
                />
              );
            })}

            {/* Y-Axis Labels and Baseline at step 0 (Clean, uncluttered, no horizontal dashed lines) */}
            {[0, 1, 2, 3].map((step) => {
              const lineY = pad.top + (plotHeight * (3 - step)) / 3;
              const spendVal = (maxSpend * step) / 3;
              const resultVal = Math.round((maxResults * step) / 3);

              return (
                <g key={step}>
                  {/* Subtle horizontal baseline at 0 only */}
                  {step === 0 && (
                    <line
                      x1={pad.left}
                      x2={width - pad.right}
                      y1={lineY}
                      y2={lineY}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-zinc-200/80 dark:text-zinc-800/80"
                    />
                  )}
                  {/* Left Axis: Compact Spend (e.g. Rp0, Rp40rb, Rp80rb, Rp120rb) */}
                  <text
                    x={pad.left - 12}
                    y={lineY + 4}
                    textAnchor="end"
                    className="fill-[var(--chart-axis)] font-mono text-[10.5px] font-medium tabular-nums"
                  >
                    {formatCompactIdr(spendVal, uiLocale)}
                  </text>
                  {/* Right Axis: Results Count (e.g. 0, 8, 16, 24) */}
                  <text
                    x={width - pad.right + 10}
                    y={lineY + 4}
                    textAnchor="start"
                    className="fill-[var(--chart-axis)] font-mono text-[10.5px] font-medium tabular-nums"
                  >
                    {resultVal}
                  </text>
                </g>
              );
            })}

            {/* Area Fill under Belanja Polyline */}
            {spendAreaPath && (
              <path d={spendAreaPath} fill="url(#spendGradient)" />
            )}

            {/* Belanja Polyline (Primary accent with rounded joins) */}
            {spendPath && (
              <path
                d={spendPath}
                fill="none"
                style={{ stroke: "var(--chart-1)" }}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Hasil Polyline (Secondary accent with rounded joins) */}
            {resultsPath && (
              <path
                d={resultsPath}
                fill="none"
                style={{ stroke: "var(--chart-2)" }}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* X-Axis Date Labels aligned with vertical gridlines */}
            {dailyTrend.map((point, index) => {
              if (index % xAxisLabelStep !== 0 && index !== dailyTrend.length - 1) return null;
              const posX = getX(index);
              return (
                <text
                  key={point.date}
                  x={posX}
                  y={height - 14}
                  textAnchor="middle"
                  className={`font-mono text-[11px] transition-colors ${
                    hoveredIndex === index
                      ? "fill-zinc-900 font-bold dark:fill-zinc-100"
                      : "fill-[var(--chart-axis)]"
                  }`}
                >
                  {formatDateDayMonth(point.date)}
                </text>
              );
            })}

            {/* Interactive Hit-Testing Rectangles per Day */}
            {dailyTrend.map((point, index) => {
              const colW = plotWidth / Math.max(dailyTrend.length - 1, 1);
              const rectX = index === 0 ? pad.left : getX(index) - colW / 2;
              const rectWidth = index === 0 || index === dailyTrend.length - 1 ? colW / 2 : colW;
              return (
                <rect
                  key={`hit-${point.date}`}
                  x={rectX}
                  y={pad.top}
                  width={rectWidth}
                  height={plotHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onClick={() => setHoveredIndex(index)}
                  tabIndex={0}
                  aria-label={`${formatFullDate(point.date)}`}
                />
              );
            })}

            {/* Hover Vertical Guide Line and Hollow Indicator Circles (matching reference image) */}
            {hoveredIndex !== null && activePoint && (
              <g className="pointer-events-none">
                {/* Vertical Solid Guide Line */}
                <line
                  x1={activeHoverX}
                  x2={activeHoverX}
                  y1={pad.top}
                  y2={bottomY}
                  style={{ stroke: "var(--chart-crosshair)" }}
                  strokeWidth="1.8"
                />

                {/* Belanja Hollow Dot Indicator (white center with colored ring) */}
                <circle
                  cx={activeHoverX}
                  cy={activeSpendY}
                  r="5.5"
                  className="fill-white dark:fill-zinc-900"
                  style={{ stroke: "var(--chart-1)" }}
                  strokeWidth="2.5"
                />

                {/* Hasil Hollow Dot Indicator (white center with colored ring) */}
                <circle
                  cx={activeHoverX}
                  cy={activeResultsY}
                  r="5.5"
                  className="fill-white dark:fill-zinc-900"
                  style={{ stroke: "var(--chart-2)" }}
                  strokeWidth="2.5"
                />
              </g>
            )}
          </svg>

          {/* Interactive Floating Tooltip (matching reference image card) */}
          {hoveredIndex !== null && activePoint && (
            <div
              className="pointer-events-none absolute z-30 min-w-[215px] rounded-2xl border border-zinc-200/90 bg-white/95 p-3.5 text-zinc-900 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.16)] backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-100"
              style={{
                top: "16px",
                left: isRightSide
                  ? `calc(${((activeHoverX / width) * 100).toFixed(2)}% - 14px)`
                  : `calc(${((activeHoverX / width) * 100).toFixed(2)}% + 14px)`,
                transform: isRightSide ? "translateX(-100%)" : "translateX(0)",
              }}
            >
              {/* Tooltip Header: Date + Status Badge */}
              <div className="mb-2.5 flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatFullDate(activePoint.date)}
                </p>
                {activeResults > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-inset ring-emerald-600/20">
                    <span>↗</span>
                    <span>
                      {Math.round((activeResults / Math.max(1, activePoint.linkClicks)) * 100)}% CVR
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {locale === "id" ? "0 Hasil" : "0 Results"}
                  </span>
                )}
              </div>

              {/* Tooltip Metric Rows with Color Dots */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: "var(--chart-1)" }}
                    />
                    <span>{locale === "id" ? "Total Belanja" : "Total Spend"}</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatCurrencyVal(activePoint.spend)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: "var(--chart-2)" }}
                    />
                    <span>{displayResultName}</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {activeResults}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-1.5 dark:border-zinc-800/80">
                  <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>{locale === "id" ? "Biaya / Hasil" : "Cost / Result"}</span>
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {activeResults > 0
                      ? formatCurrencyVal(Math.round(activePoint.spend / activeResults))
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Bottom Legend (matching reference design bottom row, clean without heavy border) */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 pt-1 pb-4 text-xs font-medium">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "var(--chart-1)" }}
          />
          <span className="text-zinc-700 dark:text-zinc-300">
            {locale === "id" ? "Total Belanja" : "Total Spend"} ({currency || "IDR"})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "var(--chart-2)" }}
          />
          <span className="text-zinc-700 dark:text-zinc-300">
            {displayResultName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-zinc-500 dark:text-zinc-400">
            {locale === "id" ? "Biaya / Hasil (CPR)" : "Cost per Result"}
          </span>
        </div>
      </div>
    </section>
  );
}
