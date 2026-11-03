import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listCrmLeadSources } from "@/lib/crm/crm-sheets-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) {
      return NextResponse.json({ success: false, error: "Organisasi tidak ditemukan untuk pengguna ini.", code: "FORBIDDEN" }, { status: 403 });
    }

    const sources = await listCrmLeadSources(supabase, profile.organization_id);
    return NextResponse.json({ success: true, data: sources });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat referensi sumber CRM.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
