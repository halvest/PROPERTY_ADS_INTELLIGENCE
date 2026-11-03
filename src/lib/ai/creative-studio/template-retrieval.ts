import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { CreativeBriefInput } from "./types";

export interface AdReferenceTemplateRecord {
  id: string;
  name: string;
  slug: string;
  category: string;
  target_audience: string | null;
  headline_hook: string;
  subheadline_template: string | null;
  promotional_badges: string[];
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    accentGold?: string;
    text: string;
  };
  typography_recipe: {
    headlineFont: string;
    scriptFont?: string;
    styleCase: string;
  };
  preview_image_url: string;
  visual_prompt_guide: string;
  layout_framing: string;
  tags: string[];
  is_system_preset: boolean;
}

/**
 * Visual RAG Retrieval Engine for AI Property Creatives.
 * Matches user's brief against real-world advertising templates in Supabase.
 */
export class AdTemplateRetrievalEngine {
  /**
   * Retrieves the most relevant ad reference template based on brief characteristics
   */
  static async retrieveBestTemplate(
    supabase: SupabaseClient<Database>,
    brief: CreativeBriefInput,
    organizationId?: string
  ): Promise<AdReferenceTemplateRecord | null> {
    try {
      // 1. Fetch active templates available to this org or system
      let query = supabase
        .from("creative_ad_reference_templates" as any)
        .select("*")
        .eq("is_active", true);

      if (organizationId) {
        query = query.or(`is_system_preset.eq.true,organization_id.eq.${organizationId}`);
      } else {
        query = query.eq("is_system_preset", true);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return null;
      }

      const templates = data as unknown as AdReferenceTemplateRecord[];

      // 2. Score templates based on brief keywords and financial signals
      const scored = templates.map((tmpl) => {
        let score = 0;
        const textToMatch = [
          brief.projectName,
          brief.description,
          brief.propertyLocation,
          brief.headline,
          brief.promoHeadline,
          brief.dpAmount,
          brief.targetAudience,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        // Tag matching
        if (tmpl.tags && Array.isArray(tmpl.tags)) {
          for (const tag of tmpl.tags) {
            if (textToMatch.includes(tag.toLowerCase())) {
              score += 15;
            }
          }
        }

        // DP / Promo matching
        if (
          (brief.dpAmount || brief.hasFreePpn) &&
          (tmpl.category === "direct_offer_dp" || tmpl.slug.includes("pajajaran") || tmpl.slug.includes("kaba"))
        ) {
          score += 25;
        }

        // Luxury / Villa / High price matching
        const priceNum = Number((brief.startingPrice || "").replace(/[^0-9]/g, "")) || 0;
        if (priceNum >= 2000000000 && tmpl.category === "luxury_architecture") {
          score += 30;
        }

        // Affordable (< 600 Jt) matching Golden Aurora
        if (priceNum > 0 && priceNum < 600000000 && tmpl.category === "golden_aurora_wave") {
          score += 25;
        }

        // Location specific matching (Bandung -> Gan Properti, Sariwangi, Ciwastra, Pajajaran)
        if (
          (brief.propertyLocation || "").toLowerCase().includes("bandung") &&
          (tmpl.slug.includes("gland") || tmpl.slug.includes("sariwangi"))
        ) {
          score += 20;
        }

        // Syariah / Muslim -> Bimulia
        if (
          (textToMatch.includes("syariah") || textToMatch.includes("islam")) &&
          tmpl.category === "islamic_cluster"
        ) {
          score += 35;
        }

        // Explicit stylePreset match
        if (brief.stylePreset && tmpl.category === brief.stylePreset) {
          score += 40;
        }

        return { template: tmpl, score };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored[0]?.template || templates[0];
    } catch (err) {
      console.warn("[Template Retrieval] Failed to retrieve from DB:", err);
      return null;
    }
  }

  /**
   * Lists all available templates for template selection showcases
   */
  static async listTemplates(
    supabase: SupabaseClient<Database>,
    organizationId?: string
  ): Promise<AdReferenceTemplateRecord[]> {
    try {
      let query = supabase
        .from("creative_ad_reference_templates" as any)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (organizationId) {
        query = query.or(`is_system_preset.eq.true,organization_id.eq.${organizationId}`);
      } else {
        query = query.eq("is_system_preset", true);
      }

      const { data } = await query;
      return (data as unknown as AdReferenceTemplateRecord[]) || [];
    } catch {
      return [];
    }
  }
}

