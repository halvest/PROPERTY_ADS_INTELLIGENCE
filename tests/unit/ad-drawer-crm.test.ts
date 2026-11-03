import { describe, expect, it } from "vitest";
import { summarizeCrmForAd } from "@/lib/crm/ad-drawer-crm";

const ad = "ad-1";
const campaign = "camp-1";

describe("ad drawer CRM attribution", () => {
  it("does not turn a failed query into zero prospects", () => {
    const summary = summarizeCrmForAd(null, true, ad, campaign);
    expect(summary.availability).toBe("error");
    expect(summary.attributedToAd).toBeNull();
    expect(summary.workspaceTotal).toBeNull();
    expect(summary.prospectsLine).toContain("Gagal");
  });

  it("keeps workspace prospects visible when none are linked to the ad", () => {
    const summary = summarizeCrmForAd(
      [
        { id: "a", channel: "crm_upload", ad_id: null, campaign_id: null, quality_label: "hot" },
        { id: "b", channel: "crm_upload", ad_id: null, campaign_id: campaign, quality_label: "warm" },
        { id: "c", channel: "crm_upload", ad_id: "other-ad", campaign_id: "other", quality_label: "cold" },
      ],
      false,
      ad,
      campaign
    );
    expect(summary.workspaceTotal).toBe(3);
    expect(summary.attributedToAd).toBe(0);
    expect(summary.campaignOnly).toBe(1);
    expect(summary.unattributed).toBe(1);
    expect(summary.otherAds).toBe(1);
    expect(summary.directAd).toBe(0);
    expect(summary.adSetState).toBe("unavailable");
    expect(summary.lines.join(" ")).toContain("Tanpa atribusi: 1");
    expect(summary.lines.join(" ")).toContain("Total workspace: 3");
  });

  it("counts an ad link once and ignores a campaign-only row for that ad", () => {
    const summary = summarizeCrmForAd(
      [
        { id: "a", channel: "crm_upload", ad_id: ad, campaign_id: campaign, quality_label: "Hot", attribution_status: "verified" },
        { id: "a", channel: "crm_upload", ad_id: ad, campaign_id: campaign, quality_label: "Hot", attribution_status: "verified" },
        { id: "b", channel: "crm_upload", ad_id: null, campaign_id: campaign },
      ],
      false,
      ad,
      campaign
    );
    expect(summary.attributedToAd).toBe(1);
    expect(summary.attributedIds).toEqual(["a"]);
    expect(summary.campaignOnly).toBe(1);
    expect(summary.workspaceTotal).toBe(2);
    expect(summary.hot).toBe(1);
  });

  it("does not treat a truncated page as a complete total", () => {
    const summary = summarizeCrmForAd(
      [{ id: "a", channel: "crm_upload", ad_id: ad }],
      false,
      ad,
      campaign,
      { truncated: true }
    );
    expect(summary.availability).toBe("incomplete");
    expect(summary.workspaceTotal).toBeNull();
    expect(summary.prospectsLine).toContain("tidak lengkap");
  });

  it("keeps campaign stage notes out of direct ad attribution", () => {
    const summary = summarizeCrmForAd(
      [{
        id: "a",
        channel: "crm_upload",
        ad_id: null,
        campaign_id: campaign,
        attribution_evidence: { funnel_stage: "survei" },
      }],
      false,
      ad,
      campaign
    );
    expect(summary.directAd).toBe(0);
    expect(summary.campaignOnly).toBe(1);
    expect(summary.campaignStages.survei).toBe(1);
  });

  it("does not treat an inferred ad link as verified direct attribution", () => {
    const summary = summarizeCrmForAd(
      [{ id: "a", channel: "crm_upload", ad_id: ad, campaign_id: campaign, attribution_status: "inferred" }],
      false,
      ad,
      campaign
    );
    expect(summary.directAd).toBe(0);
    expect(summary.attributedToAd).toBe(1);
    expect(summary.note).toContain("Terhubung ke iklan 1");
  });

  it("does not count a row from another channel as CRM", () => {
    const summary = summarizeCrmForAd(
      [{ id: "wa", channel: "whatsapp", ad_id: ad }],
      false,
      ad,
      campaign
    );
    expect(summary.workspaceTotal).toBe(0);
    expect(summary.availability).toBe("empty");
  });
});
