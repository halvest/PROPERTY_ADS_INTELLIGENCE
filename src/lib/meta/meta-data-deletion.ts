import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaAppSecret, getMetaGraphApiVersion } from "@/lib/meta/config";

type JsonObject = Record<string, unknown>;

export interface MetaDeletionResult {
  confirmationCode: string;
  adsTokensRevoked: number;
  whatsappTokensRevoked: number;
}

export interface MetaDeletionStatus {
  confirmationCode: string;
  found: boolean;
  adsTokensRevoked: number;
  whatsappTokensRevoked: number;
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
  if (metaUserIdFromUnknown(asObject(existing?.metadata).meta_user_id)) return;

  const metaUserId = await readMetaAppScopedUserId(accessToken);
  if (!metaUserId || !existing?.id) return;
  await admin
    .from("integration_connections")
    .update({
      metadata: { ...asObject(existing.metadata), meta_user_id: metaUserId },
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
}

async function revokeMatchedMetaAccess(metaUserId: string, confirmationCode: string): Promise<MetaDeletionResult> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const receipt = {
    confirmation_code: confirmationCode,
    deleted_at: now,
    meta_user_id: metaUserId,
  };

  const { data: adsRows } = await admin
    .from("integration_connections")
    .select("id, organization_id, metadata")
    .eq("provider", "meta")
    .contains("metadata", { meta_user_id: metaUserId });

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
        metadata: { ...asObject(row.metadata), meta_user_id: metaUserId, data_deletion: receipt },
        updated_at: now,
      })
      .eq("id", row.id);
    if (connectionError) throw new Error(connectionError.message);
    adsTokensRevoked += 1;
  }

  const { data: whatsappRows } = await admin
    .from("whatsapp_connections")
    .select("id, metadata")
    .contains("metadata", { meta_user_id: metaUserId });

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
        connection_status: "disconnected",
        disconnected_at: now,
        metadata: { ...asObject(row.metadata), meta_user_id: metaUserId, data_deletion: receipt },
        updated_at: now,
      })
      .eq("id", row.id);
    if (connectionError) throw new Error(connectionError.message);
    whatsappTokensRevoked += 1;
  }

  return { confirmationCode, adsTokensRevoked, whatsappTokensRevoked };
}

export async function initiateMetaUserDataDeletion(metaUserId: string): Promise<MetaDeletionResult> {
  return revokeMatchedMetaAccess(metaUserId, buildDeletionConfirmationCode(metaUserId));
}

export async function lookupMetaDataDeletion(confirmationCode: string): Promise<MetaDeletionStatus> {
  const code = confirmationCode.trim();
  const admin = createAdminClient();
  const empty = { confirmationCode: code, found: false, adsTokensRevoked: 0, whatsappTokensRevoked: 0, deletedAt: null };
  if (!/^[a-zA-Z0-9]+$/.test(code)) return empty;

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
    adsTokensRevoked: adsRows?.length || 0,
    whatsappTokensRevoked: whatsappRows?.length || 0,
    deletedAt,
  };
}
