import { connection, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMaxConnectionsForPlan,
  resolveActiveWorkspace,
} from "@/lib/workspaces/active-workspace";

export type ConnectionHealthStatus =
  | "healthy"
  | "warning_inactive"
  | "disconnected"
  | "pending"
  | "error";

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function computeConnectionHealth(row: {
  connection_status: string;
  integration_mode: string;
  last_echo_at: string | null;
  connected_at: string | null;
}): { health_status: ConnectionHealthStatus; days_since_echo: number | null } {
  const nowMs = Date.now();
  const echoMs = row.last_echo_at ? Date.parse(row.last_echo_at) : NaN;
  const connectedMs = row.connected_at ? Date.parse(row.connected_at) : NaN;
  const daysSinceEcho = Number.isFinite(echoMs)
    ? Math.max(0, Math.floor((nowMs - echoMs) / (24 * 60 * 60 * 1000)))
    : null;

  if (row.connection_status === "disconnected") {
    return { health_status: "disconnected", days_since_echo: daysSinceEcho };
  }
  if (row.connection_status === "pending" || row.connection_status === "connecting") {
    return { health_status: "pending", days_since_echo: daysSinceEcho };
  }
  if (row.connection_status !== "connected") {
    return { health_status: "error", days_since_echo: daysSinceEcho };
  }

  if (row.integration_mode === "coexistence") {
    if (Number.isFinite(echoMs) && nowMs - echoMs > TEN_DAYS_MS) {
      return { health_status: "warning_inactive", days_since_echo: daysSinceEcho };
    }
    if (!row.last_echo_at && Number.isFinite(connectedMs) && nowMs - connectedMs > THREE_DAYS_MS) {
      return { health_status: "warning_inactive", days_since_echo: null };
    }
  }

  return { health_status: "healthy", days_since_echo: daysSinceEcho };
}

export async function GET(req: NextRequest) {
  await connection();

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const requestedWorkspaceId = req.nextUrl.searchParams.get("workspaceId");
    const activeCtx = await resolveActiveWorkspace(user, requestedWorkspaceId);

    if (!activeCtx) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not a member of this workspace." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const workspaceId = activeCtx.workspace.id;

    const [{ data: rows, error: connErr }, { data: sub }] = await Promise.all([
      admin
        .from("whatsapp_connections")
        .select(
          "id, workspace_id, sales_member_id, phone_number_id, waba_id, display_phone_number, verified_name, connection_status, integration_mode, last_echo_at, connected_at, disconnected_at, created_at, updated_at"
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      admin
        .from("subscriptions")
        .select("plan, max_whatsapp_connections, status, current_period_end")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);

    if (connErr) {
      throw new Error(`Failed to load WhatsApp connections: ${connErr.message}`);
    }

    const connections = (rows ?? []).map((row) => {
      const health = computeConnectionHealth(row);
      return {
        ...row,
        health_status: health.health_status,
        days_since_echo: health.days_since_echo,
      };
    });

    const plan = sub?.plan ?? "starter";
    const maxWhatsappConnections = getMaxConnectionsForPlan(plan, sub?.max_whatsapp_connections);
    const connectedCount = connections.filter((c) => c.connection_status === "connected").length;

    return NextResponse.json({
      success: true,
      workspace: activeCtx.workspace,
      userRole: activeCtx.role,
      quota: {
        connected_count: connectedCount,
        max_whatsapp_connections: maxWhatsappConnections,
        plan,
        subscription_status: sub?.status ?? "active",
      },
      connections,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load connections";
    console.error("[GET /api/whatsapp/connections] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
