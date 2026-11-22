import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateCPQL,
} from "@/domain/metrics/marketing";
import { calendarDayBounds } from "@/lib/crm/crm-analysis-context";
import { qualifyCrmTemperature } from "@/lib/leads/qualified";
import { finiteNumber } from "@/lib/metrics/nullable-number";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { AttributionStatus } from "@/domain/attribution/types";
import type {
  DashboardKPISummary,
  AdLeaderboardItem,
  LeadListItem,
} from "./types";

export type LiveDashboardState =
  | "not_connected"
  | "awaiting_permissions"
  | "initial_sync_pending"
  | "syncing"
  | "connected_with_data"
  | "no_data_for_period"
  | "stale_data"
  | "token_expired"
  | "error";

export interface LiveDashboardResponse {
  state: LiveDashboardState;
  /** Kept for API compatibility; live dashboard data is never synthetic. */
  isDemoMode: false;
  organizationId: string;
  organizationName: string;
  selectedAdAccount: {
    id: string;
    name?: string | null;
  } | null;
  summary: DashboardKPISummary | null;
  leaderboard: AdLeaderboardItem[];
  leads: LeadListItem[];
  funnelCounts: Record<FunnelStage, number>;
  lastSyncedAt: string | null;
  errorMessage?: string | null;
}

import { parseDateRange } from "@/lib/ads/date-utils";

export interface GetLiveDashboardOptions {
  organizationId: string;
  supabaseClient: SupabaseClient;
  dateRange?: string; // 'all' | '30d' | '14d' | '7d' | 'today' | 'yesterday' | 'this_month' | 'last_month' | custom
}

const parseDateRangeToFilter = (dr?: string) => parseDateRange(dr, "Asia/Jakarta");

/**
 * Loads authentic, persisted business metrics for the specified tenant organization.
 * Strictly adheres to Non-negotiable Rules:
 * 1. Never invents metrics or falls back silently to mock data in production.
 * 2. Reads persisted records through authenticated tenant context.
 * 3. Returns honest integration states (not_connected, initial_sync_pending, no_data_for_period, etc.).
 * 4. Has no demo data path.
 */
export async function getLiveDashboardData(
  options: GetLiveDashboardOptions
): Promise<LiveDashboardResponse> {
  const { organizationId, supabaseClient, dateRange = "all" } = options;

  // 1. Fetch organization metadata
  const { data: orgData } = await supabaseClient
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  const orgName = orgData?.name || "Workspace";

  // 2. Query canonical integration_connections for Meta
  const { data: metaConnection } = await supabaseClient
    .from("integration_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "meta")
    .maybeSingle();

  // Query selected asset configuration
  const { data: assetSelection } = await supabaseClient
    .from("meta_asset_selections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  // Query ad_accounts
  const { data: selectedAccountRow } = await supabaseClient
    .from("ad_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider_account_id", assetSelection?.ad_account_id || "__no_selected_account__")
    .maybeSingle();
  const activeAdAccount = selectedAccountRow?.connection_status === "connected"
    ? selectedAccountRow
    : null;

  const selectedAccountInfo = activeAdAccount
    ? { id: activeAdAccount.provider_account_id, name: activeAdAccount.account_name }
    : assetSelection
    ? { id: assetSelection.ad_account_id, name: assetSelection.ad_account_name }
    : null;

  // Determine connection health state
  if (!metaConnection || metaConnection.status === "disconnected") {
    return {
      state: "not_connected",
      isDemoMode: false,
      organizationId,
      organizationName: orgName,
      selectedAdAccount: selectedAccountInfo,
      summary: null,
      leaderboard: [],
      leads: [],
      funnelCounts: { baru: 0, dihubungi: 0, prospek: 0, survei: 0, closing: 0, batal: 0 },
      lastSyncedAt: null,
    };
  }

  if (metaConnection.status === "error") {
    return {
      state: "error",
      isDemoMode: false,
      organizationId,
      organizationName: orgName,
      selectedAdAccount: selectedAccountInfo,
      summary: null,
      leaderboard: [],
      leads: [],
      funnelCounts: { baru: 0, dihubungi: 0, prospek: 0, survei: 0, closing: 0, batal: 0 },
      lastSyncedAt: metaConnection.last_synced_at,
      errorMessage: metaConnection.error_message || "Meta API connection error",
    };
  }

  // Check token expiration
  if (metaConnection.token_expires_at) {
    const expiresAt = new Date(metaConnection.token_expires_at).getTime();
    if (Date.now() > expiresAt) {
      return {
        state: "token_expired",
        isDemoMode: false,
        organizationId,
        organizationName: orgName,
        selectedAdAccount: selectedAccountInfo,
        summary: null,
        leaderboard: [],
        leads: [],
        funnelCounts: { baru: 0, dihubungi: 0, prospek: 0, survei: 0, closing: 0, batal: 0 },
        lastSyncedAt: metaConnection.last_synced_at,
        errorMessage: "Token otorisasi Meta telah kedaluwarsa. Silakan lakukan otorisasi ulang.",
      };
    }
  }

  // Check initial sync status
  if (!activeAdAccount || !metaConnection.last_synced_at) {
    return {
      state: "initial_sync_pending",
      isDemoMode: false,
      organizationId,
      organizationName: orgName,
      selectedAdAccount: selectedAccountInfo,
      summary: null,
      leaderboard: [],
      leads: [],
      funnelCounts: { baru: 0, dihubungi: 0, prospek: 0, survei: 0, closing: 0, batal: 0 },
      lastSyncedAt: null,
    };
  }

  // 3. Query Real Ad Insights for the selected account only.
  // A filter on the embedded campaigns resource does not restrict parent
  // insight rows, so another connected account leaks into the KPIs and the
  // leaderboard. Scope by the account's own ad ids, the same way the ads page does.
  const { since, until } = parseDateRangeToFilter(dateRange);

  const { data: accountCampaignRows, error: campaignErr } = await supabaseClient
    .from("campaigns")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", activeAdAccount.id);
  if (campaignErr) {
    return {
      state: "error",
      isDemoMode: false,
      organizationId,
      organizationName: orgName,
      selectedAdAccount: selectedAccountInfo,
      summary: null,
      leaderboard: [],
      leads: [],
      funnelCounts: { baru: 0, dihubungi: 0, prospek: 0, survei: 0, closing: 0, batal: 0 },
      lastSyncedAt: metaConnection.last_synced_at,
      errorMessage: `Database query error: ${campaignErr.message}`,
    };
  }
  const accountCampaignIds = new Set((accountCampaignRows || []).map((campaign) => campaign.id));

  let scopedAdIds: string[] = [];
  if (accountCampaignIds.size > 0) {
    const { data: scopedAdRows, error: scopedAdErr } = await supabaseClient
      .from("ads")
      .select("id")
      .eq("organization_id", organizationId)
      .in("campaign_id", Array.from(accountCampaignIds));
    if (scopedAdErr) {
      return {
        state: "error",
        isDemoMode: false,
        organizationId,
        organizationName: orgName,
        selectedAdAccount: selectedAccountInfo,
        summary: null,
        leaderboard: [],
        leads: [],
        funnelCounts: { baru: 0, dihubungi: 0, prospek: 0, survei: 0, closing: 0, batal: 0 },
        lastSyncedAt: metaConnection.last_synced_at,
        errorMessage: `Database query error: ${scopedAdErr.message}`,
      };
    }
    scopedAdIds = (scopedAdRows || []).map((row) => row.id);
  }

  let insightsQuery = supabaseClient
    .from("ad_insights")
    .select("*, ads!inner(id, name, status, campaign_id, campaigns(id, name))")
    .eq("organization_id", organizationId);
  insightsQuery = scopedAdIds.length
    ? insightsQuery.in("ad_id", scopedAdIds)
    : insightsQuery.eq("ad_id", "00000000-0000-0000-0000-000000000000");

  if (since && until) {
    insightsQuery = insightsQuery.gte("date_start", since).lte("date_stop", until);
  }

  const { data: rawInsights, error: insError } = await insightsQuery;

  if (insError) {
    return {
      state: "error",
      isDemoMode: false,
      organizationId,
      organizationName: orgName,
      selectedAdAccount: selectedAccountInfo,
      summary: null,
      leaderboard: [],
      leads: [],
      funnelCounts: { baru: 0, dihubungi: 0, prospek: 0, survei: 0, closing: 0, batal: 0 },
      lastSyncedAt: metaConnection.last_synced_at,
      errorMessage: `Database query error: ${insError.message}`,
    };
  }

  // 4. Query Real Conversations & Leads
  let convsQuery = supabaseClient
    .from("conversations")
    .select(`
      id,
      attribution_status,
      ad_id,
      campaign_id,
      quality_label,
      channel,
      attribution_evidence,
      started_at,
      last_message_at,
      contacts(id, name, phone_masked),
      lead_assessments(buyer_score, sales_score, status, confidence, score_completeness),
      lead_outcomes(stage, occurred_at)
    `)
    .eq("organization_id", organizationId)
    .eq("channel", "crm_upload");

  const crmBounds = calendarDayBounds(since, until);
  if (crmBounds.start) convsQuery = convsQuery.gte("started_at", crmBounds.start);
  if (crmBounds.end) convsQuery = convsQuery.lte("started_at", crmBounds.end);

  const { data: rawConvs } = await convsQuery;

  // If both insights and conversations are empty for the period
  if ((!rawInsights || rawInsights.length === 0) && (!rawConvs || rawConvs.length === 0)) {
    return {
      state: "no_data_for_period",
      isDemoMode: false,
      organizationId,
      organizationName: orgName,
      selectedAdAccount: selectedAccountInfo,
      summary: {
        totalSpend: null,
        totalImpressions: null,
        totalClicks: null,
        ctr: null,
        cpc: null,
        cpm: null,
        totalLeads: 0,
        qualifiedLeads: 0,
        cpql: null,
        avgBuyerScore: null,
        buyerScoreSampleSize: 0,
        avgSalesScore: null,
        salesScoreSampleSize: 0,
        attributionCoverage: {
          verifiedCount: 0,
          inferredCount: 0,
          unknownCount: 0,
          total: 0,
          verifiedPercentage: 0,
        },
        currency: activeAdAccount.currency || "",
      },
      leaderboard: [],
      leads: [],
      funnelCounts: { baru: 0, dihubungi: 0, prospek: 0, survei: 0, closing: 0, batal: 0 },
      lastSyncedAt: metaConnection.last_synced_at,
    };
  }

  // 5. Aggregate Authentic Metrics
  let totalSpend: number | null = null;
  let totalImpressions: number | null = null;
  let totalClicks: number | null = null;
  let currency = activeAdAccount.currency || "";

  const adMap = new Map<
    string,
    {
      adId: string;
      adName: string;
      campaignName: string;
      status: "ACTIVE" | "PAUSED";
      spend: number | null;
      impressions: number | null;
      clicks: number | null;
      attributedLeads: number;
      verifiedLeads: number;
      inferredLeads: number;
      qualifiedLeads: number;
      buyerScores: number[];
    }
  >();

  rawInsights?.forEach((i) => {
    const spend = finiteNumber(i.spend);
    const impressions = finiteNumber(i.impressions);
    const clicks = finiteNumber(i.clicks);
    if (spend !== null) totalSpend = (totalSpend ?? 0) + spend;
    if (impressions !== null) totalImpressions = (totalImpressions ?? 0) + impressions;
    if (clicks !== null) totalClicks = (totalClicks ?? 0) + clicks;
    if (i.currency) currency = i.currency;

    const adRecord = i.ads as unknown as {
      id: string;
      name: string;
      status: string;
      campaigns?: { id: string; name: string } | null;
    } | null;

    const adId = i.ad_id;
    const adName = adRecord?.name || `Ad ${adId}`;
    const cmpName = adRecord?.campaigns?.name || "Campaign";
    const status = (adRecord?.status === "PAUSED" ? "PAUSED" : "ACTIVE") as "ACTIVE" | "PAUSED";

    if (!adMap.has(adId)) {
      adMap.set(adId, {
        adId,
        adName,
        campaignName: cmpName,
        status,
      spend: null as number | null,
      impressions: null as number | null,
      clicks: null as number | null,
        attributedLeads: 0,
        verifiedLeads: 0,
        inferredLeads: 0,
        qualifiedLeads: 0,
        buyerScores: [],
      });
    }

    const curr = adMap.get(adId)!;
    if (spend !== null) curr.spend = (curr.spend ?? 0) + spend;
    if (impressions !== null) curr.impressions = (curr.impressions ?? 0) + impressions;
    if (clicks !== null) curr.clicks = (curr.clicks ?? 0) + clicks;
  });

  // Process conversations for attribution, qualification, and buyer score
  let verifiedCount = 0;
  let inferredCount = 0;
  let unknownCount = 0;
  let qualifiedLeads = 0;
  const buyerScores: number[] = [];
  const salesScores: number[] = [];

  const funnelCounts: Record<FunnelStage, number> = {
    baru: 0,
    dihubungi: 0,
    prospek: 0,
    survei: 0,
    closing: 0,
    batal: 0,
  };

  const leadsList: LeadListItem[] = [];

  rawConvs?.forEach((conv) => {
    const attrStatus = (conv.attribution_status || "unknown") as AttributionStatus;
    const belongsToAccount = Boolean(
      (conv.campaign_id && accountCampaignIds.has(conv.campaign_id)) ||
      (conv.ad_id && adMap.has(conv.ad_id))
    );
    if (!belongsToAccount) return;
    if (attrStatus === "verified") verifiedCount++;
    else if (attrStatus === "inferred") inferredCount++;
    else unknownCount++;

    const assessment = Array.isArray(conv.lead_assessments)
      ? conv.lead_assessments[0]
      : conv.lead_assessments;

    const buyerScore = assessment?.buyer_score ?? null;
    const salesScore = assessment?.sales_score ?? null;

    if (qualifyCrmTemperature(conv.quality_label) === "qualified") qualifiedLeads += 1;
    if (conv.ad_id && qualifyCrmTemperature(conv.quality_label) === "qualified") {
      const adStats = adMap.get(conv.ad_id);
      if (adStats) adStats.qualifiedLeads += 1;
    }
    if (buyerScore !== null && Number.isFinite(buyerScore)) {
      buyerScores.push(buyerScore);
    }
    if (salesScore !== null && Number.isFinite(salesScore)) {
      salesScores.push(salesScore);
    }

    // Funnel stage resolution: map DB outcome stages to funnel stages, latest first
    const outcomes = Array.isArray(conv.lead_outcomes)
      ? [...conv.lead_outcomes].sort(
          (a, b) =>
            new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        )
      : conv.lead_outcomes
        ? [conv.lead_outcomes]
        : [];
    const outcome = outcomes[0];
    const evidence = conv.attribution_evidence;
    const evidenceStage = evidence && typeof evidence === "object" && !Array.isArray(evidence) && typeof evidence.funnel_stage === "string"
      ? evidence.funnel_stage
      : null;
    const stageMap: Record<string, FunnelStage> = {
      survey: "survei",
      survei: "survei",
      booking: "closing",
      sale: "closing",
      closing: "closing",
      lost: "batal",
      batal: "batal",
      baru: "baru",
      dihubungi: "dihubungi",
      prospek: "prospek",
    };
    const stage: FunnelStage = stageMap[(evidenceStage || outcome?.stage || "baru").toLowerCase()] || "baru";
    if (funnelCounts[stage] !== undefined) {
      funnelCounts[stage]++;
    }

    // Attribution linking to ad
    if (conv.ad_id && adMap.has(conv.ad_id)) {
      const adStat = adMap.get(conv.ad_id)!;
      adStat.attributedLeads++;
      if (attrStatus === "verified") adStat.verifiedLeads++;
      if (attrStatus === "inferred") adStat.inferredLeads++;
      if (buyerScore !== null) adStat.buyerScores.push(buyerScore);
    }

    // Build lead list item
    const contact = conv.contacts as unknown as { name?: string | null; phone_masked?: string | null } | null;
    const adTarget = conv.ad_id ? adMap.get(conv.ad_id) : undefined;

    leadsList.push({
      id: conv.id,
      name: contact?.name || "Prospek CRM",
      phoneMasked: contact?.phone_masked || "+62 8•• •••• ••••",
      funnelStage: stage,
      attributionStatus: attrStatus,
      adName: adTarget?.adName || null,
      campaignName: adTarget?.campaignName || null,
      buyerAssessment: {
        dimension: "buyer",
        rawPoints: buyerScore !== null ? buyerScore : 0,
        maxRubricPoints: 100,
        assessedValidWeight: 100,
        completeness:
          assessment?.score_completeness != null
            ? Number(assessment.score_completeness)
            : 0,
        normalizedScore: buyerScore,
        confidence:
          assessment?.confidence != null ? Number(assessment.confidence) : null,
        status: buyerScore !== null ? "completed" : "insufficient_evidence",
        criteria: {},
        missingCriteria: [],
        invalidCriteria: [],
        missingInformation: [],
        rubricVersion: "v1.0",
      },
      salesAssessment: {
        dimension: "sales",
        rawPoints: salesScore !== null ? salesScore : 0,
        maxRubricPoints: 100,
        assessedValidWeight: 100,
        completeness:
          assessment?.score_completeness != null
            ? Number(assessment.score_completeness)
            : 0,
        normalizedScore: salesScore,
        confidence:
          assessment?.confidence != null ? Number(assessment.confidence) : null,
        status: salesScore !== null ? "completed" : "insufficient_evidence",
        criteria: {},
        missingCriteria: [],
        invalidCriteria: [],
        missingInformation: [],
        rubricVersion: "v1.0",
      },
      lastMessageAt: conv.last_message_at || conv.started_at,
      // Message counts are not loaded by this aggregate query; 0 = not loaded, not "no messages".
      messageCount: 0,
      needsReview: attrStatus === "unknown",
      reviewReason: attrStatus === "unknown" ? "Atribusi belum terverifikasi" : undefined,
    });
  });

  const crmConversationIds = new Set((rawConvs ?? []).map((conv) => conv.id));
  const { data: whatsappConversations } = await supabaseClient
    .from("conversations")
    .select("id, ad_id, attribution_status, attribution_evidence")
    .eq("organization_id", organizationId)
    .eq("channel", "whatsapp")
    .eq("attribution_status", "verified");
  for (const conv of whatsappConversations ?? []) {
    const evidence = conv.attribution_evidence;
    const linkedCrmId =
      evidence && typeof evidence === "object" && !Array.isArray(evidence) && typeof evidence.crm_conversation_id === "string"
        ? evidence.crm_conversation_id
        : null;
    if (crmConversationIds.has(conv.id)) continue;
    if (linkedCrmId && crmConversationIds.has(linkedCrmId)) continue;
    if (!conv.ad_id || !adMap.has(conv.ad_id)) continue;
    const adStat = adMap.get(conv.ad_id)!;
    adStat.attributedLeads += 1;
    adStat.verifiedLeads += 1;
    verifiedCount += 1;
  }

  const totalLeads = verifiedCount + inferredCount + unknownCount;
  const verifiedPercentage = totalLeads > 0 ? Math.round((verifiedCount / totalLeads) * 100) : 0;

  const avgBuyer =
    buyerScores.length > 0
      ? Math.round(buyerScores.reduce((a, b) => a + b, 0) / buyerScores.length)
      : null;

  const avgSales =
    salesScores.length > 0
      ? Math.round(salesScores.reduce((a, b) => a + b, 0) / salesScores.length)
      : null;

  // Build Leaderboard
  const leaderboard: AdLeaderboardItem[] = Array.from(adMap.values()).map((ad) => {
    const avgScore =
      ad.buyerScores.length > 0
        ? Math.round(ad.buyerScores.reduce((a, b) => a + b, 0) / ad.buyerScores.length)
        : null;

    return {
      adId: ad.adId,
      adName: ad.adName,
      campaignName: ad.campaignName,
      status: ad.status,
      spend: ad.spend,
      impressions: ad.impressions,
      clicks: ad.clicks,
      ctr: calculateCTR(ad.clicks, ad.impressions),
      cpc: calculateCPC(ad.spend, ad.clicks),
      cpm: calculateCPM(ad.spend, ad.impressions),
      attributedLeadsCount: ad.attributedLeads,
      qualifiedLeadsCount: ad.qualifiedLeads,
      cpql: calculateCPQL(ad.spend, ad.qualifiedLeads),
      avgBuyerScore: avgScore,
      buyerScoreSampleSize: ad.buyerScores.length,
      sampleWarning: ad.buyerScores.length < 5,
      attributionBreakdown: {
        verified: ad.verifiedLeads,
        inferred: ad.inferredLeads,
      },
    };
  });

  // Sort leaderboard by spend descending
  leaderboard.sort((a, b) => (b.spend ?? Number.NEGATIVE_INFINITY) - (a.spend ?? Number.NEGATIVE_INFINITY));

  const summary: DashboardKPISummary = {
    totalSpend,
    totalImpressions,
    totalClicks,
    ctr: calculateCTR(totalClicks, totalImpressions),
    cpc: calculateCPC(totalSpend, totalClicks),
    cpm: calculateCPM(totalSpend, totalImpressions),
    totalLeads,
    qualifiedLeads,
    cpql: calculateCPQL(totalSpend, qualifiedLeads),
    avgBuyerScore: avgBuyer,
    buyerScoreSampleSize: buyerScores.length,
    avgSalesScore: avgSales,
    salesScoreSampleSize: salesScores.length,
    attributionCoverage: {
      verifiedCount,
      inferredCount,
      unknownCount,
      total: totalLeads,
      verifiedPercentage,
    },
    currency,
  };

  return {
    state: "connected_with_data",
    isDemoMode: false,
    organizationId,
    organizationName: orgName,
    selectedAdAccount: selectedAccountInfo,
    summary,
    leaderboard,
    leads: leadsList,
    funnelCounts,
    lastSyncedAt: metaConnection.last_synced_at,
  };
}
