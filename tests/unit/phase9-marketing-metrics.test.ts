import { describe, it, expect } from "vitest";
import {
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateCPQL,
  calculateCPQLWithReason,
  calculateQualifiedLeadRate,
  calculateVerifiedAttributionRate,
} from "@/domain/metrics/marketing";

describe("Phase 9 - Deterministic Marketing Metrics & Safe Division", () => {
  describe("calculateCPQLWithReason", () => {
    it("returns calculated CPQL when spend and qualified leads are valid and positive", () => {
      const res = calculateCPQLWithReason(5_000_000, 4);
      expect(res.cpql).toBe(1_250_000);
      expect(res.reason).toBeNull();
    });

    it("returns cpql: null with explanatory reason when qualified leads is 0", () => {
      const res = calculateCPQLWithReason(3_500_000, 0);
      expect(res.cpql).toBeNull();
      expect(res.reason).toContain("Tidak ada qualified leads");
    });

    it("returns cpql: null with explanatory reason when qualified leads is negative or invalid", () => {
      const res1 = calculateCPQLWithReason(3_500_000, -2);
      expect(res1.cpql).toBeNull();
      expect(res1.reason).toContain("tidak valid");

      const res2 = calculateCPQLWithReason(3_500_000, NaN);
      expect(res2.cpql).toBeNull();
      expect(res2.reason).toContain("tidak valid");
    });

    it("returns cpql: null when spend is negative or invalid", () => {
      const res1 = calculateCPQLWithReason(-1_000_000, 2);
      expect(res1.cpql).toBeNull();
      expect(res1.reason).toContain("belanja iklan");

      const res2 = calculateCPQLWithReason(NaN, 2);
      expect(res2.cpql).toBeNull();
      expect(res2.reason).toContain("belanja iklan");
    });
  });

  describe("calculateQualifiedLeadRate", () => {
    it("calculates percentage accurately for valid inputs", () => {
      expect(calculateQualifiedLeadRate(3, 10)).toBe(30);
      expect(calculateQualifiedLeadRate(5, 7)).toBe(71.43);
    });

    it("returns null for zero denominator (0 total leads)", () => {
      expect(calculateQualifiedLeadRate(0, 0)).toBeNull();
      expect(calculateQualifiedLeadRate(2, 0)).toBeNull();
    });

    it("returns null for negative or non-finite inputs", () => {
      expect(calculateQualifiedLeadRate(-1, 10)).toBeNull();
      expect(calculateQualifiedLeadRate(5, -10)).toBeNull();
      expect(calculateQualifiedLeadRate(NaN, 10)).toBeNull();
      expect(calculateQualifiedLeadRate(5, Infinity)).toBeNull();
    });
  });

  describe("calculateVerifiedAttributionRate", () => {
    it("calculates verified percentage correctly", () => {
      expect(calculateVerifiedAttributionRate(8, 10)).toBe(80);
      expect(calculateVerifiedAttributionRate(3, 4)).toBe(75);
    });

    it("returns null for zero denominator without throwing", () => {
      expect(calculateVerifiedAttributionRate(0, 0)).toBeNull();
      expect(calculateVerifiedAttributionRate(5, 0)).toBeNull();
    });

    it("returns null for negative or non-finite inputs", () => {
      expect(calculateVerifiedAttributionRate(-3, 10)).toBeNull();
      expect(calculateVerifiedAttributionRate(3, -10)).toBeNull();
      expect(calculateVerifiedAttributionRate(NaN, 10)).toBeNull();
    });
  });

  describe("Existing metrics regression check", () => {
    it("calculateCTR, CPC, CPM, and CPQL handle zero denominator safely", () => {
      expect(calculateCTR(10, 0)).toBeNull();
      expect(calculateCPC(100_000, 0)).toBeNull();
      expect(calculateCPM(100_000, 0)).toBeNull();
      expect(calculateCPQL(1_000_000, 0)).toBeNull();
    });
  });
});
