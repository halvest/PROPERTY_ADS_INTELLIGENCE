import "server-only";

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskPhoneNumber } from "@/lib/meta/webhook-security";
import { canAcceptInboundMessages } from "@/lib/meta/connection-lifecycle";
import {
  deadLetterRequeuePatch,
  decideWebhookRedelivery,
  formatWebhookFailure,
  readWebhookAttempt,
  WEBHOOK_PROCESSING_LEASE_MS,
  webhookProcessingAgeMs,
} from "@/lib/meta/webhook-redelivery";
import { linkVerifiedMetaAd, type TenantAdRecord } from "@/lib/attribution/ctwa-ad-link";
import { hashPhoneNumber } from "@/lib/security/phone-hash";
import type { Json } from "@/types/database.types";

type WebhookEventType =
  | "messages"
  | "smb_message_echoes"
  | "history"
  | "smb_app_state_sync"
  | "other";

interface MetaReferral {
  source_id?: string;
  source_type?: string;
  source_url?: string;
  headline?: string;
  body?: string;
  ctwa_clid?: string;
}

interface MetaMessage {
  id?: string;
  from?: string;
  to?: string;
  timestamp?: string | number;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string; id?: string; mime_type?: string };
  video?: { caption?: string; id?: string; mime_type?: string };
  document?: { caption?: string; filename?: string; id?: string; mime_type?: string };
  audio?: { id?: string; mime_type?: string };
  sticker?: { id?: string; mime_type?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
    nfm_reply?: { response_json?: string; body?: string };
  };
  location?: { name?: string; address?: string; latitude?: number; longitude?: number };
  context?: { from?: string; id?: string };
  referral?: MetaReferral;
}

interface MetaContact {
  wa_id?: string;
  profile?: { name?: string };
}

interface MetaChangeValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  message_echoes?: MetaMessage[];
}

interface MetaChange {
  field?: string;
  value?: MetaChangeValue;
}

interface MetaEntry {
  id?: string;
  changes?: MetaChange[];
}

interface MetaWebhookPayload {
  object?: string;
  entry?: MetaEntry[];
}

export interface WebhookIngestionSummary {
  eventsLogged: number;
  duplicatesSkipped: number;
  messagesInserted: number;
  echoesProcessed: number;
  leadsCreated: number;
  stageTransitions: number;
}

const VALID_EVENT_TYPES = new Set<WebhookEventType>([
  "messages",
  "smb_message_echoes",
  "history",
  "smb_app_state_sync",
  "other",
]);

const VALID_MESSAGE_TYPES = new Set<string>([
  "text",
  "image",
  "video",
  "document",
  "audio",
  "sticker",
  "location",
  "contacts",
  "interactive",
  "template",
  "reaction",
  "other",
  "unknown",
]);

function normalizeEventType(field: string | undefined): WebhookEventType {
  if (field && VALID_EVENT_TYPES.has(field as WebhookEventType)) {
    return field as WebhookEventType;
  }
  return "other";
}

function normalizeMessageType(rawType: string | undefined): string {
  if (rawType && VALID_MESSAGE_TYPES.has(rawType)) {
    return rawType;
  }
  return rawType ? "other" : "unknown";
}

function parseMetaTimestamp(ts: string | number | undefined): string {
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const ms = ts < 1e11 ? ts * 1000 : ts;
    return new Date(ms).toISOString();
  }
  if (typeof ts === "string" && ts.trim()) {
    const numeric = Number(ts.trim());
    if (Number.isFinite(numeric) && numeric > 0) {
      const ms = numeric < 1e11 ? numeric * 1000 : numeric;
      return new Date(ms).toISOString();
    }
    const parsedDate = Date.parse(ts);
    if (Number.isFinite(parsedDate)) {
      return new Date(parsedDate).toISOString();
    }
  }
  return new Date().toISOString();
}

function extractMessageBodyText(msg: MetaMessage): string | null {
  if (msg.text?.body) return msg.text.body;
  if (msg.image?.caption) return msg.image.caption;
  if (msg.video?.caption) return msg.video.caption;
  if (msg.document?.caption) return msg.document.caption;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  if (msg.interactive?.nfm_reply?.body) return msg.interactive.nfm_reply.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.location?.name || msg.location?.address) {
    return [msg.location.name, msg.location.address].filter(Boolean).join(" — ");
  }
  return null;
}

function buildRawMessageMetadata(msg: MetaMessage): Json {
  const meta: Record<string, Json | undefined> = {
    type: msg.type ?? "unknown",
  };
  if (msg.context?.id) {
    meta.reply_to_wamid = msg.context.id;
  }
  if (msg.referral) {
    meta.has_referral = true;
  }
  if (msg.image?.id) meta.media_id = msg.image.id;
  if (msg.video?.id) meta.media_id = msg.video.id;
  if (msg.document?.id) {
    meta.media_id = msg.document.id;
    if (msg.document.filename) meta.filename = msg.document.filename;
  }
  if (msg.audio?.id) meta.media_id = msg.audio.id;
  return meta as Json;
}

function buildDeterministicEventId(
  entryId: string,
  eventType: WebhookEventType,
  phoneNumberId: string,
  value: MetaChangeValue
): string {
  const firstMsg = (value.message_echoes ?? value.messages)?.[0];
  if (firstMsg?.id) {
    return `${entryId}:${eventType}:${firstMsg.id}`;
  }
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify({ entryId, eventType, phoneNumberId, value }))
    .digest("hex")
    .slice(0, 24);
  return `${entryId}:${eventType}:${digest}`;
}

function hasValidCtwaReferral(referral: MetaReferral | undefined): referral is MetaReferral {
  if (!referral || typeof referral !== "object") return false;
  return Boolean(
    (referral.source_id && referral.source_id.trim()) ||
      referral.source_type === "ad" ||
      (referral.ctwa_clid && referral.ctwa_clid.trim())
  );
}

function resolveContactName(contacts: MetaContact[] | undefined, waId: string): string | null {
  if (!Array.isArray(contacts) || contacts.length === 0) return null;
  const matched = contacts.find((c) => c.wa_id === waId) ?? contacts[0];
  const name = matched?.profile?.name?.trim();
  return name || null;
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "23505" ||
    Boolean(error.message && error.message.toLowerCase().includes("duplicate"))
  );
}

function pickLatestIso(a: string | null | undefined, b: string): string {
  if (!a) return b;
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (!Number.isFinite(aMs)) return b;
  if (!Number.isFinite(bMs)) return a;
  return bMs >= aMs ? b : a;
}

type WebhookAdmin = ReturnType<typeof createAdminClient>;

function claimedRow(data: unknown): boolean {
  if (Array.isArray(data)) return data.length > 0;
  return Boolean(data && typeof data === "object");
}

async function reclaimStaleWebhookProcessing(admin: WebhookAdmin): Promise<void> {
  const cutoff = new Date(Date.now() - WEBHOOK_PROCESSING_LEASE_MS).toISOString();
  const patch = { status: "retrying" as const, processed_at: null };
  await admin.from("webhook_events").update(patch).eq("status", "processing").lt("claimed_at", cutoff);
  await admin
    .from("webhook_events")
    .update(patch)
    .eq("status", "processing")
    .is("claimed_at", null)
    .lt("received_at", cutoff);
}

async function claimWebhookEvent(
  admin: WebhookAdmin,
  eventId: string,
  status: string | null | undefined
): Promise<boolean> {
  const patch = {
    status: "processing" as const,
    claimed_at: new Date().toISOString(),
    processed_at: null,
  };
  if (status === "processing") {
    const cutoff = new Date(Date.now() - WEBHOOK_PROCESSING_LEASE_MS).toISOString();
    const staleClaim = await admin
      .from("webhook_events")
      .update(patch)
      .eq("id", eventId)
      .eq("status", "processing")
      .lt("claimed_at", cutoff)
      .select("id");
    if (claimedRow(staleClaim.data)) return true;
    const legacyClaim = await admin
      .from("webhook_events")
      .update(patch)
      .eq("id", eventId)
      .eq("status", "processing")
      .is("claimed_at", null)
      .lt("received_at", cutoff)
      .select("id");
    return claimedRow(legacyClaim.data);
  }
  const claimed = await admin
    .from("webhook_events")
    .update(patch)
    .eq("id", eventId)
    .in("status", ["pending", "failed", "retrying"])
    .select("id");
  return claimedRow(claimed.data);
}

export async function requeueDeadLetterWebhookEvent(eventId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("webhook_events")
    .update(deadLetterRequeuePatch())
    .eq("id", eventId)
    .eq("status", "dead_letter")
    .select("id");
  if (error) return false;
  return claimedRow(data);
}

export async function replayRetryingWebhookEvents(limit = 10): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("webhook_events")
    .select("meta_event_id, payload")
    .eq("status", "retrying")
    .limit(limit);
  const rows = Array.isArray(data) ? data : [];
  let replayed = 0;
  for (const row of rows) {
    const change = row.payload;
    if (!change || typeof change !== "object" || Array.isArray(change)) continue;
    if ("skipped" in change) continue;
    const entryId = String(row.meta_event_id ?? "").split(":")[0] || "unknown_entry";
    try {
      await ingestWhatsAppWebhookPayload({
        object: "whatsapp_business_account",
        entry: [{ id: entryId, changes: [change] }],
      });
      replayed += 1;
    } catch {
      // The event row keeps the failure and the attempt count.
    }
  }
  return replayed;
}

export async function ingestWhatsAppWebhookPayload(
  payload: unknown
): Promise<WebhookIngestionSummary> {
  const summary: WebhookIngestionSummary = {
    eventsLogged: 0,
    duplicatesSkipped: 0,
    messagesInserted: 0,
    echoesProcessed: 0,
    leadsCreated: 0,
    stageTransitions: 0,
  };

  if (!payload || typeof payload !== "object") {
    return summary;
  }

  const root = payload as MetaWebhookPayload;
  if (!Array.isArray(root.entry)) {
    return summary;
  }

  const admin = createAdminClient();
  await reclaimStaleWebhookProcessing(admin);

  for (const entry of root.entry) {
    const entryId = String(entry?.id || "unknown_entry");
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      if (!value || typeof value !== "object") continue;

      const phoneNumberId = value.metadata?.phone_number_id?.trim();
      if (!phoneNumberId) continue;

      const eventType = normalizeEventType(change.field);
      const metaEventId = buildDeterministicEventId(entryId, eventType, phoneNumberId, value);

      // 1. Lookup workspace connection by phone_number_id
      const { data: conn } = await admin
        .from("whatsapp_connections")
        .select("id, workspace_id, organization_id, sales_member_id, connection_status")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();

      const workspaceId = conn?.workspace_id ?? null;
      const authorized = Boolean(
        conn && workspaceId && canAcceptInboundMessages(conn.connection_status)
      );
      let organizationId = conn?.organization_id ?? null;
      if (authorized && !organizationId && workspaceId) {
        const { data: mappings } = await admin
          .from("organization_workspaces")
          .select("organization_id")
          .eq("workspace_id", workspaceId);
        if (mappings?.length === 1) organizationId = mappings[0].organization_id;
      }

      const storedPayload = authorized
        ? (change as unknown as Json)
        : ({ field: change.field ?? null, skipped: "connection_not_authorized" } as Json);

      const { data: loggedEvent, error: logErr } = await admin
        .from("webhook_events")
        .insert({
          workspace_id: workspaceId,
          phone_number_id: phoneNumberId,
          meta_event_id: metaEventId,
          event_type: eventType,
          payload: storedPayload,
          status: authorized ? "processing" : "processed",
          claimed_at: authorized ? new Date().toISOString() : null,
          processed_at: authorized ? null : new Date().toISOString(),
          error_message: authorized ? null : "connection_not_authorized",
        })
        .select("id")
        .single();

      let eventRowId = loggedEvent?.id ?? null;

      if (logErr) {
        if (!isUniqueViolation(logErr)) {
          throw new Error(`Failed to log webhook_event: ${logErr.message}`);
        }
        const { data: existing } = await admin
          .from("webhook_events")
          .select("id, status, error_message, received_at, claimed_at")
          .eq("meta_event_id", metaEventId)
          .maybeSingle();
        const attempt = readWebhookAttempt(existing?.error_message);
        const processingAgeMs = webhookProcessingAgeMs({
          claimedAt: existing?.claimed_at,
          receivedAt: existing?.received_at,
        });
        const decision = decideWebhookRedelivery({
          status: existing?.status,
          attempt,
          processingAgeMs,
        });
        if (decision === "skip_duplicate" || !existing?.id) {
          summary.duplicatesSkipped += 1;
          continue;
        }
        if (decision === "dead_letter") {
          await admin
            .from("webhook_events")
            .update({
              status: "dead_letter",
              error_message: formatWebhookFailure(attempt, "attempt cap reached"),
              processed_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          continue;
        }
        const claimed = await claimWebhookEvent(admin, existing.id, existing.status);
        if (!claimed) {
          summary.duplicatesSkipped += 1;
          continue;
        }
        eventRowId = existing.id;
      }

      if (!eventRowId) {
        throw new Error("Webhook event was not persisted.");
      }

      summary.eventsLogged += 1;

      if (!authorized || !conn || !workspaceId) {
        continue;
      }

      try {
        if (eventType === "messages") {
          const incomingMessages = Array.isArray(value.messages) ? value.messages : [];
          for (const msg of incomingMessages) {
            const wamid = msg.id?.trim();
            const customerWaId = msg.from?.trim();
            if (!wamid || !customerWaId) continue;

            const sentAt = parseMetaTimestamp(msg.timestamp);
            const bodyText = extractMessageBodyText(msg);
            const msgType = normalizeMessageType(msg.type);
            const customerName = resolveContactName(value.contacts, customerWaId);
            const referral = hasValidCtwaReferral(msg.referral) ? msg.referral : undefined;

            const { data: existingConv } = await admin
              .from("conversations")
              .select("id, source_type, first_message_at, last_message_at, customer_name")
              .eq("connection_id", conn.id)
              .eq("customer_wa_id", customerWaId)
              .maybeSingle();

            const nextSourceType =
              existingConv?.source_type === "ctwa"
                ? "ctwa"
                : referral
                  ? "ctwa"
                  : existingConv?.source_type || "organic";

            let verifiedLink: { adId: string; campaignId: string } | null = null;
            if (organizationId && referral?.source_id) {
              const { data: adRows } = await admin
                .from("ads")
                .select("id, campaign_id, organization_id, provider_ad_id")
                .eq("organization_id", organizationId)
                .eq("provider_ad_id", referral.source_id.trim());
              const link = linkVerifiedMetaAd(
                referral.source_id,
                (adRows ?? []) as TenantAdRecord[],
                organizationId
              );
              if (link) verifiedLink = { adId: link.adId, campaignId: link.campaignId };
            }

            const { data: conv, error: convErr } = await admin
              .from("conversations")
              .upsert(
                {
                  workspace_id: workspaceId,
                  organization_id: organizationId,
                  connection_id: conn.id,
                  customer_wa_id: customerWaId,
                  customer_name: customerName || existingConv?.customer_name || null,
                  source_type: nextSourceType,
                  channel: "whatsapp",
                  ad_id: verifiedLink?.adId ?? null,
                  campaign_id: verifiedLink?.campaignId ?? null,
                  attribution_status: verifiedLink ? "verified" : "unknown",
                  first_message_at: existingConv?.first_message_at ?? sentAt,
                  last_message_at: pickLatestIso(existingConv?.last_message_at, sentAt),
                  last_prospect_message_at: sentAt,
                  needs_ai_analysis: true,
                },
                { onConflict: "connection_id,customer_wa_id" }
              )
              .select("id, source_type")
              .single();

            if (convErr || !conv) {
              throw new Error(`Failed to upsert conversation: ${convErr?.message || "Unknown"}`);
            }

            if (organizationId) {
              const phoneHash = hashPhoneNumber(customerWaId);
              const { data: contactRows } = await admin
                .from("contacts")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("phone_hash", phoneHash);
              if (contactRows?.length === 1) {
                const { data: crmRows } = await admin
                  .from("conversations")
                  .select("id")
                  .eq("organization_id", organizationId)
                  .eq("contact_id", contactRows[0].id)
                  .eq("channel", "crm_upload");
                if (crmRows?.length === 1) {
                  await admin
                    .from("conversations")
                    .update({ attribution_evidence: { crm_conversation_id: crmRows[0].id } })
                    .eq("id", conv.id);
                }
              }
            }

            // Insert message idempotently (unique wamid)
            const { error: msgErr } = await admin.from("messages").insert({
              workspace_id: workspaceId,
              conversation_id: conv.id,
              wamid,
              direction: "inbound_prospect",
              sender_type: "buyer",
              message_type: msgType,
              body: bodyText ?? "",
              body_text: bodyText,
              raw_metadata: buildRawMessageMetadata(msg),
              sent_at: sentAt,
            });

            if (msgErr) {
              if (isUniqueViolation(msgErr)) {
                summary.duplicatesSkipped += 1;
                continue;
              }
              throw new Error(`Failed to insert inbound message: ${msgErr.message}`);
            }

            summary.messagesInserted += 1;

            // Only store ctwa_attributions when Meta referral is genuinely present
            if (referral) {
              const { error: attrErr } = await admin.from("ctwa_attributions").upsert(
                {
                  workspace_id: workspaceId,
                  conversation_id: conv.id,
                  source_id: referral.source_id?.trim() || referral.ctwa_clid?.trim() || "unknown",
                  source_type: referral.source_type?.trim() || "ad",
                  source_url: referral.source_url ?? null,
                  headline: referral.headline ?? null,
                  body: referral.body ?? null,
                  ctwa_clid: referral.ctwa_clid ?? null,
                  attribution_confidence: 1.0,
                },
                { onConflict: "conversation_id" }
              );

              if (attrErr) {
                throw new Error(`Failed to upsert CTWA attribution: ${attrErr.message}`);
              }
            }

            // Auto-create lead record for CTWA conversations if none exists yet
            if (conv.source_type === "ctwa") {
              const { data: existingLead } = await admin
                .from("leads")
                .select("id")
                .eq("conversation_id", conv.id)
                .maybeSingle();

              if (!existingLead) {
                const { data: createdLead, error: leadErr } = await admin
                  .from("leads")
                  .insert({
                    workspace_id: workspaceId,
                    conversation_id: conv.id,
                    connection_id: conn.id,
                    assigned_sales_id: conn.sales_member_id ?? null,
                    customer_name: customerName || existingConv?.customer_name || null,
                    customer_phone_masked: maskPhoneNumber(customerWaId),
                    lead_temperature: "unassessed",
                    pipeline_stage: "new_inquiry",
                  })
                  .select("id")
                  .single();

                if (leadErr) {
                  if (!isUniqueViolation(leadErr)) {
                    throw new Error(`Failed to create CTWA lead: ${leadErr.message}`);
                  }
                } else if (createdLead) {
                  summary.leadsCreated += 1;
                  await admin.from("lead_pipeline_events").insert({
                    workspace_id: workspaceId,
                    lead_id: createdLead.id,
                    actor_type: "system",
                    from_stage: null,
                    to_stage: "new_inquiry",
                    from_temperature: null,
                    to_temperature: "unassessed",
                    reason: "CTWA conversation detected",
                  });
                }
              }
            }
          }
        } else if (eventType === "smb_message_echoes") {
          const nowIso = new Date().toISOString();
          await admin
            .from("whatsapp_connections")
            .update({ last_echo_at: nowIso })
            .eq("id", conn.id);

          const echoMessages = Array.isArray(value.message_echoes)
            ? value.message_echoes
            : Array.isArray(value.messages)
              ? value.messages
              : [];

          for (const echo of echoMessages) {
            const wamid = echo.id?.trim();
            const customerWaId = echo.to?.trim();
            if (!wamid || !customerWaId) continue;

            const sentAt = parseMetaTimestamp(echo.timestamp);
            const bodyText = extractMessageBodyText(echo);
            const msgType = normalizeMessageType(echo.type);

            const { data: existingConv } = await admin
              .from("conversations")
              .select(
                "id, source_type, first_message_at, last_message_at, first_response_time_seconds"
              )
              .eq("connection_id", conn.id)
              .eq("customer_wa_id", customerWaId)
              .maybeSingle();

            let computedFrtSeconds: number | null =
              existingConv?.first_response_time_seconds ?? null;

            if (computedFrtSeconds === null && existingConv?.first_message_at) {
              const firstMs = Date.parse(existingConv.first_message_at);
              const echoMs = Date.parse(sentAt);
              if (Number.isFinite(firstMs) && Number.isFinite(echoMs)) {
                computedFrtSeconds = Math.max(0, Math.round((echoMs - firstMs) / 1000));
              }
            }

            const { data: conv, error: convErr } = await admin
              .from("conversations")
              .upsert(
                {
                  workspace_id: workspaceId,
                  connection_id: conn.id,
                  customer_wa_id: customerWaId,
                  source_type: existingConv?.source_type ?? "organic",
                  first_message_at: existingConv?.first_message_at ?? sentAt,
                  last_message_at: pickLatestIso(existingConv?.last_message_at, sentAt),
                  last_sales_echo_at: sentAt,
                  first_response_time_seconds: computedFrtSeconds,
                  needs_ai_analysis: true,
                },
                { onConflict: "connection_id,customer_wa_id" }
              )
              .select("id")
              .single();

            if (convErr || !conv) {
              throw new Error(
                `Failed to upsert conversation for echo: ${convErr?.message || "Unknown"}`
              );
            }

            const { error: msgErr } = await admin.from("messages").insert({
              workspace_id: workspaceId,
              conversation_id: conv.id,
              wamid,
              direction: "outbound_sales_echo",
              sender_type: "sales",
              message_type: msgType,
              body: bodyText ?? "",
              body_text: bodyText,
              raw_metadata: buildRawMessageMetadata(echo),
              sent_at: sentAt,
            });

            if (msgErr) {
              if (isUniqueViolation(msgErr)) {
                summary.duplicatesSkipped += 1;
                continue;
              }
              throw new Error(`Failed to insert echo message: ${msgErr.message}`);
            }

            summary.messagesInserted += 1;
            summary.echoesProcessed += 1;

            // Auto-transition lead from new_inquiry -> contacted if unlocked
            const { data: lead } = await admin
              .from("leads")
              .select("id, pipeline_stage, lead_temperature, manual_stage_lock")
              .eq("conversation_id", conv.id)
              .maybeSingle();

            if (lead && lead.pipeline_stage === "new_inquiry" && !lead.manual_stage_lock) {
              const { data: transitioned } = await admin
                .from("leads")
                .update({ pipeline_stage: "contacted" })
                .eq("id", lead.id)
                .eq("pipeline_stage", "new_inquiry")
                .eq("manual_stage_lock", false)
                .select("id")
                .maybeSingle();

              if (transitioned) {
                summary.stageTransitions += 1;
                await admin.from("lead_pipeline_events").insert({
                  workspace_id: workspaceId,
                  lead_id: lead.id,
                  actor_type: "system",
                  from_stage: "new_inquiry",
                  to_stage: "contacted",
                  from_temperature: lead.lead_temperature,
                  to_temperature: lead.lead_temperature,
                  reason: "Sales replied via WhatsApp Business App",
                });
              }
            }
          }
        }

        await admin
          .from("webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", eventRowId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Webhook processing failed";
        const { data: current } = await admin
          .from("webhook_events")
          .select("error_message")
          .eq("id", eventRowId)
          .maybeSingle();
        const nextAttempt = readWebhookAttempt(current?.error_message) + 1;
        const decision = decideWebhookRedelivery({
          status: "failed",
          attempt: nextAttempt,
          processingAgeMs: null,
        });
        await admin
          .from("webhook_events")
          .update({
            status: decision === "dead_letter" ? "dead_letter" : "failed",
            error_message: formatWebhookFailure(nextAttempt, message),
            processed_at: new Date().toISOString(),
          })
          .eq("id", eventRowId);
        if (decision === "dead_letter") continue;
        throw err;
      }
    }
  }

  return summary;
}
