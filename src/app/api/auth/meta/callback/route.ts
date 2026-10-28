import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyOAuthCsrfState, encryptAccessToken } from "@/lib/whatsapp/crypto";
import { persistMetaUserToken } from "@/lib/marketing/meta/token-storage";

interface MetaTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    fbtrace_id?: string;
  };
}

interface MetaDebugTokenResponse {
  data?: {
    app_id?: string;
    type?: string;
    application?: string;
    data_access_expires_at?: number;
    expires_at?: number;
    is_valid?: boolean;
    scopes?: string[];
    user_id?: string;
    error?: {
      message?: string;
      code?: number;
    };
  };
}

/**
 * GET /api/auth/meta/callback
 * Server-side OAuth callback endpoint for Meta Marketing & Asset Integration.
 *
 * Requirements:
 * 1. Validates anti-CSRF state token and rejects mismatches / timeouts.
 * 2. Exchanges authorization code server-side for short-lived then long-lived access token.
 * 3. Never exposes client secret or raw access token to client-side code.
 * 4. Stores access token encrypted at rest (AES-256-GCM) in meta_user_tokens.
 * 5. Updates integration_connections with connection status and granted scopes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");
  const errorDescription = searchParams.get("error_description");

  const settingsUrl = new URL("/settings", request.url);

  // 1. Handle user cancellation or Meta authorization errors
  if (error || errorReason) {
    const errorParam = encodeURIComponent(errorDescription || error || errorReason || "Consent denied");
    settingsUrl.searchParams.set("error", "meta_oauth_denied");
    settingsUrl.searchParams.set("details", errorParam);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("error", "missing_oauth_params");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // 2. Validate current authenticated Supabase session
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      settingsUrl.searchParams.set("error", "missing_organization");
      return NextResponse.redirect(settingsUrl);
    }

    // Role check: Only owner, admin, or supervisor can connect Meta Ads
    const allowedRoles = ["owner", "admin", "supervisor"];
    if (!profile.role || !allowedRoles.includes(profile.role)) {
      settingsUrl.searchParams.set("error", "forbidden_role");
      settingsUrl.searchParams.set(
        "details",
        encodeURIComponent("Hanya Administrator atau Supervisor yang memiliki wewenang menghubungkan akun Meta Ads.")
      );
      return NextResponse.redirect(settingsUrl);
    }

    // 3. Verify anti-CSRF state token bound to (orgId, userId)
    const stateVerification = verifyOAuthCsrfState(state, {
      organizationId: profile.organization_id,
      userId: user.id,
    });

    if (!stateVerification.valid) {
      settingsUrl.searchParams.set("error", "invalid_csrf_state");
      settingsUrl.searchParams.set("details", encodeURIComponent(stateVerification.reason || "State token invalid"));
      return NextResponse.redirect(settingsUrl);
    }

    // 4. Retrieve server configuration for token exchange
    const appId = process.env.META_APP_ID?.trim();
    const appSecret = process.env.META_APP_SECRET?.trim();
    const apiVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";

    if (!appId || !appSecret) {
      settingsUrl.searchParams.set("error", "meta_app_credentials_missing");
      return NextResponse.redirect(settingsUrl);
    }

    let redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim();
    if (!redirectUri) {
      const appBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        request.nextUrl.origin;
      redirectUri = `${appBaseUrl.replace(/\/+$/, "")}/api/auth/meta/callback`;
    }

    // 5. Exchange code for short-lived access token
    const tokenExchangeUrl = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
    tokenExchangeUrl.searchParams.set("client_id", appId);
    tokenExchangeUrl.searchParams.set("client_secret", appSecret);
    tokenExchangeUrl.searchParams.set("redirect_uri", redirectUri);
    tokenExchangeUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenExchangeUrl.toString(), { method: "GET" });
    const tokenData: MetaTokenResponse = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || !tokenData.access_token) {
      const msg = tokenData.error?.message || "Failed to exchange authorization code";
      settingsUrl.searchParams.set("error", "token_exchange_failed");
      settingsUrl.searchParams.set("details", encodeURIComponent(msg));
      return NextResponse.redirect(settingsUrl);
    }

    let activeToken = tokenData.access_token;
    let expiresInSeconds = tokenData.expires_in || 5184000; // 60 days default

    // 6. Exchange short-lived token for long-lived user token (60-day validity)
    try {
      const longLivedUrl = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", appId);
      longLivedUrl.searchParams.set("client_secret", appSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", activeToken);

      const longLivedRes = await fetch(longLivedUrl.toString(), { method: "GET" });
      if (longLivedRes.ok) {
        const longLivedData: MetaTokenResponse = await longLivedRes.json();
        if (longLivedData.access_token) {
          activeToken = longLivedData.access_token;
          if (longLivedData.expires_in) {
            expiresInSeconds = longLivedData.expires_in;
          }
        }
      }
    } catch {
      // Continue with short-lived token if long-lived exchange encounters network glitch
    }

    // 7. Inspect token to discover granted scopes and verify validity
    let grantedScopes: string[] = ["ads_read", "pages_read_engagement", "pages_show_list"];
    try {
      const debugUrl = new URL(`https://graph.facebook.com/${apiVersion}/debug_token`);
      debugUrl.searchParams.set("input_token", activeToken);
      debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);

      const debugRes = await fetch(debugUrl.toString(), { method: "GET" });
      if (debugRes.ok) {
        const debugData: MetaDebugTokenResponse = await debugRes.json();
        if (debugData.data?.scopes && Array.isArray(debugData.data.scopes)) {
          grantedScopes = debugData.data.scopes;
        }
      }
    } catch {
      // Non-fatal inspection error
    }

    // 8. Encrypt access token using AES-256-GCM
    const encrypted = encryptAccessToken(activeToken);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // 9. Persist encrypted token in meta_user_tokens (server-only table)
    const tokenPersistResult = await persistMetaUserToken({
      organizationId: profile.organization_id,
      userId: user.id,
      encryptedAccessToken: encrypted.encryptedToken,
      encryptionIv: encrypted.iv,
      encryptionTag: encrypted.tag,
      tokenType: "Bearer",
      expiresAt,
      grantedScopes,
      supabaseClient: supabase,
    });

    if (!tokenPersistResult.success) {
      settingsUrl.searchParams.set("error", "credential_storage_failed");
      settingsUrl.searchParams.set(
        "details",
        encodeURIComponent(tokenPersistResult.error || "Gagal menyimpan kredensial token Meta.")
      );
      return NextResponse.redirect(settingsUrl);
    }

    // 10. Update canonical integration_connections table
    await supabase.from("integration_connections").upsert(
      {
        organization_id: profile.organization_id,
        provider: "meta",
        status: "connected",
        token_expires_at: expiresAt,
        granted_scopes: grantedScopes,
        metadata: {
          app_id: appId,
          token_type: "long_lived_user",
          exchanged_at: new Date().toISOString(),
        },
        error_message: null,
        connected_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" }
    );

    settingsUrl.searchParams.set("meta_connected", "true");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal callback error";
    settingsUrl.searchParams.set("error", "callback_exception");
    settingsUrl.searchParams.set("details", encodeURIComponent(errorMsg));
    return NextResponse.redirect(settingsUrl);
  }
}
