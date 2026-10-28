-- Property Ads Intelligence - WhatsApp Connection Secrets Store
-- Migration: 20261026000007_whatsapp_connection_secrets.sql
-- Description: Isolated, encrypted credential store for WhatsApp Business Coexistence access tokens.
-- Strict server-only table with Row Level Security enabled and ZERO client policies.

CREATE TABLE IF NOT EXISTS public.whatsapp_connection_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'bearer',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_connection_secrets_conn UNIQUE (connection_id)
);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS tr_whatsapp_connection_secrets_updated_at ON public.whatsapp_connection_secrets;
CREATE TRIGGER tr_whatsapp_connection_secrets_updated_at
  BEFORE UPDATE ON public.whatsapp_connection_secrets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_secrets_org ON public.whatsapp_connection_secrets(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_secrets_conn ON public.whatsapp_connection_secrets(connection_id);

-- Enforce global uniqueness for actively connected phone numbers to prevent cross-tenant hijacking
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_connections_phone_active
  ON public.whatsapp_connections (phone_number_id)
  WHERE (connection_status != 'disconnected');

-- Enable RLS with ZERO policies for authenticated users or public
-- This table is strictly server-only, accessible exclusively by service_role
ALTER TABLE public.whatsapp_connection_secrets ENABLE ROW LEVEL SECURITY;
