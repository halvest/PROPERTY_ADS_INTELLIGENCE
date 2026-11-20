export type StudioRoute = "photography" | "advertising" | "concept" | "refine" | "sky" | "vehicle" | "generate";

const CONCEPT = /\b(konsep|concept|visualisasi|reimagine|desain baru|new design)\b/i;
const LISTING = /\b(iklan|advertisement|ads\b|brosur|brochure|poster|campaign|katalog|catalog|kamar|type\s*\d|kpr|harga|whatsapp)\b/i;
const SKY = /\b(langit|sky|awan)\b/i;
const VEHICLE = /\b(mobil|car|vehicle|kendaraan)\b/i;

/**
 * Chooses the smallest model path for the request.
 * Sky and vehicle edits need a mask. A listing brief is an advertisement.
 * A follow-up on a Muse response is a refinement and does not call SAM again.
 */
export function chooseStudioRoute(input: {
  prompt: string;
  imageCount: number;
  previousResponseId?: string | null;
}): { route: StudioRoute; models: Array<"muse-spark-1.3" | "muse-image-1.0" | "sam-3.1"> } {
  const prior = input.previousResponseId?.trim() || "";
  if (prior.startsWith("resp_") && input.imageCount === 0) {
    return { route: "refine", models: ["muse-image-1.0"] };
  }
  if (input.imageCount > 0 && SKY.test(input.prompt) && !LISTING.test(input.prompt)) {
    return { route: "sky", models: ["sam-3.1", "muse-image-1.0"] };
  }
  if (input.imageCount > 0 && VEHICLE.test(input.prompt) && !LISTING.test(input.prompt)) {
    return { route: "vehicle", models: ["sam-3.1", "muse-image-1.0"] };
  }
  if (CONCEPT.test(input.prompt)) return { route: "concept", models: ["muse-image-1.0"] };
  if (LISTING.test(input.prompt)) return { route: "advertising", models: ["muse-spark-1.3", "muse-image-1.0"] };
  if (input.imageCount > 0) return { route: "photography", models: ["muse-image-1.0"] };
  return { route: "generate", models: ["muse-image-1.0"] };
}
