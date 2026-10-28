-- Property Ads Intelligence - Meta Asset Onboarding & Selection Store
-- Migration: 20261026000008_meta_asset_onboarding.sql
-- Description: Stores selected Meta assets (Facebook Page, Instagram account, Ad Account)
-- and isolated, encrypted user access tokens with strict Row Level Security.

-- 1. Meta Asset Selections Table (Tenant-scoped metadata)
CREATE TABLE IF NOT EXISTS public.meta_asset_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_id TEXT,
  page_name TEXT,
  instagram_account_id TEXT,
  instagram_username TEXT,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'pending_selection')),
  last_validated_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_meta_asset_selections_org UNIQUE (organization_id)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS tr_meta_asset_selections_updated_at ON public.meta_asset_selections;
CREATE TRIGGER tr_meta_asset_selections_updated_at
  BEFORE UPDATE ON public.meta_asset_selections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meta_asset_org ON public.meta_asset_selections(organization_id);
CREATE INDEX IF NOT EXISTS idx_meta_asset_ad_acc ON public.meta_asset_selections(ad_account_id);

-- Enable RLS for meta_asset_selections
ALTER TABLE public.meta_asset_selections ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Authenticated users can view their organization's selected assets
CREATE POLICY "meta_asset_selections_select" ON public.meta_asset_selections
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

-- INSERT policy: Only owner and admin can save Meta asset selections
CREATE POLICY "meta_asset_selections_insert" ON public.meta_asset_selections
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- UPDATE policy: Only owner and admin can update Meta asset selections
CREATE POLICY "meta_asset_selections_update" ON public.meta_asset_selections
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org_id())
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- DELETE policy: Only owner and admin can remove Meta asset selections
CREATE POLICY "meta_asset_selections_delete" ON public.meta_asset_selections
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- 2. Meta User Tokens Table (Strictly server-only encrypted store)
CREATE TABLE IF NOT EXISTS public.meta_user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'bearer',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_meta_user_tokens_org UNIQUE (organization_id)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS tr_meta_user_tokens_updated_at ON public.meta_user_tokens;
CREATE TRIGGER tr_meta_user_tokens_updated_at
  BEFORE UPDATE ON public.meta_user_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS with ZERO client policies (Server-side service_role access only)
ALTER TABLE public.meta_user_tokens ENABLE ROW LEVEL SECURITY;
