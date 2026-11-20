import "server-only";

import { getMetaServerConfig } from "@/lib/meta/config";

const META_GRAPH_BASE_URL = "https://graph.facebook.com";
const REQUEST_TIMEOUT_MS = 15_000;

export interface ExchangedTokenResult {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number | null;
}

export interface PhoneNumberMetadata {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
}

interface GraphErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

function buildGraphErrorMessage(context: string, status: number, payload: unknown): string {
  const errObj = (payload as GraphErrorPayload | null)?.error;
  if (errObj?.message) {
    const codePart = errObj.code !== undefined ? ` (code ${errObj.code})` : "";
    return `${context} failed [${status}]${codePart}: ${errObj.message}`;
  }
  return `${context} failed with HTTP ${status}.`;
}

/**
 * Exchanges the Meta Embedded Signup authorization code for a WhatsApp Business access token.
 * Never logs the code, appSecret, or access token.
 */
export async function exchangeEmbeddedSignupCode(code: string): Promise<ExchangedTokenResult> {
  if (!code || !code.trim()) {
    throw new Error("Authorization code is required.");
  }

  const { appId, appSecret, graphApiVersion } = getMetaServerConfig();
  const url = new URL(`${META_GRAPH_BASE_URL}/${graphApiVersion}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code.trim());

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; token_type?: string; expires_in?: number }
    | GraphErrorPayload
    | null;

  if (!res.ok) {
    throw new Error(buildGraphErrorMessage("Meta OAuth token exchange", res.status, data));
  }

  const tokenData = data as { access_token?: string; token_type?: string; expires_in?: number } | null;
  if (!tokenData?.access_token) {
    throw new Error("Meta OAuth response did not include an access_token.");
  }

  return {
    accessToken: tokenData.access_token,
    tokenType: tokenData.token_type || "bearer",
    expiresInSeconds: typeof tokenData.expires_in === "number" ? tokenData.expires_in : null,
  };
}

/**
 * Fetches display_phone_number and verified_name for a WhatsApp Business phone_number_id.
 */
export async function fetchPhoneNumberMetadata(
  phoneNumberId: string,
  accessToken: string
): Promise<PhoneNumberMetadata> {
  if (!phoneNumberId || !phoneNumberId.trim()) {
    throw new Error("phoneNumberId is required.");
  }
  if (!accessToken || !accessToken.trim()) {
    throw new Error("accessToken is required.");
  }

  const { graphApiVersion } = getMetaServerConfig();
  const cleanId = encodeURIComponent(phoneNumberId.trim());
  const url = new URL(`${META_GRAPH_BASE_URL}/${graphApiVersion}/${cleanId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = (await res.json().catch(() => null)) as
    | { id?: string; display_phone_number?: string; verified_name?: string }
    | GraphErrorPayload
    | null;

  if (!res.ok) {
    throw new Error(buildGraphErrorMessage("Meta phone metadata fetch", res.status, data));
  }

  const meta = data as { display_phone_number?: string; verified_name?: string } | null;
  return {
    phoneNumberId: phoneNumberId.trim(),
    displayPhoneNumber: meta?.display_phone_number ?? null,
    verifiedName: meta?.verified_name ?? null,
  };
}

/**
 * Subscribes our Meta App to webhooks on the customer's WABA (WhatsApp Business Account).
 */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  if (!wabaId || !wabaId.trim()) {
    throw new Error("wabaId is required.");
  }
  if (!accessToken || !accessToken.trim()) {
    throw new Error("accessToken is required.");
  }

  const { graphApiVersion } = getMetaServerConfig();
  const cleanWabaId = encodeURIComponent(wabaId.trim());
  const url = `${META_GRAPH_BASE_URL}/${graphApiVersion}/${cleanWabaId}/subscribed_apps`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = (await res.json().catch(() => null)) as { success?: boolean } | GraphErrorPayload | null;

  if (!res.ok) {
    throw new Error(buildGraphErrorMessage("Meta WABA webhook subscription", res.status, data));
  }

  const subRes = data as { success?: boolean } | null;
  if (subRes && subRes.success === false) {
    throw new Error("Meta WABA webhook subscription returned success=false.");
  }
}
