import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as connectGet, POST as connectPost, DELETE as connectDelete } from "@/app/api/whatsapp/connect/route";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/inbound-service";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as serverSupabase from "@/lib/supabase/server";

describe("Phase 13 — WhatsApp Business Coexistence Connect", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Connection Endpoint Security & Role Authorization", () => {
    it("rejects unauthenticated user on GET /api/whatsapp/connect with HTTP 401", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const response = await connectGet();
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.code).toBe("UNAUTHORIZED");
    });

    it("rejects unauthorized role 'sales' on POST /api/whatsapp/connect with HTTP 403", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_sales_01" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  organization_id: "00000000-0000-0000-0000-000000000001",
                  role: "sales",
                },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "test_auth_code_123",
          wabaId: "waba_12345",
          phoneNumberId: "phone_67890",
        }),
      });

      const response = await connectPost(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe("FORBIDDEN");
      expect(json.error).toContain("tidak memiliki wewenang");
    });

    it("rejects missing required parameters with HTTP 400 validation error", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_admin_01" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  organization_id: "00000000-0000-0000-0000-000000000001",
                  role: "admin",
                },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // missing code, wabaId, phoneNumberId
        }),
      });

      const response = await connectPost(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("allows owner or admin to disconnect with HTTP 200", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_owner_01" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  organization_id: "00000000-0000-0000-0000-000000000001",
                  role: "owner",
                },
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const response = await connectDelete();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.connectionStatus).toBe("disconnected");
    });

    it("fails closed in production mode when META_APP_ID or WHATSAPP_APP_SECRET is not configured", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.META_APP_ID;
      delete process.env.WHATSAPP_APP_SECRET;

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_owner_01" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  organization_id: "00000000-0000-0000-0000-000000000001",
                  role: "owner",
                },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "test_code_123",
          wabaId: "waba_12345",
          phoneNumberId: "phone_67890",
        }),
      });

      const response = await connectPost(request);
      const json = await response.json();

      expect(response.status).toBe(503);
      expect(json.code).toBe("MISSING_CONFIGURATION");
    });
  });

  describe("2. Webhook smb_message_echoes & Coexistence Inbound Processing", () => {
    it("handles smb_message_echoes without treating them as new buyer leads", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "messages") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                  }),
                }),
              }),
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === "contacts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "contact_buyer_1" } }),
                  }),
                }),
              }),
            };
          }
          if (table === "conversations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "conv_buyer_1" } }),
                    }),
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === "whatsapp_connections") {
            return {
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const payload: WhatsAppWebhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_coex_123",
            changes: [
              {
                field: "smb_message_echoes",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+62812999001",
                    phone_number_id: "phone_coex_123",
                  },
                  smb_message_echoes: [
                    {
                      from: "62812999001", // Business phone
                      to: "6281311223344", // Buyer phone
                      id: "wamid.HBgEchoTest01",
                      timestamp: "1729931000",
                      type: "text",
                      text: { body: "Halo pak, unit Sapphire tipe 72 masih ready." },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await processWhatsAppWebhookPayload(payload, {
        organizationId: "00000000-0000-0000-0000-000000000001",
        supabaseClient: mockSupabase as unknown as SupabaseClient,
      });

      expect(result.status).toBe("processed");
      expect(result.echoMessagesCount).toBe(1);
      // CRITICAL: Must not count as new inbound buyer message!
      expect(result.processedMessagesCount).toBe(0);
      expect(result.attributionStatus).toBe("unknown"); // Echo does not create ad attribution
    });

    it("deduplicates repeated smb_message_echoes by provider_message_id", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "messages") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    // Pre-check finds duplicate message
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "msg_existing_echo", conversation_id: "conv_1" },
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }),
      };

      const payload: WhatsAppWebhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_coex_123",
            changes: [
              {
                field: "smb_message_echoes",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+62812999001",
                    phone_number_id: "phone_coex_123",
                  },
                  smb_message_echoes: [
                    {
                      from: "62812999001",
                      to: "6281311223344",
                      id: "wamid.HBgDuplicateEcho",
                      timestamp: "1729931000",
                      type: "text",
                      text: { body: "Pesan duplikat echo." },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await processWhatsAppWebhookPayload(payload, {
        organizationId: "00000000-0000-0000-0000-000000000001",
        supabaseClient: mockSupabase as unknown as SupabaseClient,
      });

      expect(result.status).toBe("duplicate");
      expect(result.duplicateMessagesCount).toBe(1);
      expect(result.echoMessagesCount).toBe(0);
      expect(result.processedMessagesCount).toBe(0);
    });

    it("processes historical events idempotently without incrementing lead metrics", async () => {
      const payload: WhatsAppWebhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_coex_123",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+62812999001",
                    phone_number_id: "phone_coex_123",
                  },
                  history: [
                    {
                      from: "6281399887766",
                      id: "wamid.HistoryOldEvent01",
                      timestamp: "1629931000",
                      type: "text",
                      text: { body: "Pesan historis lampau" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await processWhatsAppWebhookPayload(payload, {
        organizationId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result.status).toBe("processed");
      expect(result.historyMessagesCount).toBe(1);
      expect(result.processedMessagesCount).toBe(0); // Never counted as new inbound leads
      expect(result.attributionStatus).toBe("unknown");
    });
  });
});
