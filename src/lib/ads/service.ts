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
}

import { formatDateInTimezone, parseDateRange } from "./date-utils";
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
      resultTypeDescription: resultActionTypes.join(", "),
      isLeads: false,
      isConversation: false,
    };
  }

  return {
    resultLabel: "Hasil",
    resultTypeDescription: "Jenis hasil belum teridentifikasi",
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
  } = options;

  const db = createAdminClient();

  // 1. Fetch Organization, Ad Account & Integration Connection Status
  const [orgRes, adAccountRes, connectionRes] = await Promise.all([
    db.from("organizations").select("id, name").eq("id", organizationId).maybeSingle(),
    db
      .from("ad_accounts")
      .select("id, account_name, provider_account_id, connection_status, last_synced_at, currency, timezone")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    db
      .from("integration_connections")
      .select("status, last_synced_at, provider, error_message")
      .eq("organization_id", organizationId)
      .eq("provider", "meta")
      .maybeSingle(),
  ]);

  const orgName = orgRes.data?.name || "Workspace";
  const lastSyncedAt =
    adAccountRes.data?.last_synced_at ||
    connectionRes.data?.last_synced_at ||
    null;

  // 2. Query All Campaigns for this Organization (authoritative campaign statuses from Meta)
  const { data: dbCampaigns, error: cmpError } = await db
    .from("campaigns")
    .select("id, name, status, objective, provider_campaign_id, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

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

  // 3. Query All Ads for this Organization
  const { data: dbAds, error: adsError } = await db
    .from("ads")
    .select("id, name, status, provider_ad_id, campaign_id, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (adsError) {
    throw new Error(`Gagal memuat iklan: ${adsError.message}`);
  }

  // 4. Query Ad Insights with Date Range Filter (using Account Timezone)
  const timezone = adAccountRes.data?.timezone || "Asia/Jakarta";
  const { since, until } = parseDateRange(dateRange, timezone);
  const queryInsights = () => {
    let query = db.from("ad_insights").select("*").eq("organization_id", organizationId);
    if (since && until) query = query.gte("date_start", since).lte("date_stop", until);
    return query;
  };

  const { data: rawInsights, error: insError } = await queryInsights();

  if (insError) {
    throw new Error(`Gagal memuat data metrik iklan: ${insError.message}`);
  }

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
    { date: string; spend: number; impressions: number; reach: number; linkClicks: number; allClicks: number; results: number; conversations: number }
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
        spend: 0,
        impressions: 0,
        reach: 0,
        linkClicks: 0,
        allClicks: 0,
        results: 0,
        conversations: 0,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
      safetyCounter++;
    }
  }

  // Aggregate insights by ad_id
  const insightMap = new Map<string, InsightAggregate>();
  const adReachDates = new Map<string, Set<string>>();
  let currency = adAccountRes.data?.currency || "IDR";
  let untypedConversionRows = 0;

  (rawInsights || []).forEach((i) => {
    const sp = Number(i.spend) || 0;
    const imp = Number(i.impressions) || 0;
    const clk = Number(i.clicks) || 0;
    const rch = Number(i.reach) || 0;
    const lnk = Number(i.link_clicks) || 0;
    const conv = Number(i.conversions) || 0;
    if (conv > 0 && !i.conversion_action_type) untypedConversionRows += 1;
    if (i.currency) currency = i.currency;

    // Daily Trend Entry
    const day = i.date_start;
    if (day) {
      if (!trendMap.has(day)) {
        trendMap.set(day, {
          date: day,
          spend: 0,
          impressions: 0,
          reach: 0,
          linkClicks: 0,
          allClicks: 0,
          results: 0,
          conversations: 0,
        });
      }
      const t = trendMap.get(day)!;
      t.spend += sp;
      t.impressions += imp;
      t.reach += rch;
      t.linkClicks += lnk;
      t.allClicks += clk;
      t.results += conv;
      if (i.conversion_action_type?.includes("messaging_conversation_started")) t.conversations += conv;
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
    agg.spend += sp;
    agg.impressions += imp;
    agg.clicks += clk;
    agg.reach += rch;
    agg.linkClicks += lnk;
    agg.conversions += conv;
    if (i.conversion_action_type) {
      if (!agg.resultActionTypes.includes(i.conversion_action_type)) agg.resultActionTypes.push(i.conversion_action_type);
      if (i.conversion_action_type.includes("messaging_conversation_started")) agg.conversations += conv;
    }
    if (!agg.adsetId && i.adset_id) agg.adsetId = i.adset_id;
    if (!agg.adsetName && i.adset_name) agg.adsetName = i.adset_name;
    if (i.quality_ranking) agg.qualityRanking = i.quality_ranking;
    if (i.engagement_rate_ranking) agg.engagementRateRanking = i.engagement_rate_ranking;
    if (i.conversion_rate_ranking) agg.conversionRateRanking = i.conversion_rate_ranking;
  });

  const observedMinDate = minDate as string | null;
  const observedMaxDate = maxDate as string | null;
  if (observedMinDate && observedMaxDate) {
    for (const date of trendMap.keys()) {
      if (date < observedMinDate || date > observedMaxDate) trendMap.delete(date);
    }
  } else {
    trendMap.clear();
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
        if (ins.impressions > 0) {
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

    const spend = Math.round(ins.spend * 100) / 100;
    const impressions = ins.impressions;
    const reach = ins.reach;
    const allClicks = ins.clicks;
    const linkClicks = ins.linkClicks;
    const results = ins.conversions;
    const conversations = ins.conversations;

    const linkCtr = impressions > 0 ? Number(((linkClicks / impressions) * 100).toFixed(2)) : null;
    const linkCpc = linkClicks > 0 ? Number((spend / linkClicks).toFixed(2)) : null;
    const allCtr = impressions > 0 ? Number(((allClicks / impressions) * 100).toFixed(2)) : null;
    const allCpc = allClicks > 0 ? Number((spend / allClicks).toFixed(2)) : null;
    const cpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null;
    const costPerResult = results > 0 ? Number((spend / results).toFixed(2)) : null;
    // Frequency is only valid for a single-day reach. Summed daily reach over
    // multiple days is not unique reach, so frequency must be null (unknown).
    const reachDays = adReachDates.get(ad.id)?.size ?? 0;
    const frequency =
      reachDays <= 1 && reach > 0 ? Number((impressions / reach).toFixed(2)) : null;
    const classification = classifyResult(results, ins.resultActionTypes, cmp?.objective);

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
      reach,
      frequency,
      results,
      conversations,
      resultActionTypes: ins.resultActionTypes,
      resultLabel: classification.resultLabel,
      resultTypeDescription: classification.resultTypeDescription,
      costPerResult,
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
    };
  });

  // 6. Aggregate Campaign-Level Metrics
  const campaignsSummary = (dbCampaigns || []).map((cmp) => {
    const adsInCampaign = allAds.filter((a) => a.campaignId === cmp.id);
    const activeAdsInCampaign = adsInCampaign.filter((a) => a.deliveryStatus === "DELIVERING").length;

    let cmpSpend = 0;
    let cmpImpressions = 0;
    let cmpReach = 0;
    let cmpLinkClicks = 0;
    let cmpAllClicks = 0;
    let cmpResults = 0;

    adsInCampaign.forEach((a) => {
      cmpSpend += a.spend;
      cmpImpressions += a.impressions;
      cmpReach += a.reach;
      cmpLinkClicks += a.linkClicks;
      cmpAllClicks += a.allClicks;
      cmpResults += a.results;
    });

    const cmpLinkCtr = cmpImpressions > 0 ? Number(((cmpLinkClicks / cmpImpressions) * 100).toFixed(2)) : null;
    const cmpLinkCpc = cmpLinkClicks > 0 ? Number((cmpSpend / cmpLinkClicks).toFixed(2)) : null;
    const cmpAllCtr = cmpImpressions > 0 ? Number(((cmpAllClicks / cmpImpressions) * 100).toFixed(2)) : null;
    const cmpAllCpc = cmpAllClicks > 0 ? Number((cmpSpend / cmpAllClicks).toFixed(2)) : null;
    const cmpCpm = cmpImpressions > 0 ? Number(((cmpSpend / cmpImpressions) * 1000).toFixed(2)) : null;
    const cmpCostPerResult = cmpResults > 0 ? Number((cmpSpend / cmpResults).toFixed(2)) : null;
    const cmpReachDays = new Set(
      adsInCampaign.flatMap((a) => Array.from(adReachDates.get(a.id) ?? []))
    ).size;
    const cmpFrequency =
      cmpReachDays <= 1 && cmpReach > 0
        ? Number((cmpImpressions / cmpReach).toFixed(2))
        : null;

    return {
      id: cmp.id,
      providerCampaignId: cmp.provider_campaign_id,
      name: cmp.name,
      status: (cmp.status || "UNKNOWN").toUpperCase(),
      objective: cmp.objective || null,
      totalAdsCount: adsInCampaign.length,
      activeAdsCount: activeAdsInCampaign,
      spend: Math.round(cmpSpend * 100) / 100,
      impressions: cmpImpressions,
      reach: cmpReach,
      frequency: cmpFrequency,
      results: cmpResults,
      costPerResult: cmpCostPerResult,
      linkClicks: cmpLinkClicks,
      linkCtr: cmpLinkCtr,
      linkCpc: cmpLinkCpc,
      allClicks: cmpAllClicks,
      allCtr: cmpAllCtr,
      allCpc: cmpAllCpc,
      cpm: cmpCpm,
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
  const filteredTrendMap = new Map<string, { date: string; spend: number; impressions: number; reach: number; linkClicks: number; allClicks: number; results: number; conversations: number }>();
  trendMap.forEach((_, date) => filteredTrendMap.set(date, { date, spend: 0, impressions: 0, reach: 0, linkClicks: 0, allClicks: 0, results: 0, conversations: 0 }));
  (rawInsights || []).forEach((insight) => {
    if (!filteredAdIds.has(insight.ad_id) || !insight.date_start) return;
    const point = filteredTrendMap.get(insight.date_start);
    if (!point) return;
    point.spend += Number(insight.spend) || 0;
    point.impressions += Number(insight.impressions) || 0;
    point.reach += Number(insight.reach) || 0;
    point.linkClicks += Number(insight.link_clicks) || 0;
    point.allClicks += Number(insight.clicks) || 0;
    point.results += Number(insight.conversions) || 0;
    if (insight.conversion_action_type?.includes("messaging_conversation_started")) point.conversations += Number(insight.conversions) || 0;
  });
  const orderedFilteredTrend = Array.from(filteredTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const datesWithInsights = orderedFilteredTrend.filter((point) => point.spend !== 0 || point.impressions !== 0 || point.linkClicks !== 0 || point.allClicks !== 0 || point.results !== 0);
  const filteredDailyTrend = datesWithInsights.length > 0
    ? orderedFilteredTrend.filter((point) => point.date >= datesWithInsights[0].date && point.date <= datesWithInsights[datesWithInsights.length - 1].date)
    : [];

  // 8. Mathematically Weighted Aggregate KPIs
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalReach = 0;
  let totalLinkClicks = 0;
  let totalAllClicks = 0;
  let totalResults = 0;
  let totalConversations = 0;

  filteredAds.forEach((a) => {
    totalSpend += a.spend;
    totalImpressions += a.impressions;
    totalReach += a.reach;
    totalLinkClicks += a.linkClicks;
    totalAllClicks += a.allClicks;
    totalResults += a.results;
    totalConversations += a.conversations;
  });

  totalSpend = Math.round(totalSpend * 100) / 100;

  const weightedLinkCtr = totalImpressions > 0 ? Number(((totalLinkClicks / totalImpressions) * 100).toFixed(2)) : null;
  const weightedLinkCpc = totalLinkClicks > 0 ? Number((totalSpend / totalLinkClicks).toFixed(2)) : null;
  const weightedAllCtr = totalImpressions > 0 ? Number(((totalAllClicks / totalImpressions) * 100).toFixed(2)) : null;
  const weightedAllCpc = totalAllClicks > 0 ? Number((totalSpend / totalAllClicks).toFixed(2)) : null;
  const weightedCpm = totalImpressions > 0 ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2)) : null;
  const costPerResult = totalResults > 0 ? Number((totalSpend / totalResults).toFixed(2)) : null;
  const totalReachDays = new Set(
    filteredAds.flatMap((a) => Array.from(adReachDates.get(a.id) ?? []))
  ).size;
  const frequency =
    totalReachDays <= 1 && totalReach > 0
      ? Number((totalImpressions / totalReach).toFixed(2))
      : null;

  const activeCampaignsCount = campaignsSummary.filter((c) => c.status === "ACTIVE").length;
  const pausedCampaignsCount = campaignsSummary.filter((c) => c.status === "PAUSED").length;
  const archivedCampaignsCount = campaignsSummary.filter((c) => c.status === "ARCHIVED").length;
  const otherCampaignsCount = campaignsSummary.length - activeCampaignsCount - pausedCampaignsCount - archivedCampaignsCount;

  const deliveringAdsCount = allAds.filter((a) => a.deliveryStatus === "DELIVERING").length;
  const notDeliveringAdsCount = allAds.filter((a) => a.deliveryStatus === "NOT_DELIVERING").length;
  const unknownDeliveryAdsCount = allAds.filter((a) => a.deliveryStatus === "UNKNOWN").length;

  const campaignPausedAdsCount = allAds.filter((a) => a.deliveryReason === "Campaign Dijeda").length;
  const adPausedAdsCount = allAds.filter((a) => a.deliveryReason === "Iklan Dijeda").length;
  const archivedAdsCount = allAds.filter((a) => a.deliveryReason === "Diarsipkan").length;
  const deletedAdsCount = allAds.filter((a) => a.deliveryReason === "Dihapus").length;

  const topCampaignsComparison = [...campaignsSummary]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6);

  return {
    organizationId,
    organizationName: orgName,
    adAccount: adAccountRes.data
      ? {
          id: adAccountRes.data.provider_account_id,
          name: adAccountRes.data.account_name,
          currency: adAccountRes.data.currency,
          status: adAccountRes.data.connection_status,
          timezone: adAccountRes.data.timezone,
        }
      : null,
    lastSyncedAt,
    kpis: {
      totalSpend,
      totalResults,
      totalConversations,
      resultsContainNonConversationActions: totalResults > totalConversations,
      conversationDataIncomplete: untypedConversionRows > 0,
      costPerResult,
      totalReach,
      totalImpressions,
      frequency,
      totalAdReachAccumulated: totalReach,
      linkClicks: totalLinkClicks,
      linkCtr: weightedLinkCtr,
      linkCpc: weightedLinkCpc,
      allClicks: totalAllClicks,
      allCtr: weightedAllCtr,
      allCpc: weightedAllCpc,
      cpm: weightedCpm,
      currency,
      resultLabel: totalConversations === totalResults && totalResults > 0 ? "Percakapan" : "Hasil",
      resultTypeDescription: untypedConversionRows > 0 && totalResults > 0 ? "Sebagian jenis hasil belum teridentifikasi" : null,
      totalCampaigns: campaignsSummary.length,
      activeCampaigns: activeCampaignsCount,
      pausedCampaigns: pausedCampaignsCount,
      archivedCampaigns: archivedCampaignsCount,
      otherCampaigns: otherCampaignsCount,
      totalAds: allAds.length,
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
    dailyTrend: filteredDailyTrend,
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
  };
  delivery: {
    deliveryStatus: "DELIVERING" | "NOT_DELIVERING" | "UNKNOWN";
    deliveryLabel: string;
    deliveryReason: string;
  };
  metrics: {
    spend: number;
    impressions: number;
    reach: number;
    frequency: number | null;
    linkClicks: number;
    linkCtr: number | null;
    linkCpc: number | null;
    allClicks: number;
    allCtr: number | null;
    allCpc: number | null;
    cpm: number | null;
    results: number;
    resultLabel: string;
    resultTypeDescription: string | null;
    conversations: number;
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
export async function getAdDetailById(organizationId: string, id: string): Promise<
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
  };

  if (ad.campaign_id) {
    const { data: cmp } = await db
      .from("campaigns")
      .select("id, provider_campaign_id, name, status, objective")
      .eq("id", ad.campaign_id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (cmp) {
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
      };
    }
  }

  // 4. Query Aggregated Insights for this Ad
  const queryAdInsights = () => db
    .from("ad_insights")
    .select("*")
    .eq("ad_id", ad.id)
    .eq("organization_id", organizationId);
  const { data: insights, error: insightError } = await queryAdInsights();
  if (insightError) return { success: false, error: `Gagal memuat detail metrik: ${insightError.message}`, code: "DB_ERROR" };

  let spend = 0;
  let impressions = 0;
  let reach = 0;
  let linkClicks = 0;
  let allClicks = 0;
  let results = 0;
  let conversations = 0;
  const resultActionTypes = new Set<string>();
  const reachDates = new Set<string>();
  let currency = "IDR";
  let earliestDate: string | null = null;
  let latestDate: string | null = null;

  (insights || []).forEach((ins) => {
    spend += Number(ins.spend) || 0;
    impressions += Number(ins.impressions) || 0;
    reach += Number(ins.reach) || 0;
    linkClicks += Number(ins.link_clicks) || 0;
    allClicks += Number(ins.clicks) || 0;
    results += Number(ins.conversions) || 0;
    if (ins.conversion_action_type) {
      resultActionTypes.add(ins.conversion_action_type);
      if (ins.conversion_action_type.includes("messaging_conversation_started")) conversations += Number(ins.conversions) || 0;
    }
    if (ins.currency) currency = ins.currency;

    if (ins.date_start) {
      reachDates.add(ins.date_start);
      if (!earliestDate || ins.date_start < earliestDate) earliestDate = ins.date_start;
    }
    if (ins.date_stop) {
      if (!latestDate || ins.date_stop > latestDate) latestDate = ins.date_stop;
    }
  });

  spend = Math.round(spend * 100) / 100;
  const linkCtr = impressions > 0 ? Number(((linkClicks / impressions) * 100).toFixed(2)) : null;
  const linkCpc = linkClicks > 0 ? Number((spend / linkClicks).toFixed(2)) : null;
  const allCtr = impressions > 0 ? Number(((allClicks / impressions) * 100).toFixed(2)) : null;
  const allCpc = allClicks > 0 ? Number((spend / allClicks).toFixed(2)) : null;
  const cpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null;
  const costPerResult = results > 0 ? Number((spend / results).toFixed(2)) : null;
  const frequency =
    reachDates.size <= 1 && reach > 0 ? Number((impressions / reach).toFixed(2)) : null;
  const classification = classifyResult(results, Array.from(resultActionTypes), campaign.objective);

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
      if (impressions > 0 || (insights && insights.length > 0)) {
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
      resultLabel: classification.resultLabel,
      resultTypeDescription: classification.resultTypeDescription,
      conversations,
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

