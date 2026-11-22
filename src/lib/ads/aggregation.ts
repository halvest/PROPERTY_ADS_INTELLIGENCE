/**
 * Shared ad-insight aggregation — the single source of truth for Meta Ads
 * performance math used by the dashboard, ad detail, and AI analysis.
 *
 * Rules (Phase 1 + Phase 2):
 * - Missing values stay null; they are never silently coerced to 0.
 * - Explicit zeros reported by Meta stay 0.
 * - Derived ratios return null when their denominator is 0 or unavailable.
 * - Reach is a unique metric: summing daily reach across multiple days does
 *   NOT produce a unique reach, so multi-day reach is null (unavailable).
 * - Messaging conversations and leads are separate result types (BL-01).
 *   They are derived per row from the stored Meta action breakdown and are
 *   never merged into one another. The legacy combined `results`
 *   (conversions) is retained only for backward compatibility.
 */

import { finiteNumber } from "@/lib/metrics/nullable-number";

export interface AdInsightRowLike {
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  reach?: number | null;
  link_clicks?: number | null;
  linkClicks?: number | null;
  conversions?: number | null;
  action_breakdown?: unknown;
  conversion_action_type?: string | null;
  date_start?: string | null;
}

export interface AdMetricsAggregate {
  spend: number | null;
  impressions: number | null;
  allClicks: number | null;
  /** Null when no row reported link clicks. */
  linkClicks: number | null;
  /** Null when unavailable or when rows span more than one day. */
  reach: number | null;
  frequency: number | null;
  linkCtr: number | null;
  linkCpc: number | null;
  allCtr: number | null;
  allCpc: number | null;
  cpm: number | null;
  /** Legacy combined conversions (messaging-priority). Compatibility only. */
  results: number | null;
  messagingConversations: number | null;
  leads: number | null;
  costPerMessagingConversation: number | null;
  costPerLead: number | null;
  /** Legacy combined cost per result. Prefer the per-type costs. */
  costPerResult: number | null;
  /** Distinct observation days present in the rows. */
  days: number;
  rowCount: number;
}

const MESSAGING_KEYS = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
] as const;

const LEAD_KEYS = [
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "lead",
] as const;

function num(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(2));
}

function percent(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function asBreakdown(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = num(typeof raw === "number" ? raw : Number(raw));
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}

/** Per-row messaging conversations from the Meta action breakdown. */
export function messagingFromRow(row: AdInsightRowLike): number | null {
  const breakdown = asBreakdown(row.action_breakdown);
  if (breakdown) {
    for (const key of MESSAGING_KEYS) {
      const value = num(breakdown[key]);
      if (value !== null) return value;
    }
    if (Object.keys(breakdown).length > 0) return 0;
  }
  if (row.conversion_action_type && MESSAGING_KEYS.some((k) => row.conversion_action_type?.includes(k))) {
    return num(row.conversions);
  }
  return null;
}

/** Per-row leads from the Meta action breakdown (first matching lead type wins; never summed across types). */
export function leadsFromRow(row: AdInsightRowLike): number | null {
  const breakdown = asBreakdown(row.action_breakdown);
  if (breakdown) {
    for (const key of LEAD_KEYS) {
      const value = num(breakdown[key]);
      if (value !== null) return value;
    }
    if (Object.keys(breakdown).length > 0) return 0;
  }
  if (row.conversion_action_type && LEAD_KEYS.some((k) => row.conversion_action_type === k)) {
    return num(row.conversions);
  }
  return null;
}

export function aggregateAdInsights(rows: AdInsightRowLike[]): AdMetricsAggregate {
  let spend: number | null = null;
  let impressions: number | null = null;
  let allClicks: number | null = null;
  let linkClicksSum = 0;
  let linkClicksSeen = false;
  let reachSum = 0;
  let reachSeen = false;
  let resultsSum = 0;
  let resultsSeen = false;
  let messagingSum = 0;
  let messagingSeen = false;
  let leadsSum = 0;
  let leadsSeen = false;
  const days = new Set<string>();

  for (const row of rows) {
    const reportedSpend = finiteNumber(row.spend);
    const reportedImpressions = finiteNumber(row.impressions);
    const reportedClicks = finiteNumber(row.clicks);
    if (reportedSpend !== null) spend = (spend ?? 0) + reportedSpend;
    if (reportedImpressions !== null) impressions = (impressions ?? 0) + reportedImpressions;
    if (reportedClicks !== null) allClicks = (allClicks ?? 0) + reportedClicks;

    const link = finiteNumber(row.link_clicks ?? row.linkClicks);
    if (link !== null) {
      linkClicksSum += link;
      linkClicksSeen = true;
    }
    const reach = finiteNumber(row.reach);
    if (reach !== null) {
      reachSum += reach;
      reachSeen = true;
    }
    const results = finiteNumber(row.conversions);
    if (results !== null) {
      resultsSum += results;
      resultsSeen = true;
    }
    const messaging = messagingFromRow(row);
    if (messaging !== null) {
      messagingSum += messaging;
      messagingSeen = true;
    }
    const leads = leadsFromRow(row);
    if (leads !== null) {
      leadsSum += leads;
      leadsSeen = true;
    }
    const day = row.date_start ? String(row.date_start).slice(0, 10) : "";
    if (day) days.add(day);
  }

  const roundedSpend = spend === null ? null : Math.round(spend * 100) / 100;
  const linkClicks = linkClicksSeen ? linkClicksSum : null;
  // Unique reach is only defensible for a single observation day.
  const reach = reachSeen && days.size <= 1 ? reachSum : null;
  const results = resultsSeen ? resultsSum : null;
  const messagingConversations = messagingSeen ? messagingSum : null;
  const leads = leadsSeen ? leadsSum : null;

  return {
    spend: roundedSpend,
    impressions,
    allClicks,
    linkClicks,
    reach,
    frequency: reach !== null && reach > 0 && impressions !== null ? Number((impressions / reach).toFixed(2)) : null,
    linkCtr: percent(linkClicks, impressions),
    linkCpc: ratio(roundedSpend, linkClicks),
    allCtr: percent(allClicks, impressions),
    allCpc: ratio(roundedSpend, allClicks),
    cpm: impressions !== null && impressions > 0 && roundedSpend !== null ? Number(((roundedSpend / impressions) * 1000).toFixed(2)) : null,
    results,
    messagingConversations,
    leads,
    costPerMessagingConversation: ratio(roundedSpend, messagingConversations),
    costPerLead: ratio(roundedSpend, leads),
    costPerResult: ratio(roundedSpend, results),
    days: days.size,
    rowCount: rows.length,
  };
}

export type PrimaryResultKind = "messaging" | "leads" | "legacy";

export interface PrimaryResultSelection {
  kind: PrimaryResultKind;
  count: number | null;
  cost: number | null;
  label: string;
}

/**
 * CTWA decision metric. Messaging conversations are the ad result.
 * Lead and pixel counts stay on the aggregate and are not selected here.
 */
export function selectPrimaryResult(agg: AdMetricsAggregate, objective?: string | null): PrimaryResultSelection {
  const normObjective = (objective || "").toUpperCase();
  const hasMessaging = agg.messagingConversations !== null && agg.messagingConversations > 0;
  const hasLeads = agg.leads !== null && agg.leads > 0;

  if (normObjective.includes("LEAD") && (hasLeads || !hasMessaging)) {
    return {
      kind: "leads",
      count: agg.leads ?? agg.results,
      cost: agg.costPerLead ?? agg.costPerResult,
      label: "Leads (Meta)",
    };
  }
  if (hasLeads && !hasMessaging) {
    return {
      kind: "leads",
      count: agg.leads,
      cost: agg.costPerLead,
      label: "Leads (Meta)",
    };
  }
  if (agg.messagingConversations !== null) {
    return {
      kind: "messaging",
      count: agg.messagingConversations,
      cost: agg.costPerMessagingConversation,
      label: "Percakapan Pesan (CTWA)",
    };
  }
  if (agg.leads !== null) {
    return {
      kind: "leads",
      count: agg.leads,
      cost: agg.costPerLead,
      label: "Leads (Meta)",
    };
  }
  return {
    kind: "legacy",
    count: agg.results,
    cost: agg.costPerResult,
    label: "Hasil Konversi",
  };
}

export function enumerateInclusiveDates(since: string, until: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || since > until) return [];
  const dates: string[] = [];
  const cursor = new Date(`${since}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export interface ZeroFilledDailyTrends {
  spend: Array<number | null>;
  results: Array<number | null>;
  cpr: Array<number | null>;
  ctr: Array<number | null>;
}

/**
 * Calendar alignment for a range that already contains reported insight rows.
 * A day with no row stays 0 only when some other day in the range reported a
 * value, matching the existing chart contract. An empty series, or a metric
 * that was never reported, stays null. CTR and CPR stay null when the
 * denominator is missing or zero.
 */
export function buildZeroFilledDailyTrends(
  rows: AdInsightRowLike[],
  since: string,
  until: string,
  resultOf: (row: AdInsightRowLike) => number | null = (row) => finiteNumber(row.conversions)
): ZeroFilledDailyTrends {
  const dates = enumerateInclusiveDates(since, until);
  const daily = new Map<string, { spend: number | null; results: number | null; clicks: number | null; impressions: number | null }>();
  let anySpend = false;
  let anyResults = false;
  for (const row of rows) {
    const day = row.date_start ? String(row.date_start).slice(0, 10) : "";
    if (!day || (dates.length > 0 && (day < since || day > until))) continue;
    const bucket = daily.get(day) || { spend: null, results: null, clicks: null, impressions: null };
    const spend = finiteNumber(row.spend);
    const results = resultOf(row);
    const clicks = finiteNumber(row.link_clicks ?? row.linkClicks);
    const impressions = finiteNumber(row.impressions);
    if (spend !== null) {
      bucket.spend = (bucket.spend ?? 0) + spend;
      anySpend = true;
    }
    if (results !== null) {
      bucket.results = (bucket.results ?? 0) + results;
      anyResults = true;
    }
    if (clicks !== null) bucket.clicks = (bucket.clicks ?? 0) + clicks;
    if (impressions !== null) bucket.impressions = (bucket.impressions ?? 0) + impressions;
    daily.set(day, bucket);
  }
  const spend: Array<number | null> = [];
  const results: Array<number | null> = [];
  const cpr: Array<number | null> = [];
  const ctr: Array<number | null> = [];
  for (const day of dates) {
    const item = daily.get(day);
    const daySpend = item?.spend ?? (anySpend ? 0 : null);
    const dayResults = item?.results ?? (anyResults ? 0 : null);
    const dayClicks = item?.clicks ?? null;
    const dayImpressions = item?.impressions ?? null;
    spend.push(daySpend === null ? null : Math.round(daySpend));
    results.push(dayResults);
    cpr.push(daySpend !== null && dayResults !== null && dayResults > 0 ? Math.round(daySpend / dayResults) : null);
    ctr.push(
      dayClicks !== null && dayImpressions !== null && dayImpressions > 0
        ? Number(((dayClicks / dayImpressions) * 100).toFixed(2))
        : null
    );
  }
  return { spend, results, cpr, ctr };
}
