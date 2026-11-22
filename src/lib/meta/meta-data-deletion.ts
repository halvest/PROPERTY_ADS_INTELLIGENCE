import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaAppSecret, getMetaGraphApiVersion } from "@/lib/meta/config";

type JsonObject = Record<string, unknown>;

export interface MetaDeletionResult {
  confirmationCode: string;
  outcome: "completed" | "not_found";
  adsTokensRevoked: number;
  whatsappTokensRevoked: number;
  conversationsDeleted: number;
  messagesDeleted: number;
  leadsDeleted: number;
  webhookEventsDeleted: number;
  insightsDeleted: number;
}

export interface MetaDeletionStatus {
  confirmationCode: string;
  found: boolean;
  outcome: "completed" | "not_found" | "unknown";
  adsTokensRevoked: number;
  whatsappTokensRevoked: number;
  conversationsDeleted: number;
  messagesDeleted: number;
  deletedAt: string | null;
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function decodeBase64Url(input: string): Buffer {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  return Buffer.from(base64 + "=".repeat(padLen), "base64");
}

export function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string
): { valid: true; payload: JsonObject } | { valid: false; status: 400 | 401; error: string } {
  const parts = signedRequest.trim().split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, status: 400, error: "Malformed signed_request" };
  }
  const [encodedSig, encodedPayload] = parts;
  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { valid: false, status: 400, error: "Invalid signed_request payload" };
    }
    const algorithm = typeof payload.algorithm === "string" ? payload.algorithm.toUpperCase() : "";
    if (algorithm !== "HMAC-SHA256") {
      return { valid: false, status: 401, error: "Unsupported signed_request algorithm" };
    }
    const signature = decodeBase64Url(encodedSig);
    const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
      return { valid: false, status: 401, error: "Invalid signed_request signature" };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, status: 400, error: "Failed to decode signed_request" };
  }
}

export function metaUserIdFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  return null;
}

export function buildDeletionConfirmationCode(metaUserId: string): string {
  const digest = Buffer.from(metaUserId).toString("hex").replace(/[^a-f0-9]/g, "").slice(0, 12);
  return `haspro${digest}${randomBytes(4).toString("hex")}`;
}

const BUSINESS_USER_FIELDS = "id,name,picture,ids_for_business";

async function readUserNode(
  accessToken: string,
  node: string
): Promise<{ id: string; name: string | null } | null> {
  const response = await fetch(
    `https://graph.facebook.com/${getMetaGraphApiVersion()}/${node}?fields=${BUSINESS_USER_FIELDS}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    }
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { id?: unknown; name?: unknown };
  const id = metaUserIdFromUnknown(body.id);
  if (!id) return null;
  return { id, name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null };
}

export async function readMetaBusinessUserProfile(
  accessToken: string
): Promise<{ id: string; name: string | null } | null> {
  if (!accessToken) return null;
  const profile = await readUserNode(accessToken, "me");
  if (!profile) return null;
  // /User by id is the call this feature's testing checklist records.
  await readUserNode(accessToken, profile.id);
  return profile;
}

export async function readMetaAppScopedUserId(accessToken: string): Promise<string | null> {
  const appId = process.env.META_APP_ID?.trim();
  if (!appId || !accessToken) return null;
  const url = new URL(`https://graph.facebook.com/${getMetaGraphApiVersion()}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${getMetaAppSecret()}`);
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: { user_id?: unknown } };
  return metaUserIdFromUnknown(body.data?.user_id);
}

export async function rememberMetaAdsUser(organizationId: string, accessToken: string): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("integration_connections")
    .select("id, metadata")
    .eq("organization_id", organizationId)
    .eq("provider", "meta")
    .maybeSingle();
  if (!existing?.id) return;
  const metadata = asObject(existing.metadata);
  if (typeof metadata.meta_user_id === "string" && metadata.meta_user_id.length > 0) return;
  const profile = await readMetaBusinessUserProfile(accessToken);
  const metaUserId = profile?.id || (await readMetaAppScopedUserId(accessToken));
  if (!metaUserId) return;
  if (metadata.meta_user_id === metaUserId && metadata.meta_user_name === (profile?.name || metadata.meta_user_name)) {
    return;
  }
  await admin
    .from("integration_connections")
    .update({
      metadata: {
        ...metadata,
        meta_user_id: metaUserId,
        ...(profile?.name ? { meta_user_name: profile.name } : {}),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
}

async function deleteWhere(
  admin: ReturnType<typeof createAdminClient>,
  table: "messages" | "ctwa_attributions" | "lead_pipeline_events" | "leads" | "conversations" | "webhook_events" | "ad_insights" | "ads" | "campaigns" | "lead_ai_analyses" | "lead_assessments" | "lead_outcomes" | "attribution_events" | "capi_dispatch_logs",
  column: string,
  values: string[]
): Promise<number> {
  if (values.length === 0) return 0;
  const { error, count } = await admin
    .from(table)
    .delete({ count: "exact" })
    .in(column, values);
  if (error) throw new Error(error.message);
  return count ?? values.length;
}

async function recordDeletionRequest(
  admin: ReturnType<typeof createAdminClient>,
  row: {
    confirmation_code: string;
    meta_user_id: string;
    outcome: "completed" | "not_found";
    ads_tokens_revoked: number;
    whatsapp_tokens_revoked: number;
    conversations_deleted: number;
    messages_deleted: number;
    leads_deleted: number;
    webhook_events_deleted: number;
    insights_deleted: number;
  }
): Promise<void> {
  const { error } = await admin.from("meta_deletion_requests").upsert(row, {
    onConflict: "confirmation_code",
  });
  if (error) throw new Error(error.message);
}

async function revokeMatchedMetaAccess(metaUserId: string, confirmationCode: string): Promise<MetaDeletionResult> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const empty = {
    confirmationCode,
    outcome: "not_found" as const,
    adsTokensRevoked: 0,
    whatsappTokensRevoked: 0,
    conversationsDeleted: 0,
    messagesDeleted: 0,
    leadsDeleted: 0,
    webhookEventsDeleted: 0,
    insightsDeleted: 0,
  };

  const { data: adsRows } = await admin
    .from("integration_connections")
    .select("id, organization_id, metadata")
    .eq("provider", "meta")
    .contains("metadata", { meta_user_id: metaUserId });

  const { data: whatsappRows } = await admin
    .from("whatsapp_connections")
    .select("id, workspace_id, organization_id, phone_number_id, metadata")
    .contains("metadata", { meta_user_id: metaUserId });

  if ((adsRows ?? []).length === 0 && (whatsappRows ?? []).length === 0) {
    await recordDeletionRequest(admin, {
      confirmation_code: confirmationCode,
      meta_user_id: metaUserId,
      outcome: "not_found",
      ads_tokens_revoked: 0,
      whatsapp_tokens_revoked: 0,
      conversations_deleted: 0,
      messages_deleted: 0,
      leads_deleted: 0,
      webhook_events_deleted: 0,
      insights_deleted: 0,
    });
    return empty;
  }

  const connectionIds = (whatsappRows ?? []).map((row) => row.id);
  const phoneIds = (whatsappRows ?? []).map((row) => row.phone_number_id).filter(Boolean);
  const { data: conversationRows } = connectionIds.length
    ? await admin.from("conversations").select("id").in("connection_id", connectionIds)
    : { data: [] as Array<{ id: string }> };
  const conversationIds = (conversationRows ?? []).map((row) => row.id);
  const { data: leadRows } = conversationIds.length
    ? await admin.from("leads").select("id").in("conversation_id", conversationIds)
    : { data: [] as Array<{ id: string }> };
  const leadIds = (leadRows ?? []).map((row) => row.id);

  const messagesDeleted = conversationIds.length
    ? await deleteWhere(admin, "messages", "conversation_id", conversationIds)
    : 0;
  if (conversationIds.length) {
    await deleteWhere(admin, "ctwa_attributions", "conversation_id", conversationIds);
    await deleteWhere(admin, "lead_ai_analyses", "conversation_id", conversationIds);
    await deleteWhere(admin, "lead_assessments", "conversation_id", conversationIds);
    await deleteWhere(admin, "lead_outcomes", "conversation_id", conversationIds);
    await deleteWhere(admin, "attribution_events", "conversation_id", conversationIds);
  }
  if (leadIds.length) {
    await deleteWhere(admin, "capi_dispatch_logs", "lead_id", leadIds);
    await deleteWhere(admin, "lead_pipeline_events", "lead_id", leadIds);
  }
  const leadsDeleted = leadIds.length ? await deleteWhere(admin, "leads", "id", leadIds) : 0;
  const conversationsDeleted = conversationIds.length
    ? await deleteWhere(admin, "conversations", "id", conversationIds)
    : 0;
  const webhookEventsDeleted = phoneIds.length
    ? await deleteWhere(admin, "webhook_events", "phone_number_id", phoneIds)
    : 0;

  let insightsDeleted = 0;
  const adsOrganizations = new Set(
    (adsRows ?? [])
      .map((row) => row.organization_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  for (const organizationId of adsOrganizations) {
    const { data: remaining } = await admin
      .from("conversations")
      .select("ad_id, campaign_id")
      .eq("organization_id", organizationId);
    const keepAds = new Set(
      (remaining ?? []).map((row) => row.ad_id).filter((id): id is string => typeof id === "string")
    );
    const keepCampaigns = new Set(
      (remaining ?? []).map((row) => row.campaign_id).filter((id): id is string => typeof id === "string")
    );
    const { data: adRows } = await admin.from("ads").select("id").eq("organization_id", organizationId);
    const adIds = (adRows ?? []).map((row) => row.id).filter((id) => !keepAds.has(id));
    if (adIds.length) {
      insightsDeleted += await deleteWhere(admin, "ad_insights", "ad_id", adIds);
      await deleteWhere(admin, "ads", "id", adIds);
    }
    const { data: campaignRows } = await admin
      .from("campaigns")
      .select("id")
      .eq("organization_id", organizationId);
    const campaignIds = (campaignRows ?? []).map((row) => row.id).filter((id) => !keepCampaigns.has(id));
    if (campaignIds.length) await deleteWhere(admin, "campaigns", "id", campaignIds);
  }

  let adsTokensRevoked = 0;
  for (const row of adsRows || []) {
    const { error: tokenError } = await admin
      .from("meta_user_tokens")
      .delete()
      .eq("organization_id", row.organization_id);
    if (tokenError) throw new Error(tokenError.message);
    const { error: connectionError } = await admin
      .from("integration_connections")
      .update({
        status: "revoked",
        token_expires_at: null,
        granted_scopes: [],
        metadata: {
          data_deletion: { confirmation_code: confirmationCode, deleted_at: now },
        },
        updated_at: now,
      })
      .eq("id", row.id);
    if (connectionError) throw new Error(connectionError.message);
    adsTokensRevoked += 1;
  }

  let whatsappTokensRevoked = 0;
  for (const row of whatsappRows || []) {
    const { error: secretError } = await admin
      .from("whatsapp_connection_secrets")
      .delete()
      .eq("connection_id", row.id);
    if (secretError) throw new Error(secretError.message);
    const { error: connectionError } = await admin
      .from("whatsapp_connections")
      .update({
        connection_status: "revoked",
        coexistence_enabled: false,
        disconnected_at: now,
        metadata: {
          data_deletion: { confirmation_code: confirmationCode, deleted_at: now },
        },
        updated_at: now,
      })
      .eq("id", row.id);
    if (connectionError) throw new Error(connectionError.message);
    whatsappTokensRevoked += 1;
  }

  const result: MetaDeletionResult = {
    confirmationCode,
    outcome: "completed",
    adsTokensRevoked,
    whatsappTokensRevoked,
    conversationsDeleted,
    messagesDeleted,
    leadsDeleted,
    webhookEventsDeleted,
    insightsDeleted,
  };
  await recordDeletionRequest(admin, {
    confirmation_code: confirmationCode,
    meta_user_id: metaUserId,
    outcome: "completed",
    ads_tokens_revoked: adsTokensRevoked,
    whatsapp_tokens_revoked: whatsappTokensRevoked,
    conversations_deleted: conversationsDeleted,
    messages_deleted: messagesDeleted,
    leads_deleted: leadsDeleted,
    webhook_events_deleted: webhookEventsDeleted,
    insights_deleted: insightsDeleted,
  });
  return result;
}

export async function initiateMetaUserDataDeletion(metaUserId: string): Promise<MetaDeletionResult> {
  return revokeMatchedMetaAccess(metaUserId, buildDeletionConfirmationCode(metaUserId));
}

export async function lookupMetaDataDeletion(confirmationCode: string): Promise<MetaDeletionStatus> {
  const code = confirmationCode.trim();
  const admin = createAdminClient();
  const empty: MetaDeletionStatus = {
    confirmationCode: code,
    found: false,
    outcome: "unknown",
    adsTokensRevoked: 0,
    whatsappTokensRevoked: 0,
    conversationsDeleted: 0,
    messagesDeleted: 0,
    deletedAt: null,
  };
  if (!/^[a-zA-Z0-9]+$/.test(code)) return empty;

  const { data: requestRow } = await admin
    .from("meta_deletion_requests")
    .select("outcome, ads_tokens_revoked, whatsapp_tokens_revoked, conversations_deleted, messages_deleted, created_at")
    .eq("confirmation_code", code)
    .maybeSingle();
  if (requestRow) {
    const outcome = requestRow.outcome === "completed" || requestRow.outcome === "not_found"
      ? requestRow.outcome
      : "unknown";
    return {
      confirmationCode: code,
      found: true,
      outcome,
      adsTokensRevoked: requestRow.ads_tokens_revoked,
      whatsappTokensRevoked: requestRow.whatsapp_tokens_revoked,
      conversationsDeleted: requestRow.conversations_deleted,
      messagesDeleted: requestRow.messages_deleted,
      deletedAt: requestRow.created_at,
    };
  }

  const [{ data: adsRows }, { data: whatsappRows }] = await Promise.all([
    admin
      .from("integration_connections")
      .select("metadata")
      .contains("metadata", { data_deletion: { confirmation_code: code } }),
    admin
      .from("whatsapp_connections")
      .select("metadata")
      .contains("metadata", { data_deletion: { confirmation_code: code } }),
  ]);

  const rows = [...(adsRows || []), ...(whatsappRows || [])];
  if (rows.length === 0) return empty;
  const deletedAt = rows
    .map((row) => asObject(asObject(row.metadata).data_deletion).deleted_at)
    .find((value): value is string => typeof value === "string") || null;
  return {
    confirmationCode: code,
    found: true,
    outcome: "completed",
    adsTokensRevoked: adsRows?.length || 0,
    whatsappTokensRevoked: whatsappRows?.length || 0,
    conversationsDeleted: 0,
    messagesDeleted: 0,
    deletedAt,
  };
}
