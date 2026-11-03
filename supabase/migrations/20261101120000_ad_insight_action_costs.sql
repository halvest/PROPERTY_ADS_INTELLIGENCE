-- Preserve Meta's action-specific cost-per-result values instead of deriving
-- a blended cost from spend across unrelated campaign objectives.
ALTER TABLE public.ad_insights
  ADD COLUMN IF NOT EXISTS cost_per_action_type JSONB NOT NULL DEFAULT '{}'::jsonb;
