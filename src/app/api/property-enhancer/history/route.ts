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
        { success: false, error: "Autentikasi diperlukan" },
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
        { success: false, error: "Profil organisasi tidak ditemukan" },
        { status: 400 }
      );
    }

    const { data: history, error: historyError } = await supabase
      .from("property_image_enhancements")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (historyError) {
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({
      success: true,
      data: history || [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memuat riwayat enhancement";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

