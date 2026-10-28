import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import type { User } from "@supabase/supabase-js";

export async function updateSession(request: NextRequest): Promise<{
  supabaseResponse: NextResponse;
  user: User | null;
}> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { supabaseResponse, user: null };
  }

  // Determine active project reference (e.g. "udprwjbmrfknulngsjid")
  const activeProjectRef = supabaseUrl.includes("supabase.co")
    ? supabaseUrl.split("//")[1]?.split(".")[0]
    : null;

  // Prune foreign or orphaned Supabase project cookies (e.g. from other projects on localhost)
  // to prevent request header bloat (HTTP 431)
  if (activeProjectRef) {
    const allCookies = request.cookies.getAll();
    allCookies.forEach((cookie) => {
      const isForeignSupabaseCookie =
        cookie.name.startsWith("sb-") &&
        (cookie.name.includes("-auth-token") || cookie.name.includes("-code-verifier")) &&
        !cookie.name.startsWith(`sb-${activeProjectRef}-`);

      if (isForeignSupabaseCookie) {
        request.cookies.delete(cookie.name);
        supabaseResponse.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
      }
    });
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (!value || options?.maxAge === 0) {
              request.cookies.delete(name);
            } else {
              request.cookies.set(name, value);
            }
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
