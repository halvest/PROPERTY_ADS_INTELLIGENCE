import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // 1. Fetch conversation container
    const { data: conversation, error: convoError } = await supabase
      .from("studio_conversations")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (convoError || !conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    // 2. Fetch all messages with linked generation metadata
    const { data: rawMessages, error: msgError } = await supabase
      .from("studio_messages")
      .select(`
        id,
        conversation_id,
        organization_id,
        user_id,
        role,
        content,
        attachments,
        generation_id,
        created_at,
        generation:creative_generations(
          id,
          conversation_id,
          parent_generation_id,
          project_id,
          aspect_ratio,
          style_preset,
          width,
          height,
          raw_image_url,
          final_composed_url,
          prompt_used,
          revision_instruction,
          model_used,
          provider,
          status,
          error_message,
          created_at
        )
      `)
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgError) {
      return NextResponse.json({ success: false, error: msgError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      conversation,
      messages: rawMessages || [],
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const updates: {
      title?: string;
      is_pinned?: boolean;
      project_id?: string | null;
      metadata?: import("@/types/database.types").Json;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === "string" && body.title.trim().length > 0) {
      updates.title = body.title.trim().slice(0, 120);
    }
    if (typeof body.isPinned === "boolean") {
      updates.is_pinned = body.isPinned;
    }
    if ("projectId" in body) {
      updates.project_id = body.projectId ? String(body.projectId).trim() : null;
    }
    if (body.metadata && typeof body.metadata === "object") {
      updates.metadata = body.metadata;
    }

    const { data: updated, error } = await supabase
      .from("studio_conversations")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, conversation: updated });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { error } = await supabase
      .from("studio_conversations")
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
