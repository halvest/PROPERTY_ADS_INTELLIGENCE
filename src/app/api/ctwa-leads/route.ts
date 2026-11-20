import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listCtwaLeads } from "@/lib/ctwa-leads/service";
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

    const searchParams = req.nextUrl.searchParams;
    const requestedWorkspaceId = searchParams.get("workspaceId");
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
        summary: {
          total_leads: 0,
          qualified_leads: 0,
          needs_review_count: 0,
          avg_frt_seconds: null,
        },
        leads: [],
        connections: [],
      });
    }

    const result = await listCtwaLeads(supabase, context.workspace.id, {
      temperature: searchParams.get("temperature"),
      stage: searchParams.get("stage"),
      needsReview: searchParams.get("needsReview") === "true",
      connectionId: searchParams.get("connectionId"),
      search: searchParams.get("search"),
    });

    return NextResponse.json({
      success: true,
      workspace: context.workspace,
      userRole: context.role,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load CTWA leads";
    console.error("[GET /api/ctwa-leads] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
