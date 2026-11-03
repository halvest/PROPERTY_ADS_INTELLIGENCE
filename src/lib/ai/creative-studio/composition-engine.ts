import { getLayoutFamily, resolveDesignNiche, type LayoutFamilyId } from "./layout-families";
import { CreativeLayoutValidator } from "./layout-validator";
import type {
  CreativeBriefInput,
  CreativeStrategy,
  AspectRatio,
  ComposedAdLayout,
} from "./types";

export type { ComposedAdLayout, LayoutFamilyId };

/**
 * Deterministic Graphic & Typography Composition Engine
 * Assembles professional, agency-grade property ad layouts combining
 * clean architectural photos with pixel-perfect, typo-free marketing typography.
 */
export class AdCompositionEngine {
  /**
   * Generates a fully structured ad composition model following specified Layout Family rules
   */
  static composeAd(
    brief: CreativeBriefInput,
    strategy: CreativeStrategy,
    baseImageUrl: string,
    aspectRatio: AspectRatio,
    logoUrlOrFamilyId?: string | LayoutFamilyId,
    customLayoutFamilyId?: LayoutFamilyId
  ): ComposedAdLayout {
    const dimensions = this.resolveDimensions(aspectRatio);

    // Support either (brief, strategy, url, ratio, logoUrl, familyId) OR (brief, strategy, url, ratio, familyId)
    const knownFamilies: LayoutFamilyId[] = [
      "architectural_editorial",
      "property_brochure",
      "minimalist_modern",
      "premium_investment",
      "direct_response",
      "lifestyle_storytelling",
    ];

    let effectiveFamilyId = customLayoutFamilyId;
    let logoUrl: string | undefined = undefined;

    if (logoUrlOrFamilyId && knownFamilies.includes(logoUrlOrFamilyId as LayoutFamilyId)) {
      effectiveFamilyId = logoUrlOrFamilyId as LayoutFamilyId;
    } else if (typeof logoUrlOrFamilyId === "string") {
      logoUrl = logoUrlOrFamilyId;
    }

    if (!effectiveFamilyId) {
      effectiveFamilyId = this.inferLayoutFamily(brief, strategy);
    }

    const layoutConfig = getLayoutFamily(effectiveFamilyId);

    // 2. Resolve headline text (User provided or synthesized hook, stripped of emojis)
    const rawHeadline =
      brief.headline && brief.headline.trim().length > 0
        ? brief.headline.trim()
        : this.synthesizeHeadline(brief, strategy);
    const headlineText = CreativeLayoutValidator.stripEmojis(rawHeadline);

    const subheadlineText =
      brief.subheadline && brief.subheadline.trim().length > 0
        ? CreativeLayoutValidator.stripEmojis(brief.subheadline.trim())
        : brief.propertyLocation
        ? `Lokasi Strategis di ${CreativeLayoutValidator.stripEmojis(brief.propertyLocation)}`
        : undefined;

    // 3. Build Promotional Badges (limited to max 2 key perks to prevent visual clutter)
    const promoBadges: Array<{ text: string; color: string; bg: string }> = [];
    const promoLabels = (brief.promos && brief.promos.length > 0)
      ? brief.promos
      : [
          brief.dpAmount ? (brief.dpAmount.toUpperCase().includes("DP") ? brief.dpAmount : `DP ${brief.dpAmount}`) : "",
          brief.hasFreePpn ? "FREE PPN 100%" : "",
          brief.cashback || "",
          brief.monthlyInstallment || "",
        ].filter(Boolean);

    const nicheConfig = resolveDesignNiche(brief.stylePreset || effectiveFamilyId, brief);

    promoLabels.slice(0, 2).forEach((label, index) => {
      promoBadges.push({
        text: label.toUpperCase(),
        color: index === 0 ? nicheConfig.palette.promoPillText : "#064E3B",
        bg: index === 0 ? nicheConfig.palette.promoPillBg : "#FFFFFF",
      });
    });

    // 4. Build Structured Specs Pills (formatted cleanly with midpoints)
    const specsItems: string[] = [];
    if (brief.specsText && brief.specsText.trim().length > 0) {
      brief.specsText
        .split("•")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => specsItems.push(s));
    } else {
      if (brief.bedrooms) specsItems.push(`${brief.bedrooms} KT`);
      if (brief.bathrooms) specsItems.push(`${brief.bathrooms} KM`);
      if (brief.floors && brief.floors !== "1") specsItems.push(`${brief.floors} Lantai`);
      if (brief.buildingArea) specsItems.push(`LB ${brief.buildingArea} m²`);
      if (brief.landArea) specsItems.push(`LT ${brief.landArea} m²`);
      for (const advantage of brief.locationAdvantages || []) {
        const shortLabel = advantage.replace("Dekat Akses Tol", "Dekat Tol").replace("Dekat Stasiun", "Stasiun");
        specsItems.push(shortLabel);
      }
    }

    // 5. Build Price Badge
    let priceBadge: ComposedAdLayout["priceBadge"] = undefined;
    if (brief.startingPrice || brief.monthlyInstallment) {
      const formattedPrice = this.formatCurrencyDisplay(brief.startingPrice || "");
      const subtext = brief.monthlyInstallment
        ? `Cicilan ${this.formatCurrencyDisplay(brief.monthlyInstallment)}/bln`
        : brief.kprRate
        ? `Bunga KPR ${brief.kprRate}%`
        : undefined;

      priceBadge = {
        label: "HARGA MULAI",
        value: formattedPrice,
        rawPrice: formattedPrice,
        subtext,
        position: strategy.priceBadgePosition,
        bg: layoutConfig.colorSystem.cardBg,
        textColor: layoutConfig.colorSystem.accentColor,
      };
    }

    // 6. Call To Action
    const ctaText =
      brief.ctaText && brief.ctaText.trim().length > 0
        ? brief.ctaText.trim()
        : layoutConfig.id === "direct_response"
        ? "Chat WhatsApp Sekarang"
        : "Hubungi Marketing";

    // 7. Typography Sizing
    const headlineScale = strategy.typography.headlineWeight === "900" ? 1.12 : 1;
    const headlineSize = Math.round((aspectRatio === "9:16" ? 42 : aspectRatio === "1:1" ? 38 : 40) * headlineScale);
    const subheadlineSize = aspectRatio === "9:16" ? 16 : 15;

    const promoPills = promoBadges.map((badge, idx) => ({
      text: badge.text,
      type: (idx === 0 ? "primary" : "secondary") as "primary" | "secondary",
    }));

    // 8. Adaptive Vignette Overlay (Leaves upper 60% of facade completely bright)
    const adaptiveGradient =
      aspectRatio === "9:16"
        ? "linear-gradient(180deg, rgba(9,9,11,0.2) 0%, transparent 20%, rgba(9,9,11,0.25) 55%, rgba(9,9,11,0.85) 90%, rgba(9,9,11,0.96) 100%)"
        : "linear-gradient(180deg, transparent 0%, transparent 40%, rgba(9,9,11,0.3) 65%, rgba(9,9,11,0.82) 90%, rgba(9,9,11,0.95) 100%)";

    return {
      width: dimensions.width,
      height: dimensions.height,
      aspectRatio,
      layoutFamilyId: layoutConfig.id,
      adArchetypeId: brief.stylePreset && brief.stylePreset !== "auto_director" && brief.stylePreset !== "creative_freedom"
        ? brief.stylePreset
        : nicheConfig.id,
      fidelityMode: brief.fidelityMode || (brief.assets?.length ? "preserve_original" : "ai_atmosphere"),
      backgroundImageUrl: baseImageUrl,
      backgroundUrl: baseImageUrl,
      gradientOverlay: adaptiveGradient,
      palette: {
        ...strategy.colorPalette,
        accent: nicheConfig.palette.ctaBg,
      },
      colorPalette: {
        ...strategy.colorPalette,
        accent: nicheConfig.palette.ctaBg,
      },
      headline: {
        text: headlineText,
        placement: strategy.headlinePlacement,
        fontFamily: layoutConfig.typography.fontFamily,
        fontWeight: layoutConfig.typography.headlineWeight,
        fontSize: headlineSize,
        color: nicheConfig.palette.primaryText,
      },
      subheadline: subheadlineText
        ? {
            text: subheadlineText,
            fontSize: subheadlineSize,
            color: nicheConfig.palette.subtextColor,
          }
        : undefined,
      priceBadge: priceBadge
        ? {
            ...priceBadge,
            bg: nicheConfig.palette.cardBg,
            textColor: nicheConfig.palette.priceColor,
          }
        : undefined,
      promoBadges,
      promoPills,
      specsPills: specsItems,
      cta: {
        text: ctaText,
        bg: nicheConfig.palette.ctaBg,
        textColor: nicheConfig.palette.ctaText,
      },
      callToAction: {
        text: ctaText,
      },
      logoUrl: brief.logoDataUrl || logoUrl || undefined,
      logoDataUrl: brief.logoDataUrl || logoUrl || null,
      logoPlacement: brief.logoPlacement || "auto",
      hasLogo: Boolean(brief.logoDataUrl || logoUrl),
      whatsappNumber: brief.whatsappNumber || null,
      hasWhatsapp: Boolean(brief.whatsappNumber),
      specsText: brief.specsText || specsItems.join(" • "),
      projectName:
        brief.projectName && brief.projectName.trim().toLowerCase() !== "exclusive residence"
          ? brief.projectName.trim()
          : "",
      projectDetails: {
        projectName:
          brief.projectName && brief.projectName.trim().toLowerCase() !== "exclusive residence"
            ? brief.projectName.trim()
            : "",
        propertyType: brief.propertyType,
        propertyLocation: brief.propertyLocation,
        bedrooms: brief.bedrooms,
        bathrooms: brief.bathrooms,
        buildingArea: brief.buildingArea,
        landArea: brief.landArea,
      },
      safeZoneOverlay:
        aspectRatio === "9:16"
          ? {
              topClearancePercent: 15,
              bottomClearancePercent: 20,
            }
          : undefined,
    };
  }

  private static inferLayoutFamily(
    brief: CreativeBriefInput,
    strategy: CreativeStrategy
  ): LayoutFamilyId {
    const style = (brief.stylePreset || "").toLowerCase();
    if (style === "auto_director" || style === "creative_freedom") {
      return resolveDesignNiche(style, brief).layoutFamilyId;
    }
    if (style === "niche_minimalist" || style.includes("minimalist")) return "minimalist_modern";
    if (style === "niche_modern" || style.includes("corporate")) return "property_brochure";
    if (style === "niche_creative" || style.includes("editorial") || style.includes("luxury")) return "architectural_editorial";
    if (style === "niche_tropical" || style.includes("residential")) return "lifestyle_storytelling";
    if (style === "niche_direct_clean" || style.includes("high_conversion") || style.includes("promo")) return "direct_response";
    if (style.includes("investment")) return "premium_investment";
    return "property_brochure";
  }

  private static resolveDimensions(ratio: AspectRatio): { width: number; height: number } {
    switch (ratio) {
      case "1:1":
        return { width: 1080, height: 1080 };
      case "9:16":
        return { width: 1080, height: 1920 };
      case "4:5":
      default:
        return { width: 1080, height: 1350 };
    }
  }

  private static synthesizeHeadline(brief: CreativeBriefInput, strategy: CreativeStrategy): string {
    const name = brief.projectName ? brief.projectName.toUpperCase() : "HUNIAN MODERN";
    if (strategy.styleName.includes("Luxury")) {
      return `KEMEWAHAN PRESTISIUS DI ${name}`;
    }
    if (strategy.styleName.includes("Conversion") || strategy.styleName.includes("Promo")) {
      return `HUNIAN IMPIAN DI ${name} SIAP HUNI`;
    }
    return `DESAIN MODERN MINIMALIS ${name}`;
  }

  public static formatCurrencyDisplay(val: string): string {
    if (!val) return "";
    const trimmed = val.trim();

    // If already contains unit words like Miliar or Juta
    if (/(?:miliar|milyar|juta|jt|m)\b/i.test(trimmed)) {
      if (/^rp\s*/i.test(trimmed)) {
        return trimmed.replace(/^rp\s*/i, "Rp ");
      }
      return `Rp ${trimmed}`;
    }

    const clean = trimmed.replace(/[^0-9]/g, "");
    if (!clean) return trimmed;
    const num = Number(clean);
    if (num >= 1000000000) {
      const milyar = (num / 1000000000).toLocaleString("id-ID", { maximumFractionDigits: 2 });
      return `Rp ${milyar} Miliar`;
    }
    if (num >= 1000000) {
      const juta = (num / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 });
      return `Rp ${juta} Juta`;
    }
    return `Rp ${num.toLocaleString("id-ID")}`;
  }
}
