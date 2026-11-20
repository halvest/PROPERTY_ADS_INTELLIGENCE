export interface VisualCritique {
  accepted: boolean;
  defects: string[];
  correction: string;
}

export interface ModelRun {
  model: "muse-spark-1.3" | "muse-image-1.0" | "sam-3.1" | "renderer";
  task: string;
  status: "completed" | "failed" | "skipped";
  durationMs: number;
  output: string;
  error?: string;
}

export type ReferenceRole = "property" | "design_reference" | "brand_asset";

/** First image is the property. A third image is the brand mark. Anything between is a design reference. */
export function assignReferenceRoles(imageCount: number): ReferenceRole[] {
  if (imageCount <= 0) return [];
  const roles: ReferenceRole[] = ["property"];
  for (let index = 1; index < imageCount; index += 1) {
    roles.push(index === imageCount - 1 && imageCount >= 3 ? "brand_asset" : "design_reference");
  }
  return roles;
}

export function referenceRoleLine(role: Exclude<ReferenceRole, "property">): string {
  if (role === "brand_asset") {
    return "This image is a brand mark. Use the mark only. Do not take a building, a price, or a phone number from it.";
  }
  return "This image is a design reference for spacing and hierarchy only. Do not copy its building, its words, or its logo.";
}

export function buildCritiquePrompt(ratio: string): string {
  const rule = ratio === "9:16"
    ? "On 9:16, any word in the top 14 percent or the bottom 35 percent is a defect."
    : ratio === "1:1"
      ? "On 1:1, any word within 7 percent of an edge is a defect."
      : "On 4:5, any word within 8 percent of the top or bottom, or 6 percent of a side, is a defect.";
  return [
    "Inspect this finished advertisement. Judge only what is visible.",
    rule,
    "A cropped roof, a cropped door, or a building that is not the main subject is a defect.",
    "Return JSON only, with this shape: {\"accepted\": true or false, \"defects\": [\"short visible problem\"], \"correction\": \"one change\"}.",
    "accepted is true only when there are no defects. correction is empty when accepted is true.",
    "The correction may move or resize existing type. It must not add a price, a phone number, a discount, or a different house.",
  ].join(" ");
}

export function parseVisualCritique(text: string): VisualCritique | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as {
      accepted?: unknown;
      defects?: unknown;
      correction?: unknown;
    };
    const defects = Array.isArray(raw.defects)
      ? raw.defects.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
      : [];
    const correction = typeof raw.correction === "string" ? raw.correction.trim() : "";
    return {
      accepted: raw.accepted === true && defects.length === 0,
      defects,
      correction,
    };
  } catch {
    return null;
  }
}

/** A correction is usable only when it is one short visual change and does not invent listing facts. */
export function usableCorrection(correction: string): string | null {
  const text = correction.trim();
  if (text.length < 8 || text.length > 400) return null;
  if (/harga|diskon|rp\s*\d|08\d{6,}/i.test(text)) return null;
  return text;
}
