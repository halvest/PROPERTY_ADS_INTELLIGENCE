import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ConnectionIdSchema = z.string().uuid();

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;
    const parsedId = ConnectionIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: "Invalid connection ID" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: conn, error: findErr } = await admin
      .from("whatsapp_connections")
      .select("id, workspace_id, connection_status")
      .eq("id", parsedId.data)
      .maybeSingle();

    if (findErr || !conn || !conn.workspace_id) {
      return NextResponse.json(
        { success: false, error: "WhatsApp connection not found" },
        { status: 404 }
      );
    }

    // Verify user is owner or admin of the connection's workspace
    const { data: membership, error: memberErr } = await admin
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", conn.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Hanya owner atau admin workspace yang dapat memutuskan koneksi.",
        },
        { status: 403 }
      );
    }

    const nowIso = new Date().toISOString();

    // Retain conversations, leads, and lead_ai_analyses; only mark disconnected and wipe token secret
    const [{ data: updatedConn, error: updateErr }, { error: deleteSecretErr }] = await Promise.all([
      admin
        .from("whatsapp_connections")
        .update({
          connection_status: "disconnected",
          disconnected_at: nowIso,
        })
        .eq("id", conn.id)
        .select(
          "id, workspace_id, sales_member_id, phone_number_id, waba_id, display_phone_number, verified_name, connection_status, integration_mode, last_echo_at, connected_at, disconnected_at, created_at, updated_at"
        )
        .single(),
      admin
        .from("whatsapp_connection_secrets")
        .delete()
        .eq("connection_id", conn.id),
    ]);

    if (updateErr) {
      throw new Error(`Failed to update connection status: ${updateErr.message}`);
    }
    if (deleteSecretErr) {
      throw new Error(`Failed to purge connection token secret: ${deleteSecretErr.message}`);
    }

    return NextResponse.json({
      success: true,
      connection: updatedConn,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to disconnect WhatsApp connection";
    console.error("[POST /api/whatsapp/connections/[id]/disconnect] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
