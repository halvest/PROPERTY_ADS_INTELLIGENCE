import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface ActiveSsrWorkspace {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  memberId: string;
  role: string;
}

/**
 * Resolves the active workspace for the authenticated user using the SSR
 * Supabase client (with RLS enforced). Never uses createAdminClient().
 */
export async function resolveActiveWorkspaceSSR(
  supabase: SupabaseClient<Database>,
  userId: string,
  requestedWorkspaceId?: string | null
): Promise<{ context: ActiveSsrWorkspace | null; unauthorizedRequested: boolean }> {
  if (requestedWorkspaceId) {
    const { data: membership, error } = await supabase
      .from("workspace_members")
      .select("id, role, workspace:workspaces(id, name, slug)")
      .eq("workspace_id", requestedWorkspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !membership || !membership.workspace) {
      return { context: null, unauthorizedRequested: true };
    }

    const ws = Array.isArray(membership.workspace)
      ? membership.workspace[0]
      : membership.workspace;
    if (!ws) {
      return { context: null, unauthorizedRequested: true };
    }

    return {
      context: {
        workspace: ws,
        memberId: membership.id,
        role: membership.role,
      },
      unauthorizedRequested: false,
    };
  }

  const { data: memberships, error: listErr } = await supabase
    .from("workspace_members")
    .select("id, role, workspace:workspaces(id, name, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (listErr || !memberships || memberships.length === 0) {
    return { context: null, unauthorizedRequested: false };
  }

  const preferred =
    memberships.find((m) => m.role === "owner" || m.role === "admin") ?? memberships[0];
  const ws = Array.isArray(preferred.workspace)
    ? preferred.workspace[0]
    : preferred.workspace;

  if (!ws) {
    return { context: null, unauthorizedRequested: false };
  }

  return {
    context: {
      workspace: ws,
      memberId: preferred.id,
      role: preferred.role,
    },
    unauthorizedRequested: false,
  };
}
