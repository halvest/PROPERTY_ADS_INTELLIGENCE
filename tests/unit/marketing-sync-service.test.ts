import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeMarketingSync } from "@/lib/marketing/meta/sync-service";
import { MockMetaMarketingApiClient } from "@/lib/marketing/meta/mock-client";
import type { MetaMarketingApiClient } from "@/lib/marketing/meta/client";
import { MarketingApiError } from "@/lib/marketing/meta/types";

describe("executeMarketingSync (Idempotent Sync Service)", () => {
  const originalEnv = process.env;
  const demoOrgId = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("executes successful sync in demo fallback mode when credentials are unset", async () => {
    const result = await executeMarketingSync({
      organizationId: demoOrgId,
      allowDemoFallback: true,
    });

    expect(result.status).toBe("success");
    expect(result.mode).toBe("demo");
    expect(result.adAccountsSynced).toBe(1);
    expect(result.campaignsSynced).toBe(3);
    expect(result.adsSynced).toBe(4);
    expect(result.insightsSynced).toBe(4);
    expect(result.recordsProcessed).toBe(12); // 1 account + 3 cmp + 4 ads + 4 insights
    expect(result.recordsRejected).toBe(0);
    expect(result.syncedAt).toBeDefined();
  });

  it("ensures idempotency when running sync repeatedly with identical data", async () => {
    const client = new MockMetaMarketingApiClient();

    const run1 = await executeMarketingSync({
      organizationId: demoOrgId,
      client,
    });

    const run2 = await executeMarketingSync({
      organizationId: demoOrgId,
      client,
    });

    expect(run1.status).toBe("success");
    expect(run2.status).toBe("success");
    expect(run1.campaignsSynced).toBe(run2.campaignsSynced);
    expect(run1.adsSynced).toBe(run2.adsSynced);
    expect(run1.insightsSynced).toBe(run2.insightsSynced);
    expect(run1.recordsProcessed).toBe(run2.recordsProcessed);
  });

  it("throws validation error when organizationId is missing or empty", async () => {
    await expect(
      executeMarketingSync({
        organizationId: "",
        allowDemoFallback: true,
      })
    ).rejects.toThrow(MarketingApiError);
  });

  it("throws MISSING_CONFIGURATION when credentials are unset and allowDemoFallback is false", async () => {
    await expect(
      executeMarketingSync({
        organizationId: demoOrgId,
        allowDemoFallback: false,
      })
    ).rejects.toThrowError(MarketingApiError);

    try {
      await executeMarketingSync({
        organizationId: demoOrgId,
        allowDemoFallback: false,
      });
    } catch (err) {
      const error = err as MarketingApiError;
      expect(error.code).toBe("MISSING_CONFIGURATION");
      expect(error.message).toContain("META_ACCESS_TOKEN");
    }
  });

  it("handles upstream client failure safely with sanitized error", async () => {
    const failingClient = {
      getAdAccount: vi.fn().mockRejectedValue(
        new MarketingApiError({
          code: "AUTHENTICATION_ERROR",
          message: "Token invalid: [REDACTED_ACCESS_TOKEN]",
          isRecoverable: false,
        })
      ),
      getCampaigns: vi.fn(),
      getAds: vi.fn(),
      getAdInsights: vi.fn(),
    };

    await expect(
      executeMarketingSync({
        organizationId: demoOrgId,
        client: failingClient as unknown as MetaMarketingApiClient,
      })
    ).rejects.toThrowError(MarketingApiError);
  });
});
