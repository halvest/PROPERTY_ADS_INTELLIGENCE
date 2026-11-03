import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLiveDashboardData } from "@/lib/data/live-dashboard-service";


/**
 * GET /api/dashboard/summary
 * Retrieves authentic, real-time persisted property advertising intelligence metrics.
 * Requires a tenant session and never falls back to fixture/demo data.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const { searchParams } = request.nextUrl;
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("organization_id, role")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };

    if (!profile?.organization_id) {
      return NextResponse.json({ success: false, error: "Organisasi tidak ditemukan untuk pengguna ini.", code: "FORBIDDEN" }, { status: 403 });
    }

    const organizationId = profile.organization_id;

    const dateRange = searchParams.get("dateRange") || "all";

    const dashboardData = await getLiveDashboardData({
      organizationId,
      supabaseClient: supabase,
      dateRange,
    });

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server internal";
    return NextResponse.json(
      { success: false, error: "Gagal memuat data dashboard: " + errorMsg },
      { status: 500 }
    );
  }
}
