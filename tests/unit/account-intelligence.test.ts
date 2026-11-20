import { describe, expect, it } from "vitest";
import {
  buildAccountIntelligence,
  resolveEvaluationTarget,
  normalizeDateToTimezone,
  insightFallsInPeriod,
  meetsWinnerSignificanceFloor,
} from "@/lib/ai/account-intelligence/engine";
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
    expect(report.campaign_rankings[0].action).toBe("REACTIVATION_CANDIDATE");
    expect(report.campaign_rankings[0].actionLabel).toBe("Kandidat Reaktivasi");
    expect(report.campaign_rankings[0].reason).toContain("bukan bukti iklan sedang berjalan");
    expect(report.recommendations.some((item) => item.action === "MONITOR" || item.action === "SCALE")).toBe(false);
    expect(report.historical_reviews.some((item) => item.action === "REACTIVATION_CANDIDATE")).toBe(true);
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

  it("enforces the 4 core anti-hallucination safeguards (Golden Offer, Clickbait Traffic Leak, Material Waste Score 0, Objective Isolation)", () => {
    const report = buildAccountIntelligence({
      accountName: "Akun Safeguard",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-14",
      durationDays: 14,
      accountCampaignTargetCpr: 15_000,
      campaigns: [
        { id: "c-gold", providerId: "101", name: "Golden Offer CTWA", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c-leak", providerId: "102", name: "Clickbait Leak", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c-waste", providerId: "103", name: "Material Waste", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        { id: "c-like", providerId: "104", name: "Cheap Likes", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
      ],
      ads: [
        { id: "a-gold", providerId: "a101", name: "Ad Golden", status: "ACTIVE", campaignId: "c-gold" },
        { id: "a-leak", providerId: "a102", name: "Ad Clickbait", status: "ACTIVE", campaignId: "c-leak" },
        { id: "a-waste", providerId: "a103", name: "Ad Waste", status: "ACTIVE", campaignId: "c-waste" },
        { id: "a-like", providerId: "a104", name: "Ad Likes", status: "ACTIVE", campaignId: "c-like" },
      ],
      insights: [
        // 1. Golden Offer: CTR 0.5% (< 0.8%), 50 link clicks -> 20 chats (CVR 40% > 20%), spend 200k -> CPR 10k (<= 15k target)
        {
          ...insight("a-gold", 200_000, 10_000, 20),
          link_clicks: 50,
        },
        // 2. Traffic Leak (Clickbait): CTR 2.0% (> 1.5%), 200 link clicks -> 1 chat (CVR 0.5% < 2%), spend 150k
        {
          ...insight("a-leak", 150_000, 10_000, 1),
          link_clicks: 200,
        },
        // 3. Material Waste: Spend 150k (>= 100k), 0 results -> score.total forced to 0
        {
          ...insight("a-waste", 150_000, 5_000, 0),
          link_clicks: 15,
        },
        // 4. Cheap Engagement (post_engagement action type, Rp 30 per like)
        {
          ad_id: "a-like",
          spend: 30_000,
          impressions: 10_000,
          clicks: 1_200,
          link_clicks: 50,
          reach: null,
          conversions: 1_000,
          date_start: "2026-10-01",
          action_breakdown: { post_engagement: 1_000 },
          conversion_action_type: "post_engagement",
        },
      ],
    });

    // Safeguard 1: Objective & Action Type Isolation (post_engagement vs messaging)
    expect(report.analysis_metadata.result_comparability).toBe("ACCOUNT_RESULT_NOT_COMPARABLE");
    expect(report.account_summary.blended_cpr).toBeNull();

    // Safeguard 3A: Creative Bottleneck (Golden Offer) detected
    expect(
      report.intelligence.key_findings.some((f) =>
        f.diagnosis.includes("Penawaran (Offer/CVR) sangat kuat, tetapi materi visual gagal menarik klik")
      )
    ).toBe(true);

    // Safeguard 3B: Traffic Leak (Clickbait) detected
    expect(
      report.intelligence.key_findings.some((f) =>
        f.diagnosis.includes("Iklan bersifat clickbait. Banyak klik tetapi audiens langsung keluar dari Landing Page/WhatsApp")
      )
    ).toBe(true);

    // Safeguard 4: Material Waste forces total score to 0 and cpr to null
    const wasteCampaign = report.campaign_rankings.find((c) => c.name === "Material Waste");
    expect(wasteCampaign?.cpr).toBeNull();
    expect(wasteCampaign?.score.total).toBe(0);
    expect(wasteCampaign?.category).toBe("UNDERPERFORMING");
  });

  describe("Audit v2.1 Patches (Production Hardening)", () => {
    it("PATCH 1: safely normalizes timezone and prevents UTC truncation drift (P0)", () => {
      // 23:00 UTC on Oct 1st is 06:00 AM on Oct 2nd in Asia/Jakarta (UTC+7)
      const lateNightUtc = "2026-10-01T23:00:00Z";
      const normalizedJakarta = normalizeDateToTimezone(lateNightUtc, "Asia/Jakarta");
      expect(normalizedJakarta).toBe("2026-10-02");

      // Verify insightFallsInPeriod correctly identifies it as Oct 2nd in Jakarta
      expect(insightFallsInPeriod({ date_start: lateNightUtc }, "2026-10-02", "2026-10-02", "Asia/Jakarta")).toBe(true);
      expect(insightFallsInPeriod({ date_start: lateNightUtc }, "2026-10-01", "2026-10-01", "Asia/Jakarta")).toBe(false);

      // Verify buildAccountIntelligence retains it for Oct 2nd period
      const report = buildAccountIntelligence({
        accountName: "Timezone Audit",
        periodStart: "2026-10-02",
        periodEnd: "2026-10-02",
        timezone: "Asia/Jakarta",
        durationDays: 1,
        campaigns: [{ id: "c1", providerId: "1", name: "C1", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" }],
        ads: [{ id: "a1", providerId: "a1", name: "A1", status: "ACTIVE", campaignId: "c1" }],
        insights: [
          {
            ...insight("a1", 100_000, 5_000, 10),
            date_start: lateNightUtc,
          },
        ],
      });
      expect(report.campaign_rankings.length).toBe(1);
      expect(report.account_summary.total_spend).toBe(100_000);
    });

    it("PATCH 2: enforces link_clicks >= 30 noise floor on Golden Offer diagnosis (P0)", () => {
      // Scenario A: Micro-sample (4 clicks, 1 conversion = 25% CVR, CTR 0.4%)
      // MUST NOT trigger Golden Offer finding
      const microSampleReport = buildAccountIntelligence({
        accountName: "Noise Floor Test",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-14",
        durationDays: 14,
        accountCampaignTargetCpr: 15_000,
        campaigns: [
          { id: "c1", providerId: "1", name: "Micro Noise", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
          { id: "c2", providerId: "2", name: "Stable Normal", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        ],
        ads: [
          { id: "a1", providerId: "a1", name: "Ad Micro", status: "ACTIVE", campaignId: "c1" },
          { id: "a2", providerId: "a2", name: "Ad Normal", status: "ACTIVE", campaignId: "c2" },
        ],
        insights: [
          {
            ...insight("a1", 10_000, 1_000, 1),
            link_clicks: 4, // < 30 noise floor!
          },
          {
            ...insight("a2", 200_000, 10_000, 15),
            link_clicks: 150,
          },
        ],
      });
      expect(
        microSampleReport.intelligence.key_findings.some((f) =>
          f.title.includes("Creative Bottleneck (Golden Offer)")
        )
      ).toBe(false);

      // Scenario B: Robust sample (35 clicks, 10 conversions = 28.57% CVR, CTR 0.5%, CPR 10k <= 15k target)
      // MUST trigger Golden Offer finding
      const robustSampleReport = buildAccountIntelligence({
        accountName: "Noise Floor Test",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-14",
        durationDays: 14,
        accountCampaignTargetCpr: 15_000,
        campaigns: [
          { id: "c1", providerId: "1", name: "Robust Golden", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
          { id: "c2", providerId: "2", name: "Stable Normal", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        ],
        ads: [
          { id: "a1", providerId: "a1", name: "Ad Robust", status: "ACTIVE", campaignId: "c1" },
          { id: "a2", providerId: "a2", name: "Ad Normal", status: "ACTIVE", campaignId: "c2" },
        ],
        insights: [
          {
            ...insight("a1", 100_000, 7_000, 10),
            link_clicks: 35, // >= 30 passes noise floor!
          },
          {
            ...insight("a2", 200_000, 10_000, 15),
            link_clicks: 150,
          },
        ],
      });
      expect(
        robustSampleReport.intelligence.key_findings.some((f) =>
          f.title.includes("Creative Bottleneck (Golden Offer)")
        )
      ).toBe(true);
    });

    it("PATCH 3: enforces 10 results and 3x target CPR significance floor, capping 1-9 results at STABLE (P1)", () => {
      // Direct helper test
      expect(meetsWinnerSignificanceFloor(9, 100_000, 10_000)).toBe(false); // results < 10
      expect(meetsWinnerSignificanceFloor(10, 25_000, 10_000)).toBe(false); // spend < 3 * 10_000 = 30_000
      expect(meetsWinnerSignificanceFloor(10, 50_000, 10_000)).toBe(true);  // results >= 10 and spend >= 3x target

      // Engine ranking test: Compare 7 results vs 15 results
      const report = buildAccountIntelligence({
        accountName: "Floor Test",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-14",
        durationDays: 14,
        accountCampaignTargetCpr: 10_000,
        campaigns: [
          { id: "c-mid", providerId: "1", name: "Mid Sample (7 results)", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
          { id: "c-high", providerId: "2", name: "High Sample (15 results)", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
        ],
        ads: [
          { id: "a-mid", providerId: "a1", name: "Ad Mid", status: "ACTIVE", campaignId: "c-mid" },
          { id: "a-high", providerId: "a2", name: "Ad High", status: "ACTIVE", campaignId: "c-high" },
        ],
        insights: [
          {
            ...insight("a-mid", 70_000, 5_000, 7),
            link_clicks: 100,
          },
          {
            ...insight("a-high", 150_000, 10_000, 15),
            link_clicks: 200,
          },
        ],
      });

      const midCampaign = report.campaign_rankings.find((c) => c.id === "c-mid");
      const highCampaign = report.campaign_rankings.find((c) => c.id === "c-high");

      // Mid campaign with 7 results cannot be TOP_PERFORMER or EFFICIENT; capped at STABLE
      expect(midCampaign?.category).toBe("STABLE");
      expect(midCampaign?.category).not.toBe("TOP_PERFORMER");
      expect(midCampaign?.category).not.toBe("EFFICIENT");

      // High campaign with 15 results and sufficient spend achieves EFFICIENT / TOP_PERFORMER
      expect(["TOP_PERFORMER", "EFFICIENT"]).toContain(highCampaign?.category);
      expect(highCampaign?.category).not.toBe("STABLE");
    });

    it("PATCH 4: detects CBO spend discrepancy > 5% between campaign and ad insights (P1)", () => {
      // Discrepancy > 5%: Campaign spend 1,000,000 vs Ad insights sum 800,000 (20% diff)
      const divergentReport = buildAccountIntelligence({
        accountName: "CBO Discrepancy Test",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-14",
        durationDays: 14,
        campaigns: [
          { id: "c1", providerId: "1", name: "CBO Campaign", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT", spend: 1_000_000 },
        ],
        ads: [
          { id: "a1", providerId: "a1", name: "Ad A1", status: "ACTIVE", campaignId: "c1" },
        ],
        insights: [
          insight("a1", 800_000, 20_000, 50),
        ],
      });

      expect(
        divergentReport.data_quality.warnings.some((w) =>
          w.includes("Terdeteksi selisih pembelanjaan antara level Iklan dan Kampanye. Metrik dihitung berdasarkan data level iklan.")
        )
      ).toBe(true);

      // Discrepancy <= 5%: Campaign spend 1,000,000 vs Ad insights sum 980,000 (2% diff)
      const matchingReport = buildAccountIntelligence({
        accountName: "CBO Match Test",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-14",
        durationDays: 14,
        campaigns: [
          { id: "c1", providerId: "1", name: "CBO Campaign", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT", spend: 1_000_000 },
        ],
        ads: [
          { id: "a1", providerId: "a1", name: "Ad A1", status: "ACTIVE", campaignId: "c1" },
        ],
        insights: [
          insight("a1", 980_000, 20_000, 50),
        ],
      });

      expect(
        matchingReport.data_quality.warnings.some((w) =>
          w.includes("Terdeteksi selisih pembelanjaan antara level Iklan dan Kampanye")
        )
      ).toBe(false);
    });

    it("FASE 2 & 3: generates Padat Daging summaryShort, diagnosisLabel, actionLabel, and active-only priority_actions sorted by spend impact", () => {
      const report = buildAccountIntelligence({
        accountName: "Padat Daging Test",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-14",
        durationDays: 14,
        accountCampaignTargetCpr: 15_000,
        campaigns: [
          { id: "c-waste", providerId: "1", name: "Camp Boncos", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
          { id: "c-gold", providerId: "2", name: "Camp Golden", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
          { id: "c-scale", providerId: "3", name: "Camp Scale", status: "ACTIVE", objective: "OUTCOME_ENGAGEMENT" },
          { id: "c-paused", providerId: "4", name: "Camp Paused", status: "PAUSED", objective: "OUTCOME_ENGAGEMENT" },
        ],
        ads: [
          { id: "a-waste", providerId: "a1", name: "Ad Boncos", status: "ACTIVE", campaignId: "c-waste" },
          { id: "a-gold", providerId: "a2", name: "Ad Golden", status: "ACTIVE", campaignId: "c-gold" },
          { id: "a-scale", providerId: "a3", name: "Ad Scale", status: "ACTIVE", campaignId: "c-scale" },
          { id: "a-paused", providerId: "a4", name: "Ad Paused", status: "PAUSED", campaignId: "c-paused" },
        ],
        insights: [
          { ...insight("a-waste", 185_000, 5_000, 0), link_clicks: 12 },
          { ...insight("a-gold", 150_000, 10_000, 15), link_clicks: 45 }, // CTR 0.45% (<0.8%), CVR 33.3% (>=20%), CPR 10k <= 15k
          { ...insight("a-scale", 300_000, 15_000, 30), link_clicks: 300 }, // CTR 2.0%, CVR 10%, 30 results @ 10k
          { ...insight("a-paused", 500_000, 20_000, 60), link_clicks: 400 },
        ],
      });

      const wasteAd = report.ad_rankings.find((a) => a.id === "a-waste");
      expect(wasteAd?.funnelSignal).toBe("material_waste");
      expect(wasteAd?.actionLabel).toBe("Nonaktifkan");
      expect(wasteAd?.summaryShort).toContain("Spend Tanpa Hasil");
      expect(wasteAd?.summaryShort).toContain("0 konversi");

      const goldAd = report.ad_rankings.find((a) => a.id === "a-gold");
      expect(goldAd?.funnelSignal).toBe("golden_offer");
      expect(goldAd?.actionLabel).toBe("Optimasi");
      expect(goldAd?.summaryShort).toContain("Konversi Tinggi, CTR Rendah");

      const pausedCamp = report.campaign_rankings.find((c) => c.id === "c-paused");
      expect(pausedCamp?.action).toBe("REACTIVATION_CANDIDATE");
      expect(pausedCamp?.actionLabel).toBe("Kandidat Reaktivasi");
      expect(pausedCamp?.summaryShort).toContain("Kandidat Reaktivasi");

      const priorityActions = report.priority_actions ?? [];
      expect(priorityActions.length).toBeGreaterThan(0);
      expect(priorityActions.some((p) => p.action === "REACTIVATION_CANDIDATE" && (p.objectId === "c-paused" || p.objectId === "a-paused"))).toBe(true);
      expect(priorityActions[0].priority).toBe("CRITICAL");

      // Active health counts must partition all 3 active campaigns (1 Efisien, 1 Optimasi, 1 Kritis, 0 Observasi) + 1 Historical
      const hc = report.account_summary.health_counts!;
      expect(hc.activeCount).toBe(3);
      expect(hc.scaleCount).toBe(1);
      expect(hc.optimizeCount).toBe(1);
      expect(hc.wasteCount).toBe(1);
      expect(hc.holdCount).toBe(0);
      expect(hc.scaleCount + hc.optimizeCount + hc.wasteCount + hc.holdCount).toBe(hc.activeCount);
      expect(hc.historicalCount).toBe(1);
      expect(hc.historicalGoodCount).toBe(1);
    });

    it("computes historical reference breakdown when all campaigns are PAUSED (activeCount === 0 && historicalCount > 0)", () => {
      const allPausedReport = buildAccountIntelligence({
        accountName: "All Paused Account",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-30",
        durationDays: 30,
        accountCampaignTargetCpr: 15_000,
        campaigns: [
          { id: "c-p1", providerId: "1", name: "ASC Video Bangunjiwo 19/10", status: "PAUSED", objective: "MESSAGES" },
          { id: "c-p2", providerId: "2", name: "Paused High CPR", status: "PAUSED", objective: "MESSAGES" },
        ],
        ads: [
          { id: "a-p1", providerId: "a1", name: "video", status: "PAUSED", campaignId: "c-p1" },
          { id: "a-p2", providerId: "a2", name: "image", status: "PAUSED", campaignId: "c-p2" },
        ],
        insights: [
          { ...insight("a-p1", 399_151, 18_063, 55), link_clicks: 139 },
          { ...insight("a-p2", 250_000, 9_000, 5), link_clicks: 80 },
        ],
      });

      const hc = allPausedReport.account_summary.health_counts!;
      expect(hc.activeCount).toBe(0);
      expect(hc.historicalCount).toBe(2);
      expect(hc.historicalGoodCount).toBe(1);
      expect(
        hc.historicalGoodCount + hc.historicalNeutralCount + hc.historicalUnderperformingCount
      ).toBe(hc.historicalCount);
      expect(allPausedReport.campaign_rankings.every((c) => c.performanceBasis === "historical_paused")).toBe(true);
    });

    it("FASE 4 QA: guarantees zero NaN, Infinity, Rp NaN, or Invalid Date across empty, zero-spend, all-paused, and multi-objective edge cases", () => {
      const emptyReport = buildAccountIntelligence({
        accountName: "Empty Brand New Account",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-30",
        durationDays: 30,
        campaigns: [],
        ads: [],
        insights: [],
      });

      const mixedPausedReport = buildAccountIntelligence({
        accountName: "Mixed & Paused Edge Case",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-30",
        durationDays: 30,
        campaigns: [
          { id: "c1", providerId: "1", name: "C1 Messaging", status: "ACTIVE", objective: "MESSAGES" },
          { id: "c2", providerId: "2", name: "C2 Paused Leads", status: "PAUSED", objective: "OUTCOME_LEADS" },
          { id: "c3", providerId: "3", name: "C3 Zero Spend", status: "ACTIVE", objective: "MESSAGES" },
        ],
        ads: [
          { id: "a1", providerId: "a1", name: "A1 Messaging", status: "ACTIVE", campaignId: "c1" },
          { id: "a2", providerId: "a2", name: "A2 Paused Leads", status: "PAUSED", campaignId: "c2" },
          { id: "a3", providerId: "a3", name: "A3 Zero", status: "ACTIVE", campaignId: "c3" },
        ],
        insights: [
          { ...insight("a1", 80_000, 2_000, 5), link_clicks: 40 },
          {
            ...insight("a2", 120_000, 1_500, 4),
            link_clicks: 30,
            action_breakdown: { lead: 4 },
            conversion_action_type: "lead",
          },
          { ...insight("a3", 0, 0, 0), link_clicks: 0 },
        ],
      });

      for (const rep of [emptyReport, mixedPausedReport]) {
        const serialized = JSON.stringify(rep);
        expect(serialized.includes("NaN")).toBe(false);
        expect(serialized.includes("Infinity")).toBe(false);
        expect(serialized.includes("Invalid Date")).toBe(false);
        expect(serialized.includes("Rp NaN")).toBe(false);
      }

      expect(mixedPausedReport.account_summary.results_comparable).toBe(false);
      expect(mixedPausedReport.account_summary.blended_cpr).toBeNull();
      expect(mixedPausedReport.account_summary.total_results).toBeNull();
    });
  });
});
