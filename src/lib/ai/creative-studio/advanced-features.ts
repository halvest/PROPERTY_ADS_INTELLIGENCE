import { AICreativeDirector } from "./creative-director";
import { AdCompositionEngine } from "./composition-engine";
import type { LayoutFamilyId } from "./layout-families";
import type {
  CreativeBriefInput,
  CreativeStrategy,
  CreativeVariationItem,
  AspectRatio,
  StylePreset,
} from "./types";

export interface RevisionResult {
  updatedStrategy: CreativeStrategy;
  appliedChangesNote: string;
  targetLayoutFamilyId?: LayoutFamilyId;
}

/**
 * AI Revision Engine
 * Interprets targeted natural language revision instructions from users and selectively
 * updates creative layout family, typography hierarchy, or color tokens.
 */
export type RevisionIntent = "style_layout" | "copy" | "image";

export class AIRevisionEngine {
  static classifyIntent(instruction: string): RevisionIntent {
    const text = instruction.toLowerCase();
    const imageAsk = /langit|golden hour|senja|sunset|sunrise|dawn|dusk|terangkan foto|gelapkan foto|pencahayaan|lighting|ganti langit|cuaca/.test(text);
    if (imageAsk) return "image";
    const copyAsk = /ubah (?:headline|judul|harga|cta|tulisan)|ganti (?:headline|judul|teks)|headline menjadi|judul menjadi/.test(text);
    if (copyAsk) return "copy";
    return "style_layout";
  }

  static applyRevision(
    currentStrategy: CreativeStrategy,
    brief: CreativeBriefInput,
    instruction: string
  ): RevisionResult {
    const text = instruction.toLowerCase().trim();
    const updated = JSON.parse(JSON.stringify(currentStrategy)) as CreativeStrategy;
    const notes: string[] = [];
    let targetLayoutFamilyId: LayoutFamilyId | undefined = undefined;

    // 1. Layout family shifts
    if (text.includes("editorial") || text.includes("elegan") || text.includes("kurangi badge") || text.includes("majalah")) {
      targetLayoutFamilyId = "architectural_editorial";
      updated.typography.fontFamily = "'Playfair Display', 'Cinzel', Georgia, serif";
      updated.typography.headlineWeight = "700";
      notes.push("Beralih ke komposisi Architectural Editorial dengan negative space luas & tanpa tumpukan badge.");
    } else if (text.includes("minimalis") || text.includes("clean") || text.includes("skandinavia")) {
      targetLayoutFamilyId = "minimalist_modern";
      updated.typography.fontFamily = "system-ui, -apple-system, 'Inter', sans-serif";
      updated.typography.headlineWeight = "800";
      notes.push("Beralih ke komposisi Minimalist Modern yang bersih & kontemporer.");
    } else if (text.includes("brosur") || text.includes("spesifikasi") || text.includes("developer")) {
      targetLayoutFamilyId = "property_brochure";
      updated.typography.fontFamily = "system-ui, -apple-system, sans-serif";
      notes.push("Beralih ke komposisi Premium Property Brochure dengan spesifikasi rapi.");
    } else if (text.includes("whatsapp") || text.includes("promo") || text.includes("harga") || text.includes("konversi") || text.includes("cta")) {
      targetLayoutFamilyId = "direct_response";
      updated.typography.headlineWeight = "900";
      notes.push("Beralih ke komposisi Direct Response Campaign dengan tombol aksi WhatsApp kontras tinggi.");
    }

    // 2. Color revisions
    if (text.includes("emerald") || text.includes("hijau")) {
      updated.colorPalette = {
        primary: "#064E3B",
        secondary: "#047857",
        accent: "#10B981",
        backgroundOverlay: "linear-gradient(180deg, rgba(6,78,59,0.15) 0%, rgba(6,78,59,0.92) 100%)",
        textColor: "#FFFFFF",
      };
      notes.push("Palet warna diperbarui ke Emerald Green.");
    } else if (text.includes("emas") || text.includes("gold") || text.includes("mewah") || text.includes("luxury")) {
      updated.colorPalette = {
        primary: "#18181B",
        secondary: "#27272A",
        accent: "#D4AF37",
        backgroundOverlay: "linear-gradient(180deg, rgba(9,9,11,0.2) 0%, rgba(9,9,11,0.95) 100%)",
        textColor: "#FFFFFF",
      };
      notes.push("Nuansa diperbarui ke tema Luxury Gold & Obsidian.");
    } else if (text.includes("biru") || text.includes("blue")) {
      updated.colorPalette = {
        primary: "#0F172A",
        secondary: "#1E293B",
        accent: "#38BDF8",
        backgroundOverlay: "linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.9) 100%)",
        textColor: "#FFFFFF",
      };
      notes.push("Nuansa diperbarui ke Modern Azure Blue.");
    }

    // 3. Headline revisions
    if (text.includes("headline") || text.includes("judul") || text.includes("dominan") || text.includes("besar")) {
      updated.typography.headlineWeight = "900";
      notes.push("Hierarki headline dipertebal sebagai focal point utama visual.");
    }

    // 4. Default revision acknowledgment
    if (notes.length === 0) {
      notes.push(`Menyesuaikan elemen visual sesuai arahan: "${instruction}".`);
    }

    return {
      updatedStrategy: updated,
      appliedChangesNote: notes.join(" "),
      targetLayoutFamilyId,
    };
  }
}

/**
 * Creative Variations Engine
 * Generates 3 genuinely distinct layout families for the same property project.
 */
export class AIVariationsEngine {
  static generateVariations(
    brief: CreativeBriefInput,
    baseImageUrl: string,
    aspectRatio: AspectRatio,
    generationId: string
  ): CreativeVariationItem[] {
    const place = brief.propertyLocation || "lokasi strategis";
    const floors = brief.floors || "2";
    const bedrooms = brief.bedrooms || "3";
    const variationConfigs: Array<{
      label: string;
      preset: StylePreset;
      layoutFamilyId: LayoutFamilyId;
      headline: string;
      subheadline: string;
      ctaText: string;
    }> = [
      {
        label: "Variasi A: Finansial & Promo",
        preset: "high_conversion",
        layoutFamilyId: "direct_response",
        headline: brief.promoHeadline
          ? `Miliki Rumah ${floors} Lantai di ${place} — ${brief.promoHeadline}`
          : `Miliki Rumah ${floors} Lantai di ${place} — Promo DP 0% & Bebas PPN`,
        subheadline: brief.startingPrice ? `Harga perdana mulai ${brief.startingPrice}` : "Kemudahan DP 0% dan Bebas PPN 100%",
        ctaText: "Hitung Simulasi via WA",
      },
      {
        label: "Variasi B: Lokasi & Akses",
        preset: "corporate",
        layoutFamilyId: "property_brochure",
        headline: `Selangkah ke Tol & Stasiun, Hunian Modern ${floors} Lantai di ${place}`,
        subheadline: (brief.locationAdvantages || []).join(" • ") || "Akses komuter harian bebas macet",
        ctaText: "Cek Lokasi & Survei",
      },
      {
        label: "Variasi C: Ruang & Brosur",
        preset: "editorial",
        layoutFamilyId: "architectural_editorial",
        headline: `Ruang Tumbuh Keluarga Muda: ${bedrooms} Kamar Tidur Nyaman di ${place}`,
        subheadline: [brief.buildingArea ? `LB ${brief.buildingArea} m²` : "", brief.landArea ? `LT ${brief.landArea} m²` : ""].filter(Boolean).join(" • ") || "Kapasitas ruang optimal untuk keluarga",
        ctaText: "Dapatkan Brosur & Pricelist",
      },
    ];

    return variationConfigs.map((item, index) => {
      const variantBrief: CreativeBriefInput = {
        ...brief,
        headline: item.headline,
        subheadline: item.subheadline,
        ctaText: item.ctaText,
        stylePreset: item.preset,
      };
      const strategy = AICreativeDirector.planCreativeStrategy(variantBrief, aspectRatio, item.preset);
      const layout = AdCompositionEngine.composeAd(
        variantBrief,
        strategy,
        baseImageUrl,
        aspectRatio,
        undefined,
        item.layoutFamilyId
      );

      return {
        id: `var-${generationId}-${index + 1}`,
        generationId,
        label: item.label,
        stylePreset: item.preset,
        layoutFamilyId: item.layoutFamilyId,
        finalComposedUrl: baseImageUrl,
        headline: layout.headline.text,
        accentColor: layout.palette.accent,
        creativeDirection: strategy,
      };
    });
  }
}
