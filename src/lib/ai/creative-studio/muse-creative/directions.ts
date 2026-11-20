import type { PlanRatio } from "../design-plan";
import { selectPosterCopy } from "../ad-copy-selection";

export type CreativeDirectionId = "premium_editorial" | "commercial_performance" | "architectural_portfolio";

export const CREATIVE_DIRECTIONS: CreativeDirectionId[] = [
  "premium_editorial",
  "commercial_performance",
  "architectural_portfolio",
];

/**
 * Documented Muse Image size strings set the aspect ratio.
 * The returned file is the generator's own pixel size, not these numbers.
 * 1024x1536 is the vertical size used for 4:5 and 9:16. 1536x1024 is horizontal.
 */
export function museSizeForRatio(ratio: PlanRatio): string {
  if (ratio === "1:1") return "1024x1024";
  if (ratio === "16:9") return "1536x1024";
  return "1024x1536";
}

export function buildComposePrompt(input: {
  direction: CreativeDirectionId;
  ratio: PlanRatio;
  cameraNote: string;
}): string {
  return [
    "OBJECTIVE",
    `Compose one ${input.ratio} property advertisement for a Meta placement. The attached photograph is the hero. Leave quiet regions for type that the application will set later. Paint no words, numbers, logos, prices, or phone numbers.`,
    "PRIMARY SUBJECT",
    "The house in the attached photograph is the only subject. It fills the width of the frame and stays recognizable.",
    "REFERENCE IMAGE ROLES",
    "Reference A is the attached photograph. It is the real property and the architectural source of truth. Do not replace it with a different building, and do not treat it as a style sample.",
    "COMPOSITION",
    compositionFor(input.direction),
    "ART DIRECTION",
    artDirectionFor(input.direction),
    "TYPOGRAPHY DIRECTION",
    "Draw no letters. Keep the named quiet region even in tone and clear of the roof and the front door, so a headline and a button can be placed there afterward.",
    "COLOR DIRECTION",
    colorFor(input.direction),
    "PRESERVATION RULES",
    input.cameraNote,
    "Do not change the building shape, number of floors, roof geometry, window positions, door position, facade materials, facade colors, proportions, camera, or architectural details.",
    "Sky, daylight, exposure, contrast, and color balance may be refined. Do not add another house.",
    "OUTPUT FORMAT",
    `The frame is ${input.ratio}. Use the full frame. Do not add side margins, a border, or a separate paper poster under the photograph.`,
    "QUALITY REQUIREMENTS",
    "The door and the roof stay visible. The house is the dominant object. The quiet region does not cover the facade. The result contains no readable text.",
  ].join("\n");
}

function safeZoneLine(ratio: PlanRatio): string {
  if (ratio === "9:16") {
    return "Keep every word below the top 14 percent, above the bottom 35 percent, and 6 percent in from each side. Show the roof and the wooden door.";
  }
  if (ratio === "1:1") {
    return "Keep every word 7 percent inside the edges. Show the roof and the wooden door.";
  }
  return "Keep every word at least 8 percent away from the top and bottom and 6 percent away from the sides. Show the roof and the wooden door.";
}

function compositionForFormat(ratio: PlanRatio): string {
  if (ratio === "9:16") {
    return [
      "This is a 9:16 phone story, not a feed poster.",
      "Keep every word inside the middle band: below the top 14 percent and above the bottom 35 percent, and 6 percent in from each side.",
      "The sky fills the top. The paving fills the bottom. The house stays large in the center.",
      "The headline, the specifications, and the button all sit in that middle band. Do not put the headline at the top edge or the button at the bottom edge.",
      "Show the roof, the tall window, the two front windows, and the wooden door. Do not add a person or a different house.",
    ].join(" ");
  }
  if (ratio === "1:1") {
    return [
      "This is a square advertisement.",
      "Center the house. Keep the type compact and inside a 7 percent margin on every side.",
      "Use one short headline, one row of specifications, and one button. Do not build a tall sidebar.",
      "Show the roof and the wooden door. Do not add a person or a different house.",
    ].join(" ");
  }
  return [
    "This is a 4:5 portrait feed advertisement.",
    "The house is the largest object and fills most of the frame. Show the roof, the tall window, the two front windows, and the wooden door.",
    "Keep the headline, the specifications, and the button at least 8 percent away from the top and bottom and 6 percent away from the sides.",
    "The headline is the largest type. The specifications are one short row. The button is clear and not on the bottom edge.",
    "Do not add a person or a different house.",
  ].join(" ");
}

function compositionFor(direction: CreativeDirectionId): string {
  if (direction === "premium_editorial") {
    return "Full-bleed photograph. Keep a calm sky band across the top quarter, clear of the roof, as the only quiet region. The paving at the bottom stays visible and photographic. Do not add a panel.";
  }
  if (direction === "commercial_performance") {
    return "Full-bleed photograph. Place one solid charcoal field across the bottom 16 percent of the frame, sitting on the paving and ending below the front door. The door, windows, and roof stay fully visible above that field. The field touches both side edges.";
  }
  return "Photography-led frame. Keep one narrow quiet band in the sky, about 12 percent of the height, and leave the rest of the photograph untouched. No panel, no border, and no shape over the facade.";
}

function artDirectionFor(direction: CreativeDirectionId): string {
  if (direction === "premium_editorial") {
    return "Premium editorial. Large architectural photography, restrained contrast, and intentional sky. No decorative frames.";
  }
  if (direction === "commercial_performance") {
    return "Commercial performance advertisement. The house is immediate, and the bottom field is a conversion area with enough contrast for specifications and a button. No rounded card floating on the photo.";
  }
  return "Architectural portfolio. The geometry of this facade is the design. Minimal graphic treatment, precise edges, and no lifestyle props that are not already in the photograph.";
}

function colorFor(direction: CreativeDirectionId): string {
  if (direction === "commercial_performance") {
    return "Keep the facade colors of the photograph. The bottom field is charcoal, near #141210, with no second accent color painted into the building.";
  }
  return "Keep the facade colors and the daylight of the photograph. Do not recolor the walls, the roof, or the window frames.";
}

export function posterLines(description: string, density: "quiet" | "sheet" = "quiet"): string[] {
  const copy = selectPosterCopy(description);
  const name = copy.eyebrow || copy.headline;
  const support = copy.headline && copy.headline !== name ? copy.headline : copy.subhead;
  const facts = [copy.typeLabel, ...copy.factRow].filter(Boolean).join(" · ");
  const place = [copy.location !== "Lokasi strategis" ? copy.location : "", ...(copy.nearby || []).slice(0, 2)]
    .filter(Boolean)
    .join(" · ");
  if (density === "sheet") {
    const second = copy.subhead && copy.subhead !== support ? copy.subhead : "";
    return [name, support, second, copy.typeLabel, ...copy.factRow, copy.payment, place, copy.cta || "Konsultasi WhatsApp"].filter(Boolean);
  }
  return [name, support, copy.payment || facts, copy.cta || "Konsultasi WhatsApp"].filter(Boolean);
}

export function buildIntegratedAdPrompt(input: {
  description: string;
  ratio: PlanRatio;
  cameraNote: string;
  directionNote?: string;
  textDensity?: "quiet" | "sheet";
  treatment?: "modern";
}): string {
  const density = input.textDensity || "quiet";
  const lines = posterLines(input.description, density);
  return [
    "OBJECTIVE",
    `Design one finished ${input.ratio} property poster as a single piece of graphic design. The house and the layout must be one composition.`,
    "PRIMARY SUBJECT",
    "The attached photograph is the real house. Keep that building: its floors, roof, windows, door, facade colors, and camera.",
    input.cameraNote,
    "REFERENCE IMAGE ROLES",
    "Reference A is the property. Place that house inside the poster. It is not a style sample and it is not a background to cover with a caption bar.",
    "COMPOSITION",
    input.directionNote || compositionForFormat(input.ratio),
    "The house stays recognizable. Do not invent a room, a person, or a second building.",
    input.directionNote ? safeZoneLine(input.ratio) : "",
    input.treatment === "modern"
      ? "ONE DESIGN: Make one commercial advertising scene, not a sidebar of buttons and not a photo with a footer. The real house is centered and complete: roof, tall window, both front windows, and wooden door. A large headline sits in the sky. The strongest nearby fact is a designed object in the scene, such as a sign, not a bullet list. The specifications are one short row. The payment is a small badge with no price. The button is clear. No person, no gift products, no phone number, and no other project's name."
      : "",
    "EXACT TEXT",
    "Use only these lines, spelled as written. Do not add the other listing facts as extra rows:",
    ...lines.map((line) => `- ${line}`),
    "LETTERS",
    "Every word must be completely visible inside the frame. Do not cut a word at the top, the side, or the bottom. If the name is long, break it onto two lines that both fit. Never leave only the last word showing.",
    density === "quiet"
      ? "Keep these lines together in one place. Do not spray them down the sky as a list."
      : "Keep these lines inside the information field, not across the windows.",
    "Do not invent a price, a phone number, a discount, or another slogan.",
    "QUALITY",
    "One calm composition. The house is easy to see, and every word can be read.",
  ].join("\n");
}

export function refinementPrompt(change: string): string {
  return [
    "Change only what this instruction names.",
    change.trim(),
    "Keep the same house, roof, windows, door, materials, facade colors, and camera.",
    "Do not add words, numbers, logos, prices, or a phone number.",
  ].join(" ");
}
