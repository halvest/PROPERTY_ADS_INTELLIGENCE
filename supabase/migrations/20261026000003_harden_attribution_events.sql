-- Property Ads Intelligence - Harden Attribution Events Security Migration
-- Migration: 20261026000003_harden_attribution_events.sql
-- Description: Enforces actor_id integrity to prevent identity spoofing within tenant organization

DROP POLICY IF EXISTS "attribution_events_insert" ON public.attribution_events;

-- Recreate policy requiring actor_id to match authenticated caller (or be null for system-automated events)
CREATE POLICY "attribution_events_insert" ON public.attribution_events
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );
