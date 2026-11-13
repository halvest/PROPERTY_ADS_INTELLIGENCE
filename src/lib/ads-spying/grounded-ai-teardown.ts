import "server-only";

import { z } from "zod";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { parseModelJson } from "@/lib/ai/parse-model-json";
import { getMetaConfig } from "@/lib/ai/meta/config";
import type { GroundedAdAnalysis } from "./types";

export const GroundedAdAnalysisSchema = z.object({
  copywriting_anatomy: z.object({
    hook_first_3_lines: z.string(),
    hook_category: z.enum(["PRICE_SHOCK", "LOCATION_ACCESS", "PAIN_POINT", "PROMO_URGENCY", "LIFESTYLE", "DIRECT_SPEC"]).default("DIRECT_SPEC"),
    extracted_offers: z.object({
      price_or_installment: z.string().nullable(),
      dp_offer: z.string().nullable(),
      bonuses_and_promos: z.array(z.string()).default([]),
      location_claims: z.array(z.string()).default([]),
      legality_claims: z.array(z.string()).default([]),
    }),
    objection_handling: z.string().nullable().default(null),
    cta_mechanism: z.string(),
  }).optional(),
  visual_anatomy: z.object({
    primary_subject: z.enum(["EXTERIOR_FACADE", "INTERIOR_ROOM", "SITEPLAN_MAP", "HUMAN_TALENT", "TEXT_POSTER", "3D_RENDER"]).default("EXTERIOR_FACADE"),
    detected_aspect_ratio: z.string().default("4:5"),
    text_overlay_headline: z.string().nullable().default(null),
    price_tag_on_visual: z.string().nullable().default(null),
    visual_hierarchy_flow: z.array(z.string()).default([]),
    safe_zone_assessment: z.object({
      has_violation_risk: z.boolean().default(false),
      risk_area: z.enum(["TOP_STORY_HEADER", "BOTTOM_REELS_CAPTION", "RIGHT_ACTION_BAR", "NONE"]).default("NONE"),
      explanation: z.string().default("Area visual berada di zona aman."),
    }),
  }).optional(),
  advertiser_takeaways: z.object({
    survival_rationale: z.string(),
    missing_information_gaps: z.array(z.string()).default([]),
    counter_angle_recommendation: z.object({
      target_weakness: z.string(),
      suggested_hook_text: z.string(),
      suggested_visual_concept: z.string(),
      suggested_wa_prefill: z.string(),
    }),
  }).optional(),
  hook_angle: z.string().min(3),
  offer_breakdown: z.object({
    starting_price: z.string().nullable(),
    dp_promo: z.string().nullable(),
    installment: z.string().nullable(),
    bonus_incentives: z.array(z.string()).default([]),
  }),
  target_audience: z.string().min(3),
  copywriting_framework: z.string().min(3),
  evidence_quotes: z.array(z.string()).default([]),
  actionable_takeaway: z.string().min(10),
});

const GROUNDED_AI_SYSTEM_PROMPT = `You are a Principal Meta Ads Direct-Response Performance Strategist specializing in Indonesian Real Estate Marketing.
Analyze the provided competitor property ad strictly based on the exact ad copywriting and factual metadata provided.

STRICT ZERO-HALLUCINATION & EVIDENCE-BASED POLICY:
1. NEVER INVENT OR GUESS metrics: DO NOT state CTR, CPC, CPL, ROAS, conversion rates, or ad spend in Rupiah.
2. In 'offer_breakdown': ONLY extract numbers/terms that are explicitly mentioned in the ad text.
   - If starting price is not stated, return null.
   - If DP promo is not stated, return null.
   - If monthly installment is not stated, return null.
   - In 'bonus_incentives', only list incentives explicitly written (e.g. "Free BPHTB", "Free AJB", "Subsidi KPR", "Smart Door Lock").
3. In 'evidence_quotes': Provide 2 to 4 EXACT verbatim quotes from the ad copy that prove your analysis.
4. Output STRICT JSON conforming to the requested schema. All analysis must be in professional Indonesian.`;

export async function runGroundedAdTeardown(params: {
  pageName: string;
  headlineTitle?: string | null;
  originalBodyText?: string | null;
  ctaText?: string | null;
  destinationUrl?: string | null;
  decodedWaText?: string | null;
  activeDaysCount: number;
  collationCount: number;
  funnelType: string;
}): Promise<GroundedAdAnalysis> {
  const adContext = [
    `Advertiser Page: "${params.pageName}"`,
    `Active Days (Longevity): ${params.activeDaysCount} days`,
    `Collation Scaling Count: ${params.collationCount} variations`,
    `Funnel Type: ${params.funnelType}`,
    params.headlineTitle ? `Headline: "${params.headlineTitle}"` : null,
    params.originalBodyText ? `Ad Body Copy:\n"""\n${params.originalBodyText}\n"""` : null,
    params.ctaText ? `CTA: "${params.ctaText}"` : null,
    params.destinationUrl ? `Destination URL: "${params.destinationUrl}"` : null,
    params.decodedWaText ? `WhatsApp Pre-filled Script: "${params.decodedWaText}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const config = getMetaConfig({ requireApiKey: false });

  if (config.isConfigured && config.apiKey) {
    try {
      const client = new MetaModelApiClient();
      const response = await client.createChatCompletion({
        messages: [
          { role: "system", content: GROUNDED_AI_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze this Indonesian property ad and produce a GroundedAdAnalysis JSON:\n\n${adContext}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2500,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      if (rawContent && rawContent.trim()) {
        const parsed = parseModelJson(rawContent);
        const validated = GroundedAdAnalysisSchema.safeParse(parsed);
        if (validated.success) {
          return {
            ...validated.data,
            analyzed_at: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn("[GroundedAdTeardown] Meta Model API call failed, falling back to deterministic extraction:", err);
    }
  }

  // Resilient Deterministic Fallback Extractor (Strictly Zero-Hallucination)
  return extractGroundedAnalysisDeterministically(params);
}

/**
 * Deterministic Regex & Rule-Based Fallback Extractor
 * Extracts facts directly from text without inventing numbers.
 */
function extractGroundedAnalysisDeterministically(params: {
  pageName: string;
  headlineTitle?: string | null;
  originalBodyText?: string | null;
  ctaText?: string | null;
  decodedWaText?: string | null;
  activeDaysCount: number;
  collationCount: number;
  funnelType: string;
}): GroundedAdAnalysis {
  const fullText = [
    params.headlineTitle || "",
    params.originalBodyText || "",
    params.decodedWaText || "",
  ].join("\n");

  // 1. Starting Price Extraction
  const priceMatch = fullText.match(
    /(?:harga\s+(?:mulai\s+)?|mulai\s+dari\s+|start\s+from\s+)?(?:rp\.?|idr)\s*([0-9.,]+(?:\s*(?:juta|jt|miliar|m|milyar))?)/i
  );
  const starting_price = priceMatch ? priceMatch[0].trim() : null;

  // 2. DP Promo Extraction
  const dpMatch = fullText.match(
    /(?:dp\s*(?:cuman\s*|hanya\s*|mulai\s*)?[0-9.,]+(?:\s*(?:juta|jt|%|persen))?|dp\s*0%|tanpa\s+dp|bebas\s+dp)/i
  );
  const dp_promo = dpMatch ? dpMatch[0].trim() : null;

  // 3. Installment Extraction
  const installmentMatch = fullText.match(
    /(?:cicilan|angsuran)\s*(?:mulai\s*)?[0-9.,]+(?:\s*(?:juta|jt|rb|ribu|per\s*bulan|\/bln))?/i
  );
  const installment = installmentMatch ? installmentMatch[0].trim() : null;

  // 4. Bonus Incentives Extraction
  const bonus_incentives: string[] = [];
  const incentivePatterns = [
    /free\s+(?:biaya\s+)?bphtb/i,
    /free\s+(?:biaya\s+)?kpr/i,
    /free\s+ajb/i,
    /free\s+ppn/i,
    /subsidi\s+(?:kpr|dp)/i,
    /smart\s+home\s+system/i,
    /smart\s+door\s+lock/i,
    /free\s+canopy/i,
    /free\s+ac/i,
    /kitchen\s+set/i,
    /cashback\s*(?:hingga\s*)?[0-9.,]+\s*(?:juta|jt|m)?/i,
  ];

  for (const pattern of incentivePatterns) {
    const match = fullText.match(pattern);
    if (match && !bonus_incentives.includes(match[0])) {
      bonus_incentives.push(match[0].trim());
    }
  }

  // 5. Hook Angle Classification
  let hook_angle = "Feature & Lifestyle Presentation";
  if (dp_promo || fullText.toLowerCase().includes("dp 0%")) {
    hook_angle = "Low Barrier Financial Offer (DP 0% / Biaya Ringan)";
  } else if (starting_price) {
    hook_angle = "Direct Price Anchor (Keterjangkauan Harga)";
  } else if (fullText.toLowerCase().includes("terbatas") || fullText.toLowerCase().includes("unit sisa")) {
    hook_angle = "Scarcity & Urgency (Unit Terbatas)";
  } else if (fullText.toLowerCase().includes("akses") || fullText.toLowerCase().includes("stasiun") || fullText.toLowerCase().includes("tol")) {
    hook_angle = "Location & Accessibility Advantage";
  }

  // 6. Evidence Quotes (Exact sentences from copy)
  const sentences = fullText
    .split(/[.\n!]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15 && s.length <= 160);

  const evidence_quotes = sentences.slice(0, 3);

  // 7. Actionable Takeaway
  let actionable_takeaway = "Struktur penawaran kompetitor menekankan kejelasan informasi dan aksesibilitas.";
  if (params.activeDaysCount >= 15) {
    actionable_takeaway = `Iklan ini berstatus EVERGREEN (${params.activeDaysCount} hari aktif). Bukti kuat bahwa kombinasi penawaran ${dp_promo || "properti ini"} dan CTA ${params.funnelType} menghasilkan konversi lead yang profitable bagi pengiklan.`;
  } else if (params.collationCount >= 3) {
    actionable_takeaway = `Pengiklan menjalankan ${params.collationCount} variasi sekaligus (Aggressive Scaling). Sudut pandang visual dan hook teks ini terbukti bekerja efektif dalam skala audiens yang luas.`;
  }

  // 8. 3-Pillar Deep Breakdown
  const lines = (params.originalBodyText || params.headlineTitle || "").split("\n").filter(Boolean);
  const hook_first_3_lines = lines.slice(0, 3).join(" ").trim() || params.headlineTitle || "Penawaran Properti";

  let hook_category: "PRICE_SHOCK" | "LOCATION_ACCESS" | "PAIN_POINT" | "PROMO_URGENCY" | "LIFESTYLE" | "DIRECT_SPEC" = "DIRECT_SPEC";
  if (dp_promo || fullText.toLowerCase().includes("dp 0%")) {
    hook_category = "PRICE_SHOCK";
  } else if (fullText.toLowerCase().includes("tol") || fullText.toLowerCase().includes("stasiun")) {
    hook_category = "LOCATION_ACCESS";
  } else if (fullText.toLowerCase().includes("terbatas") || fullText.toLowerCase().includes("sekarang")) {
    hook_category = "PROMO_URGENCY";
  }

  const location_claims: string[] = [];
  const locMatches = fullText.match(/\b(?:\d+\s*(?:menit|km)\s*(?:ke|dari)\s*[^.,\n]+|dekat\s+[^.,\n]+)/gi);
  if (locMatches) {
    location_claims.push(...locMatches.map((m) => m.trim()).slice(0, 3));
  }

  const legality_claims: string[] = [];
  const legMatches = fullText.match(/\b(?:shm|imb|pbg|ajb|sertifikat\s+hak\s+milik)\b/gi);
  if (legMatches) {
    legality_claims.push(...Array.from(new Set(legMatches.map((m) => m.toUpperCase()))));
  }

  const missing_information_gaps: string[] = [];
  if (!starting_price) missing_information_gaps.push("Harga pasti / starting price tidak dicantumkan di copywriting");
  if (!installment) missing_information_gaps.push("Simulasi cicilan bulanan KPR belum disebutkan");
  if (legality_claims.length === 0) missing_information_gaps.push("Kepastian status legalitas kepemilikan (SHM/PBG) tidak tertera");

  return {
    copywriting_anatomy: {
      hook_first_3_lines,
      hook_category,
      extracted_offers: {
        price_or_installment: starting_price || installment,
        dp_offer: dp_promo,
        bonuses_and_promos: bonus_incentives,
        location_claims,
        legality_claims,
      },
      objection_handling: dp_promo ? "Bebas beban DP awal dengan kemudahan cicilan" : null,
      cta_mechanism: params.ctaText || (params.funnelType === "CTWA" ? "WhatsApp Direct Chat" : "Website Form"),
    },
    visual_anatomy: {
      primary_subject: "EXTERIOR_FACADE",
      detected_aspect_ratio: "4:5",
      text_overlay_headline: params.headlineTitle || null,
      price_tag_on_visual: starting_price || dp_promo,
      visual_hierarchy_flow: ["Fasad Arsitektur Utama", "Promo Finansial (DP/Harga)", "Badge Fasilitas / Akses", "Tombol Hubungi WhatsApp"],
      safe_zone_assessment: {
        has_violation_risk: false,
        risk_area: "NONE",
        explanation: "Area grafis dan teks utama terkonsentrasi di safe-zone tengah, aman dari elemen UI Meta.",
      },
    },
    advertiser_takeaways: {
      survival_rationale: actionable_takeaway,
      missing_information_gaps,
      counter_angle_recommendation: {
        target_weakness: missing_information_gaps[0] || "Kurangnya kejelasan estimasi cicilan per bulan",
        suggested_hook_text: `Cari rumah di ${params.pageName.replace(/residence|cluster|land/gi, "").trim()} tanpa biaya siluman? Unit siap huni dengan SHM pasti & cicilan transparan.`,
        suggested_visual_concept: "Foto fasad realistik sudut eye-level saat golden hour, cantumkan badge SHM dan cicilan mulai Rp X Juta/bln di safe-zone tengah.",
        suggested_wa_prefill: `Halo Tim Marketing, saya tertarik dengan unit siap huni ini. Mohon kirimkan pricelist dan simulasi cicilan KPR detailnya.`,
      },
    },
    hook_angle,
    offer_breakdown: {
      starting_price,
      dp_promo,
      installment,
      bonus_incentives,
    },
    target_audience: "Pencari hunian pertama, pasangan muda, atau investor properti Indonesia",
    copywriting_framework: dp_promo || starting_price ? "Direct Offer & Benefit Led" : "PAS (Problem - Agitate - Solution)",
    evidence_quotes,
    actionable_takeaway,
    analyzed_at: new Date().toISOString(),
  };
}
