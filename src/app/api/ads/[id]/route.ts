import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdDetailById, type AdDetailResponseData } from "@/lib/ads/service";

export type { AdDetailResponseData };

/**
 * GET /api/ads/[id]
 * Retrieves authentic, tenant-isolated ad details, delivery reconciliation, and Meta relevance diagnostics.
 * ID can be internal database UUID or Meta provider_ad_id.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || id.trim() === "") {
      return NextResponse.json(
        { success: false, error: "ID Iklan wajib disertakan", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const isProduction = process.env.NODE_ENV === "production";

    // 1. Resolve Tenant / Session
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    let organizationId: string | null = null;
    if (user && !authErr) {
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
      if (isProduction) {
        return NextResponse.json(
          { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
      organizationId = "d2a99e97-b4cd-4e9f-b084-e36214277225";
    }

    // 2. Delegate to server service (strict tenant filtering & bypasses unauthenticated client RLS in dev)
    const result = await getAdDetailById(organizationId, id);

    if (!result.success) {
      const statusCode = result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 500;
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Kesalahan server internal";
    return NextResponse.json(
      { success: false, error: `Gagal memuat detail iklan: ${errorMsg}`, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
