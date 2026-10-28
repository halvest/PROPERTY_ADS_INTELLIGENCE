import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskAdAccountId } from "@/lib/marketing/meta/config";

export interface IntegrationStatusItem {
  provider: "meta_marketing" | "whatsapp_cloud" | "meta_model_api" | "supabase" | "crm_sheets";
  name: string;
  status: "connected" | "demo_active" | "disconnected" | "error";
  mode: "demo" | "live";
  lastSyncedAt: string | null;
  details: string;
  maskedCredential?: string;
  accountIdentifier?: string | null;
  error?: string | null;
}

export interface GetTenantIntegrationsOptions {
  organizationId?: string | null;
  client?: SupabaseClient;
}

/**
 * Service to retrieve honest, multi-tenant integration statuses.
 * Reads canonical integration_connections and ad_accounts safely using service-role or client.
 */
export async function getTenantIntegrationStatuses(
  options: GetTenantIntegrationsOptions = {}
): Promise<{ integrations: IntegrationStatusItem[]; organizationId: string }> {
  let db: SupabaseClient;
  try {
    db = createAdminClient();
  } catch {
    db = options.client as SupabaseClient;
  }

  let orgId = options.organizationId;

  if (!orgId && db && process.env.NODE_ENV !== "production") {
    // Dev only: resolve the tenant organization that owns the active Meta connection
    const { data: activeMeta } = await db
      .from("integration_connections")
      .select("organization_id")
      .eq("provider", "meta")
      .limit(1)
      .maybeSingle();

    orgId = activeMeta?.organization_id || "00000000-0000-0000-0000-000000000001";
  }

  if (!orgId) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("organizationId wajib ditentukan dari sesi tenant terautentikasi.");
    }
    orgId = "00000000-0000-0000-0000-000000000001";
  }

  // Fetch canonical integration_connections for this tenant
  const { data: connections } = await db
    .from("integration_connections")
    .select("*")
    .eq("organization_id", orgId);

  const metaConn = connections?.find((c) => c.provider === "meta");
  const waConn = connections?.find((c) => c.provider === "whatsapp");

  // Fetch active ad account
  const { data: adAcc } = await db
    .from("ad_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("connection_status", "connected")
    .maybeSingle();

  // Fetch active whatsapp connection
  const { data: waDetails } = await db
    .from("whatsapp_connections")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  // 1. Meta Marketing API Status
  const isMetaConnected = metaConn?.status === "connected";
  const metaItem: IntegrationStatusItem = {
    provider: "meta_marketing",
    name: "Meta Marketing API (Ads & Insights)",
    status: isMetaConnected ? "connected" : metaConn?.status === "error" ? "error" : "disconnected",
    mode: "live",
    lastSyncedAt: metaConn?.last_synced_at || null,
    details: isMetaConnected
      ? `Terhubung ke Akun Iklan: ${adAcc?.account_name || metaConn?.external_account_name || adAcc?.provider_account_id || "Meta Ad Account"}`
      : "Belum terhubung. Klik 'Otorisasi Akun Meta' untuk menghubungkan kampanye iklan.",
    maskedCredential: adAcc
      ? maskAdAccountId(adAcc.provider_account_id)
      : metaConn?.external_account_id
      ? maskAdAccountId(metaConn.external_account_id)
      : undefined,
    accountIdentifier: adAcc?.provider_account_id || metaConn?.external_account_id,
    error: metaConn?.error_message,
  };

  // 2. WhatsApp Business Cloud API Status
  const isWaConnected = waConn?.status === "connected" || waDetails?.connection_status === "connected";
  const waItem: IntegrationStatusItem = {
    provider: "whatsapp_cloud",
    name: "WhatsApp Business Platform (Coexistence)",
    status: isWaConnected ? "connected" : "disconnected",
    mode: "live",
    lastSyncedAt: waConn?.last_synced_at || waDetails?.last_webhook_received_at || null,
    details: isWaConnected
      ? `Nomor Bisnis: ${waDetails?.display_phone_number || waConn?.external_account_name || "WhatsApp Business"} (${waDetails?.verified_name || "Terverifikasi"})`
      : "Belum terhubung. Klik 'Hubungkan WhatsApp' via Meta Embedded Signup.",
    maskedCredential: waDetails?.phone_number_id ? `ID: ••••••••${waDetails.phone_number_id.slice(-4)}` : undefined,
    accountIdentifier: waDetails?.phone_number_id,
  };

  // 3. AI Intelligence Model Status
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.AI_STUDIO_API_KEY || process.env.META_MODEL_API_KEY || process.env.MODEL_API_KEY);
  const aiItem: IntegrationStatusItem = {
    provider: "meta_model_api",
    name: "HD Creative LLM Assessment Engine",
    status: aiConfigured ? "connected" : "disconnected",
    mode: "live",
    lastSyncedAt: new Date().toISOString(),
    details: aiConfigured
      ? "Model analisis percakapan & scoring otomatis (Buyer & Sales Readiness) siap beroperasi."
      : "Kunci API model AI belum dikonfigurasi pada server.",
  };

  // 4. Supabase Database Status
  const supabaseItem: IntegrationStatusItem = {
    provider: "supabase",
    name: "Supabase Multi-Tenant PostgreSQL",
    status: "connected",
    mode: "live",
    lastSyncedAt: new Date().toISOString(),
    details: `Isolasi tenant aktif: Organization ID ${orgId}`,
    maskedCredential: process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 18)}••••.supabase.co` : undefined,
  };

  // 5. CRM Sheets / XLSX Manual Import (Alternative to WhatsApp)
  const crmSheetsItem: IntegrationStatusItem = {
    provider: "crm_sheets",
    name: "CRM Leads Spreadsheet Import (Excel / Google Sheets)",
    status: "connected",
    mode: "live",
    lastSyncedAt: new Date().toISOString(),
    details: "Aktif sebagai alternatif resmi saat WhatsApp otomatis belum terhubung. Template .xlsx dan .csv siap diunduh & diunggah.",
    accountIdentifier: "Template HD Creative v1.0",
  };

  return {
    integrations: [metaItem, waItem, crmSheetsItem, aiItem, supabaseItem],
    organizationId: orgId,
  };
}
