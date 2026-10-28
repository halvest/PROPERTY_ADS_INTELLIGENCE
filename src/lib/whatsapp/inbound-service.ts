import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAttribution } from "@/domain/attribution/evaluator";
import type { AttributionStatus } from "@/domain/attribution/types";
import type {
  WhatsAppWebhookPayload,
  InboundProcessingResult,
} from "./types";
import { hashPhoneNumber, maskPhoneNumber } from "./config";
import { persistAttributionEvent } from "@/lib/data/attribution-history-service";

export interface InboundServiceOptions {
  organizationId: string;
  supabaseClient?: SupabaseClient;
  allowDemoFallback?: boolean;
}

const KNOWN_REGISTERED_MOCK_ADS = new Set([
  "ad_sapphire_72",
  "ad_sapphire_promo",
  "ad_emerald_hook",
]);

/**
 * Property Ads Intelligence - WhatsApp Inbound Webhook Processor
 *
 * Implements:
 * 1. Conservative lead contact resolution (phone hashing and masking).
 * 2. Evidence-first attribution evaluation:
 *    - 'verified': Official Meta Click-to-WhatsApp referral metadata with verified registered ad ID.
 *    - 'inferred': Text headline or promo match.
 *    - 'unknown': Organic inquiry, unregistered ad referral, or ambiguous contacts.
 * 3. Idempotent message deduplication based on provider_message_id (wamid) & unique DB constraint.
 * 4. Persistent audit trail recording in attribution_events.
 */
export async function processWhatsAppWebhookPayload(
  payload: WhatsAppWebhookPayload,
  options: InboundServiceOptions
): Promise<InboundProcessingResult> {
  const { organizationId, supabaseClient, allowDemoFallback } = options;
  const isProduction = process.env.NODE_ENV === "production";
  const allowDemo = allowDemoFallback !== undefined ? allowDemoFallback : !isProduction;

  if (!organizationId) {
    throw new Error("organizationId wajib disertakan untuk isolasi tenant.");
  }

  const entries = payload?.entry || [];
  let processedMessagesCount = 0;
  let duplicateMessagesCount = 0;
  let echoMessagesCount = 0;
  let historyMessagesCount = 0;
  let finalAttributionStatus: AttributionStatus = "unknown";
  let resolvedAdId: string | null = null;
  let providerAdId: string | null = null;
  let resolvedContactId: string | undefined;
  let resolvedConversationId: string | undefined;

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages" && change.field !== "smb_message_echoes") {
        continue;
      }

      const value = change.value;
      const messages = value?.messages || [];
      const echoes = value?.smb_message_echoes || [];
      const history = value?.history || [];

      // Touch connection heartbeat if phone_number_id is present in metadata
      if (supabaseClient && value?.metadata?.phone_number_id) {
        try {
          const nowIso = new Date().toISOString();
          await supabaseClient
            .from("whatsapp_connections")
            .update({ last_webhook_received_at: nowIso })
            .eq("organization_id", organizationId)
            .eq("phone_number_id", value.metadata.phone_number_id);

          await supabaseClient
            .from("integration_connections")
            .update({
              status: "connected",
              last_synced_at: nowIso,
              updated_at: nowIso,
            })
            .eq("organization_id", organizationId)
            .eq("provider", "whatsapp");
        } catch {
          // Non-blocking connection touch error
        }
      }

      // 1. Process Mobile WhatsApp Business App Echoes (Coexistence Flow)
      // These represent manual outbound replies sent by staff/owner from the physical phone.
      // MUST NOT be treated as new inbound buyer leads or trigger attribution changes.
      for (const echo of echoes) {
        const rawPhone = echo.to; // The buyer's phone being replied to
        const providerMessageId = echo.id;
        const messageBody = echo.text?.body || "";
        const sentAt = echo.timestamp
          ? new Date(parseInt(echo.timestamp, 10) * 1000).toISOString()
          : new Date().toISOString();

        if (supabaseClient && providerMessageId) {
          const { data: existingMsg } = await supabaseClient
            .from("messages")
            .select("id, conversation_id")
            .eq("organization_id", organizationId)
            .eq("provider_message_id", providerMessageId)
            .maybeSingle();

          if (existingMsg) {
            duplicateMessagesCount++;
            continue;
          }
        }

        const phoneHash = hashPhoneNumber(rawPhone);

        if (supabaseClient) {
          const { data: existingContact } = await supabaseClient
            .from("contacts")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("phone_hash", phoneHash)
            .maybeSingle();

          if (existingContact) {
            const { data: existingConv } = await supabaseClient
              .from("conversations")
              .select("id")
              .eq("organization_id", organizationId)
              .eq("contact_id", existingContact.id)
              .eq("channel", "whatsapp")
              .maybeSingle();

            if (existingConv) {
              await supabaseClient.from("messages").insert({
                organization_id: organizationId,
                conversation_id: existingConv.id,
                provider_message_id: providerMessageId,
                direction: "outbound",
                sender_type: "staff",
                message_type: echo.type === "text" ? "text" : "unknown",
                body: messageBody,
                sent_at: sentAt,
              });

              await supabaseClient
                .from("conversations")
                .update({ last_message_at: sentAt })
                .eq("id", existingConv.id);

              resolvedConversationId = existingConv.id;
              echoMessagesCount++;
            }
          }
        } else {
          echoMessagesCount++;
        }
      }

      // 2. Process History Sync Messages (Idempotent historical events)
      for (const hist of history) {
        const providerMessageId = hist.id;
        if (supabaseClient && providerMessageId) {
          const { data: existingMsg } = await supabaseClient
            .from("messages")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("provider_message_id", providerMessageId)
            .maybeSingle();

          if (existingMsg) {
            duplicateMessagesCount++;
            continue;
          }
        }
        historyMessagesCount++;
      }

      // If no normal inbound messages to evaluate, skip to next change
      if (messages.length === 0) {
        continue;
      }

      const contactName = value.contacts?.[0]?.profile?.name || "Calon Pembeli WhatsApp";

      for (const msg of messages) {
        const rawPhone = msg.from;
        const providerMessageId = msg.id; // e.g. "wamid.HBg..."
        const messageBody = msg.text?.body || "";
        const sentAt = msg.timestamp
          ? new Date(parseInt(msg.timestamp, 10) * 1000).toISOString()
          : new Date().toISOString();

        // 1. Idempotency Check in Database (Pre-check)
        if (supabaseClient && providerMessageId) {
          const { data: existingMsg } = await supabaseClient
            .from("messages")
            .select("id, conversation_id")
            .eq("organization_id", organizationId)
            .eq("provider_message_id", providerMessageId)
            .maybeSingle();

          if (existingMsg) {
            duplicateMessagesCount++;
            resolvedConversationId = existingMsg.conversation_id;
            continue; // Skip re-processing duplicate event
          }
        }

        // 2. Contact Resolution (Privacy-preserving & Ambiguity-safe)
        const phoneHash = hashPhoneNumber(rawPhone);
        const phoneMasked = maskPhoneNumber(rawPhone);
        let isContactAmbiguous = false;

        if (supabaseClient) {
          // Check for existing contacts
          const { data: existingContacts } = await supabaseClient
            .from("contacts")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("phone_hash", phoneHash);

          if (existingContacts && existingContacts.length > 1) {
            // Ambiguous contact match - do NOT guess or bind arbitrarily
            isContactAmbiguous = true;
            resolvedContactId = undefined;
          } else if (existingContacts && existingContacts.length === 1) {
            resolvedContactId = existingContacts[0].id;
          } else {
            // Create contact with race-condition safety
            const { data: newContact, error: insertErr } = await supabaseClient
              .from("contacts")
              .insert({
                organization_id: organizationId,
                name: contactName,
                phone_hash: phoneHash,
                phone_masked: phoneMasked,
              })
              .select("id")
              .maybeSingle();

            if (insertErr && (insertErr.code === "23505" || insertErr.message?.includes("unique"))) {
              const { data: refetchedContact } = await supabaseClient
                .from("contacts")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("phone_hash", phoneHash)
                .maybeSingle();
              resolvedContactId = refetchedContact?.id;
            } else if (insertErr) {
              throw new Error(`Gagal menyimpan kontak lead ke database: ${insertErr.message}`);
            } else {
              resolvedContactId = newContact?.id;
            }
          }
        } else {
          resolvedContactId = `con_syn_${phoneHash.slice(0, 8)}`;
        }

        // 3. Attribution Evaluation (Conservative & Evidence-First)
        const referral = msg.referral;

        if (isContactAmbiguous) {
          // If contact is ambiguous, mark unknown and require manual verification
          finalAttributionStatus = "unknown";
          resolvedAdId = null;
          providerAdId = referral?.source_id || null;
        } else if (referral && referral.source_type === "ad" && referral.source_id) {
          // Official Meta Click-to-WhatsApp Referral
          providerAdId = referral.source_id;
          let isAdRegistered = false;

          // Verify if provider_ad_id corresponds to a registered ad in the system
          if (supabaseClient) {
            const { data: matchedAd } = await supabaseClient
              .from("ads")
              .select("id")
              .eq("organization_id", organizationId)
              .eq("provider_ad_id", referral.source_id)
              .maybeSingle();

            if (matchedAd) {
              resolvedAdId = matchedAd.id;
              isAdRegistered = true;
            }
          } else {
            if (KNOWN_REGISTERED_MOCK_ADS.has(referral.source_id)) {
              resolvedAdId = referral.source_id;
              isAdRegistered = true;
            }
          }

          if (isAdRegistered) {
            finalAttributionStatus = "verified";
          } else {
            // Unregistered or unknown source_id must NOT be marked verified
            resolvedAdId = null;
            finalAttributionStatus = "unknown";
          }
        } else {
          // Check for inferred candidate (genuine tenant-scoped ad name lookup in live mode)
          let inferredCandidate: {
            method: "headline_match" | "promo_code_match" | "landing_page_session";
            matchedText: string;
            confidence: number;
            adId: string;
            campaignId?: string;
          } | undefined;

          if (supabaseClient) {
            // Live mode: Lookup tenant's registered ads to match genuine ad names
            try {
              const { data: tenantAds } = await supabaseClient
                .from("ads")
                .select("id, name, campaign_id")
                .eq("organization_id", organizationId)
                .limit(25);

              if (tenantAds && tenantAds.length > 0) {
                const lowerMsg = messageBody.toLowerCase();
                const matchedAd = tenantAds.find((ad) => {
                  if (!ad.name) return false;
                  const words = ad.name.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 4);
                  return words.some((w: string) => lowerMsg.includes(w));
                });

                if (matchedAd) {
                  inferredCandidate = {
                    method: "headline_match",
                    matchedText: matchedAd.name,
                    confidence: 0.70,
                    adId: matchedAd.id,
                    campaignId: matchedAd.campaign_id,
                  };
                }
              }
            } catch {
              // Non-blocking query failure -> remains unknown
            }
          } else if (allowDemo && messageBody.toLowerCase().includes("sapphire")) {
            // Controlled mock/demo test context only
            inferredCandidate = {
              method: "headline_match",
              matchedText: "Cluster Sapphire BSD",
              confidence: 0.75,
              adId: "ad_sapphire_72",
            };
          }

          const evaluation = evaluateAttribution({
            conversationMessageText: messageBody,
            inferredCandidate,
          });

          finalAttributionStatus = evaluation.status;
          resolvedAdId = evaluation.adId;
          providerAdId = evaluation.adId;
        }

        // 4. Conversation Resolution & Message Persistence
        if (supabaseClient && resolvedContactId) {
          // Check for existing conversation for this contact
          const { data: existingConv } = await supabaseClient
            .from("conversations")
            .select("id, attribution_status, ad_id")
            .eq("organization_id", organizationId)
            .eq("contact_id", resolvedContactId)
            .eq("channel", "whatsapp")
            .maybeSingle();

          if (existingConv) {
            resolvedConversationId = existingConv.id;
            // Update last_message_at
            await supabaseClient
              .from("conversations")
              .update({
                last_message_at: sentAt,
                // Only upgrade attribution if newly verified
                ...(finalAttributionStatus === "verified" && existingConv.attribution_status !== "verified"
                  ? { attribution_status: "verified", ad_id: resolvedAdId }
                  : {}),
              })
              .eq("id", existingConv.id);
          } else {
            // Create new conversation
            const { data: newConv, error: convErr } = await supabaseClient
              .from("conversations")
              .insert({
                organization_id: organizationId,
                contact_id: resolvedContactId,
                ad_id: resolvedAdId,
                channel: "whatsapp",
                channel_conversation_id: rawPhone,
                deduplication_id: `${organizationId}_whatsapp_${phoneHash}`,
                attribution_status: finalAttributionStatus,
                attribution_evidence: referral ? { referral } : {},
                started_at: sentAt,
                last_message_at: sentAt,
              })
              .select("id")
              .single();

            if (convErr) {
              throw new Error(`Gagal membuat percakapan lead ke database: ${convErr.message}`);
            }

            resolvedConversationId = newConv?.id;
          }

          // Insert inbound message with unique constraint race-condition handling
          if (resolvedConversationId) {
            const { error: msgInsertErr } = await supabaseClient.from("messages").insert({
              organization_id: organizationId,
              conversation_id: resolvedConversationId,
              provider_message_id: providerMessageId,
              direction: "inbound",
              sender_type: "buyer",
              message_type: msg.type === "text" ? "text" : "unknown",
              body: messageBody,
              sent_at: sentAt,
            });

            if (
              msgInsertErr &&
              (msgInsertErr.code === "23505" ||
                msgInsertErr.message?.includes("idx_messages_provider_id_unique"))
            ) {
              duplicateMessagesCount++;
              continue;
            } else if (msgInsertErr) {
              throw new Error(`Gagal menyimpan pesan inbound ke database: ${msgInsertErr.message}`);
            }

            // Persistently record attribution audit event
            await persistAttributionEvent({
              organizationId,
              conversationId: resolvedConversationId,
              previousStatus: null,
              newStatus: finalAttributionStatus,
              previousAdId: null,
              newAdId: resolvedAdId,
              attributionMethod:
                finalAttributionStatus === "verified"
                  ? "meta_cloud_api_referral"
                  : finalAttributionStatus === "inferred"
                  ? "headline_text_match"
                  : "organic_no_referral",
              reason:
                finalAttributionStatus === "verified"
                  ? `Atribusi terverifikasi melalui referral resmi Meta Click-to-WhatsApp (Ad ID: ${providerAdId})`
                  : isContactAmbiguous
                  ? "Pencocokan kontak ambigu (multiple contacts found), membutuhkan verifikasi manual"
                  : finalAttributionStatus === "inferred"
                  ? "Atribusi inferensi berbasis kecocokan kata kunci kampanye"
                  : referral?.source_id
                  ? `Referral provider_ad_id (${referral.source_id}) tidak cocok dengan iklan terdaftar.`
                  : "Pesan organik WhatsApp tanpa metadata iklan",
              evidence: referral ? { referral } : {},
              supabaseClient,
            });
          }
        } else {
          resolvedConversationId = `conv_syn_${Date.now()}`;
        }

        processedMessagesCount++;
      }
    }
  }

  const finalStatus: "processed" | "ignored" | "duplicate" =
    processedMessagesCount > 0 || echoMessagesCount > 0 || historyMessagesCount > 0
      ? "processed"
      : duplicateMessagesCount > 0
      ? "duplicate"
      : "ignored";

  return {
    status: finalStatus,
    processedMessagesCount,
    duplicateMessagesCount,
    echoMessagesCount,
    historyMessagesCount,
    contactId: resolvedContactId,
    conversationId: resolvedConversationId,
    attributionStatus: finalAttributionStatus,
    adId: resolvedAdId,
    providerAdId,
    isLiveVerified: finalAttributionStatus === "verified",
  };
}
