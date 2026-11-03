import { NextRequest, NextResponse } from "next/server";
import { generateCrmLeadsTemplate } from "@/lib/crm/crm-sheets-service";
import { createClient } from "@/lib/supabase/server";
import { listCrmLeadSources } from "@/lib/crm/crm-sheets-service";

/**
 * GET /api/leads/template
 * Generates and downloads the official HD Creative CRM leads spreadsheet template.
 * Supported query params:
 * - format: 'xlsx' (default) | 'csv'
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
    if (!profile?.organization_id) {
      return NextResponse.json({ success: false, error: "Organisasi tidak ditemukan untuk pengguna ini.", code: "FORBIDDEN" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";
    const sourceCatalog = format === "xlsx" ? await listCrmLeadSources(supabase, profile.organization_id) : { ads: [] };
    const buffer = generateCrmLeadsTemplate(format, sourceCatalog.ads);

    if (format === "csv") {
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="template_crm_leads_hdcreative.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="template_crm_leads_hdcreative.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Gagal mengunduh template spreadsheet.";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
