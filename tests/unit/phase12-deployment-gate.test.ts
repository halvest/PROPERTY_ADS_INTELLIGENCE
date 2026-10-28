import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as syncPost } from "@/app/api/marketing/sync/route";
import { GET as webhookGet } from "@/app/api/webhook/whatsapp/route";
import { sanitizeWhatsAppLog } from "@/lib/whatsapp/config";
import { evaluateAdOptimization } from "@/domain/recommendations/engine";
import * as serverSupabase from "@/lib/supabase/server";

describe("Phase 12 Deployment Gate — Security, Isolation & Safety Audit", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Marketing Sync Endpoint — Authentication & Tenant Isolation", () => {
    it("rejects unauthenticated request in production with HTTP 401", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }),
        },
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await syncPost(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
      expect(json.code).toBe("UNAUTHORIZED");
      expect(json.message).toContain("Sesi autentikasi diperlukan");
    });

    it("rejects unauthorized role 'sales' with HTTP 403", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_sales_123" } },
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

      const request = new Request("http://localhost:3000/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await syncPost(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe("FORBIDDEN");
      expect(json.message).toContain("Role pengguna 'sales' tidak memiliki wewenang");
    });

    it("rejects cross-tenant forgery attempt when request body claims a foreign organizationId", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const authenticatedOrgId = "a1111111-1111-4111-8111-111111111111";
      const foreignOrgId = "b2222222-2222-4222-8222-222222222222";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_admin_123" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  organization_id: authenticatedOrgId,
                  role: "admin",
                },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: foreignOrgId, // Attacker attempts to target another tenant
        }),
      });

      const response = await syncPost(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe("FORBIDDEN");
      expect(json.message).toContain("Akses lintas tenant ditolak");
    });

    it("allows authorized supervisor/admin with their own organization", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      const authenticatedOrgId = "a1111111-1111-4111-8111-111111111111";

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user_supervisor_123" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  organization_id: authenticatedOrgId,
                  role: "supervisor",
                },
              }),
            }),
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

      const request = new Request("http://localhost:3000/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowDemoFallback: true }),
      });

      const response = await syncPost(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.mode).toBe("demo");
    });
  });

  describe("2. WhatsApp Webhook Safety & PII Protection", () => {
    it("fails closed on GET challenge when WHATSAPP_VERIFY_TOKEN is missing", async () => {
      delete process.env.WHATSAPP_VERIFY_TOKEN;

      const request = new Request(
        "http://localhost:3000/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=any_token&hub.challenge=test_123"
      );

      const response = await webhookGet(request);
      const text = await response.text();

      expect(response.status).toBe(403);
      expect(text).toContain("WHATSAPP_VERIFY_TOKEN belum dikonfigurasi");
    });

    it("redacts raw phone numbers from WhatsApp log outputs", () => {
      const rawLog = "Error processing lead contact 6281234567890 with secret my_app_secret_123";
      const sanitized = sanitizeWhatsAppLog(rawLog, "my_app_secret_123");

      expect(sanitized).not.toContain("6281234567890");
      expect(sanitized).not.toContain("my_app_secret_123");
      expect(sanitized).toContain("[REDACTED_PHONE]");
      expect(sanitized).toContain("[REDACTED_SECRET]");
    });
  });

  describe("3. Deterministic Safety — Invalid Metrics Never Yield Scale Candidate", () => {
    it("classifies incomplete or zero sample metrics as insufficient_data, never scale_candidate", () => {
      const input = {
        adId: "ad_test_invalid",
        adName: "Test Negative Spend Ad",
        campaignName: "Test Campaign",
        dateRange: "30 Hari Terakhir",
        spend: -500000, // Invalid negative spend
        impressions: 0, // Zero impressions
        clicks: 0,
        attributedLeadsCount: 0,
        qualifiedLeadsCount: 0,
        avgBuyerScore: null,
        buyerScoreSampleSize: 0,
        verifiedCount: 0,
        inferredCount: 0,
      };

      const result = evaluateAdOptimization(input);

      expect(result.category).not.toBe("scale_candidate");
      expect(result.category).toBe("insufficient_data");
    });

    it("evaluates high quality rate with small sample size as insufficient_data", () => {
      const input = {
        adId: "ad_test_small_sample",
        adName: "Test High Quality Low Volume",
        campaignName: "Test Campaign",
        dateRange: "30 Hari Terakhir",
        spend: 2500000,
        impressions: 15000,
        clicks: 300,
        attributedLeadsCount: 3, // Below minimum 5 leads for scale
        qualifiedLeadsCount: 3, // 100% rate, but tiny sample
        avgBuyerScore: 85,
        buyerScoreSampleSize: 3, // Below minBuyerScoreSampleSize = 5
        verifiedCount: 3,
        inferredCount: 0,
      };

      const result = evaluateAdOptimization(input);

      expect(result.category).toBe("insufficient_data");
      expect(result.category).not.toBe("scale_candidate");
    });
  });
});
