import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCtwaLeadDetail, updateCtwaLeadOverride } from "@/lib/ctwa-leads/service";
import { PatchCtwaLeadBodySchema } from "@/lib/ctwa-leads/types";
import { resolveActiveWorkspaceSSR } from "@/lib/ctwa-leads/workspace-ssr";

const UuidSchema = z.string().uuid();

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!UuidSchema.safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: "Invalid lead ID format" },
        { status: 400 }
      );
    }

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
    const { context: wsCtx, unauthorizedRequested } = await resolveActiveWorkspaceSSR(
      supabase,
      user.id,
      requestedWorkspaceId
    );

    if (unauthorizedRequested || !wsCtx) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Workspace membership required." },
        { status: 403 }
      );
    }

    const detail = await getCtwaLeadDetail(supabase, wsCtx.workspace.id, id);
    if (!detail) {
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      workspace: wsCtx.workspace,
      ...detail,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load lead detail";
    console.error("[GET /api/ctwa-leads/[id]] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!UuidSchema.safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: "Invalid lead ID format" },
        { status: 400 }
      );
    }

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
    const { context: wsCtx, unauthorizedRequested } = await resolveActiveWorkspaceSSR(
      supabase,
      user.id,
      requestedWorkspaceId
    );

    if (unauthorizedRequested || !wsCtx) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Workspace membership required." },
        { status: 403 }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsedBody = PatchCtwaLeadBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await updateCtwaLeadOverride(
      supabase,
      wsCtx.workspace.id,
      user.id,
      id,
      parsedBody.data
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update lead";
    console.error("[PATCH /api/ctwa-leads/[id]] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
