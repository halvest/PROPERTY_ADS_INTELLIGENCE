import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReviewQueue as getDemoReviewQueue } from "@/lib/data/dashboard-service";
import { persistAttributionEvent } from "@/lib/data/attribution-history-service";
import { recordRecommendationReview } from "@/lib/recommendations/persistent-review-service";
import type { ReviewQueueItem } from "@/lib/data/types";
import type { AttributionStatus } from "@/domain/attribution/types";

/**
 * GET /api/reviews
 * Retrieves the human review queue for the authenticated tenant.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    const isDemo = process.env.DATA_MODE === "demo";

    if ((authErr || !user) && !isDemo && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 1. Explicit demo fallback
    if (isDemo || !user) {
      const demoQueue = getDemoReviewQueue();
      return NextResponse.json({
        success: true,
        isDemo: true,
        data: demoQueue,
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId =
      profile?.organization_id || "00000000-0000-0000-0000-000000000001";

    // 2. Query conversations flagged for review (inferred attribution or low completeness)
    const { data: flaggedConvs, error: dbErr } = await supabase
      .from("conversations")
      .select(`
        id,
        attribution_status,
        last_message_at,
        contacts (id, name, phone_masked),
        lead_assessments (
          buyer_score,
          sales_score,
          score_completeness,
          status
        )
      `)
      .eq("organization_id", organizationId)
      .or("attribution_status.eq.inferred")
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (dbErr) {
      return NextResponse.json(
        { success: false, error: `Gagal memuat antrean tinjauan: ${dbErr.message}` },
        { status: 500 }
      );
    }

    const queueItems: ReviewQueueItem[] = (flaggedConvs || []).map((c) => {
      const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
      const assessment = Array.isArray(c.lead_assessments)
        ? c.lead_assessments[0]
        : c.lead_assessments;

      const buyerScore = assessment?.buyer_score ?? null;
      const buyerCompleteness = assessment?.score_completeness
        ? Number(assessment.score_completeness)
        : 0.85;

      return {
        leadId: c.id,
        leadName: contact?.name || "Calon Pembeli Properti",
        flagReason:
          c.attribution_status === "inferred"
            ? "Atribusi terinferensi (headline/promo) membutuhkan konfirmasi supervisor"
            : "Skor atau kelengkapan data memerlukan review manual",
        flagType:
          c.attribution_status === "inferred"
            ? "uncertain_attribution"
            : "low_completeness",
        buyerScore,
        buyerCompleteness,
        salesScore: assessment?.sales_score ?? null,
        attributionStatus: c.attribution_status as AttributionStatus,
        lastMessageAt: c.last_message_at,
      };
    });

    return NextResponse.json({
      success: true,
      isDemo: false,
      data: queueItems,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server";
    return NextResponse.json(
      { success: false, error: "Gagal memproses antrean review: " + errorMsg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews
 * Processes a supervisor review resolution with persistent audit logging.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = "attribution", leadId, previousStatus, newStatus, reason, recommendationId, status, note } = body;

    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId =
      profile?.organization_id || "00000000-0000-0000-0000-000000000001";

    // 1. Recommendation review submission
    if (type === "recommendation" || recommendationId) {
      const recResult = await recordRecommendationReview(
        {
          recommendationId,
          status,
          note,
        },
        {
          supabaseClient: supabase,
          callerContext: {
            userId: user.id,
            organizationId,
            fullName: user.email?.split("@")[0] || "Reviewer",
          },
        }
      );

      return NextResponse.json(recResult);
    }

    // 2. Attribution lead review correction
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Alasan koreksi atribusi wajib diisi secara eksplisit." },
        { status: 400 }
      );
    }

    const validStatuses: AttributionStatus[] = ["verified", "inferred", "unknown"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: "Status atribusi baru tidak valid." },
        { status: 400 }
      );
    }

    // Update conversation
    await supabase
      .from("conversations")
      .update({
        attribution_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("organization_id", organizationId);

    // Persist audit event
    await persistAttributionEvent({
      organizationId,
      conversationId: leadId,
      previousStatus: previousStatus || "inferred",
      newStatus,
      attributionMethod: "supervisor_review_queue",
      reason: reason.trim(),
      actorId: user.id,
      supabaseClient: supabase,
    });

    return NextResponse.json({
      success: true,
      message: "Koreksi tinjauan berhasil disimpan ke audit trail database.",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server";
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan review: " + errorMsg },
      { status: 500 }
    );
  }
}
