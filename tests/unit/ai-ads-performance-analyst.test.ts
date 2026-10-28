import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { classifyResult } from "@/lib/ads/service";
import { AnalyzePerformanceRequestSchema } from "@/app/api/ai/analyze-performance/route";

describe("AI Ads Performance Analyst & Data Recovery Audit", () => {
  describe("1. classifyResult Nomenclature & Fallback Rules", () => {
    it("never produces obsolete '(jenis tidak tersedia)' string", () => {
      const res1 = classifyResult(45, [], null);
      expect(res1.resultLabel).toBe("Hasil");
      expect(res1.resultTypeDescription).toBe("Jenis hasil belum teridentifikasi");
      expect(JSON.stringify(res1).includes("jenis tidak tersedia")).toBe(false);

      const res2 = classifyResult(0, ["unknown_action"], undefined);
      expect(JSON.stringify(res2).includes("jenis tidak tersedia")).toBe(false);
    });

    it("correctly identifies Leads for OUTCOME_LEADS or leadgen actions", () => {
      const res = classifyResult(20, ["leadgen_grouped"], "OUTCOME_LEADS");
      expect(res.resultLabel).toBe("Leads");
      expect(res.isLeads).toBe(true);
      expect(res.resultTypeDescription).toContain("Leads");
    });

    it("correctly identifies Percakapan for messaging actions", () => {
      const res = classifyResult(15, ["onsite_conversion.messaging_conversation_started_7d"], "MESSAGES");
      expect(res.resultLabel).toBe("Percakapan");
      expect(res.isConversation).toBe(true);
      expect(res.resultTypeDescription).toContain("Percakapan");
    });

    it("correctly identifies Hasil for Sales / Purchase campaigns without fabricating leads", () => {
      const res = classifyResult(45, ["omni_purchase"], "OUTCOME_SALES");
      expect(res.resultLabel).toBe("Hasil");
      expect(res.isLeads).toBe(false);
      expect(res.resultTypeDescription).toContain("Sales");
    });
  });

  describe("2. Security & Request Validation Schema", () => {
    it("validates scope, period, targetId, and optional targetCpr with strict zod schema", () => {
      const validPayload = {
        scope: "campaign",
        period: "weekly",
        targetId: "cmp-12345",
        targetCpr: 50000,
      };
      const parsed = AnalyzePerformanceRequestSchema.parse(validPayload);
      expect(parsed.scope).toBe("campaign");
      expect(parsed.period).toBe("weekly");
      expect(parsed.targetId).toBe("cmp-12345");
      expect(parsed.targetCpr).toBe(50000);
    });

    it("rejects invalid scopes or negative targetCpr", () => {
      const invalidPayload = {
        scope: "admin_hack",
        period: "yearly",
      };
      expect(() => AnalyzePerformanceRequestSchema.parse(invalidPayload)).toThrow();

      const negativeCpr = {
        scope: "account",
        targetCpr: -100,
      };
      expect(() => AnalyzePerformanceRequestSchema.parse(negativeCpr)).toThrow();
    });
  });

  describe("3. Static Guard: No Auto-Trigger & Strict Separation", () => {
    it("verifies AIAdsPerformanceAnalyst.tsx has concurrency guard and no useEffect auto-call", () => {
      const analystPath = path.resolve(
        import.meta.dirname,
        "../../src/components/dashboard/AIAdsPerformanceAnalyst.tsx"
      );
      const content = fs.readFileSync(analystPath, "utf-8");

      // Must have concurrency guard ref
      expect(content.includes("isAnalyzingRef")).toBe(true);

      // Must NOT call runPerformanceAnalysis automatically in a useEffect
      const autoTriggerRegex = /useEffect\(\(\)\s*=>\s*{[\s\S]*?runPerformanceAnalysis\(\)[\s\S]*?}/;
      expect(autoTriggerRegex.test(content)).toBe(false);

      // Must render manual button
      expect(content.includes("Analisis Performa")).toBe(true);
      expect(content.includes("Analisis Ulang")).toBe(true);
    });

    it("verifies /ads page does not contain chat conversation transcript analysis", () => {
      const adsPagePath = path.resolve(
        import.meta.dirname,
        "../../src/app/(dashboard)/ads/page.tsx"
      );
      const content = fs.readFileSync(adsPagePath, "utf-8");

      expect(content.includes("extract-evidence")).toBe(false);
      expect(content.includes("buyerScore")).toBe(false);
      expect(content.includes("transkrip")).toBe(false);
    });
  });
});
