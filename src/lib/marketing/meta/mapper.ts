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
    accountName: metaAccount.name?.trim() || providerAccountId,
    currency: metaAccount.currency?.toUpperCase() || null,
    timezone: metaAccount.timezone_name || null,
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
 * Parses monetary spend from Meta's string representation.
 *
 * Null semantics (DI-04): a missing, empty, non-numeric, negative, or
 * non-finite value is NOT AVAILABLE and returns null. Only an explicitly
 * provided zero ("0", "0.00", 0) returns 0. Callers must distinguish
 * "Meta reported no value" from "Meta reported zero".
 */
export function parseSpend(spendStr?: string | number | null): number | null {
  if (spendStr === null || spendStr === undefined) return null;
  if (typeof spendStr === "number") {
    return Number.isFinite(spendStr) && spendStr >= 0 ? Number(spendStr.toFixed(2)) : null;
  }
  const trimmed = spendStr.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed.replace(/[^0-9.-]+/g, ""));
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Number(parsed.toFixed(2));
}

/**
 * Parses an integer metric (impressions, clicks, reach, ...) from Meta's
 * string representation. Same null semantics as parseSpend: missing or
 * invalid returns null; an explicit zero returns 0.
 */
export function parseCount(countStr?: string | number | null): number | null {
  if (countStr === null || countStr === undefined) return null;
  if (typeof countStr === "number") {
    return Number.isFinite(countStr) && countStr >= 0 ? Math.floor(countStr) : null;
  }
  const trimmed = countStr.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed.replace(/[^0-9.-]+/g, ""));
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return null;
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
    currency?: string | null;
    source?: "meta" | "demo";
  }
): NormalizedAdInsight {
  const { organizationId, adId, source = "meta" } = options;
  const currency = options.currency ?? metaInsight.account_currency ?? null;

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

  // Conversions: Prioritize CTWA messaging conversations started, record action breakdown.
  // Null semantics: when Meta provides no actions array at all, conversions are
  // NOT AVAILABLE (null) — not zero. When an actions array is present but has no
  // conversion action, Meta explicitly reported none: conversions are 0.
  const actionBreakdown: Record<string, number> = {};
  (metaInsight.actions || []).forEach((act) => {
    if (act.action_type) {
      const parsed = parseCount(act.value);
      if (parsed !== null) actionBreakdown[act.action_type] = parsed;
    }
  });
  const costPerActionType: Record<string, number> = {};
  (metaInsight.cost_per_action_type || []).forEach((act) => {
    const parsed = Number(act.value);
    if (act.action_type && Number.isFinite(parsed)) costPerActionType[act.action_type] = parsed;
  });

  const messagingAction = metaInsight.actions?.find(
    (a) =>
      a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
      a.action_type === "messaging_conversation_started_7d"
  );
  const messagingConversations = messagingAction ? parseCount(messagingAction.value) : null;

  const matchedLeadAction = metaInsight.actions?.find(
    (a) =>
      a.action_type === "lead" ||
      a.action_type === "onsite_conversion.lead_grouped" ||
      a.action_type === "offsite_conversion.fb_pixel_lead"
  );
  const leads = matchedLeadAction ? parseCount(matchedLeadAction.value) : null;

  let conversions: number | null = null;
  let conversionActionType: string | null = null;

  if (messagingConversations !== null && messagingConversations > 0) {
    conversions = messagingConversations;
    conversionActionType = "onsite_conversion.messaging_conversation_started_7d";
  } else if (leads !== null && leads > 0 && matchedLeadAction) {
    conversions = leads;
    conversionActionType = matchedLeadAction.action_type;
  } else if (messagingAction || matchedLeadAction) {
    // A conversion action was reported with a zero/unusable value.
    conversions = messagingConversations ?? leads;
  } else if (metaInsight.actions) {
    conversions = 0;
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
    // BL-01: independent result types (never merged into each other).
    // When Meta sent an actions array without this result type, the type was
    // explicitly reported as none (0); with no actions array it is unavailable.
    messagingConversations: messagingAction ? messagingConversations : metaInsight.actions ? 0 : null,
    leads: matchedLeadAction ? leads : metaInsight.actions ? 0 : null,
    adsetId: metaInsight.adset_id || null,
    adsetName: metaInsight.adset_name || null,
    attributionSetting: metaInsight.attribution_setting || null,
    currency,
    source,
    actionBreakdown,
    costPerActionType,
    conversionActionType,
    mappingVersion: "v1.1",
  };
}
