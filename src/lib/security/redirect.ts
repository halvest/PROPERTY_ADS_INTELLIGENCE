/** Resolve a redirect target while allowing only paths on the current application origin. */
export function safeInternalRedirect(
  target: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!target) return fallback;

  try {
    const applicationOrigin = new URL("https://hdcreative.invalid");
    const resolved = new URL(target, applicationOrigin);
    if (resolved.origin !== applicationOrigin.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
