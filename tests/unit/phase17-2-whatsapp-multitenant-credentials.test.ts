import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as connectGet, POST as connectPost } from "@/app/api/whatsapp/connect/route";
import { POST as webhookPost } from "@/app/api/webhook/whatsapp/route";
import {
  resolveTenantWhatsAppCredentials,
  resolveWebhookTenant,
} from "@/lib/whatsapp/connection-service";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import { encryptAccessToken } from "@/lib/whatsapp/crypto";
import * as serverSupabase from "@/lib/supabase/server";
import * as adminSupabaseModule from "@/lib/supabase/admin";


describe("PHASE 17.2 — WhatsApp SaaS Multi-Tenant Credential Architecture", () => {
  const originalEnv = process.env;
  const testAppSecret = "whatsapp_secret_app_key_abc123";
  const testVerifyToken = "haspro_verify_token_777";
  const testAppId = "123456789012345";
  const testConfigId = "987654321098765";

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.TOKEN_ENCRYPTION_KEY = "12345678901234567890123456789012"; // 32 bytes
    process.env.WHATSAPP_APP_SECRET = testAppSecret;
    process.env.WHATSAPP_VERIFY_TOKEN = testVerifyToken;
    process.env.META_APP_ID = testAppId;
    process.env.WHATSAPP_CONFIG_ID = testConfigId;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Platform Configuration vs Customer Credentials Separation", () => {
    it("reads platform configuration without exposing server secrets to public", () => {
      const config = getWhatsAppConfig();
      expect(config.isConfigured).toBe(true);
      expect(config.verifyToken).toBe(testVerifyToken);
      expect(config.appSecret).toBe(testAppSecret);
      expect(config.appId).toBe(testAppId);
      expect(config.embeddedSignupConfigId).toBe(testConfigId);
    });

    it("in production, strictly rejects global customer credentials from environment variables", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });

      process.env.WHATSAPP_ACCESS_TOKEN = "shared_global_customer_token_danger";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "phone_global_123";
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "waba_global_456";

      const config = getWhatsAppConfig();
      expect(config.accessToken).toBeUndefined();
      expect(config.phoneNumberId).toBeUndefined();
      expect(config.businessAccountId).toBeUndefined();

      Object.defineProperty(process.env, "NODE_ENV", { value: originalNodeEnv, configurable: true });
    });
  });

  describe("2. Per-Tenant Connection Persistence & Coexistence Metadata", () => {
    it("persists connection with official Coexistence metadata and encrypts token at rest", async () => {
      const orgId = "11111111-1111-1111-1111-111111111111";
      const userId = "user-owner-1";

      const mockUpsertedConn = {
        id: "conn-org-1",
        organization_id: orgId,
        waba_id: "waba_1001",
        phone_number_id: "phone_1001",
        display_phone_number: "+62 812-1111-2222",
        verified_name: "Tenant One Realty",
        connection_status: "connected",
        coexistence_enabled: true,
        metadata: {
          connected_via: "meta_embedded_signup_coexistence",
          feature_type: "whatsapp_business_app_onboarding",
          session_info_version: "3",
          granted_scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
          onboarded_at: new Date().toISOString(),
        },
        connected_by: userId,
        last_webhook_received_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock user client for route handler
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "profiles") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { organization_id: orgId, role: "owner" },
                  }),
                }),
              }),
            };
          }
          if (table === "whatsapp_connections") {
            return {
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockUpsertedConn,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "integration_connections") {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return { select: vi.fn() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      // Mock admin client for secret storage
      const secretStore: Record<string, unknown> = {};
      vi.spyOn(adminSupabaseModule, "createAdminClient").mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "whatsapp_connections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "whatsapp_connection_secrets") {
            return {
              upsert: vi.fn().mockImplementation((secretPayload: Record<string, unknown>) => {
                secretStore[secretPayload.connection_id as string] = secretPayload;
                return Promise.resolve({ error: null });
              }),
            };
          }
          return { select: vi.fn() };
        }),
      } as unknown as ReturnType<typeof adminSupabaseModule.createAdminClient>);

      const req = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "mock_auth_code_tenant_1",
          wabaId: "waba_1001",
          phoneNumberId: "phone_1001",
        }),
      });

      const response = await connectPost(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.connectionStatus).toBe("connected");
      expect(json.isLiveVerified).toBe(false);
      // Secret must NEVER be returned in response JSON
      expect(json.connection.accessToken).toBeUndefined();
      expect(json.connection.encrypted_access_token).toBeUndefined();

      // Secret must be encrypted in secret store
      const storedSecret = secretStore["conn-org-1"] as {
        encrypted_access_token: string;
        encryption_iv: string;
        encryption_tag: string;
      };
      expect(storedSecret).toBeDefined();
      expect(storedSecret.encrypted_access_token).not.toContain("mock_auth_code_tenant_1");
      expect(storedSecret.encryption_iv).toBeDefined();
      expect(storedSecret.encryption_tag).toBeDefined();
    });

    it("duplicate onboarding callbacks for the same account are safe and idempotent", async () => {
      const orgId = "11111111-1111-1111-1111-111111111111";
      const userId = "user-owner-1";

      const mockConn = {
        id: "conn-org-1",
        organization_id: orgId,
        waba_id: "waba_1001",
        phone_number_id: "phone_1001",
        display_phone_number: "+62 812-1111-2222",
        verified_name: "Tenant One Realty",
        connection_status: "connected",
        coexistence_enabled: true,
        metadata: {
          connected_via: "meta_embedded_signup_coexistence",
          feature_type: "whatsapp_business_app_onboarding",
          session_info_version: "3",
          granted_scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
        },
        connected_by: userId,
        last_webhook_received_at: null,
      };

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "profiles") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { organization_id: orgId, role: "owner" },
                  }),
                }),
              }),
            };
          }
          if (table === "whatsapp_connections") {
            return {
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockConn,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "integration_connections") {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return { select: vi.fn() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      vi.spyOn(adminSupabaseModule, "createAdminClient").mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "whatsapp_connections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "whatsapp_connection_secrets") {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return { select: vi.fn() };
        }),
      } as unknown as ReturnType<typeof adminSupabaseModule.createAdminClient>);

      // Call 1
      const req1 = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "mock_auth_code_tenant_1",
          wabaId: "waba_1001",
          phoneNumberId: "phone_1001",
        }),
      });
      const res1 = await connectPost(req1);
      const json1 = await res1.json();
      expect(res1.status).toBe(200);
      expect(json1.success).toBe(true);

      // Call 2 (Duplicate Retry)
      const req2 = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "mock_auth_code_tenant_1_retry",
          wabaId: "waba_1001",
          phoneNumberId: "phone_1001",
        }),
      });
      const res2 = await connectPost(req2);
      const json2 = await res2.json();
      expect(res2.status).toBe(200);
      expect(json2.success).toBe(true);
      expect(json2.connection.phone_number_id).toBe("phone_1001");
    });

    it("rejects connection if phone number is already actively bound to another organization", async () => {
      const orgA = "11111111-1111-1111-1111-111111111111";
      const orgB = "22222222-2222-2222-2222-222222222222";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-tenant-b" } },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "profiles") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { organization_id: orgB, role: "owner" },
                  }),
                }),
              }),
            };
          }
          return { select: vi.fn() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      // Mock admin client indicating phone is actively bound to orgA
      vi.spyOn(adminSupabaseModule, "createAdminClient").mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "whatsapp_connections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  neq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { organization_id: orgA, connection_status: "connected" },
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return { select: vi.fn() };
        }),
      } as unknown as ReturnType<typeof adminSupabaseModule.createAdminClient>);

      const req = new Request("http://localhost:3000/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "mock_code",
          wabaId: "waba_hijack",
          phoneNumberId: "phone_already_used_by_org_a",
        }),
      });

      const response = await connectPost(req);
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.code).toBe("PHONE_NUMBER_ALREADY_BOUND");
      expect(json.error).toContain("organisasi lain");
    });
  });

  describe("3. Multi-Tenant Token Resolution & Complete Isolation", () => {
    it("resolves credentials strictly per-tenant and prevents Tenant A from reading Tenant B's credentials", async () => {
      const orgA = "11111111-1111-1111-1111-111111111111";
      const orgB = "22222222-2222-2222-2222-222222222222";

      const tokenA = "EAAB_tenant_a_secret_access_token_999";
      const tokenB = "EAAB_tenant_b_secret_access_token_888";

      const encA = encryptAccessToken(tokenA);
      const encB = encryptAccessToken(tokenB);

      const dbConnections = [
        {
          id: "conn-a",
          organization_id: orgA,
          waba_id: "waba-a",
          phone_number_id: "phone-a",
          display_phone_number: "+62 811-111-111",
          verified_name: "Tenant A Properties",
          connection_status: "connected",
          coexistence_enabled: true,
        },
        {
          id: "conn-b",
          organization_id: orgB,
          waba_id: "waba-b",
          phone_number_id: "phone-b",
          display_phone_number: "+62 822-222-222",
          verified_name: "Tenant B Realty",
          connection_status: "connected",
          coexistence_enabled: true,
        },
      ];

      const dbSecrets = [
        {
          connection_id: "conn-a",
          organization_id: orgA,
          encrypted_access_token: encA.encryptedToken,
          encryption_iv: encA.iv,
          encryption_tag: encA.tag,
        },
        {
          connection_id: "conn-b",
          organization_id: orgB,
          encrypted_access_token: encB.encryptedToken,
          encryption_iv: encB.iv,
          encryption_tag: encB.tag,
        },
      ];

      vi.spyOn(adminSupabaseModule, "createAdminClient").mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "whatsapp_connections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col1: string, val1: string) => ({
                  eq: vi.fn().mockImplementation((col2: string, val2: string) => {
                    const match = dbConnections.find(
                      (c) =>
                        (col1 === "organization_id" ? c.organization_id === val1 : true) &&
                        (col2 === "connection_status" ? c.connection_status === val2 : true)
                    );
                    return { maybeSingle: vi.fn().mockResolvedValue({ data: match || null, error: null }) };
                  }),
                })),
              }),
            };
          }
          if (table === "whatsapp_connection_secrets") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col1: string, val1: string) => ({
                  eq: vi.fn().mockImplementation((col2: string, val2: string) => {
                    const match = dbSecrets.find(
                      (s) =>
                        (col1 === "connection_id" ? s.connection_id === val1 : true) &&
                        (col2 === "organization_id" ? s.organization_id === val2 : true)
                    );
                    return { maybeSingle: vi.fn().mockResolvedValue({ data: match || null, error: null }) };
                  }),
                })),
              }),
            };
          }
          return { select: vi.fn() };
        }),
      } as unknown as ReturnType<typeof adminSupabaseModule.createAdminClient>);

      // Resolve Tenant A
      const credsA = await resolveTenantWhatsAppCredentials(orgA);
      expect(credsA).not.toBeNull();
      expect(credsA?.organizationId).toBe(orgA);
      expect(credsA?.phoneNumberId).toBe("phone-a");
      expect(credsA?.wabaId).toBe("waba-a");
      expect(credsA?.accessToken).toBe(tokenA);
      expect(credsA?.accessToken).not.toBe(tokenB);

      // Resolve Tenant B
      const credsB = await resolveTenantWhatsAppCredentials(orgB);
      expect(credsB).not.toBeNull();
      expect(credsB?.organizationId).toBe(orgB);
      expect(credsB?.phoneNumberId).toBe("phone-b");
      expect(credsB?.wabaId).toBe("waba-b");
      expect(credsB?.accessToken).toBe(tokenB);
      expect(credsB?.accessToken).not.toBe(tokenA);
    });

    it("missing credentials return explicit null (not-connected status)", async () => {
      vi.spyOn(adminSupabaseModule, "createAdminClient").mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof adminSupabaseModule.createAdminClient>);

      const creds = await resolveTenantWhatsAppCredentials("unconnected-org-id");
      expect(creds).toBeNull();
    });

    it("in production, never falls back to a shared global WHATSAPP_ACCESS_TOKEN", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
      process.env.WHATSAPP_ACCESS_TOKEN = "danger_shared_fallback_token_never_use";

      // Mock DB where connection exists but secret is missing/corrupted
      vi.spyOn(adminSupabaseModule, "createAdminClient").mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "whatsapp_connections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "conn-corrupted",
                        organization_id: "org-corrupted",
                        waba_id: "waba-corrupted",
                        phone_number_id: "phone-corrupted",
                        connection_status: "connected",
                        coexistence_enabled: true,
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "whatsapp_connection_secrets") {
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
          return { select: vi.fn() };
        }),
      } as unknown as ReturnType<typeof adminSupabaseModule.createAdminClient>);

      const result = await resolveTenantWhatsAppCredentials("org-corrupted");
      expect(result).toBeNull();

      Object.defineProperty(process.env, "NODE_ENV", { value: originalNodeEnv, configurable: true });
    });
  });

  describe("4. Webhook Security & Tenant Resolution by Provider Identifiers", () => {
    it("rejects webhook requests with invalid or missing HMAC signatures", async () => {
      const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

      // No signature
      const reqNoSig = new Request("http://localhost:3000/api/webhook/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const resNoSig = await webhookPost(reqNoSig);
      expect(resNoSig.status).toBe(401);

      // Wrong signature
      const reqBadSig = new Request("http://localhost:3000/api/webhook/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": "sha256=invalid000000000000000000000000000000000000000000000000000000000000",
        },
        body: payload,
      });
      const resBadSig = await webhookPost(reqBadSig);
      expect(resBadSig.status).toBe(401);
    });

    it("resolves webhook tenant strictly from phone_number_id and rejects unregistered numbers", async () => {
      const registeredOrg = "11111111-1111-1111-1111-111111111111";

      vi.spyOn(adminSupabaseModule, "createAdminClient").mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "whatsapp_connections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation((col: string, val: string) => ({
                  maybeSingle: vi.fn().mockImplementation(() => {
                    if (val === "phone_registered_1") {
                      return Promise.resolve({
                        data: { organization_id: registeredOrg, connection_status: "connected" },
                      });
                    }
                    if (val === "phone_disconnected_2") {
                      return Promise.resolve({
                        data: { organization_id: "other-org", connection_status: "disconnected" },
                      });
                    }
                    return Promise.resolve({ data: null });
                  }),
                })),
              }),
            };
          }
          return { select: vi.fn() };
        }),
      } as unknown as ReturnType<typeof adminSupabaseModule.createAdminClient>);

      // 1. Registered phone number resolves to registered organization
      const matchRegistered = await resolveWebhookTenant("phone_registered_1", "waba_any");
      expect(matchRegistered.organizationId).toBe(registeredOrg);
      expect(matchRegistered.isUnregistered).toBe(false);
      expect(matchRegistered.isDisconnected).toBe(false);

      // 2. Disconnected phone number returns isDisconnected: true
      const matchDisconnected = await resolveWebhookTenant("phone_disconnected_2", "waba_any");
      expect(matchDisconnected.isDisconnected).toBe(true);

      // 3. Unregistered phone number returns isUnregistered: true
      const matchUnknown = await resolveWebhookTenant("phone_unknown_999", "waba_unknown");
      expect(matchUnknown.organizationId).toBeNull();
      expect(matchUnknown.isUnregistered).toBe(true);
    });
  });

  describe("5. Coexistence Eligibility & Connection Status Truthfulness", () => {
    it("truthfully exposes coexistence eligibility when Meta App and Config ID are present", async () => {
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: "org-1", role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const res = await connectGet();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.coexistenceEligibility.isEligible).toBe(true);
      expect(json.metaAppConfigured).toBe(true);
      expect(json.configId).toBe(testConfigId);
    });

    it("truthfully exposes coexistence ineligibility when Config ID is missing", async () => {
      delete process.env.WHATSAPP_CONFIG_ID;
      delete process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID;

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { organization_id: "org-1", role: "owner" },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const res = await connectGet();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.coexistenceEligibility.isEligible).toBe(false);
      expect(json.metaAppConfigured).toBe(false);
      expect(json.coexistenceEligibility.reason).toContain("WHATSAPP_CONFIG_ID");
    });
  });
});
