import { describe, it, expect } from "vitest";
import {
  evaluateAttribution,
  createAttributionEvent,
  filterLeadsForAdRanking,
} from "@/domain/attribution/evaluator";
import type { AttributionStatus } from "@/domain/attribution/types";

describe("Evidence-Based Attribution & Ranking Exclusion Rules", () => {
  describe("evaluateAttribution", () => {
    it("assigns 'verified' ONLY when official provider referral identifier exists", () => {
      const res = evaluateAttribution({
        rawReferral: {
          source: "ad_click",
          adId: "ad_meta_12345",
          campaignId: "cmp_meta_999",
          headline: "Rumah 2 Lantai BSD",
          verifiedSignature: true,
        },
      });

      expect(res.status).toBe("verified");
      expect(res.adId).toBe("ad_meta_12345");
      expect(res.campaignId).toBe("cmp_meta_999");
      expect(res.reason).toMatch(/metadata referral resmi/);
    });

    it("assigns 'inferred' when a documented inference rule matches with confidence >= 0.70", () => {
      const res = evaluateAttribution({
        inferredCandidate: {
          method: "headline_match",
          matchedText: "Promo DP 0 Persen Cluster Sapphire",
          confidence: 0.85,
          adId: "ad_sapphire_dp0",
          campaignId: "cmp_sapphire",
        },
      });

      expect(res.status).toBe("inferred");
      expect(res.adId).toBe("ad_sapphire_dp0");
      expect(res.evidence).toHaveProperty("disclaimer");
      expect(res.reason).toMatch(/Inferensi terdeteksi/);
    });

    it("assigns 'unknown' and NEVER invents an ad ID when evidence is insufficient", () => {
      const res = evaluateAttribution({
        conversationMessageText: "Halo, saya mau tanya rumah di BSD",
      });

      expect(res.status).toBe("unknown");
      expect(res.adId).toBeNull();
      expect(res.campaignId).toBeNull();
      expect(res.reason).toMatch(/Bukti tidak cukup/);
    });

    it("rejects low-confidence inference candidates (< 0.70) as unknown", () => {
      const res = evaluateAttribution({
        inferredCandidate: {
          method: "headline_match",
          matchedText: "rumah",
          confidence: 0.45, // Too low
          adId: "ad_general",
        },
      });

      expect(res.status).toBe("unknown");
      expect(res.adId).toBeNull();
    });
  });

  describe("Ranking Exclusion for Unknown Attribution Leads", () => {
    it("excludes unknown attribution leads from ad-specific performance rankings", () => {
      const leads = [
        { id: "lead_1", adId: "ad_101", attributionStatus: "verified" as AttributionStatus },
        { id: "lead_2", adId: "ad_101", attributionStatus: "inferred" as AttributionStatus },
        { id: "lead_3", adId: "ad_101", attributionStatus: "unknown" as AttributionStatus }, // Unknown MUST be excluded!
        { id: "lead_4", adId: "ad_202", attributionStatus: "verified" as AttributionStatus }, // Different ad
      ];

      const filtered = filterLeadsForAdRanking(leads, "ad_101");

      expect(filtered).toHaveLength(2);
      expect(filtered.map((l) => l.id)).toEqual(["lead_1", "lead_2"]);
      expect(filtered.some((l) => l.attributionStatus === "unknown")).toBe(false);
    });
  });

  describe("Attribution Audit Event History", () => {
    it("creates an attribution event audit record and requires non-empty reason", () => {
      const event = createAttributionEvent({
        organizationId: "org_01",
        conversationId: "conv_01",
        previousStatus: "inferred",
        newStatus: "verified",
        previousAdId: "ad_old",
        newAdId: "ad_new",
        attributionMethod: "manual_correction",
        reason: "Bukti referral WhatsApp Webhook dikonfirmasi supervisor",
        actorId: "supervisor_01",
      });

      expect(event.previousStatus).toBe("inferred");
      expect(event.newStatus).toBe("verified");
      expect(event.reason).toBe("Bukti referral WhatsApp Webhook dikonfirmasi supervisor");
      expect(event.actorId).toBe("supervisor_01");
      expect(event.createdAt).toBeDefined();
    });

    it("throws an error if reason is empty or whitespace when recording a correction", () => {
      expect(() =>
        createAttributionEvent({
          organizationId: "org_01",
          conversationId: "conv_01",
          previousStatus: "unknown",
          newStatus: "verified",
          attributionMethod: "manual_correction",
          reason: "   ", // Blank!
        })
      ).toThrowError(/alasan/);
    });
  });
});
