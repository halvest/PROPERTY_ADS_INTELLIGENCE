-- Migration: 20261030000000_tenant_composite_fks.sql
-- Description: Prevent cross-tenant parent references for new writes.
-- Existing single-column FKs allow e.g. a campaign of org A to reference an
-- ad account of org B. Composite FKs bind the parent to the same organization.
-- Added as NOT VALID so deployment does not fail on pre-existing rows;
-- run the audit queries below, remediate, then VALIDATE CONSTRAINT.

-- Supporting unique keys for composite references
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_ad_accounts_id_org'
  ) THEN
    ALTER TABLE public.ad_accounts
      ADD CONSTRAINT uq_ad_accounts_id_org UNIQUE (id, organization_id);
  END IF;
END $$;
ALTER TABLE public.campaigns
  ADD CONSTRAINT uq_campaigns_id_org UNIQUE (id, organization_id);
ALTER TABLE public.ads
  ADD CONSTRAINT uq_ads_id_org UNIQUE (id, organization_id);
ALTER TABLE public.conversations
  ADD CONSTRAINT uq_conversations_id_org UNIQUE (id, organization_id);
ALTER TABLE public.contacts
  ADD CONSTRAINT uq_contacts_id_org UNIQUE (id, organization_id);
ALTER TABLE public.lead_assessments
  ADD CONSTRAINT uq_lead_assessments_id_org UNIQUE (id, organization_id);

ALTER TABLE public.campaigns
  ADD CONSTRAINT fk_campaigns_account_org
  FOREIGN KEY (ad_account_id, organization_id)
  REFERENCES public.ad_accounts (id, organization_id) NOT VALID;

ALTER TABLE public.ads
  ADD CONSTRAINT fk_ads_campaign_org
  FOREIGN KEY (campaign_id, organization_id)
  REFERENCES public.campaigns (id, organization_id) NOT VALID;

ALTER TABLE public.ad_insights
  ADD CONSTRAINT fk_ad_insights_ad_org
  FOREIGN KEY (ad_id, organization_id)
  REFERENCES public.ads (id, organization_id) NOT VALID;

ALTER TABLE public.conversations
  ADD CONSTRAINT fk_conversations_contact_org
  FOREIGN KEY (contact_id, organization_id)
  REFERENCES public.contacts (id, organization_id) NOT VALID;

ALTER TABLE public.messages
  ADD CONSTRAINT fk_messages_conversation_org
  FOREIGN KEY (conversation_id, organization_id)
  REFERENCES public.conversations (id, organization_id) NOT VALID;

ALTER TABLE public.lead_assessments
  ADD CONSTRAINT fk_lead_assessments_conversation_org
  FOREIGN KEY (conversation_id, organization_id)
  REFERENCES public.conversations (id, organization_id) NOT VALID;

ALTER TABLE public.assessment_evidence
  ADD CONSTRAINT fk_assessment_evidence_assessment_org
  FOREIGN KEY (assessment_id, organization_id)
  REFERENCES public.lead_assessments (id, organization_id) NOT VALID;

-- Quarantine ambiguous Meta connections: a "connected" integration row with
-- no stored tenant credential cannot be proven to belong to a legitimate
-- OAuth flow. Mark it expired (data preserved) so the owner must reconnect.
UPDATE public.integration_connections ic
SET status = 'expired',
    error_message = 'Koneksi ditandai untuk verifikasi ulang: tidak ada kredensial OAuth tenant tersimpan.',
    updated_at = now()
WHERE ic.provider = 'meta'
  AND ic.status = 'connected'
  AND NOT EXISTS (
    SELECT 1 FROM public.meta_user_tokens t
    WHERE t.organization_id = ic.organization_id
  );

-- Audit queries (run manually; remediate any rows before VALIDATE):
-- SELECT c.id FROM campaigns c JOIN ad_accounts a ON a.id=c.ad_account_id
--   WHERE a.organization_id <> c.organization_id;
-- SELECT a.id FROM ads a JOIN campaigns c ON c.id=a.campaign_id
--   WHERE c.organization_id <> a.organization_id;
-- SELECT i.id FROM ad_insights i JOIN ads a ON a.id=i.ad_id
--   WHERE a.organization_id <> i.organization_id;
-- After remediation:
-- ALTER TABLE public.campaigns VALIDATE CONSTRAINT fk_campaigns_account_org;
-- ALTER TABLE public.ads VALIDATE CONSTRAINT fk_ads_campaign_org;
-- ALTER TABLE public.ad_insights VALIDATE CONSTRAINT fk_ad_insights_ad_org;
-- ALTER TABLE public.conversations VALIDATE CONSTRAINT fk_conversations_contact_org;
-- ALTER TABLE public.messages VALIDATE CONSTRAINT fk_messages_conversation_org;
-- ALTER TABLE public.lead_assessments VALIDATE CONSTRAINT fk_lead_assessments_conversation_org;
-- ALTER TABLE public.assessment_evidence VALIDATE CONSTRAINT fk_assessment_evidence_assessment_org;
