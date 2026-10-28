import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MarketingApiError,
  type MarketingSyncResult,
  type NormalizedAdAccount,
  type NormalizedCampaign,
  type NormalizedAd,
  type NormalizedAdInsight,
} from "./types";
import {
  getMetaMarketingConfig,
  isMetaMarketingConfigured,
  normalizeAdAccountId,
  sanitizeMarketingLog,
} from "./config";
import { MetaMarketingApiClient, getMetaMarketingApiClient } from "./client";
import { MockMetaMarketingApiClient } from "./mock-client";
import {
  mapMetaAccountToInternal,
  mapMetaCampaignToInternal,
  mapMetaAdToInternal,
  mapMetaInsightToInternal,
} from "./mapper";
import { decryptAccessToken } from "@/lib/whatsapp/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ExecuteMarketingSyncOptions {
  organizationId: string;
  targetAdAccountId?: string;
  timeRange?: { since: string; until: string };
  client?: MetaMarketingApiClient | MockMetaMarketingApiClient;
  supabaseClient?: SupabaseClient;
  allowDemoFallback?: boolean;
  /**
   * System env token fallback (META_ACCESS_TOKEN) is only for controlled
   * background workers, never for tenant-initiated sync. Default: false.
   */
  allowEnvTokenFallback?: boolean;
}

/**
 * Executes a complete, idempotent read-only sync of Meta Marketing data.
 *
 * Steps:
 * 1. Checks configuration (falls back to mock client if unconfigured and allowDemoFallback is true).
 * 2. Fetches Ad Account, Campaigns, Ads, and Insights.
 * 3. Normalizes all responses into internal models.
 * 4. Idempotently upserts records into Supabase tables (ad_accounts, campaigns, ads, ad_insights).
 * 5. Records sync job audit trail with sanitized error handling.
 */
export async function executeMarketingSync(
  options: ExecuteMarketingSyncOptions
): Promise<MarketingSyncResult> {
  const {
    organizationId,
    targetAdAccountId,
    timeRange = {
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      until: new Date().toISOString().split("T")[0],
    },
    supabaseClient,
    allowDemoFallback = true,
  } = options;

  if (!organizationId || organizationId.trim() === "") {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message: "organizationId wajib disertakan untuk isolasi tenant multi-organisasi.",
      isRecoverable: false,
    });
  }

  const isEnvConfigured = isMetaMarketingConfigured();
  let liveToken: string | undefined;
  let selectedAccountId: string | undefined = targetAdAccountId;

  // Check if tenant has encrypted OAuth token in database (Tenant OAuth takes precedence over environment fallback)
  let dbClient: SupabaseClient | undefined = supabaseClient;
  if (!dbClient) {
    try {
      dbClient = createAdminClient();
    } catch {
      // In isolated mock tests without SUPABASE_SERVICE_ROLE_KEY
    }
  }

  if (dbClient && !options.client) {
    try {
      const { data: tokenRow } = await dbClient
        .from("meta_user_tokens")
        .select("encrypted_access_token, encryption_iv, encryption_tag")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (tokenRow?.encrypted_access_token && tokenRow?.encryption_iv && tokenRow?.encryption_tag) {
        liveToken = decryptAccessToken(
          tokenRow.encrypted_access_token,
          tokenRow.encryption_iv,
          tokenRow.encryption_tag
        );
      }

      if (!selectedAccountId) {
        const { data: selRow } = await dbClient
          .from("meta_asset_selections")
          .select("ad_account_id")
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (selRow?.ad_account_id) {
          selectedAccountId = selRow.ad_account_id;
        }
      } else {
        // A caller-supplied ad account must match the tenant's selected asset.
        const { data: selRow } = await dbClient
          .from("meta_asset_selections")
          .select("ad_account_id")
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (
          selRow?.ad_account_id &&
          normalizeAdAccountId(selRow.ad_account_id) !== normalizeAdAccountId(selectedAccountId)
        ) {
          throw new MarketingApiError({
            code: "FORBIDDEN",
            message: "Akun iklan target tidak sesuai dengan aset Meta milik tenant.",
            isRecoverable: false,
          });
        }
      }
    } catch (err) {
      if (err instanceof MarketingApiError) throw err;
      // Non-blocking query failure
    }
  }

  const allowEnvTokenFallback = options.allowEnvTokenFallback === true;
  const isConfigured =
    Boolean(liveToken) || (allowEnvTokenFallback && isEnvConfigured);

  if (!liveToken && !options.client && isEnvConfigured && !allowEnvTokenFallback && !allowDemoFallback) {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message:
        "Tenant belum menghubungkan akun Meta. Sinkronisasi tenant wajib memakai token OAuth tenant, bukan token env global.",
      isRecoverable: false,
    });
  }
  const isDemoMode = !isConfigured && Boolean(allowDemoFallback);

  if (!isConfigured && !isDemoMode) {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message:
        "Meta Marketing API access token is not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to enable live ad synchronization.",
      isRecoverable: false,
    });
  }

  // Select client (live, tenant-authenticated, or explicit mock)
  const client: MetaMarketingApiClient | MockMetaMarketingApiClient =
    options.client ||
    (isDemoMode
      ? new MockMetaMarketingApiClient()
      : liveToken
      ? new MetaMarketingApiClient({ accessToken: liveToken })
      : getMetaMarketingApiClient());

  if (!selectedAccountId && !isDemoMode && !allowEnvTokenFallback) {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message: "Tenant belum memilih akun iklan Meta untuk disinkronkan.",
      isRecoverable: false,
    });
  }

  const accountId = normalizeAdAccountId(
    selectedAccountId ||
      (allowEnvTokenFallback
        ? getMetaMarketingConfig({ requireConfigured: false }).adAccountId
        : undefined) ||
      "act_0812999001"
  );

  const syncedAt = new Date().toISOString();
  let syncJobId: string | undefined;

  let adminClient: SupabaseClient | undefined;
  try {
    adminClient = createAdminClient();
  } catch {
    // In isolated unit tests without service role key
  }
  const db = adminClient || supabaseClient || dbClient;

  // 1. Create sync_job record if database is connected
  if (db) {
    try {
      const { data: jobData } = await db
        .from("sync_jobs")
        .insert({
          organization_id: organizationId,
          provider: isDemoMode ? "demo" : "meta",
          job_type: "ad_insights",
          status: "running",
          target_account_id: accountId,
          time_range: timeRange,
          diagnostic_info: {
            mode: isDemoMode ? "demo" : "live",
            targetAccountId: accountId,
            timeRange,
          },
          started_at: syncedAt,
        })
        .select("id")
        .single();

      if (jobData?.id) {
        syncJobId = jobData.id;
      }
    } catch {
      // Continue even if sync_jobs table is unreachable
    }
  }

  try {
    // 2. Fetch data from Graph API (strictly read-only)
    // Step 2a: Fetch structural account metadata, campaigns, and ads in parallel
    const [metaAccount, metaCampaigns, metaAds] = await Promise.all([
      client.getAdAccount(accountId),
      client.getCampaigns(accountId),
      client.getAds(accountId),
    ]);

    const paginationTruncated =
      client instanceof MetaMarketingApiClient && client.lastFetchTruncated;

    // Step 2b: Fetch ad insights. If timeRange is not specified, default to last_90d (capturing recent active campaigns in ~2s)
    const metaInsights = await client.getAdInsights({
      targetAdAccountId: accountId,
      timeRange: options.timeRange,
      datePreset: options.timeRange ? undefined : "last_90d",
      timeIncrement: 1, // Store daily records to guarantee mathematical consistency across any date range
      limit: 50,
    });

    // 3. Map to internal normalized representations
    const normalizedAccount: NormalizedAdAccount = mapMetaAccountToInternal(
      metaAccount,
      organizationId
    );
    normalizedAccount.provider = isDemoMode ? "demo" : "meta";

    const normalizedCampaigns: NormalizedCampaign[] = metaCampaigns.map((c) =>
      mapMetaCampaignToInternal(c, organizationId, normalizedAccount.providerAccountId)
    );

    const normalizedAds: NormalizedAd[] = metaAds.map((a) =>
      mapMetaAdToInternal(a, organizationId, a.campaign_id)
    );

    const normalizedInsights: NormalizedAdInsight[] = metaInsights.map((i) =>
      mapMetaInsightToInternal(i, {
        organizationId,
        adId: i.ad_id || "unknown_ad",
        currency: normalizedAccount.currency,
        source: isDemoMode ? "demo" : "meta",
      })
    );

    const recordsProcessed = 1 + normalizedCampaigns.length + normalizedAds.length + normalizedInsights.length;
    let recordsRejected = 0;
    let persistenceFailed = false;

    // 4. Idempotent Upsert into Supabase (if client provided)
    if (db) {
      try {
        const tableAccount = db.from("ad_accounts");
        if (typeof tableAccount?.upsert === "function") {
          // A. Upsert Ad Account
          const { data: dbAccount, error: accErr } = await tableAccount
            .upsert(
              {
                organization_id: organizationId,
                provider: normalizedAccount.provider,
                provider_account_id: normalizedAccount.providerAccountId,
                account_name: normalizedAccount.accountName,
                currency: normalizedAccount.currency,
                timezone: normalizedAccount.timezone,
                connection_status: normalizedAccount.connectionStatus,
                last_synced_at: syncedAt,
                updated_at: syncedAt,
              },
              { onConflict: "organization_id,provider,provider_account_id" }
            )
            .select("id")
            .single();

          if (accErr) {
            recordsRejected++;
          }

          const internalAdAccountId = dbAccount?.id;

          // B. Upsert Campaigns (combining campaigns from /campaigns and historical campaigns from insights)
          if (internalAdAccountId) {
            const campaignMap = new Map<
              string,
              {
                organization_id: string;
                ad_account_id: string;
                provider_campaign_id: string;
                name: string;
                status: string;
                objective: string | null;
                updated_at: string;
              }
            >();

            normalizedCampaigns.forEach((c) => {
              campaignMap.set(c.providerCampaignId, {
                organization_id: organizationId,
                ad_account_id: internalAdAccountId,
                provider_campaign_id: c.providerCampaignId,
                name: c.name,
                status: c.status,
                objective: c.objective || null,
                updated_at: syncedAt,
              });
            });

            // Ensure historical campaigns with insights are preserved
            metaInsights.forEach((i) => {
              if (i.campaign_id && !campaignMap.has(i.campaign_id)) {
                campaignMap.set(i.campaign_id, {
                  organization_id: organizationId,
                  ad_account_id: internalAdAccountId,
                  provider_campaign_id: i.campaign_id,
                  name: i.campaign_name || `Campaign ${i.campaign_id}`,
                  status: "ARCHIVED",
                  objective: null,
                  updated_at: syncedAt,
                });
              }
            });

            const campaignRows = Array.from(campaignMap.values());
            if (campaignRows.length > 0) {
              const { error: cmpErr } = await db
                .from("campaigns")
                .upsert(campaignRows, { onConflict: "organization_id,provider_campaign_id" });

              if (cmpErr) {
                recordsRejected += campaignRows.length;
              }
            }
          }

          // C. Resolve internal campaign UUIDs for Ads
          const { data: dbCampaigns } = await db
            .from("campaigns")
            .select("id, provider_campaign_id")
            .eq("organization_id", organizationId);

          const campaignIdMap = new Map<string, string>();
          dbCampaigns?.forEach((c: { provider_campaign_id: string; id: string }) =>
            campaignIdMap.set(c.provider_campaign_id, c.id)
          );

          // D. Upsert Ads (combining ads from /ads and historical ads from insights)
          const adMap = new Map<
            string,
            {
              organization_id: string;
              campaign_id: string;
              provider_ad_id: string;
              name: string;
              status: string;
              updated_at: string;
            }
          >();

          normalizedAds.forEach((a) => {
            const internalCmpId = campaignIdMap.get(a.campaignId);
            if (internalCmpId) {
              adMap.set(a.providerAdId, {
                organization_id: organizationId,
                campaign_id: internalCmpId,
                provider_ad_id: a.providerAdId,
                name: a.name,
                status: a.status,
                updated_at: syncedAt,
              });
            }
          });

          // Ensure historical ads with insights are preserved
          metaInsights.forEach((i) => {
            if (i.ad_id && !adMap.has(i.ad_id) && i.campaign_id) {
              const internalCmpId = campaignIdMap.get(i.campaign_id);
              if (internalCmpId) {
                adMap.set(i.ad_id, {
                  organization_id: organizationId,
                  campaign_id: internalCmpId,
                  provider_ad_id: i.ad_id,
                  name: i.ad_name || `Ad ${i.ad_id}`,
                  status: "ARCHIVED",
                  updated_at: syncedAt,
                });
              }
            }
          });

          const adRows = Array.from(adMap.values());
          if (adRows.length > 0) {
            const { error: adErr } = await db
              .from("ads")
              .upsert(adRows, { onConflict: "organization_id,provider_ad_id" });

            if (adErr) {
              recordsRejected += adRows.length;
            }
          }

          // E. Resolve internal ad UUIDs for Insights
          const { data: dbAds } = await db
            .from("ads")
            .select("id, provider_ad_id")
            .eq("organization_id", organizationId);

          const adIdMap = new Map<string, string>();
          dbAds?.forEach((a: { provider_ad_id: string; id: string }) => adIdMap.set(a.provider_ad_id, a.id));

          // F. Upsert Insights
          const insightRows = normalizedInsights
            .map((i) => {
              const internalAdId = adIdMap.get(i.adId);
              if (!internalAdId) return null;
              return {
                organization_id: organizationId,
                ad_id: internalAdId,
                date_start: i.dateStart,
                date_stop: i.dateStop,
                level: i.level,
                spend: i.spend,
                impressions: i.impressions,
                clicks: i.clicks,
                reach: i.reach ?? 0,
                link_clicks: i.linkClicks ?? 0,
                conversions: i.conversions ?? 0,
                adset_id: i.adsetId ?? null,
                adset_name: i.adsetName ?? null,
                attribution_setting: i.attributionSetting ?? null,
                currency: i.currency,
                source: i.source,
                action_breakdown: i.actionBreakdown || {},
                conversion_action_type: i.conversionActionType || null,
                mapping_version: i.mappingVersion || "v1.1",
                fetched_at: syncedAt,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);

          if (insightRows.length > 0) {
            const { error: insErr } = await db
              .from("ad_insights")
              .upsert(insightRows, {
                onConflict: "organization_id,ad_id,date_start,date_stop,level",
              });

            if (insErr) {
              recordsRejected += insightRows.length;
            }
          }
        }

        // G. Mark sync_job as completed
        if (syncJobId) {
          const syncJobTable = db.from("sync_jobs");
          if (typeof syncJobTable?.update === "function") {
            await syncJobTable
              .update({
                status: recordsRejected > 0 ? "partial" : "completed",
                records_processed: recordsProcessed,
                records_rejected: recordsRejected,
                diagnostic_info: {
                  recordsProcessed,
                  recordsRejected,
                  mode: isDemoMode ? "demo" : "live",
                  targetAccountId: accountId,
                  timeRange,
                  adAccountsSynced: 1,
                  campaignsSynced: normalizedCampaigns.length,
                  adsSynced: normalizedAds.length,
                  insightsSynced: normalizedInsights.length,
                },
                completed_at: new Date().toISOString(),
              })
              .eq("id", syncJobId);
          }
        }

        // H. Update canonical integration_connections last_synced_at
        const connTable = db.from("integration_connections");
        if (typeof connTable?.update === "function") {
          const updateBuilder = connTable
            .update({
              status: "connected",
              last_synced_at: syncedAt,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", organizationId);

          const builder = updateBuilder as unknown as { eq?: (k: string, v: string) => PromiseLike<unknown> };
          if (typeof builder?.eq === "function") {
            await builder.eq("provider", isDemoMode ? "demo" : "meta");
          } else {
            await updateBuilder;
          }
        }
      } catch (dbErr) {
        // Persistence failure must not be reported as a successful sync.
        persistenceFailed = true;
        console.warn("[Meta Marketing Sync] Database persistence failed:", dbErr);
      }
    }

    const insightsTruncated =
      client instanceof MetaMarketingApiClient && client.lastFetchTruncated;

    return {
      status:
        recordsRejected > 0 || persistenceFailed || paginationTruncated || insightsTruncated
          ? "partial"
          : "success",
      mode: isDemoMode ? "demo" : "live",
      adAccountsSynced: 1,
      campaignsSynced: normalizedCampaigns.length,
      adsSynced: normalizedAds.length,
      insightsSynced: normalizedInsights.length,
      recordsProcessed,
      recordsRejected,
      syncedAt,
      dateRange: timeRange,
      syncJobId,
    };
  } catch (error) {
    const errorMsg = sanitizeMarketingLog(
      error instanceof Error ? error.message : "Terjadi kesalahan saat sinkronisasi Meta Marketing API"
    );

    // Update sync_job status to failed if connected
    if (db && syncJobId) {
      try {
        await db
          .from("sync_jobs")
          .update({
            status: "failed",
            error_code: error instanceof MarketingApiError ? error.code : "UPSTREAM_ERROR",
            error_message: errorMsg,
            diagnostic_info: {
              error: errorMsg,
              targetAccountId: accountId,
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncJobId);
      } catch {
        // Suppress secondary error
      }
    }

    // Update integration_connections status to error
    if (db) {
      try {
        const errUpdate = db
          .from("integration_connections")
          .update({
            status: "error",
            error_message: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);

        const errBuilder = errUpdate as unknown as { eq?: (k: string, v: string) => PromiseLike<unknown> };
        if (typeof errBuilder?.eq === "function") {
          await errBuilder.eq("provider", "meta");
        } else {
          await errUpdate;
        }
      } catch {
        // Suppress secondary error
      }
    }

    if (error instanceof MarketingApiError) {
      throw error;
    }

    throw new MarketingApiError({
      code: "UPSTREAM_ERROR",
      message: errorMsg,
      isRecoverable: false,
      cause: error,
    });
  }
}
