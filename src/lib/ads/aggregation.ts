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
  spend: number;
  impressions: number;
  allClicks: number;
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

function ratio(numerator: number, denominator: number | null): number | null {
  if (denominator === null || denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(2));
}

function percent(numerator: number | null, denominator: number): number | null {
  if (numerator === null || denominator <= 0) return null;
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
  let spend = 0;
  let impressions = 0;
  let allClicks = 0;
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
    spend += num(row.spend) ?? 0;
    impressions += num(row.impressions) ?? 0;
    allClicks += num(row.clicks) ?? 0;

    const link = num(row.link_clicks ?? row.linkClicks);
    if (link !== null) {
      linkClicksSum += link;
      linkClicksSeen = true;
    }
    const reach = num(row.reach);
    if (reach !== null) {
      reachSum += reach;
      reachSeen = true;
    }
    const results = num(row.conversions);
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

  spend = Math.round(spend * 100) / 100;
  const linkClicks = linkClicksSeen ? linkClicksSum : null;
  // Unique reach is only defensible for a single observation day.
  const reach = reachSeen && days.size <= 1 ? reachSum : null;
  const results = resultsSeen ? resultsSum : null;
  const messagingConversations = messagingSeen ? messagingSum : null;
  const leads = leadsSeen ? leadsSum : null;

  return {
    spend,
    impressions,
    allClicks,
    linkClicks,
    reach,
    frequency: reach !== null && reach > 0 ? Number((impressions / reach).toFixed(2)) : null,
    linkCtr: percent(linkClicks, impressions),
    linkCpc: linkClicks !== null ? ratio(spend, linkClicks) : null,
    allCtr: percent(allClicks, impressions),
    allCpc: ratio(spend, allClicks),
    cpm: impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null,
    results,
    messagingConversations,
    leads,
    costPerMessagingConversation: messagingConversations !== null ? ratio(spend, messagingConversations) : null,
    costPerLead: leads !== null ? ratio(spend, leads) : null,
    costPerResult: results !== null ? ratio(spend, results) : null,
    days: days.size,
    rowCount: rows.length,
  };
}
