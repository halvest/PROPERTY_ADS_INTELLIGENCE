-- Property Ads Intelligence - Persistent Ad Recommendation Reviews
-- Migration: 20261026000005_ad_recommendation_reviews.sql
-- Description: Creates ad_recommendation_reviews table with strict RLS multi-tenant isolation, idempotent uniqueness, and audit trail

CREATE TABLE IF NOT EXISTS public.ad_recommendation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL CHECK (length(trim(recommendation_id)) > 0),
  status TEXT NOT NULL CHECK (status IN ('reviewed', 'dismissed')),
  reviewed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewer_name TEXT,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ad_recommendation_reviews UNIQUE (organization_id, recommendation_id)
);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS tr_ad_rec_reviews_updated_at ON public.ad_recommendation_reviews;
CREATE TRIGGER tr_ad_rec_reviews_updated_at
  BEFORE UPDATE ON public.ad_recommendation_reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for tenant lookups and performance
CREATE INDEX IF NOT EXISTS idx_ad_rec_reviews_org ON public.ad_recommendation_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_rec_reviews_rec ON public.ad_recommendation_reviews(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_ad_rec_reviews_org_status ON public.ad_recommendation_reviews(organization_id, status);

-- Enable RLS
ALTER TABLE public.ad_recommendation_reviews ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy: Users can only read reviews belonging to their organization
CREATE POLICY "ad_rec_reviews_select" ON public.ad_recommendation_reviews
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

-- 2. INSERT policy: Users can only insert reviews for their own organization without impersonating others
CREATE POLICY "ad_rec_reviews_insert" ON public.ad_recommendation_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND reviewed_by = auth.uid()
    AND public.current_user_role() IN ('owner', 'admin', 'supervisor', 'sales')
  );

-- 3. UPDATE policy: Users can only update reviews in their organization
CREATE POLICY "ad_rec_reviews_update" ON public.ad_recommendation_reviews
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
  )
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND reviewed_by = auth.uid()
    AND public.current_user_role() IN ('owner', 'admin', 'supervisor', 'sales')
  );

-- 4. DELETE policy: Only owner or admin can delete review records within their organization
CREATE POLICY "ad_rec_reviews_delete" ON public.ad_recommendation_reviews
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );
