import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ScrapedCompetitorAd,
  AdSpyFilterParams,
  MarketPulseSummary,
  LongevityPhase,
  FunnelType,
  MediaFormat,
  GroundedAdAnalysis,
} from "./types";
import { INITIAL_COMPETITOR_ADS } from "./seed-data";
import { analyzeAdFunnel } from "./funnel-analyzer";
import { calculateAdLongevity } from "./longevity-calculator";
import { runGroundedAdTeardown } from "./grounded-ai-teardown";

export interface TenantContext {
  userId?: string;
  organizationId?: string;
}

export class AdsSpyingService {
  /**
   * Seeds demonstration ads for a new tenant if their isolated catalog is empty
   */
  static async ensureSeeded(tenantContext?: TenantContext): Promise<void> {
    if (!tenantContext?.userId) {
      return; // Do not seed unowned records into database
    }

    try {
      const supabase = createAdminClient();
      let query = supabase
        .from("scraped_competitor_ads")
        .select("id", { count: "exact", head: true });

      if (tenantContext.organizationId) {
        query = query.or(`organization_id.eq.${tenantContext.organizationId},user_id.eq.${tenantContext.userId}`);
      } else {
        query = query.eq("user_id", tenantContext.userId);
      }

      const { count, error } = await query;

      if (error) {
        console.warn("[AdsSpyingService] Error checking competitor ads count:", error.message);
        return;
      }

      if (count === 0) {
        console.log(`[AdsSpyingService] Seeding initial competitor ads for user ${tenantContext.userId}...`);
        const seedPayload = INITIAL_COMPETITOR_ADS.map((ad) => ({
          ...ad,
          user_id: tenantContext.userId,
          organization_id: tenantContext.organizationId || null,
          cos_media_urls: ad.cos_media_urls as any,
          ai_analysis: ad.ai_analysis as any,
        }));

        const { error: insertErr } = await supabase
          .from("scraped_competitor_ads")
          .upsert(seedPayload, { onConflict: "user_id, ad_archive_id" });

        if (insertErr) {
          console.warn("[AdsSpyingService] Seed insert error:", insertErr.message);
        } else {
          console.log(`[AdsSpyingService] Initial competitor ads seeded successfully for user ${tenantContext.userId}.`);
        }
      }
    } catch (err) {
      console.warn("[AdsSpyingService] ensureSeeded exception:", err);
    }
  }

  /**
   * Retrieves competitor ads strictly filtered by tenant ownership
   */
  static async getCompetitorAds(
    params: AdSpyFilterParams,
    sessionContext?: TenantContext
  ): Promise<{
    ads: ScrapedCompetitorAd[];
    total: number;
    pulse: MarketPulseSummary;
  }> {
    const userId = sessionContext?.userId || params.user_id;
    const orgId = sessionContext?.organizationId || params.organization_id;

    // Fail-closed: Never query without tenant context
    if (!userId && !orgId) {
      return {
        ads: [],
        total: 0,
        pulse: {
          total_ads: 0,
          active_ads: 0,
          evergreen_count: 0,
          evergreen_ratio_pct: 0,
          scaling_count: 0,
          top_funnel: { type: "CTWA", count: 0, percentage: 0 },
          dominant_format: { format: "IMAGE", count: 0, percentage: 0 },
          avg_active_days: 0,
          top_offer_keywords: [],
        },
      };
    }

    if (userId) {
      await this.ensureSeeded({ userId, organizationId: orgId });
    }

    const supabase = await createClient();
    let query = supabase.from("scraped_competitor_ads").select("*", { count: "exact" });

    // Enforce Tenant Isolation in application query (Defense in Depth alongside RLS)
    if (orgId) {
      query = query.or(`organization_id.eq.${orgId},user_id.eq.${userId}`);
    } else {
      query = query.eq("user_id", userId!);
    }

    // 1. Keyword search (searches search_keyword, page_name, headline_title, or original_body_text)
    if (params.keyword && params.keyword.trim()) {
      const kw = params.keyword.trim().toLowerCase();
      query = query.or(
        `search_keyword.ilike.%${kw}%,page_name.ilike.%${kw}%,headline_title.ilike.%${kw}%,original_body_text.ilike.%${kw}%`
      );
    }

    // 2. Longevity Phase filter
    if (params.longevity_phase && params.longevity_phase !== "ALL") {
      query = query.eq("longevity_phase", params.longevity_phase);
    }

    // 3. Funnel Type filter
    if (params.funnel_type && params.funnel_type !== "ALL") {
      query = query.eq("funnel_type", params.funnel_type);
    }

    // 4. Media Format filter
    if (params.media_format && params.media_format !== "ALL") {
      query = query.eq("media_format", params.media_format);
    }

    // 5. Scaling Only filter (collation_count >= 3)
    if (params.is_scaling_only) {
      query = query.gte("collation_count", 3);
    }

    // 6. Sorting
    if (params.sort_by === "scaling") {
      query = query.order("collation_count", { ascending: false }).order("active_days_count", { ascending: false });
    } else if (params.sort_by === "recency") {
      query = query.order("start_date", { ascending: false });
    } else {
      // Default: Longevity (longest running evergreen ads first)
      query = query.order("active_days_count", { ascending: false }).order("collation_count", { ascending: false });
    }

    // 7. Pagination
    const limit = params.limit || 30;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("[AdsSpyingService] Query error:", error.message);
      throw new Error(`Failed to retrieve competitor ads: ${error.message}`);
    }

    const ads: ScrapedCompetitorAd[] = (data || []).map((row) => ({
      ...row,
      user_id: row.user_id,
      organization_id: row.organization_id,
      scrape_job_id: row.scrape_job_id,
      is_active: row.is_active ?? true,
      collation_count: row.collation_count ?? 1,
      longevity_phase: (row.longevity_phase as LongevityPhase) || "TESTING",
      media_format: (row.media_format as MediaFormat) || "IMAGE",
      funnel_type: (row.funnel_type as FunnelType) || "UNKNOWN",
      cos_media_urls: (Array.isArray(row.cos_media_urls) ? row.cos_media_urls : []) as unknown as ScrapedCompetitorAd["cos_media_urls"],
      publisher_platforms: Array.isArray(row.publisher_platforms) ? row.publisher_platforms : [],
      ai_analysis: row.ai_analysis as unknown as GroundedAdAnalysis | null,
    }));

    // 8. Calculate Market Pulse Aggregator (isolated by caller tenant)
    const pulse = await this.calculateMarketPulse(params.keyword, { userId, organizationId: orgId });

    return {
      ads,
      total: count || 0,
      pulse,
    };
  }

  /**
   * Calculates deterministic Market Pulse metrics from tenant-scoped scraped records
   */
  static async calculateMarketPulse(keyword?: string, tenantContext?: TenantContext): Promise<MarketPulseSummary> {
    const supabase = await createClient();
    let query = supabase
      .from("scraped_competitor_ads")
      .select("active_days_count, longevity_phase, collation_count, funnel_type, media_format, is_active, headline_title, original_body_text");

    // Enforce Tenant Isolation in aggregation
    if (tenantContext?.organizationId) {
      query = query.or(`organization_id.eq.${tenantContext.organizationId},user_id.eq.${tenantContext.userId}`);
    } else if (tenantContext?.userId) {
      query = query.eq("user_id", tenantContext.userId);
    } else {
      // Fail closed
      return {
        total_ads: 0,
        active_ads: 0,
        evergreen_count: 0,
        evergreen_ratio_pct: 0,
        scaling_count: 0,
        top_funnel: { type: "CTWA", count: 0, percentage: 0 },
        dominant_format: { format: "IMAGE", count: 0, percentage: 0 },
        avg_active_days: 0,
        top_offer_keywords: [],
      };
    }

    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      query = query.or(
        `search_keyword.ilike.%${kw}%,page_name.ilike.%${kw}%,headline_title.ilike.%${kw}%,original_body_text.ilike.%${kw}%`
      );
    }

    const { data: rows } = await query;
    const list = rows || [];

    const total_ads = list.length;
    if (total_ads === 0) {
      return {
        total_ads: 0,
        active_ads: 0,
        evergreen_count: 0,
        evergreen_ratio_pct: 0,
        scaling_count: 0,
        top_funnel: { type: "CTWA", count: 0, percentage: 0 },
        dominant_format: { format: "IMAGE", count: 0, percentage: 0 },
        avg_active_days: 0,
        top_offer_keywords: [],
      };
    }

    let active_ads = 0;
    let evergreen_count = 0;
    let scaling_count = 0;
    let total_days = 0;

    const funnelCounts: Record<string, number> = {};
    const formatCounts: Record<string, number> = {};

    for (const ad of list) {
      if (ad.is_active) active_ads++;
      if (ad.longevity_phase === "EVERGREEN") evergreen_count++;
      if ((ad.collation_count ?? 1) >= 3) scaling_count++;
      total_days += ad.active_days_count || 1;

      funnelCounts[ad.funnel_type] = (funnelCounts[ad.funnel_type] || 0) + 1;
      formatCounts[ad.media_format] = (formatCounts[ad.media_format] || 0) + 1;
    }

    // Determine Top Funnel
    let topFunnelType: FunnelType = "CTWA";
    let topFunnelCount = 0;
    for (const [ft, cnt] of Object.entries(funnelCounts)) {
      if (cnt > topFunnelCount) {
        topFunnelCount = cnt;
        topFunnelType = ft as FunnelType;
      }
    }

    // Determine Dominant Media Format
    let dominantFormat: MediaFormat = "IMAGE";
    let dominantCount = 0;
    for (const [fmt, cnt] of Object.entries(formatCounts)) {
      if (cnt > dominantCount) {
        dominantCount = cnt;
        dominantFormat = fmt as MediaFormat;
      }
    }

    const evergreen_ratio_pct = Math.round((evergreen_count / total_ads) * 100);
    const topFunnelPct = Math.round((topFunnelCount / total_ads) * 100);
    const dominantFormatPct = Math.round((dominantCount / total_ads) * 100);
    const avg_active_days = Math.round(total_days / total_ads);

    // Calculate Top Offer Keywords from copywriting
    const candidateTerms = [
      "tanpa dp", "dp 0%", "free biaya", "cicilan", "shm",
      "dekat tol", "stasiun", "subsidi", "siap huni", "kanopi",
      "cash bertahap", "free bphtb", "cluster", "diskon"
    ];
    const termCounts: Record<string, number> = {};
    for (const r of list) {
      const text = `${r.headline_title || ""} ${r.original_body_text || ""}`.toLowerCase();
      for (const term of candidateTerms) {
        if (text.includes(term)) {
          termCounts[term] = (termCounts[term] || 0) + 1;
        }
      }
    }
    const top_offer_keywords = Object.entries(termCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      total_ads,
      active_ads,
      evergreen_count,
      evergreen_ratio_pct,
      scaling_count,
      top_funnel: {
        type: topFunnelType,
        count: topFunnelCount,
        percentage: topFunnelPct,
      },
      dominant_format: {
        format: dominantFormat,
        count: dominantCount,
        percentage: dominantFormatPct,
      },
      avg_active_days,
      top_offer_keywords,
    };
  }

  /**
   * Triggers an on-demand Grounded AI Teardown for an ad and persists to Supabase (tenant-isolated)
   */
  static async analyzeCompetitorAd(adArchiveId: string, tenantContext?: TenantContext): Promise<GroundedAdAnalysis> {
    const supabase = createAdminClient();

    let query = supabase
      .from("scraped_competitor_ads")
      .select("*")
      .eq("ad_archive_id", adArchiveId);

    if (tenantContext?.organizationId) {
      query = query.or(`organization_id.eq.${tenantContext.organizationId},user_id.eq.${tenantContext.userId}`);
    } else if (tenantContext?.userId) {
      query = query.eq("user_id", tenantContext.userId);
    }

    const { data: ad, error } = await query.single();

    if (error || !ad) {
      throw new Error(`Competitor ad ${adArchiveId} not found or access denied.`);
    }

    const analysis = await runGroundedAdTeardown({
      pageName: ad.page_name,
      headlineTitle: ad.headline_title,
      originalBodyText: ad.original_body_text,
      ctaText: ad.cta_text,
      destinationUrl: ad.destination_url,
      decodedWaText: ad.decoded_wa_text,
      activeDaysCount: ad.active_days_count,
      collationCount: ad.collation_count || 1,
      funnelType: ad.funnel_type,
    });

    const now = new Date().toISOString();
    let updateQuery = supabase
      .from("scraped_competitor_ads")
      .update({
        ai_analysis: analysis as any,
        ai_analyzed_at: now,
        updated_at: now,
      })
      .eq("id", ad.id);

    if (ad.user_id) {
      updateQuery = updateQuery.eq("user_id", ad.user_id);
    }

    await updateQuery;

    return analysis;
  }

  /**
   * Bulk ingestion endpoint for the Tencent Cloud microservice with verified tenant resolution
   */
  static async ingestScrapedAds(payload: {
    keyword: string;
    ads: Array<{
      ad_archive_id: string;
      page_id: string;
      page_name: string;
      page_profile_uri?: string;
      is_active?: boolean;
      start_date: string;
      end_date?: string | null;
      collation_id?: string | null;
      collation_count?: number;
      media_format: MediaFormat;
      cos_media_urls: Array<{ type: "image" | "video"; url: string; width?: number; height?: number }>;
      original_body_text?: string | null;
      headline_title?: string | null;
      link_description?: string | null;
      cta_type?: string | null;
      cta_text?: string | null;
      destination_url?: string | null;
      publisher_platforms?: string[];
    }>;
    jobId?: string;
    tenantContext?: TenantContext;
  }): Promise<{ ingestedCount: number }> {
    const supabase = createAdminClient();

    let verifiedUserId = payload.tenantContext?.userId || null;
    let verifiedOrgId = payload.tenantContext?.organizationId || null;

    // Retrieve verified owner identity strictly from ad_scrape_jobs
    if (payload.jobId) {
      const { data: job } = await supabase
        .from("ad_scrape_jobs")
        .select("user_id, organization_id")
        .eq("id", payload.jobId)
        .single();

      if (job) {
        verifiedUserId = job.user_id || verifiedUserId;
        verifiedOrgId = job.organization_id || verifiedOrgId;
      }
    }

    const rowsToUpsert = payload.ads.map((raw) => {
      const funnel = analyzeAdFunnel({
        destination_url: raw.destination_url,
        cta_type: raw.cta_type,
        cta_text: raw.cta_text,
      });

      const longevity = calculateAdLongevity({
        start_date: raw.start_date,
        end_date: raw.end_date,
        is_active: raw.is_active ?? true,
        collation_count: raw.collation_count ?? 1,
      });

      return {
        user_id: verifiedUserId,
        organization_id: verifiedOrgId,
        scrape_job_id: payload.jobId || null,
        ad_archive_id: raw.ad_archive_id,
        search_keyword: payload.keyword.toLowerCase().trim(),
        page_id: raw.page_id,
        page_name: raw.page_name,
        page_profile_uri: raw.page_profile_uri || null,
        is_active: raw.is_active ?? true,
        start_date: raw.start_date,
        end_date: raw.end_date || null,
        active_days_count: longevity.active_days_count,
        longevity_phase: longevity.longevity_phase,
        collation_id: raw.collation_id || null,
        collation_count: raw.collation_count ?? 1,
        media_format: raw.media_format,
        cos_media_urls: raw.cos_media_urls as any,
        original_body_text: raw.original_body_text || null,
        headline_title: raw.headline_title || null,
        link_description: raw.link_description || null,
        cta_type: raw.cta_type || null,
        cta_text: raw.cta_text || null,
        destination_url: raw.destination_url || null,
        funnel_type: funnel.funnel_type,
        decoded_wa_number: funnel.decoded_wa.phoneNumber,
        decoded_wa_text: funnel.decoded_wa.prefilledText,
        destination_domain: funnel.destination_domain,
        publisher_platforms: raw.publisher_platforms || ["facebook", "instagram"],
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from("scraped_competitor_ads")
      .upsert(rowsToUpsert, { onConflict: "user_id, ad_archive_id" });

    if (error) {
      throw new Error(`Ingest failed: ${error.message}`);
    }

    return { ingestedCount: rowsToUpsert.length };
  }
}
