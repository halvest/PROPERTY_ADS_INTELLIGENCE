import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskAdAccountId } from "@/lib/marketing/meta/config";

export type MetaHealth =
  | "not_connected"
  | "connected"
  | "permission_insufficient"
  | "token_expired"
  | "sync_failed"
  | "needs_reauth";

export interface IntegrationStatusItem {
  provider: "meta_marketing" | "meta_model_api" | "supabase" | "crm_sheets";
  name: string;
  status: "connected" | "disconnected" | "error" | "configured";
  mode: "live";
  lastSyncedAt: string | null;
  details: string;
  maskedCredential?: string;
  accountIdentifier?: string | null;
  error?: string | null;
  health?: MetaHealth;
}

export interface GetTenantIntegrationsOptions {
  organizationId?: string | null;
  client?: SupabaseClient;
}

/**
 * Service to retrieve honest, multi-tenant integration statuses.
 * Reads canonical Meta integration_connections and ad_accounts safely using service-role or client.
 */
export async function getTenantIntegrationStatuses(
  options: GetTenantIntegrationsOptions = {}
): Promise<{ integrations: IntegrationStatusItem[]; organizationId: string }> {
  let db: SupabaseClient;
  try {
    db = createAdminClient();
  } catch {
    if (!options.client) throw new Error("Database integration status is unavailable.");
    db = options.client;
  }

  const orgId = options.organizationId;

  if (!orgId) {
    throw new Error("organizationId wajib ditentukan dari sesi tenant terautentikasi.");
  }

  // Fetch canonical integration_connections for this tenant
  const { data: connections } = await db
    .from("integration_connections")
    .select("*")
    .eq("organization_id", orgId);

  const metaConn = connections?.find((c) => c.provider === "meta");

  // Meta health requires BOTH a connected selection and a stored tenant token.
  // An integration_connections row or an env var alone never means "connected".
  const { data: tokenRow } = await db
    .from("meta_user_tokens")
    .select("expires_at, granted_scopes")
    .eq("organization_id", orgId)
    .maybeSingle();
  const { data: selection } = await db
    .from("meta_asset_selections")
    .select("ad_account_id, ad_account_name, connection_status")
    .eq("organization_id", orgId)
    .maybeSingle();
  const { data: selectedAdAccount } = selection?.ad_account_id
    ? await db
        .from("ad_accounts")
        .select("id, last_synced_at")
        .eq("organization_id", orgId)
        .eq("provider", "meta")
        .eq("provider_account_id", selection.ad_account_id)
        .eq("connection_status", "connected")
        .maybeSingle()
    : { data: null };
  const { count: connectedAccountCount } = await db
    .from("ad_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("provider", "meta")
    .eq("connection_status", "connected");

  let health: MetaHealth = "not_connected";
  if (metaConn?.status === "error") health = "sync_failed";
  else if (tokenRow && selection?.connection_status === "connected" && selectedAdAccount) {
    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      health = "token_expired";
    } else if (
      Array.isArray(tokenRow.granted_scopes) &&
      tokenRow.granted_scopes.length > 0 &&
      !tokenRow.granted_scopes.includes("ads_read")
    ) {
      health = "permission_insufficient";
    } else {
      health = "connected";
    }
  } else if (tokenRow || selection?.connection_status === "connected") {
    health = "needs_reauth";
  }

  const isMetaConnected = health === "connected";
  const metaItem: IntegrationStatusItem = {
    provider: "meta_marketing",
    name: "Meta Marketing API (Ads & Insights)",
    status: isMetaConnected
      ? "connected"
      : health === "not_connected"
        ? "disconnected"
        : "error",
    health,
    mode: "live",
    lastSyncedAt: selectedAdAccount?.last_synced_at || null,
    details: isMetaConnected
      ? `Terhubung. ${connectedAccountCount ?? 0} akun iklan tersimpan. Akun aktif: ${selection?.ad_account_name || selection?.ad_account_id}`
      : health === "token_expired"
        ? "Token Meta telah kedaluwarsa. Hubungkan ulang akun Meta."
        : health === "permission_insufficient"
          ? "Izin ads_read tidak tersedia. Hubungkan ulang dan setujui izin bacaan iklan."
          : health === "needs_reauth"
            ? "Koneksi Meta belum lengkap. Hubungkan ulang akun Meta dan pilih akun iklan."
            : health === "sync_failed"
              ? "Sinkronisasi terakhir gagal. Periksa koneksi lalu sinkronkan ulang."
              : "Belum terhubung. Gunakan tombol Hubungkan Meta untuk menghubungkan akun iklan organisasi ini.",
    maskedCredential: isMetaConnected
      ? maskAdAccountId(selection?.ad_account_id)
      : undefined,
    accountIdentifier: isMetaConnected
      ? selection?.ad_account_id || null
      : null,
    error: metaConn?.error_message ? "Sinkronisasi Meta terakhir gagal. Coba sambungkan ulang atau sinkronkan lagi." : null,
  };

  // 2. AI model: configuration presence only — not a tested live connection.
  const aiConfigured = Boolean(process.env.META_MODEL_API_KEY || process.env.MODEL_API_KEY);
  const aiItem: IntegrationStatusItem = {
    provider: "meta_model_api",
    name: "Meta Model API (AI Assessment)",
    status: aiConfigured ? "configured" : "disconnected",
    mode: "live",
    lastSyncedAt: null,
    details: aiConfigured
      ? "Konfigurasi tersedia di server. Status ini tidak menyatakan koneksi telah diuji."
      : "Kunci API model AI belum dikonfigurasi pada server.",
  };

  // 3. Supabase: configuration presence only.
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const supabaseItem: IntegrationStatusItem = {
    provider: "supabase",
    name: "Supabase Multi-Tenant PostgreSQL",
    status: supabaseConfigured ? "configured" : "disconnected",
    mode: "live",
    lastSyncedAt: null,
    details: supabaseConfigured
      ? "Konfigurasi tersedia. Data tenant dibatasi Row-Level Security berdasarkan organisasi pengguna."
      : "Konfigurasi Supabase belum tersedia di server.",
  };

  // 4. CRM import is a local feature; no external connection exists to test.
  const crmSheetsItem: IntegrationStatusItem = {
    provider: "crm_sheets",
    name: "CRM Leads Spreadsheet Import (Excel / Google Sheets)",
    status: "configured",
    mode: "live",
    lastSyncedAt: null,
    details: "Fitur impor lokal melalui input manual dan unggahan file .xlsx atau .csv.",
    accountIdentifier: null,
  };

  return {
    integrations: [metaItem, crmSheetsItem, aiItem, supabaseItem],
    organizationId: orgId,
  };
}
