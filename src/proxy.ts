import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/dashboard", "/ads", "/leads", "/reviews", "/settings"];
const AUTH_ROUTES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabaseResponse, user } = await updateSession(request);

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  // Demo access is a server deployment decision (DATA_MODE=demo), never a
  // client-controlled cookie alone. The cookie only opts in when the server
  // has explicitly been deployed in demo mode.
  const isDemoMode =
    process.env.DATA_MODE === "demo" &&
    request.cookies.get("demo_mode")?.value === "true";

  // Helper to preserve Set-Cookie headers on redirects to prevent cookie drops or accumulation
  const createRedirectWithCookies = (url: URL | string): NextResponse => {
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  };

  // 1. Protected route enforcement
  if (isProtectedRoute) {
    if (!user && !isDemoMode) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return createRedirectWithCookies(loginUrl);
    }

    // Email verification enforcement in production
    if (user && !user.email_confirmed_at && process.env.NODE_ENV === "production") {
      const verifyUrl = new URL("/verify-otp", request.url);
      if (user.email) {
        verifyUrl.searchParams.set("email", user.email);
      }
      return createRedirectWithCookies(verifyUrl);
    }
  }

  // 2. Redirect authenticated verified user away from login/register
  if (isAuthRoute && user && user.email_confirmed_at) {
    return createRedirectWithCookies(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
