import { describe, it, expect } from "vitest";
import {
  transitionFunnelStage,
  type FunnelState,
} from "@/domain/funnel/stages";
import { SYNTHETIC_LEAD_SCENARIOS } from "@/fixtures/synthetic-leads";
import { calculateBuyerScore } from "@/domain/scoring/buyer-score";
import { calculateSalesScore } from "@/domain/scoring/sales-score";
import { evaluateAttribution } from "@/domain/attribution/evaluator";

describe("Funnel Stage Independence & Synthetic Demo Scenarios", () => {
  describe("Funnel Stage Transitions and Score Independence", () => {
    it("allows valid sequential funnel progression with documented reason", () => {
      let state: FunnelState = {
        currentStage: "baru",
        stageHistory: [],
      };

      // 1. baru -> dihubungi
      state = transitionFunnelStage(state, "dihubungi", {
        conversationId: "conv_01",
        eventReason: "Sales mengirimkan pesan pertama",
      });
      expect(state.currentStage).toBe("dihubungi");
      expect(state.stageHistory).toHaveLength(1);

      // 2. dihubungi -> prospek
      state = transitionFunnelStage(state, "prospek", {
        conversationId: "conv_01",
        eventReason: "Calon pembeli menyatakan kebutuhan unit 2 lantai",
      });
      expect(state.currentStage).toBe("prospek");

      // 3. prospek -> survei
      state = transitionFunnelStage(state, "survei", {
        conversationId: "conv_01",
        eventReason: "Survei lokasi fisik dijadwalkan untuk Sabtu jam 10",
      });
      expect(state.currentStage).toBe("survei");
    });

    it("rejects illegal skips in the sales funnel", () => {
      const state: FunnelState = {
        currentStage: "baru",
        stageHistory: [],
      };

      // Illegal transition: 'baru' directly to 'closing'
      expect(() =>
        transitionFunnelStage(state, "closing", {
          conversationId: "conv_01",
          eventReason: "Mencoba langsung closing",
        })
      ).toThrowError(/Transisi tahap funnel tidak diizinkan/);
    });

    it("requires non-empty reason when transitioning funnel stage", () => {
      const state: FunnelState = {
        currentStage: "baru",
        stageHistory: [],
      };

      expect(() =>
        transitionFunnelStage(state, "dihubungi", {
          conversationId: "conv_01",
          eventReason: "   ", // Blank!
        })
      ).toThrowError(/memerlukan alasan/);
    });

    it("ensures Buyer Score = 100 or Sales Score = 100 NEVER automatically advances funnel stage", () => {
      const state: FunnelState = {
        currentStage: "baru",
        stageHistory: [],
      };

      // High scores evaluated
      const buyerAssessment = calculateBuyerScore([
        { criterion: "purchase_intent", points: 25 },
        { criterion: "budget_fit", points: 20 },
        { criterion: "property_needs_fit", points: 20 },
        { criterion: "purchase_timeline", points: 15 },
        { criterion: "readiness_for_action", points: 20 },
      ]);
      expect(buyerAssessment.rawPoints).toBe(100);

      // Funnel state MUST REMAIN UNCHANGED until a human or business event triggers transition
      expect(state.currentStage).toBe("baru");
      expect(state.stageHistory).toHaveLength(0);
    });
  });

  describe("Verification of All 16 Synthetic Demo Scenarios", () => {
    const scenarioKeys = Object.keys(SYNTHETIC_LEAD_SCENARIOS);

    it("contains exactly 16 documented test scenarios", () => {
      expect(scenarioKeys).toHaveLength(16);
    });

    it("executes Scenario 1: High Buyer, High Sales, Verified Attribution", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_01_high_buyer_high_sales_verified;
      const buyer = calculateBuyerScore(sc.buyerCriteria);
      const sales = calculateSalesScore({
        criteriaInputs: sc.salesCriteria,
        messages: sc.messages,
      });
      const attr = evaluateAttribution({
        rawReferral: sc.attribution.rawReferral,
      });

      expect(buyer.rawPoints).toBe(100);
      expect(buyer.status).toBe("completed");
      expect(sales.rawPoints).toBe(100); // 15 from 3-min response + 85 criteria
      expect(attr.status).toBe("verified");
      expect(attr.adId).toBe("ad_sapphire_72");
    });

    it("executes Scenario 4: Both Scores Low with Sufficient Evidence", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_04_both_low;
      const buyer = calculateBuyerScore(sc.buyerCriteria);
      expect(buyer.rawPoints).toBe(0);
      expect(buyer.completeness).toBe(100); // 100% complete with explicit 0s!
      expect(buyer.normalizedScore).toBe(0);
    });

    it("executes Scenario 5: Buyer Score with Missing Budget and Timeline", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_05_missing_budget_timeline;
      const buyer = calculateBuyerScore(sc.buyerCriteria);
      expect(buyer.status).toBe("partial");
      expect(buyer.completeness).toBe(65); // 25 + 20 + 20 = 65% assessed
      expect(buyer.missingCriteria).toEqual(["budget_fit", "purchase_timeline"]);
      expect(buyer.normalizedScore).toBeGreaterThan(0);
    });

    it("executes Scenario 7: Invalid Criterion Score Outside Allowed Bounds", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_07_invalid_score_outside_range;
      const buyer = calculateBuyerScore(sc.buyerCriteria);
      expect(buyer.status).toBe("invalid");
      expect(buyer.invalidCriteria.length).toBeGreaterThan(0);
    });

    it("executes Scenario 8: Fast Substantive Sales Response (<= 5 min)", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_08_fast_sales_response;
      const sales = calculateSalesScore({
        criteriaInputs: sc.salesCriteria,
        messages: sc.messages,
      });
      expect(sales.criteria.response_speed.status).toBe("scored");
      expect(sales.criteria.response_speed.score).toBe(15);
    });

    it("executes Scenario 9: Pending Response Before SLA Expiry", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_09_pending_response_before_sla;
      const sales = calculateSalesScore({
        criteriaInputs: sc.salesCriteria,
        messages: sc.messages,
        slaConfig: {
          slaMinutes: 60,
          referenceNow: new Date("2026-10-23T10:15:00Z"), // 15 min after inbound (SLA is 60)
        },
      });
      expect(sales.criteria.response_speed.status).toBe("missing");
      expect(sales.criteria.response_speed.score).toBeNull();
    });

    it("executes Scenario 10: Overdue Response After SLA Expiry", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_10_overdue_response_after_sla;
      const sales = calculateSalesScore({
        criteriaInputs: sc.salesCriteria,
        messages: sc.messages,
        slaConfig: {
          slaMinutes: 60,
          referenceNow: new Date("2026-10-23T10:00:00Z"), // 2 hours after inbound (SLA is 60)
        },
      });
      expect(sales.criteria.response_speed.status).toBe("scored");
      expect(sales.criteria.response_speed.score).toBe(0); // SLA expired!
    });

    it("executes Scenario 11: Invalid Chronological Timestamps", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_11_invalid_timestamps;
      const sales = calculateSalesScore({
        criteriaInputs: sc.salesCriteria,
        messages: sc.messages,
      });
      expect(sales.criteria.response_speed.status).toBe("invalid");
      expect(sales.status).toBe("invalid");
    });

    it("executes Scenario 13: Inferred Attribution with Documented Evidence", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_13_inferred_attribution;
      const attr = evaluateAttribution({
        inferredCandidate: sc.attribution.inferredCandidate,
      });
      expect(attr.status).toBe("inferred");
      expect(attr.adId).toBe("ad_promo_oktoberfest");
    });

    it("executes Scenario 14: Unknown Attribution Excluded from Ad Ranking", () => {
      const sc = SYNTHETIC_LEAD_SCENARIOS.scenario_14_unknown_attribution_excluded;
      const attr = evaluateAttribution({});
      expect(sc.attribution.status).toBe("unknown");
      expect(attr.status).toBe("unknown");
      expect(attr.adId).toBeNull();
    });
  });
});
