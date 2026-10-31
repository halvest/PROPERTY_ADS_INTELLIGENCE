import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetaMarketingApiClient } from "@/lib/marketing/meta/client";
import { executeMarketingSync } from "@/lib/marketing/meta/sync-service";
import { MarketingApiError } from "@/lib/marketing/meta/types";

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("Meta client pagination", () => {
  it("collects insights across multiple pages", async () => {
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({
          data: [{ ad_id: "1", spend: "10" }],
          paging: { next: "https://graph.facebook.com/next-page", cursors: { after: "c1" } },
        });
      }
      return jsonResponse({ data: [{ ad_id: "2", spend: "20" }] });
    });
    const client = new MetaMarketingApiClient({ accessToken: "t", fetchFn });
    const data = await client.getAdInsights({ targetAdAccountId: "act_1" });
    expect(data).toHaveLength(2);
    expect(client.lastFetchTruncated).toBe(false);
    expect(calls).toBe(2);
  });

  it("flags truncation when the page cap is hit with more data available", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        data: [{ ad_id: "1" }],
        paging: { next: "https://graph.facebook.com/next-page", cursors: { after: "c" } },
      })
    );
    const client = new MetaMarketingApiClient({ accessToken: "t", fetchFn });
    const data = await client.getAdInsights({ targetAdAccountId: "act_1", maxPages: 2 });
    expect(data).toHaveLength(2);
    expect(client.lastFetchTruncated).toBe(true);
  });
});

describe("Marketing sync pipeline", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.META_ACCESS_TOKEN = "test-token";
    process.env.META_AD_ACCOUNT_ID = "act_111";
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it("fetches insights for the exact sync timeRange (no hidden preset mismatch)", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const mockClient = {
      getAdAccount: async () => ({ id: "act_111", name: "A", currency: "IDR", timezone_name: "Asia/Jakarta", account_status: 1 }),
      getCampaigns: async () => [],
      getAds: async () => [],
      getAdInsights: async (opts: Record<string, unknown>) => {
        captured.push(opts);
        return [];
      },
    };
    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      timeRange: { since: "2026-10-01", until: "2026-10-07" },
      client: mockClient as never,
    });
    expect(result.status).toBe("success");
    expect(captured[0].timeRange).toEqual({ since: "2026-10-01", until: "2026-10-07" });
    expect(captured[0].limit).toBe(100);
  });

  it("refuses a duplicate sync while one is running for the same org+account", async () => {
    const runningDb = {
      from: (table: string) => ({
        select: () => {
          const chain: Record<string, unknown> = {};
          chain.eq = () => chain;
          chain.gte = () => chain;
          chain.limit = async () => ({ data: table === "sync_jobs" ? [{ id: "job-1" }] : [], error: null });
          chain.maybeSingle = async () => ({ data: null, error: null });
          return chain;
        },
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    };
    const mockClient = {
      getAdAccount: async () => ({ id: "act_111", name: "A", currency: "IDR", timezone_name: "Asia/Jakarta", account_status: 1 }),
      getCampaigns: async () => [],
      getAds: async () => [],
      getAdInsights: async () => [],
    };
    await expect(
      executeMarketingSync({
        organizationId: "org-1",
        targetAdAccountId: "act_111",
        client: mockClient as never,
        supabaseClient: runningDb as never,
      })
    ).rejects.toMatchObject({ code: "SYNC_IN_PROGRESS" });
    expect(MarketingApiError).toBeDefined();
  });
});
