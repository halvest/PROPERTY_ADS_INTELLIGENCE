import { describe, it, expect, vi } from "vitest";
import { executeMarketingSync } from "@/lib/marketing/meta/sync-service";
import { MockMetaMarketingApiClient } from "@/lib/marketing/meta/mock-client";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("Meta Marketing Integration - Tenant Isolation & Data Separation", () => {
  const orgA = "11111111-1111-1111-1111-111111111111";
  const orgB = "22222222-2222-2222-2222-222222222222";

  it("strictly attaches and restricts organization_id on all upsert operations", async () => {
    const insertedRows: Record<string, Record<string, unknown>[]> = {
      ad_accounts: [],
      campaigns: [],
      ads: [],
      ad_insights: [],
      sync_jobs: [],
    };

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          insert: vi.fn().mockImplementation((rows) => {
            const arr = Array.isArray(rows) ? rows : [rows];
            insertedRows[table]?.push(...arr);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "job_uuid_1" } }),
              }),
            };
          }),
          upsert: vi.fn().mockImplementation((rows) => {
            const arr = Array.isArray(rows) ? rows : [rows];
            insertedRows[table]?.push(...arr);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "account_uuid_1" } }),
              }),
            };
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_column, value) => {
              // Return complete mocked records for campaign / ad ID resolution
              // for the queried organization: every mock campaign and ad must
              // resolve, otherwise the sync correctly reports unmapped rows
              // as partial (DI-03) instead of silently dropping them.
              if (value === orgA) {
                if (table === "campaigns") {
                  return {
                    data: [
                      { id: "cmp_internal_1", provider_campaign_id: "cmp_sapphire_bsd" },
                      { id: "cmp_internal_2", provider_campaign_id: "cmp_emerald_residence" },
                      { id: "cmp_internal_3", provider_campaign_id: "cmp_grand_serpong" },
                    ],
                  };
                }
                if (table === "ads") {
                  return {
                    data: [
                      { id: "ad_internal_1", provider_ad_id: "ad_sapphire_72" },
                      { id: "ad_internal_2", provider_ad_id: "ad_sapphire_promo" },
                      { id: "ad_internal_3", provider_ad_id: "ad_emerald_hook" },
                      { id: "ad_internal_4", provider_ad_id: "ad_serpong_view" },
                    ],
                  };
                }
                return {
                  data: [
                    { id: "cmp_internal_1", provider_campaign_id: "cmp_sapphire_bsd" },
                    { id: "ad_internal_1", provider_ad_id: "ad_sapphire_72" },
                  ],
                };
              }
              return { data: [] };
            }),
          }),
          update: vi.fn().mockImplementation(() => {
            const builder = {
              eq: vi.fn(() => builder),
              then: (resolve: (value: { data: null; error: null }) => unknown) =>
                Promise.resolve({ data: null, error: null }).then(resolve),
            };
            return builder;
          }),
        };
      }),
    } as unknown as SupabaseClient;

    const result = await executeMarketingSync({
      organizationId: orgA,
      targetAdAccountId: "act_0812999001",
      client: new MockMetaMarketingApiClient(),
      supabaseClient: mockSupabase,
    });

    expect(result.status).toBe("success");

    // Verify all inserted/upserted rows belong strictly to orgA
    Object.values(insertedRows).forEach((rows) => {
      rows.forEach((row) => {
        expect(row.organization_id).toBe(orgA);
        expect(row.organization_id).not.toBe(orgB);
      });
    });

    // Verify data source tag
    const insightRows = insertedRows["ad_insights"];
    expect(insightRows.length).toBeGreaterThan(0);
    insightRows.forEach((row) => expect(row.source).toBe("meta"));
  });
});
