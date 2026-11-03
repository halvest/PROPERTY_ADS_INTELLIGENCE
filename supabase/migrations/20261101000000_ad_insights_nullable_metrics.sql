-- Phase 1 (DI-04): preserve "not available" for optional insight metrics.
--
-- reach, link_clicks, and conversions were added as NOT NULL DEFAULT 0 in
-- 20261026000009, which forces the sync layer to store 0 when Meta did not
-- provide a value. Making them nullable lets the database distinguish:
--   0    = Meta explicitly reported zero
--   NULL = value not available / not provided
--
-- Existing rows are NOT rewritten: historical 0 values stay 0 (their true
-- provenance is unknown and must not be invented retroactively).
-- Required metrics (spend, impressions, clicks) stay NOT NULL: rows without
-- them are rejected by per-row validation before persistence.
--
-- DO NOT APPLY without deployment approval. Application code that writes
-- NULL for missing optional metrics must be deployed together with (or
-- after) this migration.

ALTER TABLE public.ad_insights ALTER COLUMN reach DROP NOT NULL;
ALTER TABLE public.ad_insights ALTER COLUMN reach DROP DEFAULT;

ALTER TABLE public.ad_insights ALTER COLUMN link_clicks DROP NOT NULL;
ALTER TABLE public.ad_insights ALTER COLUMN link_clicks DROP DEFAULT;

ALTER TABLE public.ad_insights ALTER COLUMN conversions DROP NOT NULL;
ALTER TABLE public.ad_insights ALTER COLUMN conversions DROP DEFAULT;
