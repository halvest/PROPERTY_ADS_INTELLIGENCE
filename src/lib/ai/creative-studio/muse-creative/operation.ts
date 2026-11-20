export type StudioOperation = "photography" | "advertising" | "concept" | "refine" | "generate";

const CONCEPT = /\b(konsep|concept|visualisasi|reimagine|desain baru|new design)\b/i;
const LISTING = /\b(iklan|advertisement|ads\b|brosur|brochure|poster|campaign|katalog|catalog|kamar|type\s*\d|kpr|harga|whatsapp)\b/i;

/**
 * Picks the Muse operation from the user's words.
 * A listing brief becomes an advertisement. A photo instruction stays a photograph.
 * A named concept is labeled as a concept. A follow-up with a Muse response id is a refinement.
 */
export function chooseStudioOperation(input: {
  prompt: string;
  imageCount: number;
  previousResponseId?: string | null;
}): StudioOperation {
  const prior = input.previousResponseId?.trim() || "";
  if (prior.startsWith("resp_") && input.imageCount === 0) return "refine";
  if (CONCEPT.test(input.prompt)) return "concept";
  if (LISTING.test(input.prompt)) return "advertising";
  if (input.imageCount > 0) return "photography";
  return "generate";
}

export function requestNeedsListingType(prompt: string): boolean {
  return LISTING.test(prompt);
}

/** A light change moves color similarity. Geometry is the landmark shift and the edge map. */
export function acceptPhotographicEdit(verdict: { landmarkShift: number; edgeDelta: number }): boolean {
  return verdict.landmarkShift <= 0.18 && verdict.edgeDelta <= 48;
}

export function buildPhotographyPrompt(userRequest: string): string {
  return [
    "OBJECTIVE",
    "Edit this property photograph. Apply only the photographic change named below.",
    `USER REQUEST: ${userRequest.trim()}`,
    "PRIMARY SUBJECT",
    "Reference A, the attached photograph, is the real building and the only subject.",
    "PRESERVATION RULES",
    "Do not change the building shape, number of floors, roof, windows, doors, facade materials, facade colors, or camera.",
    "You may change light, sky, exposure, and color balance.",
    "No text, no logo, no price, no border, and no new building.",
    "This is a photograph, not an advertisement.",
  ].join("\n");
}

export function buildConceptPrompt(userRequest: string): string {
  return [
    "OBJECTIVE",
    "Create an architectural concept. This is a design exploration, not a photograph of an existing property.",
    `USER REQUEST: ${userRequest.trim()}`,
    "REFERENCE IMAGE ROLES",
    "The attached image is a massing reference only. You may change the design because the user asked for a concept.",
    "Do not paint prices, phone numbers, or listing facts.",
  ].join("\n");
}
