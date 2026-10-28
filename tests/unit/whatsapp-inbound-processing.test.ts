import { describe, it, expect, vi } from "vitest";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/inbound-service";
import {
  MOCK_WHATSAPP_VERIFIED_REFERRAL_PAYLOAD,
  MOCK_WHATSAPP_INFERRED_PAYLOAD,
  MOCK_WHATSAPP_ORGANIC_PAYLOAD,
  MOCK_WHATSAPP_STATUS_UPDATE_PAYLOAD,
} from "@/fixtures/whatsapp-webhooks";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("WhatsApp Inbound Webhook Processor", () => {
  const demoOrgId = "00000000-0000-0000-0000-000000000001";

  it("extracts official referral and sets attributionStatus to 'verified'", async () => {
    const result = await processWhatsAppWebhookPayload(
      MOCK_WHATSAPP_VERIFIED_REFERRAL_PAYLOAD,
      {
        organizationId: demoOrgId,
        allowDemoFallback: true,
      }
    );

    expect(result.status).toBe("processed");
    expect(result.processedMessagesCount).toBe(1);
    expect(result.attributionStatus).toBe("verified");
    expect(result.providerAdId).toBe("ad_sapphire_72");
    expect(result.isLiveVerified).toBe(true);
    expect(result.contactId).toBeDefined();
    expect(result.conversationId).toBeDefined();
  });

  it("identifies promotional text and sets attributionStatus to 'inferred'", async () => {
    const result = await processWhatsAppWebhookPayload(
      MOCK_WHATSAPP_INFERRED_PAYLOAD,
      {
        organizationId: demoOrgId,
        allowDemoFallback: true,
      }
    );

    expect(result.status).toBe("processed");
    expect(result.attributionStatus).toBe("inferred");
    expect(result.adId).toBe("ad_sapphire_72");
    expect(result.isLiveVerified).toBe(false);
  });

  it("identifies organic messages without ad context and sets attributionStatus to 'unknown'", async () => {
    const result = await processWhatsAppWebhookPayload(
      MOCK_WHATSAPP_ORGANIC_PAYLOAD,
      {
        organizationId: demoOrgId,
        allowDemoFallback: true,
      }
    );

    expect(result.status).toBe("processed");
    expect(result.attributionStatus).toBe("unknown");
    expect(result.adId).toBeNull();
  });

  it("ignores webhook notifications that contain only message delivery statuses", async () => {
    const result = await processWhatsAppWebhookPayload(
      MOCK_WHATSAPP_STATUS_UPDATE_PAYLOAD,
      {
        organizationId: demoOrgId,
        allowDemoFallback: true,
      }
    );

    expect(result.status).toBe("ignored");
    expect(result.processedMessagesCount).toBe(0);
  });

  it("handles duplicate incoming message events idempotently", async () => {
    // Mock Supabase returning an existing message with the same provider_message_id
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "messages") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "msg_existing_1", conversation_id: "conv_existing_1" },
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    const result = await processWhatsAppWebhookPayload(
      MOCK_WHATSAPP_VERIFIED_REFERRAL_PAYLOAD,
      {
        organizationId: demoOrgId,
        supabaseClient: mockSupabase,
      }
    );

    expect(result.status).toBe("duplicate");
    expect(result.duplicateMessagesCount).toBe(1);
    expect(result.processedMessagesCount).toBe(0);
    expect(result.conversationId).toBe("conv_existing_1");
  });
});
