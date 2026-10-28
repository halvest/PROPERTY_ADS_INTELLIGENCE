import { NextResponse } from "next/server";
import {
  recordRecommendationReview,
  fetchPersistentReviews,
} from "@/lib/recommendations/persistent-review-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Format payload JSON tidak valid" },
        { status: 400 }
      );
    }

    const result = await recordRecommendationReview(body);

    if (!result.success) {
      let httpStatus = 400;
      if (result.code === "UNAUTHORIZED") httpStatus = 401;
      else if (result.code === "FORBIDDEN") httpStatus = 403;
      else if (result.code === "DATABASE_ERROR") httpStatus = 500;

      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: httpStatus }
      );
    }

    return NextResponse.json({ success: true, review: result.review });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server";
    return NextResponse.json(
      { success: false, error: "Gagal memproses review: " + errorMsg },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const client = await createClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = await client
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { success: false, error: "Organisasi tidak ditemukan", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const reviews = await fetchPersistentReviews(profile.organization_id, client);
    return NextResponse.json({ success: true, reviews });
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal mengambil catatan review" },
      { status: 500 }
    );
  }
}
