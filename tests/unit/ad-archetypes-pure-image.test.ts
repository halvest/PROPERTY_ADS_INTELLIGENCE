import { describe, it, expect } from "vitest";
import {
  AD_ARCHETYPES,
  ARCHETYPE_LIST,
  getArchetype,
  inferArchetypeFromBrief,
  buildMuseAdGenerationPrompt,
} from "@/lib/ai/creative-studio/ad-archetypes";
import { AdPosterSynthesizer } from "@/lib/ai/creative-studio/ad-poster-synthesizer";

describe("Ad Archetypes & Pure Image Generation Engine", () => {
  it("should define all 5 real-world Indonesian property ad archetypes", () => {
    expect(ARCHETYPE_LIST.length).toBe(5);
    expect(AD_ARCHETYPES.emerald_minimalist).toBeDefined();
    expect(AD_ARCHETYPES.luxury_architecture).toBeDefined();
    expect(AD_ARCHETYPES.royal_navy_metro).toBeDefined();
    expect(AD_ARCHETYPES.golden_aurora_wave).toBeDefined();
    expect(AD_ARCHETYPES.kaba_direct_offer).toBeDefined();

    // Verify key design elements from training reference flyers
    expect(AD_ARCHETYPES.emerald_minimalist.palette.primary).toBe("#064E3B");
    expect(AD_ARCHETYPES.luxury_architecture.palette.accent).toBe("#D4AF37");
    expect(AD_ARCHETYPES.royal_navy_metro.palette.primary).toBe("#0F172A");
    expect(AD_ARCHETYPES.golden_aurora_wave.palette.accentGold).toBe("#FBBF24");
    expect(AD_ARCHETYPES.kaba_direct_offer.palette.primary).toBe("#14532D");
  });

  it("should infer appropriate archetype based on commercial brief", () => {
    // DP Promo -> Kaba Direct Offer
    const dpBrief = { dpAmount: "DP Cuman 3 Juta", projectName: "Cluster Serasi" };
    expect(inferArchetypeFromBrief(dpBrief).id).toBe("kaba_direct_offer");

    // Luxury Villa (>2 Miliar) -> Garis Bumi Luxury Architecture
    const luxuryBrief = { startingPrice: "Rp 3.500.000.000", projectName: "Villa Royal Hills" };
    expect(inferArchetypeFromBrief(luxuryBrief).id).toBe("luxury_architecture");

    // Elite Regency -> Metro Regency
    const metroBrief = { projectName: "Metro Regency Cluster", startingPrice: "Rp 900 Juta" };
    expect(inferArchetypeFromBrief(metroBrief).id).toBe("royal_navy_metro");

    // Affordable starter (<600 Juta) -> Golden Aurora Wave
    const starterBrief = { startingPrice: "Rp 340 Juta", projectName: "Aurora Green" };
    expect(inferArchetypeFromBrief(starterBrief).id).toBe("golden_aurora_wave");
  });

  it("should construct full-image ad generation prompt for Meta Muse Image 1.0", () => {
    const prompt = buildMuseAdGenerationPrompt({
      archetype: AD_ARCHETYPES.golden_aurora_wave,
      aspectRatio: "4:5",
      projectName: "Golden Aurora",
      propertyType: "Rumah Type 36/60",
      propertyLocation: "Purworejo",
      startingPrice: "340 JUTA",
      promoText: "Harga Mulai 340 Juta",
      contactNumber: "0857-9797-5252",
    });

    expect(prompt).toContain("Golden Aurora");
    expect(prompt).toContain("340 JUTA");
    expect(prompt).toContain("0857-9797-5252");
    expect(prompt).toContain("commercial real estate advertisement poster");
    expect(prompt).toContain("ATURAN ANTI-HALUSINASI KETAT");
    expect(prompt).not.toContain("no text rendered inside the photo");
  });

  it("should enforce zero hallucination when optional fields like contactNumber or startingPrice are omitted", () => {
    const promptWithoutOptional = buildMuseAdGenerationPrompt({
      archetype: AD_ARCHETYPES.emerald_minimalist,
      aspectRatio: "9:16",
      projectName: "Lavanya Hills",
      propertyLocation: "Bandung Timur",
      ctaText: "Jadwalkan Survei Sekarang",
      hasReferenceImage: true,
    });

    expect(promptWithoutOptional).toContain("Lavanya Hills");
    expect(promptWithoutOptional).toContain("Jadwalkan Survei Sekarang");
    expect(promptWithoutOptional).toContain("tanpa mencantumkan nomor telepon");
    expect(promptWithoutOptional).toContain("PERTAHANKAN 100% keaslian bentuk fasad");
    expect(promptWithoutOptional).not.toContain("0812-8899-5500");
    expect(promptWithoutOptional).not.toContain("Rp850 Juta");
  });

  it("should synthesize self-contained image data URI for all 5 archetypes without HTML", () => {
    const archetypes = [
      "emerald_minimalist",
      "luxury_architecture",
      "royal_navy_metro",
      "golden_aurora_wave",
      "kaba_direct_offer",
    ] as const;

    for (const archetypeId of archetypes) {
      const dataUri = AdPosterSynthesizer.synthesize({
        archetypeId,
        aspectRatio: "4:5",
        projectName: "Grand Harmoni",
        propertyType: "Modern Residence",
        propertyLocation: "BSD City",
        startingPrice: "Rp 850 Juta",
        promoHeadline: "DP 0% & Free PPN",
        contactNumber: "0812-3456-7890",
        photoUrl: "https://example.com/townhouse.jpg",
      });

      expect(dataUri).toMatch(/^data:image\/svg\+xml;base64,/);
      // Decoded SVG check
      const base64Part = dataUri.replace("data:image/svg+xml;base64,", "");
      const svgText = Buffer.from(base64Part, "base64").toString("utf-8");

      expect(svgText).toContain("<svg");
      expect(svgText).toContain("</svg>");
      expect(svgText).toContain("https://example.com/townhouse.jpg");
    }
  });

  it("should support 1:1, 4:5, and 9:16 aspect ratios", () => {
    const ratios = ["1:1", "4:5", "9:16"] as const;
    const expectedDims = {
      "1:1": { w: 1080, h: 1080 },
      "4:5": { w: 1080, h: 1350 },
      "9:16": { w: 1080, h: 1920 },
    };

    for (const ratio of ratios) {
      const dataUri = AdPosterSynthesizer.synthesize({
        archetypeId: "emerald_minimalist",
        aspectRatio: ratio,
        projectName: "Savanna Hills",
        photoUrl: "https://example.com/house.jpg",
      });

      const base64Part = dataUri.replace("data:image/svg+xml;base64,", "");
      const svgText = Buffer.from(base64Part, "base64").toString("utf-8");
      const { w, h } = expectedDims[ratio];

      expect(svgText).toContain(`width="${w}"`);
      expect(svgText).toContain(`height="${h}"`);
    }
  });
});

