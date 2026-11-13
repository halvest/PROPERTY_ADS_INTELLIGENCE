import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdsSpyingService } from "@/lib/ads-spying/service";
import type { LongevityPhase, FunnelType, MediaFormat } from "@/lib/ads-spying/types";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
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

    const organizationId = profile?.organization_id || undefined;
    const userId = user.id;

    const searchParams = req.nextUrl.searchParams;

    const keyword = searchParams.get("keyword") || undefined;
    const longevity_phase = (searchParams.get("longevity_phase") as LongevityPhase | "ALL") || "ALL";
    const funnel_type = (searchParams.get("funnel_type") as FunnelType | "ALL") || "ALL";
    const media_format = (searchParams.get("media_format") as MediaFormat | "ALL") || "ALL";
    const is_scaling_only = searchParams.get("is_scaling_only") === "true";
    const sort_by = (searchParams.get("sort_by") as "longevity" | "scaling" | "recency") || "longevity";
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await AdsSpyingService.getCompetitorAds(
      {
        keyword,
        longevity_phase,
        funnel_type,
        media_format,
        is_scaling_only,
        sort_by,
        limit,
        offset,
        user_id: userId,
        organization_id: organizationId,
      },
      {
        userId,
        organizationId,
      }
    );

    return NextResponse.json({
      success: true,
      ads: result.ads,
      total: result.total,
      pulse: result.pulse,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[API /api/ads-spying/ads] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
