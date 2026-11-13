-- ==============================================================================
-- ADS SPYING AI MODULE MIGRATION
-- Real-time Meta Ad Library Indonesian Property Spying Engine
-- Tables: ad_scrape_jobs & scraped_competitor_ads
-- ==============================================================================

-- 1. Create table for scrape jobs (Tencent Cloud scraper worker tracking)
CREATE TABLE IF NOT EXISTS public.ad_scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  search_keyword TEXT NOT NULL,
  country_code TEXT DEFAULT 'ID',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  total_ads_found INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 2. Create table for scraped competitor ads
CREATE TABLE IF NOT EXISTS public.scraped_competitor_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_archive_id TEXT UNIQUE NOT NULL,
  search_keyword TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  page_profile_uri TEXT,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  active_days_count INT NOT NULL DEFAULT 1,
  longevity_phase TEXT NOT NULL DEFAULT 'TESTING' CHECK (longevity_phase IN ('TESTING', 'VALIDATING', 'EVERGREEN')),
  collation_id TEXT,
  collation_count INT DEFAULT 1,
  media_format TEXT NOT NULL DEFAULT 'IMAGE' CHECK (media_format IN ('IMAGE', 'VIDEO', 'CAROUSEL', 'NONE')),
  cos_media_urls JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ type: 'image'|'video', url: 'https://...', width?: number, height?: number }]
  original_body_text TEXT,
  headline_title TEXT,
  link_description TEXT,
  cta_type TEXT,
  cta_text TEXT,
  destination_url TEXT,
  funnel_type TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (funnel_type IN ('CTWA', 'LEAD_FORM', 'LANDING_PAGE', 'IG_DIRECT', 'MESSENGER', 'OTHER', 'UNKNOWN')),
  decoded_wa_number TEXT,
  decoded_wa_text TEXT,
  destination_domain TEXT,
  publisher_platforms TEXT[] DEFAULT '{}',
  ai_analysis JSONB, -- GroundedAdAnalysis strictly adhering to zero-hallucination schema
  ai_analyzed_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create high-performance indexes
CREATE INDEX IF NOT EXISTS idx_scraped_ads_keyword ON public.scraped_competitor_ads(LOWER(search_keyword));
CREATE INDEX IF NOT EXISTS idx_scraped_ads_active_days ON public.scraped_competitor_ads(active_days_count DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_ads_funnel ON public.scraped_competitor_ads(funnel_type);
CREATE INDEX IF NOT EXISTS idx_scraped_ads_longevity ON public.scraped_competitor_ads(longevity_phase);
CREATE INDEX IF NOT EXISTS idx_scraped_ads_collation ON public.scraped_competitor_ads(collation_count DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_ads_page_name ON public.scraped_competitor_ads(LOWER(page_name));

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ad_scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_competitor_ads ENABLE ROW LEVEL SECURITY;

-- Read policies: Users can only view their own scrape jobs
CREATE POLICY "Users can only view their own scrape jobs"
  ON public.ad_scrape_jobs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can view shared competitor intelligence
CREATE POLICY "Authenticated users can view scraped competitor ads"
  ON public.scraped_competitor_ads
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: All INSERT and UPDATE operations are handled exclusively by backend APIs
-- and the external Scraper Worker using the Supabase service_role key, which
-- bypasses RLS. No direct client-side writes are permitted for 'authenticated' or 'anon'.
