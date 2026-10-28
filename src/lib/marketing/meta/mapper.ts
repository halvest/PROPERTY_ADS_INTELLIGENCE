import type {
  MetaAdAccountResponse,
  MetaCampaignResponse,
  MetaAdResponse,
  MetaInsightResponse,
  NormalizedAdAccount,
  NormalizedCampaign,
  NormalizedAd,
  NormalizedAdInsight,
} from "./types";
import { normalizeAdAccountId } from "./config";

/**
 * Maps a Meta Graph API ad account response to the internal NormalizedAdAccount model.
 */
export function mapMetaAccountToInternal(
  metaAccount: MetaAdAccountResponse,
  organizationId: string
): NormalizedAdAccount {
  const providerAccountId = normalizeAdAccountId(metaAccount.id || metaAccount.account_id);
  const status: "connected" | "disconnected" | "error" =
    metaAccount.account_status === 1 ? "connected" : "error";

  return {
    organizationId,
    provider: "meta",
    providerAccountId,
    accountName: metaAccount.name?.trim() || "Meta Ad Account",
    currency: metaAccount.currency?.toUpperCase() || "IDR",
    timezone: metaAccount.timezone_name || "Asia/Jakarta",
    connectionStatus: status,
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Maps a Meta Graph API campaign response to the internal NormalizedCampaign model.
 */
export function mapMetaCampaignToInternal(
  metaCampaign: MetaCampaignResponse,
  organizationId: string,
  adAccountId: string
): NormalizedCampaign {
  return {
    organizationId,
    adAccountId,
    providerCampaignId: metaCampaign.id,
    name: metaCampaign.name?.trim() || `Campaign ${metaCampaign.id}`,
    status: (metaCampaign.status || "ACTIVE").toUpperCase(),
    objective: metaCampaign.objective || null,
  };
}

/**
 * Maps a Meta Graph API ad response to the internal NormalizedAd model.
 */
export function mapMetaAdToInternal(
  metaAd: MetaAdResponse,
  organizationId: string,
  campaignId: string
): NormalizedAd {
  return {
    organizationId,
    campaignId,
    providerAdId: metaAd.id,
    name: metaAd.name?.trim() || `Ad ${metaAd.id}`,
    status: (metaAd.status || "ACTIVE").toUpperCase(),
  };
}

/**
 * Safely parses monetary spend from Meta string representation.
 * Always returns non-negative floating-point number.
 */
export function parseSpend(spendStr?: string | number | null): number {
  if (spendStr === null || spendStr === undefined) return 0;
  if (typeof spendStr === "number") {
    return Number.isFinite(spendStr) && spendStr > 0 ? Number(spendStr.toFixed(2)) : 0;
  }
  const parsed = parseFloat(spendStr.replace(/[^0-9.-]+/g, ""));
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Number(parsed.toFixed(2));
}

/**
 * Safely parses integer metric (impressions, clicks) from Meta string representation.
 */
export function parseCount(countStr?: string | number | null): number {
  if (countStr === null || countStr === undefined) return 0;
  if (typeof countStr === "number") {
    return Number.isFinite(countStr) && countStr > 0 ? Math.floor(countStr) : 0;
  }
  const parsed = parseFloat(countStr.replace(/[^0-9.-]+/g, ""));
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

/**
 * Maps a Meta Graph API ad insight response to the internal NormalizedAdInsight model.
 */
export function mapMetaInsightToInternal(
  metaInsight: MetaInsightResponse,
  options: {
    organizationId: string;
    adId: string;
    currency?: string;
    source?: "meta" | "demo";
  }
): NormalizedAdInsight {
  const { organizationId, adId, currency = "IDR", source = "meta" } = options;

  const spend = parseSpend(metaInsight.spend);
  const impressions = parseCount(metaInsight.impressions);
  const clicks = parseCount(metaInsight.clicks);
  const reach = parseCount(metaInsight.reach);
  
  // Link clicks: Prefer Meta's official inline_link_clicks, fallback to link_clicks or actions
  const linkClicks = parseCount(
    metaInsight.inline_link_clicks ||
      metaInsight.link_clicks ||
      metaInsight.actions?.find((a) => a.action_type === "link_click")?.value
  );

  // Conversions: Prioritize CTWA messaging conversations started, record action breakdown
  const actionBreakdown: Record<string, number> = {};
  (metaInsight.actions || []).forEach((act) => {
    if (act.action_type) {
      actionBreakdown[act.action_type] = parseCount(act.value);
    }
  });

  const messagingConversations = parseCount(
    metaInsight.actions?.find(
      (a) =>
        a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
        a.action_type === "messaging_conversation_started_7d"
    )?.value
  );

  const matchedLeadAction = metaInsight.actions?.find(
    (a) =>
      a.action_type === "lead" ||
      a.action_type === "onsite_conversion.lead_grouped" ||
      a.action_type === "offsite_conversion.fb_pixel_lead"
  );
  const leads = parseCount(matchedLeadAction?.value);

  let conversions = 0;
  let conversionActionType: string | null = null;

  if (messagingConversations > 0) {
    conversions = messagingConversations;
    conversionActionType = "onsite_conversion.messaging_conversation_started_7d";
  } else if (leads > 0 && matchedLeadAction) {
    conversions = leads;
    conversionActionType = matchedLeadAction.action_type;
  }

  return {
    organizationId,
    adId,
    dateStart: metaInsight.date_start || new Date().toISOString().split("T")[0],
    dateStop: metaInsight.date_stop || new Date().toISOString().split("T")[0],
    level: "ad",
    spend,
    impressions,
    clicks,
    reach,
    linkClicks,
    conversions,
    adsetId: metaInsight.adset_id || null,
    adsetName: metaInsight.adset_name || null,
    attributionSetting: metaInsight.attribution_setting || null,
    currency,
    source,
    actionBreakdown,
    conversionActionType,
    mappingVersion: "v1.1",
  };
}
