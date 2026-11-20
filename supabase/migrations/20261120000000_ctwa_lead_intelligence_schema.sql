-- Haspro (hdcreative.cloud) - AI-Powered CTWA Lead Intelligence (Analysis-Only)
-- Migration: 20261120000000_ctwa_lead_intelligence_schema.sql
-- Description: Multi-tenant workspace schema, WhatsApp Coexistence & Cloud API metadata,
--   isolated secrets store, idempotent webhook ingestion, CTWA attribution, and
--   strictly separated lead_temperature vs pipeline_stage tracking with RLS & plan limits.
--
-- Compatibility Note:
--   `whatsapp_connections`, `whatsapp_connection_secrets`, `conversations`, and `messages`
--   already exist from prior migrations (scoped by `organization_id`). This migration
--   additively evolves those 4 tables with `workspace_id` and CTWA columns without
--   dropping existing columns or constraints.

-- ---------------------------------------------------------------------------
-- 0. Shared trigger helper (idempotent safeguard)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. WORKSPACES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 2. WORKSPACE MEMBERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'sales', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_members_workspace_user UNIQUE (workspace_id, user_id)
);

-- Automatically register the workspace creator/owner into workspace_members
CREATE OR REPLACE FUNCTION public.handle_new_workspace_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_workspace_owner_member() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_workspaces_add_owner_member ON public.workspaces;
CREATE TRIGGER trg_workspaces_add_owner_member
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_owner_member();

-- ---------------------------------------------------------------------------
-- 3. RLS MEMBERSHIP HELPERS (SECURITY DEFINER, recursion-free)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN ws_id IS NULL OR (SELECT auth.uid()) IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id
        AND wm.user_id = (SELECT auth.uid())
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN ws_id IS NULL OR (SELECT auth.uid()) IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id
        AND wm.user_id = (SELECT auth.uid())
        AND wm.role IN ('owner', 'admin')
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_workspace_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. SUBSCRIPTIONS (Starter=1, Standard=3, Premium=5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'standard', 'premium')),
  max_whatsapp_connections INTEGER NOT NULL CHECK (max_whatsapp_connections IN (1, 3, 5)),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscriptions_workspace UNIQUE (workspace_id),
  CONSTRAINT chk_subscriptions_plan_limit CHECK (
    (plan = 'starter' AND max_whatsapp_connections = 1) OR
    (plan = 'standard' AND max_whatsapp_connections = 3) OR
    (plan = 'premium' AND max_whatsapp_connections = 5)
  )
);

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 5. WHATSAPP CONNECTIONS (Additive evolution over existing table)
--    Token is NEVER stored here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sales_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  phone_number_id TEXT NOT NULL CHECK (length(trim(phone_number_id)) > 0),
  waba_id TEXT,
  display_phone_number TEXT,
  connection_status TEXT NOT NULL DEFAULT 'pending',
  integration_mode TEXT NOT NULL DEFAULT 'coexistence',
  last_echo_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sales_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integration_mode TEXT NOT NULL DEFAULT 'coexistence',
  ADD COLUMN IF NOT EXISTS last_echo_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_connections'
      AND column_name = 'organization_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.whatsapp_connections ALTER COLUMN organization_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_connections'
      AND column_name = 'waba_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.whatsapp_connections ALTER COLUMN waba_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_connections_connection_status_check,
  DROP CONSTRAINT IF EXISTS whatsapp_connections_waba_id_check,
  DROP CONSTRAINT IF EXISTS whatsapp_connections_integration_mode_check;

ALTER TABLE public.whatsapp_connections
  ADD CONSTRAINT whatsapp_connections_connection_status_check
    CHECK (connection_status IN ('pending', 'connected', 'disconnected', 'error', 'connecting', 'reconnect_required')),
  ADD CONSTRAINT whatsapp_connections_waba_id_check
    CHECK (waba_id IS NULL OR length(trim(waba_id)) > 0),
  ADD CONSTRAINT whatsapp_connections_integration_mode_check
    CHECK (integration_mode IN ('coexistence', 'cloud_api'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_whatsapp_connections_phone_number_id'
      AND conrelid = 'public.whatsapp_connections'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_connections
      ADD CONSTRAINT uq_whatsapp_connections_phone_number_id UNIQUE (phone_number_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_whatsapp_connections_updated_at ON public.whatsapp_connections;
CREATE TRIGGER tr_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enforce per-workspace plan limits on connected WhatsApp numbers (Starter=1, Standard=3, Premium=5)
CREATE OR REPLACE FUNCTION public.enforce_whatsapp_connection_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_sub_status TEXT;
  v_limit INTEGER;
  v_connected_count INTEGER;
BEGIN
  IF NEW.connection_status <> 'connected' OR NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent connection activations for the same workspace
  PERFORM 1 FROM public.workspaces WHERE id = NEW.workspace_id FOR UPDATE;

  SELECT s.status, s.max_whatsapp_connections
  INTO v_sub_status, v_limit
  FROM public.subscriptions s
  WHERE s.workspace_id = NEW.workspace_id
  LIMIT 1;

  IF FOUND THEN
    IF v_sub_status NOT IN ('active', 'trialing') THEN
      RAISE EXCEPTION 'Workspace subscription is inactive (status: %); cannot connect WhatsApp number.', v_sub_status
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    -- Default to Starter cap (1) if subscription row has not been provisioned yet
    v_limit := 1;
  END IF;

  SELECT COUNT(*)
  INTO v_connected_count
  FROM public.whatsapp_connections wc
  WHERE wc.workspace_id = NEW.workspace_id
    AND wc.connection_status = 'connected'
    AND wc.id <> NEW.id;

  IF v_connected_count >= v_limit THEN
    RAISE EXCEPTION 'WhatsApp connection limit reached (% of % allowed) for workspace %.',
      v_connected_count, v_limit, NEW.workspace_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_whatsapp_connection_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_whatsapp_connection_limit ON public.whatsapp_connections;
CREATE TRIGGER trg_enforce_whatsapp_connection_limit
  BEFORE INSERT OR UPDATE OF connection_status, workspace_id
  ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_whatsapp_connection_limit();

-- ---------------------------------------------------------------------------
-- 6. WHATSAPP CONNECTION SECRETS (Server-only, service_role exclusive)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_connection_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL UNIQUE REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_connection_secrets
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_connection_secrets'
      AND column_name = 'organization_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.whatsapp_connection_secrets ALTER COLUMN organization_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_connection_secrets'
      AND column_name = 'encryption_iv' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.whatsapp_connection_secrets ALTER COLUMN encryption_iv DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_connection_secrets'
      AND column_name = 'encryption_tag' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.whatsapp_connection_secrets ALTER COLUMN encryption_tag DROP NOT NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_whatsapp_connection_secrets_updated_at ON public.whatsapp_connection_secrets;
CREATE TRIGGER tr_whatsapp_connection_secrets_updated_at
  BEFORE UPDATE ON public.whatsapp_connection_secrets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 7. WEBHOOK EVENTS (Idempotent raw Meta WhatsApp webhook log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  phone_number_id TEXT NOT NULL CHECK (length(trim(phone_number_id)) > 0),
  meta_event_id TEXT NOT NULL UNIQUE CHECK (length(trim(meta_event_id)) > 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('messages', 'smb_message_echoes', 'history', 'smb_app_state_sync', 'other')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 8. CONVERSATIONS (Additive evolution over existing table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  customer_wa_id TEXT,
  customer_name TEXT,
  source_type TEXT NOT NULL DEFAULT 'unknown',
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_prospect_message_at TIMESTAMPTZ,
  last_sales_echo_at TIMESTAMPTZ,
  first_response_time_seconds INTEGER,
  needs_ai_analysis BOOLEAN NOT NULL DEFAULT false,
  last_ai_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_wa_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS first_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_prospect_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sales_echo_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS needs_ai_analysis BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_ai_analyzed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations'
      AND column_name = 'organization_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.conversations ALTER COLUMN organization_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations'
      AND column_name = 'contact_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.conversations ALTER COLUMN contact_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_source_type_check,
  DROP CONSTRAINT IF EXISTS conversations_first_response_time_seconds_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_source_type_check
    CHECK (source_type IN ('ctwa', 'organic', 'unknown')),
  ADD CONSTRAINT conversations_first_response_time_seconds_check
    CHECK (first_response_time_seconds IS NULL OR first_response_time_seconds >= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_conversations_connection_customer_wa'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT uq_conversations_connection_customer_wa UNIQUE (connection_id, customer_wa_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 9. MESSAGES (Additive evolution over existing table, Analysis-Only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  wamid TEXT UNIQUE,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  body_text TEXT,
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS wamid TEXT,
  ADD COLUMN IF NOT EXISTS body_text TEXT,
  ADD COLUMN IF NOT EXISTS raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages'
      AND column_name = 'organization_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.messages ALTER COLUMN organization_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages'
      AND column_name = 'body'
  ) THEN
    ALTER TABLE public.messages ALTER COLUMN body SET DEFAULT '';
  END IF;
END $$;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_direction_check,
  DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_direction_check
    CHECK (direction IN ('inbound_prospect', 'outbound_sales_echo', 'inbound', 'outbound')),
  ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN (
      'text', 'image', 'video', 'document', 'audio', 'sticker',
      'location', 'contacts', 'interactive', 'template', 'reaction', 'other', 'unknown'
    ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_messages_wamid'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT uq_messages_wamid UNIQUE (wamid);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10. CTWA ATTRIBUTIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ctwa_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  headline TEXT,
  body TEXT,
  ctwa_clid TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_name TEXT,
  attribution_confidence NUMERIC(3, 2) CHECK (attribution_confidence IS NULL OR (attribution_confidence >= 0 AND attribution_confidence <= 1.00)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 11. LEADS (Separated lead_temperature vs pipeline_stage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  assigned_sales_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone_masked TEXT,
  lead_temperature TEXT NOT NULL DEFAULT 'cold'
    CHECK (lead_temperature IN ('cold', 'warm', 'hot', 'junk')),
  pipeline_stage TEXT NOT NULL DEFAULT 'new_inquiry'
    CHECK (pipeline_stage IN ('new_inquiry', 'contacted', 'qualified', 'survey', 'closing', 'won', 'lost')),
  ai_score INTEGER CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ai_confidence NUMERIC(3, 2) CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1.00)),
  ai_summary TEXT,
  manual_stage_lock BOOLEAN NOT NULL DEFAULT false,
  needs_human_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 12. LEAD AI ANALYSES (Immutable AI analysis snapshot history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  raw_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  lead_temperature TEXT NOT NULL CHECK (lead_temperature IN ('cold', 'warm', 'hot', 'junk')),
  pipeline_stage_suggestion TEXT NOT NULL CHECK (pipeline_stage_suggestion IN ('new_inquiry', 'contacted', 'qualified', 'survey', 'closing', 'won', 'lost')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1.00),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 13. LEAD PIPELINE EVENTS (Append-only transition audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ai', 'human', 'system')),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  from_stage TEXT CHECK (from_stage IS NULL OR from_stage IN ('new_inquiry', 'contacted', 'qualified', 'survey', 'closing', 'won', 'lost')),
  to_stage TEXT CHECK (to_stage IS NULL OR to_stage IN ('new_inquiry', 'contacted', 'qualified', 'survey', 'closing', 'won', 'lost')),
  from_temperature TEXT CHECK (from_temperature IS NULL OR from_temperature IN ('cold', 'warm', 'hot', 'junk')),
  to_temperature TEXT CHECK (to_temperature IS NULL OR to_temperature IN ('cold', 'warm', 'hot', 'junk')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 14. OPTIMAL INDEXES
-- ---------------------------------------------------------------------------
-- Workspaces & Membership
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_role ON public.workspace_members(workspace_id, role);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ws_status ON public.subscriptions(workspace_id, status);

-- WhatsApp Connections & Secrets
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_ws_status ON public.whatsapp_connections(workspace_id, connection_status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_phone_id ON public.whatsapp_connections(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_sales_member ON public.whatsapp_connections(sales_member_id) WHERE sales_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_secrets_workspace ON public.whatsapp_connection_secrets(workspace_id);

-- Webhook Ingestion Hot Path (phone_number_id, meta_event_id, status)
CREATE INDEX IF NOT EXISTS idx_webhook_events_phone_received ON public.webhook_events(phone_number_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_meta_event_id ON public.webhook_events(meta_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_ws_status ON public.webhook_events(workspace_id, status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending ON public.webhook_events(status, received_at) WHERE status IN ('pending', 'processing');

-- Conversations & Messages
CREATE INDEX IF NOT EXISTS idx_conversations_ws_last_msg ON public.conversations(workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_needs_ai ON public.conversations(workspace_id, needs_ai_analysis, last_message_at DESC) WHERE needs_ai_analysis = true;
CREATE INDEX IF NOT EXISTS idx_conversations_conn_wa ON public.conversations(connection_id, customer_wa_id);
CREATE INDEX IF NOT EXISTS idx_messages_ws_conv_sent ON public.messages(workspace_id, conversation_id, sent_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_wamid ON public.messages(wamid) WHERE wamid IS NOT NULL;

-- CTWA Attribution Lookup
CREATE INDEX IF NOT EXISTS idx_ctwa_attributions_source_id ON public.ctwa_attributions(source_id);
CREATE INDEX IF NOT EXISTS idx_ctwa_attributions_ws_source ON public.ctwa_attributions(workspace_id, source_id);
CREATE INDEX IF NOT EXISTS idx_ctwa_attributions_clid ON public.ctwa_attributions(ctwa_clid) WHERE ctwa_clid IS NOT NULL;

-- Dashboard & Pipeline Queries (workspace_id, lead_temperature, pipeline_stage, created_at)
CREATE INDEX IF NOT EXISTS idx_leads_ws_temp_stage_created ON public.leads(workspace_id, lead_temperature, pipeline_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_ws_stage_created ON public.leads(workspace_id, pipeline_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_sales ON public.leads(workspace_id, assigned_sales_id) WHERE assigned_sales_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_review_queue ON public.leads(workspace_id, created_at DESC) WHERE needs_human_review = true;

-- AI Analysis & Pipeline Audit History
CREATE INDEX IF NOT EXISTS idx_lead_ai_analyses_ws_lead ON public.lead_ai_analyses(workspace_id, lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_ai_analyses_lead_id ON public.lead_ai_analyses(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_analyses_conversation_id ON public.lead_ai_analyses(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_events_ws_lead ON public.lead_pipeline_events(workspace_id, lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_events_lead_id ON public.lead_pipeline_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_events_actor_user_id ON public.lead_pipeline_events(actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_connection_id ON public.leads(connection_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_sales_id ON public.leads(assigned_sales_id) WHERE assigned_sales_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY (RLS) ON ALL 12 TABLES
--     Strict workspace_members isolation; ZERO global USING(true) policies;
--     ZERO authenticated/anon policies on whatsapp_connection_secrets.
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctwa_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pipeline_events ENABLE ROW LEVEL SECURITY;

-- 15.1 workspaces
DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_admin" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_owner" ON public.workspaces;

CREATE POLICY "workspaces_select_member" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(id)
    OR owner_id = (SELECT auth.uid())
  );

CREATE POLICY "workspaces_insert_owner" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "workspaces_update_admin" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(id))
  WITH CHECK (public.is_workspace_admin(id));

CREATE POLICY "workspaces_delete_owner" ON public.workspaces
  FOR DELETE TO authenticated
  USING (
    public.is_workspace_member(id)
    AND owner_id = (SELECT auth.uid())
  );

-- 15.2 workspace_members
DROP POLICY IF EXISTS "workspace_members_select_member" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_admin" ON public.workspace_members;

CREATE POLICY "workspace_members_select_member" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace_members_insert_admin" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "workspace_members_update_admin" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "workspace_members_delete_admin" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));

-- 15.3 subscriptions (read-only to workspace members; billing writes via service_role only)
DROP POLICY IF EXISTS "subscriptions_select_member" ON public.subscriptions;

CREATE POLICY "subscriptions_select_member" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- 15.4 whatsapp_connections (replace legacy org policies with workspace_members isolation)
DROP POLICY IF EXISTS "whatsapp_connections_select" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "whatsapp_connections_insert" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "whatsapp_connections_update" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "whatsapp_connections_delete" ON public.whatsapp_connections;

CREATE POLICY "whatsapp_connections_select_member" ON public.whatsapp_connections
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "whatsapp_connections_insert_admin" ON public.whatsapp_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "whatsapp_connections_update_admin" ON public.whatsapp_connections
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "whatsapp_connections_delete_admin" ON public.whatsapp_connections
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));

-- 15.5 whatsapp_connection_secrets (STRICTLY server-only: zero authenticated/anon policies)
DROP POLICY IF EXISTS "whatsapp_connection_secrets_select" ON public.whatsapp_connection_secrets;
DROP POLICY IF EXISTS "whatsapp_connection_secrets_insert" ON public.whatsapp_connection_secrets;
DROP POLICY IF EXISTS "whatsapp_connection_secrets_update" ON public.whatsapp_connection_secrets;
DROP POLICY IF EXISTS "whatsapp_connection_secrets_delete" ON public.whatsapp_connection_secrets;
REVOKE ALL ON TABLE public.whatsapp_connection_secrets FROM anon, authenticated;

-- 15.6 webhook_events (members can read events resolved to their workspace; writes via service_role)
DROP POLICY IF EXISTS "webhook_events_select_member" ON public.webhook_events;

CREATE POLICY "webhook_events_select_member" ON public.webhook_events
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- 15.7 conversations (replace legacy org policies with workspace_members isolation)
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;

CREATE POLICY "conversations_select_member" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "conversations_insert_member" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "conversations_update_member" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "conversations_delete_admin" ON public.conversations
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));

-- 15.8 messages (replace legacy org policies with workspace_members isolation, append-only)
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;

CREATE POLICY "messages_select_member" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

-- 15.9 ctwa_attributions
DROP POLICY IF EXISTS "ctwa_attributions_select_member" ON public.ctwa_attributions;
DROP POLICY IF EXISTS "ctwa_attributions_insert_member" ON public.ctwa_attributions;
DROP POLICY IF EXISTS "ctwa_attributions_update_admin" ON public.ctwa_attributions;

CREATE POLICY "ctwa_attributions_select_member" ON public.ctwa_attributions
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "ctwa_attributions_insert_member" ON public.ctwa_attributions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "ctwa_attributions_update_admin" ON public.ctwa_attributions
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

-- 15.10 leads
DROP POLICY IF EXISTS "leads_select_member" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_member" ON public.leads;
DROP POLICY IF EXISTS "leads_update_member" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_admin" ON public.leads;

CREATE POLICY "leads_select_member" ON public.leads
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "leads_insert_member" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "leads_update_member" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "leads_delete_admin" ON public.leads
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));

-- 15.11 lead_ai_analyses (immutable AI history: select + insert for workspace members)
DROP POLICY IF EXISTS "lead_ai_analyses_select_member" ON public.lead_ai_analyses;
DROP POLICY IF EXISTS "lead_ai_analyses_insert_member" ON public.lead_ai_analyses;

CREATE POLICY "lead_ai_analyses_select_member" ON public.lead_ai_analyses
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "lead_ai_analyses_insert_member" ON public.lead_ai_analyses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

-- 15.12 lead_pipeline_events (append-only audit trail: select + insert for workspace members)
DROP POLICY IF EXISTS "lead_pipeline_events_select_member" ON public.lead_pipeline_events;
DROP POLICY IF EXISTS "lead_pipeline_events_insert_member" ON public.lead_pipeline_events;

CREATE POLICY "lead_pipeline_events_select_member" ON public.lead_pipeline_events
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "lead_pipeline_events_insert_member" ON public.lead_pipeline_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND (actor_user_id IS NULL OR actor_user_id = (SELECT auth.uid()))
  );
