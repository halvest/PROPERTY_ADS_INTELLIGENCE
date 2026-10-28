import { describe, it, expect } from "vitest";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/inbound-service";
import { createAttributionEvent } from "@/domain/attribution/evaluator";
import { validateCriterionInput, calculateDimensionAssessment } from "@/domain/scoring/calculator";
import { BUYER_RUBRIC_V1 } from "@/domain/scoring/rubrics";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("Phase 8 - Audit Matrix: Attribution, Identity & Scoring Verification", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";

  // 1. Referral iklan Meta yang valid dan cocok dengan ad terdaftar -> verified
  it("Matrix 1: Verified attribution for valid Meta referral matching registered ad", async () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_100",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "6280000", phone_number_id: "PN_100" },
                messages: [
                  {
                    from: "6281298765432",
                    id: "wamid.VALID_REGISTERED_AD",
                    timestamp: "1729930000",
                    type: "text",
                    text: { body: "Halo saya tertarik dengan Cluster Sapphire BSD" },
                    referral: {
                      source_type: "ad",
                      source_id: "ad_sapphire_72", // Registered ad
                      headline: "Cluster Sapphire BSD Tipe 72",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await processWhatsAppWebhookPayload(payload, { organizationId: orgId });
    expect(result.attributionStatus).toBe("verified");
    expect(result.adId).toBe("ad_sapphire_72");
    expect(result.isLiveVerified).toBe(true);
  });

  // 2. Referral dengan source_id yang tidak dikenal -> unknown, NOT verified
  it("Matrix 2: Unknown attribution for Meta referral with unknown/unregistered source_id", async () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_100",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "6280000", phone_number_id: "PN_100" },
                messages: [
                  {
                    from: "6281298765432",
                    id: "wamid.UNKNOWN_AD_ID",
                    timestamp: "1729930000",
                    type: "text",
                    text: { body: "Halo saya klik iklan ini" },
                    referral: {
                      source_type: "ad",
                      source_id: "ad_unregistered_999999", // Unregistered ad ID
                      headline: "Promo Rumah Rahasia",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await processWhatsAppWebhookPayload(payload, { organizationId: orgId });
    expect(result.attributionStatus).toBe("unknown");
    expect(result.adId).toBeNull();
    expect(result.isLiveVerified).toBe(false);
  });

  // 3. Pesan organik tanpa referral -> unknown
  it("Matrix 3: Unknown attribution for organic incoming message without referral", async () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_100",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "6280000", phone_number_id: "PN_100" },
                messages: [
                  {
                    from: "628111222333",
                    id: "wamid.ORGANIC_MSG",
                    timestamp: "1729930000",
                    type: "text",
                    text: { body: "Selamat pagi, kantor buka jam berapa ya?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await processWhatsAppWebhookPayload(payload, { organizationId: orgId });
    expect(result.attributionStatus).toBe("unknown");
    expect(result.adId).toBeNull();
  });

  // 4. Pesan dengan headline mirip campaign -> inferred (NEVER verified)
  it("Matrix 4: Inferred attribution for message matching campaign keyword without official referral", async () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_100",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "6280000", phone_number_id: "PN_100" },
                messages: [
                  {
                    from: "628198765432",
                    id: "wamid.INFERRED_MSG",
                    timestamp: "1729930000",
                    type: "text",
                    text: { body: "Saya lihat info cluster sapphire hook, masih ada?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await processWhatsAppWebhookPayload(payload, { organizationId: orgId });
    expect(result.attributionStatus).toBe("inferred");
    expect(result.attributionStatus).not.toBe("verified");
    expect(result.adId).toBe("ad_sapphire_72");
  });

  // 5. Kontak yang cocok dengan lebih dari satu lead (ambigu) -> unknown
  it("Matrix 5: Ambiguous contact match marks attribution as unknown requiring manual verification", async () => {
    // Mock Supabase client returning 2 matching contacts for same phone hash
    const mockSupabaseAmbiguous = {
      from: (table: string) => {
        if (table === "messages") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          };
        }
        if (table === "contacts") {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({
                  // Multiple contacts found with the same phone hash
                  data: [{ id: "contact_01" }, { id: "contact_02" }],
                }),
              }),
            }),
          };
        }
        return {};
      },
    } as unknown as SupabaseClient;

    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_100",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "6280000", phone_number_id: "PN_100" },
                messages: [
                  {
                    from: "6281299998888",
                    id: "wamid.AMBIGUOUS_MSG",
                    timestamp: "1729930000",
                    type: "text",
                    text: { body: "Saya mau survey lokasi" },
                    referral: {
                      source_type: "ad",
                      source_id: "ad_sapphire_72",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await processWhatsAppWebhookPayload(payload, {
      organizationId: orgId,
      supabaseClient: mockSupabaseAmbiguous,
    });

    expect(result.attributionStatus).toBe("unknown");
    expect(result.contactId).toBeUndefined();
  });

  // 6. Pesan duplikat -> idempoten
  it("Matrix 6: Duplicate message idempotency skips re-processing duplicate wamid", async () => {
    const mockSupabaseDuplicate = {
      from: (table: string) => {
        if (table === "messages") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: "msg_existing", conversation_id: "conv_existing" },
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    } as unknown as SupabaseClient;

    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_100",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "6280000", phone_number_id: "PN_100" },
                messages: [
                  {
                    from: "628123456789",
                    id: "wamid.DUPLICATE_ID",
                    timestamp: "1729930000",
                    type: "text",
                    text: { body: "Halo" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await processWhatsAppWebhookPayload(payload, {
      organizationId: orgId,
      supabaseClient: mockSupabaseDuplicate,
    });

    expect(result.status).toBe("duplicate");
    expect(result.duplicateMessagesCount).toBe(1);
    expect(result.processedMessagesCount).toBe(0);
  });

  // 7. Evidence kosong -> confidence strictly null
  it("Matrix 7: Empty evidence produces strictly null confidence without fabricating numeric certainty", () => {
    const criterion = validateCriterionInput("budget_fit", 20, {
      criterion: "budget_fit",
      points: 20,
      evidence: [], // Empty evidence
    });

    expect(criterion.status).toBe("scored");
    expect(criterion.score).toBe(20);
    expect(criterion.confidence).toBeNull();

    const dimension = calculateDimensionAssessment({
      rubric: BUYER_RUBRIC_V1,
      dimension: "buyer",
      inputs: [
        { criterion: "purchase_intent", points: 20, evidence: [] },
        { criterion: "budget_fit", points: 20, evidence: [] },
        { criterion: "property_needs_fit", points: 20, evidence: [] },
        { criterion: "purchase_timeline", points: 15, evidence: [] },
        { criterion: "readiness_for_action", points: 20, evidence: [] },
      ],
    });

    expect(dimension.confidence).toBeNull();
  });

  // 8. Kriteria scored dengan nilai 0 -> valid score 0
  it("Matrix 8: Scored criterion with value 0 is preserved as valid 0 rather than missing or invalid", () => {
    const criterion = validateCriterionInput("purchase_timeline", 15, {
      criterion: "purchase_timeline",
      points: 0,
      evidence: [
        {
          criterion: "purchase_timeline",
          evidenceStatus: "supported",
          explanation: "Belum mau beli sekarang, cuma iseng lihat-lihat",
          messageId: "msg_01",
        },
      ],
    });

    expect(criterion.status).toBe("scored");
    expect(criterion.score).toBe(0);
    expect(criterion.confidence).toBeGreaterThan(0.8);
  });

  // 9. Kriteria missing dan invalid
  it("Matrix 9: Missing and invalid criteria return score: null with appropriate statuses", () => {
    const missing = validateCriterionInput("budget_fit", 20, {
      criterion: "budget_fit",
      status: "missing",
    });
    expect(missing.status).toBe("missing");
    expect(missing.score).toBeNull();
    expect(missing.confidence).toBeNull();

    const negative = validateCriterionInput("readiness_for_action", 20, {
      criterion: "readiness_for_action",
      points: -5,
    });
    expect(negative.status).toBe("invalid");
    expect(negative.score).toBeNull();
    expect(negative.invalidReason).toContain("negatif");

    const exceeds = validateCriterionInput("readiness_for_action", 20, {
      criterion: "readiness_for_action",
      points: 999,
    });
    expect(exceeds.status).toBe("invalid");
    expect(exceeds.score).toBeNull();
    expect(exceeds.invalidReason).toContain("melebihi batas");
  });

  // 10. Koreksi atribusi oleh pengguna berwenang
  it("Matrix 10: Attribution correction by authorized actor creates persistent audit record", () => {
    const event = createAttributionEvent({
      organizationId: orgId,
      conversationId: "conv_12345",
      previousStatus: "inferred",
      newStatus: "verified",
      previousAdId: "ad_sapphire_72",
      newAdId: "ad_sapphire_72",
      attributionMethod: "manual_override",
      actorId: "usr_lead_manager_01",
      reason: "Dikonfirmasi langsung oleh pembeli saat survey unit bahwa melihat iklan Instagram",
    });

    expect(event.organizationId).toBe(orgId);
    expect(event.conversationId).toBe("conv_12345");
    expect(event.previousStatus).toBe("inferred");
    expect(event.newStatus).toBe("verified");
    expect(event.actorId).toBe("usr_lead_manager_01");
    expect(event.attributionMethod).toBe("manual_override");
    expect(event.createdAt).toBeDefined();
  });
});
