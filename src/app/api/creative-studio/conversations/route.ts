import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profile?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "Active organization profile required" }, { status: 400 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim();
    const projectId = url.searchParams.get("projectId")?.trim();
    const limit = Math.min(Number(url.searchParams.get("limit") || 40), 100);

    let query = supabase
      .from("studio_conversations")
      .select("id, organization_id, user_id, project_id, title, is_pinned, metadata, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    const { data: conversations, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, conversations: conversations || [] });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profile?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "Active organization profile required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 120)
      : "Percakapan Kreatif Baru";
    const projectId = typeof body.projectId === "string" && body.projectId.trim().length > 0
      ? body.projectId.trim()
      : null;

    const { data: conversation, error } = await supabase
      .from("studio_conversations")
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        project_id: projectId,
        title,
        is_pinned: Boolean(body.isPinned),
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, conversation });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

