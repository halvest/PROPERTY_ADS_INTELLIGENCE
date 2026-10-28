import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOAuthCsrfState } from "@/lib/whatsapp/crypto";


/**
 * GET /api/auth/meta/authorize
 * Server-side Meta OAuth initiation endpoint.
 *
 * Requirements:
 * 1. Checks user authentication and organization tenant association.
 * 2. Issues a signed, tamper-resistant anti-CSRF state token bound to (orgId, userId).
 * 3. Enforces read-only scopes (ads_read, pages_read_engagement, pages_show_list, business_management).
 * 4. Never exposes Meta App Secret to browser.
 * 5. Safely redirects user to Meta's official OAuth authorization dialog.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnUrl", "/settings");
      return NextResponse.redirect(loginUrl);
    }

    // Resolve tenant organization from user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      const settingsUrl = new URL("/settings", request.url);
      settingsUrl.searchParams.set("error", "missing_organization");
      return NextResponse.redirect(settingsUrl);
    }

    // Role check: Only owner or admin can initiate integration authorization
    const allowedRoles = ["owner", "admin"];
    if (!profile.role || !allowedRoles.includes(profile.role)) {
      const settingsUrl = new URL("/settings", request.url);
      settingsUrl.searchParams.set("error", "insufficient_permissions");
      return NextResponse.redirect(settingsUrl);
    }

    const appId = process.env.META_APP_ID?.trim();
    if (!appId) {
      const settingsUrl = new URL("/settings", request.url);
      settingsUrl.searchParams.set("error", "meta_app_not_configured");
      return NextResponse.redirect(settingsUrl);
    }

    const apiVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";

    // Determine authoritative redirect URI
    let redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim();
    if (!redirectUri) {
      const appBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        request.nextUrl.origin;
      redirectUri = `${appBaseUrl.replace(/\/+$/, "")}/api/auth/meta/callback`;
    }

    // Generate signed anti-CSRF state token
    const stateToken = generateOAuthCsrfState({
      organizationId: profile.organization_id,
      userId: user.id,
    });

    // Required read-only marketing and asset inspection permissions
    const requiredScopes = [
      "ads_read",
      "pages_read_engagement",
      "pages_show_list",
      "business_management",
    ].join(",");

    const metaDialogUrl = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
    metaDialogUrl.searchParams.set("client_id", appId);
    metaDialogUrl.searchParams.set("redirect_uri", redirectUri);
    metaDialogUrl.searchParams.set("state", stateToken);
    metaDialogUrl.searchParams.set("scope", requiredScopes);
    metaDialogUrl.searchParams.set("response_type", "code");

    return NextResponse.redirect(metaDialogUrl.toString());
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    const settingsUrl = new URL("/settings", request.url);
    settingsUrl.searchParams.set("error", "oauth_initiation_failed");
    settingsUrl.searchParams.set("details", encodeURIComponent(errorMsg));
    return NextResponse.redirect(settingsUrl);
  }
}
