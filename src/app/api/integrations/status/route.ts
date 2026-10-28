import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getTenantIntegrationStatuses,
  type IntegrationStatusItem,
} from "@/lib/integrations/status-service";

export type { IntegrationStatusItem };

/**
 * GET /api/integrations/status
 * Retrieves real, authenticated integration connection statuses for the tenant organization.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && (authError || !user)) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Tenant is resolved only from the authenticated profile; a client-supplied
    // organizationId must never select another tenant's integration status.
    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("organization_id, role")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };

    const orgId = profile?.organization_id || null;
    if (!orgId && isProduction) {
      return NextResponse.json(
        { success: false, error: "Organisasi tidak ditemukan", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { integrations, organizationId } = await getTenantIntegrationStatuses({
      organizationId: orgId,
      client: supabase,
    });

    return NextResponse.json({
      success: true,
      integrations,
      organizationId,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Gagal mengambil status integrasi";
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
