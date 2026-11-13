import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdsSpyingService } from "@/lib/ads-spying/service";

export const maxDuration = 60;

export async function POST(req: Request) {
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

    const body = await req.json();
    const adArchiveId = body.adArchiveId;

    if (!adArchiveId || typeof adArchiveId !== "string") {
      return NextResponse.json(
        { success: false, error: "adArchiveId is required" },
        { status: 400 }
      );
    }

    const analysis = await AdsSpyingService.analyzeCompetitorAd(adArchiveId, {
      userId,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[API /api/ads-spying/analyze] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
