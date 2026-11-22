import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface InsightAggregate {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  linkClicks: number;
  conversions: number;
  conversations: number;
  resultActionTypes: string[];
  adsetId: string | null;
  adsetName: string | null;
  currency: string;
  qualityRanking: string | null;
  engagementRateRanking: string | null;
  conversionRateRanking: string | null;
}

export interface GetAdsIntelligenceOptions {
  organizationId: string;
  dateRange?: string;
  selectedCampaignId?: string | null;
  campaignStatusFilter?: string | null;
  deliveryStatusFilter?: string | null;
  objectiveFilter?: string | null;
  /** Provider ad account ID (act_...). Validated against this tenant's accounts. */
  adAccountId?: string | null;
}

export type InsightsAvailability = "available" | "no_data_for_period" | "no_account_selected";

import { formatDateInTimezone, parseDateRange } from "./date-utils";
import { aggregateAdInsights } from "./aggregation";
import { addReported, finiteNumber } from "@/lib/metrics/nullable-number";
import { resolveAdResultMetric, translateMetaTerm } from "./result-metric";
import { describeMetaAction, primaryActionType } from "@/lib/marketing/meta/action-catalog";
export { formatDateInTimezone, parseDateRange };

export interface ResultClassification {
  resultLabel: string;
  resultTypeDescription: string | null;
  isLeads: boolean;
  isConversation: boolean;
}

/**
 * Classifies ad results according to authentic Meta actions and campaign objectives.
 * Implements strict fallback: primary label "Hasil" or "Leads" or "Percakapan",
 * secondary description "Jenis hasil belum teridentifikasi" if unknown.
 * Never outputs obsolete "Hasil Meta (jenis tidak tersedia)".
 */
export function classifyResult(
  results: number,
  resultActionTypes: string[] = [],
  objective?: string | null
): ResultClassification {
  if (results <= 0) {
    return {
      resultLabel: "Hasil",
      resultTypeDescription: null,
      isLeads: false,
      isConversation: false,
    };
  }

  const obj = (objective || "").toUpperCase();
  const hasMsgAction = resultActionTypes.some((a) =>
    a.includes("messaging_conversation_started")
  );
  const hasLeadAction = resultActionTypes.some(
    (a) => a.includes("lead") || a === "onsite_conversion.lead_grouped"
  );

  if (hasMsgAction || obj === "MESSAGES") {
    return {
      resultLabel: "Percakapan",
      resultTypeDescription: "Percakapan WhatsApp Meta",
      isLeads: false,
      isConversation: true,
    };
  }

  if (hasLeadAction || obj === "OUTCOME_LEADS" || obj === "LEAD_GENERATION") {
    return {
      resultLabel: "Leads",
      resultTypeDescription: "Prospek / Leads Meta",
      isLeads: true,
      isConversation: false,
    };
  }

  if (obj === "OUTCOME_SALES") {
    return {
      resultLabel: "Hasil",
      resultTypeDescription: "Hasil Kampanye Penjualan (Sales)",
      isLeads: false,
      isConversation: false,
    };
  }

  if (obj === "OUTCOME_TRAFFIC" || obj === "LINK_CLICKS") {
    return {
      resultLabel: "Hasil",
      resultTypeDescription: "Hasil Kampanye Traffic Meta",
      isLeads: false,
      isConversation: false,
    };
  }

  if (resultActionTypes.length > 0) {
    return {
      resultLabel: "Hasil",
      resultTypeDescription: Array.from(new Set(resultActionTypes.map((action) => describeMetaAction(action).label))).join(" · "),
      isLeads: false,
      isConversation: false,
    };
  }

  return {
    resultLabel: "Hasil",
    resultTypeDescription: null,
    isLeads: false,
    isConversation: false,
  };
}

/**
 * Service function to retrieve authentic Ads Intelligence data.
 * Keeps supabase/admin out of App Router directory to satisfy architectural security invariants.
 */
export async function getAdsIntelligenceData(options: GetAdsIntelligenceOptions) {
  const {
    organizationId,
    dateRange = "all",
    selectedCampaignId,
    campaignStatusFilter,
    deliveryStatusFilter,
    objectiveFilter,
    adAccountId,
  } = options;

  const db = createAdminClient();

  // 1. Fetch Organization, Ad Account, Integration Status & Asset Selection in parallel
  const [orgRes, connectionRes, tenantAccountsRes, selectionRes] = await Promise.all([
    db.from("organizations").select("id, name").eq("id", organizationId).maybeSingle(),
    db
      .from("integration_connections")
      .select("status, last_synced_at, provider, error_message")
      .eq("organization_id", organizationId)
      .eq("provider", "meta")
      .maybeSingle(),
    db
      .from("ad_accounts")
      .select("id, provider_account_id, account_name, connection_status, last_synced_at, currency, timezone")
      .eq("organization_id", organizationId),
    db
      .from("meta_asset_selections")
      .select("ad_account_id")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const orgName = orgRes.data?.name || "Workspace";
  const lastSyncedAt = connectionRes.data?.last_synced_at || null;

  // 1b. Resolve the effective ad account for THIS tenant. Data from two
  // accounts must never be mixed: campaigns are scoped to one account.
  const tenantAccounts = tenantAccountsRes.data;
  const tenantAccountsError = tenantAccountsRes.error;
  if (tenantAccountsError) throw new Error("Gagal memuat akun iklan organisasi ini.");
  const selectionRow = selectionRes.data;

  const norm = (v?: string | null) =>
    v ? (v.startsWith("act_") ? v : `act_${v}`) : "";
  let effectiveAccount = (tenantAccounts || []).find(
    (a) => a.connection_status === "connected" &&
      norm(a.provider_account_id) === norm(selectionRow?.ad_account_id)
  );
  if (adAccountId) {
    const requested = (tenantAccounts || []).find(
      (a) => norm(a.provider_account_id) === norm(adAccountId)
    );
    if (!requested || requested.connection_status !== "connected") {
      throw new Error("FORBIDDEN_AD_ACCOUNT: Akun iklan tidak termasuk milik organisasi ini.");
    }
    effectiveAccount = requested;
  }
  const effectiveAccountId = effectiveAccount?.id || null;

  // Account reach starts now so it overlaps the campaign, ad, and insight reads.
  // Never borrow the first account's locale metadata: every account can use a
  // different timezone and currency. UTC is only a deterministic date-boundary
  // fallback when Meta did not provide a timezone.
  const timezone = effectiveAccount?.timezone || "UTC";
  const { since, until } = parseDateRange(dateRange, timezone);
  const hasSubsetFilters = [
    selectedCampaignId,
    campaignStatusFilter,
    deliveryStatusFilter,
    objectiveFilter,
  ].some((value) => Boolean(value && value !== "all"));
  const accountInsightPromise =
    effectiveAccountId && !hasSubsetFilters && since && until
      ? db
          .from("ad_account_insights")
          .select("reach, frequency")
          .eq("organization_id", organizationId)
          .eq("ad_account_id", effectiveAccountId)
          .eq("date_start", since)
          .eq("date_stop", until)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

  // 2. Query Campaigns for this Organization, scoped to the effective account
  let campaignsQuery = db
    .from("campaigns")
    .select("id, name, status, objective, provider_campaign_id, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  campaignsQuery = campaignsQuery.eq(
    "ad_account_id",
    effectiveAccountId || "00000000-0000-0000-0000-000000000000"
  );
  const { data: dbCampaigns, error: cmpError } = await campaignsQuery;

  if (cmpError) {
    throw new Error(`Gagal memuat kampanye: ${cmpError.message}`);
  }

  const campaignMap = new Map<
    string,
    {
      id: string;
      name: string;
      status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | string;
      objective: string | null;
      providerCampaignId: string;
    }
  >();

  (dbCampaigns || []).forEach((c) => {
    campaignMap.set(c.id, {
      id: c.id,
      name: c.name,
      status: (c.status || "UNKNOWN").toUpperCase(),
      objective: c.objective || null,
      providerCampaignId: c.provider_campaign_id,
    });
  });

  // 3. Query Ads for this Organization, scoped to the effective account's campaigns
  let adsQuery = db
    .from("ads")
    .select("id, name, status, provider_ad_id, campaign_id, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  const scopedCampaignIds = Array.from(campaignMap.keys());
  adsQuery = scopedCampaignIds.length
    ? adsQuery.in("campaign_id", scopedCampaignIds)
    : adsQuery.eq("campaign_id", "00000000-0000-0000-0000-000000000000");
  const { data: dbAds, error: adsError } = await adsQuery;

  if (adsError) {
    throw new Error(`Gagal memuat iklan: ${adsError.message}`);
  }

  // 4. Query Ad Insights with Date Range Filter (using Account Timezone)
  const INSIGHT_COLUMNS =
    "ad_id, adset_id, adset_name, spend, impressions, clicks, reach, link_clicks, conversions, action_breakdown, cost_per_action_type, conversion_action_type, currency, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, date_start, date_stop";
  const queryInsights = (cols: string = INSIGHT_COLUMNS) => {
    let query = db.from("ad_insights").select(cols).eq("organization_id", organizationId);
    const scopedAdIds = (dbAds || []).map((ad) => ad.id);
    // Insights are stored against internal ad IDs. Restrict at the query layer
    // to ads belonging to campaigns in the selected account so another
    // connected account cannot leak into KPIs or daily trends.
    if (!effectiveAccountId || scopedAdIds.length === 0) {
      query = query.eq("ad_id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("ad_id", scopedAdIds);
    }
    if (since && until) query = query.gte("date_start", since).lte("date_stop", until);
    return query;
  };

  let insightsRes = await queryInsights(INSIGHT_COLUMNS);
  if (insightsRes.error && (insightsRes.error.code === "PGRST204" || insightsRes.error.code === "42703")) {
    insightsRes = await queryInsights("*");
  }
  interface RawInsightRow {
    ad_id: string;
    adset_id?: string | null;
    adset_name?: string | null;
    spend?: number | null;
    impressions?: number | null;
    clicks?: number | null;
    reach?: number | null;
    link_clicks?: number | null;
    conversions?: number | null;
    action_breakdown?: unknown;
    cost_per_action_type?: unknown;
    conversion_action_type?: string | null;
    currency?: string | null;
    quality_ranking?: string | null;
    engagement_rate_ranking?: string | null;
    conversion_rate_ranking?: string | null;
    date_start?: string | null;
    date_stop?: string | null;
  }
  const rawInsights = (insightsRes.data ?? null) as RawInsightRow[] | null;
  const insError = insightsRes.error;

  if (insError) {
    throw new Error(`Gagal memuat data metrik iklan: ${insError.message}`);
  }

  let accountMetricsState: "available" | "sync_required" | "source_unavailable" | "filtered_scope" | "range_not_supported" | "no_account_selected" =
    !effectiveAccountId
      ? "no_account_selected"
      : hasSubsetFilters
        ? "filtered_scope"
        : since && until
          ? "sync_required"
          : "range_not_supported";
  let accountLevelReach: number | null = null;
  let accountLevelFrequency: number | null = null;

  // The account snapshot is requested from Meta for this exact all-days date
  // range during sync. Never infer unique reach or frequency from daily/ad
  // rows, and never reuse an account-wide value when the user narrowed scope.
  if (effectiveAccountId && !hasSubsetFilters && since && until) {
    const { data: accountInsight, error: accountInsightError } = await accountInsightPromise;

    if (accountInsightError) {
      // The app can be rolled out before its additive migration. Keep regular
      // ad metrics available and explain that account metrics need a sync.
      if (accountInsightError.code !== "PGRST205" && accountInsightError.code !== "42P01") {
        throw new Error(`Gagal memuat jangkauan dan frekuensi tingkat akun: ${accountInsightError.message}`);
      }
    } else if (accountInsight) {
      accountLevelReach = accountInsight.reach;
      accountLevelFrequency = accountInsight.frequency;
      accountMetricsState = accountInsight.reach !== null || accountInsight.frequency !== null
        ? "available"
        : "source_unavailable";
    }
  }
  const insightsState: InsightsAvailability = !effectiveAccountId
    ? "no_account_selected"
    : rawInsights && rawInsights.length > 0
      ? "available"
      : "no_data_for_period";

  // Track min and max dates observed in the actual data
  let minDate: string | null = null;
  let maxDate: string | null = null;

  (rawInsights || []).forEach((i) => {
    if (i.date_start) {
      if (!minDate || i.date_start < minDate) minDate = i.date_start;
      if (!maxDate || i.date_start > maxDate) maxDate = i.date_start;
    }
  });
  // Build daily trend for genuine time-series visualizations
  const trendMap = new Map<
    string,
    { date: string; spend: number | null; impressions: number | null; reach: number | null; linkClicks: number | null; allClicks: number | null; results: number | null; conversations: number | null }
  >();

  // If a bounded date range is specified, fill all calendar days with 0 so the timeline is continuous
  if (since && until) {
    const [sy, sm, sd] = since.split("-").map(Number);
    const [uy, um, ud] = until.split("-").map(Number);
    const cur = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(uy, um - 1, ud));
    let safetyCounter = 0;
    while (cur <= end && safetyCounter < 400) {
      const dayStr = cur.toISOString().slice(0, 10);
      trendMap.set(dayStr, {
        date: dayStr,
        spend: null,
        impressions: null,
        reach: null,
        linkClicks: null,
        allClicks: null,
        results: null,
        conversations: null,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
      safetyCounter++;
    }
  }

  // Aggregate insights by ad_id using the SHARED aggregation (AI-02):
  // spend/impressions/clicks/reach/frequency/ratios and the separated
  // messaging/leads result types are computed identically to the ad detail
  // view and both AI endpoints. Rows were already tenant- and
  // account-filtered by the queries above.
  const rowsByAd = new Map<string, NonNullable<typeof rawInsights>>();
  (rawInsights || []).forEach((i) => {
    const list = rowsByAd.get(i.ad_id) || [];
    list.push(i);
    rowsByAd.set(i.ad_id, list);
  });
  const adAggMap = new Map<string, ReturnType<typeof aggregateAdInsights>>();
  rowsByAd.forEach((rows, adId) => {
    adAggMap.set(adId, aggregateAdInsights(rows));
  });

  // Per-ad metadata that is not part of metric aggregation.
  const insightMap = new Map<string, InsightAggregate>();
  const adReachDates = new Map<string, Set<string>>();
  let currency = effectiveAccount?.currency || "";
  let untypedConversionRows = 0;

  (rawInsights || []).forEach((i) => {
    const conv = finiteNumber(i.conversions);
    if (conv !== null && conv > 0 && !i.conversion_action_type) untypedConversionRows += 1;
    if (i.currency) currency = i.currency;

    // Daily Trend Entry
    const day = i.date_start;
    if (day) {
      if (!trendMap.has(day)) {
        trendMap.set(day, {
          date: day,
          spend: null,
          impressions: null,
          reach: null,
          linkClicks: null,
          allClicks: null,
          results: null,
          conversations: null,
        });
      }
      const t = trendMap.get(day)!;
      t.spend = addReported(t.spend, i.spend);
      t.impressions = addReported(t.impressions, i.impressions);
      t.linkClicks = addReported(t.linkClicks, i.link_clicks);
      t.allClicks = addReported(t.allClicks, i.clicks);
      t.results = addReported(t.results, i.conversions);
      if (i.conversion_action_type?.includes("messaging_conversation_started")) {
        t.conversations = addReported(t.conversations, conv);
      }
    }

    if (!insightMap.has(i.ad_id)) {
      insightMap.set(i.ad_id, {
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        linkClicks: 0,
        conversions: 0,
        conversations: 0,
        resultActionTypes: [],
        adsetId: i.adset_id || null,
        adsetName: i.adset_name || null,
        currency: i.currency || currency,
        qualityRanking: i.quality_ranking || null,
        engagementRateRanking: i.engagement_rate_ranking || null,
        conversionRateRanking: i.conversion_rate_ranking || null,
      });
    }

    if (i.date_start) {
      if (!adReachDates.has(i.ad_id)) adReachDates.set(i.ad_id, new Set());
      adReachDates.get(i.ad_id)!.add(i.date_start);
    }
    const agg = insightMap.get(i.ad_id)!;
    // Metric numbers intentionally NOT accumulated here: adAggMap (shared
    // aggregation) is the single source for them. This map only carries
    // per-ad metadata (adset, rankings, result action types, conversations
    // compat derived from the conversion action type).
    if (i.conversion_action_type) {
      if (!agg.resultActionTypes.includes(i.conversion_action_type)) agg.resultActionTypes.push(i.conversion_action_type);
      if (i.conversion_action_type.includes("messaging_conversation_started") && conv !== null) {
        agg.conversations = (agg.conversations ?? 0) + conv;
      }
    }
    if (!agg.adsetId && i.adset_id) agg.adsetId = i.adset_id;
    if (!agg.adsetName && i.adset_name) agg.adsetName = i.adset_name;
    if (i.quality_ranking) agg.qualityRanking = i.quality_ranking;
    if (i.engagement_rate_ranking) agg.engagementRateRanking = i.engagement_rate_ranking;
    if (i.conversion_rate_ranking) agg.conversionRateRanking = i.conversion_rate_ranking;
  });

  const observedMinDate = minDate as string | null;
  const observedMaxDate = maxDate as string | null;
  if (!(since && until)) {
    if (observedMinDate && observedMaxDate) {
      for (const date of trendMap.keys()) {
        if (date < observedMinDate || date > observedMaxDate) trendMap.delete(date);
      }
    } else {
      trendMap.clear();
    }
  }

  // 5. Assemble Ads with Strict Status Hierarchy (Section 2: Campaign status vs Delivery status)
  const allAds = (dbAds || []).map((ad) => {
    const cmp = ad.campaign_id ? campaignMap.get(ad.campaign_id) : undefined;
    const campaignStatus = (cmp?.status || "UNKNOWN").toUpperCase();
    let campaignStatusLabel = "Tidak diketahui";
    if (campaignStatus === "ACTIVE") campaignStatusLabel = "Aktif";
    else if (campaignStatus === "PAUSED") campaignStatusLabel = "Dijeda";
    else if (campaignStatus === "ARCHIVED") campaignStatusLabel = "Diarsipkan";
    else if (campaignStatus === "DELETED") campaignStatusLabel = "Dihapus";

    const adRawStatus = (ad.status || "ACTIVE").toUpperCase();
    const adSettingStatus = (adRawStatus === "PAUSED" ? "PAUSED" : adRawStatus === "ARCHIVED" ? "ARCHIVED" : adRawStatus === "DELETED" ? "DELETED" : "ACTIVE") as "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
    const adSettingLabel = adSettingStatus === "ACTIVE" ? "Aktif" : adSettingStatus === "PAUSED" ? "Dijeda" : adSettingStatus === "ARCHIVED" ? "Diarsipkan" : "Dihapus";

    const ins = insightMap.get(ad.id) || {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reach: 0,
      linkClicks: 0,
      conversions: 0,
      conversations: 0,
      resultActionTypes: [],
      adsetId: null,
      adsetName: null,
      currency,
      qualityRanking: null,
      engagementRateRanking: null,
      conversionRateRanking: null,
    };

    // All metric numbers come from the shared aggregation for this ad.
    const agg = adAggMap.get(ad.id) ?? aggregateAdInsights([]);
    const spend = agg.spend;
    const impressions = agg.impressions;
    const reach = agg.reach;
    const allClicks = agg.allClicks;
    const linkClicks = agg.linkClicks;
    const results = agg.results;
    const conversations = agg.messagingConversations;

    // Strict Delivery Status Resolution (Section 2.B)
    let deliveryStatus: "DELIVERING" | "NOT_DELIVERING" | "UNKNOWN" = "UNKNOWN";
    let deliveryLabel = "Belum diketahui";
    let deliveryReason = "Data delivery belum tersedia";

    if (campaignStatus === "ARCHIVED" || adSettingStatus === "ARCHIVED") {
      deliveryStatus = "NOT_DELIVERING";
      deliveryLabel = "Tidak tayang";
      deliveryReason = "Diarsipkan";
    } else if (campaignStatus === "DELETED" || adSettingStatus === "DELETED") {
      deliveryStatus = "NOT_DELIVERING";
      deliveryLabel = "Tidak tayang";
      deliveryReason = "Dihapus";
    } else if (campaignStatus === "PAUSED") {
      deliveryStatus = "NOT_DELIVERING";
      deliveryLabel = "Tidak tayang";
      deliveryReason = "Campaign Dijeda";
    } else if (campaignStatus === "ACTIVE") {
      if (adSettingStatus === "PAUSED") {
        deliveryStatus = "NOT_DELIVERING";
        deliveryLabel = "Tidak tayang";
        deliveryReason = "Iklan Dijeda";
      } else if (adSettingStatus === "ACTIVE") {
        if (typeof impressions === "number" && impressions > 0) {
          deliveryStatus = "DELIVERING";
          deliveryLabel = "Menayangkan";
          deliveryReason = "Aktif Menayangkan";
        } else {
          deliveryStatus = "UNKNOWN";
          deliveryLabel = "Belum diketahui";
          deliveryReason = "Data delivery belum tersedia";
        }
      }
    }

    const linkCtr = agg.linkCtr;
    const linkCpc = agg.linkCpc;
    const allCtr = agg.allCtr;
    const allCpc = agg.allCpc;
    const cpm = agg.cpm;
    const frequency = agg.frequency;
    const resultMetric = resolveAdResultMetric({
      spend,
      impressions,
      conversions: agg.results,
      linkClicks,
      clicks: allClicks,
      objective: cmp?.objective,
    });
    const classification = classifyResult(results ?? 0, ins.resultActionTypes, cmp?.objective);
    const actionCounts: Record<string, number> = {};
    const actionCostWeighted: Record<string, number> = {};
    const actionCostWeights: Record<string, number> = {};
    const adDailyMap = new Map<
      string,
      { date: string; spend: number | null; impressions: number | null; allClicks: number | null; linkClicks: number | null; results: number | null }
    >();
    for (const row of rowsByAd.get(ad.id) || []) {
      if (row.date_start) {
        const dayEntry = adDailyMap.get(row.date_start) || {
          date: row.date_start,
          spend: null,
          impressions: null,
          allClicks: null,
          linkClicks: null,
          results: null,
        };
        dayEntry.spend = addReported(dayEntry.spend, row.spend);
        dayEntry.impressions = addReported(dayEntry.impressions, row.impressions);
        dayEntry.allClicks = addReported(dayEntry.allClicks, row.clicks);
        dayEntry.linkClicks = addReported(dayEntry.linkClicks, row.link_clicks);
        dayEntry.results = addReported(dayEntry.results, row.conversions);
        adDailyMap.set(row.date_start, dayEntry);
      }
      const counts = row.action_breakdown && typeof row.action_breakdown === "object" ? row.action_breakdown as Record<string, unknown> : {};
      const costs = (row as typeof row & { cost_per_action_type?: unknown }).cost_per_action_type;
      const costMap = costs && typeof costs === "object" ? costs as Record<string, unknown> : {};
      for (const [type, rawCount] of Object.entries(counts)) {
        const count = Number(rawCount);
        if (!Number.isFinite(count)) continue;
        actionCounts[type] = (actionCounts[type] || 0) + count;
        const cost = Number(costMap[type]);
        if (Number.isFinite(cost) && cost >= 0 && count > 0) {
          actionCostWeighted[type] = (actionCostWeighted[type] || 0) + cost * count;
          actionCostWeights[type] = (actionCostWeights[type] || 0) + count;
        }
      }
    }
    const dailySeries = Array.from(adDailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const primaryType = primaryActionType(actionCounts, cmp?.objective);
    const detailTypes = primaryType
      ? [primaryType]
      : Object.keys(actionCounts).filter((type) => !["other", "link_click"].includes(describeMetaAction(type).category) && actionCounts[type] > 0);
    const resultDetails = detailTypes.map((type) => ({
      ...describeMetaAction(type),
      count: actionCounts[type],
      costPerResult: actionCostWeights[type] ? actionCostWeighted[type] / actionCostWeights[type] : spend !== null && actionCounts[type] > 0 ? spend / actionCounts[type] : null,
    }));

    return {
      id: ad.id,
      adId: ad.id,
      adName: ad.name,
      providerAdId: ad.provider_ad_id,
      campaignId: ad.campaign_id,
      campaignName: cmp?.name || "Tanpa Kampanye",
      campaignObjective: cmp?.objective || null,
      campaignStatus,
      campaignStatusLabel,
      adSettingStatus,
      adSettingLabel,
      deliveryStatus,
      deliveryLabel,
      deliveryReason,
      adsetId: ins.adsetId,
      adsetName: ins.adsetName || "Ad Set Meta",
      spend,
      impressions,
      // Shared aggregation already returns null for multi-day reach.
      reach,
      frequency,
      results: resultDetails.length === 1 ? resultDetails[0].count : null,
      resultMetricValue: resultMetric.value,
      resultMetricLabel: resultMetric.label,
      resultMetricCostPerResult: resultMetric.costPerResult,
      resultMetricKind: resultMetric.kind,
      resultMetricUnitLabel: resultMetric.unitLabel,
      conversations,
      // BL-01 separated result types for dashboard/AI consumers.
      messagingConversations: agg.messagingConversations,
      leads: agg.leads,
      costPerMessagingConversation: agg.costPerMessagingConversation,
      costPerLead: agg.costPerLead,
      resultActionTypes: ins.resultActionTypes,
      resultLabel: classification.resultLabel,
      resultTypeDescription: classification.resultTypeDescription,
      resultDetails,
      actionCounts,
      costPerResult: resultDetails.length === 1 ? resultDetails[0].costPerResult : null,
      linkClicks,
      linkCtr,
      linkCpc,
      allClicks,
      allCtr,
      allCpc,
      cpm,
      qualityRanking: ins.qualityRanking || (ad as { quality_ranking?: string | null }).quality_ranking || null,
      engagementRateRanking: ins.engagementRateRanking || (ad as { engagement_rate_ranking?: string | null }).engagement_rate_ranking || null,
      conversionRateRanking: ins.conversionRateRanking || (ad as { conversion_rate_ranking?: string | null }).conversion_rate_ranking || null,
      createdAt: ad.created_at,
      updatedAt: ad.updated_at,
      hasInsights: rowsByAd.has(ad.id),
      dailySeries,
    };
  });

  // 6. Aggregate Campaign-Level Metrics
  const campaignsSummary = (dbCampaigns || []).map((cmp) => {
    const adsInCampaign = allAds.filter((a) => a.campaignId === cmp.id);
    const activeAdsInCampaign = adsInCampaign.filter((a) => a.deliveryStatus === "DELIVERING").length;

    let cmpSpend: number | null = null;
    let cmpImpressions: number | null = null;
    let cmpLinkClicks = 0;
    let cmpLinkClicksAvailable = adsInCampaign.some((a) => a.hasInsights);
    let cmpAllClicks: number | null = null;
    let cmpResults = 0;
    let cmpResultsAvailable = adsInCampaign.some((a) => a.hasInsights);

    adsInCampaign.forEach((a) => {
      cmpSpend = addReported(cmpSpend, a.spend);
      cmpImpressions = addReported(cmpImpressions, a.impressions);
      if (a.hasInsights && a.linkClicks === null) cmpLinkClicksAvailable = false;
      cmpLinkClicks += a.linkClicks ?? 0;
      cmpAllClicks = addReported(cmpAllClicks, a.allClicks);
      if (a.hasInsights && a.results === null) cmpResultsAvailable = false;
      cmpResults += a.results ?? 0;
    });

    const cmpLinkCtr = cmpLinkClicksAvailable && cmpImpressions !== null && cmpImpressions > 0 ? Number(((cmpLinkClicks / cmpImpressions) * 100).toFixed(2)) : null;
    const cmpLinkCpc = cmpLinkClicksAvailable && cmpLinkClicks > 0 && cmpSpend !== null ? Number((cmpSpend / cmpLinkClicks).toFixed(2)) : null;
    const cmpAllCtr = cmpAllClicks !== null && cmpImpressions !== null && cmpImpressions > 0 ? Number(((cmpAllClicks / cmpImpressions) * 100).toFixed(2)) : null;
    const cmpAllCpc = cmpAllClicks !== null && cmpAllClicks > 0 && cmpSpend !== null ? Number((cmpSpend / cmpAllClicks).toFixed(2)) : null;
    const cmpCpm = cmpImpressions !== null && cmpImpressions > 0 && cmpSpend !== null ? Number(((cmpSpend / cmpImpressions) * 1000).toFixed(2)) : null;
    const cmpCostPerResult = cmpResultsAvailable && cmpResults > 0 && cmpSpend !== null ? Number((cmpSpend / cmpResults).toFixed(2)) : null;
    // Unique reach is never summed across ads: with more than one ad there is
    // no valid unique-reach source, so it stays unavailable. A single ad keeps
    // its shared-aggregation reach/frequency (null for multi-day rows).
    const cmpReach = adsInCampaign.length === 1 ? adsInCampaign[0].reach : null;
    const cmpFrequency = adsInCampaign.length === 1 ? adsInCampaign[0].frequency : null;

    return {
      id: cmp.id,
      providerCampaignId: cmp.provider_campaign_id,
      name: cmp.name,
      status: (cmp.status || "UNKNOWN").toUpperCase(),
      objective: cmp.objective || null,
      totalAdsCount: adsInCampaign.length,
      activeAdsCount: activeAdsInCampaign,
      spend: cmpSpend === null ? null : Math.round(cmpSpend * 100) / 100,
      impressions: cmpImpressions,
      reach: cmpReach,
      frequency: cmpFrequency,
      results: cmpResultsAvailable ? cmpResults : null,
      costPerResult: cmpCostPerResult,
      linkClicks: cmpLinkClicksAvailable ? cmpLinkClicks : null,
      linkCtr: cmpLinkCtr,
      linkCpc: cmpLinkCpc,
      allClicks: cmpAllClicks,
      allCtr: cmpAllCtr,
      allCpc: cmpAllCpc,
      cpm: cmpCpm,
      hasInsights: adsInCampaign.some((a) => a.hasInsights),
    };
  });

  // 7. Apply Filters to Ads
  let filteredAds = allAds;

  if (selectedCampaignId && selectedCampaignId !== "all") {
    filteredAds = filteredAds.filter((a) => a.campaignId === selectedCampaignId);
  }

  if (campaignStatusFilter && campaignStatusFilter !== "all") {
    if (campaignStatusFilter === "all_active") {
      filteredAds = filteredAds.filter((a) => a.campaignStatus === "ACTIVE" || a.campaignStatus === "PAUSED");
    } else {
      filteredAds = filteredAds.filter((a) => a.campaignStatus === campaignStatusFilter);
    }
  }

  if (deliveryStatusFilter && deliveryStatusFilter !== "all") {
    if (deliveryStatusFilter === "all_active") {
      filteredAds = filteredAds.filter((a) => a.deliveryReason !== "Diarsipkan" && a.deliveryReason !== "Dihapus");
    } else if (deliveryStatusFilter === "DELIVERING") {
      filteredAds = filteredAds.filter((a) => a.deliveryStatus === "DELIVERING");
    } else if (deliveryStatusFilter === "NOT_DELIVERING") {
      filteredAds = filteredAds.filter((a) => a.deliveryStatus === "NOT_DELIVERING");
    } else if (deliveryStatusFilter === "CAMPAIGN_PAUSED") {
      filteredAds = filteredAds.filter((a) => a.deliveryReason === "Campaign Dijeda");
    } else if (deliveryStatusFilter === "AD_PAUSED") {
      filteredAds = filteredAds.filter((a) => a.deliveryReason === "Iklan Dijeda");
    } else if (deliveryStatusFilter === "ARCHIVED") {
      filteredAds = filteredAds.filter((a) => a.deliveryReason === "Diarsipkan");
    } else if (deliveryStatusFilter === "DELETED") {
      filteredAds = filteredAds.filter((a) => a.deliveryReason === "Dihapus");
    } else if (deliveryStatusFilter === "UNKNOWN") {
      filteredAds = filteredAds.filter((a) => a.deliveryStatus === "UNKNOWN");
    }
  }

  if (objectiveFilter && objectiveFilter !== "all") {
    filteredAds = filteredAds.filter((a) => a.campaignObjective === objectiveFilter);
  }

  const filteredAdIds = new Set(filteredAds.map((ad) => ad.id));
  const filteredTrendMap = new Map<string, { date: string; spend: number | null; impressions: number | null; reach: number | null; linkClicks: number | null; allClicks: number | null; results: number | null; conversations: number | null }>();
  trendMap.forEach((_, date) => filteredTrendMap.set(date, { date, spend: null, impressions: null, reach: null, linkClicks: null, allClicks: null, results: null, conversations: null }));
  (rawInsights || []).forEach((insight) => {
    if (!filteredAdIds.has(insight.ad_id) || !insight.date_start) return;
    const point = filteredTrendMap.get(insight.date_start);
    if (!point) return;
    point.spend = addReported(point.spend, insight.spend);
    point.impressions = addReported(point.impressions, insight.impressions);
    point.linkClicks = addReported(point.linkClicks, insight.link_clicks);
    point.allClicks = addReported(point.allClicks, insight.clicks);
    point.results = addReported(point.results, insight.conversions);
    if (insight.conversion_action_type?.includes("messaging_conversation_started")) {
      point.conversations = addReported(point.conversations, insight.conversions);
    }
  });
  const orderedFilteredTrend = Array.from(filteredTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const reportedDay = (value: number | null) => value !== null && value !== 0;
  const filteredDailyTrend = since && until
    ? orderedFilteredTrend
    : orderedFilteredTrend.filter((point) => reportedDay(point.spend) || reportedDay(point.impressions) || reportedDay(point.linkClicks) || reportedDay(point.allClicks) || reportedDay(point.results));

  // 8. Mathematically Weighted Aggregate KPIs
  let totalSpend: number | null = null;
  let totalImpressions: number | null = null;
  let totalLinkClicks = 0;
  let totalLinkClicksAvailable = filteredAds.some((a) => a.hasInsights);
  let totalAllClicks: number | null = null;
  const resultTotals = new Map<string, { label: string; category: string; count: number; weightedCost: number; costWeight: number }>();
  let totalConversations = 0;
  let totalConversationsAvailable = filteredAds.some((a) => a.hasInsights);

  filteredAds.forEach((a) => {
    totalSpend = addReported(totalSpend, a.spend);
    totalImpressions = addReported(totalImpressions, a.impressions);
    if (a.hasInsights && a.linkClicks === null) totalLinkClicksAvailable = false;
    totalLinkClicks += a.linkClicks ?? 0;
    totalAllClicks = addReported(totalAllClicks, a.allClicks);
    for (const detail of (a.resultDetails || []) as Array<{ type: string; label: string; category: string; count: number; costPerResult: number | null }>) {
      const current = resultTotals.get(detail.type) || { label: detail.label, category: detail.category, count: 0, weightedCost: 0, costWeight: 0 };
      current.count += detail.count;
      if (detail.costPerResult !== null && detail.count > 0) {
        current.weightedCost += detail.costPerResult * detail.count;
        current.costWeight += detail.count;
      }
      resultTotals.set(detail.type, current);
    }
    if (a.hasInsights && a.conversations === null) totalConversationsAvailable = false;
    totalConversations += a.conversations ?? 0;
  });

  const roundedTotalSpend = totalSpend === null ? null : Math.round(totalSpend * 100) / 100;

  const weightedLinkCtr = totalLinkClicksAvailable && totalImpressions !== null && totalImpressions > 0 ? Number(((totalLinkClicks / totalImpressions) * 100).toFixed(2)) : null;
  const weightedLinkCpc = totalLinkClicksAvailable && totalLinkClicks > 0 && roundedTotalSpend !== null ? Number((roundedTotalSpend / totalLinkClicks).toFixed(2)) : null;
  const weightedAllCtr = totalAllClicks !== null && totalImpressions !== null && totalImpressions > 0 ? Number(((totalAllClicks / totalImpressions) * 100).toFixed(2)) : null;
  const weightedAllCpc = totalAllClicks !== null && totalAllClicks > 0 && roundedTotalSpend !== null ? Number((roundedTotalSpend / totalAllClicks).toFixed(2)) : null;
  const weightedCpm = totalImpressions !== null && totalImpressions > 0 && roundedTotalSpend !== null ? Number(((roundedTotalSpend / totalImpressions) * 1000).toFixed(2)) : null;
  const resultBreakdown = Array.from(resultTotals.entries()).map(([type, item]) => ({ type, ...item, costPerResult: item.costWeight ? Number((item.weightedCost / item.costWeight).toFixed(2)) : null }));
  const totalResults = filteredDailyTrend.reduce<number | null>((sum, point) => {
    const reported = point.results !== null ? point.results : point.conversations;
    return addReported(sum, reported);
  }, null);
  const costPerResult = totalResults !== null && totalResults > 0 && roundedTotalSpend !== null ? Number((roundedTotalSpend / totalResults).toFixed(2)) : null;
  const activeCampaignsCount = campaignsSummary.filter((c) => c.status === "ACTIVE").length;
  const pausedCampaignsCount = campaignsSummary.filter((c) => c.status === "PAUSED").length;
  const archivedCampaignsCount = campaignsSummary.filter((c) => c.status === "ARCHIVED").length;
  const otherCampaignsCount = campaignsSummary.length - activeCampaignsCount - pausedCampaignsCount - archivedCampaignsCount;

  const deliveringAdsCount = allAds.filter((a) => a.deliveryStatus === "DELIVERING").length;
  const classifiedAdsCount = allAds.filter((a) => Boolean(a.campaignObjective) && a.hasInsights).length;
  const notDeliveringAdsCount = allAds.filter((a) => a.deliveryStatus === "NOT_DELIVERING").length;
  const unknownDeliveryAdsCount = allAds.filter((a) => a.deliveryStatus === "UNKNOWN").length;

  const campaignPausedAdsCount = allAds.filter((a) => a.deliveryReason === "Campaign Dijeda").length;
  const adPausedAdsCount = allAds.filter((a) => a.deliveryReason === "Iklan Dijeda").length;
  const archivedAdsCount = allAds.filter((a) => a.deliveryReason === "Diarsipkan").length;
  const deletedAdsCount = allAds.filter((a) => a.deliveryReason === "Dihapus").length;

  const topCampaignsComparison = [...campaignsSummary]
    .sort((a, b) => (b.spend ?? Number.NEGATIVE_INFINITY) - (a.spend ?? Number.NEGATIVE_INFINITY))
    .slice(0, 6);

  return {
    insightsState,
    accountMetricsState,
    organizationId,
    organizationName: orgName,
    adAccount: effectiveAccount
      ? {
          id: effectiveAccount.provider_account_id,
          name: effectiveAccount.account_name,
          currency: effectiveAccount.currency,
          status: effectiveAccount.connection_status,
          timezone: effectiveAccount.timezone,
          lastSyncedAt: effectiveAccount.last_synced_at,
        }
      : null,
    availableAdAccounts: (tenantAccounts || [])
      .filter((a) => a.connection_status === "connected")
      .map((a) => ({
        id: a.provider_account_id,
        name: a.account_name,
        status: a.connection_status,
        currency: a.currency,
        timezone: a.timezone,
        lastSyncedAt: a.last_synced_at,
        isSelected: effectiveAccount?.id === a.id,
      })),
    lastSyncedAt,
    kpis: {
      totalSpend: roundedTotalSpend,
      totalResults,
      resultBreakdown,
      totalConversations: totalConversationsAvailable ? totalConversations : null,
      resultsContainNonConversationActions: totalResults !== null && totalResults > totalConversations,
      conversationDataIncomplete: untypedConversionRows > 0,
      costPerResult,
      // Account snapshot wins. A filtered view of exactly one ad can still show
      // that ad's reach, which is already null when the ad spans multiple days.
      totalReach: accountLevelReach ?? (filteredAds.length === 1 ? filteredAds[0].reach : null),
      totalImpressions,
      frequency: accountLevelFrequency ?? (filteredAds.length === 1 ? filteredAds[0].frequency : null),
      // Legacy API field, retained for contract compatibility only. No UI or
      // test consumes it (traced 2026-10-31); it is NOT a unique reach and
      // must never be displayed as one. Removal needs a separate API change.
      totalAdReachAccumulated: null,
      linkClicks: totalLinkClicksAvailable ? totalLinkClicks : null,
      linkCtr: weightedLinkCtr,
      linkCpc: weightedLinkCpc,
      allClicks: totalAllClicks,
      allCtr: weightedAllCtr,
      allCpc: weightedAllCpc,
      cpm: weightedCpm,
      currency,
      resultLabel: resultBreakdown.length === 1 ? resultBreakdown[0].label : "Hasil",
      resultTypeDescription: resultBreakdown.slice(0, 2).map((item) => `${item.count} ${item.label}`).join(" · ") || null,
      totalCampaigns: campaignsSummary.length,
      activeCampaigns: activeCampaignsCount,
      pausedCampaigns: pausedCampaignsCount,
      archivedCampaigns: archivedCampaignsCount,
      otherCampaigns: otherCampaignsCount,
      totalAds: allAds.length,
      classifiedAds: classifiedAdsCount,
      deliveringAds: deliveringAdsCount,
      notDeliveringAds: notDeliveringAdsCount,
      unknownDeliveryAds: unknownDeliveryAdsCount,
      activeAds: deliveringAdsCount,
      campaignPausedAds: campaignPausedAdsCount,
      adPausedAds: adPausedAdsCount,
      archivedAds: archivedAdsCount,
      deletedAds: deletedAdsCount,
      pausedAds: notDeliveringAdsCount,
      filteredAdsCount: filteredAds.length,
    },
    campaigns: campaignsSummary,
    comparison: topCampaignsComparison,
    ads: filteredAds,
    // Reach is not additive across ads; these daily rows cannot represent a
    // unique account reach, so expose it as unavailable rather than a sum.
    dailyTrend: filteredDailyTrend.map((point) => ({ ...point, reach: null })),
    dateRangeContext: {
      dateRange,
      since: since || minDate || null,
      until: until || maxDate || null,
      earliestDate: minDate,
      latestDate: maxDate,
      timezone,
    },
  };
}

export interface AdDetailResponseData {
  ad: {
    id: string;
    providerAdId: string;
    name: string;
    status: string;
    adSettingStatus: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
    adSettingLabel: string;
    createdAt: string;
    updatedAt: string;
  };
  campaign: {
    id: string;
    providerCampaignId: string;
    name: string;
    status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | "UNKNOWN";
    statusLabel: string;
    objective: string | null;
    objectiveLabel: string;
  };
  delivery: {
    deliveryStatus: "DELIVERING" | "NOT_DELIVERING" | "UNKNOWN";
    deliveryLabel: string;
    deliveryReason: string;
  };
  metrics: {
    spend: number | null;
    impressions: number | null;
    /** Null when reach is unavailable or spans multiple days (unique reach cannot be summed). */
    reach: number | null;
    frequency: number | null;
    linkClicks: number | null;
    linkCtr: number | null;
    linkCpc: number | null;
    allClicks: number | null;
    allCtr: number | null;
    allCpc: number | null;
    cpm: number | null;
    results: number | null;
    resultMetricValue: number | null;
    resultMetricLabel: string;
    resultMetricCostPerResult: number | null;
    resultMetricKind: ReturnType<typeof resolveAdResultMetric>["kind"];
    resultMetricUnitLabel: string;
    resultLabel: string;
    resultTypeDescription: string | null;
    conversations: number | null;
    /** BL-01: separated result types and their per-type costs. */
    messagingConversations: number | null;
    leads: number | null;
    costPerMessagingConversation: number | null;
    costPerLead: number | null;
    resultActionTypes: string[];
    costPerResult: number | null;
    currency: string;
    dateRangeStart: string | null;
    dateRangeStop: string | null;
  };
}

/**
 * Retrieves authentic, tenant-isolated ad details, delivery reconciliation, and Meta relevance diagnostics.
 * ID can be internal database UUID or Meta provider_ad_id.
 */
export async function getAdDetailById(
  organizationId: string,
  id: string,
  options?: { dateRange?: string }
): Promise<
  | { success: true; data: AdDetailResponseData }
  | { success: false; error: string; code: "NOT_FOUND" | "FORBIDDEN" | "DB_ERROR" }
> {
  const db = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // 1. Query ad for authenticated tenant
  let tenantQuery = db
    .from("ads")
    .select("id, name, status, provider_ad_id, campaign_id, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, created_at, updated_at")
    .eq("organization_id", organizationId);

  if (isUuid) {
    tenantQuery = tenantQuery.eq("id", id);
  } else {
    tenantQuery = tenantQuery.eq("provider_ad_id", id);
  }

  const { data: ad, error: adErr } = await tenantQuery.maybeSingle();

  if (adErr) {
    return { success: false, error: `Kesalahan basis data: ${adErr.message}`, code: "DB_ERROR" };
  }

  // 2. If not found in current organization, verify whether it belongs to another organization
  if (!ad) {
    let crossQuery = db.from("ads").select("id, organization_id");
    if (isUuid) {
      crossQuery = crossQuery.eq("id", id);
    } else {
      crossQuery = crossQuery.eq("provider_ad_id", id);
    }
    const { data: crossAd } = await crossQuery.maybeSingle();

    if (crossAd && crossAd.organization_id !== organizationId) {
      return {
        success: false,
        error: "Akses ditolak: Iklan berada di luar batas tenant Anda",
        code: "FORBIDDEN",
      };
    }

    return {
      success: false,
      error: "Iklan tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  // 3. Query Parent Campaign (Authoritative Campaign Status from Meta)
  let campaign = {
    id: ad.campaign_id || "",
    providerCampaignId: "",
    name: "Tanpa Kampanye",
    status: "UNKNOWN" as "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | "UNKNOWN",
    statusLabel: "Tidak diketahui",
    objective: null as string | null,
    objectiveLabel: "",
  };

  let campaignAccountId: string | null = null;
  if (ad.campaign_id) {
    const { data: cmp } = await db
      .from("campaigns")
      .select("id, provider_campaign_id, name, status, objective, ad_account_id")
      .eq("id", ad.campaign_id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (cmp) {
      campaignAccountId = cmp.ad_account_id || null;
      const rawCmpStatus = (cmp.status || "UNKNOWN").toUpperCase();
      let cmpStatusLabel = "Tidak diketahui";
      if (rawCmpStatus === "ACTIVE") cmpStatusLabel = "Aktif";
      else if (rawCmpStatus === "PAUSED") cmpStatusLabel = "Dijeda";
      else if (rawCmpStatus === "ARCHIVED") cmpStatusLabel = "Diarsipkan";
      else if (rawCmpStatus === "DELETED") cmpStatusLabel = "Dihapus";

      campaign = {
        id: cmp.id,
        providerCampaignId: cmp.provider_campaign_id,
        name: cmp.name,
        status: rawCmpStatus as "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | "UNKNOWN",
        statusLabel: cmpStatusLabel,
        objective: cmp.objective || null,
        objectiveLabel: translateMetaTerm(cmp.objective),
      };
    }
  }

  // 4. Query Aggregated Insights for this Ad, bounded to the SAME period the
  // dashboard is showing. The account timezone comes from the ad's own
  // account (never another tenant's), matching parseDateRange on the list.
  let accountTimezone = "UTC";
  if (campaignAccountId) {
    const { data: accountRow } = await db
      .from("ad_accounts")
      .select("timezone")
      .eq("id", campaignAccountId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (accountRow?.timezone) accountTimezone = accountRow.timezone;
  }
  const detailRange = parseDateRange(options?.dateRange, accountTimezone);
  const DETAIL_INSIGHT_COLUMNS =
    "ad_id, adset_id, adset_name, spend, impressions, clicks, reach, link_clicks, conversions, action_breakdown, cost_per_action_type, conversion_action_type, currency, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, date_start, date_stop";
  const queryAdInsights = (cols: string = DETAIL_INSIGHT_COLUMNS) => {
    let query = db
      .from("ad_insights")
      .select(cols)
      .eq("ad_id", ad.id)
      .eq("organization_id", organizationId);
    if (detailRange.since && detailRange.until) {
      query = query.gte("date_start", detailRange.since).lte("date_stop", detailRange.until);
    }
    return query;
  };
  let insightsRes = await queryAdInsights(DETAIL_INSIGHT_COLUMNS);
  if (insightsRes.error && (insightsRes.error.code === "PGRST204" || insightsRes.error.code === "42703")) {
    insightsRes = await queryAdInsights("*");
  }
  interface DetailInsightRow {
    spend?: number | null;
    impressions?: number | null;
    clicks?: number | null;
    reach?: number | null;
    link_clicks?: number | null;
    conversions?: number | null;
    action_breakdown?: unknown;
    cost_per_action_type?: unknown;
    conversion_action_type?: string | null;
    currency?: string | null;
    date_start?: string | null;
    date_stop?: string | null;
  }
  const insights = (insightsRes.data ?? null) as DetailInsightRow[] | null;
  const insightError = insightsRes.error;
  if (insightError) return { success: false, error: `Gagal memuat detail metrik: ${insightError.message}`, code: "DB_ERROR" };

  // Shared aggregation (AI-02): identical math to the dashboard and AI
  // analysis. Reach is NOT summed across days; result types stay separate.
  const agg = aggregateAdInsights(insights || []);
  const spend = agg.spend;
  const impressions = agg.impressions;
  const reach = agg.reach;
  const linkClicks = agg.linkClicks;
  const allClicks = agg.allClicks;
  const results = agg.results;
  const conversations = agg.messagingConversations;
  const resultActionTypes = new Set<string>();
  let currency = "";
  let earliestDate: string | null = null;
  let latestDate: string | null = null;

  (insights || []).forEach((ins) => {
    if (ins.conversion_action_type) resultActionTypes.add(ins.conversion_action_type);
    if (ins.currency) currency = ins.currency;
    if (ins.date_start && (!earliestDate || ins.date_start < earliestDate)) earliestDate = ins.date_start;
    if (ins.date_stop && (!latestDate || ins.date_stop > latestDate)) latestDate = ins.date_stop;
  });

  const linkCtr = agg.linkCtr;
  const linkCpc = agg.linkCpc;
  const allCtr = agg.allCtr;
  const allCpc = agg.allCpc;
  const cpm = agg.cpm;
  const costPerResult = agg.costPerResult;
  const frequency = agg.frequency;
  const resultMetric = resolveAdResultMetric({ spend, impressions, conversions: results, linkClicks, clicks: allClicks, objective: campaign.objective });
  const classification = classifyResult(results ?? 0, Array.from(resultActionTypes), campaign.objective);

  // 5. Strict Status Standardization (Section 2)
  const adRawStatus = (ad.status || "ACTIVE").toUpperCase();
  const adSettingStatus = (adRawStatus === "PAUSED" ? "PAUSED" : adRawStatus === "ARCHIVED" ? "ARCHIVED" : adRawStatus === "DELETED" ? "DELETED" : "ACTIVE") as "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
  const adSettingLabel = adSettingStatus === "ACTIVE" ? "Aktif" : adSettingStatus === "PAUSED" ? "Dijeda" : adSettingStatus === "ARCHIVED" ? "Diarsipkan" : "Dihapus";

  let deliveryStatus: "DELIVERING" | "NOT_DELIVERING" | "UNKNOWN" = "UNKNOWN";
  let deliveryLabel = "Belum diketahui";
  let deliveryReason = "Data penayangan belum mencukupi";

  if (campaign.status === "ARCHIVED" || adSettingStatus === "ARCHIVED") {
    deliveryStatus = "NOT_DELIVERING";
    deliveryLabel = "Tidak tayang";
    deliveryReason = "Diarsipkan";
  } else if (campaign.status === "DELETED" || adSettingStatus === "DELETED") {
    deliveryStatus = "NOT_DELIVERING";
    deliveryLabel = "Tidak tayang";
    deliveryReason = "Dihapus";
  } else if (campaign.status === "PAUSED") {
    deliveryStatus = "NOT_DELIVERING";
    deliveryLabel = "Tidak tayang";
    deliveryReason = "Campaign Dijeda";
  } else if (campaign.status === "ACTIVE") {
    if (adSettingStatus === "PAUSED") {
      deliveryStatus = "NOT_DELIVERING";
      deliveryLabel = "Tidak tayang";
      deliveryReason = "Iklan Dijeda";
    } else if (adSettingStatus === "ACTIVE") {
      if (typeof impressions === "number" && impressions > 0) {
        deliveryStatus = "DELIVERING";
        deliveryLabel = "Menayangkan";
        deliveryReason = "Aktif Menayangkan";
      } else {
        deliveryStatus = "UNKNOWN";
        deliveryLabel = "Belum diketahui";
        deliveryReason = "Data delivery belum tersedia";
      }
    }
  }

  const responsePayload: AdDetailResponseData = {
    ad: {
      id: ad.id,
      providerAdId: ad.provider_ad_id,
      name: ad.name,
      status: ad.status,
      adSettingStatus,
      adSettingLabel,
      createdAt: ad.created_at,
      updatedAt: ad.updated_at,
    },
    campaign,
    delivery: {
      deliveryStatus,
      deliveryLabel,
      deliveryReason,
    },
    metrics: {
      spend,
      impressions,
      reach,
      frequency,
      linkClicks,
      linkCtr,
      linkCpc,
      allClicks,
      allCtr,
      allCpc,
      cpm,
      results,
      resultMetricValue: resultMetric.value,
      resultMetricLabel: resultMetric.label,
      resultMetricCostPerResult: resultMetric.costPerResult,
      resultMetricKind: resultMetric.kind,
      resultMetricUnitLabel: resultMetric.unitLabel,
      resultLabel: classification.resultLabel,
      resultTypeDescription: classification.resultTypeDescription,
      conversations,
      messagingConversations: agg.messagingConversations,
      leads: agg.leads,
      costPerMessagingConversation: agg.costPerMessagingConversation,
      costPerLead: agg.costPerLead,
      resultActionTypes: Array.from(resultActionTypes),
      costPerResult,
      currency,
      dateRangeStart: earliestDate,
      dateRangeStop: latestDate,
    },
  };

  return {
    success: true,
    data: responsePayload,
  };
}

