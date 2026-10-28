-- Property Ads Intelligence - Attribution Events Audit Migration
-- Migration: 20261026000002_attribution_events.sql
-- Description: Creates append-only audit trail for attribution transitions and corrections

CREATE TABLE IF NOT EXISTS public.attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN ('verified', 'inferred', 'unknown')),
  new_status TEXT NOT NULL CHECK (new_status IN ('verified', 'inferred', 'unknown')),
  previous_ad_id UUID REFERENCES public.ads(id) ON DELETE SET NULL,
  new_ad_id UUID REFERENCES public.ads(id) ON DELETE SET NULL,
  attribution_method TEXT NOT NULL,
  rule_version TEXT NOT NULL DEFAULT 'v1',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by conversation and org
CREATE INDEX IF NOT EXISTS idx_attribution_events_org ON public.attribution_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_attribution_events_conv ON public.attribution_events(conversation_id);

-- Enable RLS
ALTER TABLE public.attribution_events ENABLE ROW LEVEL SECURITY;

-- Append-only policies (SELECT and INSERT only, NO UPDATE or DELETE)
CREATE POLICY "attribution_events_select" ON public.attribution_events
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

CREATE POLICY "attribution_events_insert" ON public.attribution_events
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_org_id());
