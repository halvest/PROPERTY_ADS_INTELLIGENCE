import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type WorkspaceRole = "owner" | "admin" | "sales" | "viewer";

export interface ActiveWorkspaceContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  memberId: string;
  role: WorkspaceRole;
}

const PLAN_DEFAULT_MAX_CONNECTIONS: Record<string, number> = {
  starter: 1,
  standard: 3,
  premium: 5,
};

export function getMaxConnectionsForPlan(plan: string, configuredMax?: number | null): number {
  if (typeof configuredMax === "number" && configuredMax > 0) {
    return configuredMax;
  }
  return PLAN_DEFAULT_MAX_CONNECTIONS[plan] ?? 1;
}

/**
 * Resolves the caller's active workspace via workspace_members.
 * - If requestedWorkspaceId is provided, strictly validates membership (returns null if unauthorized).
 * - If the user has no workspace yet and no explicit workspaceId was requested, creates a default Starter workspace.
 */
export async function resolveActiveWorkspace(
  user: { id: string; email?: string | null },
  requestedWorkspaceId?: string | null
): Promise<ActiveWorkspaceContext | null> {
  const admin = createAdminClient();

  if (requestedWorkspaceId) {
    const { data: membership, error } = await admin
      .from("workspace_members")
      .select("id, role, workspace:workspaces(id, name, slug)")
      .eq("workspace_id", requestedWorkspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !membership || !membership.workspace) {
      return null;
    }

    const ws = Array.isArray(membership.workspace)
      ? membership.workspace[0]
      : membership.workspace;
    if (!ws) return null;

    return {
      workspace: ws,
      memberId: membership.id,
      role: membership.role as WorkspaceRole,
    };
  }

  const { data: memberships, error: listErr } = await admin
    .from("workspace_members")
    .select("id, role, workspace:workspaces(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!listErr && memberships && memberships.length > 0) {
    const preferred =
      memberships.find((m) => m.role === "owner" || m.role === "admin") ?? memberships[0];
    const ws = Array.isArray(preferred.workspace)
      ? preferred.workspace[0]
      : preferred.workspace;
    if (ws) {
      return {
        workspace: ws,
        memberId: preferred.id,
        role: preferred.role as WorkspaceRole,
      };
    }
  }

  // First-time onboarding: provision a Starter workspace for the authenticated user
  const baseName = user.email ? `${user.email.split("@")[0]} Workspace` : "Haspro Workspace";
  const shortId = user.id.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "ws";
  const slug = `ws-${shortId}-${Date.now().toString(36)}`;

  const { data: createdWs, error: createErr } = await admin
    .from("workspaces")
    .insert({
      name: baseName,
      slug,
      owner_id: user.id,
    })
    .select("id, name, slug")
    .single();

  if (createErr || !createdWs) {
    throw new Error(
      `Failed to provision default workspace: ${createErr?.message || "Unknown error"}`
    );
  }

  // Ensure Starter subscription (1 connection limit) exists
  await admin.from("subscriptions").upsert(
    {
      workspace_id: createdWs.id,
      plan: "starter",
      max_whatsapp_connections: 1,
      status: "active",
    },
    { onConflict: "workspace_id" }
  );

  // Trigger trg_workspaces_add_owner_member registers owner membership automatically
  const { data: ownerMember } = await admin
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", createdWs.id)
    .eq("user_id", user.id)
    .single();

  return {
    workspace: createdWs,
    memberId: ownerMember?.id ?? "",
    role: (ownerMember?.role as WorkspaceRole) ?? "owner",
  };
}
