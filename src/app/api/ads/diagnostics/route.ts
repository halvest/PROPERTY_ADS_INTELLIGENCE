import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAdsDataReconciliation } from "@/lib/ads/diagnostics";
import { DEV_ORGANIZATION_ID, isProduction } from "@/lib/auth/tenant";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("dateRange") || "all";

    // 1. Authoritative Session Authentication & Tenant Resolution
    let organizationId: string | null = null;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (isProduction() && (authError || !user)) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (user && !authError) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.organization_id) {
        organizationId = profile.organization_id;
      }
    }

    if (!organizationId) {
      if (isProduction()) {
        return NextResponse.json(
          { success: false, error: "Organisasi tidak ditemukan", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
      // Development-only fallback; never reachable in production.
      organizationId = DEV_ORGANIZATION_ID;
    }

    const report = await runAdsDataReconciliation({
      organizationId,
      dateRange,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menjalankan rekonsiliasi data iklan.";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
