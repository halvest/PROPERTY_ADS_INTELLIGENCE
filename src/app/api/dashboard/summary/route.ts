import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLiveDashboardData } from "@/lib/data/live-dashboard-service";


/**
 * GET /api/dashboard/summary
 * Retrieves authentic, real-time persisted property advertising intelligence metrics.
 * Supports explicit demo query (?demo=true) for evaluated demonstration contexts.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const { searchParams } = request.nextUrl;
    // Demo mode is server-configured only (DATA_MODE=demo); client
    // query params and cookies must never switch a production tenant to demo data.
    const forceDemo = process.env.DATA_MODE === "demo";
    const isProduction = process.env.NODE_ENV === "production";

    if ((authError || !user) && !forceDemo && isProduction) {
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

    const organizationId =
      profile?.organization_id || "00000000-0000-0000-0000-000000000001";

    const dateRange = searchParams.get("dateRange") || "all";

    const dashboardData = await getLiveDashboardData({
      organizationId,
      supabaseClient: supabase,
      dateRange,
      forceDemoMode: forceDemo,
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
