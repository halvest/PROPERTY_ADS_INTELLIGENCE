import "server-only";

import type { NextRequest } from "next/server";

const PRODUCTION_FALLBACK_ORIGIN = "https://hdcreative.cloud";

function isLocalhostUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function resolveRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (forwardedHost) {
    const isLocalHost =
      forwardedHost.startsWith("localhost") || forwardedHost.startsWith("127.0.0.1");
    const proto = forwardedProto || (isLocalHost ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

/**
 * Resolves the authoritative Meta OAuth redirect URI while preventing accidental
 * `http://localhost:3000` fallbacks from leaking into production (`hdcreative.cloud`).
 */
export function resolveMetaOAuthRedirectUri(request: NextRequest): string {
  const requestOrigin = resolveRequestOrigin(request);
  const isProdContext =
    process.env.NODE_ENV === "production" || !isLocalhostUrl(requestOrigin);

  const envRedirect = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (envRedirect && (!isProdContext || !isLocalhostUrl(envRedirect))) {
    return envRedirect;
  }

  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envAppUrl && (!isProdContext || !isLocalhostUrl(envAppUrl))) {
    return `${envAppUrl.replace(/\/+$/, "")}/api/auth/meta/callback`;
  }

  if (!isLocalhostUrl(requestOrigin)) {
    return `${requestOrigin.replace(/\/+$/, "")}/api/auth/meta/callback`;
  }

  if (process.env.NODE_ENV === "production") {
    return `${PRODUCTION_FALLBACK_ORIGIN}/api/auth/meta/callback`;
  }

  return `${requestOrigin.replace(/\/+$/, "")}/api/auth/meta/callback`;
}
