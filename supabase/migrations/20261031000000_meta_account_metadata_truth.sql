-- Meta may omit optional account metadata. Preserve that absence instead of
-- persisting Haspro defaults as if Meta supplied them.
ALTER TABLE public.ad_accounts
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency DROP NOT NULL,
  ALTER COLUMN timezone DROP DEFAULT,
  ALTER COLUMN timezone DROP NOT NULL;

ALTER TABLE public.ad_insights
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency DROP NOT NULL;

-- Prevent legacy demo provenance defaults from silently tagging live rows.
ALTER TABLE public.ad_insights
  ALTER COLUMN source DROP DEFAULT;

-- A completed-but-partial sync is a first-class state in the worker. The
-- original status check omitted it, leaving jobs permanently `running` and
-- causing every later sync attempt to look concurrent.
ALTER TABLE public.sync_jobs
  DROP CONSTRAINT IF EXISTS sync_jobs_status_check;
ALTER TABLE public.sync_jobs
  ADD CONSTRAINT sync_jobs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'partial', 'failed'));

-- Close abandoned jobs from prior process crashes. Keep their diagnostics and
-- previously persisted provider data; this only fixes the job lifecycle state.
UPDATE public.sync_jobs
SET status = 'failed',
    error_code = 'SYNC_INTERRUPTED',
    error_message = 'Sync worker stopped before completion; run Sync Now to retry.',
    completed_at = now()
WHERE status = 'running'
  AND started_at < now() - interval '15 minutes';
