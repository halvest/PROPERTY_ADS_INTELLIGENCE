-- ==============================================================================
-- ADS SPYING AI MODULE - TENANT ISOLATION MIGRATION
-- Migration: 20261114000001_ads_spying_tenant_isolation.sql
-- Enforces strict per-account / per-user tenant isolation on competitor intelligence
-- ==============================================================================

-- 1. Ensure tenant identifier columns exist on ad_scrape_jobs
ALTER TABLE public.ad_scrape_jobs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ad_scrape_jobs_user_id ON public.ad_scrape_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_scrape_jobs_org_id ON public.ad_scrape_jobs(organization_id);

-- 2. Add tenant identifier and job relation columns on scraped_competitor_ads
ALTER TABLE public.scraped_competitor_ads
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scrape_job_id UUID REFERENCES public.ad_scrape_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scraped_ads_user_id ON public.scraped_competitor_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_scraped_ads_org_id ON public.scraped_competitor_ads(organization_id);
CREATE INDEX IF NOT EXISTS idx_scraped_ads_job_id ON public.scraped_competitor_ads(scrape_job_id);

-- 3. Replace global unique constraint with tenant-scoped composite unique constraint
-- This allows different tenants/users to independently track the same competitor ad
ALTER TABLE public.scraped_competitor_ads
  DROP CONSTRAINT IF EXISTS scraped_competitor_ads_ad_archive_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scraped_competitor_ads_user_archive_key'
  ) THEN
    ALTER TABLE public.scraped_competitor_ads
      ADD CONSTRAINT scraped_competitor_ads_user_archive_key UNIQUE NULLS NOT DISTINCT (user_id, ad_archive_id);
  END IF;
END $$;

-- 4. Enable RLS on both tables (idempotent)
ALTER TABLE public.ad_scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_competitor_ads ENABLE ROW LEVEL SECURITY;

-- 5. Drop any legacy permissive policies
DROP POLICY IF EXISTS "Authenticated users can view scrape jobs" ON public.ad_scrape_jobs;
DROP POLICY IF EXISTS "Users can only view their own scrape jobs" ON public.ad_scrape_jobs;
DROP POLICY IF EXISTS "Authenticated users can view scraped competitor ads" ON public.scraped_competitor_ads;
DROP POLICY IF EXISTS "Users can only view their own scraped competitor ads" ON public.scraped_competitor_ads;
DROP POLICY IF EXISTS "Anon users can view scraped competitor ads" ON public.scraped_competitor_ads;

-- 6. Apply strict tenant-isolated SELECT policies
CREATE POLICY "Users can only view their own scrape jobs"
  ON public.ad_scrape_jobs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND organization_id = public.current_user_org_id())
  );

CREATE POLICY "Users can only view their own scraped competitor ads"
  ON public.scraped_competitor_ads
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND organization_id = public.current_user_org_id())
  );

-- Note: No direct client-side INSERT or UPDATE is granted to 'authenticated' or 'anon'.
-- All writes are handled strictly by server APIs & the worker via service_role.
