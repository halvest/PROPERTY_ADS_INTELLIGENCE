import { describe, expect, it } from "vitest";
import { attributionStatusForCrmMatch, resolveCrmSourceFromCatalog } from "@/lib/crm/crm-sheets-service";

const catalog = {
  ads: [
    {
      adId: "internal-ad",
      providerAdId: "52585930280063",
      campaignId: "internal-campaign",
      providerCampaignId: "52585930279863",
      adName: "video",
      campaignName: "ASC Video Bangunjiwo 19/10",
      adStatus: "ACTIVE",
      campaignStatus: "PAUSED",
    },
    {
      adId: "other-ad",
      providerAdId: "999",
      campaignId: "other-campaign",
      providerCampaignId: "888",
      adName: "video",
      campaignName: "Kampanye lain",
      adStatus: "ACTIVE",
      campaignStatus: "ACTIVE",
    },
  ],
  campaigns: [
    { id: "internal-campaign", providerCampaignId: "52585930279863", name: "ASC Video Bangunjiwo 19/10", status: "PAUSED" },
    { id: "other-campaign", providerCampaignId: "888", name: "Kampanye lain", status: "ACTIVE" },
  ],
  adSets: [
    { providerAdSetId: "52585930280263", name: "Provinsi Jogja", campaignId: "internal-campaign", adIds: ["internal-ad"] },
  ],
};

describe("CRM source identity mapping", () => {
  it("maps a Meta ad id to the internal ad id", () => {
    const resolved = resolveCrmSourceFromCatalog(catalog, { sourceName: "52585930280063" });
    expect(resolved).toMatchObject({
      adId: "internal-ad",
      campaignId: "internal-campaign",
      matchMethod: "meta_ad_id",
    });
    expect(attributionStatusForCrmMatch(resolved.matchMethod)).toBe("verified");
  });

  it("keeps a unique campaign name as campaign-only", () => {
    const resolved = resolveCrmSourceFromCatalog(catalog, { sourceName: "ASC Video Bangunjiwo 19/10" });
    expect(resolved.adId).toBeNull();
    expect(resolved.campaignId).toBe("internal-campaign");
    expect(resolved.matchMethod).toBe("campaign_name");
  });

  it("maps a Meta campaign id without filling an ad id", () => {
    const resolved = resolveCrmSourceFromCatalog(catalog, { sourceName: "52585930279863" });
    expect(resolved.adId).toBeNull();
    expect(resolved.campaignId).toBe("internal-campaign");
    expect(resolved.matchMethod).toBe("meta_campaign_id");
    expect(attributionStatusForCrmMatch(resolved.matchMethod)).toBe("inferred");
  });

  it("rejects an ad that belongs to another campaign", () => {
    expect(() =>
      resolveCrmSourceFromCatalog(catalog, { adId: "52585930280063", campaignId: "other-campaign" })
    ).toThrow(/tidak sesuai/);
  });

  it("rejects an ad id from outside the catalog", () => {
    expect(() => resolveCrmSourceFromCatalog(catalog, { adId: "not-in-workspace" })).toThrow(/tidak termasuk/);
  });

  it("does not link a short shared ad name", () => {
    const resolved = resolveCrmSourceFromCatalog(catalog, { sourceName: "video" });
    expect(resolved.adId).toBeNull();
    expect(resolved.matchMethod).toBe("ambiguous");
  });

  it("maps a Meta ad set id without filling an ad id", () => {
    const resolved = resolveCrmSourceFromCatalog(catalog, { sourceAdSet: "52585930280263" });
    expect(resolved.adId).toBeNull();
    expect(resolved.campaignId).toBe("internal-campaign");
    expect(resolved.providerAdSetId).toBe("52585930280263");
    expect(resolved.matchMethod).toBe("meta_adset_id");
  });

  it("does not link an unknown numeric identifier", () => {
    const resolved = resolveCrmSourceFromCatalog(catalog, { sourceName: "123456789012" });
    expect(resolved.adId).toBeNull();
    expect(resolved.campaignId).toBeNull();
    expect(resolved.matchMethod).toBe("invalid_identifier");
  });
});
