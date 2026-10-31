import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { MetaMarketingApiClient } from "./client";
import { decryptAccessToken } from "@/lib/security/credential-crypto";
import { normalizeAdAccountId } from "./config";
import { MarketingApiError } from "./types";
import type {
  MetaAvailableAssetsResponse,
  MetaAssetSelection,
  MetaFacebookPage,
  MetaAdAccountResponse,
  MetaTokenStatus,
} from "./types";

/**
 * Tenant-scoped Meta asset access.
 *
 * CRITICAL TENANT RULE: Meta assets are listed ONLY with the organization's
 * own encrypted OAuth token (meta_user_tokens). The global
 * META_ACCESS_TOKEN environment variable must never be used to list or
 * select assets for a tenant — that was the root cause of tenants seeing
 * the platform operator's Facebook Page and Ad Account.
 */
async function fetchTenantToken(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string
): Promise<{ token: string | null; status: MetaTokenStatus }> {
  const { data: row, error } = await admin
    .from("meta_user_tokens")
    .select("encrypted_access_token, encryption_iv, encryption_tag, expires_at, granted_scopes")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error("Tidak dapat memeriksa kredensial koneksi Meta ini.");

  if (!row?.encrypted_access_token) return { token: null, status: "not_connected" };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { token: null, status: "invalid" };
  }
  if (Array.isArray(row.granted_scopes) && row.granted_scopes.length > 0 && !row.granted_scopes.includes("ads_read")) {
    return { token: null, status: "permission_insufficient" };
  }
  try {
    return {
      token: decryptAccessToken(row.encrypted_access_token, row.encryption_iv, row.encryption_tag),
      status: "valid",
    };
  } catch {
    return { token: null, status: "invalid" };
  }
}

export async function getAvailableAndSelectedMetaAssets(
  organizationId: string
): Promise<MetaAvailableAssetsResponse> {
  const admin = createAdminClient();

  const { data: savedSelection } = await admin
    .from("meta_asset_selections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const selected: MetaAssetSelection | null = savedSelection
    ? {
        id: savedSelection.id,
        organizationId: savedSelection.organization_id,
        pageId: savedSelection.page_id,
        pageName: savedSelection.page_name,
        instagramAccountId: savedSelection.instagram_account_id,
        instagramUsername: savedSelection.instagram_username,
        adAccountId: savedSelection.ad_account_id,
        adAccountName: savedSelection.ad_account_name,
        connectionStatus: savedSelection.connection_status as MetaAssetSelection["connectionStatus"],
        lastValidatedAt: savedSelection.last_validated_at,
      }
    : null;

  const { data: connectedRows, error: connectedError } = await admin
    .from("ad_accounts")
    .select("provider_account_id, account_name, currency, timezone, connection_status, last_synced_at")
    .eq("organization_id", organizationId)
    .eq("provider", "meta")
    .eq("connection_status", "connected");
  if (connectedError) throw new Error("Tidak dapat memuat akun Meta yang sudah disimpan.");
  const connectedAccounts = (connectedRows || []).map((r) => ({
    adAccountId: r.provider_account_id,
    adAccountName: r.account_name,
    currency: r.currency,
    timezone: r.timezone,
    connectionStatus: r.connection_status,
    lastSyncedAt: r.last_synced_at,
  }));

  const { token, status } = await fetchTenantToken(admin, organizationId);
  if (!token) {
    return { pages: [], adAccounts: [], selected, tokenStatus: status, connectedAccounts };
  }

  const client = new MetaMarketingApiClient({ accessToken: token });
  const [pagesResult, accountsResult] = await Promise.allSettled([
    client.getFacebookPages(),
    client.getAdAccounts(),
  ]);

  const pages: MetaFacebookPage[] = pagesResult.status === "fulfilled" ? pagesResult.value : [];
  const adAccounts: MetaAdAccountResponse[] =
    accountsResult.status === "fulfilled" ? accountsResult.value : [];

  let tokenStatus: MetaTokenStatus = "valid";
  let accountError: MetaAvailableAssetsResponse["accountError"] = null;
  if (accountsResult.status === "rejected") {
    const reason = accountsResult.reason;
    tokenStatus =
      reason instanceof MarketingApiError && reason.code === "AUTHENTICATION_ERROR"
        ? "invalid"
        : reason instanceof MarketingApiError && reason.code === "PERMISSION_ERROR"
          ? "permission_insufficient"
          : "unknown";
    accountError = reason instanceof MarketingApiError && reason.code === "RATE_LIMIT_ERROR"
      ? "rate_limited"
      : reason instanceof MarketingApiError && reason.code === "TIMEOUT_ERROR"
        ? "network_error"
        : reason instanceof MarketingApiError && reason.code === "PAGINATION_ERROR"
          ? "pagination_error"
          : "api_error";
  }

  return { pages, adAccounts, accountError, selected, tokenStatus, connectedAccounts };
}

/**
 * Saves the tenant's selected Meta assets. The selection is validated
 * server-side against the assets actually returned by Meta for THIS
 * organization's token: a client-supplied ad account / page / Instagram ID
 * that is not in that list is rejected. Client-supplied names are ignored
 * in favour of the names returned by Meta.
 */
export async function saveSelectedMetaAssets(
  organizationId: string,
  userId: string,
  payload: {
    pageId?: string | null;
    pageName?: string | null;
    instagramAccountId?: string | null;
    instagramUsername?: string | null;
    adAccountId: string;
    adAccountName?: string | null;
  }
): Promise<MetaAssetSelection> {
  if (!payload.adAccountId || payload.adAccountId.trim() === "") {
    throw new Error("Ad Account ID wajib dipilih.");
  }

  const assets = await getAvailableAndSelectedMetaAssets(organizationId);
  if (assets.tokenStatus === "not_connected" || assets.tokenStatus === "invalid") {
    throw new Error("Koneksi Meta tenant tidak valid. Hubungkan ulang akun Meta terlebih dahulu.");
  }
  if (assets.tokenStatus === "permission_insufficient") {
    throw new Error("Izin Meta tidak mencukupi (ads_read diperlukan). Hubungkan ulang dan setujui izin bacaan iklan.");
  }

  const wantedAccount = normalizeAdAccountId(payload.adAccountId);
  const matchedAccount = assets.adAccounts.find(
    (a) => normalizeAdAccountId(a.id || a.account_id) === wantedAccount
  );
  if (!matchedAccount) {
    throw new Error("Akun iklan yang dipilih tidak termasuk aset pada koneksi Meta ini.");
  }

  let matchedPage: MetaFacebookPage | undefined;
  if (payload.pageId) {
    matchedPage = assets.pages.find((p) => p.id === payload.pageId);
    if (!matchedPage) {
      throw new Error("Facebook Page yang dipilih tidak termasuk aset pada koneksi Meta ini.");
    }
  }

  const ig = matchedPage?.instagram_business_account;
  if (payload.instagramAccountId && payload.instagramAccountId !== ig?.id) {
    throw new Error("Akun Instagram yang dipilih tidak terhubung dengan Facebook Page terpilih.");
  }

  const admin = createAdminClient();
  const adAccountName = matchedAccount.name || wantedAccount;
  const pageName = matchedPage?.name || null;

  const { data: upserted, error: selError } = await admin
    .from("meta_asset_selections")
    .upsert(
      {
        organization_id: organizationId,
        page_id: matchedPage?.id || null,
        page_name: pageName,
        instagram_account_id: ig?.id || null,
        instagram_username: ig?.username || null,
        ad_account_id: wantedAccount,
        ad_account_name: adAccountName,
        connection_status: "connected",
        last_validated_at: new Date().toISOString(),
        connected_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    )
    .select()
    .single();

  if (selError || !upserted) {
    throw new Error(`Gagal menyimpan pilihan aset Meta: ${selError?.message || "Database error"}`);
  }

  await admin.from("ad_accounts").upsert(
    {
      organization_id: organizationId,
      provider: "meta",
      provider_account_id: wantedAccount,
      account_name: adAccountName,
      currency: matchedAccount.currency || null,
      timezone: matchedAccount.timezone_name || null,
      connection_status: "connected",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider,provider_account_id" }
  );

  await admin.from("integration_connections").upsert(
    {
      organization_id: organizationId,
      provider: "meta",
      status: "connected",
      external_account_id: wantedAccount,
      external_account_name: adAccountName,
      metadata: {
        page_id: matchedPage?.id || null,
        page_name: pageName,
        instagram_account_id: ig?.id || null,
        instagram_username: ig?.username || null,
      },
      connected_by: userId,
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider" }
  );

  return {
    id: upserted.id,
    organizationId: upserted.organization_id,
    pageId: upserted.page_id,
    pageName: upserted.page_name,
    instagramAccountId: upserted.instagram_account_id,
    instagramUsername: upserted.instagram_username,
    adAccountId: upserted.ad_account_id,
    adAccountName: upserted.ad_account_name,
    connectionStatus: upserted.connection_status as MetaAssetSelection["connectionStatus"],
    lastValidatedAt: upserted.last_validated_at,
  };
}

/**
 * Saves MULTIPLE selected ad accounts for the organization. Every account is
 * validated against the live list returned by Meta for this tenant's token.
 * Idempotent: ad_accounts upserts on (organization_id, provider, account).
 * The first account becomes the active dashboard selection when no active
 * selection is among the saved accounts.
 */
export async function saveSelectedMetaAccounts(
  organizationId: string,
  userId: string,
  payload: {
    adAccountIds: string[];
    pageId?: string | null;
  }
): Promise<{ saved: ConnectedAdAccountLike[]; active: MetaAssetSelection }> {
  const wanted = Array.from(
    new Set((payload.adAccountIds || []).map((id) => normalizeAdAccountId(id)).filter(Boolean))
  );
  if (wanted.length === 0) throw new Error("Pilih minimal satu akun iklan.");

  const assets = await getAvailableAndSelectedMetaAssets(organizationId);
  if (assets.tokenStatus === "not_connected" || assets.tokenStatus === "invalid") {
    throw new Error("Koneksi Meta tenant tidak valid. Hubungkan ulang akun Meta terlebih dahulu.");
  }
  if (assets.tokenStatus === "permission_insufficient") {
    throw new Error("Izin Meta tidak mencukupi (ads_read diperlukan). Hubungkan ulang dan setujui izin bacaan iklan.");
  }

  const byId = new Map(
    assets.adAccounts.map((a) => [normalizeAdAccountId(a.id || a.account_id), a])
  );
  for (const id of wanted) {
    if (!byId.has(id)) {
      throw new Error(`Akun iklan ${id} tidak termasuk aset pada koneksi Meta ini.`);
    }
  }

  let matchedPage: MetaFacebookPage | undefined;
  if (payload.pageId) {
    matchedPage = assets.pages.find((p) => p.id === payload.pageId);
    if (!matchedPage) {
      throw new Error("Facebook Page yang dipilih tidak termasuk aset pada koneksi Meta ini.");
    }
  }

  const admin = createAdminClient();
  const saved: ConnectedAdAccountLike[] = [];
  for (const id of wanted) {
    const acc = byId.get(id)!;
    const { error: accountError } = await admin.from("ad_accounts").upsert(
      {
        organization_id: organizationId,
        provider: "meta",
        provider_account_id: id,
        account_name: acc.name || id,
        currency: acc.currency || null,
        timezone: acc.timezone_name || null,
        connection_status: "connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider,provider_account_id" }
    );
    if (accountError) {
      throw new Error(`Gagal menyimpan akun iklan ${id} ke koneksi Meta ini.`);
    }
    saved.push({
      adAccountId: id,
      adAccountName: acc.name || id,
      currency: acc.currency || null,
      timezone: acc.timezone_name || null,
      connectionStatus: "connected",
      lastSyncedAt: null,
    });
  }

  // Active selection: keep the current active account if it remains saved,
  // otherwise activate the first saved account.
  const currentActive = assets.selected?.connectionStatus === "connected"
    ? normalizeAdAccountId(assets.selected.adAccountId)
    : null;
  const activeId = currentActive && wanted.includes(currentActive) ? currentActive : wanted[0];
  const activeAcc = byId.get(activeId)!;
  const ig = matchedPage?.instagram_business_account;

  const { data: upserted, error } = await admin
    .from("meta_asset_selections")
    .upsert(
      {
        organization_id: organizationId,
        page_id: matchedPage?.id || assets.selected?.pageId || null,
        page_name: matchedPage?.name || assets.selected?.pageName || null,
        instagram_account_id: ig?.id || assets.selected?.instagramAccountId || null,
        instagram_username: ig?.username || assets.selected?.instagramUsername || null,
        ad_account_id: activeId,
        ad_account_name: activeAcc.name || activeId,
        connection_status: "connected",
        last_validated_at: new Date().toISOString(),
        connected_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    )
    .select()
    .single();
  if (error || !upserted) {
    throw new Error(`Gagal menyimpan pilihan akun: ${error?.message || "Database error"}`);
  }

  await admin.from("integration_connections").upsert(
    {
      organization_id: organizationId,
      provider: "meta",
      status: "connected",
      external_account_id: activeId,
      external_account_name: activeAcc.name || activeId,
      error_message: null,
      connected_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider" }
  );

  return {
    saved,
    active: {
      id: upserted.id,
      organizationId: upserted.organization_id,
      pageId: upserted.page_id,
      pageName: upserted.page_name,
      instagramAccountId: upserted.instagram_account_id,
      instagramUsername: upserted.instagram_username,
      adAccountId: upserted.ad_account_id,
      adAccountName: upserted.ad_account_name,
      connectionStatus: upserted.connection_status as MetaAssetSelection["connectionStatus"],
      lastValidatedAt: upserted.last_validated_at,
    },
  };
}

export interface ConnectedAdAccountLike {
  adAccountId: string;
  adAccountName: string | null;
  currency: string | null;
  timezone: string | null;
  connectionStatus: string;
  lastSyncedAt: string | null;
}

/**
 * Removes ONE ad account from the organization's Haspro integration.
 * The Meta ad account itself is untouched. If the removed account was the
 * active selection, the next connected account becomes active, or the
 * selection is marked disconnected when none remain.
 */
export async function removeSelectedMetaAccount(
  organizationId: string,
  adAccountId: string
): Promise<{ removed: string; activeAdAccountId: string | null }> {
  const wanted = normalizeAdAccountId(adAccountId);
  const admin = createAdminClient();

  const { data: accRow } = await admin
    .from("ad_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider_account_id", wanted)
    .maybeSingle();
  if (!accRow) {
    throw new Error("Akun iklan tidak termasuk koneksi Meta ini.");
  }

  await admin
    .from("ad_accounts")
    .update({ connection_status: "disconnected", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("provider_account_id", wanted);

  const { data: remaining } = await admin
    .from("ad_accounts")
    .select("provider_account_id, account_name")
    .eq("organization_id", organizationId)
    .eq("provider", "meta")
    .eq("connection_status", "connected");

  const next = remaining?.[0];
  if (next) {
    await admin
      .from("meta_asset_selections")
      .update({
        ad_account_id: next.provider_account_id,
        ad_account_name: next.account_name,
        connection_status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("ad_account_id", wanted);
    return { removed: wanted, activeAdAccountId: next.provider_account_id };
  }

  await admin
    .from("meta_asset_selections")
    .update({ connection_status: "disconnected", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("ad_account_id", wanted);
  await admin
    .from("integration_connections")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("provider", "meta");
  return { removed: wanted, activeAdAccountId: null };
}

/**
 * Disconnects ONLY this organization's Meta connection. It does not delete
 * the Meta assets themselves and does not revoke the user's global Facebook
 * app grant; stored credentials for this organization are removed so a
 * later reconnect starts from a clean, re-authorized state.
 */
export async function disconnectMetaAssets(
  organizationId: string
): Promise<void> {
  const admin = createAdminClient();

  await admin.from("meta_user_tokens").delete().eq("organization_id", organizationId);

  await admin
    .from("meta_asset_selections")
    .update({
      connection_status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  await admin
    .from("ad_accounts")
    .update({
      connection_status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  await admin
    .from("integration_connections")
    .update({
      status: "disconnected",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("provider", "meta");
}
