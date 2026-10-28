-- ==============================================================================
-- Migration: 20261026000010_meta_user_tokens_rls.sql
-- Description: Add strict Row-Level Security policies to meta_user_tokens table
--              ensuring multi-tenant isolation, role authorization, and safe
--              authenticated token persistence.
-- ==============================================================================

-- 1. Ensure RLS is enabled on meta_user_tokens
ALTER TABLE public.meta_user_tokens ENABLE ROW LEVEL SECURITY;

-- 2. SELECT Policy:
-- Authenticated users can only read token records belonging to their own organization,
-- restricted to administrative roles ('owner', 'admin', 'supervisor').
DROP POLICY IF EXISTS "meta_user_tokens_select" ON public.meta_user_tokens;
CREATE POLICY "meta_user_tokens_select" ON public.meta_user_tokens
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text])
  );

-- 3. INSERT Policy:
-- Authenticated users can only insert token records for their own verified organization,
-- with user_id matching auth.uid() (or NULL), and restricted to 'owner', 'admin', 'supervisor'.
DROP POLICY IF EXISTS "meta_user_tokens_insert" ON public.meta_user_tokens;
CREATE POLICY "meta_user_tokens_insert" ON public.meta_user_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (user_id IS NULL OR user_id = auth.uid())
    AND public.current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text])
  );

-- 4. UPDATE Policy:
-- Authenticated users can only update token records for their own verified organization,
-- restricted to 'owner', 'admin', 'supervisor'.
DROP POLICY IF EXISTS "meta_user_tokens_update" ON public.meta_user_tokens;
CREATE POLICY "meta_user_tokens_update" ON public.meta_user_tokens
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text])
  )
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (user_id IS NULL OR user_id = auth.uid())
    AND public.current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text])
  );

-- 5. DELETE Policy:
-- Authenticated users can only delete token records for their own verified organization.
DROP POLICY IF EXISTS "meta_user_tokens_delete" ON public.meta_user_tokens;
CREATE POLICY "meta_user_tokens_delete" ON public.meta_user_tokens
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text])
  );
