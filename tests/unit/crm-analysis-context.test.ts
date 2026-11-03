import { describe, expect, it } from "vitest";
import {
  buildCrmAnalysisContext,
  calculateCqpl,
  classifyTemperature,
} from "@/lib/crm/crm-analysis-context";

function row(id: string, label: string | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    organization_id: "org-a",
    started_at: "2026-10-20T02:00:00.000Z",
    channel: "crm_upload",
    quality_label: label,
    ad_id: null,
    campaign_id: "camp-1",
    attribution_status: "inferred",
    attribution_evidence: { funnel_stage: "baru", provider_adset_id: null },
    ...extra,
  };
}

const period = { organizationId: "org-a", since: "2026-10-19", until: "2026-10-29", spend: 300_000 };

describe("qualified lead and CQPL", () => {
  it("counts hot and warm only", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => row(`h${i}`, "Hot")),
      ...Array.from({ length: 20 }, (_, i) => row(`w${i}`, "warm")),
      ...Array.from({ length: 32 }, (_, i) => row(`c${i}`, "COLD")),
    ];
    const context = buildCrmAnalysisContext(rows, { scope: "workspace", ...period });
    expect(context.temperature.hot.value).toBe(10);
    expect(context.temperature.warm.value).toBe(20);
    expect(context.temperature.cold.value).toBe(32);
    expect(context.qualifiedLeads.value).toBe(30);
    expect(context.cqpl.workspace.value).toBe(10_000);
  });

  it("counts none when every lead is cold", () => {
    const context = buildCrmAnalysisContext([row("a", "Cold"), row("b", "cold")], { scope: "workspace", ...period });
    expect(context.qualifiedLeads.value).toBe(0);
    expect(context.cqpl.workspace.value).toBeNull();
    expect(context.cqpl.workspace.message).toBe("Tidak dapat dihitung");
  });

  it("counts every hot lead and every warm lead", () => {
    expect(buildCrmAnalysisContext([row("a", "HOT"), row("b", "hot")], { scope: "workspace", spend: 100 }).qualifiedLeads.value).toBe(2);
    expect(buildCrmAnalysisContext([row("a", "Warm")], { scope: "workspace", spend: 100 }).qualifiedLeads.value).toBe(1);
  });

  it("leaves blank and unknown temperatures unclassified", () => {
    const context = buildCrmAnalysisContext([row("a", null), row("b", ""), row("c", "vip")], { scope: "workspace", ...period });
    expect(context.qualifiedLeads.value).toBe(0);
    expect(context.temperature.unclassified.value).toBe(3);
    expect(context.temperature.cold.value).toBe(0);
    expect(classifyTemperature("  Hot ")).toBe("hot");
  });

  it("returns zero CQPL only when spend is zero and qualified leads exist", () => {
    const context = buildCrmAnalysisContext([row("a", "Hot")], { scope: "workspace", spend: 0 });
    expect(context.cqpl.workspace).toMatchObject({ status: "available", value: 0, qualifiedLeads: 1 });
  });

  it("does not calculate CQPL when spend is missing or CRM failed", () => {
    expect(calculateCqpl(null, 3, true).message).toBe("Tidak dapat dihitung");
    expect(calculateCqpl(100, null, false).message).toBe("Data tidak tersedia");
    expect(calculateCqpl(100, 0, true).value).toBeNull();
  });

  it("excludes another organization and dates outside the period", () => {
    const context = buildCrmAnalysisContext(
      [
        row("in", "Hot"),
        row("other", "Hot", { organization_id: "org-b" }),
        row("old", "Warm", { started_at: "2026-09-01T00:00:00.000Z" }),
      ],
      { scope: "workspace", ...period }
    );
    expect(context.workspaceRecords.value).toBe(1);
    expect(context.qualifiedLeads.value).toBe(1);
  });

  it("keeps campaign-only hot leads out of ad CQPL and counts them for the campaign", () => {
    const rows = [row("camp", "Hot", { ad_id: null, attribution_status: "inferred" })];
    const ad = buildCrmAnalysisContext(rows, { scope: "ad", adId: "ad-1", campaignId: "camp-1", ...period });
    const campaign = buildCrmAnalysisContext(rows, { scope: "campaign", campaignId: "camp-1", ...period });
    expect(ad.qualifiedLeads.value).toBe(0);
    expect(ad.attribution.directAd.value).toBe(0);
    expect(ad.cqpl.ad.value).toBeNull();
    expect(campaign.qualifiedLeads.value).toBe(1);
    expect(campaign.cqpl.campaign.value).toBe(300_000);
  });

  it("counts an inferred link to the ad as that ad's qualified leads", () => {
    const rows = [row("linked", "Hot", { ad_id: "ad-1", attribution_status: "inferred" })];
    const ad = buildCrmAnalysisContext(rows, { scope: "ad", adId: "ad-1", campaignId: "camp-1", spend: 620 });
    expect(ad.qualifiedLeads.value).toBe(1);
    expect(ad.cqpl.ad.value).toBe(620);
    expect(ad.attribution.directAd.value).toBe(0);
  });

  it("counts a verified ad once and does not also count it as campaign-only", () => {
    const rows = [row("ad", "Warm", { ad_id: "ad-1", attribution_status: "verified" })];
    const ad = buildCrmAnalysisContext(rows, { scope: "ad", adId: "ad-1", campaignId: "camp-1", spend: 200 });
    const workspace = buildCrmAnalysisContext(rows, { scope: "workspace", spend: 200 });
    expect(ad.qualifiedLeads.value).toBe(1);
    expect(ad.attribution.directAd.value).toBe(1);
    expect(ad.attribution.campaign.value).toBe(0);
    expect(workspace.qualifiedLeads.value).toBe(1);
    expect(workspace.attribution.directAd.value).toBe(1);
    expect(workspace.attribution.campaign.value).toBe(0);
    expect(ad.cqpl.ad.value).toBe(200);
  });

  it("counts an ad set only from its own evidence", () => {
    const rows = [row("set", "Hot", { attribution_evidence: { funnel_stage: "baru", provider_adset_id: "set-1" } })];
    const match = buildCrmAnalysisContext(rows, { scope: "ad_set", providerAdSetId: "set-1", spend: 50 });
    const other = buildCrmAnalysisContext(rows, { scope: "ad_set", providerAdSetId: "set-2", spend: 50 });
    expect(match.qualifiedLeads.value).toBe(1);
    expect(other.qualifiedLeads.value).toBe(0);
  });
});
