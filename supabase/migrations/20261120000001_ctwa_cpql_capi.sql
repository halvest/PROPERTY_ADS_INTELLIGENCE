-- =============================================================================
-- Haspro (hdcreative.cloud) — Stage 6: Auto-CPQL & Meta CAPI Dispatch Logs
-- Additive migration; strictly workspace-isolated via RLS.
-- =============================================================================

-- 1. CTWA AD SPEND SNAPSHOTS (Meta Marketing API spend & metadata cache)
CREATE TABLE IF NOT EXISTS public.ctwa_ad_spend_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL CHECK (length(trim(ad_id)) > 0),
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_name TEXT,
  spend NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  impressions INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ctwa_ad_spend_ws_ad_dates UNIQUE (workspace_id, ad_id, date_start, date_stop),
  CONSTRAINT chk_ctwa_ad_spend_dates CHECK (date_stop >= date_start)
);

CREATE INDEX IF NOT EXISTS idx_ctwa_ad_spend_ws_ad
  ON public.ctwa_ad_spend_snapshots(workspace_id, ad_id);

CREATE INDEX IF NOT EXISTS idx_ctwa_ad_spend_ws_dates
  ON public.ctwa_ad_spend_snapshots(workspace_id, date_start DESC, date_stop DESC);

ALTER TABLE public.ctwa_ad_spend_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ctwa_ad_spend_snapshots_select_member" ON public.ctwa_ad_spend_snapshots;
DROP POLICY IF EXISTS "ctwa_ad_spend_snapshots_insert_member" ON public.ctwa_ad_spend_snapshots;
DROP POLICY IF EXISTS "ctwa_ad_spend_snapshots_update_admin" ON public.ctwa_ad_spend_snapshots;

CREATE POLICY "ctwa_ad_spend_snapshots_select_member" ON public.ctwa_ad_spend_snapshots
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "ctwa_ad_spend_snapshots_insert_member" ON public.ctwa_ad_spend_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "ctwa_ad_spend_snapshots_update_admin" ON public.ctwa_ad_spend_snapshots
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

-- 2. CAPI DISPATCH LOGS (Idempotent audit log for Meta Business Messaging CAPI)
CREATE TABLE IF NOT EXISTS public.capi_dispatch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK (event_name IN ('QualifiedLead', 'Schedule', 'Purchase')),
  event_id TEXT NOT NULL UNIQUE CHECK (length(trim(event_id)) > 0),
  ctwa_clid_masked TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  http_status INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capi_dispatch_logs_ws_created
  ON public.capi_dispatch_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_capi_dispatch_logs_lead_id
  ON public.capi_dispatch_logs(lead_id);

ALTER TABLE public.capi_dispatch_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capi_dispatch_logs_select_member" ON public.capi_dispatch_logs;
DROP POLICY IF EXISTS "capi_dispatch_logs_insert_member" ON public.capi_dispatch_logs;
DROP POLICY IF EXISTS "capi_dispatch_logs_update_admin" ON public.capi_dispatch_logs;

CREATE POLICY "capi_dispatch_logs_select_member" ON public.capi_dispatch_logs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "capi_dispatch_logs_insert_member" ON public.capi_dispatch_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "capi_dispatch_logs_update_admin" ON public.capi_dispatch_logs
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));
