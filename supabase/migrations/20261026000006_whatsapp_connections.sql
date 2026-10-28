-- Property Ads Intelligence - Official WhatsApp Business Coexistence Connections
-- Migration: 20261026000006_whatsapp_connections.sql
-- Description: Stores WhatsApp Business Account (WABA) connection assets, coexistence status, and non-secret diagnostics with strict RLS isolation.

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  waba_id TEXT NOT NULL CHECK (length(trim(waba_id)) > 0),
  phone_number_id TEXT NOT NULL CHECK (length(trim(phone_number_id)) > 0),
  display_phone_number TEXT,
  verified_name TEXT,
  connection_status TEXT NOT NULL CHECK (connection_status IN ('disconnected', 'connecting', 'connected', 'error', 'reconnect_required')),
  coexistence_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_webhook_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_connections_org_phone UNIQUE (organization_id, phone_number_id)
);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS tr_whatsapp_connections_updated_at ON public.whatsapp_connections;
CREATE TRIGGER tr_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance and webhook tenant resolution
CREATE INDEX IF NOT EXISTS idx_whatsapp_conn_org ON public.whatsapp_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conn_phone ON public.whatsapp_connections(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conn_waba ON public.whatsapp_connections(waba_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conn_status ON public.whatsapp_connections(organization_id, connection_status);

-- Enable RLS
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy: Users can only view connections belonging to their organization
CREATE POLICY "whatsapp_connections_select" ON public.whatsapp_connections
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

-- 2. INSERT policy: Only owner and admin can connect WhatsApp accounts for their organization
CREATE POLICY "whatsapp_connections_insert" ON public.whatsapp_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (connected_by IS NULL OR connected_by = auth.uid())
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- 3. UPDATE policy: Only owner and admin can update connections for their organization
CREATE POLICY "whatsapp_connections_update" ON public.whatsapp_connections
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
  )
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- 4. DELETE policy: Only owner and admin can disconnect/delete connections
CREATE POLICY "whatsapp_connections_delete" ON public.whatsapp_connections
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );
