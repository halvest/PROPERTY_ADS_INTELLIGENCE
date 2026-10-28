import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

/**
 * Strict runtime schema for recommendation review submissions.
 * Notice: reviewedBy, organizationId, and timestamp are strictly OMITTED from the client schema.
 * They are resolved authoritatively on the server from the authenticated session.
 */
export const RecommendationReviewInputSchema = z.object({
  recommendationId: z
    .string()
    .trim()
    .min(1, "ID rekomendasi tidak boleh kosong")
    .max(128, "ID rekomendasi melebihi batas panjang karakter"),
  status: z.enum(["reviewed", "dismissed"], {
    message: "Status hanya boleh 'reviewed' atau 'dismissed'",
  }),
  note: z
    .string()
    .trim()
    .max(500, "Catatan review maksimal 500 karakter")
    .optional(),
});

export type RecommendationReviewInput = z.infer<typeof RecommendationReviewInputSchema>;

export interface PersistentReviewRecord {
  id: string;
  organizationId: string;
  recommendationId: string;
  status: "reviewed" | "dismissed";
  reviewedBy: string;
  reviewerName: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewServiceResult {
  success: boolean;
  review?: PersistentReviewRecord;
  error?: string;
  code?: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "DATABASE_ERROR";
}

/**
 * Persists a recommendation review to Supabase PostgreSQL table ad_recommendation_reviews.
 * Enforces strict tenant isolation, identity validation, and atomic upsert idempotency.
 */
export async function recordRecommendationReview(
  input: unknown,
  options?: {
    supabaseClient?: SupabaseClient<Database>;
    /** For controlled test injection only; in production resolved from auth session */
    callerContext?: {
      userId: string;
      organizationId: string;
      fullName?: string;
      role?: string;
    };
  }
): Promise<ReviewServiceResult> {
  // 1. Strict Runtime Validation of Input Payload
  const parseResult = RecommendationReviewInputSchema.safeParse(input);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: `Validasi gagal: ${errorMsg}`,
    };
  }

  const { recommendationId, status, note } = parseResult.data;

  // 2. Resolve Authenticated Server Session & Identity
  let client: SupabaseClient<Database>;
  let userId: string;
  let organizationId: string;
  let reviewerName: string | null = null;

  try {
    if (options?.callerContext) {
      // Injected caller context for testing
      client = options.supabaseClient || (await createServerClient());
      userId = options.callerContext.userId;
      organizationId = options.callerContext.organizationId;
      reviewerName = options.callerContext.fullName || null;
    } else {
      client = options?.supabaseClient || (await createServerClient());
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();

      if (authError || !user) {
        return {
          success: false,
          code: "UNAUTHORIZED",
          error: "Autentikasi ditolak: Sesi pengguna tidak ditemukan atau telah kedaluwarsa.",
        };
      }

      userId = user.id;

      // Authoritative tenant resolution from user profile
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("organization_id, full_name, role")
        .eq("id", userId)
        .single();

      if (profileError || !profile || !profile.organization_id) {
        return {
          success: false,
          code: "FORBIDDEN",
          error: "Otorisasi ditolak: Pengguna tidak terdaftar dalam organisasi manapun.",
        };
      }

      organizationId = profile.organization_id;
      reviewerName = profile.full_name || null;
    }

    // 3. Atomic Database Upsert with Idempotency Guarantees
    const now = new Date().toISOString();
    const { data: inserted, error: dbError } = await client
      .from("ad_recommendation_reviews")
      .upsert(
        {
          organization_id: organizationId,
          recommendation_id: recommendationId,
          status,
          reviewed_by: userId,
          reviewer_name: reviewerName,
          review_note: note || null,
          updated_at: now,
        },
        { onConflict: "organization_id,recommendation_id" }
      )
      .select()
      .single();

    if (dbError) {
      console.error("[Persistent Review Service] DB Upsert error:", dbError.message);
      return {
        success: false,
        code: "DATABASE_ERROR",
        error: "Gagal menyimpan catatan audit review ke basis data PostgreSQL.",
      };
    }

    return {
      success: true,
      review: {
        id: inserted.id,
        organizationId: inserted.organization_id,
        recommendationId: inserted.recommendation_id,
        status: inserted.status as "reviewed" | "dismissed",
        reviewedBy: inserted.reviewed_by,
        reviewerName: inserted.reviewer_name,
        reviewNote: inserted.review_note,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server tidak diketahui";
    console.error("[Persistent Review Service] Uncaught exception:", errorMsg);
    return {
      success: false,
      code: "DATABASE_ERROR",
      error: "Terjadi kesalahan internal saat memproses persistensi audit review.",
    };
  }
}

/**
 * Retrieves all persistent recommendation reviews for a given tenant organization.
 */
export async function fetchPersistentReviews(
  organizationId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<Record<string, PersistentReviewRecord>> {
  if (!organizationId || organizationId.trim().length === 0) {
    return {};
  }

  try {
    const client = supabaseClient || (await createServerClient());
    const { data, error } = await client
      .from("ad_recommendation_reviews")
      .select("*")
      .eq("organization_id", organizationId.trim());

    if (error || !data) {
      console.warn("[Persistent Review Service] Fetch reviews warning:", error?.message);
      return {};
    }

    const reviewMap: Record<string, PersistentReviewRecord> = {};
    for (const row of data) {
      reviewMap[row.recommendation_id] = {
        id: row.id,
        organizationId: row.organization_id,
        recommendationId: row.recommendation_id,
        status: row.status as "reviewed" | "dismissed",
        reviewedBy: row.reviewed_by,
        reviewerName: row.reviewer_name,
        reviewNote: row.review_note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }

    return reviewMap;
  } catch (err) {
    console.warn("[Persistent Review Service] Failed to fetch reviews:", err);
    return {};
  }
}
