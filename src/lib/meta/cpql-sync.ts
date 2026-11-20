import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaGraphApiVersion } from "@/lib/meta/config";

export interface CpqlDateRange {
  since: string;
  until: string;
}

export interface SyncCtwaAdInsightsResult {
  adsChecked: number;
  metadataUpdated: number;
  snapshotsUpserted: number;
  errors: Array<{ adId: string; message: string }>;
}

export interface CpqlBreakdownRow {
  ad_id: string;
  headline: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_name: string | null;
  total_ctwa_leads: number;
  qualified_leads: number;
  qualification_rate: number | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  currency: string;
  cpl: number | null;
  cpql: number | null;
  synced_at: string | null;
}

export interface WorkspaceCpqlReport {
  has_spend_data: boolean;
  currency: string;
  total_spend: number | null;
  total_ctwa_leads: number;
  qualified_leads: number;
  qualification_rate: number | null;
  cpl: number | null;
  cpql: number | null;
  last_synced_at: string | null;
  breakdown: CpqlBreakdownRow[];
}

const QUALIFIED_STAGES = new Set(["qualified", "survey", "closing", "won"]);

/**
 * Pure CPQL calculation. Returns null whenever qualifiedCount <= 0 or inputs are invalid,
 * never dividing by zero or fabricating costs.
 */
export function calculateCpql(totalSpend: number, qualifiedCount: number): number | null {
  if (
    !Number.isFinite(totalSpend) ||
    totalSpend < 0 ||
    !Number.isFinite(qualifiedCount) ||
    qualifiedCount <= 0
  ) {
    return null;
  }
  return Number((totalSpend / qualifiedCount).toFixed(2));
}

export function calculateCpl(totalSpend: number, leadCount: number): number | null {
  if (
    !Number.isFinite(totalSpend) ||
    totalSpend < 0 ||
    !Number.isFinite(leadCount) ||
    leadCount <= 0
  ) {
    return null;
  }
  return Number((totalSpend / leadCount).toFixed(2));
}

export function calculateQualificationRate(
  qualifiedCount: number,
  leadCount: number
): number | null {
  if (!Number.isFinite(leadCount) || leadCount <= 0 || !Number.isFinite(qualifiedCount)) {
    return null;
  }
  return Number(((qualifiedCount / leadCount) * 100).toFixed(1));
}

function defaultLast30DaysRange(): CpqlDateRange {
  const until = new Date();
  const since = new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

interface GraphAdMetadataResponse {
  id?: string;
  name?: string;
  adset?: { id?: string; name?: string };
  campaign?: { id?: string; name?: string };
  error?: { message?: string };
}

interface GraphAdInsightsRow {
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  account_currency?: string;
  date_start?: string;
  date_stop?: string;
}

interface GraphAdInsightsResponse {
  data?: GraphAdInsightsRow[];
  error?: { message?: string };
}

/**
 * Synchronizes ad metadata & ad spend insights from Meta Graph API for all unique
 * CTWA ad IDs (`ctwa_attributions.source_id`) in a workspace.
 * Never fabricates spend or campaign names if Meta API omits them or returns errors.
 */
export async function syncCtwaAdInsights(
  workspaceId: string,
  accessToken: string,
  dateRange?: CpqlDateRange
): Promise<SyncCtwaAdInsightsResult> {
  const cleanToken = accessToken.trim();
  if (!cleanToken) {
    throw new Error("Missing Meta access token for CTWA ad insights sync.");
  }

  const range = dateRange ?? defaultLast30DaysRange();
  const graphVersion = getMetaGraphApiVersion();
  const admin = createAdminClient();

  const { data: attrs, error: attrErr } = await admin
    .from("ctwa_attributions")
    .select("source_id")
    .eq("workspace_id", workspaceId);

  if (attrErr) {
    throw new Error(`Failed to load CTWA ad source IDs: ${attrErr.message}`);
  }

  const uniqueAdIds = Array.from(
    new Set(
      (attrs ?? [])
        .map((a) => a.source_id?.trim())
        .filter((id): id is string => Boolean(id) && id !== "unknown")
    )
  );

  const summary: SyncCtwaAdInsightsResult = {
    adsChecked: uniqueAdIds.length,
    metadataUpdated: 0,
    snapshotsUpserted: 0,
    errors: [],
  };

  for (const adId of uniqueAdIds) {
    try {
      const metaUrl = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(adId)}`);
      metaUrl.searchParams.set("fields", "id,name,adset{id,name},campaign{id,name}");

      const insightsUrl = new URL(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(adId)}/insights`
      );
      insightsUrl.searchParams.set(
        "fields",
        "spend,impressions,clicks,account_currency,date_start,date_stop"
      );
      insightsUrl.searchParams.set(
        "time_range",
        JSON.stringify({ since: range.since, until: range.until })
      );

      const headers = { Authorization: `Bearer ${cleanToken}` };
      const [metaRes, insightsRes] = await Promise.all([
        fetch(metaUrl.toString(), { method: "GET", headers, cache: "no-store" }),
        fetch(insightsUrl.toString(), { method: "GET", headers, cache: "no-store" }),
      ]);

      let adName: string | null = null;
      let adsetId: string | null = null;
      let adsetName: string | null = null;
      let campaignId: string | null = null;
      let campaignName: string | null = null;

      if (metaRes.ok) {
        const metaJson = (await metaRes.json()) as GraphAdMetadataResponse;
        adName = metaJson.name?.trim() || null;
        adsetId = metaJson.adset?.id?.trim() || null;
        adsetName = metaJson.adset?.name?.trim() || null;
        campaignId = metaJson.campaign?.id?.trim() || null;
        campaignName = metaJson.campaign?.name?.trim() || null;

        if (adName || campaignId || campaignName || adsetId || adsetName) {
          const { error: updErr } = await admin
            .from("ctwa_attributions")
            .update({
              ad_name: adName,
              adset_id: adsetId,
              adset_name: adsetName,
              campaign_id: campaignId,
              campaign_name: campaignName,
            })
            .eq("workspace_id", workspaceId)
            .eq("source_id", adId);

          if (!updErr) {
            summary.metadataUpdated += 1;
          }
        }
      }

      if (!insightsRes.ok) {
        const errBody = await insightsRes.text().catch(() => "");
        summary.errors.push({
          adId,
          message: `Meta insights HTTP ${insightsRes.status}: ${errBody.slice(0, 200)}`,
        });
        continue;
      }

      const insightsJson = (await insightsRes.json()) as GraphAdInsightsResponse;
      const rows = Array.isArray(insightsJson.data) ? insightsJson.data : [];

      for (const row of rows) {
        const spendNum = Number(row.spend);
        if (!Number.isFinite(spendNum) || spendNum < 0) continue;

        const impressionsNum = Math.max(0, Math.round(Number(row.impressions ?? 0) || 0));
        const clicksNum = Math.max(0, Math.round(Number(row.clicks ?? 0) || 0));
        const dateStart = row.date_start?.trim() || range.since;
        const dateStop = row.date_stop?.trim() || range.until;
        const currency = row.account_currency?.trim() || "IDR";

        const { error: upsertErr } = await admin.from("ctwa_ad_spend_snapshots").upsert(
          {
            workspace_id: workspaceId,
            ad_id: adId,
            campaign_id: campaignId,
            campaign_name: campaignName,
            adset_id: adsetId,
            adset_name: adsetName,
            ad_name: adName,
            spend: Number(spendNum.toFixed(2)),
            impressions: impressionsNum,
            clicks: clicksNum,
            currency,
            date_start: dateStart,
            date_stop: dateStop,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,ad_id,date_start,date_stop" }
        );

        if (upsertErr) {
          summary.errors.push({
            adId,
            message: `Failed to upsert snapshot: ${upsertErr.message}`,
          });
        } else {
          summary.snapshotsUpserted += 1;
        }
      }
    } catch (err: unknown) {
      summary.errors.push({
        adId,
        message: err instanceof Error ? err.message : "Unknown sync error",
      });
    }
  }

  return summary;
}

export function buildWorkspaceCpqlReport(params: {
  leads: Array<{
    conversation_id: string;
    lead_temperature: string;
    pipeline_stage: string;
  }>;
  attributions: Array<{
    conversation_id: string;
    source_id: string;
    headline: string | null;
    campaign_id: string | null;
    campaign_name: string | null;
    adset_id: string | null;
    adset_name: string | null;
    ad_name: string | null;
  }>;
  snapshots: Array<{
    ad_id: string;
    campaign_id: string | null;
    campaign_name: string | null;
    adset_id: string | null;
    adset_name: string | null;
    ad_name: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    currency: string;
    synced_at: string;
  }>;
}): WorkspaceCpqlReport {
  const attrByConvId = new Map(
    params.attributions.map((a) => [a.conversation_id, a])
  );

  interface Bucket {
    ad_id: string;
    headline: string | null;
    campaign_id: string | null;
    campaign_name: string | null;
    adset_id: string | null;
    adset_name: string | null;
    ad_name: string | null;
    total_ctwa_leads: number;
    qualified_leads: number;
    hasSpend: boolean;
    spendSum: number;
    impressionsSum: number;
    clicksSum: number;
    currency: string;
    synced_at: string | null;
  }

  const buckets = new Map<string, Bucket>();

  const ensureBucket = (adId: string): Bucket => {
    const existing = buckets.get(adId);
    if (existing) return existing;
    const created: Bucket = {
      ad_id: adId,
      headline: null,
      campaign_id: null,
      campaign_name: null,
      adset_id: null,
      adset_name: null,
      ad_name: null,
      total_ctwa_leads: 0,
      qualified_leads: 0,
      hasSpend: false,
      spendSum: 0,
      impressionsSum: 0,
      clicksSum: 0,
      currency: "IDR",
      synced_at: null,
    };
    buckets.set(adId, created);
    return created;
  };

  let totalCtwaLeads = 0;
  let totalQualifiedLeads = 0;

  for (const lead of params.leads) {
    const attr = attrByConvId.get(lead.conversation_id);
    const isQualified =
      lead.lead_temperature === "warm" ||
      lead.lead_temperature === "hot" ||
      QUALIFIED_STAGES.has(lead.pipeline_stage);

    if (attr) {
      totalCtwaLeads += 1;
      if (isQualified) totalQualifiedLeads += 1;

      const bucket = ensureBucket(attr.source_id);
      bucket.total_ctwa_leads += 1;
      if (isQualified) bucket.qualified_leads += 1;
      if (!bucket.headline && attr.headline) bucket.headline = attr.headline;
      if (!bucket.campaign_id && attr.campaign_id) bucket.campaign_id = attr.campaign_id;
      if (!bucket.campaign_name && attr.campaign_name) bucket.campaign_name = attr.campaign_name;
      if (!bucket.adset_id && attr.adset_id) bucket.adset_id = attr.adset_id;
      if (!bucket.adset_name && attr.adset_name) bucket.adset_name = attr.adset_name;
      if (!bucket.ad_name && attr.ad_name) bucket.ad_name = attr.ad_name;
    }
  }

  let hasAnySpend = false;
  let totalSpendSum = 0;
  let workspaceCurrency = "IDR";
  let latestSyncedAt: string | null = null;

  for (const snap of params.snapshots) {
    hasAnySpend = true;
    const spendVal = Number(snap.spend) || 0;
    totalSpendSum += spendVal;
    workspaceCurrency = snap.currency || workspaceCurrency;
    if (!latestSyncedAt || Date.parse(snap.synced_at) > Date.parse(latestSyncedAt)) {
      latestSyncedAt = snap.synced_at;
    }

    const bucket = ensureBucket(snap.ad_id);
    bucket.hasSpend = true;
    bucket.spendSum += spendVal;
    bucket.impressionsSum += Number(snap.impressions) || 0;
    bucket.clicksSum += Number(snap.clicks) || 0;
    bucket.currency = snap.currency || bucket.currency;
    if (!bucket.synced_at || Date.parse(snap.synced_at) > Date.parse(bucket.synced_at)) {
      bucket.synced_at = snap.synced_at;
    }
    if (!bucket.campaign_id && snap.campaign_id) bucket.campaign_id = snap.campaign_id;
    if (!bucket.campaign_name && snap.campaign_name) bucket.campaign_name = snap.campaign_name;
    if (!bucket.adset_id && snap.adset_id) bucket.adset_id = snap.adset_id;
    if (!bucket.adset_name && snap.adset_name) bucket.adset_name = snap.adset_name;
    if (!bucket.ad_name && snap.ad_name) bucket.ad_name = snap.ad_name;
  }

  const totalSpend = hasAnySpend ? Number(totalSpendSum.toFixed(2)) : null;

  const breakdown: CpqlBreakdownRow[] = Array.from(buckets.values())
    .map((b) => {
      const spend = b.hasSpend ? Number(b.spendSum.toFixed(2)) : null;
      return {
        ad_id: b.ad_id,
        headline: b.headline,
        campaign_id: b.campaign_id,
        campaign_name: b.campaign_name,
        adset_id: b.adset_id,
        adset_name: b.adset_name,
        ad_name: b.ad_name,
        total_ctwa_leads: b.total_ctwa_leads,
        qualified_leads: b.qualified_leads,
        qualification_rate: calculateQualificationRate(b.qualified_leads, b.total_ctwa_leads),
        spend,
        impressions: b.hasSpend ? b.impressionsSum : null,
        clicks: b.hasSpend ? b.clicksSum : null,
        currency: b.currency,
        cpl: spend !== null ? calculateCpl(spend, b.total_ctwa_leads) : null,
        cpql: spend !== null ? calculateCpql(spend, b.qualified_leads) : null,
        synced_at: b.synced_at,
      };
    })
    .sort((a, b) => (b.spend ?? -1) - (a.spend ?? -1) || b.total_ctwa_leads - a.total_ctwa_leads);

  return {
    has_spend_data: hasAnySpend,
    currency: workspaceCurrency,
    total_spend: totalSpend,
    total_ctwa_leads: totalCtwaLeads,
    qualified_leads: totalQualifiedLeads,
    qualification_rate: calculateQualificationRate(totalQualifiedLeads, totalCtwaLeads),
    cpl: totalSpend !== null ? calculateCpl(totalSpend, totalCtwaLeads) : null,
    cpql: totalSpend !== null ? calculateCpql(totalSpend, totalQualifiedLeads) : null,
    last_synced_at: latestSyncedAt,
    breakdown,
  };
}
