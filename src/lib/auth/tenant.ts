import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

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