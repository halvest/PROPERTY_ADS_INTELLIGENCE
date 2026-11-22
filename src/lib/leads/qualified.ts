export type CrmQualification = "qualified" | "not_qualified" | "unassessed";

/**
 * Qualified lead is a CRM temperature of warm or hot.
 * Cold and junk are explicit non-qualified values.
 * Missing CRM temperature is unassessed, never coerced to cold or qualified.
 */
export function qualifyCrmTemperature(label: string | null | undefined): CrmQualification {
  if (typeof label !== "string" || label.trim() === "") return "unassessed";
  const value = label.trim().toLowerCase();
  if (value === "hot" || value === "warm") return "qualified";
  if (value === "cold" || value === "junk") return "not_qualified";
  return "unassessed";
}
