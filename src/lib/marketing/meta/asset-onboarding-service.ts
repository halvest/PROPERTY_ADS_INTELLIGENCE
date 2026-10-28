import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { MetaMarketingApiClient } from "./client";
import { MockMetaMarketingApiClient } from "./mock-client";
import { isMetaMarketingConfigured } from "./config";
import { decryptAccessToken } from "@/lib/whatsapp/crypto";
import type {
  MetaAvailableAssetsResponse,
  MetaAssetSelection,
  MetaFacebookPage,
  MetaAdAccountResponse,
} from "./types";

/**
 * Retrieves available Facebook Pages, Instagram accounts, and Ad Accounts
 * accessible to the organization, along with the currently saved selection.
 */
export async function getAvailableAndSelectedMetaAssets(
  organizationId: string,
  options: { forceMock?: boolean } = {}
): Promise<MetaAvailableAssetsResponse> {
  const admin = createAdminClient();

  // 1. Fetch currently saved asset selection from DB
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

  // 2. Determine whether to use Live Meta Graph API or Mock Client
  const hasServerConfig = isMetaMarketingConfigured();

  // Also check if tenant has an encrypted user token stored
  const { data: userTokenRow } = await admin
    .from("meta_user_tokens")
    .select("encrypted_access_token, encryption_iv, encryption_tag")
    .eq("organization_id", organizationId)
    .maybeSingle();

  let pages: MetaFacebookPage[] = [];
  let adAccounts: MetaAdAccountResponse[] = [];

  if (options.forceMock) {
    // Explicit demo / test mode only
    const mockClient = new MockMetaMarketingApiClient();
    pages = await mockClient.getFacebookPages();
    adAccounts = await mockClient.getAdAccounts();
  } else if (hasServerConfig || userTokenRow) {
    try {
      let activeToken: string | undefined;

      if (userTokenRow) {
        activeToken = decryptAccessToken(
          userTokenRow.encrypted_access_token,
          userTokenRow.encryption_iv,
          userTokenRow.encryption_tag
        );
      }

      const client = new MetaMarketingApiClient({
        accessToken: activeToken,
      });

      pages = await client.getFacebookPages().catch(() => []);
      adAccounts = await client.getAdAccounts().catch(() => []);
    } catch {
      // Never fall back to mock data silently on failure
      pages = [];
      adAccounts = [];
    }
  } else {
    // Disconnected state: honest empty assets
    pages = [];
    adAccounts = [];
  }

  return {
    pages,
    adAccounts,
    selected,
  };
}

/**
 * Saves and validates the user's selected Meta assets (Page, Instagram, Ad Account) for the tenant.
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

  const admin = createAdminClient();

  // 1. Upsert selection in meta_asset_selections
  const { data: upserted, error: selError } = await admin
    .from("meta_asset_selections")
    .upsert(
      {
        organization_id: organizationId,
        page_id: payload.pageId || null,
        page_name: payload.pageName || null,
        instagram_account_id: payload.instagramAccountId || null,
        instagram_username: payload.instagramUsername || null,
        ad_account_id: payload.adAccountId,
        ad_account_name: payload.adAccountName || null,
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

  // 2. Synchronize selected ad account into ad_accounts registry
  const normalizedAdId = payload.adAccountId.startsWith("act_")
    ? payload.adAccountId
    : `act_${payload.adAccountId}`;

  await admin.from("ad_accounts").upsert(
    {
      organization_id: organizationId,
      provider: "meta",
      provider_account_id: normalizedAdId,
      account_name: payload.adAccountName || normalizedAdId,
      connection_status: "connected",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider,provider_account_id" }
  );

  // 3. Keep canonical integration_connections updated
  await admin.from("integration_connections").upsert(
    {
      organization_id: organizationId,
      provider: "meta",
      status: "connected",
      external_account_id: normalizedAdId,
      external_account_name: payload.adAccountName || normalizedAdId,
      metadata: {
        page_id: payload.pageId || null,
        page_name: payload.pageName || null,
        instagram_account_id: payload.instagramAccountId || null,
        instagram_username: payload.instagramUsername || null,
      },
      connected_by: userId,
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
 * Disconnects the Meta assets for the organization, revokes permissions if applicable,
 * and marks connection_status = 'disconnected'.
 */
export async function disconnectMetaAssets(
  organizationId: string
): Promise<void> {
  const admin = createAdminClient();

  // 1. Fetch user token for Meta permissions revocation
  const { data: userTokenRow } = await admin
    .from("meta_user_tokens")
    .select("encrypted_access_token, encryption_iv, encryption_tag")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (userTokenRow) {
    try {
      const plainToken = decryptAccessToken(
        userTokenRow.encrypted_access_token,
        userTokenRow.encryption_iv,
        userTokenRow.encryption_tag
      );

      // Call Meta Graph API revoke permissions endpoint
      const revokeUrl = `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(
        plainToken
      )}`;
      await fetch(revokeUrl, { method: "DELETE" }).catch(() => {});
    } catch {
      // Non-fatal revocation error
    }

    // Delete stored token
    await admin.from("meta_user_tokens").delete().eq("organization_id", organizationId);
  }

  // 2. Mark selection status as disconnected
  await admin
    .from("meta_asset_selections")
    .update({
      connection_status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  // 3. Update ad_accounts status to disconnected
  await admin
    .from("ad_accounts")
    .update({
      connection_status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  // 4. Update canonical integration_connections status to disconnected
  await admin
    .from("integration_connections")
    .update({
      status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("provider", "meta");
}
