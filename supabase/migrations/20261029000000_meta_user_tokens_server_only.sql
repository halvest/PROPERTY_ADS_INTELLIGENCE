-- Migration: 20261029000000_meta_user_tokens_server_only.sql
-- Description: Restore meta_user_tokens to strict server-only access.
-- Encrypted Meta access tokens must never be readable through the
-- authenticated client role; only service_role (server) may access this table.
-- RLS remains enabled with zero client policies (see 20261026000008).

DROP POLICY IF EXISTS "meta_user_tokens_select" ON public.meta_user_tokens;
DROP POLICY IF EXISTS "meta_user_tokens_insert" ON public.meta_user_tokens;
DROP POLICY IF EXISTS "meta_user_tokens_update" ON public.meta_user_tokens;
DROP POLICY IF EXISTS "meta_user_tokens_delete" ON public.meta_user_tokens;

ALTER TABLE public.meta_user_tokens ENABLE ROW LEVEL SECURITY;
