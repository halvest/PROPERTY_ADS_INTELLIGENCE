import { VISUAL_REFERENCES } from "./references";

/** Principles observed in the reference library. They are not layouts to select by number. */
export const DESIGN_GRAMMAR = [
  { id: "full-bleed", principle: "The photograph fills the canvas. One short headline sits in real negative space. No large information panel." },
  { id: "editorial-magazine", principle: "Serif headline and a small sans column share a page with a wide margin. The page should feel printed, not like a card." },
  { id: "swiss", principle: "Asymmetric measured columns. Strong alignment. Type and photo have different widths. Empty space is part of the grid." },
  { id: "portfolio", principle: "One large architectural photo, a thin caption, and almost no graphic furniture." },
  { id: "luxury-campaign", principle: "Premium framing and a short elegant headline. Color comes from the property. No gold ornament." },
  { id: "bold-type", principle: "The headline is the largest graphic. It may cross the sky. It must stay readable. The house remains proof." },
  { id: "collage", principle: "Several frames only when the photographs exist. With one photo, frames are crops of that photo. Never invent a room." },
  { id: "brochure", principle: "Project name, a few real facts, and a clear action, arranged with the precision of a developer sheet." },
  { id: "listing", principle: "The photo stays dominant. Name and place are obvious. Facts sit in one structured block, not a giant app card." },
  { id: "minimal", principle: "One photo, one headline, one supporting line, a limited palette, and deliberate empty space." },
  { id: "geometric", principle: "One structural shape frames the photo. The shape is the crop, not decoration scattered on top." },
  { id: "split", principle: "Photo and information occupy two fields. The boundary is part of the composition. The door and roof stay in the photo field." },
  { id: "performance", principle: "One real selling line is larger than the other facts. The button is obvious. The house is still the evidence." },
  { id: "lifestyle", principle: "Warm and quiet. Do not add people, activities, or rooms that are not in the source." },
  { id: "cinematic", principle: "Dramatic light and a short headline. Do not change the building's geometry." },
] as const;

export const OCCUPANCY = ["full", "dominant", "half", "inset"] as const;
export const TEXT_PLACEMENT = ["sky", "over-facade", "side", "bottom-band", "editorial-margin"] as const;
export const GRID = ["none", "asymmetric", "split", "collage", "stacked"] as const;
export const TYPE_SCALE = ["quiet", "editorial", "display", "giant"] as const;
export const HIERARCHY = ["photo-first", "type-first", "offer-first", "facts-first"] as const;
export const FRAMING = ["full-bleed", "geometric-crop", "margin", "multi-frame"] as const;
export const CTA = ["none", "quiet", "button", "dominant"] as const;

export interface CampaignConcept {
  title: string;
  composition: string;
  imageOccupancy: (typeof OCCUPANCY)[number];
  textPlacement: (typeof TEXT_PLACEMENT)[number];
  grid: (typeof GRID)[number];
  typeScale: (typeof TYPE_SCALE)[number];
  hierarchy: (typeof HIERARCHY)[number];
  framing: (typeof FRAMING)[number];
  cta: (typeof CTA)[number];
}

const STRUCTURE_KEYS = ["imageOccupancy", "textPlacement", "grid", "typeScale", "hierarchy", "framing", "cta"] as const;

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseCampaignConcepts(text: string): CampaignConcept[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const concepts: CampaignConcept[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const composition = typeof record.composition === "string" ? record.composition.trim() : "";
    const imageOccupancy = oneOf(record.imageOccupancy, OCCUPANCY);
    const textPlacement = oneOf(record.textPlacement, TEXT_PLACEMENT);
    const grid = oneOf(record.grid, GRID);
    const typeScale = oneOf(record.typeScale, TYPE_SCALE);
    const hierarchy = oneOf(record.hierarchy, HIERARCHY);
    const framing = oneOf(record.framing, FRAMING);
    const cta = oneOf(record.cta, CTA);
    if (!title || composition.length < 40) continue;
    if (/rp\s*\d|harga\s*\d|08\d{6,}|diskon\s*\d/i.test(composition)) continue;
    if (!imageOccupancy || !textPlacement || !grid || !typeScale || !hierarchy || !framing || !cta) continue;
    concepts.push({ title, composition, imageOccupancy, textPlacement, grid, typeScale, hierarchy, framing, cta });
  }
  return concepts.length > 0 ? concepts : null;
}

export function structureDistance(left: CampaignConcept, right: CampaignConcept): number {
  return STRUCTURE_KEYS.reduce((distance, key) => distance + (left[key] === right[key] ? 0 : 1), 0);
}

/** True when every pair differs in at least three structural fields. */
export function conceptsAreDistinct(concepts: CampaignConcept[], minimum = 3): boolean {
  if (concepts.length < 2) return false;
  for (let i = 0; i < concepts.length; i += 1) {
    for (let j = i + 1; j < concepts.length; j += 1) {
      if (structureDistance(concepts[i], concepts[j]) < minimum) return false;
    }
  }
  return true;
}

export function rankConcepts(concepts: CampaignConcept[], ratio: string, skyFraction: number): CampaignConcept[] {
  const score = (concept: CampaignConcept) => {
    let value = 0;
    if (ratio === "9:16" && concept.imageOccupancy === "full") value += 3;
    if (ratio === "9:16" && concept.textPlacement !== "bottom-band" && concept.textPlacement !== "sky") value += 2;
    if (ratio === "9:16" && concept.textPlacement === "bottom-band") value -= 3;
    if (ratio === "4:5" && (concept.hierarchy === "photo-first" || concept.grid === "asymmetric")) value += 2;
    if (ratio === "1:1" && (concept.imageOccupancy === "dominant" || concept.imageOccupancy === "half")) value += 2;
    if (skyFraction > 0.35 && concept.textPlacement === "sky" && concept.typeScale !== "giant") value += 2;
    if (skyFraction < 0.2 && concept.textPlacement === "sky") value -= 2;
    if (concept.framing === "multi-frame" && concept.grid !== "collage") value -= 1;
    return value;
  };
  return [...concepts].sort((left, right) => score(right) - score(left) || structureDistance(right, concepts[0]) - structureDistance(left, concepts[0]));
}

export function buildCampaignPrompt(input: { ratio: string; conceptCount: number; photoNote: string }): string {
  const grammar = DESIGN_GRAMMAR.map((item) => `- ${item.principle}`).join("\n");
  const seen = VISUAL_REFERENCES.slice(0, 12)
    .map((item) => `- ${item.category}: ${item.layoutStructure} Adapt: ${item.adaptation}`)
    .join("\n");
  return [
    "You are the art director. Invent original compositions for this one house.",
    input.photoNote,
    `The poster ratio is ${input.ratio}. Only one exterior photograph exists. Do not invent interiors, people, a price, a phone number, or a discount.`,
    "Use the notes below as visual grammar. Combine ideas. Do not answer with a style name alone and do not copy a reference.",
    grammar,
    "Observations from real posters:",
    seen,
    `Return a JSON array of ${input.conceptCount} concepts. Each object has title, composition, imageOccupancy, textPlacement, grid, typeScale, hierarchy, framing, cta.`,
    "composition is 2 or 3 sentences describing where the house, the headline, the facts, and the button sit.",
    "imageOccupancy is full, dominant, half, or inset.",
    "textPlacement is sky, over-facade, side, bottom-band, or editorial-margin.",
    "grid is none, asymmetric, split, collage, or stacked.",
    "typeScale is quiet, editorial, display, or giant.",
    "hierarchy is photo-first, type-first, offer-first, or facts-first.",
    "framing is full-bleed, geometric-crop, margin, or multi-frame.",
    "cta is none, quiet, button, or dominant.",
    "The concepts must differ in occupancy, grid, and type scale. Do not move the same panel and call it a new concept.",
    "If the house is a flat-roofed contemporary building, compose a full advertising scene: the house centered, a headline in the sky, and one designed object for the key fact. Do not propose a sidebar of stacked buttons or a text banner under the photo.",
  ].join("\n");
}
