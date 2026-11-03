/**
 * Display helpers for optional (nullable) metrics.
 *
 * Rule: null/undefined/NaN means "not available" and must render as "—".
 * An explicit numeric 0 is a real reported value and renders as "0".
 * Never use `value || 0` or `value ?? 0` for metrics where unavailable and
 * zero have different meanings (e.g. reach).
 */
export function formatOptionalNumber(
  value: number | null | undefined,
  format: (n: number) => string
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return format(value);
}
