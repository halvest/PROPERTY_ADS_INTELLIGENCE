import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";
import type { RealAdRow } from "@/lib/ads/ad-row";
import {
  buildAccountIntelligence,
  type AccountAdInput,
  type AccountCampaignInput,
  type AccountInsightInput,
  type AccountIntelligenceReport,
} from "./engine";
import { parseDateRange } from "@/lib/ads/date-utils";

export interface BuildInstantAccountIntelligenceInput {
  accountId?: string | null;
  accountName?: string | null;
  currency?: string | null;
  timezone?: string | null;
  dateRange?: string | null;
  since?: string | null;
  until?: string | null;
  targetCpr?: number | null;
  campaigns: CampaignDetailData[];
  ads: RealAdRow[];
}

function inferPrimaryConversionActionType(ad: RealAdRow): string | null {
  const types = ad.resultActionTypes ?? [];
  if (types.some((t) => t.includes("messaging_conversation_started"))) {
    return "onsite_conversion.messaging_conversation_started_7d";
  }
  if (types.some((t) => t.includes("lead") || t === "onsite_conversion.lead_grouped")) {
    return "lead";
  }
  if (types.some((t) => t.includes("post_engagement") || t.includes("page_engagement"))) {
    return "post_engagement";
  }
  if (types.some((t) => t.includes("video_view"))) {
    return "video_view";
  }
  if (types.some((t) => t.includes("link_click"))) {
    return "link_click";
  }
  const obj = (ad.campaignObjective || "").toUpperCase();
  if (obj.includes("LEAD")) return "lead";
  if (obj === "MESSAGES" || obj.includes("ENGAGEMENT")) {
    if ((ad.conversations ?? 0) > 0) {
      return "onsite_conversion.messaging_conversation_started_7d";
    }
  }
  return types[0] ?? null;
}

/**
 * Deterministically builds the Holistic Account Intelligence v2.1 report in memory (< 2ms)
 * from the already-loaded dashboard snapshot (`campaigns` + `ads`), avoiding any blocking
 * LLM call or duplicate database round-trip when opening `/ads` or switching filters/tabs.
 */
export function buildAccountIntelligenceFromDashboardData(
  input: BuildInstantAccountIntelligenceInput
): AccountIntelligenceReport {
  const tz = input.timezone || "Asia/Jakarta";
  let periodStart = input.since || "";
  let periodEnd = input.until || "";

  if (!periodStart || !periodEnd) {
    const parsed = parseDateRange(input.dateRange || "30d", tz);
    periodStart = parsed.since || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    periodEnd = parsed.until || new Date().toISOString().slice(0, 10);
  }

  const startMs = Date.parse(`${periodStart}T00:00:00Z`);
  const endMs = Date.parse(`${periodEnd}T00:00:00Z`);
  const durationDays =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
      ? Math.max(1, Math.round((endMs - startMs) / 86400000) + 1)
      : 30;

  const campaigns: AccountCampaignInput[] = input.campaigns.map((c) => ({
    id: c.id,
    providerId: c.providerCampaignId || c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
    spend: c.spend,
  }));

  const ads: AccountAdInput[] = input.ads.map((a) => ({
    id: a.id,
    providerId: a.providerAdId || a.adId,
    name: a.adName,
    status: a.adSettingStatus,
    campaignId: a.campaignId,
    metaEffectiveStatus:
      a.deliveryStatus === "DELIVERING"
        ? "ACTIVE"
        : a.deliveryStatus === "NOT_DELIVERING"
          ? "PAUSED"
          : a.adSettingStatus,
  }));

  const insights: AccountInsightInput[] = [];

  for (const ad of input.ads) {
    const hasActivity =
      (ad.spend ?? 0) > 0 ||
      (ad.impressions ?? 0) > 0 ||
      (ad.linkClicks ?? 0) > 0 ||
      (ad.allClicks ?? 0) > 0 ||
      (ad.results ?? 0) > 0 ||
      (ad.conversations ?? 0) > 0;

    if (!ad.hasInsights && !hasActivity) continue;

    const actionType = inferPrimaryConversionActionType(ad);
    const totalResults =
      ad.conversations && ad.conversations > 0
        ? ad.conversations
        : ad.results ?? ad.resultMetricValue ?? 0;

    const breakdownForCount = (count: number | null): Record<string, number> | undefined => {
      if (count == null) return undefined;
      if (!actionType) return undefined;
      return { [actionType]: count };
    };

    if (ad.dailySeries && ad.dailySeries.length > 0) {
      for (const pt of ad.dailySeries) {
        const dayDate = pt.date && pt.date >= periodStart && pt.date <= periodEnd ? pt.date : periodEnd;
        insights.push({
          ad_id: ad.id,
          spend: pt.spend,
          impressions: pt.impressions,
          clicks: pt.allClicks,
          link_clicks: pt.linkClicks,
          reach: ad.dailySeries.length === 1 ? ad.reach : null,
          conversions: pt.results,
          action_breakdown: breakdownForCount(pt.results),
          conversion_action_type: actionType,
          date_start: dayDate,
        });
      }
    } else {
      insights.push({
        ad_id: ad.id,
        spend: ad.spend,
        impressions: ad.impressions,
        clicks: ad.allClicks,
        link_clicks: ad.linkClicks,
        reach: durationDays <= 1 ? ad.reach : null,
        conversions: totalResults,
        action_breakdown: breakdownForCount(totalResults),
        conversion_action_type: actionType,
        date_start: periodEnd,
      });
    }
  }

  return buildAccountIntelligence({
    accountId: input.accountId ?? null,
    accountName: input.accountName || "Meta Ads Account",
    currency: input.currency || "IDR",
    timezone: tz,
    periodStart,
    periodEnd,
    durationDays,
    accountCampaignTargetCpr: input.targetCpr ?? null,
    campaigns,
    ads,
    insights,
  });
}
