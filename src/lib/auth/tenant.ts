import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SessionTenant {
  userId: string | null;
  user: User | null;
  organizationId: string | null;
  role: string | null;
}

export async function resolveSessionTenant(
  supabase: SupabaseClient,
  bearerToken?: string | null
): Promise<SessionTenant> {
  const {
    data: { user },
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (!user) return { userId: null, user: null, organizationId: null, role: null };

  let organizationId: string | null = null;
  let role: string | null = null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.organization_id) {
    organizationId = profile.organization_id;
    role = profile.role;
  } else {
    // Admin fallback for verified user in case cookie context lacks RLS permissions
    try {
      const admin = createAdminClient();
      const { data: adminProfile } = await admin
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .maybeSingle();
      if (adminProfile?.organization_id) {
        organizationId = adminProfile.organization_id;
        role = adminProfile.role;
      }
    } catch {
      // Ignored
    }
  }

  return {
    userId: user.id,
    user,
    organizationId,
    role,
  };
}