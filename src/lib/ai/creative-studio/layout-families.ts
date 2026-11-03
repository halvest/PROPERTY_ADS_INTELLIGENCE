import type { AspectRatio } from "./types";

export type LayoutFamilyId =
  | "architectural_editorial"
  | "property_brochure"
  | "minimalist_modern"
  | "premium_investment"
  | "direct_response"
  | "lifestyle_storytelling";

export type DesignNicheId =
  | "auto_director"
  | "architectural_editorial"
  | "luxury_developer_brochure"
  | "swiss_grid_editorial"
  | "modern_japanese_minimalism"
  | "premium_real_estate_campaign"
  | "contemporary_corporate"
  | "cinematic_architecture"
  | "high_end_property_catalog"
  | "niche_minimalist"
  | "niche_modern_catalog"
  | "niche_promo_conversion"
  | "niche_creative_dock"
  | "niche_tropical_luxury"
  | "niche_modern"
  | "niche_creative"
  | "niche_tropical"
  | "niche_direct_clean";

export type CanonicalDesignFamilyId =
  | "architectural_editorial"
  | "luxury_developer_brochure"
  | "swiss_grid_editorial"
  | "modern_japanese_minimalism"
  | "premium_real_estate_campaign"
  | "contemporary_corporate"
  | "cinematic_architecture"
  | "high_end_property_catalog"
  | "niche_minimalist"
  | "niche_modern_catalog"
  | "niche_promo_conversion"
  | "niche_creative_dock"
  | "niche_tropical_luxury";

export interface DesignNicheConfig {
  id: string;
  canonicalId: CanonicalDesignFamilyId;
  name: string;
  subtitle: string;
  layoutFamilyId: LayoutFamilyId;
  skyTone: string;
  groundTone: string;
  palette: {
    cardBg: string;
    altLightCardBg?: string;
    primaryText: string;
    subtextColor: string;
    priceColor: string;
    promoPillBg: string;
    promoPillText: string;
    promoPillBorder?: string;
    ctaBg: string;
    ctaText: string;
    borderColor: string;
  };
  layoutStyle:
    | "floating_rounded_card"
    | "feathered_split_dock"
    | "sky_header_compact_card"
    | "organic_garden_blend"
    | "nordic_conversion_dock";
  cardRadius: number;
  cardMargin: number;
  skyMoodPrompt: string;
}

export const DESIGN_NICHES: Record<Exclude<DesignNicheId, "auto_director">, DesignNicheConfig> = {
  // --- 8 PROFESSIONAL DESIGN FAMILIES (CANONICAL) ---
  architectural_editorial: {
    id: "architectural_editorial",
    canonicalId: "architectural_editorial",
    name: "Architectural Editorial",
    subtitle: "Luxury Magazine Cover & Oversized Serif",
    layoutFamilyId: "architectural_editorial",
    skyTone: "#BACAD6",
    groundTone: "#14171A",
    palette: {
      cardBg: "rgba(20, 23, 26, 0.78)",
      primaryText: "#FFFFFF",
      subtextColor: "#E2D9CC",
      priceColor: "#D5B88B",
      promoPillBg: "rgba(213, 184, 139, 0.22)",
      promoPillText: "#FAF7F2",
      promoPillBorder: "rgba(213, 184, 139, 0.40)",
      ctaBg: "#D5B88B",
      ctaText: "#14171A",
      borderColor: "rgba(213, 184, 139, 0.40)",
    },
    layoutStyle: "floating_rounded_card",
    cardRadius: 20,
    cardMargin: 32,
    skyMoodPrompt: "crisp luxury magazine cover architectural photo with soft natural sky (#BACAD6) and deep shadowed driveway",
  },
  luxury_developer_brochure: {
    id: "luxury_developer_brochure",
    canonicalId: "luxury_developer_brochure",
    name: "Luxury Developer Brochure",
    subtitle: "Ciputra & BSD City Prestige Framing",
    layoutFamilyId: "property_brochure",
    skyTone: "#B6CCDF",
    groundTone: "#F9F7F1",
    palette: {
      cardBg: "#233329",
      altLightCardBg: "#F9F7F1",
      primaryText: "#1B3022",
      subtextColor: "#4A5D50",
      priceColor: "#FFFFFF",
      promoPillBg: "#E8D5B5",
      promoPillText: "#1E3226",
      promoPillBorder: "rgba(27, 48, 34, 0.15)",
      ctaBg: "#233329",
      ctaText: "#D8C39E",
      borderColor: "rgba(27, 48, 34, 0.15)",
    },
    layoutStyle: "feathered_split_dock",
    cardRadius: 18,
    cardMargin: 0,
    skyMoodPrompt: "prestigious BSD City style luxury architectural photo with warm daylight and refined estate landscaping",
  },
  swiss_grid_editorial: {
    id: "swiss_grid_editorial",
    canonicalId: "swiss_grid_editorial",
    name: "Swiss Grid Editorial",
    subtitle: "Josef Müller-Brockmann 4-Box Matrix",
    layoutFamilyId: "minimalist_modern",
    skyTone: "#CCD5DE",
    groundTone: "#111111",
    palette: {
      cardBg: "#FFFFFF",
      altLightCardBg: "#F4F5F7",
      primaryText: "#111111",
      subtextColor: "#555555",
      priceColor: "#000000",
      promoPillBg: "#111111",
      promoPillText: "#FFFFFF",
      promoPillBorder: "rgba(17, 17, 17, 0.2)",
      ctaBg: "#E11D48",
      ctaText: "#FFFFFF",
      borderColor: "rgba(17, 17, 17, 0.2)",
    },
    layoutStyle: "nordic_conversion_dock",
    cardRadius: 0,
    cardMargin: 24,
    skyMoodPrompt: "modernist Swiss architectural photo with neutral overcast sky (#CCD5DE) and pure geometric composition",
  },
  modern_japanese_minimalism: {
    id: "modern_japanese_minimalism",
    canonicalId: "modern_japanese_minimalism",
    name: "Modern Japanese Minimalism",
    subtitle: "Wabi-Sabi Linen Whitespace & Sage Palette",
    layoutFamilyId: "minimalist_modern",
    skyTone: "#E4DFD7",
    groundTone: "#F5F2EB",
    palette: {
      cardBg: "rgba(245, 242, 235, 0.94)",
      primaryText: "#2A2F2B",
      subtextColor: "#5B675E",
      priceColor: "#2A2F2B",
      promoPillBg: "rgba(74, 93, 78, 0.14)",
      promoPillText: "#2A2F2B",
      promoPillBorder: "rgba(74, 93, 78, 0.25)",
      ctaBg: "#4A5D4E",
      ctaText: "#FFFFFF",
      borderColor: "rgba(74, 93, 78, 0.25)",
    },
    layoutStyle: "organic_garden_blend",
    cardRadius: 16,
    cardMargin: 36,
    skyMoodPrompt: "serene wabi-sabi architectural photo with soft warm linen sky tone (#E4DFD7) and natural bamboo/sage greenery",
  },
  premium_real_estate_campaign: {
    id: "premium_real_estate_campaign",
    canonicalId: "premium_real_estate_campaign",
    name: "Premium Real Estate Campaign",
    subtitle: "High-CTR Meta Ads Ticket & Urgent CTA",
    layoutFamilyId: "direct_response",
    skyTone: "#DDE3EA",
    groundTone: "#F3F4F6",
    palette: {
      cardBg: "#0F172A",
      altLightCardBg: "#F3F4F6",
      primaryText: "#FFFFFF",
      subtextColor: "#94A3B8",
      priceColor: "#F59E0B",
      promoPillBg: "#EF4444",
      promoPillText: "#FFFFFF",
      promoPillBorder: "rgba(245, 158, 11, 0.40)",
      ctaBg: "#25D366",
      ctaText: "#FFFFFF",
      borderColor: "rgba(245, 158, 11, 0.40)",
    },
    layoutStyle: "nordic_conversion_dock",
    cardRadius: 16,
    cardMargin: 24,
    skyMoodPrompt: "vibrant high-contrast commercial real estate photo under clear morning sunlight (#DDE3EA) with asphalt driveway",
  },
  contemporary_corporate: {
    id: "contemporary_corporate",
    canonicalId: "contemporary_corporate",
    name: "Contemporary Corporate",
    subtitle: "Paramount Land Corporate Navy & Platinum",
    layoutFamilyId: "property_brochure",
    skyTone: "#CBD5E1",
    groundTone: "#0A192F",
    palette: {
      cardBg: "#0A192F",
      altLightCardBg: "#F8FAFC",
      primaryText: "#FFFFFF",
      subtextColor: "#94A3B8",
      priceColor: "#38BDF8",
      promoPillBg: "rgba(56, 189, 248, 0.15)",
      promoPillText: "#38BDF8",
      promoPillBorder: "rgba(56, 189, 248, 0.35)",
      ctaBg: "#0284C7",
      ctaText: "#FFFFFF",
      borderColor: "rgba(56, 189, 248, 0.35)",
    },
    layoutStyle: "feathered_split_dock",
    cardRadius: 16,
    cardMargin: 28,
    skyMoodPrompt: "corporate architectural photo with deep blue sky (#CBD5E1) and polished concrete driveway",
  },
  cinematic_architecture: {
    id: "cinematic_architecture",
    canonicalId: "cinematic_architecture",
    name: "Cinematic Architecture",
    subtitle: "Moody Twilight & Warm Glass Amber Glow",
    layoutFamilyId: "lifestyle_storytelling",
    skyTone: "#182338",
    groundTone: "#090C12",
    palette: {
      cardBg: "rgba(9, 12, 18, 0.88)",
      primaryText: "#FFFFFF",
      subtextColor: "#FBBF24",
      priceColor: "#FDE68A",
      promoPillBg: "rgba(251, 191, 36, 0.20)",
      promoPillText: "#FDE68A",
      promoPillBorder: "rgba(251, 191, 36, 0.35)",
      ctaBg: "#D97706",
      ctaText: "#090C12",
      borderColor: "rgba(251, 191, 36, 0.35)",
    },
    layoutStyle: "sky_header_compact_card",
    cardRadius: 20,
    cardMargin: 36,
    skyMoodPrompt: "dramatic dusk twilight sky (#182338) with warm 2700K tungsten interior lights glowing through floor-to-ceiling glass windows",
  },
  high_end_property_catalog: {
    id: "high_end_property_catalog",
    canonicalId: "high_end_property_catalog",
    name: "High-End Property Catalog",
    subtitle: "Architectural Lookbook & Unit Type Specs",
    layoutFamilyId: "property_brochure",
    skyTone: "#D2DBE2",
    groundTone: "#F8F9FA",
    palette: {
      cardBg: "#1E293B",
      altLightCardBg: "#F8F9FA",
      primaryText: "#0F172A",
      subtextColor: "#475569",
      priceColor: "#0F172A",
      promoPillBg: "#334155",
      promoPillText: "#F8F9FA",
      promoPillBorder: "rgba(15, 23, 42, 0.20)",
      ctaBg: "#0F172A",
      ctaText: "#FFFFFF",
      borderColor: "rgba(15, 23, 42, 0.20)",
    },
    layoutStyle: "feathered_split_dock",
    cardRadius: 14,
    cardMargin: 20,
    skyMoodPrompt: "architectural catalog lookbook photo with clean daylight sky (#D2DBE2) and pristine paved driveway",
  },

  // --- BACKWARD COMPATIBLE LEGACY NICHES ---
  niche_minimalist: {
    id: "niche_minimalist",
    canonicalId: "niche_minimalist",
    name: "Pure Minimalist",
    subtitle: "Editorial Sky & Dark Driveway",
    layoutFamilyId: "minimalist_modern",
    skyTone: "#BACAD6",
    groundTone: "#1E1B18",
    palette: {
      cardBg: "rgba(30, 27, 24, 0.88)",
      altLightCardBg: "#F5F3EF",
      primaryText: "#FFFFFF",
      subtextColor: "#E7D8C5",
      priceColor: "#FFFFFF",
      promoPillBg: "rgba(255, 255, 255, 0.18)",
      promoPillText: "#FFFFFF",
      promoPillBorder: "rgba(255, 255, 255, 0.35)",
      ctaBg: "#2E6F5E",
      ctaText: "#FFFFFF",
      borderColor: "rgba(255, 255, 255, 0.35)",
    },
    layoutStyle: "floating_rounded_card",
    cardRadius: 24,
    cardMargin: 28,
    skyMoodPrompt: "calm misty morning blue sky (#BACAD6) with gentle natural daylight, subtle corner tree foliage, and dark shadowed driveway (#1E1B18)",
  },
  niche_modern_catalog: {
    id: "niche_modern_catalog",
    canonicalId: "niche_modern_catalog",
    name: "Modern Catalog",
    subtitle: "Warm Cream Fade & Asymmetric Price Card",
    layoutFamilyId: "property_brochure",
    skyTone: "#B6CCDF",
    groundTone: "#F9F7F1",
    palette: {
      cardBg: "#233329",
      altLightCardBg: "#F9F7F1",
      primaryText: "#1B3022",
      subtextColor: "#4A5D50",
      priceColor: "#FFFFFF",
      promoPillBg: "#E8D5B5",
      promoPillText: "#1E3226",
      promoPillBorder: "rgba(27, 48, 34, 0.15)",
      ctaBg: "#233329",
      ctaText: "#D8C39E",
      borderColor: "rgba(27, 48, 34, 0.15)",
    },
    layoutStyle: "feathered_split_dock",
    cardRadius: 18,
    cardMargin: 0,
    skyMoodPrompt: "clean contemporary daytime sky with warm cream foreground transition (#F9F7F1) and crisp architectural light",
  },
  niche_promo_conversion: {
    id: "niche_promo_conversion",
    canonicalId: "niche_promo_conversion",
    name: "Direct Promo Frame",
    subtitle: "High-CTR KPR & Subsidi Ticket",
    layoutFamilyId: "direct_response",
    skyTone: "#E5D9C8",
    groundTone: "#F4F5F7",
    palette: {
      cardBg: "rgba(255, 255, 255, 0.82)",
      altLightCardBg: "#F4F5F7",
      primaryText: "#374151",
      subtextColor: "#4B5563",
      priceColor: "#374151",
      promoPillBg: "rgba(90, 105, 120, 0.35)",
      promoPillText: "#FFFFFF",
      promoPillBorder: "#CBD5E1",
      ctaBg: "#374151",
      ctaText: "#FFFFFF",
      borderColor: "#CBD5E1",
    },
    layoutStyle: "nordic_conversion_dock",
    cardRadius: 20,
    cardMargin: 36,
    skyMoodPrompt: "warm morning sunrise sky (#E5D9C8) with soft white mist foreground (#F4F5F7) and bright commercial clarity",
  },
  niche_creative_dock: {
    id: "niche_creative_dock",
    canonicalId: "niche_creative_dock",
    name: "Creative Dual-Dock",
    subtitle: "Sky Box & Double Floating Pills",
    layoutFamilyId: "architectural_editorial",
    skyTone: "#4A80B8",
    groundTone: "#1F2937",
    palette: {
      cardBg: "#385A82",
      altLightCardBg: "#F4F5F7",
      primaryText: "#FFFFFF",
      subtextColor: "#E2E8F0",
      priceColor: "#FFFFFF",
      promoPillBg: "rgba(255, 255, 255, 0.14)",
      promoPillText: "#FFFFFF",
      promoPillBorder: "#FFFFFF",
      ctaBg: "#385A82",
      ctaText: "#FFFFFF",
      borderColor: "rgba(255, 255, 255, 0.35)",
    },
    layoutStyle: "sky_header_compact_card",
    cardRadius: 24,
    cardMargin: 48,
    skyMoodPrompt: "clear azure blue sky (#4A80B8) with clean center sky space for translucent price box and natural paved driveway",
  },
  niche_tropical_luxury: {
    id: "niche_tropical_luxury",
    canonicalId: "niche_tropical_luxury",
    name: "Luxury Editorial",
    subtitle: "Matte Obsidian & Brushed Bronze",
    layoutFamilyId: "lifestyle_storytelling",
    skyTone: "#C6D3DC",
    groundTone: "#161514",
    palette: {
      cardBg: "rgba(22, 21, 20, 0.90)",
      primaryText: "#FAF8F5",
      subtextColor: "#D5B88B",
      priceColor: "#D5B88B",
      promoPillBg: "#262320",
      promoPillText: "#D5B88B",
      promoPillBorder: "rgba(213, 184, 139, 0.35)",
      ctaBg: "#D5B88B",
      ctaText: "#161514",
      borderColor: "rgba(213, 184, 139, 0.35)",
    },
    layoutStyle: "organic_garden_blend",
    cardRadius: 20,
    cardMargin: 36,
    skyMoodPrompt: "serene luxury architectural sky with warm golden-hour sunlight and matte obsidian foreground shadow (#161514)",
  },
  niche_modern: {
    id: "niche_modern",
    canonicalId: "niche_modern_catalog",
    name: "Modern Catalog",
    subtitle: "Warm Cream Fade & Asymmetric Price Card",
    layoutFamilyId: "property_brochure",
    skyTone: "#B6CCDF",
    groundTone: "#F9F7F1",
    palette: {
      cardBg: "#233329",
      altLightCardBg: "#F9F7F1",
      primaryText: "#1B3022",
      subtextColor: "#4A5D50",
      priceColor: "#FFFFFF",
      promoPillBg: "#E8D5B5",
      promoPillText: "#1E3226",
      promoPillBorder: "rgba(27, 48, 34, 0.15)",
      ctaBg: "#233329",
      ctaText: "#D8C39E",
      borderColor: "rgba(27, 48, 34, 0.15)",
    },
    layoutStyle: "feathered_split_dock",
    cardRadius: 18,
    cardMargin: 0,
    skyMoodPrompt: "clean contemporary daytime sky with warm cream foreground transition (#F9F7F1) and crisp architectural light",
  },
  niche_creative: {
    id: "niche_creative",
    canonicalId: "niche_creative_dock",
    name: "Creative Dual-Dock",
    subtitle: "Sky Box & Double Floating Pills",
    layoutFamilyId: "architectural_editorial",
    skyTone: "#4A80B8",
    groundTone: "#1F2937",
    palette: {
      cardBg: "#385A82",
      altLightCardBg: "#F4F5F7",
      primaryText: "#FFFFFF",
      subtextColor: "#E2E8F0",
      priceColor: "#FFFFFF",
      promoPillBg: "rgba(255, 255, 255, 0.14)",
      promoPillText: "#FFFFFF",
      promoPillBorder: "#FFFFFF",
      ctaBg: "#385A82",
      ctaText: "#FFFFFF",
      borderColor: "rgba(255, 255, 255, 0.35)",
    },
    layoutStyle: "sky_header_compact_card",
    cardRadius: 24,
    cardMargin: 48,
    skyMoodPrompt: "clear azure blue sky (#4A80B8) with clean center sky space for translucent price box and natural paved driveway",
  },
  niche_tropical: {
    id: "niche_tropical",
    canonicalId: "niche_tropical_luxury",
    name: "Luxury Editorial",
    subtitle: "Matte Obsidian & Brushed Bronze",
    layoutFamilyId: "lifestyle_storytelling",
    skyTone: "#C6D3DC",
    groundTone: "#161514",
    palette: {
      cardBg: "rgba(22, 21, 20, 0.90)",
      primaryText: "#FAF8F5",
      subtextColor: "#D5B88B",
      priceColor: "#D5B88B",
      promoPillBg: "#262320",
      promoPillText: "#D5B88B",
      promoPillBorder: "rgba(213, 184, 139, 0.35)",
      ctaBg: "#D5B88B",
      ctaText: "#161514",
      borderColor: "rgba(213, 184, 139, 0.35)",
    },
    layoutStyle: "organic_garden_blend",
    cardRadius: 20,
    cardMargin: 36,
    skyMoodPrompt: "serene luxury architectural sky with warm golden-hour sunlight and matte obsidian foreground shadow (#161514)",
  },
  niche_direct_clean: {
    id: "niche_direct_clean",
    canonicalId: "niche_promo_conversion",
    name: "Direct Promo Frame",
    subtitle: "High-CTR KPR & Subsidi Ticket",
    layoutFamilyId: "direct_response",
    skyTone: "#E5D9C8",
    groundTone: "#F4F5F7",
    palette: {
      cardBg: "rgba(255, 255, 255, 0.82)",
      altLightCardBg: "#F4F5F7",
      primaryText: "#374151",
      subtextColor: "#4B5563",
      priceColor: "#374151",
      promoPillBg: "rgba(90, 105, 120, 0.35)",
      promoPillText: "#FFFFFF",
      promoPillBorder: "#CBD5E1",
      ctaBg: "#374151",
      ctaText: "#FFFFFF",
      borderColor: "#CBD5E1",
    },
    layoutStyle: "nordic_conversion_dock",
    cardRadius: 20,
    cardMargin: 36,
    skyMoodPrompt: "warm morning sunrise sky (#E5D9C8) with soft white mist foreground (#F4F5F7) and bright commercial clarity",
  },
};

/**
 * Resolves any preset or legacy archetype ID into one of the Design Niches.
 * When `auto_director` or `creative_freedom` is passed, infers the optimal niche from the property brief.
 */
export function resolveDesignNiche(
  presetOrId?: string,
  briefContext?: {
    propertyType?: string;
    startingPrice?: string;
    hasFreePpn?: boolean;
    dpAmount?: string;
    projectName?: string;
  }
): DesignNicheConfig {
  const key = (presetOrId || "").toLowerCase();

  if (key in DESIGN_NICHES) {
    return DESIGN_NICHES[key as Exclude<DesignNicheId, "auto_director">];
  }

  // 8 Canonical Design Family mappings
  if (key === "architectural_editorial" || key === "editorial" || key === "editorial_architecture") {
    return DESIGN_NICHES.architectural_editorial;
  }
  if (key === "luxury_developer_brochure" || key === "developer_brochure" || key === "ciputra" || key === "bsd_city") {
    return DESIGN_NICHES.luxury_developer_brochure;
  }
  if (key === "swiss_grid_editorial" || key === "swiss_grid" || key === "muller_brockmann") {
    return DESIGN_NICHES.swiss_grid_editorial;
  }
  if (key === "modern_japanese_minimalism" || key === "japanese_minimalism" || key === "wabi_sabi" || key === "zen") {
    return DESIGN_NICHES.modern_japanese_minimalism;
  }
  if (key === "premium_real_estate_campaign" || key === "campaign" || key === "high_ctr" || key === "meta_ads_champion") {
    return DESIGN_NICHES.premium_real_estate_campaign;
  }
  if (key === "contemporary_corporate" || key === "corporate" || key === "paramount_land") {
    return DESIGN_NICHES.contemporary_corporate;
  }
  if (key === "cinematic_architecture" || key === "cinematic" || key === "twilight" || key === "blue_hour") {
    return DESIGN_NICHES.cinematic_architecture;
  }
  if (key === "high_end_property_catalog" || key === "property_catalog" || key === "lookbook") {
    return DESIGN_NICHES.high_end_property_catalog;
  }

  // Legacy mappings
  if (key === "minimalist" || key === "minimalist_modern" || key === "silpha_architect_diary") {
    return DESIGN_NICHES.niche_minimalist;
  }
  if (key === "property_brochure" || key === "corporate" || key === "elegant_corporate" || key === "emerald_minimalist" || key === "gland_ciwastra_amsterdam") {
    return DESIGN_NICHES.niche_modern_catalog;
  }
  if (key === "golden_aurora_wave") {
    return DESIGN_NICHES.niche_creative_dock;
  }
  if (key === "lifestyle_storytelling" || key === "residential" || key === "modern_residential" || key === "luxury" || key === "luxury_architecture") {
    return DESIGN_NICHES.niche_tropical_luxury;
  }
  if (key === "direct_response" || key === "high_conversion" || key === "promotional" || key === "kaba_direct_offer" || key === "royal_navy_metro" || key === "sariwangi_sultan_classic" || key === "gland_pajajaran_murah_elegant") {
    return DESIGN_NICHES.niche_promo_conversion;
  }

  // Auto Niche Director smart matching based on brief context
  if (briefContext) {
    const typeLower = (briefContext.propertyType || "").toLowerCase();
    const nameLower = (briefContext.projectName || "").toLowerCase();
    const priceDigits = Number((briefContext.startingPrice || "").replace(/[^0-9]/g, "")) || 0;

    if (typeLower.includes("villa") || typeLower.includes("resort") || nameLower.includes("villa") || nameLower.includes("park")) {
      return DESIGN_NICHES.niche_tropical_luxury;
    }
    if (priceDigits >= 2000000000 || nameLower.includes("signature") || nameLower.includes("luxury")) {
      return DESIGN_NICHES.niche_creative_dock;
    }
    if (briefContext.dpAmount || briefContext.hasFreePpn) {
      return DESIGN_NICHES.niche_promo_conversion;
    }
    if (nameLower.includes("minimalis") || nameLower.includes("zen") || nameLower.includes("hana")) {
      return DESIGN_NICHES.niche_minimalist;
    }
  }

  return DESIGN_NICHES.niche_modern_catalog;
}

export interface LayoutFamilyConfig {
  id: LayoutFamilyId;
  name: string;
  tagline: string;
  philosophy: string;
  recommendedAspectRatios: AspectRatio[];
  typography: {
    fontFamily: string;
    headlineWeight: string;
    headlineCase: "uppercase" | "capitalize" | "normal";
    letterSpacing: string;
    maxHeadlineLines: number;
  };
  imageTreatment: {
    overlayType: "none" | "bottom_vignette" | "split_gradient" | "editorial_card" | "solid_dock";
    vignetteIntensity: number; // 0.0 to 1.0 (subtle contrast only)
    blurBackdrop: boolean;
  };
  composition: {
    headerPosition: "top_left" | "top_center" | "top_split" | "hidden";
    headlineZone: "bottom_left" | "bottom_center" | "card_dock" | "floating_card";
    specsLayout: "inline_dots" | "pill_row" | "compact_grid" | "hidden";
    priceDisplay: "elegant_inline" | "hero_card" | "badge_corner" | "split_footer";
    ctaStyle: "luxury_minimal" | "pill_accent" | "solid_button" | "full_width_dock";
  };
  colorSystem: {
    primaryBg: string;
    cardBg: string;
    textColor: string;
    subtextColor: string;
    accentColor: string;
    borderColor: string;
  };
}

export const LAYOUT_FAMILIES: Record<LayoutFamilyId, LayoutFamilyConfig> = {
  // -------------------------------------------------------------------------
  // 1. ARCHITECTURAL EDITORIAL (Maps to niche_creative)
  // -------------------------------------------------------------------------
  architectural_editorial: {
    id: "architectural_editorial",
    name: "Architectural Editorial",
    tagline: "Estetika sampul majalah arsitektur berkelas & ruang negatif lega",
    philosophy: "Photography First. Typography as Fine Art. Zero Clutter.",
    recommendedAspectRatios: ["4:5", "1:1", "9:16"],
    typography: {
      fontFamily: "'Playfair Display', 'Cinzel', Georgia, serif",
      headlineWeight: "700",
      headlineCase: "capitalize",
      letterSpacing: "-0.01em",
      maxHeadlineLines: 2,
    },
    imageTreatment: {
      overlayType: "bottom_vignette",
      vignetteIntensity: 0.45,
      blurBackdrop: false,
    },
    composition: {
      headerPosition: "top_split",
      headlineZone: "bottom_left",
      specsLayout: "inline_dots",
      priceDisplay: "elegant_inline",
      ctaStyle: "luxury_minimal",
    },
    colorSystem: {
      primaryBg: "rgba(22, 22, 25, 0.85)",
      cardBg: "rgba(22, 22, 25, 0.85)",
      textColor: "#FFFFFF",
      subtextColor: "rgba(255, 255, 255, 0.80)",
      accentColor: "#C8A97E",
      borderColor: "rgba(200, 169, 126, 0.26)",
    },
  },

  // -------------------------------------------------------------------------
  // 2. PREMIUM PROPERTY BROCHURE (Maps to niche_modern)
  // -------------------------------------------------------------------------
  property_brochure: {
    id: "property_brochure",
    name: "Premium Property Brochure",
    tagline: "Tata letak brosur developer resmi dengan spesifikasi terstruktur rapi",
    philosophy: "Organized Hierarchy. Corporate Credibility. Clean Property Specs.",
    recommendedAspectRatios: ["4:5", "1:1"],
    typography: {
      fontFamily: "system-ui, -apple-system, 'SF Pro Display', Roboto, sans-serif",
      headlineWeight: "800",
      headlineCase: "normal",
      letterSpacing: "-0.025em",
      maxHeadlineLines: 2,
    },
    imageTreatment: {
      overlayType: "solid_dock",
      vignetteIntensity: 0.35,
      blurBackdrop: false,
    },
    composition: {
      headerPosition: "top_left",
      headlineZone: "card_dock",
      specsLayout: "compact_grid",
      priceDisplay: "hero_card",
      ctaStyle: "solid_button",
    },
    colorSystem: {
      primaryBg: "rgba(20, 24, 31, 0.88)",
      cardBg: "rgba(20, 24, 31, 0.88)",
      textColor: "#F8FAFC",
      subtextColor: "#CBD5E1",
      accentColor: "#216E55",
      borderColor: "rgba(148, 163, 184, 0.24)",
    },
  },

  // -------------------------------------------------------------------------
  // 3. MINIMALIST MODERN (Maps to niche_minimalist)
  // -------------------------------------------------------------------------
  minimalist_modern: {
    id: "minimalist_modern",
    name: "Minimalist Modern",
    tagline: "Garis geometris presisi, minim ornamen, dan tipografi modern bersih",
    philosophy: "Less is More. Crisp Sans-Serif. Maximum Facade Prominence.",
    recommendedAspectRatios: ["1:1", "4:5"],
    typography: {
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      headlineWeight: "800",
      headlineCase: "normal",
      letterSpacing: "-0.03em",
      maxHeadlineLines: 2,
    },
    imageTreatment: {
      overlayType: "editorial_card",
      vignetteIntensity: 0.2,
      blurBackdrop: false,
    },
    composition: {
      headerPosition: "top_left",
      headlineZone: "floating_card",
      specsLayout: "inline_dots",
      priceDisplay: "badge_corner",
      ctaStyle: "pill_accent",
    },
    colorSystem: {
      primaryBg: "#1C1917",
      cardBg: "rgba(28, 25, 23, 0.86)",
      textColor: "#FAF8F5",
      subtextColor: "#E7D8C5",
      accentColor: "#2E6F5E",
      borderColor: "rgba(231, 216, 197, 0.22)",
    },
  },

  // -------------------------------------------------------------------------
  // 4. PREMIUM INVESTMENT
  // -------------------------------------------------------------------------
  premium_investment: {
    id: "premium_investment",
    name: "Premium Investment",
    tagline: "Penyajian nilai investasi, capital gain, dan skema pembiayaan terpercaya",
    philosophy: "Financial Clarity. Factual Value. High Investor Confidence.",
    recommendedAspectRatios: ["4:5", "1:1"],
    typography: {
      fontFamily: "'Playfair Display', serif",
      headlineWeight: "800",
      headlineCase: "normal",
      letterSpacing: "-0.015em",
      maxHeadlineLines: 2,
    },
    imageTreatment: {
      overlayType: "split_gradient",
      vignetteIntensity: 0.5,
      blurBackdrop: false,
    },
    composition: {
      headerPosition: "top_split",
      headlineZone: "bottom_left",
      specsLayout: "pill_row",
      priceDisplay: "split_footer",
      ctaStyle: "solid_button",
    },
    colorSystem: {
      primaryBg: "#161618",
      cardBg: "rgba(22, 22, 25, 0.88)",
      textColor: "#FAF9F6",
      subtextColor: "#E8C585",
      accentColor: "#C8A97E",
      borderColor: "rgba(232, 197, 133, 0.28)",
    },
  },

  // -------------------------------------------------------------------------
  // 5. DIRECT RESPONSE CAMPAIGN (Maps to niche_direct_clean)
  // -------------------------------------------------------------------------
  direct_response: {
    id: "direct_response",
    name: "Direct Response Campaign",
    tagline: "Dioptimasi untuk performa Meta Ads, klik WhatsApp instan, dan penawaran kuat",
    philosophy: "Instant Hook. Prominent CTA. Frictionless Action.",
    recommendedAspectRatios: ["4:5", "9:16", "1:1"],
    typography: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "900",
      headlineCase: "normal",
      letterSpacing: "-0.03em",
      maxHeadlineLines: 2,
    },
    imageTreatment: {
      overlayType: "bottom_vignette",
      vignetteIntensity: 0.55,
      blurBackdrop: false,
    },
    composition: {
      headerPosition: "top_left",
      headlineZone: "bottom_left",
      specsLayout: "inline_dots",
      priceDisplay: "hero_card",
      ctaStyle: "solid_button",
    },
    colorSystem: {
      primaryBg: "rgba(19, 28, 46, 0.90)",
      cardBg: "rgba(19, 28, 46, 0.90)",
      textColor: "#F8FAFC",
      subtextColor: "#F3C978",
      accentColor: "#1F7A5C",
      borderColor: "rgba(243, 201, 120, 0.24)",
    },
  },

  // -------------------------------------------------------------------------
  // 6. LIFESTYLE STORYTELLING (Maps to niche_tropical)
  // -------------------------------------------------------------------------
  lifestyle_storytelling: {
    id: "lifestyle_storytelling",
    name: "Lifestyle Storytelling",
    tagline: "Fokus aspirasi kehangatan keluarga, kenyamanan hidup, dan ruang asri",
    philosophy: "Emotion First. Aspirational Photography. Welcoming Atmosphere.",
    recommendedAspectRatios: ["4:5", "1:1", "9:16"],
    typography: {
      fontFamily: "'Playfair Display', 'Georgia', serif",
      headlineWeight: "700",
      headlineCase: "capitalize",
      letterSpacing: "-0.01em",
      maxHeadlineLines: 2,
    },
    imageTreatment: {
      overlayType: "bottom_vignette",
      vignetteIntensity: 0.4,
      blurBackdrop: false,
    },
    composition: {
      headerPosition: "top_left",
      headlineZone: "bottom_left",
      specsLayout: "inline_dots",
      priceDisplay: "elegant_inline",
      ctaStyle: "pill_accent",
    },
    colorSystem: {
      primaryBg: "rgba(20, 33, 27, 0.88)",
      cardBg: "rgba(20, 33, 27, 0.88)",
      textColor: "#F4F7F4",
      subtextColor: "#DFC39D",
      accentColor: "#287256",
      borderColor: "rgba(183, 215, 200, 0.22)",
    },
  },
};

export function getLayoutFamily(id: string): LayoutFamilyConfig {
  if (id in LAYOUT_FAMILIES) {
    return LAYOUT_FAMILIES[id as LayoutFamilyId];
  }
  const nicheAliases: Record<string, LayoutFamilyId> = {
    niche_minimalist: "minimalist_modern",
    niche_modern_catalog: "property_brochure",
    niche_promo_conversion: "direct_response",
    niche_creative_dock: "architectural_editorial",
    niche_tropical_luxury: "lifestyle_storytelling",
    niche_modern: "property_brochure",
    niche_creative: "architectural_editorial",
    niche_tropical: "lifestyle_storytelling",
    niche_direct_clean: "direct_response",
    auto_director: "property_brochure",
  };
  if (id in nicheAliases) {
    return LAYOUT_FAMILIES[nicheAliases[id]];
  }
  return LAYOUT_FAMILIES.property_brochure;
}
