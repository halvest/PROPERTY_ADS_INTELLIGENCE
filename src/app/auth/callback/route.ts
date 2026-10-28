import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ensureUserOrganizationAndProfile } from "@/lib/auth/provisioning";
import { safeInternalRedirect } from "@/lib/security/redirect";

/**
 * GET /auth/callback
 * Handles server-side OAuth code exchange for Supabase authentication (e.g. Google OAuth).
 * Exchanges the authorization code for a session and idempotently provisions the user workspace.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTarget = safeInternalRedirect(requestUrl.searchParams.get("redirect"));
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Handle OAuth cancellation or provider-level errors
  if (error || errorDescription) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", errorDescription || error || "oauth_failed");
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error("[Auth Callback] Code exchange error:", exchangeError.message);
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", exchangeError.message);
        return NextResponse.redirect(loginUrl);
      }

      // Ensure profile and organization are provisioned idempotently for the authenticated user
      const user = data?.user || (await supabase.auth.getUser()).data.user;
      if (user) {
        try {
          const fullName =
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            null;

          await ensureUserOrganizationAndProfile(
            user.id,
            user.email || "user@propertyads.id",
            fullName
          );
        } catch (provErr) {
          console.warn("[Auth Callback] Provisioning non-blocking warning:", provErr);
        }
      }

      // Safe destination redirect with session cookies attached
      const targetUrl = new URL(redirectTarget, request.url);
      const redirectResponse = NextResponse.redirect(targetUrl);

      // Explicitly propagate any session cookies set in cookieStore
      try {
        const cookieStore = await cookies();
        cookieStore.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value);
        });
      } catch {
        // Fallback for non-request environments (e.g. unit tests without request async storage)
      }

      // Clear any PKCE code verifier cookies to keep request headers lean
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.includes("-code-verifier")) {
          redirectResponse.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
        }
      });

      return redirectResponse;
    } catch (err) {
      console.error("[Auth Callback] Unexpected error:", err);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "oauth_unexpected_error");
      return NextResponse.redirect(loginUrl);
    }
  }

  // Fallback if accessed directly without code or error
  return NextResponse.redirect(new URL("/login", request.url));
}
