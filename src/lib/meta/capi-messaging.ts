import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaGraphApiVersion } from "@/lib/meta/config";
import { maskCtwaClid } from "@/lib/ctwa-leads/types";

export type MetaCapiEventName = "QualifiedLead" | "Schedule" | "Purchase";

export interface DispatchCtwaConversionInput {
  workspaceId: string;
  leadId: string;
  eventName: MetaCapiEventName;
  ctwaClid: string;
  datasetId: string;
  accessToken: string;
  value?: number;
  currency?: string;
  eventTime?: number;
}

export interface DispatchCtwaConversionResult {
  status: "sent" | "failed" | "skipped";
  eventId: string;
  httpStatus?: number;
  errorMessage?: string;
  reason?: string;
}

export interface MetaCapiBusinessMessagingPayload {
  data: Array<{
    event_name: MetaCapiEventName;
    event_time: number;
    event_id: string;
    action_source: "business_messaging";
    messaging_channel: "whatsapp";
    user_data: {
      ctwa_clid: string;
    };
    custom_data?: {
      currency: string;
      value: number;
    };
  }>;
}

export function mapPipelineStageToCapiEvent(stage: string): MetaCapiEventName | null {
  if (stage === "qualified") return "QualifiedLead";
  if (stage === "survey") return "Schedule";
  if (stage === "won") return "Purchase";
  return null;
}

/**
 * Builds the official Meta CAPI for Business Messaging event payload.
 * Per Meta specs, `ctwa_clid` MUST be plain text (NOT SHA-256 hashed).
 */
export function buildCtwaCapiPayload(params: {
  eventName: MetaCapiEventName;
  eventId: string;
  ctwaClid: string;
  eventTime?: number;
  value?: number;
  currency?: string;
}): MetaCapiBusinessMessagingPayload {
  const eventTime = params.eventTime ?? Math.floor(Date.now() / 1000);
  const eventItem: MetaCapiBusinessMessagingPayload["data"][number] = {
    event_name: params.eventName,
    event_time: eventTime,
    event_id: params.eventId,
    action_source: "business_messaging",
    messaging_channel: "whatsapp",
    user_data: {
      ctwa_clid: params.ctwaClid,
    },
  };

  if (typeof params.value === "number" && Number.isFinite(params.value) && params.value > 0) {
    eventItem.custom_data = {
      currency: params.currency?.trim() || "IDR",
      value: params.value,
    };
  }

  return { data: [eventItem] };
}

export async function dispatchCtwaConversionEvent(
  input: DispatchCtwaConversionInput
): Promise<DispatchCtwaConversionResult> {
  const cleanClid = input.ctwaClid.trim();
  const cleanDatasetId = input.datasetId.trim();
  const cleanToken = input.accessToken.trim();
  const eventId = `haspro_${input.leadId}_${input.eventName}`;

  if (!cleanClid || !cleanDatasetId || !cleanToken) {
    return {
      status: "skipped",
      eventId,
      reason: "Missing ctwa_clid, datasetId, or accessToken",
    };
  }

  const admin = createAdminClient();

  // Idempotency check: skip if this event_id has already been sent
  const { data: existingLog } = await admin
    .from("capi_dispatch_logs")
    .select("id, status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingLog?.status === "sent") {
    return {
      status: "skipped",
      eventId,
      reason: "Already dispatched (idempotent)",
    };
  }

  const payload = buildCtwaCapiPayload({
    eventName: input.eventName,
    eventId,
    ctwaClid: cleanClid,
    eventTime: input.eventTime,
    value: input.value,
    currency: input.currency,
  });

  const graphVersion = getMetaGraphApiVersion();
  const endpoint = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(cleanDatasetId)}/events`;

  let status: "sent" | "failed" = "failed";
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(payload),
    });

    httpStatus = response.status;
    if (response.ok) {
      status = "sent";
    } else {
      const errText = await response.text().catch(() => "");
      errorMessage = errText.slice(0, 500) || `HTTP ${response.status}`;
    }
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message.slice(0, 500) : "Network error calling Meta CAPI";
  }

  await admin.from("capi_dispatch_logs").upsert(
    {
      workspace_id: input.workspaceId,
      lead_id: input.leadId,
      event_name: input.eventName,
      event_id: eventId,
      ctwa_clid_masked: maskCtwaClid(cleanClid),
      status,
      http_status: httpStatus,
      error_message: errorMessage,
    },
    { onConflict: "event_id" }
  );

  return {
    status,
    eventId,
    httpStatus: httpStatus ?? undefined,
    errorMessage: errorMessage ?? undefined,
  };
}

/**
 * Non-blocking hook for lead stage transitions (Qualified / Survey / Won).
 * Safely swallows all errors so lead persistence never fails due to CAPI network/config state.
 */
export async function tryDispatchLeadStageCapi(params: {
  workspaceId: string;
  leadId: string;
  nextStage: string;
  conversationId?: string;
}): Promise<void> {
  try {
    const eventName = mapPipelineStageToCapiEvent(params.nextStage);
    if (!eventName) return;

    const datasetId = process.env.META_CAPI_DATASET_ID?.trim() || "";
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim() || "";
    if (!datasetId || !accessToken) return;

    const admin = createAdminClient();
    let conversationId = params.conversationId;

    if (!conversationId) {
      const { data: leadRow } = await admin
        .from("leads")
        .select("conversation_id")
        .eq("id", params.leadId)
        .eq("workspace_id", params.workspaceId)
        .maybeSingle();
      conversationId = leadRow?.conversation_id;
    }

    if (!conversationId) return;

    const { data: attr } = await admin
      .from("ctwa_attributions")
      .select("ctwa_clid")
      .eq("conversation_id", conversationId)
      .eq("workspace_id", params.workspaceId)
      .maybeSingle();

    const ctwaClid = attr?.ctwa_clid?.trim();
    if (!ctwaClid) return;

    await dispatchCtwaConversionEvent({
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      eventName,
      ctwaClid,
      datasetId,
      accessToken,
    });
  } catch (err: unknown) {
    console.error(
      "[tryDispatchLeadStageCapi] Non-blocking dispatch failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
}
