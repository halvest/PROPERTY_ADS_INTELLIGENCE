import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEMO_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";
export const DEV_ORGANIZATION_ID = "d2a99e97-b4cd-4e9f-b084-e36214277225";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Demo data may only be enabled by server configuration, never by client input. */
export function isServerDemoMode(): boolean {
  return process.env.DATA_MODE === "demo";
}

export interface SessionTenant {
  userId: string | null;
  organizationId: string | null;
  role: string | null;
}

export async function resolveSessionTenant(
  supabase: SupabaseClient
): Promise<SessionTenant> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, organizationId: null, role: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle();
  return {
    userId: user.id,
    organizationId: profile?.organization_id ?? null,
    role: profile?.role ?? null,
  };
}

/**
 * Resolve tenant for read routes. In production there is no fallback:
 * an authenticated user without a profile has no tenant access.
 * Non-production fallback is explicit and only used for local development.
 */
export function tenantOrDevFallback(organizationId: string | null): string | null {
  if (organizationId) return organizationId;
  return isProduction() ? null : DEMO_ORGANIZATION_ID;
}
