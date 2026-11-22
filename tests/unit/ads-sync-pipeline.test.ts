import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetaMarketingApiClient, AD_EFFECTIVE_STATUSES, ADSET_EFFECTIVE_STATUSES, CAMPAIGN_EFFECTIVE_STATUSES } from "@/lib/marketing/meta/client";
import { executeMarketingSync, chunkArray, SUPABASE_UPSERT_CHUNK_SIZE } from "@/lib/marketing/meta/sync-service";
import { MarketingApiError } from "@/lib/marketing/meta/types";

function jsonResponse(body: unknown, extraHeaders?: Record<string, string>) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json", ...(extraHeaders || {}) }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("Meta client pagination, effective_status & BUC rate limits", () => {
  it("stops when Graph returns a cursor without a next page", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        data: [{ id: "act_1", name: "One" }],
        paging: { cursors: { after: "last-cursor" } },
      })
    );
    const client = new MetaMarketingApiClient({ accessToken: "t", fetchFn });
    const accounts = await client.getAdAccounts();
    expect(accounts).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(client.lastFetchTruncated).toBe(false);
  });

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

  it("requests only the effective statuses Meta accepts on each edge", async () => {
    const urls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return jsonResponse({ data: [] });
    });
    const client = new MetaMarketingApiClient({ accessToken: "t", adAccountId: "act_1", fetchFn });
    await client.getCampaigns();
    await client.getAdSets();
    await client.getAds();

    expect(urls).toHaveLength(3);
    const statuses = urls.map((rawUrl) => JSON.parse(new URL(rawUrl).searchParams.get("effective_status") || "[]"));
    expect(statuses[0]).toEqual(Array.from(CAMPAIGN_EFFECTIVE_STATUSES));
    expect(statuses[1]).toEqual(Array.from(ADSET_EFFECTIVE_STATUSES));
    expect(statuses[2]).toEqual(Array.from(AD_EFFECTIVE_STATUSES));
    expect(statuses[0]).not.toContain("ADSET_PAUSED");
    expect(statuses[0]).not.toContain("PENDING_REVIEW");
  });

  it("passes level=ad and 7d_click/1d_view attribution windows on getAdInsights and captures BUC headers", async () => {
    let capturedUrl = "";
    const bucPayload = {
      "123456": [{ type: "ads_insights", call_count: 42, total_cputime: 30, total_time: 35 }],
    };
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return jsonResponse(
        { data: [{ ad_id: "1", spend: "100", impressions: "50", clicks: "5", date_start: "2026-10-01", date_stop: "2026-10-01" }] },
        { "x-business-use-case-usage": JSON.stringify(bucPayload) }
      );
    });
    const client = new MetaMarketingApiClient({ accessToken: "t", adAccountId: "act_1", fetchFn });
    await client.getAdInsights({ timeRange: { since: "2026-10-01", until: "2026-10-07" } });

    const parsed = new URL(capturedUrl);
    expect(parsed.searchParams.get("level")).toBe("ad");
    expect(parsed.searchParams.get("use_account_attribution_setting")).toBe("true");
    expect(JSON.parse(parsed.searchParams.get("action_attribution_windows") || "[]")).toEqual(["7d_click", "1d_view"]);
    expect(client.lastBucUsageHeader).toEqual({ business_use_case: bucPayload });
  });

  it("chunks large arrays into batches of 200 to prevent Supabase Payload Too Large errors", () => {
    const items = Array.from({ length: 450 }, (_, idx) => ({ id: idx }));
    const chunks = chunkArray(items, SUPABASE_UPSERT_CHUNK_SIZE);
    expect(SUPABASE_UPSERT_CHUNK_SIZE).toBe(200);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(200);
    expect(chunks[1]).toHaveLength(200);
    expect(chunks[2]).toHaveLength(50);
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

  it("preserves historical data additively (non-destructive) and returns partial status when some insight rows are invalid or truncated", async () => {
    let deleteCalled = false;
    const upsertedTables: string[] = [];
    const mockDb = {
      from: (table: string) => ({
        select: () => {
          const chain: Record<string, unknown> = {};
          chain.eq = () => chain;
          chain.in = () => chain;
          chain.limit = async () => ({ data: [], error: null });
          chain.maybeSingle = async () => ({ data: null, error: null });
          chain.then = (resolve: (v: { data: unknown; error: null }) => void) => {
            if (table === "campaigns") {
              resolve({ data: [{ id: "uuid-cmp-1", provider_campaign_id: "cmp_1" }], error: null });
            } else if (table === "ads") {
              resolve({ data: [{ id: "uuid-ad-1", provider_ad_id: "ad_1" }], error: null });
            } else {
              resolve({ data: [], error: null });
            }
          };
          return chain;
        },
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: "job-99" }, error: null }) }) }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        delete: () => {
          deleteCalled = true;
          return { eq: async () => ({ error: null }) };
        },
        upsert: () => {
          upsertedTables.push(table);
          return {
            select: () => ({ single: async () => ({ data: { id: "uuid-acc-1" }, error: null }) }),
            error: null,
          };
        },
      }),
    };

    const mockClient = {
      getAdAccount: async () => ({
        id: "act_111",
        name: "Account 111",
        currency: "IDR",
        timezone_name: "Asia/Jakarta",
        account_status: 1,
      }),
      getCampaigns: async () => [{ id: "cmp_1", name: "Camp 1", status: "ACTIVE", objective: "MESSAGES" }],
      getAds: async () => [{ id: "ad_1", name: "Ad 1", status: "ACTIVE", campaign_id: "cmp_1" }],
      getAdInsights: async () => [
        // 1 valid row
        {
          ad_id: "ad_1",
          campaign_id: "cmp_1",
          spend: "150000",
          impressions: "2500",
          clicks: "80",
          date_start: "2026-10-05",
          date_stop: "2026-10-05",
        },
        // 1 invalid row missing date_start (must be quarantined without wiping valid rows)
        {
          ad_id: "ad_1",
          campaign_id: "cmp_1",
          spend: "50000",
          impressions: "500",
          clicks: "10",
          date_start: "",
          date_stop: "2026-10-06",
        },
      ],
    };

    const result = await executeMarketingSync({
      organizationId: "org-1",
      targetAdAccountId: "act_111",
      timeRange: { since: "2026-10-01", until: "2026-10-07" },
      client: mockClient as never,
      supabaseClient: mockDb as never,
    });

    expect(deleteCalled).toBe(false);
    expect(result.status).toBe("partial");
    expect(result.syncDetails?.insightsValid).toBe(1);
    expect(result.syncDetails?.insightsInvalid).toBe(1);
    expect(upsertedTables).toContain("ad_insights");
  });

  it("maps Meta error codes 190 (token expired), 4 (app rate limit), and 10 (permission denied) to actionable Indonesian errors", async () => {
    const makeErrorClient = (status: number, code: number, message: string) =>
      new MetaMarketingApiClient({
        accessToken: "token-xyz",
        adAccountId: "act_111",
        maxRetries: 0,
        fetchFn: vi.fn(async () => ({
          ok: false,
          status,
          headers: new Headers({ "content-type": "application/json" }),
          text: async () => JSON.stringify({ error: { message, code } }),
        })) as unknown as typeof fetch,
      });

    await expect(makeErrorClient(401, 190, "Session has expired").getAdAccount()).rejects.toMatchObject({
      code: "AUTHENTICATION_ERROR",
      metaErrorCode: 190,
    });

    await expect(makeErrorClient(429, 4, "Application request limit reached").getAdAccount()).rejects.toMatchObject({
      code: "RATE_LIMIT_ERROR",
      metaErrorCode: 4,
    });

    await expect(makeErrorClient(403, 10, "Application does not have permission").getAdAccount()).rejects.toMatchObject({
      code: "PERMISSION_ERROR",
      metaErrorCode: 10,
    });
  });
});
