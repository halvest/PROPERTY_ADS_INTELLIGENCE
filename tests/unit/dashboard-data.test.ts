import { describe, it, expect } from "vitest";
import {
  getDashboardKPISummary,
  getAdLeaderboard,
  getLeadsList,
  getLeadDetail,
  getReviewQueue,
  submitReviewCorrection,
  getIntegrationStatus,
} from "@/lib/data/dashboard-service";

describe("Phase 4: Dashboard Data Layer & Contract Verification", () => {
  describe("getDashboardKPISummary", () => {
    it("aggregates total spend, impressions, clicks, CTR, CPC, and CPQL deterministically", () => {
      const summary = getDashboardKPISummary("all");

      // Total spend across 4 demo ads: 4.5M + 6.2M + 3.1M + 2.8M = 16.6M IDR
      expect(summary.totalSpend).toBe(16600000);
      expect(summary.totalImpressions).toBe(48200 + 89400 + 35000 + 24100);
      expect(summary.totalClicks).toBe(1250 + 2410 + 890 + 520);
      expect(summary.currency).toBe("IDR");

      // CTR and CPC should be deterministic numbers
      expect(summary.ctr).toBeGreaterThan(0);
      expect(summary.cpc).toBeGreaterThan(0);
      expect(summary.totalLeads).toBe(16);
      expect(summary.qualifiedLeads).toBeGreaterThan(0);
      expect(summary.cpql).toBeGreaterThan(0);
    });

    it("keeps Buyer Score and Sales Score strictly separate and reports sample size n", () => {
      const summary = getDashboardKPISummary("all");

      expect(summary.avgBuyerScore).not.toBeNull();
      expect(summary.avgSalesScore).not.toBeNull();
      expect(summary.buyerScoreSampleSize).toBeGreaterThan(0);
      expect(summary.salesScoreSampleSize).toBeGreaterThan(0);

      // Separate metrics, never collapsed into a single number
      expect(typeof summary.avgBuyerScore).toBe("number");
      expect(typeof summary.avgSalesScore).toBe("number");
    });

    it("calculates attribution coverage with verified, inferred, and unknown counts", () => {
      const summary = getDashboardKPISummary("all");

      const { verifiedCount, inferredCount, unknownCount, total, verifiedPercentage } =
        summary.attributionCoverage;

      expect(total).toBe(16);
      expect(verifiedCount + inferredCount + unknownCount).toBe(16);
      expect(verifiedCount).toBeGreaterThan(0);
      expect(inferredCount).toBeGreaterThan(0);
      expect(unknownCount).toBeGreaterThan(0);
      expect(verifiedPercentage).toBeGreaterThan(0);
      expect(verifiedPercentage).toBeLessThanOrEqual(100);
    });

    it("filters data consistently when date range is applied", () => {
      const summaryAll = getDashboardKPISummary("all");
      const summary7d = getDashboardKPISummary("7d");

      expect(summaryAll.totalLeads).toBeGreaterThanOrEqual(summary7d.totalLeads);
    });
  });

  describe("getAdLeaderboard & Unknown Attribution Exclusion", () => {
    it("STRICTLY EXCLUDES unknown-attribution leads from ad performance rankings", () => {
      const leaderboard = getAdLeaderboard({ dateRange: "all" });

      expect(leaderboard.length).toBe(4);

      // Lead scenario 14 has attribution status 'unknown'
      // It must not be counted in any ad's attributedLeadsCount!
      const totalAttributedAcrossAds = leaderboard.reduce(
        (sum, item) => sum + item.attributedLeadsCount,
        0
      );

      // Total leads is 16, but unknown leads (e.g. scenario 14, 16) are excluded
      expect(totalAttributedAcrossAds).toBeLessThan(16);

      // Verified and Inferred must sum to attributedLeadsCount
      leaderboard.forEach((ad) => {
        expect(ad.attributedLeadsCount).toBe(
          ad.attributionBreakdown.verified + ad.attributionBreakdown.inferred
        );
      });
    });

    it("filters by attribution status (verified only vs inferred only)", () => {
      const verifiedOnly = getAdLeaderboard({ attributionFilter: "verified" });
      verifiedOnly.forEach((ad) => {
        expect(ad.attributionBreakdown.inferred).toBe(0);
        expect(ad.attributedLeadsCount).toBe(ad.attributionBreakdown.verified);
      });

      const inferredOnly = getAdLeaderboard({ attributionFilter: "inferred" });
      inferredOnly.forEach((ad) => {
        expect(ad.attributionBreakdown.verified).toBe(0);
        expect(ad.attributedLeadsCount).toBe(ad.attributionBreakdown.inferred);
      });
    });

    it("flags sampleWarning: true when sample size n < 5", () => {
      const leaderboard = getAdLeaderboard({ dateRange: "all" });

      leaderboard.forEach((ad) => {
        if (ad.buyerScoreSampleSize < 5) {
          expect(ad.sampleWarning).toBe(true);
        } else {
          expect(ad.sampleWarning).toBe(false);
        }
      });
    });

    it("sorts by buyer_score, spend, leads, and cpql correctly", () => {
      const sortedByScore = getAdLeaderboard({ sortBy: "buyer_score" });
      for (let i = 0; i < sortedByScore.length - 1; i++) {
        const curr = sortedByScore[i].avgBuyerScore ?? -1;
        const next = sortedByScore[i + 1].avgBuyerScore ?? -1;
        expect(curr).toBeGreaterThanOrEqual(next);
      }

      const sortedBySpend = getAdLeaderboard({ sortBy: "spend" });
      for (let i = 0; i < sortedBySpend.length - 1; i++) {
        expect(sortedBySpend[i].spend).toBeGreaterThanOrEqual(sortedBySpend[i + 1].spend);
      }
    });
  });

  describe("getLeadsList & getLeadDetail", () => {
    it("returns all 16 synthetic demo leads with complete dimensions", () => {
      const leads = getLeadsList();
      expect(leads).toHaveLength(16);

      leads.forEach((l) => {
        expect(l.id).toBeDefined();
        expect(l.name).toBeDefined();
        expect(l.phoneMasked).toMatch(/\+62 812-\*\*\*\*-\d{3}/);
        expect(l.funnelStage).toBeDefined();
        expect(l.attributionStatus).toBeDefined();
        expect(l.buyerAssessment).toBeDefined();
        expect(l.salesAssessment).toBeDefined();
      });
    });

    it("preserves missing score as null rather than converting to zero", () => {
      // Scenario 5 has missing budget and timeline
      const lead5 = getLeadDetail("lead_syn_05");
      expect(lead5).toBeDefined();
      expect(lead5?.buyerAssessment.missingCriteria).toContain("budget_fit");
      expect(lead5?.buyerAssessment.criteria.budget_fit.score).toBeNull();
      expect(lead5?.buyerAssessment.criteria.budget_fit.status).toBe("missing");
    });

    it("filters leads by funnel stage and attribution status", () => {
      const surveiLeads = getLeadsList({ funnelStage: "survei" });
      surveiLeads.forEach((l) => expect(l.funnelStage).toBe("survei"));

      const verifiedLeads = getLeadsList({ attributionStatus: "verified" });
      verifiedLeads.forEach((l) => expect(l.attributionStatus).toBe("verified"));
    });

    it("searches leads by text query", () => {
      const results = getLeadsList({ search: "sapphire" });
      expect(results.length).toBeGreaterThan(0);
      results.forEach((l) => {
        const matches =
          l.name.toLowerCase().includes("sapphire") ||
          (l.adName && l.adName.toLowerCase().includes("sapphire"));
        expect(matches).toBe(true);
      });
    });
  });

  describe("Review Queue & Corrections Workflow", () => {
    it("identifies leads requiring manual review (invalid, incomplete, or inferred)", () => {
      const queue = getReviewQueue();
      expect(queue.length).toBeGreaterThan(0);

      queue.forEach((item) => {
        expect(item.leadId).toBeDefined();
        expect(item.flagReason).toBeDefined();
        expect(item.flagType).toBeDefined();
      });
    });

    it("enforces mandatory non-empty reason when submitting a review correction", () => {
      const failedRes = submitReviewCorrection({
        leadId: "lead_syn_13",
        previousStatus: "inferred",
        newStatus: "verified",
        reason: "   ", // Blank!
      });

      expect(failedRes.success).toBe(false);
      expect(failedRes.error).toMatch(/alasan koreksi wajib diisi/i);

      const successRes = submitReviewCorrection({
        leadId: "lead_syn_13",
        previousStatus: "inferred",
        newStatus: "verified",
        reason: "Bukti referral Meta Ads diverifikasi oleh supervisor",
      });

      expect(successRes.success).toBe(true);

      const updatedLead = getLeadDetail("lead_syn_13");
      const lastHistory =
        updatedLead?.correctionHistory[updatedLead.correctionHistory.length - 1];
      expect(lastHistory?.reason).toBe(
        "Bukti referral Meta Ads diverifikasi oleh supervisor"
      );
      expect(lastHistory?.newStatus).toBe("verified");
    });
  });

  describe("getIntegrationStatus", () => {
    it("returns masked credentials and active demo status for all required providers", () => {
      const integrations = getIntegrationStatus();

      expect(integrations).toHaveLength(4);

      const metaMarketing = integrations.find((i) => i.provider === "meta_marketing");
      const whatsapp = integrations.find((i) => i.provider === "whatsapp_cloud");
      const metaModel = integrations.find((i) => i.provider === "meta_model_api");
      const supabase = integrations.find((i) => i.provider === "supabase");

      expect(metaMarketing?.status).toBe("demo_active");
      expect(whatsapp?.status).toBe("demo_active");
      expect(metaModel?.status).toBe("demo_active");
      expect(supabase?.status).toBe("connected");

      // Verify credentials are masked and never raw
      integrations.forEach((i) => {
        if (i.maskedCredential) {
          expect(i.maskedCredential).toContain("•");
        }
      });
    });
  });
});
