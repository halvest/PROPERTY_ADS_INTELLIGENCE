import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdsIntelligenceData } from "@/lib/ads/service";

/**
 * GET /api/ads
 * Comprehensive Ads Intelligence backend route.
 * Strictly isolates tenant session and delegates query execution to @/lib/ads/service.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authoritative User Authentication & Tenant Resolution
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    let organizationId: string | null = null;

    if (user && !authError) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.organization_id) {
        organizationId = profile.organization_id;
      }
    }

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi atau organisasi tidak ditemukan", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Query parameters (defaults to 30d for active operational view)
    const { searchParams } = request.nextUrl;
    const dateRange = searchParams.get("dateRange") || "30d";
    const selectedCampaignId = searchParams.get("campaignId");
    const campaignStatusFilter = searchParams.get("campaignStatus");
    const deliveryStatusFilter = searchParams.get("deliveryStatus");
    const objectiveFilter = searchParams.get("objective");

    const data = await getAdsIntelligenceData({
      organizationId,
      dateRange,
      selectedCampaignId,
      campaignStatusFilter,
      deliveryStatusFilter,
      objectiveFilter,
      adAccountId: searchParams.get("adAccountId"),
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Kesalahan server internal";
    if (errorMsg.startsWith("FORBIDDEN_AD_ACCOUNT")) {
      return NextResponse.json(
        { success: false, error: "Akun iklan tidak termasuk milik organisasi ini.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: `Gagal memuat data Ads Intelligence: ${errorMsg}` },
      { status: 500 }
    );
  }
}
