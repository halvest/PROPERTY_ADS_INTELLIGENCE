import { NextResponse } from "next/server";
import { z } from "zod";
import { executeMarketingSync } from "@/lib/marketing/meta/sync-service";
import {
  getMetaMarketingConfig,
  isMetaMarketingConfigured,
  maskToken,
  maskAdAccountId,
} from "@/lib/marketing/meta/config";
import { MarketingApiError } from "@/lib/marketing/meta/types";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

const SyncRequestSchema = z.object({
  targetAdAccountId: z.string().optional(),
  timeRange: z
    .object({
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
      until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
    })
    .optional(),
  organizationId: z.string().uuid().optional(),
  allowDemoFallback: z.boolean().optional(),
});

/**
 * Trigger or execute read-only Meta Marketing API synchronization.
 * Enforces strict server-side session authentication, tenant isolation, and role authorization.
 */
export async function POST(request: Request) {
  try {
    const rl = checkRateLimit(rateLimitKey(request, "marketing-sync"), 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { status: "error", code: "RATE_LIMITED", message: "Terlalu banyak permintaan sinkronisasi." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
    let rawBody: unknown = {};
    try {
      rawBody = await request.json();
    } catch {
      // Empty body allowed, uses defaults
    }

    const parseResult = SyncRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          status: "error",
          code: "VALIDATION_ERROR",
          message: "Parameter permintaan tidak valid.",
          errors: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // 1. Authoritative Server-side Authentication & Tenant Resolution
    let authenticatedOrgId: string | null = null;
    let userRole: string | null = null;
    let supabaseClientInstance: Awaited<ReturnType<typeof createClient>> | null = null;
    const isProduction = process.env.NODE_ENV === "production";

    try {
      const supabase = await createClient();
      supabaseClientInstance = supabase;
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (user && !authError) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id, role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.organization_id) {
          authenticatedOrgId = profile.organization_id;
          userRole = profile.role;
        }
      }
    } catch {
      // In isolated mock test environments where cookieStore may not be present
    }

    // 2. Strict Production Guard & Authorization Policy
    if (isProduction && !authenticatedOrgId) {
      return NextResponse.json(
        {
          status: "error",
          code: "UNAUTHORIZED",
          message: "Sesi autentikasi diperlukan untuk menjalankan sinkronisasi iklan.",
        },
        { status: 401 }
      );
    }

    if (authenticatedOrgId) {
      // Check role authorization: only owner, admin, or supervisor can trigger sync
      const allowedRoles = ["owner", "admin", "supervisor"];
      if (!userRole || !allowedRoles.includes(userRole)) {
        return NextResponse.json(
          {
            status: "error",
            code: "FORBIDDEN",
            message: `Role pengguna '${userRole}' tidak memiliki wewenang untuk menjalankan sinkronisasi iklan.`,
          },
          { status: 403 }
        );
      }

      // Prevent cross-tenant forgery: if request body specified an organizationId, it MUST match authenticatedOrgId
      if (data.organizationId && data.organizationId !== authenticatedOrgId) {
        return NextResponse.json(
          {
            status: "error",
            code: "FORBIDDEN",
            message: "Akses lintas tenant ditolak. Anda tidak dapat menyinkronkan data milik organisasi lain.",
          },
          { status: 403 }
        );
      }
    }

    // In production, unauthenticated requests require explicit demo mode fallback
    if (isProduction && !authenticatedOrgId && data.allowDemoFallback === false) {
      return NextResponse.json(
        {
          status: "error",
          code: "UNAUTHORIZED",
          message: "Autentikasi diperlukan saat demo fallback dinonaktifkan.",
        },
        { status: 401 }
      );
    }

    // Resolve tenant ID: Authoritative session org takes strict precedence
    const organizationId =
      authenticatedOrgId ||
      data.organizationId ||
      "00000000-0000-0000-0000-000000000001"; // Controlled demo tenant in dev/test only

    const result = await executeMarketingSync({
      organizationId,
      targetAdAccountId: data.targetAdAccountId,
      timeRange: data.timeRange,
      supabaseClient: supabaseClientInstance || undefined,
      allowDemoFallback: data.allowDemoFallback !== undefined ? data.allowDemoFallback : !isProduction,
    });

    const config = getMetaMarketingConfig({ requireConfigured: false });

    return NextResponse.json({
      status: "success",
      syncResult: result,
      provider: "meta_marketing",
      mode: result.mode,
      adAccountId: maskAdAccountId(config.adAccountId),
      maskedToken: maskToken(config.accessToken),
      apiVersion: config.apiVersion,
    });
  } catch (error) {
    if (error instanceof MarketingApiError) {
      return NextResponse.json(
        {
          status: "error",
          code: error.code,
          message: error.message,
          metaErrorCode: error.metaErrorCode,
          isRecoverable: error.isRecoverable,
        },
        { status: error.statusCode ?? (error.code === "AUTHENTICATION_ERROR" ? 401 : 500) }
      );
    }

    const errorMsg = error instanceof Error ? error.message : "Terjadi kesalahan internal sinkronisasi";
    return NextResponse.json(
      {
        status: "error",
        code: "INTERNAL_ERROR",
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}

/**
 * Diagnostic and health-check route for Meta Marketing API status.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { status: "error", code: "UNAUTHORIZED", message: "Sesi tidak terautentikasi" },
      { status: 401 }
    );
  }
  const isConfigured = isMetaMarketingConfigured();
  const config = getMetaMarketingConfig({ requireConfigured: false });

  return NextResponse.json({
    status: "ok",
    provider: "meta_marketing",
    configured: isConfigured,
    apiVersion: config.apiVersion,
    requiredPermissions: ["ads_read", "read_insights"],
    mode: isConfigured ? "live" : "demo",
  });
}
