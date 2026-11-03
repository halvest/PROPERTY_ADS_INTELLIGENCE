import type {
  CreativeBriefInput,
  CreativeStrategy,
  CreativeQualityScore,
  ComposedAdLayout,
  StylePreset,
  AspectRatio,
} from "./types";
import { CreativeQualityChecker } from "./quality-checker";
import {
  getArchetype,
  inferArchetypeFromBrief,
  buildMuseAdGenerationPrompt,
  buildPureArchitecturalPhotoPrompt,
  type AdArchetypeId,
} from "./ad-archetypes";

/**
 * AI Creative Director & Marketing Intelligence Engine
 * Formulates agency-grade visual art direction, typography hierarchy,
 * color strategies, and structured prompt engineering for property ads.
 */
export class AICreativeDirector {
  /**
   * Analyzes the creative brief and generates a comprehensive Creative Strategy
   */
  static planCreativeStrategy(
    brief: CreativeBriefInput,
    aspectRatio: AspectRatio,
    selectedPreset: StylePreset
  ): CreativeStrategy {
    // 1. Resolve effective style
    const normalizedPreset = this.normalizePreset(selectedPreset);
    const effectivePreset =
      normalizedPreset === "creative_freedom" || normalizedPreset === "auto_director"
        ? this.inferOptimalPreset(brief)
        : normalizedPreset;

    const archetypeId = this.resolveArchetypeId(effectivePreset, brief);
    const archetype = getArchetype(
      effectivePreset.startsWith("niche_") ? effectivePreset : archetypeId
    );

    // 2. Select curated color palette based on preset & archetype
    const colorPalette = this.resolveColorPalette(effectivePreset, brief.colorMood);

    // 3. Select layout & typography hierarchy based on aspect ratio & preset
    const typography = this.resolveTypography(effectivePreset);
    const layout = this.resolveLayoutPlacements(aspectRatio, effectivePreset);

    // 4. Synthesize marketing angle & value proposition
    const marketingAngle = this.synthesizeMarketingAngle(brief, effectivePreset);

    // 5. Build structured visual composition brief
    const visualCompositionBrief = this.composeVisualBrief(brief, effectivePreset, aspectRatio);

    // 6. Generate precise image synthesis prompt for Muse Image Generation
    const imagePrompt = this.generateMuseImagePrompt(brief, effectivePreset, visualCompositionBrief);

    return {
      styleName: this.getStyleDisplayName(effectivePreset),
      adArchetypeId: archetypeId,
      headlinePlacement: layout.headlinePlacement,
      priceBadgePosition: layout.priceBadgePosition,
      colorPalette,
      typography,
      marketingAngle,
      visualCompositionBrief,
      imagePrompt,
    };
  }

  public static resolveArchetypeId(preset: StylePreset, brief: CreativeBriefInput): AdArchetypeId {
    if (
      preset === "emerald_minimalist" ||
      preset === "luxury_architecture" ||
      preset === "royal_navy_metro" ||
      preset === "golden_aurora_wave" ||
      preset === "kaba_direct_offer"
    ) {
      return preset;
    }
    if (preset === "niche_minimalist") return "emerald_minimalist";
    if (preset === "niche_modern") return "royal_navy_metro";
    if (preset === "niche_creative") return "luxury_architecture";
    if (preset === "niche_tropical") return "emerald_minimalist";
    if (preset === "niche_direct_clean") return "kaba_direct_offer";
    if (preset === "silpha_architect_diary") return "luxury_architecture";
    if (preset === "sariwangi_sultan_classic") return "royal_navy_metro";
    if (preset === "gland_ciwastra_amsterdam") return "emerald_minimalist";
    if (preset === "gland_pajajaran_murah_elegant") return "kaba_direct_offer";
    return inferArchetypeFromBrief(brief).id;
  }

  private static normalizePreset(preset: StylePreset): StylePreset {
    if (preset === "elegant_corporate") return "corporate";
    if (preset === "modern_residential") return "residential";
    if (preset === "editorial_architecture") return "editorial";
    return preset;
  }

  /**
   * Infers the optimal preset if user selected "Creative Freedom (AI)"
   */
  private static inferOptimalPreset(brief: CreativeBriefInput): StylePreset {
    const inferred = inferArchetypeFromBrief(brief);
    return inferred.id as StylePreset;
  }

  /**
   * Curates high-contrast, professional color palettes
   */
  private static resolveColorPalette(preset: StylePreset, userMood?: string) {
    if (userMood === "emerald") {
      return {
        primary: "#064E3B", // Deep Emerald
        secondary: "#047857",
        accent: "#10B981",
        backgroundOverlay: "linear-gradient(180deg, rgba(6,78,59,0.1) 0%, rgba(6,78,59,0.92) 100%)",
        textColor: "#FFFFFF",
      };
    }

    switch (preset) {
      case "emerald_minimalist":
        return {
          primary: "#064E3B",
          secondary: "#022C22",
          accent: "#10B981",
          backgroundOverlay: "linear-gradient(180deg, rgba(6,78,59,0.1) 0%, rgba(2,44,34,0.92) 100%)",
          textColor: "#FFFFFF",
        };
      case "luxury_architecture":
        return {
          primary: "#1C1917",
          secondary: "#292524",
          accent: "#D4AF37",
          backgroundOverlay: "linear-gradient(180deg, rgba(28,25,23,0.1) 0%, rgba(41,37,36,0.95) 100%)",
          textColor: "#FFFFFF",
        };
      case "royal_navy_metro":
        return {
          primary: "#0F172A",
          secondary: "#0A0F1D",
          accent: "#38BDF8",
          backgroundOverlay: "linear-gradient(180deg, rgba(15,23,42,0.1) 0%, rgba(10,15,29,0.95) 100%)",
          textColor: "#FFFFFF",
        };
      case "golden_aurora_wave":
        return {
          primary: "#D4AF37",
          secondary: "#78350F",
          accent: "#F59E0B",
          backgroundOverlay: "linear-gradient(180deg, rgba(212,175,55,0.1) 0%, rgba(120,53,15,0.95) 100%)",
          textColor: "#FFFFFF",
        };
      case "kaba_direct_offer":
        return {
          primary: "#14532D",
          secondary: "#052E16",
          accent: "#EAB308",
          backgroundOverlay: "linear-gradient(180deg, rgba(20,83,45,0.1) 0%, rgba(5,46,22,0.95) 100%)",
          textColor: "#FFFFFF",
        };
      case "luxury":
        return {
          primary: "#18181B", // Dark Zinc
          secondary: "#27272A",
          accent: "#D4AF37", // Warm Gold
          backgroundOverlay: "linear-gradient(180deg, rgba(9,9,11,0.2) 0%, rgba(9,9,11,0.95) 100%)",
          textColor: "#FFFFFF",
        };
      case "minimalist":
        return {
          primary: "#0F172A", // Slate 900
          secondary: "#1E293B",
          accent: "#2563EB", // Royal Blue
          backgroundOverlay: "linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.9) 100%)",
          textColor: "#FFFFFF",
        };
      case "high_conversion":
        return {
          primary: "#1C1917", // Warm Black
          secondary: "#292524",
          accent: "#F59E0B", // High-visibility Amber/Gold
          backgroundOverlay: "linear-gradient(180deg, rgba(28,25,23,0.1) 0%, rgba(28,25,23,0.95) 100%)",
          textColor: "#FFFFFF",
        };
      case "residential":
        return {
          primary: "#064E3B", // Forest Green
          secondary: "#065F46",
          accent: "#10B981", // Fresh Green
          backgroundOverlay: "linear-gradient(180deg, rgba(6,78,59,0.15) 0%, rgba(6,78,59,0.9) 100%)",
          textColor: "#FFFFFF",
        };
      case "promotional":
        return {
          primary: "#7F1D1D", // Deep Crimson
          secondary: "#991B1B",
          accent: "#EF4444", // Bright Red / Coral
          backgroundOverlay: "linear-gradient(180deg, rgba(127,29,29,0.2) 0%, rgba(127,29,29,0.95) 100%)",
          textColor: "#FFFFFF",
        };
      case "corporate":
        return {
          primary: "#1E1B4B", // Deep Indigo
          secondary: "#312E81",
          accent: "#6366F1", // Indigo
          backgroundOverlay: "linear-gradient(180deg, rgba(30,27,75,0.2) 0%, rgba(30,27,75,0.95) 100%)",
          textColor: "#FFFFFF",
        };
      case "editorial":
      default:
        return {
          primary: "#0A0A0A", // Obsidian
          secondary: "#262626",
          accent: "#A855F7", // Editorial Purple
          backgroundOverlay: "linear-gradient(180deg, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.95) 100%)",
          textColor: "#FFFFFF",
        };
    }
  }

  private static resolveTypography(preset: StylePreset) {
    switch (preset) {
      case "emerald_minimalist":
        return {
          headlineWeight: "900",
          fontFamily: "'Montserrat', 'Inter', sans-serif",
          letterSpacing: "0.02em",
        };
      case "luxury_architecture":
        return {
          headlineWeight: "900",
          fontFamily: "'Montserrat', 'Cinzel', sans-serif",
          letterSpacing: "0.04em",
        };
      case "royal_navy_metro":
        return {
          headlineWeight: "900",
          fontFamily: "'Cinzel', 'Playfair Display', serif",
          letterSpacing: "0.05em",
        };
      case "golden_aurora_wave":
        return {
          headlineWeight: "800",
          fontFamily: "'Playfair Display', Georgia, serif",
          letterSpacing: "0.01em",
        };
      case "kaba_direct_offer":
        return {
          headlineWeight: "900",
          fontFamily: "'Montserrat', 'Inter', sans-serif",
          letterSpacing: "0.01em",
        };
      case "luxury":
        return {
          headlineWeight: "800",
          fontFamily: "'Playfair Display', 'Cinzel', serif",
          letterSpacing: "-0.02em",
        };
      case "editorial":
        return {
          headlineWeight: "700",
          fontFamily: "'Bodoni MT', 'Didot', serif",
          letterSpacing: "0.02em",
        };
      case "minimalist":
      case "high_conversion":
      default:
        return {
          headlineWeight: "800",
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: "-0.03em",
        };
    }
  }

  private static resolveLayoutPlacements(
    ratio: AspectRatio,
    preset: StylePreset
  ): {
    headlinePlacement: "top-left" | "top-center" | "bottom-left" | "bottom-hero";
    priceBadgePosition: "bottom-right" | "top-right" | "hero-overlay";
  } {
    if (ratio === "9:16") {
      // Stories/Reels: Leave top 15% and bottom 20% safe zones free from critical text
      return {
        headlinePlacement: "top-left",
        priceBadgePosition: "bottom-right",
      };
    }

    if (preset === "luxury" || preset === "editorial") {
      return {
        headlinePlacement: "top-center",
        priceBadgePosition: "bottom-right",
      };
    }

    return {
      headlinePlacement: "top-left",
      priceBadgePosition: "hero-overlay",
    };
  }

  private static synthesizeMarketingAngle(brief: CreativeBriefInput, preset: StylePreset): string {
    const location = brief.propertyLocation || "Lokasi Strategis";
    const audience = brief.targetAudience ? ` Target: ${brief.targetAudience}.` : "";
    if (preset === "luxury") {
      return `Hunian prestisius dengan arsitektur elegan di ${location}, dirancang khusus untuk kenyamanan dan status keluarga mapan.${audience}`;
    }
    if (preset === "high_conversion" || preset === "promotional") {
      return `Peluang kepemilikan rumah terbaik di ${location} dengan kemudahan cicilan terjangkau dan paket promo eksklusif siap huni.${audience}`;
    }
    return `Kombinasi sempurna antara desain modern fungsional dan lingkungan asri ramah keluarga di ${location}.${audience}`;
  }

  private static composeVisualBrief(
    brief: CreativeBriefInput,
    preset: StylePreset,
    ratio: AspectRatio
  ): string {
    const orientation = ratio === "1:1" ? "Square 1:1" : ratio === "4:5" ? "Portrait 4:5" : "Vertical 9:16";
    return `Komposisi ${orientation} berstandar agensi periklanan komersial. Fasad arsitektur modern ${brief.projectName || "Properti"} dengan pencahayaan golden hour alami, taman depan tertata rapi, dan kontras visual tajam untuk memaksimalkan rasio klik (CTR).`;
  }

  /**
   * Generates a high-fidelity prompt for Muse Image Generation
   */
  public static generateMuseImagePrompt(
    brief: CreativeBriefInput,
    preset: StylePreset,
    compositionBrief: string
  ): string {
    const archetypeId = this.resolveArchetypeId(preset, brief);
    const archetype = getArchetype(preset && preset !== "creative_freedom" ? preset : archetypeId);

    let specs: string[] = [];
    if (brief.specsText && brief.specsText.trim().length > 0) {
      specs = brief.specsText
        .split("•")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      if (brief.bedrooms) specs.push(`${brief.bedrooms} Kamar Tidur`);
      if (brief.bathrooms) specs.push(`${brief.bathrooms} Kamar Mandi`);
      if (brief.buildingArea) specs.push(`LB ${brief.buildingArea} m²`);
      if (brief.landArea) specs.push(`LT ${brief.landArea} m²`);
    }

    const cleanProjectName =
      brief.projectName && brief.projectName.trim().toLowerCase() !== "exclusive residence"
        ? brief.projectName.trim()
        : "";

    // If 8 design families or architectural lighting is explicitly chosen, synthesize pure photo prompt (Layer 1)
    const isPureArchitecturePreset = Boolean(
      brief.designFamily ||
      brief.photographyStyle ||
      [
        "architectural_editorial",
        "luxury_developer_brochure",
        "swiss_grid_editorial",
        "modern_japanese_minimalism",
        "premium_real_estate_campaign",
        "contemporary_corporate",
        "cinematic_architecture",
        "high_end_property_catalog",
      ].includes(preset as string)
    );

    if (isPureArchitecturePreset) {
      return buildPureArchitecturalPhotoPrompt({
        aspectRatio: brief.aspectRatio,
        projectName: cleanProjectName,
        propertyType: brief.propertyType,
        propertyLocation: brief.propertyLocation,
        lightingStyle: brief.photographyStyle || "clean_daylight",
        hasReferenceImage: Boolean(brief.assets && brief.assets.length > 0),
      });
    }

    const promoText =
      brief.promoHeadline?.trim() ||
      (brief.promos && brief.promos.length > 0 ? brief.promos.join(" • ") : brief.dpAmount || "");

    return buildMuseAdGenerationPrompt({
      archetype,
      aspectRatio: brief.aspectRatio,
      projectName: cleanProjectName,
      propertyType: brief.propertyType,
      propertyLocation: brief.propertyLocation,
      startingPrice: brief.startingPrice,
      promoText,
      specs,
      contactNumber: brief.whatsappNumber || null,
      ctaText: brief.ctaText || "Hubungi Kami Sekarang",
      headline: brief.headline,
      targetAudience: brief.targetAudience,
      locationAdvantages: brief.locationAdvantages,
      hasReferenceImage: Boolean(brief.assets && brief.assets.length > 0),
      hasLogo: Boolean(brief.logoDataUrl && brief.logoDataUrl.trim().length > 0),
      logoPlacement: brief.logoPlacement || "auto",
    });
  }

  /**
   * Evaluates Objective Quality Assessment Scores & Pre-Flight Standards
   */
  static evaluateQualityScore(
    brief: CreativeBriefInput,
    composedLayout?: ComposedAdLayout
  ): CreativeQualityScore {
    const hasPhoto = Boolean(brief.assets && brief.assets.length > 0);
    const preFlight = composedLayout
      ? CreativeQualityChecker.evaluateLayout(composedLayout, brief.aspectRatio, hasPhoto, { promos: brief.promos })
      : undefined;

    // 1. Visual Fidelity (50 - 98)
    let visual = 72;
    if (hasPhoto) visual += 16;
    if (brief.propertyLocation) visual += 5;
    if (!brief.promoHeadline || brief.promoHeadline.length < 35) visual += 5; // clean, no sticker overload
    visual = Math.min(98, Math.max(50, visual));

    // 2. Readability (50 - 98)
    let readability = 70;
    const headlineLen = brief.headline?.length || 0;
    if (headlineLen >= 10 && headlineLen <= 65) {
      readability += 20;
    } else if (headlineLen > 75) {
      readability -= 12; // overflow risk
    } else {
      readability += 10;
    }
    if (brief.subheadline && brief.subheadline.length <= 80) readability += 6;
    readability = Math.min(98, Math.max(50, readability));

    // 3. Conversion Readiness (45 - 98)
    let conversion = 65;
    const priceText = brief.startingPrice || "";
    const cleanNumbers = priceText.replace(/[^0-9]/g, "");
    if (/(?:miliar|milyar|juta|jt|m)\b/i.test(priceText) || cleanNumbers.length >= 6) {
      conversion += 18;
    }
    const cta = brief.ctaText || "";
    if (/(?:hubungi|chat|whatsapp|wa|survei|jadwalkan|lihat|booking|konsultasi)/i.test(cta)) {
      conversion += 12;
    }
    if (brief.hasFreePpn || brief.dpAmount || brief.cashback) {
      conversion += 4;
    }
    conversion = Math.min(98, Math.max(45, conversion));

    const overall = preFlight
      ? preFlight.overallScore
      : Math.round(visual * 0.35 + readability * 0.35 + conversion * 0.3);

    const notes: string[] = [];
    if (hasPhoto) {
      notes.push("Foto properti asli terpasang sebagai focal point arsitektur.");
    } else {
      notes.push("Gunakan foto fasad asli untuk meningkatkan kredibilitas visual.");
    }

    if (headlineLen >= 10 && headlineLen <= 65) {
      notes.push(`Headline ringkas (${headlineLen} karakter) dengan ruang napas optimal.`);
    } else if (headlineLen > 75) {
      notes.push(`Headline (${headlineLen} karakter) melebihi batas ideal; ringkas agar tidak terpotong.`);
    }

    if (/(?:miliar|juta|jt)\b/i.test(priceText)) {
      notes.push(`Mata uang terspesifikasi jelas: "${priceText}".`);
    }

    if (preFlight && preFlight.actionableTips.length > 0) {
      notes.push(...preFlight.actionableTips.slice(0, 2));
    }

    return {
      visual,
      readability,
      conversion,
      overall,
      assessmentNotes: notes,
      preFlightReport: preFlight,
    };
  }

  private static getStyleDisplayName(preset: StylePreset): string {
    const normalized = this.normalizePreset(preset);
    const found: Record<string, string> = {
      luxury: "Premium Luxury",
      minimalist: "Modern Minimalist",
      corporate: "Elegant Corporate",
      residential: "Modern Residential",
      promotional: "Promotional Campaign",
      high_conversion: "High Conversion Ads",
      editorial: "Editorial Architecture",
      creative_freedom: "Creative Freedom (AI)",
    };
    return found[normalized] || "High Conversion Ads";
  }
}
