import { describe, it, expect } from "vitest";
import { CreativeBriefSchema } from "@/lib/ai/creative-studio/types";
import { AICreativeDirector } from "@/lib/ai/creative-studio/creative-director";
import { AdCompositionEngine } from "@/lib/ai/creative-studio/composition-engine";
import { AIRevisionEngine, AIVariationsEngine } from "@/lib/ai/creative-studio/advanced-features";
import { MuseImageProvider } from "@/lib/ai/creative-studio/muse-provider";
import type { CreativeBriefInput } from "@/lib/ai/creative-studio/types";

describe("AI Property Ad Creative Studio — Engine Suite", () => {
  const sampleBrief: CreativeBriefInput = {
    projectName: "Grand Harmoni Residence",
    campaignName: "Launching Phase 1",
    headline: "Hunian Modern 2 Lantai di BSD City",
    subheadline: "5 Menit ke Gerbang Tol & Stasiun Intermoda",
    description: "Rumah idaman keluarga modern dengan fasilitas clubhouse dan danau alami.",
    propertyType: "Rumah Tinggal",
    propertyLocation: "BSD City, Tangerang Selatan",
    startingPrice: "Rp 850.000.000",
    landArea: "72",
    buildingArea: "85",
    bedrooms: "3",
    bathrooms: "2",
    floors: "2",
    promoHeadline: "Special Launching: Free PPN & DP 0%",
    cashback: "Rp 50.000.000",
    hasFreePpn: true,
    dpAmount: "DP 0%",
    monthlyInstallment: "Rp 4.500.000",
    kprRate: "2.75%",
    promoDeadline: "31 Desember 2026",
    ctaText: "Klaim Promo WhatsApp",
    aspectRatio: "4:5",
    stylePreset: "luxury",
    assets: [
      {
        id: "asset-1",
        previewUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
        category: "facade",
        isPrimary: true,
        fileName: "facade-modern.jpg",
      },
    ],
  };

  describe("1. Creative Brief Schema Validation", () => {
    it("should successfully parse a complete valid brief", () => {
      const parsed = CreativeBriefSchema.safeParse(sampleBrief);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.projectName).toBe("Grand Harmoni Residence");
        expect(parsed.data.aspectRatio).toBe("4:5");
        expect(parsed.data.hasFreePpn).toBe(true);
      }
    });

    it("accepts an empty project name so the canvas does not invent a brand", () => {
      const unnamed = { ...sampleBrief, projectName: "" };
      const parsed = CreativeBriefSchema.safeParse(unnamed);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.projectName).toBe("");
    });

    it("should fallback default values when optional fields are omitted", () => {
      const minimalBrief = {
        projectName: "Green Valley Cluster",
      };
      const parsed = CreativeBriefSchema.safeParse(minimalBrief);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.aspectRatio).toBe("4:5");
        expect(parsed.data.stylePreset).toBe("high_conversion");
        expect(parsed.data.assets).toEqual([]);
      }
    });
  });

  describe("2. AI Creative Director Engine", () => {
    it("should plan comprehensive creative strategy with luxury art direction", () => {
      const strategy = AICreativeDirector.planCreativeStrategy(
        sampleBrief,
        "4:5",
        "luxury"
      );

      expect(strategy).toBeDefined();
      expect(strategy.colorPalette.accent).toBe("#D4AF37"); // Gold accent for luxury
      expect(strategy.typography.fontFamily).toContain("Playfair Display");
      expect(strategy.imagePrompt).toContain("Grand Harmoni Residence");
    });

    it("should configure high_conversion style preset with optimal badge positioning", () => {
      const strategy = AICreativeDirector.planCreativeStrategy(
        sampleBrief,
        "1:1",
        "high_conversion"
      );

      expect(strategy.colorPalette.accent).toBe("#F59E0B"); // High-visibility Amber/Gold
      expect(strategy.priceBadgePosition).toBe("hero-overlay");
    });

    it("should evaluate quality score accurately based on brief elements", () => {
      const score = AICreativeDirector.evaluateQualityScore(sampleBrief);

      expect(score.overall).toBeGreaterThanOrEqual(80);
      expect(score.visual).toBeGreaterThanOrEqual(75);
      expect(score.readability).toBeGreaterThanOrEqual(85);
      expect(score.conversion).toBeGreaterThanOrEqual(85);
      expect(score.assessmentNotes.length).toBeGreaterThan(0);
    });
  });

  describe("3. Hybrid Typography & Composition Engine", () => {
    it("should compose ad layout with formatted Rupiah price and promo pills", () => {
      const strategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "luxury");
      const layout = AdCompositionEngine.composeAd(
        sampleBrief,
        strategy,
        "https://example.com/photo.jpg",
        "4:5"
      );

      expect(layout.headline.text).toBe("Hunian Modern 2 Lantai di BSD City");
      expect(layout.backgroundUrl).toBe("https://example.com/photo.jpg");
      expect(layout.backgroundImageUrl).toBe("https://example.com/photo.jpg");
      expect(layout.priceBadge?.rawPrice).toContain("850");
      expect(layout.callToAction.text).toBe("Klaim Promo WhatsApp");

      // Verify promo badges include DP 0% and Free PPN
      const badgeTexts = layout.promoBadges.map((b) => b.text);
      expect(badgeTexts).toContain("FREE PPN 100%");
      expect(badgeTexts).toContain("DP 0%");
    });

    it("should respect vertical 9:16 safe zones for stories and reels", () => {
      const strategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "9:16", "luxury");
      const layout = AdCompositionEngine.composeAd(
        sampleBrief,
        strategy,
        "https://example.com/photo.jpg",
        "9:16"
      );

      expect(layout.safeZoneOverlay?.topClearancePercent).toBe(15);
      expect(layout.safeZoneOverlay?.bottomClearancePercent).toBe(20);
    });
  });

  describe("4. Natural Language AI Revision Engine", () => {
    it("should update color palette to emerald green when requested", () => {
      const currentStrategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "luxury");
      const revision = AIRevisionEngine.applyRevision(
        currentStrategy,
        sampleBrief,
        "Tolong ubah warna aksen menjadi emerald green"
      );

      expect(revision.updatedStrategy.colorPalette.accent).toBe("#10B981");
      expect(revision.appliedChangesNote).toContain("Emerald Green");
    });

    it("should update headline weight when user asks to make headline bold", () => {
      const currentStrategy = AICreativeDirector.planCreativeStrategy(sampleBrief, "4:5", "minimalist");
      const revision = AIRevisionEngine.applyRevision(
        currentStrategy,
        sampleBrief,
        "Buat judul headline lebih besar dan dominan"
      );

      expect(revision.updatedStrategy.typography.headlineWeight).toBe("900");
      expect(revision.appliedChangesNote).toContain("headline");
    });
  });

  describe("5. A/B/C Multi-Variant Engine", () => {
    it("should generate 3 distinct art-directed variations for the project", () => {
      const variations = AIVariationsEngine.generateVariations(
        sampleBrief,
        "https://example.com/base.jpg",
        "4:5",
        "gen-test-123"
      );

      expect(variations).toHaveLength(3);
      expect(variations[0].stylePreset).toBe("high_conversion");
      expect(variations[0].layoutFamilyId).toBe("direct_response");
      expect(variations[1].stylePreset).toBe("corporate");
      expect(variations[1].layoutFamilyId).toBe("property_brochure");
      expect(variations[2].stylePreset).toBe("editorial");
      expect(variations[2].layoutFamilyId).toBe("architectural_editorial");
      expect(new Set(variations.map((item) => item.headline)).size).toBe(3);
      expect(variations[0].generationId).toBe("gen-test-123");
    });
  });

  describe("6. Meta Muse Image 1.0 Provider", () => {
    it("should define muse-image-1.0 as the primary model constant", () => {
      expect(MuseImageProvider.MODEL_NAME).toBe("muse-image-1.0");
    });

    it("should execute image generation and return resilient fallback when needed", async () => {
      const result = await MuseImageProvider.generateImage({
        prompt: "Modern tropical villa facade in Ubud, Bali",
        aspectRatio: "4:5",
        referenceImageUrl: "https://example.com/ubud-villa.jpg",
      });

      expect(result.imageUrl).toBeTruthy();
      expect(result.provider).toMatch(/muse_image_api|property_fidelity_engine/);
      expect(result.modelUsed).toMatch(/muse-image-1.0|muse-image-fidelity/);
    });

    it("should preserve reference image when reference is provided in fallback mode", async () => {
      const result = await MuseImageProvider.generateImage({
        prompt: "Cluster residential house",
        aspectRatio: "1:1",
        referenceImageUrl: "https://example.com/uploaded-house.jpg",
      });

      if (result.isFallback) {
        expect(result.imageUrl).toBe("https://example.com/uploaded-house.jpg");
      }
    });
  });
});
