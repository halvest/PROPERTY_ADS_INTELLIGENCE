export type LongevityPhase = "TESTING" | "VALIDATING" | "EVERGREEN";

export type FunnelType =
  | "CTWA"
  | "LEAD_FORM"
  | "LANDING_PAGE"
  | "IG_DIRECT"
  | "MESSENGER"
  | "OTHER"
  | "UNKNOWN";

export type MediaFormat = "IMAGE" | "VIDEO" | "CAROUSEL" | "NONE";

export interface CosMediaItem {
  type: "image" | "video";
  url: string;
  width?: number;
  height?: number;
  poster_url?: string;
  caption?: string;
}

export interface GroundedAdAnalysis {
  // 3-Pillar Deep Breakdown
  copywriting_anatomy?: {
    hook_first_3_lines: string;
    hook_category: "PRICE_SHOCK" | "LOCATION_ACCESS" | "PAIN_POINT" | "PROMO_URGENCY" | "LIFESTYLE" | "DIRECT_SPEC";
    extracted_offers: {
      price_or_installment: string | null;
      dp_offer: string | null;
      bonuses_and_promos: string[];
      location_claims: string[];
      legality_claims: string[];
    };
    objection_handling: string | null;
    cta_mechanism: string;
  };
  visual_anatomy?: {
    primary_subject: "EXTERIOR_FACADE" | "INTERIOR_ROOM" | "SITEPLAN_MAP" | "HUMAN_TALENT" | "TEXT_POSTER" | "3D_RENDER";
    detected_aspect_ratio: string;
    text_overlay_headline: string | null;
    price_tag_on_visual: string | null;
    visual_hierarchy_flow: string[];
    safe_zone_assessment: {
      has_violation_risk: boolean;
      risk_area: "TOP_STORY_HEADER" | "BOTTOM_REELS_CAPTION" | "RIGHT_ACTION_BAR" | "NONE";
      explanation: string;
    };
  };
  advertiser_takeaways?: {
    survival_rationale: string;
    missing_information_gaps: string[];
    counter_angle_recommendation: {
      target_weakness: string;
      suggested_hook_text: string;
      suggested_visual_concept: string;
      suggested_wa_prefill: string;
    };
  };

  // Backwards-compatible flat fields
  hook_angle: string;
  offer_breakdown: {
    starting_price: string | null;
    dp_promo: string | null;
    installment: string | null;
    bonus_incentives: string[];
  };
  target_audience: string;
  copywriting_framework: string;
  evidence_quotes: string[];
  actionable_takeaway: string;
  analyzed_at?: string;
}

export interface ScrapedCompetitorAd {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  scrape_job_id?: string | null;
  ad_archive_id: string;
  search_keyword: string;
  page_id: string;
  page_name: string;
  page_profile_uri: string | null;
  is_active: boolean | null;
  start_date: string;
  end_date: string | null;
  active_days_count: number;
  longevity_phase: LongevityPhase;
  collation_id: string | null;
  collation_count: number;
  media_format: MediaFormat;
  cos_media_urls: CosMediaItem[];
  original_body_text: string | null;
  headline_title: string | null;
  link_description: string | null;
  cta_type: string | null;
  cta_text: string | null;
  destination_url: string | null;
  funnel_type: FunnelType;
  decoded_wa_number: string | null;
  decoded_wa_text: string | null;
  destination_domain: string | null;
  publisher_platforms: string[];
  ai_analysis: GroundedAdAnalysis | null;
  ai_analyzed_at: string | null;
  scraped_at: string | null;
  updated_at: string | null;
}

export interface AdScrapeJob {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  search_keyword: string;
  country_code: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  total_ads_found: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface MarketPulseSummary {
  total_ads: number;
  active_ads: number;
  evergreen_count: number;
  evergreen_ratio_pct: number;
  scaling_count: number;
  top_funnel: {
    type: FunnelType;
    count: number;
    percentage: number;
  };
  dominant_format: {
    format: MediaFormat;
    count: number;
    percentage: number;
  };
  avg_active_days: number;
  top_offer_keywords?: Array<{ term: string; count: number }>;
}

export interface AdSpyFilterParams {
  keyword?: string;
  longevity_phase?: LongevityPhase | "ALL";
  funnel_type?: FunnelType | "ALL";
  media_format?: MediaFormat | "ALL";
  is_scaling_only?: boolean;
  sort_by?: "longevity" | "scaling" | "recency";
  limit?: number;
  offset?: number;
  user_id?: string;
  organization_id?: string;
}
