import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as connectGet, POST as connectPost, DELETE as connectDelete } from "@/app/api/whatsapp/connect/route";
import { POST as webhookPost } from "@/app/api/webhook/whatsapp/route";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/inbound-service";
import * as serverSupabase from "@/lib/supabase/server";
import * as connectionService from "@/lib/whatsapp/connection-service";
import {
  encryptAccessToken,
  decryptAccessToken,
  generateOAuthCsrfState,
  verifyOAuthCsrfState,
} from "@/lib/whatsapp/crypto";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";

describe("Phase 13.1 — WhatsApp Coexistence Pre-Live Security Audit", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Anti-CSRF & Forged Onboarding Callbacks", () => {
    it("generates and cryptographically validates genuine OAuth state token", () => {
      process.env.WHATSAPP_APP_SECRET = "audit_secret_key_abcdef123456789";
      const orgId = "00000000-0000-0000-0000-000000000001";
      const userId = "user_owner_01";

      const state = generateOAuthCsrfState({ organizationId: orgId, userId });
      expect(state).toContain(".");

      const verification = verifyOAuthCsrfState(state, {
        organizationId: orgId,
        userId,
      });

      expect(verification.valid).toBe(true);
    });

    it("rejects forged or tampered anti-CSRF state token with 403 Forbidden", async () => {
      process.env.WHATSAPP_APP_SECRET = "audit_secret_key_abcdef123456789";
      const orgId = "00000000-0000-0000-0000-000000000001";
      const userId = "user_owner_01";

      const validState = generateOAuthCsrfState({ organizationId: orgId, userId });
      const tamperedState = validState.slice(0, -4) + "XXXX"; // Tamper with HMAC signature

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "owner" },
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
          wabaId: "waba_valid",
          phoneNumberId: "phone_valid",
          state: tamperedState,
        }),
      });

      const response = await connectPost(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe("CSRF_VERIFICATION_FAILED");
      expect(json.error).toContain("anti-CSRF");
    });

    it("rejects state token issued to a different tenant (tenant hijacking attempt)", async () => {
      process.env.WHATSAPP_APP_SECRET = "audit_secret_key_abcdef123456789";
      const victimOrgId = "victim-org-uuid-0000-000000000001";
      const attackerOrgId = "attacker-org-uuid-0000-000000000002";
      const attackerUserId = "user_attacker_01";

      // State was issued to victimOrgId
      const stateForVictim = generateOAuthCsrfState({
        organizationId: victimOrgId,
        userId: attackerUserId,
      });

      // Attacker tries to use it in attackerOrgId
      const verification = verifyOAuthCsrfState(stateForVictim, {
        organizationId: attackerOrgId,
        userId: attackerUserId,
      });

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain("tenant mismatch");
    });
  });

  describe("2. Cross-Tenant Overwrite Protection", () => {
    it("rejects connection when phone number is already actively bound to another organization (409 Conflict)", async () => {
      process.env.WHATSAPP_APP_SECRET = "audit_secret_key_abcdef123456789";
      const orgId = "00000000-0000-0000-0000-000000000002";
      const userId = "user_owner_02";

      const validState = generateOAuthCsrfState({ organizationId: orgId, userId });

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      // Simulate that the phone is already bound to another tenant
      vi.spyOn(connectionService, "isPhoneNumberBoundToOtherOrg").mockResolvedValue(true);

      const request = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "test_code_hijack",
          wabaId: "waba_other",
          phoneNumberId: "phone_already_active_on_org1",
          state: validState,
        }),
      });

      const response = await connectPost(request);
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.code).toBe("PHONE_NUMBER_ALREADY_BOUND");
      expect(json.error).toContain("sudah aktif terhubung pada organisasi lain");
    });
  });

  describe("3. Token Encryption & Zero Plaintext Response Leakage", () => {
    it("encrypts and decrypts access token with authenticated AES-256-GCM", () => {
      process.env.WHATSAPP_APP_SECRET = "super_secure_server_app_secret_32b";
      const sensitiveToken = "EAAGm0PX4ZCpsBA...meta_user_long_lived_access_token";

      const { encryptedToken, iv, tag } = encryptAccessToken(sensitiveToken);

      expect(encryptedToken).not.toBe(sensitiveToken);
      expect(encryptedToken).not.toContain("EAAGm0");
      expect(iv).toBeDefined();
      expect(tag).toBeDefined();

      const decrypted = decryptAccessToken(encryptedToken, iv, tag);
      expect(decrypted).toBe(sensitiveToken);
    });

    it("verifies GET /api/whatsapp/connect never leaks tokens or app secrets in response", async () => {
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

      const response = await connectGet();
      const json = await response.json();
      const stringified = JSON.stringify(json);

      expect(response.status).toBe(200);
      expect(stringified).not.toContain("access_token");
      expect(stringified).not.toContain("appSecret");
      expect(stringified).not.toContain("app_secret");
      expect(stringified).not.toContain("encrypted_access_token");
      expect(json.csrfState).toBeDefined();
    });

    it("verifies POST /api/whatsapp/connect never leaks access token in response payload", async () => {
      process.env.WHATSAPP_APP_SECRET = "audit_secret_key_abcdef123456789";
      const orgId = "00000000-0000-0000-0000-000000000001";
      const userId = "user_owner_01";
      const validState = generateOAuthCsrfState({ organizationId: orgId, userId });

      vi.spyOn(connectionService, "isPhoneNumberBoundToOtherOrg").mockResolvedValue(false);
      vi.spyOn(connectionService, "saveEncryptedConnectionSecret").mockResolvedValue();

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: orgId, role: "owner" },
              }),
            }),
          }),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "conn-uuid-1",
                  organization_id: orgId,
                  phone_number_id: "1234567890",
                  connection_status: "connected",
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "mock_auth_code_secret",
          wabaId: "waba_123",
          phoneNumberId: "phone_456",
          state: validState,
        }),
      });

      const response = await connectPost(request);
      const json = await response.json();
      const stringified = JSON.stringify(json);

      expect(response.status).toBe(200);
      expect(stringified).not.toContain("mock_meta_access_token");
      expect(stringified).not.toContain("encrypted_access_token");
      expect(stringified).not.toContain("secret");
      expect(json.connection).toBeDefined();
    });
  });

  describe("4. Webhook Tenant Resolution & Fail-Closed Boundaries", () => {
    it("rejects unregistered incoming phone number without writing to any tenant", async () => {
      process.env.WHATSAPP_APP_SECRET = "test_webhook_secret_key";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      vi.spyOn(connectionService, "resolveWebhookTenant").mockResolvedValue({
        organizationId: null,
        isDisconnected: false,
        isUnregistered: true,
      });

      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_unregistered",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+628123456789",
                    phone_number_id: "phone_unregistered_9999",
                  },
                  messages: [
                    {
                      from: "628999888777",
                      id: "wamid.unreg123",
                      timestamp: "1729900000",
                      type: "text",
                      text: { body: "Halo properti" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

        const rawBody = JSON.stringify(payload);
        const crypto = await import("crypto");
        const signature =
          "sha256=" +
          crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/webhook/whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hub-signature-256": signature,
          },
          body: rawBody,
        });

        const response = await webhookPost(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.status).toBe("IGNORED_UNREGISTERED_PHONE_NUMBER");
        expect(json.message).toContain("belum terdaftar");
      });

    it("ignores messages from disconnected connections with IGNORED_DISCONNECTED_CONNECTION", async () => {
      process.env.WHATSAPP_APP_SECRET = "test_webhook_secret_key";

      vi.spyOn(connectionService, "resolveWebhookTenant").mockResolvedValue({
        organizationId: "org-disconnected-uuid",
        isDisconnected: true,
        isUnregistered: false,
      });

      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_disconnected",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+628123456789",
                    phone_number_id: "phone_disconnected_111",
                  },
                  messages: [
                    {
                      from: "628999888777",
                      id: "wamid.disc123",
                      timestamp: "1729900000",
                      type: "text",
                      text: { body: "Halo apa masih ada unit?" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const crypto = await import("crypto");
      const signature =
        "sha256=" +
        crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(rawBody).digest("hex");

      const request = new Request("http://localhost:3000/api/webhook/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": signature,
        },
        body: rawBody,
      });

      const response = await webhookPost(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("IGNORED_DISCONNECTED_CONNECTION");
    });
  });

  describe("5. Inbound Message Processing Integrity & Fail-Closed Database", () => {
    it("fails closed and throws error when contact creation encounters a non-conflict DB failure", async () => {
      const mockDb = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "whatsapp_connections") {
            return {
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }),
            };
          }
          if (table === "messages") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "contacts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "58030", message: "IO error: disk full" },
                  }),
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
            id: "waba_1",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: { display_phone_number: "628", phone_number_id: "phone_1" },
                  messages: [
                    {
                      from: "628111222333",
                      id: "wamid.db_err_test",
                      timestamp: "1729900000",
                      type: "text",
                      text: { body: "Info harga Cluster Emerald" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await expect(
        processWhatsAppWebhookPayload(payload, {
          organizationId: "00000000-0000-0000-0000-000000000001",
          supabaseClient: mockDb as unknown as import("@supabase/supabase-js").SupabaseClient,
        })
      ).rejects.toThrow("Gagal menyimpan kontak lead ke database: IO error: disk full");
    });

    it("deduplicates concurrent/duplicate message delivery based on provider_message_id unique constraint", async () => {
      const mockDb = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "whatsapp_connections") {
            return {
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }),
            };
          }
          if (table === "messages") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "existing-msg-id", conversation_id: "conv-1" },
                      error: null,
                    }),
                  }),
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
            id: "waba_1",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: { display_phone_number: "628", phone_number_id: "phone_1" },
                  messages: [
                    {
                      from: "628111222333",
                      id: "wamid.duplicate_msg_wamid",
                      timestamp: "1729900000",
                      type: "text",
                      text: { body: "Pesan yang dikirim ulang oleh Meta" },
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
        supabaseClient: mockDb as unknown as import("@supabase/supabase-js").SupabaseClient,
      });

      expect(result.status).toBe("duplicate");
      expect(result.duplicateMessagesCount).toBe(1);
      expect(result.processedMessagesCount).toBe(0);
    });
  });

  describe("6. Disconnect & Revocation Lifecycle", () => {
    it("calls revokeAndPurgeConnectionSecret on DELETE /api/whatsapp/connect and returns 200", async () => {
      const orgId = "00000000-0000-0000-0000-000000000001";
      const purgeSpy = vi.spyOn(connectionService, "revokeAndPurgeConnectionSecret").mockResolvedValue();

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
                data: { organization_id: orgId, role: "owner" },
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
      expect(purgeSpy).toHaveBeenCalledWith(orgId);
    });
  });
});
