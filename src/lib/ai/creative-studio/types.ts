import { z } from "zod";

export type AspectRatio = "1:1" | "4:5" | "9:16";

export interface AspectRatioOption {
  id: AspectRatio;
  label: string;
  sublabel: string;
  width: number;
  height: number;
  icon: string;
}

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    id: "1:1",
    label: "1:1 Persegi",
    sublabel: "Instagram Feed & Meta Carousel (1080×1080)",
    width: 1080,
    height: 1080,
    icon: "square",
  },
  {
    id: "4:5",
    label: "4:5 Portrait",
    sublabel: "Instagram Feed & Meta Feed Ads (1080×1350)",
    width: 1080,
    height: 1350,
    icon: "portrait",
  },
  {
    id: "9:16",
    label: "9:16 Vertikal",
    sublabel: "Stories, Reels, Shorts & TikTok (1080×1920)",
    width: 1080,
    height: 1920,
    icon: "vertical",
  },
];

export type DesignFamilyId =
  | "architectural_editorial"
  | "luxury_developer_brochure"
  | "swiss_grid_editorial"
  | "modern_japanese_minimalism"
  | "premium_real_estate_campaign"
  | "contemporary_corporate"
  | "cinematic_architecture"
  | "high_end_property_catalog";

export type PhotographyLightingStyle =
  | "clean_daylight"
  | "luxury_golden_hour"
  | "blue_hour_luxury"
  | "tropical_architecture";

export type StylePreset =
  | "auto_director"
  | DesignFamilyId
  | "niche_minimalist"
  | "niche_modern_catalog"
  | "niche_promo_conversion"
  | "niche_creative_dock"
  | "niche_tropical_luxury"
  | "niche_modern"
  | "niche_creative"
  | "niche_tropical"
  | "niche_direct_clean"
  | "luxury"
  | "minimalist"
  | "corporate"
  | "elegant_corporate"
  | "residential"
  | "modern_residential"
  | "promotional"
  | "high_conversion"
  | "editorial"
  | "editorial_architecture"
  | "creative_freedom"
  | "emerald_minimalist"
  | "luxury_architecture"
  | "royal_navy_metro"
  | "golden_aurora_wave"
  | "kaba_direct_offer"
  | "silpha_architect_diary"
  | "sariwangi_sultan_classic"
  | "gland_ciwastra_amsterdam"
  | "gland_pajajaran_murah_elegant"
  | "bimulia_islamic_ratusan_juta";

export interface StylePresetOption {
  id: StylePreset;
  name: string;
  tagline?: string;
  description: string;
  tag: string;
  accentColor: string;
  fontPairing?: string;
}

export const STYLE_PRESETS: StylePresetOption[] = [
  {
    id: "auto_director",
    name: "Auto Art Director (AI Smart Match)",
    description: "Memilih formula desain dan lighting terbaik secara otomatis berdasarkan karakter properti dan target audiens.",
    tag: "Rekomendasi",
    accentColor: "#2E6F5E",
  },
  {
    id: "architectural_editorial",
    name: "1. Architectural Editorial",
    description: "Estetika sampul majalah arsitektur mewah (Architectural Digest / The Local Project), tipografi serif raksasa & negative space lega.",
    tag: "Editorial Magazine",
    accentColor: "#C8A97E",
    fontPairing: "Playfair Display + Plus Jakarta Sans",
  },
  {
    id: "luxury_developer_brochure",
    name: "2. Luxury Developer Brochure",
    tagline: "Prestise BSD City & Ciputra",
    description: "Brosur resmi developer papan atas, foto fasad hero terbingkai, aksen emas champagne, dan kartu harga asimetris elegan.",
    tag: "Developer Prestige",
    accentColor: "#D4AF37",
    fontPairing: "Cormorant Garamond + Manrope",
  },
  {
    id: "swiss_grid_editorial",
    name: "3. Swiss Grid Editorial",
    description: "Sistem grid presisi asimetris, tipografi grotesque sans modern berkontras tinggi, matriks spesifikasi 4 kolom, dan batas modular 1px.",
    tag: "Precision Grid",
    accentColor: "#0F172A",
    fontPairing: "Inter Black + Plus Jakarta Sans",
  },
  {
    id: "modern_japanese_minimalism",
    name: "4. Modern Japanese Minimalism",
    description: "Konsep wabi-sabi dengan ruang bernafas lega, palet linen & sage alami, letter-spacing lebar menenangkan, dan garis arsitektur tenang.",
    tag: "Zen Minimalism",
    accentColor: "#2C3E35",
    fontPairing: "Shippori Mincho / Georgia + Inter",
  },
  {
    id: "premium_real_estate_campaign",
    name: "5. Premium Real Estate Campaign",
    description: "Format iklan komersial berkonversi tinggi (Meta Ads Champion): badge penawaran kontras tinggi (DP 0% / Free PPN) dan tombol WhatsApp instan.",
    tag: "High-CTR Ads",
    accentColor: "#F59E0B",
    fontPairing: "Plus Jakarta Sans 900 + Inter",
  },
  {
    id: "contemporary_corporate",
    name: "6. Contemporary Corporate",
    description: "Identitas korporat developer terpercaya, palet navy & slate platinum, 3 kolom fasilitas terverifikasi, dan legalitas SHM terjamin.",
    tag: "Corporate Trust",
    accentColor: "#0284C7",
    fontPairing: "Cinzel + Inter",
  },
  {
    id: "cinematic_architecture",
    name: "7. Cinematic Architecture",
    description: "Nuansa dramatis twilight / blue hour dengan pendaran cahaya interior hangat dari balik kaca, kontras tinggi, dan aksen emas mewah.",
    tag: "Cinematic Night",
    accentColor: "#E5C378",
    fontPairing: "Bodoni / Playfair + Plus Jakarta Sans",
  },
  {
    id: "high_end_property_catalog",
    name: "8. High-End Property Catalog",
    description: "Tata letak lookbook katalog properti bergengsi, label tipe unit terstruktur, tabel spesifikasi teknis rapi dengan ikon vektor arsitektur.",
    tag: "Lookbook Catalog",
    accentColor: "#1E3A8A",
    fontPairing: "DM Serif Display + Inter",
  },
  {
    id: "niche_minimalist",
    name: "Pure Minimalist (Legacy)",
    description: "Editorial serif putih di atas langit pagi berembun & spesifikasi ikon garis tipis.",
    tag: "Minimalist",
    accentColor: "#2E6F5E",
  },
  {
    id: "niche_modern_catalog",
    name: "Modern Catalog (Legacy)",
    description: "Gradasi halus Warm Cream #F9F7F1 dan kartu harga asimetris Dark Forest.",
    tag: "Catalog",
    accentColor: "#233329",
  },
  {
    id: "niche_promo_conversion",
    name: "Direct Promo Frame (Legacy)",
    description: "Bingkai tiket promo KPR & Subsidi dengan konversi tinggi.",
    tag: "Promo",
    accentColor: "#374151",
  },
  {
    id: "niche_creative_dock",
    name: "Creative Dual-Dock (Legacy)",
    description: "Kotak harga di langit dan floating bar bawah.",
    tag: "Dual-Dock",
    accentColor: "#385A82",
  },
  {
    id: "niche_tropical_luxury",
    name: "Luxury Editorial (Legacy)",
    description: "Komposisi majalah arsitektur mewah dengan bingkai obsidian & perunggu.",
    tag: "Luxury",
    accentColor: "#D5B88B",
  },
  {
    id: "niche_modern",
    name: "Modern Architectural (Sleek Slate & Glass)",
    description: "Split dock bertransisi gradien halus 64px dengan chip spesifikasi terstruktur dan aksen Calm Emerald.",
    tag: "Sleek Slate & Glass",
    accentColor: "#216E55",
  },
  {
    id: "niche_creative",
    name: "Creative Editorial (Boutique Social Campaign)",
    description: "Memanfaatkan area langit atas untuk header lokasi/promo yang bersih dengan kartu bawah ultra-ringkas.",
    tag: "Boutique Social",
    accentColor: "#C8A97E",
  },
  {
    id: "niche_tropical",
    name: "Tropical Resort & Villa (Earthy Sage & Sand)",
    description: "Gradasi organik Deep Muted Eucalyptus & pasir hangat yang menyatu lembut dengan taman dan pepohonan.",
    tag: "Earthy Sage & Sand",
    accentColor: "#287256",
  },
  {
    id: "niche_direct_clean",
    name: "Direct Performance Clean (Soft Navy & High-CTR)",
    description: "Dock konversi Muted Nordic Navy & Warm Soft Gold dengan keterbacaan harga dan nomor WhatsApp instan.",
    tag: "Soft Navy & High-CTR",
    accentColor: "#1F7A5C",
  },
  {
    id: "emerald_minimalist",
    name: "Emerald Minimalist (Century 21)",
    description: "Nuansa hijau zamrud & emas, kolom ikon spesifikasi vertikal kanan, callout kuas survey emas.",
    tag: "Top Performer",
    accentColor: "#10B981",
  },
  {
    id: "luxury_architecture",
    name: "Luxury Architecture (Garis Bumi)",
    description: "Nuansa mocha espresso & emas metalik, headline raksasa, kartu polaroid interior, tombol WA emas.",
    tag: "High-End Architect",
    accentColor: "#D4AF37",
  },
  {
    id: "royal_navy_metro",
    name: "Royal Navy Elite (Metro Regency)",
    description: "Biru navy kerajaan & bingkai emas, aksen kaligrafi impian, framing daun palem, tombol survey kuning.",
    tag: "Prestigious",
    accentColor: "#38BDF8",
  },
  {
    id: "golden_aurora_wave",
    name: "Golden Aurora (Wave & Price Badge)",
    description: "Pita gelombang emas organik, floating 3D badge harga bulat, checklist spesifikasi bercentang emas.",
    tag: "High Conversion",
    accentColor: "#F59E0B",
  },
  {
    id: "kaba_direct_offer",
    name: "Direct Offer & DP (Kaba Residence)",
    description: "Hijau hutan kontras tinggi, kartu penawaran raksasa DP Cuman 3 Jt, pin lokasi strategis, kontak penuh.",
    tag: "Fast Closing",
    accentColor: "#14532D",
  },
  {
    id: "creative_freedom",
    name: "Creative Freedom (Auto AI Director)",
    description: "AI Creative Director memilih formula visual terbaik dari 5 target referensi sesuai karakter properti.",
    tag: "Auto Adaptive",
    accentColor: "#EC4899",
  },
  {
    id: "luxury",
    name: "Premium Luxury",
    description: "Visual megah, warna gelap elegan atau emas, komposisi arsitektural sinematik.",
    tag: "Luxury Classic",
    accentColor: "#D4AF37",
  },
  {
    id: "minimalist",
    name: "Modern Minimalist",
    description: "Garis bersih, pencahayaan alami cerah, whitespace lega, fokus pada fasad.",
    tag: "Clean & Bright",
    accentColor: "#3B82F6",
  },
  {
    id: "high_conversion",
    name: "High Conversion Ads",
    description: "Badge promo kontras tinggi, harga cicilan jelas terbaca, visual call-to-action kuat.",
    tag: "Performance",
    accentColor: "#F59E0B",
  },
  {
    id: "residential",
    name: "Modern Residential",
    description: "Nuansa hangat keluarga, lanskap hijau asri, fasilitas klaster ramah anak.",
    tag: "Family Living",
    accentColor: "#10B981",
  },
  {
    id: "promotional",
    name: "Promotional Campaign",
    description: "Banner penawaran terbatas, DP 0%, Free PPN, dan cashback menyala.",
    tag: "Big Promo",
    accentColor: "#EF4444",
  },
  {
    id: "corporate",
    name: "Elegant Corporate",
    description: "Desain kredibel, logo developer terkemuka, legalitas SHM terpercaya.",
    tag: "Trust & Credibility",
    accentColor: "#6366F1",
  },
  {
    id: "editorial",
    name: "Editorial Architecture",
    description: "Tipografi majalah arsitektur, framing simetris dramatis, sudut pandang f/2.8.",
    tag: "Design Magazine",
    accentColor: "#8B5CF6",
  },
];

export type AssetCategory =
  | "facade"
  | "interior"
  | "living_room"
  | "bedroom"
  | "environment"
  | "facility"
  | "logo"
  | "other";

export interface AssetCategoryOption {
  id: AssetCategory;
  label: string;
  icon: string;
}

export const ASSET_CATEGORIES: AssetCategoryOption[] = [
  { id: "facade", label: "Fasad Rumah (Exterior)", icon: "home" },
  { id: "interior", label: "Interior Utama", icon: "sofa" },
  { id: "living_room", label: "Ruang Keluarga", icon: "tv" },
  { id: "bedroom", label: "Kamar Tidur", icon: "bed" },
  { id: "environment", label: "Lingkungan / Taman", icon: "trees" },
  { id: "facility", label: "Fasilitas / Kolam Renang", icon: "dumbbell" },
  { id: "logo", label: "Logo Developer / Brand", icon: "badge" },
  { id: "other", label: "Lainnya", icon: "image" },
];

export interface UploadedAsset {
  id: string;
  file?: File;
  previewUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  category: AssetCategory;
  isPrimary: boolean;
  uploadedUrl?: string;
  storagePath?: string;
}

export type UploadedAssetItem = {
  id: string;
  previewUrl: string;
  category: AssetCategory;
  isPrimary: boolean;
  fileName?: string;
};

export interface CreativeBriefInput {
  // Campaign & Project Info
  projectName: string;
  campaignName?: string;
  headline?: string;
  subheadline?: string;
  description?: string;

  // Property Specs
  propertyType?: string;
  propertyLocation?: string;
  startingPrice?: string;
  landArea?: string;
  buildingArea?: string;
  bedrooms?: string;
  bathrooms?: string;
  floors?: string;

  // Promotional Info
  promoHeadline?: string;
  cashback?: string;
  hasFreePpn?: boolean;
  dpAmount?: string;
  monthlyInstallment?: string;
  kprRate?: string;
  promoDeadline?: string;
  ctaText?: string;
  promos?: string[];
  locationAdvantages?: string[];
  hasExplicitProjectName?: boolean;
  fidelityMode?: "preserve_original" | "ai_atmosphere";

  // Optional Brand Assets & Direct Contact (Strictly Conditional)
  logoDataUrl?: string | null;
  logoPlacement?: "top-left" | "top-right" | "auto";
  whatsappNumber?: string | null;
  specsText?: string;

  // Creative Direction
  aspectRatio: AspectRatio;
  stylePreset: StylePreset;
  designFamily?: DesignFamilyId;
  photographyStyle?: PhotographyLightingStyle;
  colorMood?: string;
  targetAudience?: string;

  assets: UploadedAssetItem[];
}

export interface CreativeQualityScore {
  visual: number; // 0 - 100
  readability: number; // 0 - 100
  conversion: number; // 0 - 100
  overall: number; // 0 - 100
  assessmentNotes: string[];
  preFlightReport?: import("./quality-checker").CreativePreFlightReport;
}

export type QualityScoreReport = CreativeQualityScore;

export type LayoutFamilyId =
  | "architectural_editorial"
  | "luxury_developer_brochure"
  | "swiss_grid_editorial"
  | "modern_japanese_minimalism"
  | "premium_real_estate_campaign"
  | "contemporary_corporate"
  | "cinematic_architecture"
  | "high_end_property_catalog"
  | "property_brochure"
  | "minimalist_modern"
  | "premium_investment"
  | "direct_response"
  | "lifestyle_storytelling";

export interface ComposedAdLayout {
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  layoutFamilyId?: LayoutFamilyId;
  designFamily?: DesignFamilyId;
  fidelityMode?: "preserve_original" | "ai_atmosphere";
  backgroundImageUrl: string;
  backgroundUrl: string;
  finalComposedUrl?: string;
  adArchetypeId?: string;
  isPureGeneratedImage?: boolean;
  gradientOverlay: string;
  palette: CreativeStrategy["colorPalette"];
  colorPalette: CreativeStrategy["colorPalette"];
  headline: {
    text: string;
    placement?: string;
    fontFamily?: string;
    fontWeight?: string;
    fontSize?: number | string;
    color?: string;
    position?: string;
  };
  subheadline?: {
    text: string;
    fontSize?: number | string;
    color?: string;
    position?: string;
  };
  priceBadge?: {
    label?: string;
    value?: string;
    rawPrice?: string;
    badgeType?: string;
    subtext?: string;
    position?: string;
    bg?: string;
    textColor?: string;
  };
  promoBadges: Array<{
    text: string;
    color: string;
    bg: string;
  }>;
  promoPills: Array<{
    text: string;
    type?: "primary" | "secondary";
  }>;
  specsPills: string[];
  cta: {
    text: string;
    bg: string;
    textColor: string;
  };
  callToAction: {
    text: string;
    position?: string;
  };
  logoUrl?: string;
  logoDataUrl?: string | null;
  logoPlacement?: "top-left" | "top-right" | "auto";
  whatsappNumber?: string | null;
  specsText?: string;
  hasLogo?: boolean;
  hasWhatsapp?: boolean;
  projectName: string;
  projectDetails?: {
    projectName: string;
    propertyType?: string;
    propertyLocation?: string;
    bedrooms?: string;
    bathrooms?: string;
    buildingArea?: string;
    landArea?: string;
  };
  safeZoneOverlay?: {
    topClearancePercent: number;
    bottomClearancePercent: number;
  };
}

export interface HistoricalGenerationItem {
  id: string;
  project_id?: string;
  aspect_ratio: AspectRatio;
  style_preset: StylePreset;
  width: number;
  height: number;
  raw_image_url: string;
  final_composed_url: string;
  creative_direction: CreativeStrategy;
  prompt_used: string;
  quality_score: CreativeQualityScore;
  status: string;
  created_at: string;
  project?: {
    id: string;
    project_name: string;
    campaign_name?: string;
    headline?: string;
    subheadline?: string;
    property_type?: string;
    property_location?: string;
    starting_price?: number;
    promo_headline?: string;
    cta_text?: string;
  };
}

export interface CreativeStrategy {
  styleName: string;
  adArchetypeId?: string;
  headlinePlacement: "top-left" | "top-center" | "bottom-left" | "bottom-hero";
  priceBadgePosition: "bottom-right" | "top-right" | "hero-overlay";
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    backgroundOverlay: string;
    textColor: string;
  };
  typography: {
    headlineWeight: string;
    fontFamily: string;
    letterSpacing: string;
  };
  marketingAngle: string;
  visualCompositionBrief: string;
  imagePrompt: string;
}

export interface GeneratedAdCreative {
  id: string;
  projectId: string;
  aspectRatio: AspectRatio;
  stylePreset: StylePreset;
  width: number;
  height: number;
  rawImageUrl: string;
  finalComposedUrl: string;
  creativeDirection: CreativeStrategy;
  promptUsed: string;
  qualityScore: CreativeQualityScore;
  revisionHistory: Array<{
    timestamp: string;
    instruction: string;
    appliedChanges: string;
  }>;
  createdAt: string;
}

export interface CreativeVariationItem {
  id: string;
  generationId: string;
  label: string;
  stylePreset: StylePreset;
  layoutFamilyId?: LayoutFamilyId;
  finalComposedUrl: string;
  headline: string;
  accentColor: string;
  creativeDirection: CreativeStrategy;
}

// Zod validation schemas
export const CreativeBriefSchema = z.object({
  projectName: z.string().default(""),
  campaignName: z.string().optional().default(""),
  headline: z.string().optional().default(""),
  subheadline: z.string().optional().default(""),
  description: z.string().optional().default(""),
  propertyType: z.string().optional().default("Rumah Tinggal"),
  propertyLocation: z.string().optional().default(""),
  startingPrice: z.string().optional().default(""),
  landArea: z.string().optional().default(""),
  buildingArea: z.string().optional().default(""),
  bedrooms: z.string().optional().default(""),
  bathrooms: z.string().optional().default(""),
  floors: z.string().optional().default(""),
  promoHeadline: z.string().optional().default(""),
  cashback: z.string().optional().default(""),
  hasFreePpn: z.boolean().optional().default(false),
  dpAmount: z.string().optional().default(""),
  monthlyInstallment: z.string().optional().default(""),
  kprRate: z.string().optional().default(""),
  promoDeadline: z.string().optional().default(""),
  ctaText: z.string().optional().default("Hubungi Sekarang"),
  aspectRatio: z.enum(["1:1", "4:5", "9:16"]).default("4:5"),
  stylePreset: (z.string().default("high_conversion") as unknown as z.ZodType<StylePreset>),
  designFamily: z.enum([
    "architectural_editorial",
    "luxury_developer_brochure",
    "swiss_grid_editorial",
    "modern_japanese_minimalism",
    "premium_real_estate_campaign",
    "contemporary_corporate",
    "cinematic_architecture",
    "high_end_property_catalog",
  ]).optional(),
  photographyStyle: z.enum(["clean_daylight", "luxury_golden_hour", "blue_hour_luxury", "tropical_architecture"]).optional().default("clean_daylight"),
  colorMood: z.string().optional(),
  targetAudience: z.string().optional(),
  promos: z.array(z.string()).optional().default([]),
  locationAdvantages: z.array(z.string()).optional().default([]),
  hasExplicitProjectName: z.boolean().optional().default(false),
  fidelityMode: z.enum(["preserve_original", "ai_atmosphere"]).optional(),
  logoDataUrl: z.string().nullable().optional(),
  logoPlacement: z.enum(["top-left", "top-right", "auto"]).optional().default("auto"),
  whatsappNumber: z.string().nullable().optional(),
  specsText: z.string().optional(),
  assets: z.array(z.object({
    id: z.string(),
    previewUrl: z.string(),
    category: z.enum([
      "facade",
      "interior",
      "living_room",
      "bedroom",
      "environment",
      "facility",
      "logo",
      "other",
    ]),
    isPrimary: z.boolean(),
    fileName: z.string().optional(),
  })).optional().default([]),
});
