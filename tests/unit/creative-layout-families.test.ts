import { describe, it, expect } from "vitest";
import {
  LAYOUT_FAMILIES,
  DESIGN_NICHES,
  resolveDesignNiche,
  getLayoutFamily,
  type LayoutFamilyId,
} from "@/lib/ai/creative-studio/layout-families";
import { buildMuseAdGenerationPrompt, getArchetype } from "@/lib/ai/creative-studio/ad-archetypes";
import { MINIMALIST_ICON_SVG_PATHS, type MinimalistIconId } from "@/components/creative-studio/minimalist-icons";
import { AdCompositionEngine } from "@/lib/ai/creative-studio/composition-engine";
import { AICreativeDirector } from "@/lib/ai/creative-studio/creative-director";
import { CreativeQualityChecker } from "@/lib/ai/creative-studio/quality-checker";
import { CreativeLayoutValidator } from "@/lib/ai/creative-studio/layout-validator";
import { AIVariationsEngine, AIRevisionEngine } from "@/lib/ai/creative-studio/advanced-features";
import type { CreativeBriefInput } from "@/lib/ai/creative-studio/types";

describe("AI Property Ad Studio — Layout Families & Pre-Flight Quality Suite", () => {
  const sampleBrief: CreativeBriefInput = {
    projectName: "Cluster Lavanya Signature",
    campaignName: "Early Bird Launch",
    headline: "Hunian Resort Tropis di Sentul Alaya",
    subheadline: "Private Clubhouse & Pemandangan Gunung Salak",
    propertyType: "Villa Resort",
    propertyLocation: "Sentul, Bogor",
    startingPrice: "Rp 1,8 Miliar",
    buildingArea: "120",
    landArea: "150",
    bedrooms: "4",
    bathrooms: "3",
    hasFreePpn: true,
    dpAmount: "DP 0%",
    ctaText: "Chat WhatsApp Marketing",
    aspectRatio: "4:5",
    stylePreset: "luxury",
    assets: [
      {
        id: "facade-1",
        previewUrl: "https://example.com/facade-lavanya.jpg",
        category: "facade",
        isPrimary: true,
        fileName: "lavanya-facade.jpg",
      },
    ],
  };

  describe("1. Layout Families Token & Architecture Integrity", () => {
    const familyIds: LayoutFamilyId[] = [
      "architectural_editorial",
      "property_brochure",
      "minimalist_modern",
      "premium_investment",
      "direct_response",
      "lifestyle_storytelling",
    ];

    it("should define all 6 distinct layout families with complete configurations", () => {
      for (const id of familyIds) {
        const family = LAYOUT_FAMILIES[id];
        expect(family).toBeDefined();
        expect(family.id).toBe(id);
        expect(family.name).toBeTruthy();
        expect(family.philosophy).toBeTruthy();
        expect(family.typography.fontFamily).toBeTruthy();
        expect(family.imageTreatment.overlayType).toBeTruthy();
        expect(family.colorSystem.accentColor).toBeTruthy();
      }
    });

    it("should fallback gracefully to property_brochure on unknown family id", () => {
      const fallback = getLayoutFamily("non_existent_family");
      expect(fallback.id).toBe("property_brochure");
      expect(fallback.name).toBe("Premium Property Brochure");
    });
  });

  describe("2. Photography-First Deterministic Composition Engine", () => {
    it("should compose layout with explicit layoutFamilyId and clean midpoint specs", () => {
      const strategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "luxury");
      const layout = AdCompositionEngine.composeAd(
        sampleBrief,
        strategy,
        "https://example.com/facade-lavanya.jpg",
        "4:5",
        "architectural_editorial"
      );

      expect(layout.layoutFamilyId).toBe("architectural_editorial");
      expect(layout.backgroundUrl).toBe("https://example.com/facade-lavanya.jpg");
      expect(layout.headline.text).toBe("Hunian Resort Tropis di Sentul Alaya");
      expect(layout.priceBadge?.rawPrice).toBe("Rp 1,8 Miliar");

      // Verify clean midpoint bullets in specs
      const specString = layout.specsPills.join(" • ");
      expect(specString).toContain("4 KT • 3 KM • LB 120 m² • LT 150 m²");

      // Verify promo badges are capped to prevent visual clutter
      expect(layout.promoBadges.length).toBeLessThanOrEqual(2);
    });

    it("should format large integer rupiah values into readable Indonesian phrases", () => {
      const briefWithNumericPrice: CreativeBriefInput = {
        ...sampleBrief,
        startingPrice: "850000000",
      };
      const strategy = AICreativeDirector.planCreativeStrategy(briefWithNumericPrice, "4:5", "luxury");
      const layout = AdCompositionEngine.composeAd(
        briefWithNumericPrice,
        strategy,
        "https://example.com/photo.jpg",
        "4:5"
      );

      expect(layout.priceBadge?.rawPrice).toBe("Rp 850 Juta");
    });
  });

  describe("3. Objective Pre-Flight Quality Assurance Engine", () => {
    it("should pass all quality checks for a well-formed creative layout", () => {
      const strategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "luxury");
      const layout = AdCompositionEngine.composeAd(
        sampleBrief,
        strategy,
        "https://example.com/facade-lavanya.jpg",
        "4:5",
        "property_brochure"
      );

      const report = CreativeQualityChecker.evaluateLayout(layout, "4:5", true);

      expect(report.overallStatus).toBe("excellent");
      expect(report.overallScore).toBeGreaterThanOrEqual(85);
      expect(report.passedChecksCount).toBe(report.totalChecksCount);

      // Verify all 6 check ids passed
      const checkIds = report.checks.map((c) => c.id);
      expect(checkIds).toContain("text_overflow");
      expect(checkIds).toContain("currency_formatting");
      expect(checkIds).toContain("image_fidelity");
      expect(checkIds).toContain("safe_zone_compliance");
      expect(checkIds).toContain("cta_actionability");
      expect(checkIds).toContain("badge_density");
    });

    it("should detect headline overflow and flag actionable warning", () => {
      const longHeadline = "Kawasan Hunian Paling Megah Di Seluruh Jabodetabek Dengan Fasilitas Bintang Enam Terlengkap";
      const briefWithLongHeadline: CreativeBriefInput = {
        ...sampleBrief,
        headline: longHeadline,
      };

      const strategy = AICreativeDirector.planCreativeStrategy(briefWithLongHeadline, "1:1", "luxury");
      const layout = AdCompositionEngine.composeAd(
        briefWithLongHeadline,
        strategy,
        "https://example.com/photo.jpg",
        "1:1"
      );

      const report = CreativeQualityChecker.evaluateLayout(layout, "1:1", true);

      const overflowCheck = report.checks.find((c) => c.id === "text_overflow");
      expect(overflowCheck?.passed).toBe(false);
      expect(overflowCheck?.severity).toBe("warning");
      expect(report.actionableTips.some((t) => t.includes("headline"))).toBe(true);
    });

    it("should flag error when original property photo is absent", () => {
      const strategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "luxury");
      const layout = AdCompositionEngine.composeAd(
        sampleBrief,
        strategy,
        "https://example.com/photo.jpg",
        "4:5"
      );

      // Passing hasReferenceImage = false
      const report = CreativeQualityChecker.evaluateLayout(layout, "4:5", false);
      const imageCheck = report.checks.find((c) => c.id === "image_fidelity");
      expect(imageCheck?.passed).toBe(false);
      expect(imageCheck?.severity).toBe("error");
    });
  });

  describe("4. Multi-Variant Engine Distinct Layout Families", () => {
    it("should generate 3 genuinely distinct layout families across variations", () => {
      const variations = AIVariationsEngine.generateVariations(
        sampleBrief,
        "https://example.com/facade.jpg",
        "4:5",
        "test-gen-id"
      );

      expect(variations).toHaveLength(3);

      expect(variations[0].layoutFamilyId).toBe("direct_response");
      expect(variations[0].stylePreset).toBe("high_conversion");

      // Variation B: Official Corporate Brochure
      expect(variations[1].layoutFamilyId).toBe("property_brochure");
      expect(variations[1].stylePreset).toBe("corporate");

      // Variation C: Direct Response Meta Ads Performance
      expect(variations[2].layoutFamilyId).toBe("architectural_editorial");
      expect(variations[2].stylePreset).toBe("editorial");
    });
  });

  describe("5. Targeted Natural Language Revisions for Layout Families", () => {
    it("should shift layout family to architectural_editorial upon user request", () => {
      const currentStrategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "corporate");
      const revision = AIRevisionEngine.applyRevision(
        currentStrategy,
        sampleBrief,
        "Ubah tata letak ke gaya editorial majalah arsitektur"
      );

      expect(revision.targetLayoutFamilyId).toBe("architectural_editorial");
      expect(revision.appliedChangesNote).toContain("Architectural Editorial");
    });

    it("should shift layout family to minimalist_modern when requested", () => {
      const currentStrategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "luxury");
      const revision = AIRevisionEngine.applyRevision(
        currentStrategy,
        sampleBrief,
        "Tolong buat desain lebih minimalis bersih tanpa banyak ornamen"
      );

      expect(revision.targetLayoutFamilyId).toBe("minimalist_modern");
      expect(revision.appliedChangesNote).toContain("Minimalist Modern");
    });

    it("should reduce badges and declutter layout when requested", () => {
      const currentStrategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "luxury");
      const revision = AIRevisionEngine.applyRevision(
        currentStrategy,
        sampleBrief,
        "Kurangi badge promo agar foto rumah lebih menonjol"
      );

      expect(revision.appliedChangesNote).toContain("badge");
    });
  });

  describe("6. Hard Layout Constraints & Text Fitting Engine", () => {
    it("should dynamically fit long CTA text without overflowing canvas boundaries", () => {
      const maxRight = 1080 - 72; // 1008px
      const ctaFit = CreativeLayoutValidator.calculateFittedCta(
        "Chat WhatsApp Marketing Sekarang Juga",
        maxRight,
        1250,
        (text, fontSize) => text.length * fontSize * 0.6,
        { maxAvailableWidth: 420, baseFontSize: 22, height: 56 }
      );

      expect(ctaFit.buttonWidth).toBeLessThanOrEqual(420);
      expect(ctaFit.x).toBeGreaterThanOrEqual(72);
      expect(ctaFit.x + ctaFit.buttonWidth).toBeLessThanOrEqual(maxRight);
      expect(ctaFit.text).toContain("CHAT WHATSAPP MARKETING");
    });

    it("should strictly strip emojis from strings to maintain professional design standards", () => {
      const textWithEmojis = "📍 Sentul, Bogor 🛏️ 4 KT 🚿 3 KM 📐 LB 120m² 💬 WhatsApp";
      const stripped = CreativeLayoutValidator.stripEmojis(textWithEmojis);

      expect(stripped).not.toContain("📍");
      expect(stripped).not.toContain("🛏️");
      expect(stripped).not.toContain("🚿");
      expect(stripped).not.toContain("📐");
      expect(stripped).not.toContain("💬");
      expect(stripped).toBe("Sentul, Bogor 4 KT 3 KM LB 120m² WhatsApp");
    });

    it("should detect element collisions and boundary violations", () => {
      const invalidElements = [
        { id: "cta_button", x: 1020, y: 1200, width: 100, height: 50 }, // 1020 + 100 = 1120 > 1008 (Breach)
        { id: "box1", x: 100, y: 100, width: 200, height: 100 },
        { id: "box2", x: 150, y: 120, width: 200, height: 100 }, // Overlaps with box1
      ];

      const validation = CreativeLayoutValidator.validateElements(invalidElements, "4:5");

      expect(validation.isValid).toBe(false);
      expect(validation.violations.some((v) => v.type === "BOUNDARY_OVERFLOW")).toBe(true);
      expect(validation.violations.some((v) => v.type === "COLLISION")).toBe(true);
    });
  });

  describe("7. Six Architectural Design Niches & Non-Cropping Guardrails", () => {
    it("should resolve all 5 concrete Design Niches, canonical IDs, and auto_director smart match", () => {
      const canonicalIds = [
        "niche_minimalist",
        "niche_modern_catalog",
        "niche_promo_conversion",
        "niche_creative_dock",
        "niche_tropical_luxury",
      ] as const;

      for (const id of canonicalIds) {
        const niche = resolveDesignNiche(id);
        expect(niche.id).toBe(id);
        expect(niche.canonicalId).toBe(id);
        expect(niche.skyTone).toBeTruthy();
        expect(niche.groundTone).toBeTruthy();
        expect(niche.palette.cardBg).toBeTruthy();
        expect(niche.palette.priceColor).toBeTruthy();
        expect(niche.palette.ctaBg).toBeTruthy();
        expect(niche.skyMoodPrompt).toBeTruthy();
      }

      const autoTropical = resolveDesignNiche("auto_director", {
        propertyType: "Villa Resort",
      });
      expect(autoTropical.canonicalId).toBe("niche_tropical_luxury");

      const autoDirect = resolveDesignNiche("auto_director", {
        propertyType: "Rumah Tinggal",
        hasFreePpn: true,
        dpAmount: "DP 0%",
      });
      expect(autoDirect.canonicalId).toBe("niche_promo_conversion");
    });

    it("should define all 12 thin-line architectural vector icons without emojis", () => {
      const requiredIcons: MinimalistIconId[] = [
        "icon_lt",
        "icon_lb",
        "icon_floors",
        "icon_bed",
        "icon_bath",
        "icon_carport",
        "icon_living",
        "icon_kitchen",
        "icon_compass",
        "icon_pin",
        "icon_shield",
        "icon_whatsapp",
      ];
      for (const iconId of requiredIcons) {
        expect(MINIMALIST_ICON_SVG_PATHS[iconId]).toBeDefined();
        expect(MINIMALIST_ICON_SVG_PATHS[iconId].length).toBeGreaterThan(0);
      }
    });

    it("should enforce the Strict Architectural Preservation Protocol & Non-Cropping Rules in Muse prompt builder", () => {
      const prompt = buildMuseAdGenerationPrompt({
        archetype: getArchetype("niche_minimalist"),
        aspectRatio: "9:16",
        projectName: "Lavanya Hills",
        propertyType: "Rumah 2 Lantai",
        propertyLocation: "BSD City",
        startingPrice: "Rp 850 Juta",
        promoText: "DP 0% & Free PPN",
        headline: "Hunian Minimalis Japandi di BSD City",
        hasReferenceImage: true,
      });

      expect(prompt).toContain("[STRICT ARCHITECTURAL PRESERVATION PROTOCOL]");
      expect(prompt).toContain("1. LOCK 100% OF THE BUILDING GEOMETRY");
      expect(prompt).toContain("2. EXTEND SKY & FOREGROUND ONLY");
      expect(prompt).toContain("STRICT RULES FOR IMAGE GENERATION:");
      expect(prompt).toContain("2. NO CROPPING: Fit the full width of the house cleanly inside the 9:16 frame.");
    });
  });
});

