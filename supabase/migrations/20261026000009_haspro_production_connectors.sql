-- Haspro AI - Production Connector Foundation & Observability
-- Migration: 20261026000009_haspro_production_connectors.sql

-- 1. Unified Integration Connections Table
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'whatsapp')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'syncing', 'error', 'pending_selection', 'expired')),
  external_account_id TEXT,
  external_account_name TEXT,
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  error_message TEXT,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_integration_connections_org_provider UNIQUE (organization_id, provider)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS tr_integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER tr_integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integration_connections_org ON public.integration_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON public.integration_connections(provider);

-- Enable RLS
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Authenticated members can read their organization's integration connections
DROP POLICY IF EXISTS "integration_connections_select" ON public.integration_connections;
CREATE POLICY "integration_connections_select" ON public.integration_connections
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

-- INSERT policy: Only owner and admin can add integration connections
DROP POLICY IF EXISTS "integration_connections_insert" ON public.integration_connections;
CREATE POLICY "integration_connections_insert" ON public.integration_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- UPDATE policy: Only owner and admin can update integration connections
DROP POLICY IF EXISTS "integration_connections_update" ON public.integration_connections;
CREATE POLICY "integration_connections_update" ON public.integration_connections
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org_id())
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- DELETE policy: Only owner and admin can delete integration connections
DROP POLICY IF EXISTS "integration_connections_delete" ON public.integration_connections;
CREATE POLICY "integration_connections_delete" ON public.integration_connections
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- 2. Enhance Ad Insights table with Reach, Link Clicks, Conversions, and Adset tracking
ALTER TABLE public.ad_insights 
  ADD COLUMN IF NOT EXISTS reach INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_clicks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adset_id TEXT,
  ADD COLUMN IF NOT EXISTS adset_name TEXT,
  ADD COLUMN IF NOT EXISTS attribution_setting TEXT;

-- 3. Enhance Sync Jobs table with target account and diagnostic info
ALTER TABLE public.sync_jobs
  ADD COLUMN IF NOT EXISTS target_account_id TEXT,
  ADD COLUMN IF NOT EXISTS time_range JSONB,
  ADD COLUMN IF NOT EXISTS diagnostic_info JSONB;

-- 4. Enhance Meta User Tokens with granted_scopes
ALTER TABLE public.meta_user_tokens
  ADD COLUMN IF NOT EXISTS granted_scopes TEXT[] NOT NULL DEFAULT '{}';

-- 5. Enhance Conversations with Deduplication ID
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS deduplication_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_dedup ON public.conversations(organization_id, deduplication_id) 
  WHERE deduplication_id IS NOT NULL;
