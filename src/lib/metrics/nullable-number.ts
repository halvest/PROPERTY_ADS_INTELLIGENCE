/** A reported number, including zero. Null, blank, and NaN stay unavailable. */
export function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Sum only values Meta actually reported.
 * Returns null when every input is unavailable, so a missing metric is not zero.
 */
export function sumReported(values: unknown[]): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed === null) continue;
    total += parsed;
    seen = true;
  }
  return seen ? total : null;
}

/** Adds one reported value. Unavailable inputs leave the running total unchanged. */
export function addReported(total: number | null, value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return total;
  return (total ?? 0) + parsed;
}
