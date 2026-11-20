import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWorkspaceCpqlReport } from "@/lib/meta/cpql-sync";
import { resolveActiveWorkspaceSSR } from "@/lib/ctwa-leads/workspace-ssr";

export async function GET(req: NextRequest) {
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
    const { context, unauthorizedRequested } = await resolveActiveWorkspaceSSR(
      supabase,
      user.id,
      requestedWorkspaceId
    );

    if (unauthorizedRequested) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not a member of this workspace." },
        { status: 403 }
      );
    }

    if (!context) {
      return NextResponse.json({
        success: true,
        workspace: null,
        has_spend_data: false,
        currency: "IDR",
        total_spend: null,
        total_ctwa_leads: 0,
        qualified_leads: 0,
        qualification_rate: null,
        cpl: null,
        cpql: null,
        last_synced_at: null,
        breakdown: [],
      });
    }

    const workspaceId = context.workspace.id;

    const [leadsRes, attrsRes, snapshotsRes] = await Promise.all([
      supabase
        .from("leads")
        .select("conversation_id, lead_temperature, pipeline_stage")
        .eq("workspace_id", workspaceId),
      supabase
        .from("ctwa_attributions")
        .select(
          "conversation_id, source_id, headline, campaign_id, campaign_name, adset_id, adset_name, ad_name"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("ctwa_ad_spend_snapshots")
        .select(
          "ad_id, campaign_id, campaign_name, adset_id, adset_name, ad_name, spend, impressions, clicks, currency, synced_at"
        )
        .eq("workspace_id", workspaceId),
    ]);

    if (leadsRes.error) {
      throw new Error(`Failed to fetch leads for CPQL: ${leadsRes.error.message}`);
    }
    if (attrsRes.error) {
      throw new Error(`Failed to fetch attributions for CPQL: ${attrsRes.error.message}`);
    }
    if (snapshotsRes.error) {
      throw new Error(`Failed to fetch ad spend snapshots: ${snapshotsRes.error.message}`);
    }

    const report = buildWorkspaceCpqlReport({
      leads: leadsRes.data ?? [],
      attributions: attrsRes.data ?? [],
      snapshots: (snapshotsRes.data ?? []).map((s) => ({
        ...s,
        spend: Number(s.spend),
      })),
    });

    return NextResponse.json({
      success: true,
      workspace: context.workspace,
      ...report,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to compute CPQL report";
    console.error("[GET /api/ctwa-leads/cpql] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
