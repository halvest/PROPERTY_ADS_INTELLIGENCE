import { describe, expect, it } from "vitest";
import { buildAccountIntelligence, resolveEvaluationTarget } from "@/lib/ai/account-intelligence/engine";
import { accountReportSupersedesLegacyDecision, resolveOperationalStatus } from "@/lib/ai/account-intelligence/status";

function insight(adId: string, spend: number, impressions: number, conversations: number) {
  return {
    ad_id: adId,
    spend,
    impressions,
    clicks: Math.round(impressions * 0.02),
    link_clicks: Math.round(impressions * 0.01),
    reach: null,
    conversions: conversations,
    date_start: "2026-10-01",
    action_breakdown: { messaging_conversation_started_7d: conversations },
    conversion_action_type: "messaging_conversation_started_7d",
  };
}

describe("account intelligence", () => {
  it("ranks every campaign and ad without blending their targets", () => {
    const report = buildAccountIntelligence({
      accountName: "Titik Huni",
      accountId: "act_1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      accountCampaignTargetCpr: 10_000,
      campaigns: [
        { id: "c1", providerId: "111", name: "Campaign A", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c2", providerId: "222", name: "Campaign B", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
      ],
      ads: [
        { id: "a1", providerId: "a-1", name: "Ad A", status: "ACTIVE", campaignId: "c1", targetCpr: 7_000 },
        { id: "a2", providerId: "a-2", name: "Ad B", status: "ACTIVE", campaignId: "c2" },
      ],
      insights: [
        insight("a1", 500_000, 20_000, 80),
        insight("a2", 500_000, 20_000, 10),
      ],
    });

    expect(report.analysis_metadata.analyzed_campaign_count).toBe(2);
    expect(report.analysis_metadata.analyzed_ad_count).toBe(2);
    expect(report.account_summary.total_spend).toBe(1_000_000);
    expect(report.campaign_rankings.map((item) => item.name)).toEqual(["Campaign A", "Campaign B"]);
    expect(report.ad_rankings[0].target.value).toBe(7_000);
    expect(report.ad_rankings[0].target.source).toBe("object");
    expect(report.campaign_rankings[0].target.value).toBe(10_000);
    expect(report.campaign_rankings[0].target.source).toBe("account_default");
    expect(report.ad_rankings[1].target.status).toBe("TARGET_NOT_CONFIGURED");
  });

  it("does not invent a target status when no target exists", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      campaigns: [{ id: "c1", providerId: "111", name: "Campaign A", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" }],
      ads: [{ id: "a1", providerId: "a-1", name: "Ad A", status: "ACTIVE", campaignId: "c1" }],
      insights: [insight("a1", 200_000, 8_000, 20)],
    });
    expect(report.campaign_rankings[0].target.status).toBe("TARGET_NOT_CONFIGURED");
    expect(report.campaign_rankings[0].category).toBe("UNRANKED");
    expect(report.campaign_rankings[0].category).not.toBe("INSUFFICIENT_DATA");
    expect(report.campaign_rankings[0].reason).toContain("belum dikonfigurasi");
  });

  it("keeps a paused efficient campaign on historical evidence", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      accountCampaignTargetCpr: 10_000,
      campaigns: [{ id: "c1", providerId: "111", name: "Campaign Lama", status: "PAUSED", objective: "OUTCOME_ENGAGEMENT" }],
      ads: [{ id: "a1", providerId: "a-1", name: "Ad Lama", status: "PAUSED", campaignId: "c1" }],
      insights: [insight("a1", 500_000, 20_000, 80)],
    });
    expect(report.campaign_rankings[0].performanceBasis).toBe("historical_paused");
    expect(report.campaign_rankings[0].effectiveStatus).toBe("PAUSED");
    expect(report.campaign_rankings[0].action).toBe("HISTORICAL_REVIEW");
    expect(report.campaign_rankings[0].reason).toContain("bukan bukti iklan sedang berjalan");
    expect(report.recommendations.some((item) => item.action === "MONITOR" || item.action === "SCALE" || item.action === "REACTIVATION_CANDIDATE")).toBe(false);
    expect(report.historical_reviews.every((item) => item.action !== "REACTIVATION_CANDIDATE")).toBe(true);
  });

  it("refuses a one-result sample as a winner and keeps zero-result CPR empty", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-07",
      durationDays: 7,
      campaigns: [
        { id: "c1", providerId: "111", name: "Kecil", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c2", providerId: "222", name: "Boros", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
      ],
      ads: [
        { id: "a1", providerId: "a-1", name: "Ad Kecil", status: "ACTIVE", campaignId: "c1" },
        { id: "a2", providerId: "a-2", name: "Ad Boros", status: "ACTIVE", campaignId: "c2" },
      ],
      insights: [insight("a1", 5_000, 100, 1), insight("a2", 100_000, 4_000, 0)],
    });
    expect(report.ad_rankings.find((item) => item.name === "Ad Kecil")?.category).toBe("INSUFFICIENT_DATA");
    expect(report.ad_rankings.find((item) => item.name === "Ad Boros")?.cpr).toBeNull();
    expect(report.campaign_rankings.find((item) => item.name === "Boros")?.category).toBe("UNDERPERFORMING");
  });

  it("keeps inventory but ranks only objects with activity inside the selected dates", () => {
    const pausedIdle = { id: "c-idle", providerId: "999", name: "ASC Kalasan New 14/05", status: "PAUSED", objective: "OUTCOME_ENGAGEMENT" };
    const activeIdle = { id: "c-empty", providerId: "888", name: "Baru Tanpa Tayang", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" };
    const pausedLive = { id: "c-live", providerId: "777", name: "Lama Masih Ada Tayangan", status: "PAUSED", objective: "OUTCOME_ENGAGEMENT" };
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-04",
      periodEnd: "2026-11-02",
      durationDays: 30,
      campaigns: [pausedIdle, activeIdle, pausedLive],
      ads: [
        { id: "a-idle", providerId: "ad-idle", name: "Iklan Diam", status: "PAUSED", campaignId: "c-idle" },
        { id: "a-empty", providerId: "ad-empty", name: "Iklan Aktif Kosong", status: "ACTIVE", campaignId: "c-empty" },
        { id: "a-live", providerId: "ad-live", name: "Iklan Periode", status: "PAUSED", campaignId: "c-live" },
        { id: "a-old", providerId: "ad-old", name: "Iklan Lifetime", status: "PAUSED", campaignId: "c-idle" },
      ],
      insights: [
        { ...insight("a-live", 80_000, 3_000, 4), date_start: "2026-10-10" },
        { ...insight("a-old", 900_000, 40_000, 50), date_start: "2025-01-01" },
        { ...insight("a-empty", 0, 0, 0), date_start: "2026-10-10", clicks: 0, link_clicks: 0 },
      ],
    });

    expect(report.analysis_metadata.analyzed_campaign_count).toBe(3);
    expect(report.analysis_metadata.analyzed_ad_count).toBe(4);
    expect(report.campaign_rankings.map((item) => item.name)).toEqual(["Lama Masih Ada Tayangan"]);
    expect(report.ad_rankings.map((item) => item.name)).toEqual(["Iklan Periode"]);
    expect(report.analysis_metadata.excluded_campaign_count).toBe(2);
    expect(report.analysis_metadata.excluded_ad_count).toBe(3);
    expect(report.account_summary.total_spend).toBe(80_000);
    expect(report.key_insights.every((item) => item.object_name !== "ASC Kalasan New 14/05")).toBe(true);
    expect(report.recommendations.every((item) => item.objectName !== "ASC Kalasan New 14/05")).toBe(true);
    expect(report.action_plan.every((item) => !item.item.includes("ASC Kalasan"))).toBe(true);
  });

  it("keeps a zero-spend delivery and a zero-result spend inside the period ranking", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-04",
      periodEnd: "2026-11-02",
      durationDays: 30,
      campaigns: [
        { id: "c1", providerId: "1", name: "Ada Impresi", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c2", providerId: "2", name: "Ada Belanja", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
      ],
      ads: [
        { id: "a1", providerId: "a1", name: "Impresi", status: "ACTIVE", campaignId: "c1" },
        { id: "a2", providerId: "a2", name: "Belanja", status: "ACTIVE", campaignId: "c2" },
      ],
      insights: [
        { ...insight("a1", 0, 1_200, 0), date_start: "2026-10-10", clicks: 0, link_clicks: 0 },
        { ...insight("a2", 100_000, 4_000, 0), date_start: "2026-10-10" },
      ],
    });
    expect(report.campaign_rankings.map((item) => item.name).sort()).toEqual(["Ada Belanja", "Ada Impresi"]);
    expect(report.ad_rankings.find((item) => item.name === "Impresi")?.cpr).toBeNull();
    expect(report.ad_rankings.find((item) => item.name === "Belanja")?.cpr).toBeNull();
  });

  it("recalculates the ranking when the date window changes", () => {
    const campaigns = [
      { id: "c1", providerId: "1", name: "Tujuh Hari", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
      { id: "c2", providerId: "2", name: "Tiga Puluh Hari", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
    ];
    const ads = [
      { id: "a1", providerId: "a1", name: "Ad 7", status: "ACTIVE", campaignId: "c1" },
      { id: "a2", providerId: "a2", name: "Ad 30", status: "ACTIVE", campaignId: "c2" },
    ];
    const insights = [
      { ...insight("a1", 50_000, 2_000, 5), date_start: "2026-10-28" },
      { ...insight("a2", 70_000, 2_000, 4), date_start: "2026-10-05" },
    ];
    const week = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-26",
      periodEnd: "2026-11-02",
      durationDays: 7,
      campaigns,
      ads,
      insights,
    });
    const month = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-04",
      periodEnd: "2026-11-02",
      durationDays: 30,
      campaigns,
      ads,
      insights,
    });
    expect(week.campaign_rankings.map((item) => item.name)).toEqual(["Tujuh Hari"]);
    expect(month.campaign_rankings.map((item) => item.name).sort()).toEqual(["Tiga Puluh Hari", "Tujuh Hari"]);
    expect(week.account_summary.total_spend).toBe(50_000);
    expect(month.account_summary.total_spend).toBe(120_000);
  });

  it("resolves effective ad status from the parent chain", () => {
    expect(resolveOperationalStatus({ configuredStatus: "ACTIVE", campaignStatus: "PAUSED" }).effective).toBe("PAUSED");
    expect(resolveOperationalStatus({
      configuredStatus: "ACTIVE",
      campaignStatus: "ACTIVE",
      adSetStatus: "PAUSED",
      adSetStatusKnown: true,
    }).effective).toBe("PAUSED");
    expect(resolveOperationalStatus({
      configuredStatus: "PAUSED",
      campaignStatus: "ACTIVE",
      adSetStatus: "ACTIVE",
      adSetStatusKnown: true,
    }).effective).toBe("PAUSED");
    expect(resolveOperationalStatus({
      configuredStatus: "ACTIVE",
      campaignStatus: "ACTIVE",
      adSetStatus: "ACTIVE",
      adSetStatusKnown: true,
      metaEffectiveStatus: "ACTIVE",
    }).effective).toBe("ACTIVE");
    expect(resolveOperationalStatus({
      configuredStatus: "ACTIVE",
      campaignStatus: "UNKNOWN",
    }).effective).toBe("UNKNOWN");
  });

  it("keeps a configured-active ad paused when its campaign is paused and avoids live recommendations", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      campaigns: [
        { id: "c1", providerId: "6954286168859", name: "ASC Titik Huni Bangunjiwo 23/04", status: "PAUSED", objective: "OUTCOME_ENGAGEMENT" },
      ],
      ads: [
        { id: "a1", providerId: "6954326710259", name: "Bangunjiwo 3", status: "ACTIVE", campaignId: "c1" },
      ],
      insights: [insight("a1", 200_000, 8_000, 12)],
    });
    expect(report.ad_rankings[0].configuredStatus).toBe("ACTIVE");
    expect(report.ad_rankings[0].effectiveStatus).toBe("PAUSED");
    expect(report.analysis_metadata.effective_active_ads).toBe(0);
    expect(report.analysis_metadata.all_campaigns_paused).toBe(true);
    expect(report.recommendations.some((item) => item.action === "MONITOR" || item.action === "SCALE")).toBe(false);
    expect(report.historical_reviews.every((item) => item.currentStatus === "PAUSED")).toBe(true);
  });

  it("does not label a missing target as met and does not blend unlike results", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      campaigns: [
        { id: "c1", providerId: "1", name: "Pesan", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c2", providerId: "2", name: "Lead", status: "ACTIVE", objective: "OUTCOME_LEADS" },
      ],
      ads: [
        { id: "a1", providerId: "a1", name: "Ad Pesan", status: "ACTIVE", campaignId: "c1" },
        { id: "a2", providerId: "a2", name: "Ad Lead", status: "ACTIVE", campaignId: "c2" },
      ],
      insights: [
        insight("a1", 100_000, 5_000, 10),
        {
          ...insight("a2", 100_000, 5_000, 0),
          conversions: 8,
          action_breakdown: { lead: 8 },
          conversion_action_type: "lead",
        },
      ],
    });
    expect(report.analysis_metadata.result_comparability).toBe("ACCOUNT_RESULT_NOT_COMPARABLE");
    expect(report.account_summary.blended_cpr).toBeNull();
    expect(report.analysis_metadata.account_cpr_code).toBe("ACCOUNT_CPR_UNAVAILABLE");
    expect(report.campaign_rankings.every((item) => item.target.status === "TARGET_NOT_CONFIGURED")).toBe(true);
    expect(JSON.stringify(report).includes("Sesuai Target")).toBe(false);
  });

  it("warns on a long historical window without turning it into a daily optimization", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2025-12-03",
      periodEnd: "2026-11-03",
      durationDays: 336,
      accountCampaignTargetCpr: 10_000,
      campaigns: [{ id: "c1", providerId: "1", name: "Panjang", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" }],
      ads: [{ id: "a1", providerId: "a1", name: "Ad Panjang", status: "ACTIVE", campaignId: "c1" }],
      insights: [insight("a1", 500_000, 20_000, 40)],
    });
    expect(report.analysis_metadata.long_period_warning).toContain("90 hari");
    expect(report.recommendations.every((item) => !item.recommendedAction.toLowerCase().includes("anggaran harian") || item.monitoring.includes("90 hari"))).toBe(true);
    expect(report.recommendations.every((item) => item.monitoring.includes("90 hari"))).toBe(true);
  });

  it("hides the legacy account decision when the account report exists", () => {
    expect(accountReportSupersedesLegacyDecision("account", true)).toBe(true);
    expect(accountReportSupersedesLegacyDecision("campaign", true)).toBe(false);
    expect(accountReportSupersedesLegacyDecision("ad", false)).toBe(false);
  });

  it("builds evidence-backed diagnosis without invented comparison, CRM, or budget", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      campaigns: [
        { id: "c1", providerId: "1", name: "Besar", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c2", providerId: "2", name: "Kecil", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
      ],
      ads: [
        { id: "a1", providerId: "a1", name: "Ad Besar", status: "ACTIVE", campaignId: "c1" },
        { id: "a2", providerId: "a2", name: "Ad Kecil", status: "ACTIVE", campaignId: "c2" },
      ],
      insights: [
        { ...insight("a1", 800_000, 20_000, 4), link_clicks: 20, reach: 4_000 },
        { ...insight("a2", 200_000, 10_000, 10), link_clicks: 400, reach: 8_000 },
      ],
    });
    const intelligence = report.intelligence;
    expect(intelligence.confidence.decision).toBe("low");
    expect(intelligence.key_findings.some((item) => item.title.includes("target CPR"))).toBe(true);
    expect(intelligence.key_findings.some((item) => item.certainty === "unknown" && item.category === "comparison")).toBe(true);
    expect(JSON.stringify(intelligence).includes("% perubahan")).toBe(false);
    expect(intelligence.data_gaps.some((item) => item.field === "crm_funnel")).toBe(true);
    expect(intelligence.concentration?.campaign_name).toBe("Besar");
    expect(intelligence.creative_fatigue.status).not.toBe("META_EVENT_UNAVAILABLE");
    expect(intelligence.strategic_recommendations.every((item) => !/\bRp\s?\d/.test(item.execution_steps.join(" ")))).toBe(true);
    expect(intelligence.key_findings.every((item) => item.evidence.length > 0)).toBe(true);
  });

  it("does not treat a paused account as live delivery in the diagnosis", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      campaigns: [{ id: "c1", providerId: "1", name: "Dijeda", status: "PAUSED", objective: "OUTCOME_ENGAGEMENT" }],
      ads: [{ id: "a1", providerId: "a1", name: "Iklan", status: "ACTIVE", campaignId: "c1" }],
      insights: [insight("a1", 150_000, 5_000, 8)],
    });
    expect(report.intelligence.key_findings.some((item) => item.category === "status")).toBe(true);
    expect(report.intelligence.strategic_recommendations.some((item) => item.action_type === "MONITOR" || item.action_type === "SCALE")).toBe(false);
    expect(report.intelligence.confidence.decision).toBe("low");
  });

  it("does not call a thin zero-result delivery a loss and does not rank unlike results together", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      campaigns: [
        { id: "c1", providerId: "1", name: "Tipis", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c2", providerId: "2", name: "Lead", status: "ACTIVE", objective: "OUTCOME_LEADS" },
      ],
      ads: [
        { id: "a1", providerId: "a1", name: "Ad Tipis", status: "ACTIVE", campaignId: "c1" },
        { id: "a2", providerId: "a2", name: "Ad Lead", status: "ACTIVE", campaignId: "c2" },
      ],
      insights: [
        { ...insight("a1", 60_000, 600, 0), link_clicks: 4 },
        { ...insight("a2", 200_000, 8_000, 0), conversions: 12, action_breakdown: { lead: 12 }, conversion_action_type: "lead" },
      ],
    });
    expect(report.ad_rankings.find((item) => item.name === "Ad Tipis")?.category).toBe("INSUFFICIENT_DATA");
    expect(report.campaign_rankings.every((item) => item.category === "UNRANKED" || item.category === "INSUFFICIENT_DATA" || item.category === "UNDERPERFORMING")).toBe(true);
    expect(report.campaign_rankings.every((item) => item.category !== "TOP_PERFORMER" && item.category !== "EFFICIENT")).toBe(true);
    expect(report.ad_rankings.every((item) => item.reason.includes("creative, audience, dan placement tidak ada"))).toBe(true);
    expect(report.intelligence.data_gaps.some((item) => item.field === "crm_funnel")).toBe(true);
    expect(report.account_summary.blended_cpr).toBeNull();
  });

  it("does not inherit an ad target unless inheritance is explicit", () => {
    expect(resolveEvaluationTarget({
      level: "ad",
      parentTarget: 10_000,
      accountDefault: 10_000,
    }).source).toBe("TARGET_NOT_CONFIGURED");
    expect(resolveEvaluationTarget({
      level: "ad",
      parentTarget: 10_000,
      inheritExplicit: true,
    }).source).toBe("inherited");
  });
});
