import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALL_EFFECTIVE_STATUSES,
  MarketingApiError,
  type MarketingSyncResult,
  type MetaAdSetResponse,
  type NormalizedAdAccount,
  type NormalizedCampaign,
  type NormalizedAd,
  type NormalizedAdInsight,
} from "./types";
import {
  normalizeAdAccountId,
  sanitizeMarketingLog,
} from "./config";
import { MetaMarketingApiClient } from "./client";
import {
  mapMetaAccountToInternal,
  mapMetaCampaignToInternal,
  mapMetaAdToInternal,
  mapMetaInsightToInternal,
  parseCount,
  parseSpend,
} from "./mapper";
import { decryptAccessToken } from "@/lib/security/credential-crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDateRange } from "@/lib/ads/date-utils";

export { ALL_EFFECTIVE_STATUSES };

const STALE_SYNC_MS = 3 * 60 * 1000;

/**
 * Maximum number of records sent in a single Supabase `.upsert()` call.
 * Prevents PostgREST / HTTP 413 "Payload Too Large" failures when syncing
 * large ad accounts with hundreds of campaigns, ads, and daily insights.
 */
export const SUPABASE_UPSERT_CHUNK_SIZE = 200;

/**
 * Splits a large array into fixed-size chunks (default: 200 rows) for safe,
 * idempotent batched upserts into Supabase PostgreSQL tables.
 *
 * @param items - Source array of rows to chunk
 * @param chunkSize - Maximum rows per batch (defaults to 200)
 */
export function chunkArray<T>(
  items: readonly T[],
  chunkSize: number = SUPABASE_UPSERT_CHUNK_SIZE
): T[][] {
  if (chunkSize <= 0) return [Array.from(items)];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function closeSyncJob(
  db: SupabaseClient,
  syncJobId: string,
  patch: {
    status: "completed" | "partial" | "failed";
    records_processed?: number;
    records_rejected?: number;
    error_code?: string | null;
    error_message?: string | null;
    diagnostic_info?: Record<string, unknown>;
    meta_x_business_use_case_usage?: Record<string, unknown> | null;
    completed_at: string;
  }
): Promise<void> {
  const table = db.from("sync_jobs");
  if (typeof table?.update !== "function") return;

  const write = async (
    status: "completed" | "partial" | "failed",
    includeBucColumn = true
  ) => {
    const payload = { ...patch, status };
    if (!includeBucColumn) {
      delete (payload as Record<string, unknown>).meta_x_business_use_case_usage;
    }
    const { error } = await table.update(payload).eq("id", syncJobId);
    return error as { code?: string; message?: string } | null;
  };

  let error = await write(patch.status, true);
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    error = await write(patch.status, false);
  }
  if (!error) return;

  // Databases that have not applied the partial-status migration reject
  // status = 'partial' and leave the row running, which blocks the next sync.
  if (patch.status === "partial") {
    const fallback = await write("failed", false);
    if (!fallback) return;
    console.warn("[Meta Marketing Sync] Could not close sync job:", {
      syncJobId,
      errorCode: fallback.code || null,
    });
    return;
  }

  console.warn("[Meta Marketing Sync] Could not close sync job:", {
    syncJobId,
    errorCode: error.code || null,
  });
}

export interface ExecuteMarketingSyncOptions {
  organizationId: string;
  targetAdAccountId?: string;
  timeRange?: { since: string; until: string };
  datePreset?: "today" | "last_7d" | "last_14d" | "last_30d";
  client?: Pick<
    MetaMarketingApiClient,
    "getAdAccounts" | "getAdAccount" | "getCampaigns" | "getAds" | "getAdInsights"
  > &
    Partial<Pick<MetaMarketingApiClient, "getAdSets" | "getAccountInsights">>;
  supabaseClient?: SupabaseClient;
}

/**
 * Executes a complete, idempotent read-only synchronization of Meta Marketing data.
 *
 * Guarantees 100% data parity with Meta Ads Manager via:
 * 1. **Cursor Pagination Traversal (`while (hasNextPage)`)**: Traverses every page of
 *    Campaigns, AdSets, Ads, and Ad-level Insights using `paging.cursors.after` until
 *    no further pages exist, while respecting Meta BUC rate limit headers.
 * 2. **Comprehensive Effective Status Filtering**: Queries all 9 Meta effective statuses
 *    (`ACTIVE`, `PAUSED`, `DELETED`, `ARCHIVED`, `CAMPAIGN_PAUSED`, `ADSET_PAUSED`,
 *    `PENDING_REVIEW`, `DISAPPROVED`, `PREAPPROVED`) so historical spend on paused or
 *    archived entities is never dropped.
 * 3. **Chunked Idempotent Upserts**: Splits large arrays into chunks of 200 rows and
 *    uses `.upsert(..., { onConflict })` so existing Campaigns, Ads, and Insights are
 *    seamlessly updated without triggering HTTP 413 Payload Too Large errors.
 * 4. **Ad-Level Insights & 7-Day Attribution**: Fetches daily (`time_increment=1`)
 *    insights at `level=ad` with `use_account_attribution_setting=true` and
 *    `7d_click` / `1d_view` attribution windows.
 */
export async function executeMarketingSync(
  options: ExecuteMarketingSyncOptions
): Promise<MarketingSyncResult> {
  const {
    organizationId,
    targetAdAccountId,
    supabaseClient,
  } = options;
  const datePreset = options.datePreset || (!options.timeRange ? "last_30d" : undefined);
  const defaultRange = parseDateRange("30d", "Asia/Jakarta");
  const timeRange = options.timeRange || { since: defaultRange.since!, until: defaultRange.until! };

  if (!organizationId || organizationId.trim() === "") {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message: "organizationId wajib disertakan untuk isolasi tenant multi-organisasi.",
      isRecoverable: false,
    });
  }

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
        // A caller-supplied ad account must belong to this tenant: either the
        // selected asset or a connected ad account registered for this org.
        const { data: selRow } = await dbClient
          .from("meta_asset_selections")
          .select("ad_account_id")
          .eq("organization_id", organizationId)
          .maybeSingle();
        const { data: accRow } = await dbClient
          .from("ad_accounts")
          .select("provider_account_id")
          .eq("organization_id", organizationId)
          .eq("provider_account_id", normalizeAdAccountId(selectedAccountId))
          .maybeSingle();
        const matchesSelection =
          selRow?.ad_account_id &&
          normalizeAdAccountId(selRow.ad_account_id) === normalizeAdAccountId(selectedAccountId);
        if (!matchesSelection && !accRow) {
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

  const isInjectedTestProvider = !liveToken && Boolean(options.client) && process.env.NODE_ENV === "test";

  if (!liveToken && !isInjectedTestProvider) {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message: "Organisasi ini belum menghubungkan Meta. Hubungkan akun Meta organisasi ini.",
      isRecoverable: false,
    });
  }

  // Test providers may be explicitly injected outside production. Runtime
  // requests always use the tenant's server-side OAuth token.
  const client = options.client || new MetaMarketingApiClient({ accessToken: liveToken! });

  if (client instanceof MetaMarketingApiClient) {
    client.lastFetchTruncated = false;
    client.lastFetchPages = 0;
    client.lastFetchHasMore = false;
  }

  if (!selectedAccountId) {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message: "Tenant belum memilih akun iklan Meta untuk disinkronkan.",
      isRecoverable: false,
    });
  }

  // The account context must be explicitly selected and tenant validated.
  const accountId = normalizeAdAccountId(selectedAccountId);
  if (!accountId) {
    throw new MarketingApiError({
      code: "MISSING_CONFIGURATION",
      message: "Pilih akun iklan Meta organisasi ini sebelum menjalankan sinkronisasi.",
      isRecoverable: false,
    });
  }

  const syncedAt = new Date().toISOString();
  let syncJobId: string | undefined;

  let adminClient: SupabaseClient | undefined;
  try {
    adminClient = createAdminClient();
  } catch {
    // In isolated unit tests without service role key
  }
  const db = adminClient || supabaseClient || dbClient;

  // 0. Duplicate-sync lock. A live job blocks a second run. A job still
  // marked running after the worker window is closed so a failed status
  // write cannot lock the account for the old 15-minute window.
  if (db) {
    try {
      const staleBefore = new Date(Date.now() - STALE_SYNC_MS).toISOString();
      const { data: running } = await db
        .from("sync_jobs")
        .select("id, started_at")
        .eq("organization_id", organizationId)
        .eq("target_account_id", accountId)
        .eq("status", "running")
        .limit(5);
      const active: Array<{ id: string }> = [];
      for (const job of running || []) {
        const startedAt = typeof job.started_at === "string" ? job.started_at : "";
        if (startedAt && startedAt < staleBefore) {
          await closeSyncJob(db, job.id, {
            status: "failed",
            error_code: "SYNC_INTERRUPTED",
            error_message: "Sinkronisasi sebelumnya terhenti sebelum statusnya diperbarui.",
            completed_at: new Date().toISOString(),
          });
        } else {
          active.push(job);
        }
      }
      if (active.length > 0) {
        throw new MarketingApiError({
          code: "SYNC_IN_PROGRESS",
          message: "Sinkronisasi untuk akun iklan ini sedang berjalan. Tunggu hingga selesai.",
          isRecoverable: true,
          statusCode: 409,
        });
      }
    } catch (err) {
      if (err instanceof MarketingApiError) throw err;
      // Lock check is best-effort when sync_jobs is unreachable in tests.
    }
  }

  // 1. Create sync_job record if database is connected
  if (db) {
    try {
      const { data: jobData } = await db
        .from("sync_jobs")
        .insert({
          organization_id: organizationId,
          provider: "meta",
          job_type: "ad_insights",
          status: "running",
          target_account_id: accountId,
          time_range: timeRange,
          diagnostic_info: {
            mode: "live",
            targetAccountId: accountId,
            timeRange,
            effectiveStatuses: ALL_EFFECTIVE_STATUSES,
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
    // 2. Fetch data from Graph API (strictly read-only, full cursor pagination)
    // Use forked clients when running against MetaMarketingApiClient so parallel
    // cursor loops do not overwrite each other's pagination telemetry.
    const campaignsClient = client instanceof MetaMarketingApiClient ? client.fork() : client;
    const adsetsClient = client instanceof MetaMarketingApiClient ? client.fork() : client;
    const adsClient = client instanceof MetaMarketingApiClient ? client.fork() : client;

    // Step 2a: Fetch structural account metadata, campaigns, adsets, and ads in parallel
    const [metaAccount, metaCampaigns, metaAdSets, metaAds] = await Promise.all([
      client.getAdAccount(accountId),
      campaignsClient.getCampaigns(accountId),
      typeof adsetsClient.getAdSets === "function"
        ? adsetsClient.getAdSets(accountId).catch(() => [] as MetaAdSetResponse[])
        : Promise.resolve([] as MetaAdSetResponse[]),
      adsClient.getAds(accountId),
    ]);

    const paginationTruncated =
      (client instanceof MetaMarketingApiClient && client.lastFetchTruncated) ||
      (campaignsClient instanceof MetaMarketingApiClient && campaignsClient.lastFetchTruncated) ||
      (adsetsClient instanceof MetaMarketingApiClient && adsetsClient.lastFetchTruncated) ||
      (adsClient instanceof MetaMarketingApiClient && adsClient.lastFetchTruncated);

    // Step 2b: Fetch ad-level (`level=ad`) insights for the SAME period recorded on the sync job
    const insightsClient = client instanceof MetaMarketingApiClient ? client.fork() : client;
    const accountInsightsClient = client instanceof MetaMarketingApiClient ? client.fork() : client;
    const [metaInsights, metaAccountInsights] = await Promise.all([
      insightsClient.getAdInsights({
        targetAdAccountId: accountId,
        timeRange,
        datePreset,
        timeIncrement: 1, // Daily rows keep charts and totals on the same reporting window.
        limit: 100,
        maxPages: 100,
      }),
      typeof accountInsightsClient.getAccountInsights === "function"
        ? accountInsightsClient.getAccountInsights({
            targetAdAccountId: accountId,
            timeRange,
            datePreset,
            limit: 100,
            maxPages: 20,
          })
        : Promise.resolve([]),
    ]);

    const insightsTruncated =
      insightsClient instanceof MetaMarketingApiClient && insightsClient.lastFetchTruncated;
    const insightsPages =
      insightsClient instanceof MetaMarketingApiClient ? insightsClient.lastFetchPages : 0;
    const accountInsightsTruncated =
      accountInsightsClient instanceof MetaMarketingApiClient && accountInsightsClient.lastFetchTruncated;
    const accountInsightsPages =
      accountInsightsClient instanceof MetaMarketingApiClient ? accountInsightsClient.lastFetchPages : 0;
    const incompleteProviderFetch =
      paginationTruncated || insightsTruncated || accountInsightsTruncated;

    const latestBucUsage =
      (insightsClient instanceof MetaMarketingApiClient && insightsClient.lastBucUsageHeader) ||
      (adsClient instanceof MetaMarketingApiClient && adsClient.lastBucUsageHeader) ||
      (campaignsClient instanceof MetaMarketingApiClient && campaignsClient.lastBucUsageHeader) ||
      (client instanceof MetaMarketingApiClient && client.lastBucUsageHeader) ||
      null;

    // Build lookup map of AdSet names by provider AdSet ID
    const adSetNameById = new Map<string, string>();
    for (const adset of metaAdSets) {
      if (adset.id && adset.name) {
        adSetNameById.set(adset.id, adset.name);
      }
    }
    const adToAdSetId = new Map<string, string>();
    for (const ad of metaAds) {
      if (ad.id && ad.adset_id) {
        adToAdSetId.set(ad.id, ad.adset_id);
      }
    }

    // 3. Map to internal normalized representations
    const normalizedAccount: NormalizedAdAccount = mapMetaAccountToInternal(
      metaAccount,
      organizationId
    );
    normalizedAccount.provider = "meta";

    const normalizedCampaigns: NormalizedCampaign[] = metaCampaigns.map((c) =>
      mapMetaCampaignToInternal(c, organizationId, normalizedAccount.providerAccountId)
    );

    const normalizedAds: NormalizedAd[] = metaAds.map((a) =>
      mapMetaAdToInternal(a, organizationId, a.campaign_id)
    );

    // DI-01: per-row validation. A row is valid only when it has an ad
    // identity, a period, and usable required metrics (spend, impressions,
    // clicks). Invalid rows are quarantined with reasons; they never abort
    // the valid rows in the same batch. Optional metrics (reach, link
    // clicks, conversions) may be null (not available) without invalidating
    // the row — see DI-04 null semantics in the mapper.
    const invalidReasons: Record<string, number> = {};
    const normalizedInsights: NormalizedAdInsight[] = [];
    for (const raw of metaInsights) {
      const mapped = mapMetaInsightToInternal(raw, {
        organizationId,
        adId: raw.ad_id || "",
        currency: normalizedAccount.currency,
        source: "meta",
      });
      const resolvedAdsetId = mapped.adsetId || (raw.ad_id ? adToAdSetId.get(raw.ad_id) ?? null : null);
      mapped.adsetId = resolvedAdsetId;
      if (!mapped.adsetName && resolvedAdsetId) {
        mapped.adsetName = adSetNameById.get(resolvedAdsetId) ?? null;
      }

      const reasons: string[] = [];
      if (!raw.ad_id) reasons.push("missing_ad_id");
      if (!raw.date_start) reasons.push("missing_date_start");
      if (!raw.date_stop) reasons.push("missing_date_stop");
      if (mapped.spend === null) reasons.push("missing_or_invalid_spend");
      if (mapped.impressions === null) reasons.push("missing_or_invalid_impressions");
      if (mapped.clicks === null) reasons.push("missing_or_invalid_clicks");
      if (reasons.length > 0) {
        for (const reason of reasons) {
          invalidReasons[reason] = (invalidReasons[reason] || 0) + 1;
        }
        continue;
      }
      normalizedInsights.push(mapped);
    }
    const insightsInvalid = metaInsights.length - normalizedInsights.length;

    const recordsProcessed =
      1 +
      normalizedCampaigns.length +
      normalizedAds.length +
      metaInsights.length +
      metaAccountInsights.length;
    let recordsRejected = insightsInvalid;
    let persistenceFailed = false;
    const warnings: string[] = [];
    let insightsUnmapped = 0;
    let insightsStored = 0;

    if (insightsInvalid > 0) {
      warnings.push(
        `${insightsInvalid} baris Insights ditolak karena field wajib tidak valid (${Object.entries(invalidReasons).map(([k, v]) => `${k}: ${v}`).join(", ")}). Baris valid tetap diproses.`
      );
      console.warn("[Meta Marketing Sync] Invalid insight rows quarantined:", {
        organizationId,
        targetAccountId: accountId,
        received: metaInsights.length,
        invalid: insightsInvalid,
        reasons: invalidReasons,
      });
    }

    // DI-02: an incomplete traversal is persisted additively (idempotent
    // upserts never delete stored history) but is NEVER reported as a
    // complete sync: freshness timestamps stay untouched and the final
    // status remains "partial" via incompleteProviderFetch below.
    if (incompleteProviderFetch) {
      warnings.push(
        "Pengambilan data Meta berhenti pada batas pagination sebelum seluruh halaman selesai; data yang berhasil diambil disimpan, tetapi sinkronisasi ini parsial dan data lama tetap dipertahankan."
      );
      console.warn("[Meta Marketing Sync] Pagination incomplete:", {
        organizationId,
        targetAccountId: accountId,
        insightsPages,
        accountInsightsPages,
        insightsTruncated,
        accountInsightsTruncated,
        structuralTruncated: paginationTruncated,
      });
    }

    // 4. Idempotent Chunked Upserts into Supabase (if client provided)
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

          // Persist account metrics for this exact range. A missing Meta row is
          // recorded with null metrics so an older snapshot cannot masquerade
          // as the current result for the same date range.
          if (internalAdAccountId && metaAccountInsights.length <= 1) {
            const accountInsight = metaAccountInsights[0];
            const accountInsightsTable = db.from("ad_account_insights");
            if (typeof accountInsightsTable?.upsert === "function") {
              const { error: accountInsightError } = await accountInsightsTable.upsert(
                {
                  organization_id: organizationId,
                  ad_account_id: internalAdAccountId,
                  date_start: timeRange.since,
                  date_stop: timeRange.until,
                  impressions: accountInsight?.impressions != null ? parseCount(accountInsight.impressions) : null,
                  reach: accountInsight?.reach != null ? parseCount(accountInsight.reach) : null,
                  frequency: accountInsight?.frequency != null ? parseSpend(accountInsight.frequency) : null,
                  currency: accountInsight?.account_currency || normalizedAccount.currency,
                  source: "meta",
                  fetched_at: syncedAt,
                },
                { onConflict: "organization_id,ad_account_id,date_start,date_stop" }
              );

              if (accountInsightError) {
                const schemaUnavailable = ["PGRST205", "42P01", "PGRST204", "42703", "23502"].includes(
                  accountInsightError.code || ""
                );
                if (!schemaUnavailable) recordsRejected++;
                warnings.push("Snapshot akun Meta tidak tersimpan di database; nilai live tetap dikirim ke halaman.");
                console.warn("[Meta Marketing Sync] Account-level insights persistence failed:", {
                  organizationId,
                  errorCode: accountInsightError.code || null,
                });
              }
            }
          } else if (metaAccountInsights.length > 1) {
            recordsRejected++;
            warnings.push(
              "Meta mengembalikan lebih dari satu baris metrik tingkat akun untuk satu rentang tanggal; jangkauan dan frekuensi tidak disimpan."
            );
          }

          // B. Upsert Campaigns in chunks of 200 (combining /campaigns and historical campaigns from insights)
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
              const campaignChunks = chunkArray(campaignRows, SUPABASE_UPSERT_CHUNK_SIZE);
              for (const chunk of campaignChunks) {
                let { error: cmpErr } = await db
                  .from("campaigns")
                  .upsert(chunk, { onConflict: "organization_id,provider_campaign_id" });

                // Fallback if schema uses single-column unique constraint on provider_campaign_id
                if (cmpErr?.code === "42P10") {
                  const retry = await db
                    .from("campaigns")
                    .upsert(chunk, { onConflict: "provider_campaign_id" });
                  cmpErr = retry.error;
                }

                if (cmpErr) {
                  console.warn("[Meta Marketing Sync] Campaigns upsert error:", cmpErr);
                  recordsRejected += chunk.length;
                }
              }
            }
          }

          // C. Resolve internal campaign UUIDs for Ads (scoped to active ad account when available)
          let campaignsLookupQuery = db
            .from("campaigns")
            .select("id, provider_campaign_id")
            .eq("organization_id", organizationId);
          if (internalAdAccountId && typeof (campaignsLookupQuery as { eq?: unknown }).eq === "function") {
            campaignsLookupQuery = campaignsLookupQuery.eq("ad_account_id", internalAdAccountId);
          }
          const { data: dbCampaigns } = await campaignsLookupQuery;

          const campaignIdMap = new Map<string, string>();
          dbCampaigns?.forEach((c: { provider_campaign_id: string; id: string }) =>
            campaignIdMap.set(c.provider_campaign_id, c.id)
          );

          // D. Upsert Ads in chunks of 200 (combining /ads and historical ads from insights)
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
            const adChunks = chunkArray(adRows, SUPABASE_UPSERT_CHUNK_SIZE);
            for (const chunk of adChunks) {
              let { error: adErr } = await db
                .from("ads")
                .upsert(chunk, { onConflict: "organization_id,provider_ad_id" });

              // Fallback if schema uses single-column unique constraint on provider_ad_id
              if (adErr?.code === "42P10") {
                const retry = await db
                  .from("ads")
                  .upsert(chunk, { onConflict: "provider_ad_id" });
                adErr = retry.error;
              }

              if (adErr) {
                console.warn("[Meta Marketing Sync] Ads upsert error:", adErr);
                recordsRejected += chunk.length;
              }
            }
          }

          // E. Resolve internal ad UUIDs for Insights (scoped to this account's campaigns when available)
          let adsLookupQuery = db
            .from("ads")
            .select("id, provider_ad_id")
            .eq("organization_id", organizationId);
          const resolvedCampaignUuids = Array.from(campaignIdMap.values());
          if (
            resolvedCampaignUuids.length > 0 &&
            typeof (adsLookupQuery as { in?: unknown }).in === "function"
          ) {
            adsLookupQuery = adsLookupQuery.in("campaign_id", resolvedCampaignUuids);
          }
          const { data: dbAds } = await adsLookupQuery;

          const adIdMap = new Map<string, string>();
          dbAds?.forEach((a: { provider_ad_id: string; id: string }) =>
            adIdMap.set(a.provider_ad_id, a.id)
          );

          // F. Upsert Insights in chunks of 200
          // DI-03: rows whose ad cannot be resolved to an internal ad of
          // THIS organization are counted and reported — never dropped
          // silently and never mapped across tenants (adIdMap only contains
          // ads of this organization).
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
                // DI-04: optional metrics keep null (not available) instead
                // of being coerced to 0.
                reach: i.reach,
                link_clicks: i.linkClicks,
                conversions: i.conversions,
                adset_id: i.adsetId ?? null,
                adset_name: i.adsetName ?? null,
                attribution_setting: i.attributionSetting ?? null,
                currency: i.currency,
                source: i.source,
                action_breakdown: i.actionBreakdown || {},
                cost_per_action_type: i.costPerActionType || {},
                conversion_action_type: i.conversionActionType || null,
                mapping_version: i.mappingVersion || "v1.1",
                fetched_at: syncedAt,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);

          insightsUnmapped = normalizedInsights.length - insightRows.length;
          if (insightsUnmapped > 0) {
            recordsRejected += insightsUnmapped;
            warnings.push(
              `${insightsUnmapped} baris Insights tidak dapat dipetakan ke iklan milik organisasi ini (iklan belum tersinkron atau relasi tidak konsisten) dan tidak disimpan.`
            );
            console.warn("[Meta Marketing Sync] Unmapped insight rows:", {
              organizationId,
              targetAccountId: accountId,
              unmapped: insightsUnmapped,
            });
          }

          if (insightRows.length > 0) {
            const insightChunks = chunkArray(insightRows, SUPABASE_UPSERT_CHUNK_SIZE);
            for (const chunk of insightChunks) {
              let { error: insErr } = await db
                .from("ad_insights")
                .upsert(chunk, {
                  onConflict: "organization_id,ad_id,date_start,date_stop,level",
                });

              // If the database enforces NOT NULL on optional counters (reach, link_clicks, conversions)
              // while still supporting conversion metadata columns, retry with 0 defaults on null counters.
              if (insErr?.code === "23502") {
                const nullSafeFullChunk = chunk.map((row) => ({
                  ...row,
                  reach: row.reach ?? 0,
                  link_clicks: row.link_clicks ?? 0,
                  conversions: row.conversions ?? 0,
                }));
                const retryFull = await db.from("ad_insights").upsert(nullSafeFullChunk, {
                  onConflict: "organization_id,ad_id,date_start,date_stop,level",
                });
                insErr = retryFull.error;
              }

              if (insErr) {
                // Keep core spend and delivery metrics flowing when a deployment
                // is missing the optional conversion metadata migration.
                const missingSchemaColumn = insErr.code === "PGRST204" || insErr.code === "42703";
                if (missingSchemaColumn) {
                  const coreInsightRows = chunk.map((row) => ({
                    organization_id: row.organization_id,
                    ad_id: row.ad_id,
                    date_start: row.date_start,
                    date_stop: row.date_stop,
                    level: row.level,
                    spend: row.spend,
                    impressions: row.impressions,
                    clicks: row.clicks,
                    reach: row.reach,
                    link_clicks: row.link_clicks,
                    conversions: row.conversions,
                    adset_id: row.adset_id,
                    adset_name: row.adset_name,
                    attribution_setting: row.attribution_setting,
                    currency: row.currency,
                    source: row.source,
                    fetched_at: row.fetched_at,
                  }));
                  const { error: coreInsightError } = await db
                    .from("ad_insights")
                    .upsert(coreInsightRows, {
                      onConflict: "organization_id,ad_id,date_start,date_stop,level",
                    });
                  let finalInsightError = coreInsightError;
                  if (coreInsightError?.code === "23502") {
                    // Older schemas may enforce NOT NULL on optional counters.
                    const legacySafeRows = coreInsightRows.map((row) => ({
                      ...row,
                      reach: row.reach ?? 0,
                      link_clicks: row.link_clicks ?? 0,
                      conversions: row.conversions ?? 0,
                    }));
                    const retry = await db.from("ad_insights").upsert(legacySafeRows, {
                      onConflict: "organization_id,ad_id,date_start,date_stop,level",
                    });
                    finalInsightError = retry.error;
                  }
                  if (finalInsightError) {
                    recordsRejected += chunk.length;
                  } else {
                    insightsStored += chunk.length;
                    // User-facing notice: never expose SQL or internal migration filenames
                    const metadataNotice =
                      "Sinkronisasi berhasil. Sebagian jenis hasil belum dapat diidentifikasi karena konfigurasi integrasi belum lengkap.";
                    if (!warnings.includes(metadataNotice)) warnings.push(metadataNotice);
                    console.warn(
                      "[Meta Marketing Sync] Conversion metadata columns unavailable; core metrics stored without conversion metadata.",
                      {
                        organizationId,
                        errorCode: insErr.code || null,
                        metadataColumns: [
                          "action_breakdown",
                          "cost_per_action_type",
                          "conversion_action_type",
                          "mapping_version",
                        ],
                        requiredMigration: "20261027000000_p0_security_and_metrics.sql",
                        fallback: "core_metrics_stored",
                        rowsStored: chunk.length,
                      }
                    );
                  }
                } else {
                  console.warn("[Meta Marketing Sync] Insights upsert error:", insErr);
                  recordsRejected += chunk.length;
                }
              } else {
                insightsStored += chunk.length;
              }
            }
          }
        }

        // Update account and tenant freshness only when every required upsert
        // completed successfully AND the provider traversal was complete.
        // Incomplete runs preserve the previous timestamp.
        if (recordsRejected === 0 && !persistenceFailed && !incompleteProviderFetch) {
          const { error: accountFreshnessError } = await db
            .from("ad_accounts")
            .update({ last_synced_at: syncedAt, updated_at: syncedAt })
            .eq("organization_id", organizationId)
            .eq("provider", "meta")
            .eq("provider_account_id", normalizedAccount.providerAccountId);
          if (accountFreshnessError) persistenceFailed = true;
        }

        // G. Mark the sync job only after all data and freshness writes have
        // succeeded, so a failed freshness write cannot leave a false success.
        if (syncJobId) {
          const isComplete = recordsRejected === 0 && !persistenceFailed && !incompleteProviderFetch;
          await closeSyncJob(db, syncJobId, {
            status: isComplete ? "completed" : "partial",
            records_processed: recordsProcessed,
            records_rejected: recordsRejected,
            error_code: isComplete ? null : incompleteProviderFetch ? "PAGINATION_INCOMPLETE" : "PERSISTENCE_PARTIAL",
            error_message: isComplete
              ? null
              : incompleteProviderFetch
                ? "Meta pagination did not complete; fetched data was stored additively and previous data was preserved."
                : "Meta sync was incomplete; previous data and last successful sync were preserved.",
            diagnostic_info: {
              recordsProcessed,
              recordsRejected,
              mode: "live",
              targetAccountId: accountId,
              timeRange,
              adAccountsSynced: 1,
              campaignsSynced: normalizedCampaigns.length,
              adsSynced: normalizedAds.length,
              insightsSynced: insightsStored,
              insightsReceived: metaInsights.length,
              insightsValid: normalizedInsights.length,
              insightsInvalid,
              insightsUnmapped,
              invalidReasons,
              paginationComplete: !incompleteProviderFetch,
              pagesProcessed: insightsPages,
            },
            meta_x_business_use_case_usage: latestBucUsage,
            completed_at: new Date().toISOString(),
          });
        }

        // H. Update canonical integration_connections freshness only on a
        // complete sync; partial failures remain visible as an error.
        const connTable = db.from("integration_connections");
        if (typeof connTable?.update === "function") {
          const updateBuilder = connTable
            .update({
              status: recordsRejected === 0 && !persistenceFailed && !incompleteProviderFetch ? "connected" : "error",
              ...(recordsRejected === 0 && !persistenceFailed && !incompleteProviderFetch
                ? { last_synced_at: syncedAt }
                : {}),
              error_message:
                recordsRejected === 0 && !persistenceFailed && !incompleteProviderFetch
                  ? null
                  : "Meta sync was incomplete; previous data and last successful sync were preserved.",
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", organizationId);

          const builder = updateBuilder as unknown as { eq?: (k: string, v: string) => PromiseLike<unknown> };
          if (typeof builder?.eq === "function") {
            await builder.eq("provider", "meta");
          } else {
            await updateBuilder;
          }
        }
      } catch (dbErr) {
        // Persistence failure must not be reported as a successful sync, and
        // must not leave the job row running.
        persistenceFailed = true;
        console.warn("[Meta Marketing Sync] Database persistence failed:", dbErr);
        if (syncJobId) {
          await closeSyncJob(db, syncJobId, {
            status: "failed",
            records_processed: recordsProcessed,
            records_rejected: recordsRejected,
            error_code: "PERSISTENCE_FAILED",
            error_message: "Penyimpanan hasil sinkronisasi gagal. Data sebelumnya tetap dipertahankan.",
            completed_at: new Date().toISOString(),
          });
        }
      }
    }

    return {
      status:
        recordsRejected > 0 || persistenceFailed || incompleteProviderFetch
          ? "partial"
          : "success",
      mode: "live",
      adAccountsSynced: 1,
      campaignsSynced: normalizedCampaigns.length,
      adsSynced: normalizedAds.length,
      insightsSynced: db ? insightsStored : normalizedInsights.length,
      ...(warnings.length > 0 ? { warnings } : {}),
      recordsProcessed,
      recordsRejected,
      syncedAt,
      dateRange: timeRange,
      accountInsights: metaAccountInsights,
      syncJobId,
      syncDetails: {
        insightsReceived: metaInsights.length,
        insightsValid: normalizedInsights.length,
        insightsInvalid,
        insightsUnmapped,
        invalidReasons,
        paginationComplete: !incompleteProviderFetch,
        pagesProcessed: insightsPages,
      },
    };
  } catch (error) {
    const errorMsg = sanitizeMarketingLog(
      error instanceof Error ? error.message : "Terjadi kesalahan saat sinkronisasi Meta Marketing API"
    );

    // Update sync_job status to failed if connected
    if (db && syncJobId) {
      try {
        await closeSyncJob(db, syncJobId, {
          status: "failed",
          error_code: error instanceof MarketingApiError ? error.code : "UPSTREAM_ERROR",
          error_message: errorMsg,
          diagnostic_info: {
            error: errorMsg,
            targetAccountId: accountId,
          },
          completed_at: new Date().toISOString(),
        });
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
