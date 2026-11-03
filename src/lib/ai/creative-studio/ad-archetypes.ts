import type { AspectRatio } from "./types";

export type AdArchetypeId =
  | "emerald_minimalist"
  | "luxury_architecture"
  | "royal_navy_metro"
  | "golden_aurora_wave"
  | "kaba_direct_offer";

export interface AdArchetype {
  id: AdArchetypeId;
  name: string;
  subtitle: string;
  tag: string;
  referenceFile: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    accentGold: string;
    surface: string;
    text: string;
    textMuted: string;
  };
  typography: {
    headlineFont: string;
    scriptFont?: string;
    bodyFont: string;
    headlineCase: "uppercase" | "capitalize" | "mixed";
  };
  headerStyle: "ribbon_corner" | "luxury_emblem" | "dual_logo_frame" | "organic_wave" | "minimal_capsule";
  badgeStyle: "right_vertical_icons" | "blueprint_polaroid" | "hex_pills" | "circular_3d_price" | "mega_offer_card";
  ctaStyle: "golden_brush" | "metallic_gold_pill" | "survey_yellow_capsule" | "minimal_action" | "full_contact_bar";
  designNotes: string;
}

export const AD_ARCHETYPES: Record<AdArchetypeId, AdArchetype> = {
  emerald_minimalist: {
    id: "emerald_minimalist",
    name: "Emerald Modern Minimalist",
    subtitle: "Inspirasi: Century 21 Minimalist Campaign",
    tag: "High Trust • Modern Cluster",
    referenceFile: "ref1-emerald-minimalist.jpg",
    palette: {
      primary: "#064E3B", // Deep Emerald Green
      secondary: "#022C22", // Forest Midnight
      accent: "#10B981", // Fresh Green
      accentGold: "#F59E0B", // Warm Amber Gold
      surface: "#FFFFFF",
      text: "#0F172A",
      textMuted: "#64748B",
    },
    typography: {
      headlineFont: "'Montserrat', 'Inter', sans-serif",
      scriptFont: "'Playfair Display', 'Brush Script MT', cursive",
      bodyFont: "system-ui, -apple-system, sans-serif",
      headlineCase: "mixed", // e.g. "Rumah MINIMALIS"
    },
    headerStyle: "ribbon_corner",
    badgeStyle: "right_vertical_icons",
    ctaStyle: "golden_brush",
    designNotes:
      "Header pita sudut 'HUNIAN MODERN & NYAMAN', tipografi judul kombinasi script elegan + sans ultra-bold, kolom spesifikasi vertikal di sisi kanan dengan ikon lingkaran gelap (KT, KM, Carport, Keamanan 24 Jam), footer bertekstur hijau zamrud dengan callout kuas emas 'Yuk Survey Sekarang!'.",
  },
  luxury_architecture: {
    id: "luxury_architecture",
    name: "Luxury Architectural Showcase",
    subtitle: "Inspirasi: Garis Bumi Design & Build",
    tag: "Ultra Luxury • Custom Build",
    referenceFile: "ref2-luxury-architecture.jpg",
    palette: {
      primary: "#1C1917", // Rich Dark Espresso
      secondary: "#292524", // Warm Bronze Black
      accent: "#D4AF37", // Polished Metallic Gold
      accentGold: "#EAB308", // Bright Gold
      surface: "#FAFAF9",
      text: "#FFFFFF",
      textMuted: "#A8A29E",
    },
    typography: {
      headlineFont: "'Montserrat', 'Cinzel', sans-serif",
      bodyFont: "system-ui, -apple-system, sans-serif",
      headlineCase: "uppercase", // e.g. "HUBUNGI KAMI"
    },
    headerStyle: "luxury_emblem",
    badgeStyle: "blueprint_polaroid",
    ctaStyle: "metallic_gold_pill",
    designNotes:
      "Logo studio arsitektur geometris emas, headline raksasa 'HUBUNGI KAMI' bernuansa gradien bronze-gold, kartu inset foto polaroid interior living room dan denah arsitektur, kartu info melengkung espresso gelap, tombol WhatsApp emas menyala dengan nomor telepon jelas.",
  },
  royal_navy_metro: {
    id: "royal_navy_metro",
    name: "Royal Navy Metro Elite",
    subtitle: "Inspirasi: Property Hebat / Metro Regency",
    tag: "Elite Residence • Premium City",
    referenceFile: "ref3-royal-navy-metro.jpg",
    palette: {
      primary: "#0F172A", // Royal Navy Blue
      secondary: "#0A0F1D", // Deep Midnight
      accent: "#38BDF8", // Sky Blue
      accentGold: "#F59E0B", // Lustrous Gold Frame
      surface: "#FFFFFF",
      text: "#0F172A",
      textMuted: "#475569",
    },
    typography: {
      headlineFont: "'Montserrat', 'Cinzel', serif",
      scriptFont: "'Brush Script MT', 'Dancing Script', cursive",
      bodyFont: "system-ui, -apple-system, sans-serif",
      headlineCase: "uppercase", // e.g. "METRO REGENCY"
    },
    headerStyle: "dual_logo_frame",
    badgeStyle: "hex_pills",
    ctaStyle: "survey_yellow_capsule",
    designNotes:
      "Header logo ganda developer & proyek dengan bingkai emas bergaris, judul 'METRO REGENCY' terbingkai elegan, aksen teks kaligrafi 'Wujudkan Rumah Impian Anda!', framing dedaunan palem tropis di sudut kanvas, tombol kapsul kuning 'Konsultasi & Survey Sekarang >', dock bawah biru laut dengan WhatsApp dan Instagram.",
  },
  golden_aurora_wave: {
    id: "golden_aurora_wave",
    name: "Golden Aurora Exclusive",
    subtitle: "Inspirasi: Golden Aurora Cluster",
    tag: "Warm Sunset • High Aesthetic",
    referenceFile: "ref4-golden-aurora-wave.jpg",
    palette: {
      primary: "#D4AF37", // Champagne Gold
      secondary: "#78350F", // Warm Amber Bronze
      accent: "#F59E0B", // Bright Goldenrod
      accentGold: "#FBBF24", // Luminous Gold
      surface: "#FFFDF7", // Warm Ivory Cream
      text: "#1E293B",
      textMuted: "#64748B",
    },
    typography: {
      headlineFont: "'Playfair Display', serif",
      scriptFont: "'Great Vibes', 'Allura', cursive",
      bodyFont: "system-ui, -apple-system, sans-serif",
      headlineCase: "capitalize", // e.g. "Golden Aurora"
    },
    headerStyle: "organic_wave",
    badgeStyle: "circular_3d_price",
    ctaStyle: "minimal_action",
    designNotes:
      "Header pita gelombang emas organik dengan logo siluet gunung/matahari emas, badge harga bulat 3D mengambang 'Harga Mulai 340 JUTA*', kartu bawah putih krem melengkung berisi 2 kolom checklist spesifikasi bercentang emas (One Gate, 24 Jam, Taman), aksen dedaunan hijau di tepi kanvas.",
  },
  kaba_direct_offer: {
    id: "kaba_direct_offer",
    name: "High-Impact Direct Offer",
    subtitle: "Inspirasi: Kaba Residence Campaign",
    tag: "High Conversion • Fast Closing",
    referenceFile: "ref5-kaba-direct-offer.jpg",
    palette: {
      primary: "#14532D", // Deep Forest Green
      secondary: "#052E16", // Midnight Green
      accent: "#EAB308", // Energetic Yellow
      accentGold: "#FACC15", // Punchy Gold
      surface: "#FFFFFF",
      text: "#0F172A",
      textMuted: "#475569",
    },
    typography: {
      headlineFont: "'Inter', 'Montserrat', sans-serif",
      bodyFont: "system-ui, -apple-system, sans-serif",
      headlineCase: "mixed", // e.g. "DP Cuman 3 juta"
    },
    headerStyle: "minimal_capsule",
    badgeStyle: "mega_offer_card",
    ctaStyle: "full_contact_bar",
    designNotes:
      "Logo minimalis dengan kapsul tipe unit kuning, kartu penawaran raksasa hijau tua bersudut bulat dengan teks kontras tinggi 'DP Cuman 3 juta', penanda lokasi pin peta hijau dengan teks fasilitas/kampus terdekat, strip kontak bawah hijau solid dengan ikon WhatsApp, web, dan medsos.",
  },
};

export const ARCHETYPE_LIST: AdArchetype[] = Object.values(AD_ARCHETYPES);

const EXTENDED_ARCHETYPES: Record<string, AdArchetype> = {
  auto_director: {
    ...AD_ARCHETYPES.emerald_minimalist,
    name: "Auto Niche Director (AI Smart Match)",
    subtitle: "AI Smart Match Architecture",
    tag: "Rekomendasi • Adaptive",
    designNotes:
      "Komposisi otomatis berstandar agensi dengan palet lembut yang menyatu alami dengan pencahayaan foto rumah, ruang langit proporsional di bagian atas, dan kartu informasi terstruktur di bagian bawah.",
  },
  niche_minimalist: {
    ...AD_ARCHETYPES.emerald_minimalist,
    name: "Pure Minimalist (Japandi & Warm Stone)",
    subtitle: "Japandi & Warm Stone Aesthetic",
    tag: "Pure Minimalist",
    palette: {
      primary: "#1C1917",
      secondary: "#2C2825",
      accent: "#2E6F5E",
      accentGold: "#E7D8C5",
      surface: "#F5F3EF",
      text: "#FAF8F5",
      textMuted: "#D6C7B2",
    },
    designNotes:
      "Gaya Pure Minimalist (Japandi & Warm Stone): kartu informasi melayang bersudut membulat (radius 24px, margin 28px) dengan latar batu hangat rgba(28,25,23,0.86), teks putih hangat #FAF8F5, harga warna pasir lembut #E7D8C5, dan tombol aksi hijau sage kalem #2E6F5E.",
  },
  niche_modern: {
    ...AD_ARCHETYPES.royal_navy_metro,
    name: "Modern Architectural (Sleek Slate & Glass)",
    subtitle: "Sleek Slate & Glass Architecture",
    tag: "Modern Architectural",
    palette: {
      primary: "#14181F",
      secondary: "#1E293B",
      accent: "#216E55",
      accentGold: "#F1F5F9",
      surface: "#F8FAFC",
      text: "#F8FAFC",
      textMuted: "#94A3B8",
    },
    designNotes:
      "Gaya Modern Architectural (Sleek Slate & Glass): split dock bawah dengan transisi gradien halus 64px berwarna slate gelap rgba(20,24,31,0.88), chip spesifikasi terstruktur berbingkai #94A3B8, dan tombol CTA hijau zamrud tenang #216E55.",
  },
  niche_creative: {
    ...AD_ARCHETYPES.luxury_architecture,
    name: "Creative Editorial (Boutique Social Campaign)",
    subtitle: "Boutique Social Campaign",
    tag: "Creative Editorial",
    palette: {
      primary: "#161619",
      secondary: "#2A2723",
      accent: "#C8A97E",
      accentGold: "#E8C585",
      surface: "#FAF9F6",
      text: "#FFFFFF",
      textMuted: "#E8C585",
    },
    designNotes:
      "Gaya Creative Editorial (Boutique Social Campaign): memanfaatkan area langit atas untuk penanda lokasi dan promo yang bersih serta kartu melayang bawah yang sangat ringkas dengan aksen champagne lembut #E8C585 dan tombol #C8A97E.",
  },
  niche_tropical: {
    ...AD_ARCHETYPES.emerald_minimalist,
    name: "Tropical Resort & Villa (Earthy Sage & Sand)",
    subtitle: "Earthy Sage & Sand Resort",
    tag: "Tropical Resort",
    palette: {
      primary: "#14211B",
      secondary: "#233B30",
      accent: "#287256",
      accentGold: "#DFC39D",
      surface: "#F4F7F4",
      text: "#F4F7F4",
      textMuted: "#B7D7C8",
    },
    designNotes:
      "Gaya Tropical Resort & Villa (Earthy Sage & Sand): gradasi organik hijau eucalyptus lembut rgba(20,33,27,0.88) yang menyatu halus dengan taman depan, teks harga pasir hangat #DFC39D, dan tombol #287256.",
  },
  niche_direct_clean: {
    ...AD_ARCHETYPES.royal_navy_metro,
    name: "Direct Performance Clean (Soft Navy & High-CTR)",
    subtitle: "Soft Navy & High-CTR Conversion",
    tag: "Direct Performance",
    palette: {
      primary: "#131C2E",
      secondary: "#23324D",
      accent: "#1F7A5C",
      accentGold: "#F3C978",
      surface: "#F8FAFC",
      text: "#F8FAFC",
      textMuted: "#CBD5E1",
    },
    designNotes:
      "Gaya Direct Performance Clean (Soft Navy & High-CTR): dock konversi biru nordic tenang rgba(19,28,46,0.90) dengan keterbacaan harga emas lembut #F3C978 dalam 3 detik dan integrasi tombol WhatsApp #1F7A5C.",
  },
  niche_modern_catalog: {
    ...AD_ARCHETYPES.emerald_minimalist,
    name: "Modern Catalog (Warm Cream Fade & Asymmetric Price Card)",
    subtitle: "Warm Cream Fade & Forest Price Card",
    tag: "Modern Catalog",
    palette: {
      primary: "#233329",
      secondary: "#1B3022",
      accent: "#8C8253",
      accentGold: "#E8D5B5",
      surface: "#F9F7F1",
      text: "#1B3022",
      textMuted: "#4A5D50",
    },
    designNotes:
      "Gaya Modern Catalog: gradasi halus Warm Cream #F9F7F1 di bagian bawah, grid spesifikasi 2 baris berikon vektor #1B3022, dan kartu harga asimetris Dark Forest #233329 di sisi kanan.",
  },
  niche_promo_conversion: {
    ...AD_ARCHETYPES.kaba_direct_offer,
    name: "Direct Promo Frame (High-CTR KPR & Subsidi Ticket)",
    subtitle: "High-CTR KPR & Subsidi Ticket",
    tag: "Promo Conversion",
    palette: {
      primary: "#374151",
      secondary: "#4B5563",
      accent: "#374151",
      accentGold: "#CBD5E1",
      surface: "#F4F5F7",
      text: "#374151",
      textMuted: "#4B5563",
    },
    designNotes:
      "Gaya Direct Promo Frame: langit pagi hangat #E5D9C8, gradasi putih lembut #F4F5F7 di bawah dengan bingkai tiket 3 kolom (#CBD5E1) untuk Promo DP, Harga/Cicilan, dan keuntungan Free PPN/KPR.",
  },
  niche_creative_dock: {
    ...AD_ARCHETYPES.royal_navy_metro,
    name: "Creative Dual-Dock (Sky Box & Double Floating Pills)",
    subtitle: "Sky Box & Double Floating Pills",
    tag: "Creative Dual-Dock",
    palette: {
      primary: "#385A82",
      secondary: "#4A80B8",
      accent: "#385A82",
      accentGold: "#FFFFFF",
      surface: "#F4F5F7",
      text: "#FFFFFF",
      textMuted: "#E2E8F0",
    },
    designNotes:
      "Gaya Creative Dual-Dock: kotak harga translusen di langit biru #4A80B8 serta 2 bar kapsul melayang di bagian bawah (Slate Blue #385A82 untuk ikon spesifikasi dan Soft Alabaster #F4F5F7 untuk promo & kontak).",
  },
  niche_tropical_luxury: {
    ...AD_ARCHETYPES.luxury_architecture,
    name: "Luxury Editorial (Matte Obsidian & Brushed Bronze)",
    subtitle: "Matte Obsidian & Brushed Bronze",
    tag: "Luxury Editorial",
    palette: {
      primary: "#161514",
      secondary: "#262320",
      accent: "#D5B88B",
      accentGold: "#D5B88B",
      surface: "#FAF8F5",
      text: "#FAF8F5",
      textMuted: "#D5B88B",
    },
    designNotes:
      "Gaya Luxury Editorial: gradasi halus Matte Obsidian #161514 di bagian bawah, tipografi harga serif Champagne Gold #D5B88B, dan bingkai tipis perunggu.",
  },
  silpha_architect_diary: {
    ...AD_ARCHETYPES.luxury_architecture,
    name: "Architect Project Diary",
    subtitle: "Inspirasi: Silpha Karya Design",
    tag: "Editorial • Warm Alabaster",
    designNotes:
      "Komposisi editorial hangat bernuansa krem alabaster, judul bercerita dengan highlight kata kunci warna terracotta, aksen catatan kertas Project Diary dan sketsa denah arsitektur di sudut atas, foto fasad rumah tropis modern yang terang dan bersih.",
  },
  sariwangi_sultan_classic: {
    ...AD_ARCHETYPES.royal_navy_metro,
    name: "Sultan Classic Elegance",
    subtitle: "Inspirasi: Gan Properti / Sariwangi Village",
    tag: "Classic European • High Prestige",
    designNotes:
      "Tata letak simetris megah bergaya klasik Eropa, judul metalik tegas di bagian atas, badge bulat biru tua-emas mengambang untuk DP/Promo dan bonus fasilitas (Smart Door Lock, Kitchen Set), serta daftar lokasi strategis dengan aksen emas di bagian bawah.",
  },
  gland_ciwastra_amsterdam: {
    ...AD_ARCHETYPES.emerald_minimalist,
    name: "Amsterdam European Vibe",
    subtitle: "Inspirasi: G-Land Ciwastra Park",
    tag: "Scandinavian Brick • Clean White",
    designNotes:
      "Latar langit cerah bersih berpadu dengan gradasi putih lembut di bagian bawah, badge bulat kuning 'MODEL TERBARU' di dekat atap pelana bata ekspos, pita kapsul hijau teal untuk penawaran booking fee, dan 2 kolom checklist aksesibilitas dengan ikon centang hijau.",
  },
  gland_pajajaran_murah_elegant: {
    ...AD_ARCHETYPES.kaba_direct_offer,
    name: "Murah Elegant & Free PPN",
    subtitle: "Inspirasi: G-Land Pajajaran Residence",
    tag: " Promo PPN • Fast Closing",
    designNotes:
      "Headline kontras tinggi dengan highlight box hijau zamrud dan pita miring kuning-oranye untuk '100% FREE PPN', fasad rumah tropis modern di tengah, diikuti 4 poin keunggulan lokasi berikon centang oranye dan bar kontak resmi di bagian bawah.",
  },
};

export function getArchetype(id?: string): AdArchetype {
  if (id && id in AD_ARCHETYPES) {
    return AD_ARCHETYPES[id as AdArchetypeId];
  }
  if (id && id in EXTENDED_ARCHETYPES) {
    return EXTENDED_ARCHETYPES[id];
  }
  return AD_ARCHETYPES.emerald_minimalist;
}

/**
 * Automatically infers the most suitable archetype if user selects "Auto Art Director"
 */
export function inferArchetypeFromBrief(brief: {
  startingPrice?: string;
  projectName?: string;
  hasFreePpn?: boolean;
  dpAmount?: string;
  cashback?: string;
  targetAudience?: string;
}): AdArchetype {
  const priceRaw = (brief.startingPrice || "").replace(/[^0-9]/g, "");
  const priceNum = Number(priceRaw) || 0;
  const projectLower = (brief.projectName || "").toLowerCase();

  // 1. Direct promo/DP focus -> Kaba Residence Style
  if (
    (brief.dpAmount && (brief.dpAmount.includes("0") || brief.dpAmount.includes("Juta"))) ||
    brief.hasFreePpn ||
    brief.cashback
  ) {
    return AD_ARCHETYPES.kaba_direct_offer;
  }

  // 2. Ultra Luxury / Architect build -> Garis Bumi Style
  if (
    priceNum >= 2000000000 ||
    projectLower.includes("mansion") ||
    projectLower.includes("villa") ||
    projectLower.includes("luxury")
  ) {
    return AD_ARCHETYPES.luxury_architecture;
  }

  // 3. Royal / Regency / Elite -> Metro Regency Style
  if (
    projectLower.includes("regency") ||
    projectLower.includes("metro") ||
    projectLower.includes("royal") ||
    projectLower.includes("grand")
  ) {
    return AD_ARCHETYPES.royal_navy_metro;
  }

  // 4. Affordable / First Home / Golden Sunset -> Golden Aurora Style
  if (priceNum > 0 && priceNum < 600000000) {
    return AD_ARCHETYPES.golden_aurora_wave;
  }

  // Default: Emerald Minimalist (Century 21)
  return AD_ARCHETYPES.emerald_minimalist;
}

/**
 * Builds pure photorealistic architectural photography prompt for Meta Muse Image 1.0 (Layer 1).
 * Zero in-image text, zero hallucinated prices, zero fake logos.
 * Generates an ultra-realistic, magazine-grade architectural backdrop ready for deterministic Canvas 2D overlay.
 */
export function buildPureArchitecturalPhotoPrompt(params: {
  aspectRatio: AspectRatio;
  projectName?: string;
  propertyType?: string;
  propertyLocation?: string;
  lightingStyle?: "clean_daylight" | "luxury_golden_hour" | "blue_hour_luxury" | "tropical_architecture";
  hasReferenceImage?: boolean;
}): string {
  const {
    aspectRatio,
    projectName,
    propertyType = "rumah modern 2 lantai",
    propertyLocation = "Indonesia",
    lightingStyle = "clean_daylight",
    hasReferenceImage = false,
  } = params;

  let lightingDesc =
    "Crisp, bright natural daylight under a soft clear sky with subtle atmospheric clouds, high sun angle casting clean soft architectural shadows, highly realistic exterior illumination.";
  if (lightingStyle === "luxury_golden_hour") {
    lightingDesc =
      "Warm luxury golden hour sunlight, low-angle directional amber glow grazing the facade, long gentle shadows, warm sky with soft peach and amber tones, high-end real estate photography.";
  } else if (lightingStyle === "blue_hour_luxury") {
    lightingDesc =
      "Cinematic twilight blue hour, deep royal indigo evening sky, warm golden interior lighting visibly glowing through clean glass windows, exterior architectural wall sconces and landscape path lights softly illuminated.";
  } else if (lightingStyle === "tropical_architecture") {
    lightingDesc =
      "Balanced diffused tropical daylight, lush green landscaping with monstera, palms, and native foliage, warm teak wood accents, serene tropical sanctuary atmosphere.";
  }

  const ratioDesc =
    aspectRatio === "9:16"
      ? "Vertical 9:16 frame composition, building positioned with ample clean sky above and paved driveway below, leaving room for advertising layout."
      : aspectRatio === "4:5"
      ? "Portrait 4:5 frame composition, house perfectly centered horizontally with clean roofline visible and tidy front carport."
      : "Square 1:1 frame composition, symmetrical balanced architectural framing showing complete facade from ground to roof.";

  if (hasReferenceImage) {
    return `[STRICT ARCHITECTURAL PRESERVATION] Convert the provided architectural render into an exceptionally realistic high-end architectural photograph. 1. ARCHITECTURAL FIDELITY: Preserve 100% of the building architecture, geometry, proportions, roof structure, facade composition, windows, and doors exactly. 2. LIGHTING & ENVIRONMENT: ${lightingDesc} 3. COMPOSITION: ${ratioDesc} 4. ULTRA REALISTIC: Professional full-frame architectural photography captured on Hasselblad H6D-100c, 35mm f/8, ultra-sharp detail, natural brick, concrete, glass, and wood textures. STRICT GUARDRAIL: NO IN-IMAGE TEXT, NO TYPOGRAPHY, NO LOGOS, NO WATERMARKS, NO GRAPHIC OVERLAYS, NO BORDERS, NO PRICE TAGS, NO POSTER ELEMENTS. PURE PHOTO ONLY.`;
  }

  return `World-class architectural photograph of a luxury contemporary 2-story residential home ${
    projectName ? `at '${projectName}'` : ""
  } in ${propertyLocation}. Clean geometric lines, modern facade with travertine stone, warm timber slats, large floor-to-ceiling glass windows, tidy paved carport with premium vehicle, minimalist landscaped front garden. ${lightingDesc} ${ratioDesc} Professional architectural magazine editorial photography captured on Hasselblad H6D-100c, 35mm f/8, hyper-realistic, 8k resolution, crisp natural textures. STRICT GUARDRAIL: NO IN-IMAGE TEXT, NO TYPOGRAPHY, NO LOGOS, NO WATERMARKS, NO GRAPHIC OVERLAYS, NO BORDERS, NO PRICE TAGS, NO POSTER ELEMENTS. PURE PHOTOGRAPHY ONLY.`;
}

/**
 * Builds the comprehensive prompt for Meta Muse Image 1.0 to synthesize a 100% complete ad flyer
 * Uses the proven natural Indonesian brochure directive ("buat jadi brosur properti ...")
 * that triggers Muse Image 1.0's agentic graphic layout and in-image typography pipeline.
 */
export function buildMuseAdGenerationPrompt(params: {
  archetype: AdArchetype;
  aspectRatio: AspectRatio;
  projectName: string;
  propertyType?: string;
  propertyLocation?: string;
  startingPrice?: string;
  promoText?: string;
  specs?: string[];
  contactNumber?: string | null;
  ctaText?: string;
  headline?: string;
  targetAudience?: string;
  locationAdvantages?: string[];
  hasReferenceImage?: boolean;
  hasLogo?: boolean;
  logoPlacement?: "top-left" | "top-right" | "auto";
}): string {
  const {
    archetype,
    aspectRatio,
    projectName,
    propertyType,
    propertyLocation,
    startingPrice,
    promoText,
    specs,
    contactNumber,
    ctaText,
    headline,
    targetAudience,
    locationAdvantages,
    hasReferenceImage,
    hasLogo,
    logoPlacement,
  } = params;

  const cleanLocation = propertyLocation?.trim() || "Lokasi Strategis";
  const cleanTitle = headline?.trim() || (projectName ? `Hunian di ${projectName}` : "Hunian Modern Siap Huni");
  const cleanPrice = startingPrice?.trim() || "";
  const cleanPromo = promoText?.trim() || "";
  const cleanContact = contactNumber?.trim() || "";
  const cleanCta = ctaText?.trim() || "Hubungi Kami Sekarang";
  const specList = (specs || []).map((s) => s.trim()).filter(Boolean);
  const specString = specList.slice(0, 4).join(", ");
  const locAdvString = (locationAdvantages || []).map((l) => l.trim()).filter(Boolean).join(", ");

  let ratioDirective = `Format: ${aspectRatio} commercial real estate advertisement poster (1080x1350 piksel Feed). Seluruh teks judul '${cleanTitle}', penanda lokasi '${cleanLocation}', badge promo, spesifikasi, dan kontak WhatsApp berada di zona aman tengah dan tidak terpotong di tepi atas maupun bawah.`;
  if (aspectRatio === "9:16") {
    ratioDirective = `Format: 9:16 vertikal commercial real estate advertisement poster untuk Instagram Stories & Reels (1080x1920 piksel). Seluruh teks judul '${cleanTitle}', penanda lokasi '${cleanLocation}', badge promo, kartu spesifikasi, dan tombol aksi WAJIB diposisikan secara kompak di zona aman tengah agar tidak terpotong atau tertutup antarmuka aplikasi.`;
  } else if (aspectRatio === "1:1") {
    ratioDirective = `Format: 1:1 commercial real estate advertisement poster persegi simetris (1080x1080 piksel) untuk Instagram Feed dengan margin aman 64px di setiap sisi. Pastikan judul di atas tidak menutupi atap bangunan dan kartu informasi di bagian bawah tertata kompak serta proporsional.`;
  }

  const logoCornerText =
    logoPlacement === "top-left" ? "kiri atas (top-left)" : "kanan atas (top-right)";
  const logoDirective = hasLogo
    ? `AREA KHUSUS LOGO DEVELOPER: Kosongkan sudut ${logoCornerText} kanvas (sekitar 260x110 piksel berupa latar bersih tanpa teks judul atau stiker promo) untuk penempatan Logo Developer resmi agar tidak bertabrakan dengan teks.`
    : "";

  const promptSegments: string[] = [
    "buat jadi brosur properti",
    `Buatkan iklan brosur ${projectName ? `'${projectName}' ` : ""}${propertyType || "rumah modern 2 lantai"} di ${cleanLocation}.`,
    `Judul utama: '${cleanTitle}'.`,
  ];

  if (cleanPrice) {
    promptSegments.push(`Harga mulai ${cleanPrice}.`);
  }
  if (cleanPromo) {
    promptSegments.push(`Promo: ${cleanPromo}.`);
  }
  if (specString) {
    promptSegments.push(`Spesifikasi: ${specString}.`);
  }
  if (locAdvString) {
    promptSegments.push(`Keunggulan lokasi: ${locAdvString}.`);
  }
  if (targetAudience?.trim()) {
    promptSegments.push(`Target: ${targetAudience.trim()}.`);
  }
  if (cleanContact) {
    promptSegments.push(`Kontak WhatsApp: ${cleanContact} (${cleanCta}).`);
  } else {
    promptSegments.push(`Tombol CTA: '${cleanCta}' (tanpa mencantumkan nomor telepon).`);
  }

  promptSegments.push(ratioDirective);
  if (logoDirective) {
    promptSegments.push(logoDirective);
  }
  promptSegments.push(`Formula Desain Visual: ${archetype.name}. ${archetype.designNotes}`);
  promptSegments.push(
    `Tata letak brosur komersial profesional: banner header atas berpenanda lokasi '${cleanLocation}', foto fasad bangunan properti di tengah yang tajam dan bersih${
      cleanPromo ? `, badge promo kontras tinggi '${cleanPromo}'` : ""
    }${
      specString ? `, kartu spesifikasi rapi di bagian bawah (${specString})` : ""
    }, serta ${
      cleanContact ? `pita kontak WhatsApp '${cleanContact}'` : `tombol CTA '${cleanCta}'`
    } di posisi bawah zona aman.`
  );
  promptSegments.push(
    `ATURAN ANTI-HALUSINASI KETAT: HANYA tulis teks fakta Bahasa Indonesia yang disebutkan di atas secara akurat tanpa typo. JANGAN mengarang nomor telepon palsu, harga palsu, atau fasilitas tambahan yang tidak tertulis di dalam brief.${
      hasReferenceImage
        ? " PERTAHANKAN 100% keaslian bentuk fasad, atap, dan struktur arsitektur bangunan dari foto referensi yang dilampirkan."
        : ""
    }`
  );

  if (hasReferenceImage) {
    promptSegments.push(
      `[STRICT ARCHITECTURAL PRESERVATION PROTOCOL] 1. LOCK 100% OF THE BUILDING GEOMETRY: Keep exact roof shape, windows, walls, and carport vehicles in the center zone untouched. 2. EXTEND SKY & FOREGROUND ONLY: Seamlessly extend ONLY the upper sky and lower driveway/paving to fit the target ${aspectRatio} aspect ratio. 3. NO CROPPING: Fit the full width of the house cleanly inside the frame. STRICT RULES FOR IMAGE GENERATION: 1. PRESERVE 100% OF THE BUILDING STRUCTURE: Keep exact roof geometry (never turn a flat roof into a pitched roof), exact window/door positions, materials, and single carport state. 2. NO CROPPING: Fit the full width of the house cleanly inside the ${aspectRatio} frame. 3. FLEXIBLE SKY ADJUSTMENT ONLY: Extend and harmonize ONLY the upper sky and natural ambient lighting to match the ${archetype.name} mood so it blends seamlessly with the house.`
    );
  } else {
    promptSegments.push(
      `[HIGH RESOLUTION ARCHITECTURAL REALISM] Foto arsitektur fasad rumah modern 2 lantai mewah dan elegan, pencahayaan alami daylight terang, langit biru jernih dengan awan tipis, carport rapi dengan mobil terparkir, halaman depan asri. Desain tata letak brosur profesional beresolusi tinggi.`
    );
  }

  return promptSegments.join(" ");
}
