import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { classifyResult } from "@/lib/ads/service";
import { AnalyzePerformanceRequestSchema, normalizeIndonesianLlmCopy } from "@/app/api/ai/analyze-performance/route";

describe("AI Ads Performance Analyst & Data Recovery Audit", () => {
  describe("1. classifyResult Nomenclature & Fallback Rules", () => {
    it("never produces obsolete '(jenis tidak tersedia)' string", () => {
      const res1 = classifyResult(45, [], null);
      expect(res1.resultLabel).toBe("Hasil");
      expect(res1.resultTypeDescription).toBeNull();
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

  it("normalizes rupiah spacing and english percent decimals", () => {
    expect(normalizeIndonesianLlmCopy("Belanja Rp 150.000 dengan CTR 1.25%.")).toBe("Belanja Rp150.000 dengan CTR 1,25%.");
  });

  describe("4. Prompt Separation & JSON Schema Disambiguation (P0 Fix)", () => {
    it("ensures PAGE_ANALYST_SYSTEM_PROMPT has pure ModelResponseSchema and no CTWA root schema", async () => {
      const { PAGE_ANALYST_SYSTEM_PROMPT } = await import("@/lib/ai/ctwa-analysis/prompt");
      // Must contain verdict at root schema
      expect(PAGE_ANALYST_SYSTEM_PROMPT.includes('"verdict": {')).toBe(true);
      expect(PAGE_ANALYST_SYSTEM_PROMPT.includes('"watchouts": [')).toBe(true);
      expect(PAGE_ANALYST_SYSTEM_PROMPT.includes('"actions": [')).toBe(true);

      // Must NOT ask for CTWA root fields in its output JSON
      expect(PAGE_ANALYST_SYSTEM_PROMPT.includes('"buyer_intent_score":')).toBe(false);
      expect(PAGE_ANALYST_SYSTEM_PROMPT.includes('"buyer_score_breakdown":')).toBe(false);
      expect(PAGE_ANALYST_SYSTEM_PROMPT.includes('"chain_of_thought":')).toBe(false);
    });

    it("verifies route.ts uses PAGE_ANALYST_SYSTEM_PROMPT without prepending CTWA_SYSTEM_PROMPT", () => {
      const routePath = path.resolve(
        import.meta.dirname,
        "../../src/app/api/ai/analyze-performance/route.ts"
      );
      const content = fs.readFileSync(routePath, "utf-8");

      expect(content.includes("const systemPrompt = PAGE_ANALYST_SYSTEM_PROMPT;")).toBe(true);
      expect(content.includes("${CTWA_SYSTEM_PROMPT}")).toBe(false);
    });
  });

  describe("5. False-Positive Regex & Quota Integrity (P1 Fix)", () => {
    it("does not falsely trigger reach ban on ordinary Indonesian words like 'menjangkau' or 'jangkauan promosi'", () => {
      const safeText = "Iklan ini efektif memperluas jangkauan promosi perumahan untuk menjangkau keluarga muda.";
      const falsePositiveRegex = /(?:reach|jangkauan)\s*(?:sebesar|mencapai|sebanyak|sekitar)?\s*[\d.,]+/i;
      expect(falsePositiveRegex.test(safeText)).toBe(false);

      const hallucinatedText = "Iklan ini memiliki jangkauan sebesar 15.000 orang.";
      expect(falsePositiveRegex.test(hallucinatedText)).toBe(true);
    });

    it("does not falsely trigger English sentence ban on English property names in Indonesian sentences", () => {
      const mixedText = "Kampanye The Green Residence with Garden from Citra Developer menunjukkan performa biaya per hasil yang stabil.";
      const sentenceRegex = /\b(we recommend to|you should|in order to|as a result of|based on the data|the campaign is|this ad has|scale the budget)\b/i;
      expect(sentenceRegex.test(mixedText)).toBe(false);

      const englishSentence = "We recommend to scale the budget because results are performing well.";
      expect(sentenceRegex.test(englishSentence)).toBe(true);
    });

    it("verifies UI renders 4 metric cards unconditionally on account scope", () => {
      const analystPath = path.resolve(
        import.meta.dirname,
        "../../src/components/dashboard/AIAdsPerformanceAnalyst.tsx"
      );
      const content = fs.readFileSync(analystPath, "utf-8");

      // Grid of 4 cards must not be gated by scope !== "account"
      const metricBlockIndex = content.indexOf("BLOK 2 — METRIK UTAMA");
      expect(metricBlockIndex).toBeGreaterThan(-1);
      const snippet = content.slice(metricBlockIndex, metricBlockIndex + 300);
      expect(snippet.includes('scope !== "account"')).toBe(false);
    });
  });
});
