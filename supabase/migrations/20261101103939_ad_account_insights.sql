-- Preserve Meta's account-level unique reach and frequency for the exact
-- reporting window requested during sync. These metrics cannot be reconstructed
-- by adding ad-level or daily reach because audiences overlap.
CREATE TABLE IF NOT EXISTS public.ad_account_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT,
  reach BIGINT,
  frequency NUMERIC(12, 4),
  currency TEXT,
  source TEXT NOT NULL DEFAULT 'meta' CHECK (source = 'meta'),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ad_account_insights_period_valid CHECK (date_start <= date_stop),
  CONSTRAINT ad_account_insights_metrics_nonnegative CHECK (
    (impressions IS NULL OR impressions >= 0)
    AND (reach IS NULL OR reach >= 0)
    AND (frequency IS NULL OR frequency >= 0)
  ),
  CONSTRAINT uq_ad_account_insights_period UNIQUE (organization_id, ad_account_id, date_start, date_stop),
  CONSTRAINT fk_ad_account_insights_account_org
    FOREIGN KEY (ad_account_id, organization_id)
    REFERENCES public.ad_accounts (id, organization_id) ON DELETE CASCADE
);

ALTER TABLE public.ad_account_insights ENABLE ROW LEVEL SECURITY;

-- Server-side sync/read paths use the service role. Do not expose this table
-- through the authenticated Data API; tenant-scoped admin queries enforce the
-- organization and account IDs in application code.
REVOKE ALL ON TABLE public.ad_account_insights FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ad_account_insights TO service_role;
