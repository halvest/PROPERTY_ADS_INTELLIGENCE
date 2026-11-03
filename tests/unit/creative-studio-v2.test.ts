import { describe, expect, it } from "vitest";
import { NaturalLanguageBriefParser } from "@/lib/ai/creative-studio/brief-parser";
import { AIVariationsEngine, AIRevisionEngine } from "@/lib/ai/creative-studio/advanced-features";
import { CreativeQualityChecker } from "@/lib/ai/creative-studio/quality-checker";
import { CreativeLayoutValidator } from "@/lib/ai/creative-studio/layout-validator";
import { AdCompositionEngine } from "@/lib/ai/creative-studio/composition-engine";
import { AICreativeDirector } from "@/lib/ai/creative-studio/creative-director";
import type { CreativeBriefInput } from "@/lib/ai/creative-studio/types";

const SAMPLE = "Buatkan iklan rumah modern 2 lantai di BSD City, Tangerang Selatan. Harga mulai Rp850 juta. DP 0% dan Bebas PPN. 3 Kamar Tidur, 2 Kamar Mandi, LB 85m2, LT 72m2. Dekat akses tol dan stasiun. Target keluarga muda.";

describe("creative studio brief intelligence", () => {
  it("extracts both promos and location advantages without a fake project name", () => {
    const brief = NaturalLanguageBriefParser.parse(SAMPLE);
    expect(brief.projectName).toBe("");
    expect(brief.hasExplicitProjectName).toBe(false);
    expect(brief.projectName).not.toContain("Exclusive Residence");
    expect(brief.propertyType).toBe("Rumah Modern 2 Lantai");
    expect(brief.propertyLocation).toBe("BSD City, Tangerang Selatan");
    expect(brief.startingPrice).toBe("Rp 850 Juta");
    expect(brief.bedrooms).toBe("3");
    expect(brief.bathrooms).toBe("2");
    expect(brief.buildingArea).toBe("85");
    expect(brief.landArea).toBe("72");
    expect(brief.targetAudience).toBe("keluarga muda");
    expect(brief.promos).toEqual(expect.arrayContaining(["DP 0%", "FREE PPN 100%"]));
    expect(brief.promoHeadline).toContain("DP 0%");
    expect(brief.promoHeadline).toContain("FREE PPN 100%");
    expect(brief.locationAdvantages).toEqual(expect.arrayContaining(["Dekat Akses Tol", "Dekat Stasiun"]));
    expect(brief.headline).toBe("Rumah Modern 2 Lantai");
  });
});

describe("creative studio variations", () => {
  it("gives A, B, and C different headlines and layout families", () => {
    const brief = NaturalLanguageBriefParser.parse(SAMPLE);
    const variations = AIVariationsEngine.generateVariations(brief, "https://example.com/house.jpg", "4:5", "gen-1");
    const headlines = variations.map((item) => item.headline);
    expect(new Set(headlines).size).toBe(3);
    expect(variations.map((item) => item.layoutFamilyId)).toEqual([
      "direct_response",
      "property_brochure",
      "architectural_editorial",
    ]);
    expect(headlines.join(" ")).not.toMatch(/Klaim Promo Spesial Launching/i);
  });
});

describe("revision intent router", () => {
  it("keeps style and copy edits off the image model", () => {
    expect(AIRevisionEngine.classifyIntent("Nuansa Emas & Mewah (Luxury)")).toBe("style_layout");
    expect(AIRevisionEngine.classifyIntent("Aksen Hijau Zamrud (Emerald Green)")).toBe("style_layout");
    expect(AIRevisionEngine.classifyIntent("Pertebal dan Perbesar Headline")).toBe("style_layout");
    expect(AIRevisionEngine.classifyIntent("ubah headline menjadi Rumah Siap Huni di BSD")).toBe("copy");
    expect(AIRevisionEngine.classifyIntent("ubah langit menjadi golden hour")).toBe("image");
  });
});

describe("layout validator and quality gate", () => {
  it("fits the CTA inside the right margin", () => {
    const fit = CreativeLayoutValidator.calculateFittedCta(
      "Chat WhatsApp",
      1000,
      900,
      (text) => text.length * 12,
      { maxAvailableWidth: 280 }
    );
    expect(fit.x + fit.buttonWidth).toBeLessThanOrEqual(1000);
  });

  it("warns when a required promo is missing from the canvas", () => {
    const brief = {
      ...NaturalLanguageBriefParser.parse(SAMPLE),
      promos: ["DP 0%"],
      projectName: "BSD House",
      assets: [],
    } satisfies CreativeBriefInput;
    const strategy = AICreativeDirector.planCreativeStrategy(brief, "4:5", "high_conversion");
    const layout = AdCompositionEngine.composeAd(brief, strategy, "https://example.com/house.jpg", "4:5");
    layout.promoPills = [];
    layout.promoBadges = [];
    const report = CreativeQualityChecker.evaluateLayout(layout, "4:5", true, { promos: ["DP 0%"] });
    const entity = report.checks.find((check) => check.id === "entity_completeness");
    expect(entity?.passed).toBe(false);
    expect(report.overallScore).toBeLessThan(100);
  });
});
