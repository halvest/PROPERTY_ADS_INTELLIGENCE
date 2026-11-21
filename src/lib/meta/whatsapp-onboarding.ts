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

export interface WabaPhoneCandidate {
  id: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  isOnBizApp: boolean | null;
}

export interface CoexistenceSyncResult {
  contactsRequestId: string | null;
  historyRequestId: string | null;
  warnings: string[];
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
  const url = `${META_GRAPH_BASE_URL}/${graphApiVersion}/oauth/access_token`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: appId,
      client_secret: appSecret,
      code: code.trim(),
      grant_type: "authorization_code",
    }),
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

export function selectWabaPhoneNumber(
  numbers: WabaPhoneCandidate[],
  requestedId?: string | null
): WabaPhoneCandidate {
  if (requestedId) {
    return (
      numbers.find((item) => item.id === requestedId) ?? {
        id: requestedId,
        displayPhoneNumber: null,
        verifiedName: null,
        isOnBizApp: null,
      }
    );
  }
  if (numbers.length === 1) return numbers[0];
  const onBizApp = numbers.filter((item) => item.isOnBizApp === true);
  if (onBizApp.length === 1) return onBizApp[0];
  throw new Error(
    numbers.length === 0
      ? "Meta tidak mengembalikan nomor WhatsApp pada akun ini."
      : "Meta mengembalikan lebih dari satu nomor. Ulangi alur dan pilih satu nomor."
  );
}

export async function listWabaPhoneNumbers(
  wabaId: string,
  accessToken: string
): Promise<WabaPhoneCandidate[]> {
  if (!wabaId.trim() || !accessToken.trim()) {
    throw new Error("wabaId and accessToken are required.");
  }
  const { graphApiVersion } = getMetaServerConfig();
  const url = new URL(`${META_GRAPH_BASE_URL}/${graphApiVersion}/${encodeURIComponent(wabaId.trim())}/phone_numbers`);
  url.searchParams.set("fields", "id,display_phone_number,verified_name,is_on_biz_app");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => null)) as
    | {
        data?: Array<{
          id?: string;
          display_phone_number?: string;
          verified_name?: string;
          is_on_biz_app?: boolean;
        }>;
      }
    | GraphErrorPayload
    | null;
  if (!res.ok) {
    throw new Error(buildGraphErrorMessage("Meta WABA phone list", res.status, data));
  }
  const rows = (data as { data?: Array<{ id?: string; display_phone_number?: string; verified_name?: string; is_on_biz_app?: boolean }> } | null)?.data ?? [];
  return rows
    .filter((row) => Boolean(row.id))
    .map((row) => ({
      id: String(row.id),
      displayPhoneNumber: row.display_phone_number ?? null,
      verifiedName: row.verified_name ?? null,
      isOnBizApp: typeof row.is_on_biz_app === "boolean" ? row.is_on_biz_app : null,
    }));
}

async function postCoexistenceSync(
  phoneNumberId: string,
  accessToken: string,
  syncType: "smb_app_state_sync" | "history"
): Promise<{ requestId: string | null; warning: string | null }> {
  const { graphApiVersion } = getMetaServerConfig();
  const url = `${META_GRAPH_BASE_URL}/${graphApiVersion}/${encodeURIComponent(phoneNumberId)}/smb_app_data`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      sync_type: syncType,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => null)) as { request_id?: string } | GraphErrorPayload | null;
  if (!res.ok) {
    return { requestId: null, warning: buildGraphErrorMessage(`Meta ${syncType} sync`, res.status, data) };
  }
  return { requestId: (data as { request_id?: string } | null)?.request_id ?? null, warning: null };
}

/** Contacts first, then history. Each step can run only once per onboarding. */
export async function startCoexistenceDataSync(
  phoneNumberId: string,
  accessToken: string
): Promise<CoexistenceSyncResult> {
  const contacts = await postCoexistenceSync(phoneNumberId, accessToken, "smb_app_state_sync");
  const history = await postCoexistenceSync(phoneNumberId, accessToken, "history");
  return {
    contactsRequestId: contacts.requestId,
    historyRequestId: history.requestId,
    warnings: [contacts.warning, history.warning].filter((item): item is string => Boolean(item)),
  };
}
