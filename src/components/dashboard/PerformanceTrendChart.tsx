"use client";

import React, { useState, useMemo, useRef } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface DailyTrendPoint {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
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
 * Generates a smooth cubic Bezier path from a series of points using Catmull-Rom spline interpolation.
 */
function getCubicBezierPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const tension = 0.22;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;

    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

/**
 * Creates closed area path under the curve for SVG linear gradient fills.
 */
function getAreaPath(points: Array<{ x: number; y: number }>, bottomY: number): string {
  if (points.length < 2) return "";
  const curvePath = getCubicBezierPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curvePath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
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
 * Formats IDR amounts compactly (e.g., Rp0, Rp40rb, Rp80rb, Rp120rb, Rp1,2jt).
 */
function formatCompactIdr(amount: number): string {
  if (amount === 0) return "Rp0";
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return `Rp${val % 1 === 0 ? val : val.toFixed(1)}jt`;
  }
  if (amount >= 1_000) {
    const val = amount / 1_000;
    return `Rp${val % 1 === 0 ? val : val.toFixed(0)}rb`;
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

  // Default hover is derived (penultimate point); explicit hover overrides it.
  const [hoverOverride, setHoveredIndex] = useState<number | null>(null);
  const hoveredIndex =
    hoverOverride !== null && hoverOverride < dailyTrend.length
      ? hoverOverride
      : dailyTrend.length >= 2
        ? dailyTrend.length - 2
        : dailyTrend.length === 1
          ? 0
          : null;
  const svgRef = useRef<SVGSVGElement | null>(null);

  // SVG Geometry Dimensions
  const width = 860;
  const height = 280;
  const pad = { left: 64, right: 48, top: 24, bottom: 44 };
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
  const x = (index: number) => {
    if (dailyTrend.length < 2) return pad.left + plotWidth / 2;
    return pad.left + (index / (dailyTrend.length - 1)) * plotWidth;
  };

  const ySpend = (val: number) => {
    return pad.top + plotHeight - (maxSpend > 0 ? (val / maxSpend) * plotHeight : 0);
  };

  const yResults = (val: number) => {
    return pad.top + plotHeight - (maxResults > 0 ? (val / maxResults) * plotHeight : 0);
  };

  // Plot Points
  const spendPoints = useMemo(() => {
    return dailyTrend.map((p, i) => ({ x: x(i), y: ySpend(p.spend) }));
  }, [dailyTrend, maxSpend]);

  const resultPoints = useMemo(() => {
    return dailyTrend.map((p, i) => {
      const val = p.results > 0 ? p.results : p.conversations ?? 0;
      return { x: x(i), y: yResults(val) };
    });
  }, [dailyTrend, maxResults]);

  // Smooth Bezier Curve Paths
  const spendPath = useMemo(() => getCubicBezierPath(spendPoints), [spendPoints]);
  const spendAreaPath = useMemo(() => getAreaPath(spendPoints, bottomY), [spendPoints, bottomY]);
  const resultsPath = useMemo(() => getCubicBezierPath(resultPoints), [resultPoints]);

  // Aggregate Calculations for Bottom Stats Row
  const spendTotal = useMemo(() => dailyTrend.reduce((sum, p) => sum + p.spend, 0), [dailyTrend]);
  const resultTotal = useMemo(
    () => dailyTrend.reduce((sum, p) => sum + (p.results > 0 ? p.results : p.conversations ?? 0), 0),
    [dailyTrend]
  );
  const averageSpend = dailyTrend.length > 0 ? Math.round(spendTotal / dailyTrend.length) : 0;
  const peakSpend = useMemo(
    () =>
      dailyTrend.reduce<DailyTrendPoint | null>(
        (peak, p) => (peak === null || p.spend > peak.spend ? p : peak),
        null
      ),
    [dailyTrend]
  );

  const formatCurrencyVal = (val: number) => {
    if (currency === "IDR") {
      return `Rp${Math.round(val).toLocaleString("id-ID")}`;
    }
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID", {
      style: "currency",
      currency,
    }).format(val);
  };

  // Date Formatting Helpers
  const formatDateDayMonth = (dateStr: string) => {
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
  };

  const formatFullDate = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T00:00:00Z`);
      return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateStr;
    }
  };

  // Subtitle Date Range
  const dateRangeSubtitle = useMemo(() => {
    if (dailyTrend.length === 0) return "";
    const first = formatDateDayMonth(dailyTrend[0].date);
    const last = formatDateDayMonth(dailyTrend[dailyTrend.length - 1].date);
    return `${first}–${last}`;
  }, [dailyTrend, locale]);

  const displayResultName =
    locale === "en"
      ? resultLabel === "Hasil"
        ? "Results"
        : resultLabel === "Pesan"
        ? "Messages"
        : resultLabel
      : resultLabel || "Hasil";

  // Mouse Move Event Listener for Smooth Nearest Point Snapping
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || dailyTrend.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseXRatio = (e.clientX - rect.left) / rect.width;
    const svgX = mouseXRatio * width;

    let closestIndex = 0;
    let minDistance = Infinity;
    for (let i = 0; i < dailyTrend.length; i++) {
      const pointX = x(i);
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
  const activeHoverX = hoveredIndex !== null ? x(hoveredIndex) : 0;
  const activeSpendY = hoveredIndex !== null ? ySpend(activePoint?.spend ?? 0) : 0;
  const activeResultsY = hoveredIndex !== null ? yResults(activeResults) : 0;

  // Tooltip position: position tooltip to the left if point is on the right side of the graph
  const isRightSide = hoveredIndex !== null && hoveredIndex > dailyTrend.length / 2;

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#0c0e14] ${className}`}
      aria-labelledby="daily-trend-title"
    >
      {/* 1. Card Header */}
      <div className="flex flex-col gap-2 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="daily-trend-title"
            className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            {locale === "id" ? "Tren performa harian" : "Daily performance trend"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {locale === "id"
              ? `Belanja dan hasil per hari${dateRangeSubtitle ? `, ${dateRangeSubtitle}` : ""}. Arahkan kursor ke grafik untuk detail.`
              : `Spend and results per day${dateRangeSubtitle ? `, ${dateRangeSubtitle}` : ""}. Hover over the graph for details.`}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#818cf8]" />
            <span className="text-zinc-700 dark:text-zinc-300">
              {locale === "id" ? "Belanja (IDR)" : "Spend (IDR)"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
            <span className="text-zinc-700 dark:text-zinc-300">
              {displayResultName}
            </span>
          </div>
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
        <div className="relative w-full px-2 sm:px-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full cursor-crosshair select-none"
            role="img"
            aria-label="Grafik tren performa harian"
            onMouseMove={handleMouseMove}
            onTouchMove={(e) => {
              if (e.touches.length > 0 && svgRef.current) {
                const rect = svgRef.current.getBoundingClientRect();
                const mouseXRatio = (e.touches[0].clientX - rect.left) / rect.width;
                const svgX = mouseXRatio * width;
                let closestIndex = 0;
                let minDistance = Infinity;
                for (let i = 0; i < dailyTrend.length; i++) {
                  const dist = Math.abs(svgX - x(i));
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
              {/* Gradient Fill under Belanja curve */}
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.28" />
                <stop offset="60%" stopColor="#818cf8" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels (4 Steps: 0, 1/3, 2/3, 1) */}
            {[0, 1, 2, 3].map((step) => {
              const lineY = pad.top + (plotHeight * (3 - step)) / 3;
              const spendVal = (maxSpend * step) / 3;
              const resultVal = Math.round((maxResults * step) / 3);

              return (
                <g key={step}>
                  <line
                    x1={pad.left}
                    x2={width - pad.right}
                    y1={lineY}
                    y2={lineY}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray={step === 0 ? "none" : "2 2"}
                    className="text-zinc-200 dark:text-zinc-800/80"
                  />
                  {/* Left Axis: Compact Spend (e.g. Rp0, Rp40rb, Rp80rb, Rp120rb) */}
                  <text
                    x={pad.left - 10}
                    y={lineY + 4}
                    textAnchor="end"
                    className="fill-zinc-400 font-mono text-[11px] font-medium"
                  >
                    {formatCompactIdr(spendVal)}
                  </text>
                  {/* Right Axis: Results Count (e.g. 0, 8, 16, 24) */}
                  <text
                    x={width - pad.right + 10}
                    y={lineY + 4}
                    textAnchor="start"
                    className="fill-zinc-400 font-mono text-[11px] font-medium"
                  >
                    {resultVal}
                  </text>
                </g>
              );
            })}

            {/* Area Fill under Belanja Curve */}
            {spendAreaPath && (
              <path d={spendAreaPath} fill="url(#spendGradient)" />
            )}

            {/* Belanja Curve Line (Purple/Indigo #818cf8) */}
            {spendPath && (
              <path
                d={spendPath}
                fill="none"
                stroke="#818cf8"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Hasil Curve Line (Vivid Emerald #34d399) */}
            {resultsPath && (
              <path
                d={resultsPath}
                fill="none"
                stroke="#34d399"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* X-Axis Date Labels */}
            {dailyTrend.map((point, index) => {
              const posX = x(index);
              return (
                <text
                  key={point.date}
                  x={posX}
                  y={height - 12}
                  textAnchor="middle"
                  className={`font-mono text-[11px] transition-colors ${
                    hoveredIndex === index
                      ? "fill-zinc-900 font-bold dark:fill-zinc-100"
                      : "fill-zinc-500 dark:fill-zinc-400"
                  }`}
                >
                  {formatDateDayMonth(point.date)}
                </text>
              );
            })}

            {/* Interactive Hit-Testing Rectangles per Day */}
            {dailyTrend.map((point, index) => {
              const colW = plotWidth / Math.max(dailyTrend.length - 1, 1);
              const rectX = index === 0 ? pad.left : x(index) - colW / 2;
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

            {/* Hover Vertical Dashed Snapping Line and Dots */}
            {hoveredIndex !== null && activePoint && (
              <g className="pointer-events-none">
                {/* Vertical Dashed Line */}
                <line
                  x1={activeHoverX}
                  x2={activeHoverX}
                  y1={pad.top}
                  y2={bottomY}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="dark:stroke-zinc-500"
                />

                {/* Belanja Dot Indicator */}
                <circle
                  cx={activeHoverX}
                  cy={activeSpendY}
                  r="5.5"
                  fill="#818cf8"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />

                {/* Hasil Dot Indicator */}
                <circle
                  cx={activeHoverX}
                  cy={activeResultsY}
                  r="5.5"
                  fill="#34d399"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
              </g>
            )}
          </svg>

          {/* Interactive Floating Tooltip (matching reference image) */}
          {hoveredIndex !== null && activePoint && (
            <div
              className="pointer-events-none absolute z-30 min-w-[175px] rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-2xl transition-all duration-75 text-zinc-900"
              style={{
                top: "16px",
                left: isRightSide
                  ? `calc(${((activeHoverX / width) * 100).toFixed(2)}% - 12px)`
                  : `calc(${((activeHoverX / width) * 100).toFixed(2)}% + 12px)`,
                transform: isRightSide ? "translateX(-100%)" : "translateX(0)",
              }}
            >
              <p className="mb-2 text-[13px] font-bold text-zinc-900">
                {formatFullDate(activePoint.date)}
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">
                    {locale === "id" ? "Belanja" : "Spend"}
                  </span>
                  <span className="font-semibold font-mono text-zinc-900">
                    {formatCurrencyVal(activePoint.spend)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">{displayResultName}</span>
                  <span className="font-semibold font-mono text-zinc-900">
                    {activeResults}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">
                    {locale === "id" ? "Biaya/hasil" : "Cost/result"}
                  </span>
                  <span className="font-semibold font-mono text-zinc-900">
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

      {/* 3. Bottom Summary Stats Row (4 Columns matching reference) */}
      {dailyTrend.length > 0 && (
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800/80 dark:border-zinc-800/80 sm:grid-cols-4 sm:divide-y-0">
          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Total belanja" : "Total spend"}
            </p>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {formatCurrencyVal(spendTotal)}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Rata-rata per hari" : "Avg per day"}
            </p>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {formatCurrencyVal(averageSpend)}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Puncak belanja" : "Peak spend"}
            </p>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {peakSpend ? formatCurrencyVal(peakSpend.spend) : "—"}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Total hasil" : "Total results"}
            </p>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {resultTotal.toLocaleString(locale === "en" ? "en-US" : "id-ID")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
