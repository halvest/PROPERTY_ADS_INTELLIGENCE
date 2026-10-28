-- Property Ads Intelligence - Initial Schema Migration
-- Migration: 20261026000000_initial_schema.sql
-- Description: Creates 14 core entities with RLS and tenant isolation

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Organizations (Tenant boundary)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Profiles (User profile linked to Supabase Auth and Organization)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('owner', 'admin', 'supervisor', 'sales')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper functions for RLS tenant isolation
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. Ad Accounts
CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'demo')),
  provider_account_id TEXT NOT NULL,
  account_name TEXT,
  currency TEXT NOT NULL DEFAULT 'IDR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'error')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ad_accounts_provider UNIQUE (organization_id, provider, provider_account_id)
);

-- 5. Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  provider_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  objective TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaigns_provider UNIQUE (organization_id, provider_campaign_id)
);

-- 6. Ads
CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  provider_ad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ads_provider UNIQUE (organization_id, provider_ad_id)
);

-- 7. Ad Insights (Deterministic metrics)
CREATE TABLE IF NOT EXISTS public.ad_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  level TEXT NOT NULL DEFAULT 'ad' CHECK (level IN ('campaign', 'adset', 'ad')),
  spend NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  impressions INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  source TEXT NOT NULL DEFAULT 'demo' CHECK (source IN ('meta', 'csv', 'demo')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ad_insights_period UNIQUE (organization_id, ad_id, date_start, date_stop, level)
);

-- 8. Contacts (Minimizing raw PII)
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT,
  phone_hash TEXT,
  phone_masked TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  ad_id UUID REFERENCES public.ads(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  channel_conversation_id TEXT,
  attribution_status TEXT NOT NULL DEFAULT 'unknown' CHECK (attribution_status IN ('verified', 'inferred', 'unknown')),
  attribution_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Messages (Individual chat items)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  provider_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL DEFAULT 'buyer' CHECK (sender_type IN ('buyer', 'sales', 'system')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'unknown')),
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Lead Assessments (AI scoring result)
CREATE TABLE IF NOT EXISTS public.lead_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  buyer_score INTEGER CHECK (buyer_score IS NULL OR (buyer_score >= 0 AND buyer_score <= 100)),
  sales_score INTEGER CHECK (sales_score IS NULL OR (sales_score >= 0 AND sales_score <= 100)),
  confidence NUMERIC(3, 2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1.00)),
  score_completeness NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (score_completeness >= 0 AND score_completeness <= 1.00),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'needs_review')),
  missing_information TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  provider TEXT NOT NULL DEFAULT 'meta',
  model_id TEXT NOT NULL DEFAULT 'muse-spark',
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  rubric_version TEXT NOT NULL DEFAULT 'v1',
  raw_assessment JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Assessment Evidence (Evidence per rubric criterion)
CREATE TABLE IF NOT EXISTS public.assessment_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.lead_assessments(id) ON DELETE CASCADE,
  score_type TEXT NOT NULL CHECK (score_type IN ('buyer', 'sales')),
  criterion TEXT NOT NULL,
  points_awarded INTEGER NOT NULL CHECK (points_awarded >= 0),
  max_points INTEGER NOT NULL CHECK (max_points > 0),
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  evidence_excerpt TEXT,
  explanation TEXT,
  evidence_status TEXT NOT NULL DEFAULT 'supported' CHECK (evidence_status IN ('supported', 'missing', 'contradictory')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Review Events (Append-only audit trail for manual corrections)
CREATE TABLE IF NOT EXISTS public.review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.lead_assessments(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_buyer_score INTEGER,
  new_buyer_score INTEGER,
  previous_sales_score INTEGER,
  new_sales_score INTEGER,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Lead Outcomes (Conversion funnel tracking)
CREATE TABLE IF NOT EXISTS public.lead_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('survey', 'booking', 'sale', 'lost', 'unknown')),
  value NUMERIC(14, 2),
  currency TEXT DEFAULT 'IDR',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'integration', 'demo')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Sync Jobs (Integration sync audit)
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'whatsapp', 'demo', 'csv')),
  job_type TEXT NOT NULL CHECK (job_type IN ('ad_insights', 'messages', 'batch_scoring')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  records_processed INTEGER NOT NULL DEFAULT 0 CHECK (records_processed >= 0),
  records_rejected INTEGER NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance & foreign key lookups
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_org ON public.ad_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON public.campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_account ON public.campaigns(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_ads_org ON public.ads(organization_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign ON public.ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_insights_org ON public.ad_insights(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_insights_ad_date ON public.ad_insights(ad_id, date_start, date_stop);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org ON public.conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_ad ON public.conversations(ad_id);
CREATE INDEX IF NOT EXISTS idx_conversations_attr ON public.conversations(attribution_status);
CREATE INDEX IF NOT EXISTS idx_messages_org ON public.messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_sent ON public.messages(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_provider_id ON public.messages(organization_id, provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessments_org ON public.lead_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessments_conv ON public.lead_assessments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_evidence_org ON public.assessment_evidence(organization_id);
CREATE INDEX IF NOT EXISTS idx_evidence_assessment ON public.assessment_evidence(assessment_id);
CREATE INDEX IF NOT EXISTS idx_review_events_org ON public.review_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_events_assessment ON public.review_events(assessment_id);
CREATE INDEX IF NOT EXISTS idx_lead_outcomes_org ON public.lead_outcomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_outcomes_conv ON public.lead_outcomes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_org ON public.sync_jobs(organization_id);

-- Attach updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orgs_updated_at') THEN
    CREATE TRIGGER trg_orgs_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at') THEN
    CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ad_accounts_updated_at') THEN
    CREATE TRIGGER trg_ad_accounts_updated_at BEFORE UPDATE ON public.ad_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_campaigns_updated_at') THEN
    CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ads_updated_at') THEN
    CREATE TRIGGER trg_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contacts_updated_at') THEN
    CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conversations_updated_at') THEN
    CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

-- Enable RLS on all 14 tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- 1. Organizations policies
CREATE POLICY "org_select_member" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.current_user_org_id());

CREATE POLICY "org_update_admin" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'))
  WITH CHECK (id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 2. Profiles policies
CREATE POLICY "profiles_select_org" ON public.profiles
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organization_id = public.current_user_org_id());

-- 3. Ad Accounts policies
CREATE POLICY "ad_accounts_select" ON public.ad_accounts
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "ad_accounts_insert" ON public.ad_accounts
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));
CREATE POLICY "ad_accounts_update" ON public.ad_accounts
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));
CREATE POLICY "ad_accounts_delete" ON public.ad_accounts
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 4. Campaigns policies
CREATE POLICY "campaigns_select" ON public.campaigns
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "campaigns_insert" ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));
CREATE POLICY "campaigns_update" ON public.campaigns
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));
CREATE POLICY "campaigns_delete" ON public.campaigns
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 5. Ads policies
CREATE POLICY "ads_select" ON public.ads
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "ads_insert" ON public.ads
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));
CREATE POLICY "ads_update" ON public.ads
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));
CREATE POLICY "ads_delete" ON public.ads
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 6. Ad Insights policies
CREATE POLICY "ad_insights_select" ON public.ad_insights
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "ad_insights_insert" ON public.ad_insights
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY "ad_insights_update" ON public.ad_insights
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "ad_insights_delete" ON public.ad_insights
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 7. Contacts policies
CREATE POLICY "contacts_select" ON public.contacts
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "contacts_insert" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY "contacts_update" ON public.contacts
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "contacts_delete" ON public.contacts
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 8. Conversations policies
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "conversations_delete" ON public.conversations
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 9. Messages policies
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 10. Lead Assessments policies
CREATE POLICY "lead_assessments_select" ON public.lead_assessments
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "lead_assessments_insert" ON public.lead_assessments
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY "lead_assessments_update" ON public.lead_assessments
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "lead_assessments_delete" ON public.lead_assessments
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 11. Assessment Evidence policies
CREATE POLICY "assessment_evidence_select" ON public.assessment_evidence
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "assessment_evidence_insert" ON public.assessment_evidence
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY "assessment_evidence_update" ON public.assessment_evidence
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "assessment_evidence_delete" ON public.assessment_evidence
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 12. Review Events policies (APPEND-ONLY AUDIT TRAIL: NO UPDATE, NO DELETE)
CREATE POLICY "review_events_select" ON public.review_events
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "review_events_insert" ON public.review_events
  FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_user_org_id() 
    AND reviewer_id = auth.uid()
    AND public.current_user_role() IN ('owner', 'admin', 'supervisor')
  );

-- 13. Lead Outcomes policies
CREATE POLICY "lead_outcomes_select" ON public.lead_outcomes
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "lead_outcomes_insert" ON public.lead_outcomes
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY "lead_outcomes_update" ON public.lead_outcomes
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "lead_outcomes_delete" ON public.lead_outcomes
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));

-- 14. Sync Jobs policies
CREATE POLICY "sync_jobs_select" ON public.sync_jobs
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "sync_jobs_insert" ON public.sync_jobs
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY "sync_jobs_update" ON public.sync_jobs
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org_id());
CREATE POLICY "sync_jobs_delete" ON public.sync_jobs
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN ('owner', 'admin'));
