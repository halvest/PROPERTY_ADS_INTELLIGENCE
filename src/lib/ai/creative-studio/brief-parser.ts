import { getAngleById } from "./marketing-angles";
import type { CreativeBriefInput, UploadedAssetItem, StylePreset, AspectRatio } from "./types";

export interface ParseBriefOptions {
  angleId?: string;
  aspectRatio?: AspectRatio;
  stylePreset?: StylePreset;
  assets?: UploadedAssetItem[];
  logoDataUrl?: string | null;
  logoPlacement?: "top-left" | "top-right" | "auto";
  whatsappNumber?: string | null;
  specsText?: string;
}

/**
 * Natural Language Brief Parser
 * Extracts structured real estate marketing parameters from a single conversational paragraph.
 * Applies smart defaults and marketing template guidelines without blocking generation.
 */
export class NaturalLanguageBriefParser {
  static parse(
    rawText: string,
    options: ParseBriefOptions = {}
  ): CreativeBriefInput {
    const text = (rawText || "").trim();
    const angle = getAngleById(options.angleId || "whatsapp_direct");

    // 1. Extract Project Name
    const extractedName = this.extractProjectName(text);
    const hasExplicitProjectName = Boolean(extractedName);
    const projectName = extractedName || "";

    // 2. Extract Property Type
    const propertyType = this.extractPropertyType(text);

    // 3. Extract Location
    const propertyLocation = this.extractLocation(text) || "Lokasi Strategis";

    // 4. Extract Starting Price
    const startingPrice = this.extractStartingPrice(text);

    // 5. Extract Dimensions & Room Counts
    const landArea = this.extractPattern(text, /(?:lt|luas tanah|tanah)\s*[:=]?\s*(\d+)/i);
    const buildingArea = this.extractPattern(text, /(?:lb|luas bangunan|bangunan|tipe)\s*[:=]?\s*(\d+)/i);
    const bedrooms = this.extractPattern(text, /(\d+)\s*(?:kt|kamar tidur|kamar)/i);
    const bathrooms = this.extractPattern(text, /(\d+)\s*(?:km|kamar mandi)/i);
    const floors = this.extractPattern(text, /(\d+)\s*(?:lantai)/i) || (text.includes("2 lantai") ? "2" : text.includes("1 lantai") ? "1" : "2");

    // Build clean specs text
    const specsList: string[] = [];
    if (bedrooms) specsList.push(`${bedrooms} KT`);
    if (bathrooms) specsList.push(`${bathrooms} KM`);
    if (landArea) specsList.push(`LT ${landArea}m²`);
    if (buildingArea) specsList.push(`LB ${buildingArea}m²`);
    const specsText = specsList.length > 0 ? specsList.join(" • ") : (options.specsText || "");

    // 6. Extract Promo & Financial Perks
    const hasFreePpn = /(?:free|bebas|subsidi)\s*ppn/i.test(text) || /ppn\s*100\s*%/i.test(text) || /100\s*%\s*(?:free|bebas)?\s*ppn/i.test(text);
    const dpAmount = this.extractDp(text);
    const monthlyInstallment = this.extractInstallment(text);
    const cashback = this.extractCashback(text);
    const kprRate = this.extractPattern(text, /(?:bunga|rate)\s*[:=]?\s*(\d+(?:[.,]\d+)?\s*%?)/i);

    // 7. Extract Target Audience, CTA, & WhatsApp Number
    const targetAudience = this.extractTargetAudience(text) || angle.targetAudience;
    const ctaText = this.extractCta(text) || angle.ctaRecommendation;
    const extractedWhatsapp = this.extractWhatsappNumber(text);
    const whatsappNumber = extractedWhatsapp !== null
      ? extractedWhatsapp
      : (options.whatsappNumber !== undefined ? options.whatsappNumber : null);

    // 8. Synthesize Headline and Subheadline
    const promos = this.extractPromos(text, { hasFreePpn, dpAmount, monthlyInstallment, cashback });
    const locationAdvantages = this.extractLocationAdvantages(text);
    const headline =
      this.extractHeadline(text) ||
      this.craftHeadline({ propertyType, propertyLocation, startingPrice, floors, bedrooms, promos, locationAdvantages });
    const subheadline = this.extractSubheadline(text, propertyLocation, buildingArea, floors);

    // 9. Resolve Style Preset (defaults to angle's visual vibe)
    const stylePreset = options.stylePreset || this.mapAngleToStylePreset(angle.cluster);

    return {
      projectName,
      hasExplicitProjectName,
      propertyType,
      propertyLocation,
      startingPrice: startingPrice || "",
      landArea: landArea || "",
      buildingArea: buildingArea || "",
      bedrooms: bedrooms || "",
      bathrooms: bathrooms || "",
      floors: floors || "2",
      promoHeadline: promos.join(" • ") || angle.suggestedPills[0] || "",
      promos,
      locationAdvantages,
      hasFreePpn,
      dpAmount: dpAmount || (text.toLowerCase().includes("dp 0") ? "DP 0%" : ""),
      monthlyInstallment: monthlyInstallment || "",
      cashback: cashback || "",
      kprRate: kprRate || "",
      ctaText,
      headline,
      subheadline,
      description: text,
      targetAudience,
      aspectRatio: options.aspectRatio || "4:5",
      stylePreset,
      fidelityMode: (options.assets || []).length > 0 ? "preserve_original" : "ai_atmosphere",
      assets: options.assets || [],
      logoDataUrl: options.logoDataUrl || null,
      logoPlacement: options.logoPlacement || "auto",
      whatsappNumber: whatsappNumber || null,
      specsText: specsText || "",
    };
  }

  /**
   * Extracts Indonesian mobile/WhatsApp numbers and normalizes them into '0812-3456-7890'
   */
  static extractWhatsappNumber(text: string): string | null {
    if (!text) return null;
    const match = text.match(/(?:\+62|62|0)[\s-]*8[1-9][0-9\s-]{6,12}/);
    if (!match) return null;

    const digits = match[0].replace(/\D/g, "");
    let normalized = digits;
    if (normalized.startsWith("62")) {
      normalized = "0" + normalized.slice(2);
    } else if (!normalized.startsWith("0")) {
      normalized = "0" + normalized;
    }

    if (normalized.length < 10 || normalized.length > 13) {
      return null;
    }

    const part1 = normalized.slice(0, 4);
    const part2 = normalized.slice(4, 8);
    const part3 = normalized.slice(8);
    return `${part1}-${part2}-${part3}`;
  }

  static extractPromos(
    text: string,
    known: { hasFreePpn: boolean; dpAmount: string | null; monthlyInstallment: string | null; cashback: string | null }
  ): string[] {
    const promos: string[] = [];
    const push = (value: string) => {
      const clean = value.replace(/\s+/g, " ").trim();
      if (!clean) return;
      if (promos.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
      promos.push(clean);
    };
    if (known.dpAmount) push(known.dpAmount.includes("%") ? known.dpAmount : known.dpAmount);
    if (/(?:dp|uang muka)\s*0/i.test(text) || /tanpa\s*dp/i.test(text)) push("DP 0%");
    if (known.hasFreePpn || /bebas\s*ppn|free\s*ppn|ppn\s*100/i.test(text)) push("FREE PPN 100%");
    if (/free\s*biaya\s*kpr|bebas\s*biaya\s*kpr/i.test(text)) push("Free Biaya KPR");
    if (known.monthlyInstallment) push(known.monthlyInstallment);
    if (known.cashback) push(known.cashback);
    return promos;
  }

  static extractLocationAdvantages(text: string): string[] {
    const found: string[] = [];
    if (/akses\s*tol|dekat\s*tol|gerbang\s*tol/i.test(text)) found.push("Dekat Akses Tol");
    if (/stasiun/i.test(text)) found.push("Dekat Stasiun");
    if (/bandara/i.test(text)) found.push("Dekat Bandara");
    return found;
  }

  private static craftHeadline(facts: {
    propertyType?: string;
    propertyLocation: string;
    startingPrice: string | null;
    floors: string | null;
    bedrooms: string | null;
    promos: string[];
    locationAdvantages: string[];
  }): string {
    if (facts.propertyType && facts.propertyType !== "Rumah Tinggal" && facts.propertyType.toLowerCase().includes("rumah")) {
      return facts.propertyType;
    }
    const place = facts.propertyLocation && facts.propertyLocation !== "Lokasi Strategis" ? facts.propertyLocation : "lokasi strategis";
    if (facts.promos.some((item) => /dp\s*0/i.test(item))) {
      return `Punya Rumah ${facts.floors || "2"} Lantai di ${place} Tanpa Pusing Uang Muka`;
    }
    if (facts.locationAdvantages.length > 0) {
      return `Selangkah ke Tol & Stasiun, Hidup Lebih Tenang di ${place}`;
    }
    if (facts.bedrooms) {
      return `Ruang Tumbuh Keluarga: ${facts.floors || "2"} Lantai, ${facts.bedrooms} Kamar Tidur`;
    }
    return facts.startingPrice
      ? `Hunian Modern di ${place} Mulai ${facts.startingPrice}`
      : `Hunian Modern Siap Huni di ${place}`;
  }

  private static extractProjectName(text: string): string | null {
    // Check for explicit "nama proyek", "perumahan", "cluster"
    const prefixMatch = text.match(/(?:perumahan|cluster|proyek|apartemen|residence)\s+([A-Z][a-zA-Z0-9\s]+?)(?=[.,\n]|di\s|harga|mulai|tipe|$)/i);
    if (prefixMatch && prefixMatch[1].trim().length > 2) {
      return prefixMatch[1].trim();
    }

    // Check for "iklan [nama properti] di"
    const iklanMatch = text.match(/(?:iklan|promosi|pasarkan)\s+(?:rumah|hunian|unit)?\s*([A-Z][a-zA-Z0-9\s]+?)(?=\s+di|\s+harga|\s+mulai|$|[.,])/i);
    if (iklanMatch && iklanMatch[1].trim().length > 2) {
      const candidate = iklanMatch[1].trim();
      if (!candidate.toLowerCase().includes("rumah") && !candidate.toLowerCase().includes("modern")) {
        return candidate;
      }
    }

    // Look for capitalized names e.g. "Grand Harmoni City"
    const capMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/);
    if (capMatch && !["BSD City", "Tangerang Selatan", "Jawa Barat", "DKI Jakarta"].includes(capMatch[1])) {
      return capMatch[1];
    }

    return null;
  }

  private static extractPropertyType(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("rumah modern 2 lantai")) return "Rumah Modern 2 Lantai";
    if (lower.includes("rumah 2 lantai")) return "Rumah 2 Lantai";
    if (lower.includes("rumah modern 1 lantai")) return "Rumah Modern 1 Lantai";
    if (lower.includes("rumah 1 lantai")) return "Rumah 1 Lantai";
    if (lower.includes("rumah modern")) return "Rumah Modern";
    if (lower.includes("apartemen") || lower.includes("condo")) return "Apartemen";
    if (lower.includes("villa")) return "Villa Mewah";
    if (lower.includes("ruko") || lower.includes("shophouse")) return "Ruko Komersial";
    if (lower.includes("townhouse")) return "Townhouse";
    if (lower.includes("cluster")) return "Cluster Premium";
    return "Rumah Tinggal";
  }

  private static extractLocation(text: string): string | null {
    // Explicit "di [Lokasi, Kota]" (e.g. "di Ubud, Bali" or "di BSD City, Tangerang Selatan")
    const match = text.match(/\b(?:di|lokasi|kawasan)\s+([A-Z][a-zA-Z0-9\s,]+?)(?=\.\s|\.|\n|harga|luas|mulai|dekat|target|$)/i);
    if (match && match[1].trim().length > 2) {
      return match[1].replace(/[.,]+$/, "").trim();
    }

    // Common Indonesian cities/areas
    const knownLocations = [
      "BSD City", "Gading Serpong", "Alam Sutera", "Bintaro", "Karawaci",
      "Tangerang Selatan", "Tangerang", "Jakarta Selatan", "Jakarta Barat", "Jakarta Timur", "Jakarta Pusat", "Jakarta Utara",
      "Bekasi", "Depok", "Bogor", "Sentul", "Cibubur", "Bandung", "Surabaya", "Semarang", "Yogyakarta", "Bali"
    ];

    for (const loc of knownLocations) {
      if (new RegExp(`\\b${loc}\\b`, "i").test(text)) {
        return loc;
      }
    }

    return null;
  }

  private static extractStartingPrice(text: string): string | null {
    // e.g. "850 juta", "Rp 850jt", "1,5 Miliar", "Rp 2 M"
    const priceMatch = text.match(/(?:rp\.?|idr)?\s*([0-9.,]+)\s*(miliar|milyar|m\b|juta|jt\b)/i);
    if (priceMatch) {
      const numStr = priceMatch[1].trim();
      const unit = priceMatch[2].toLowerCase();
      if (unit.startsWith("m")) {
        return `Rp ${numStr} Miliar`;
      }
      return `Rp ${numStr} Juta`;
    }

    // Direct nominal numbers > 100 million
    const rawNumberMatch = text.match(/(?:rp\.?|idr)?\s*([1-9][0-9]{2}(?:[.,][0-9]{3}){2,})/i);
    if (rawNumberMatch) {
      const clean = Number(rawNumberMatch[1].replace(/[^0-9]/g, ""));
      if (clean >= 1000000000) {
        return `Rp ${(clean / 1000000000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} Miliar`;
      }
      if (clean >= 1000000) {
        return `Rp ${(clean / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Juta`;
      }
    }

    return null;
  }

  private static extractDp(text: string): string | null {
    if (/(?:dp|uang muka)\s*0%?/i.test(text) || /tanpa\s*dp/i.test(text)) {
      return "DP 0%";
    }
    const match = text.match(/(?:dp|uang muka)\s*[:=]?\s*([0-9.,]+(?:\s*%|\s*juta|\s*jt)?)/i);
    if (match) {
      return `DP ${match[1].trim()}`;
    }
    return null;
  }

  private static extractInstallment(text: string): string | null {
    const match = text.match(/(?:cicilan|angsuran)\s*(?:mulai)?\s*[:=]?\s*(?:rp\.?)?\s*([0-9.,]+\s*(?:juta|jt)?)/i);
    if (match) {
      return `Cicilan Mulai Rp ${match[1].trim()}/bln`;
    }
    return null;
  }

  private static extractCashback(text: string): string | null {
    const match = text.match(/cashback\s*[:=]?\s*(?:rp\.?)?\s*([0-9.,]+\s*(?:juta|jt)?)/i);
    if (match) {
      return `Cashback Rp ${match[1].trim()}`;
    }
    return null;
  }

  private static extractTargetAudience(text: string): string | null {
    const match = text.match(/target\s*(?:pasar|audiens|audience)?\s*[:=]?\s*([^.,\n]+)/i);
    if (match && match[1].trim().length > 3) {
      return match[1].trim();
    }
    return null;
  }

  private static extractCta(text: string): string | null {
    const lower = text.toLowerCase();
    if (lower.includes("whatsapp") || lower.includes("wa")) return "Klaim Promo WhatsApp";
    if (lower.includes("survei") || lower.includes("kunjungan")) return "Jadwalkan Survei";
    if (lower.includes("booking") || lower.includes("pesan")) return "Booking Unit Sekarang";
    if (lower.includes("konsultasi")) return "Konsultasi Gratis";
    return null;
  }

  private static extractHeadline(text: string): string | null {
    const match = text.match(/(?:headline|judul)\s*[:=]?\s*["“]?([^"”\n\r]+)["”]?/i);
    if (match && match[1].trim().length > 6) {
      return match[1].trim();
    }
    return null;
  }

  private static extractSubheadline(
    text: string,
    location: string,
    buildingArea: string | null,
    floors: string | null
  ): string {
    // Check if text has "dekat tol", "stasiun", etc.
    const transitMatch = text.match(/(?:dekat|hanya|akses)\s+([^.,\n]+)/i);
    if (transitMatch) {
      return `Lokasi Strategis: ${transitMatch[0].trim()}`;
    }
    const specs = [
      floors ? `${floors} Lantai` : "",
      buildingArea ? `Tipe ${buildingArea}` : "",
      location,
    ].filter(Boolean).join(" • ");

    return specs || "Hunian Modern Bernilai Investasi Tinggi";
  }

  private static extractPattern(text: string, regex: RegExp): string | null {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  private static mapAngleToStylePreset(cluster: string): StylePreset {
    switch (cluster) {
      case "emotional":
        return "residential";
      case "financial":
      case "conversion":
        return "high_conversion";
      case "location":
        return "corporate";
      case "architectural":
        return "luxury";
      default:
        return "high_conversion";
    }
  }
}
