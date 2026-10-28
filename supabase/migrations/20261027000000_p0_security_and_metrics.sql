-- ==============================================================================
-- Migration: 20261027000000_p0_security_and_metrics.sql
-- Description: P0 Security hardening, role privilege escalation protection,
--              meta token RLS hardening, and ad insights action breakdown schema.
-- ==============================================================================

-- 1. Hardening profiles_update_self: Prevent role privilege escalation
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() 
    AND organization_id = public.current_user_org_id()
    AND (
      -- Regular members cannot change their own role
      role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      OR public.current_user_role() IN ('owner', 'admin')
    )
  );

-- 2. Database trigger to guarantee role immutability by non-admin/owner users
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- If executed by an authenticated user who is NOT owner or admin in this org
    IF auth.role() = 'authenticated' AND public.current_user_role() NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Privilege escalation rejected: users cannot modify roles without owner or admin privileges.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 3. Hardening meta_user_tokens: Server & Admin only (restrict supervisor read access)
DROP POLICY IF EXISTS "meta_user_tokens_select" ON public.meta_user_tokens;
CREATE POLICY "meta_user_tokens_select" ON public.meta_user_tokens
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "meta_user_tokens_insert" ON public.meta_user_tokens;
CREATE POLICY "meta_user_tokens_insert" ON public.meta_user_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (user_id IS NULL OR user_id = auth.uid())
    AND public.current_user_role() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "meta_user_tokens_update" ON public.meta_user_tokens;
CREATE POLICY "meta_user_tokens_update" ON public.meta_user_tokens
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (user_id IS NULL OR user_id = auth.uid())
    AND public.current_user_role() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "meta_user_tokens_delete" ON public.meta_user_tokens;
CREATE POLICY "meta_user_tokens_delete" ON public.meta_user_tokens
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );

-- 4. Enhance ad_insights with action breakdown, conversion action type, and mapping version
ALTER TABLE public.ad_insights
  ADD COLUMN IF NOT EXISTS action_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS conversion_action_type TEXT,
  ADD COLUMN IF NOT EXISTS mapping_version TEXT NOT NULL DEFAULT 'v1';

-- 5. Create index for action breakdown queries and performance analysis
CREATE INDEX IF NOT EXISTS idx_ad_insights_conv_action_type 
  ON public.ad_insights(organization_id, conversion_action_type)
  WHERE conversion_action_type IS NOT NULL;
