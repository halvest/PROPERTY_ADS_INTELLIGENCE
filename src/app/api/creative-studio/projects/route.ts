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
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profile?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Active organization profile required" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

    // Fetch generations with linked project info
    const { data: generations, error: genError } = await supabase
      .from("creative_generations")
      .select(`
        id,
        project_id,
        aspect_ratio,
        style_preset,
        width,
        height,
        raw_image_url,
        final_composed_url,
        creative_direction,
        prompt_used,
        quality_score,
        status,
        created_at,
        project:creative_projects(
          id,
          project_name,
          campaign_name,
          headline,
          subheadline,
          property_type,
          property_location,
          starting_price,
          promo_headline,
          cta_text
        )
      `)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (genError) {
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({
      success: true,
      data: generations || [],
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Error retrieving creative history";
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
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profile?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Active organization profile required" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const generationId = url.searchParams.get("id");

    if (!generationId) {
      return NextResponse.json(
        { success: false, error: "Generation ID is required" },
        { status: 400 }
      );
    }

    const { error: delError } = await supabase
      .from("creative_generations")
      .delete()
      .eq("id", generationId)
      .eq("organization_id", organizationId);

    if (delError) {
      return NextResponse.json(
        { success: false, error: delError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Creative deleted successfully",
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Error deleting creative generation";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

