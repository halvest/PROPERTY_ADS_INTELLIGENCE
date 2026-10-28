import { describe, it, expect, vi } from "vitest";
import { MetaMarketingApiClient } from "@/lib/marketing/meta/client";
import { MarketingApiError } from "@/lib/marketing/meta/types";

describe("MetaMarketingApiClient", () => {
  const dummyToken = "EAABtestSecretToken8888";
  const dummyAccountId = "act_123456789";

  it("throws MISSING_CONFIGURATION when access token is empty", async () => {
    const client = new MetaMarketingApiClient({ accessToken: "", adAccountId: dummyAccountId });
    await expect(client.getCampaigns()).rejects.toThrow(MarketingApiError);
  });

  it("sends correct GET headers, endpoint, and authorization", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn().mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedHeaders = (init?.headers || {}) as Record<string, string>;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "cmp_1",
              name: "Kampanye Sapphire BSD",
              status: "ACTIVE",
            },
          ],
        }),
      };
    });

    const client = new MetaMarketingApiClient({
      accessToken: dummyToken,
      adAccountId: dummyAccountId,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const campaigns = await client.getCampaigns();

    expect(capturedUrl).toContain("https://graph.facebook.com/v21.0/act_123456789/campaigns");
    expect(capturedHeaders["Authorization"]).toBe(`Bearer ${dummyToken}`);
    expect(capturedHeaders["Accept"]).toBe("application/json");
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe("Kampanye Sapphire BSD");
  });

  it("traverses cursor-based pagination across multiple pages", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: RequestInfo | URL) => {
      callCount++;
      const urlStr = url.toString();

      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: "ad_1", name: "Ad 1", status: "ACTIVE", campaign_id: "cmp_1" }],
            paging: {
              cursors: { after: "cursor_page_2" },
              next: "https://graph.facebook.com/v21.0/act_123456789/ads?after=cursor_page_2",
            },
          }),
        };
      }

      // Page 2
      expect(urlStr).toContain("cursor_page_2");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "ad_2", name: "Ad 2", status: "ACTIVE", campaign_id: "cmp_1" }],
          paging: {},
        }),
      };
    });

    const client = new MetaMarketingApiClient({
      accessToken: dummyToken,
      adAccountId: dummyAccountId,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const ads = await client.getAds();

    expect(ads).toHaveLength(2);
    expect(ads[0].id).toBe("ad_1");
    expect(ads[1].id).toBe("ad_2");
    expect(callCount).toBe(2);
  });

  it("handles OAuth token expiration (Code 190) immediately without retrying", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          error: {
            message: `Error validating access token: ${dummyToken}`,
            type: "OAuthException",
            code: 190,
            error_subcode: 463,
            fbtrace_id: "trace_xyz_123",
          },
        }),
    });

    const client = new MetaMarketingApiClient({
      accessToken: dummyToken,
      adAccountId: dummyAccountId,
      fetchFn: mockFetch as unknown as typeof fetch,
      maxRetries: 3,
    });

    try {
      await client.getCampaigns();
      expect.unreachable("Should have thrown error");
    } catch (err) {
      const error = err as MarketingApiError;
      expect(error.code).toBe("AUTHENTICATION_ERROR");
      expect(error.metaErrorCode).toBe(190);
      expect(error.isRecoverable).toBe(false);
      // Ensure token is redacted in error message
      expect(error.message).not.toContain(dummyToken);
      expect(error.message).toContain("[REDACTED_ACCESS_TOKEN]");
      // Must not retry 401/190
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }
  });

  it("retries on Rate Limit (Code 17 / 613) with bounded backoff", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          text: async () =>
            JSON.stringify({
              error: {
                message: "User request limit reached",
                code: 17,
                is_transient: true,
              },
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "cmp_success", name: "Success Campaign", status: "ACTIVE" }],
        }),
      };
    });

    const client = new MetaMarketingApiClient({
      accessToken: dummyToken,
      adAccountId: dummyAccountId,
      fetchFn: mockFetch as unknown as typeof fetch,
      maxRetries: 2,
    });

    const campaigns = await client.getCampaigns();
    expect(callCount).toBe(2);
    expect(campaigns[0].id).toBe("cmp_success");
  });

  it("handles request timeouts cleanly using AbortController", async () => {
    const mockFetch = vi.fn().mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    const client = new MetaMarketingApiClient({
      accessToken: dummyToken,
      adAccountId: dummyAccountId,
      fetchFn: mockFetch as unknown as typeof fetch,
      timeoutMs: 50,
      maxRetries: 0,
    });

    try {
      await client.getCampaigns();
      expect.unreachable("Should have timed out");
    } catch (err) {
      const error = err as MarketingApiError;
      expect(error.code).toBe("TIMEOUT_ERROR");
      expect(error.message).toContain("melampaui batas waktu");
      expect(error.isRecoverable).toBe(true);
    }
  });
});
