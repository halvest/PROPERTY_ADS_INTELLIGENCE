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
    const category = url.searchParams.get("category");
    const projectId = url.searchParams.get("projectId");

    let query = supabase
      .from("studio_memories")
      .select("id, organization_id, user_id, project_id, category, key, value, confidence, source_message_id, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }
    if (projectId) {
      query = query.or(`project_id.eq.${projectId},project_id.is.null`);
    }

    const { data: memories, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, memories: memories || [] });
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

    const body = await req.json();
    const {
      category = "user_preference",
      key,
      value,
      projectId = null,
      confidence = 1.0,
      sourceMessageId = null,
    } = body;

    if (!key || typeof key !== "string" || !value || typeof value !== "string") {
      return NextResponse.json(
        { success: false, error: "Key and value are required strings" },
        { status: 400 }
      );
    }

    const { data: memory, error } = await supabase
      .from("studio_memories")
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        project_id: projectId,
        category,
        key: key.trim(),
        value: value.trim(),
        confidence: Number(confidence) || 1.0,
        source_message_id: sourceMessageId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, memory });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Memory ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("studio_memories")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

