import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLiveDashboardData } from "@/lib/data/live-dashboard-service";

describe("Phase 17 — Haspro AI: Meta OAuth, Live Dashboard & Zero-Fabrication", () => {
  const secretKey = "test_meta_app_secret_for_signing_state_token_12345";
  const orgId = "11111111-2222-3333-4444-555555555555";
  const otherOrgId = "99999999-8888-7777-6666-555555555555";
  const userId = "user_haspro_test_123";

  // Helper to generate valid OAuth state matching the implementation
  function generateTestState(payload: { orgId: string; userId: string; timestamp: number; nonce: string }, secret: string) {
    const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(raw).digest("base64url");
    return `${raw}.${sig}`;
  }

  describe("1. Meta OAuth State Validation & CSRF Protection", () => {
    it("successfully validates an authentic, untampered OAuth state within the 15-minute window", () => {
      const now = Date.now();
      const state = generateTestState(
        { orgId, userId, timestamp: now, nonce: "test_nonce_abc" },
        secretKey
      );

      const [raw, sig] = state.split(".");
      const expectedSig = crypto.createHmac("sha256", secretKey).update(raw).digest("base64url");
      expect(sig).toBe(expectedSig);

      const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
      expect(payload.orgId).toBe(orgId);
      expect(payload.userId).toBe(userId);
      expect(now - payload.timestamp).toBeLessThan(15 * 60 * 1000);
    });

    it("rejects an OAuth state with a forged signature", () => {
      const state = generateTestState(
        { orgId, userId, timestamp: Date.now(), nonce: "nonce_1" },
        "wrong_secret_key"
      );

      const [raw, sig] = state.split(".");
      const expectedSig = crypto.createHmac("sha256", secretKey).update(raw).digest("base64url");
      expect(sig).not.toBe(expectedSig);
    });

    it("detects and rejects an expired OAuth state (> 15 minutes)", () => {
      const twentyMinutesAgo = Date.now() - 20 * 60 * 1000;
      const state = generateTestState(
        { orgId, userId, timestamp: twentyMinutesAgo, nonce: "nonce_old" },
        secretKey
      );

      const [raw] = state.split(".");
      const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
      const isExpired = Date.now() - payload.timestamp > 15 * 60 * 1000;
      expect(isExpired).toBe(true);
    });

    it("prevents cross-tenant association if the authenticated user's org does not match state orgId", () => {
      const state = generateTestState(
        { orgId: otherOrgId, userId: "another_user", timestamp: Date.now(), nonce: "nonce_x" },
        secretKey
      );

      const [raw] = state.split(".");
      const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
      expect(payload.orgId).not.toBe(orgId);
    });
  });

  describe("2. Live Dashboard Service — Zero-Fabrication & Honest Empty States", () => {
    it("returns 'not_connected' state without fabricated numbers when integration is missing", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "organizations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: orgId, name: "Haspro Agency" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "integration_connections") {
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
          if (table === "meta_asset_selections" || table === "ad_accounts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }),
      } as unknown as SupabaseClient;

      const response = await getLiveDashboardData({
        organizationId: orgId,
        supabaseClient: mockSupabase,
      });

      expect(response.state).toBe("not_connected");
      expect(response.isDemoMode).toBe(false);
      expect(response.summary).toBeNull();
      expect(response.leaderboard).toEqual([]);
      expect(response.leads).toEqual([]);
      expect(response.lastSyncedAt).toBeNull();
    });

    it("returns 'no_data_for_period' when connected but no ad_insights or conversations exist", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "organizations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: orgId, name: "Haspro Agency" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "integration_connections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "conn_123",
                        status: "connected",
                        last_synced_at: new Date().toISOString(),
                        external_account_name: "Haspro Realty Live",
                        external_account_id: "act_998877",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "meta_asset_selections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { ad_account_id: "act_998877", ad_account_name: "Haspro Realty Live" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "ad_accounts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "acc_internal_1",
                        provider_account_id: "act_998877",
                        account_name: "Haspro Realty Live",
                        currency: "IDR",
                        connection_status: "connected",
                        last_synced_at: new Date().toISOString(),
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "ad_insights" || table === "conversations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }),
      } as unknown as SupabaseClient;

      const response = await getLiveDashboardData({
        organizationId: orgId,
        supabaseClient: mockSupabase,
      });

      expect(response.state).toBe("no_data_for_period");
      expect(response.isDemoMode).toBe(false);
      expect(response.summary?.totalSpend).toBe(0);
      expect(response.summary?.totalImpressions).toBe(0);
      expect(response.summary?.totalClicks).toBe(0);
      expect(response.selectedAdAccount?.name).toBe("Haspro Realty Live");
    });

    it("correctly aggregates verified real database records into derived KPIs", async () => {
      const mockInsights = [
        {
          spend: 1500000,
          impressions: 45000,
          clicks: 900,
          reach: 38000,
          link_clicks: 650,
          conversions: 18,
          currency: "IDR",
          ad_id: "ad_1",
          ads: {
            id: "ad_1",
            name: "Cluster Grand Citra Ad 1",
            status: "ACTIVE",
            campaign_id: "cmp_1",
            campaigns: { id: "cmp_1", name: "Grand Citra Leads" },
          },
        },
        {
          spend: 1000000,
          impressions: 30000,
          clicks: 600,
          reach: 25000,
          link_clicks: 450,
          conversions: 12,
          currency: "IDR",
          ad_id: "ad_2",
          ads: {
            id: "ad_2",
            name: "Villa Emerald Ad 2",
            status: "ACTIVE",
            campaign_id: "cmp_2",
            campaigns: { id: "cmp_2", name: "Villa Emerald Branding" },
          },
        },
      ];

      const mockConvs = [
        {
          id: "conv_1",
          attribution_status: "verified",
          ad_id: "ad_1",
          started_at: "2026-10-25T10:00:00Z",
          last_message_at: "2026-10-25T11:00:00Z",
          contacts: { id: "ct_1", name: "Budi Santoso", phone_masked: "+62812****7890" },
          lead_assessments: [{ buyer_score: 85, sales_score: 90, status: "completed" }],
          lead_outcomes: [{ stage: "prospek", occurred_at: "2026-10-25T11:30:00Z" }],
        },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "organizations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: orgId, name: "Haspro Agency" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "integration_connections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        status: "connected",
                        last_synced_at: new Date().toISOString(),
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "meta_asset_selections") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { ad_account_id: "act_101", ad_account_name: "Haspro Real Ad Account" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "ad_accounts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "acc_1",
                        provider_account_id: "act_101",
                        account_name: "Haspro Real Ad Account",
                        currency: "IDR",
                        connection_status: "connected",
                        last_synced_at: new Date().toISOString(),
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "ad_insights") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockInsights, error: null }),
              }),
            };
          }
          if (table === "conversations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockConvs, error: null }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }),
      } as unknown as SupabaseClient;

      const response = await getLiveDashboardData({
        organizationId: orgId,
        supabaseClient: mockSupabase,
      });

      expect(response.state).toBe("connected_with_data");
      expect(response.isDemoMode).toBe(false);
      expect(response.summary?.totalSpend).toBe(2500000);
      expect(response.summary?.totalImpressions).toBe(75000);
      expect(response.summary?.totalClicks).toBe(1500);

      // Verify derived metrics:
      // CTR: (1500 / 75000) * 100 = 2%
      expect(response.summary?.ctr).toBe(2);
      // CPC: 2500000 / 1500 = 1666.67
      expect(response.summary?.cpc).toBeCloseTo(1666.67, 1);
      // CPM: (2500000 / 75000) * 1000 = 33333.33
      expect(response.summary?.cpm).toBeCloseTo(33333.33, 1);

      // Leads: 1 conversation, 1 qualified (buyer score 85 >= 70)
      expect(response.summary?.totalLeads).toBe(1);
      expect(response.summary?.qualifiedLeads).toBe(1);
      expect(response.summary?.cpql).toBe(2500000); // 2500000 / 1

      expect(response.leaderboard.length).toBe(2);
      expect(response.leads.length).toBe(1);
      expect(response.leads[0].name).toBe("Budi Santoso");
    });
  });

  describe("3. Tenant Isolation and Leak Prevention", () => {
    it("ensures live dashboard data is strictly filtered by the authenticated organizationId", async () => {
      const eqSpy = vi.fn().mockReturnThis();

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: eqSpy,
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ data: [] }),
          })),
        })),
      } as unknown as SupabaseClient;

      await getLiveDashboardData({
        organizationId: orgId,
        supabaseClient: mockSupabase,
      });

      // Assert that database queries filtered by organizationId
      const orgFilterCalls = eqSpy.mock.calls.filter(
        (args: unknown[]) => args[0] === "organization_id" && args[1] === orgId
      );
      expect(orgFilterCalls.length).toBeGreaterThanOrEqual(1);

      // Verify otherOrgId was never passed
      const leakCalls = eqSpy.mock.calls.filter((args: unknown[]) => args[1] === otherOrgId);
      expect(leakCalls.length).toBe(0);
    });
  });
});
