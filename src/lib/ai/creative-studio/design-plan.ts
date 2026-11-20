import type { FacadePlacement } from "./facade-placement";

export type CameraAngle =
  | "front"
  | "three_quarter"
  | "side"
  | "eye_level"
  | "high_angle"
  | "low_angle"
  | "unverified";

export type CompositionId =
  | "hero_property"
  | "premium_editorial"
  | "full_bleed"
  | "split"
  | "minimal";

export type PlanRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface DesignPlan {
  source: "muse_spark" | "measurement";
  visual_analysis: {
    camera_angle: CameraAngle;
    /** True only when the enum, a confidence of at least 0.6, and a matching evidence phrase agree. */
    camera_accepted: boolean;
    camera_evidence: string;
    perspective_note: string;
    negative_space: "sky" | "lower_area" | "side" | "none";
    /** True when the sky is a calm field that can hold type without covering the roof. */
    sky_suitable_for_type: boolean;
    lighting_direction: "left" | "right" | "front" | "unknown";
    confidence: number;
  };
  creative_direction: {
    composition: CompositionId;
    aspect_ratio: PlanRatio;
    hero: "original_photograph";
  };
  image_editing: {
    preserve_architecture: true;
    preserve_materials: true;
    preserve_facade_colors: true;
    allow_perspective_transformation: false;
    editing_scope: "none" | "atmosphere";
  };
  quality_checks: string[];
}

const ANGLES: CameraAngle[] = ["front", "three_quarter", "side", "eye_level", "high_angle", "low_angle", "unverified"];
const COMPOSITIONS: CompositionId[] = ["hero_property", "premium_editorial", "full_bleed", "split", "minimal"];

export function fallbackDesignPlan(placement: FacadePlacement): DesignPlan {
  const negativeSpace = placement.openRegion === "sky" ? "sky" : "lower_area";
  return {
    source: "measurement",
    visual_analysis: {
      camera_angle: "unverified",
      camera_accepted: false,
      camera_evidence: "",
      perspective_note: "Sudut kamera tidak ditebak dari rasio foto.",
      negative_space: negativeSpace,
      sky_suitable_for_type: false,
      lighting_direction: "unknown",
      confidence: 0.35,
    },
    creative_direction: {
      composition: "hero_property",
      aspect_ratio: placement.ratio,
      hero: "original_photograph",
    },
    image_editing: {
      preserve_architecture: true,
      preserve_materials: true,
      preserve_facade_colors: true,
      allow_perspective_transformation: false,
      editing_scope: "atmosphere",
    },
    quality_checks: ["architectural_integrity", "perspective_consistency", "text_legibility"],
  };
}

export function parseDesignPlan(raw: string, placement: FacadePlacement): DesignPlan {
  const fallback = fallbackDesignPlan(placement);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return fallback;
  }
  const visual = objectOf(parsed.visual_analysis);
  const creative = objectOf(parsed.creative_direction);
  const angle = ANGLES.includes(visual.camera_angle as CameraAngle) ? (visual.camera_angle as CameraAngle) : "unverified";
  const composition = COMPOSITIONS.includes(creative.composition as CompositionId)
    ? (creative.composition as CompositionId)
    : fallback.creative_direction.composition;
  const negative = ["sky", "lower_area", "side", "none"].includes(String(visual.negative_space))
    ? (visual.negative_space as DesignPlan["visual_analysis"]["negative_space"])
    : fallback.visual_analysis.negative_space;
  const light = ["left", "right", "front", "unknown"].includes(String(visual.lighting_direction))
    ? (visual.lighting_direction as DesignPlan["visual_analysis"]["lighting_direction"])
    : "unknown";
  const confidence = typeof visual.confidence === "number" ? Math.max(0, Math.min(1, visual.confidence)) : 0.4;
  const visualNote = typeof visual.perspective_note === "string" ? visual.perspective_note.trim() : "";
  const creativeNote = typeof creative.perspective_note === "string" ? creative.perspective_note.trim() : "";
  const note = visualNote || creativeNote;
  if (note.length < 12) return fallback;
  const evidence = typeof visual.camera_evidence === "string" && visual.camera_evidence.trim()
    ? visual.camera_evidence.trim()
    : note;
  const camera = acceptCameraAngle({ angle, confidence, evidence });
  const skySuitable = visual.sky_suitable_for_type === true || creative.sky_suitable_for_type === true;
  const requested = composition === "full_bleed" && negative === "none" ? "hero_property" : composition;
  const chosen = chooseComposition({
    requested,
    skyFraction: placement.source.skyFraction,
    skySuitableForType: skySuitable,
    refusedCrop: placement.refusedCrop,
  });
  return {
    source: "muse_spark",
    visual_analysis: {
      camera_angle: camera.angle,
      camera_accepted: camera.accepted,
      camera_evidence: evidence.slice(0, 180),
      sky_suitable_for_type: skySuitable,
      perspective_note: note.slice(0, 180),
      negative_space: negative,
      lighting_direction: light,
      confidence,
    },
    creative_direction: {
      composition: chosen,
      aspect_ratio: placement.ratio,
      hero: "original_photograph",
    },
    image_editing: {
      preserve_architecture: true,
      preserve_materials: true,
      preserve_facade_colors: true,
      allow_perspective_transformation: false,
      editing_scope: "atmosphere",
    },
    quality_checks: ["architectural_integrity", "perspective_consistency", "text_legibility", "aspect_ratio"],
  };
}

export function sparkAnalysisPrompt(placement: FacadePlacement): string {
  return [
    "Analyze this one property photograph for an advertisement. Reply with JSON only.",
    `Measured frame ${placement.source.width}x${placement.source.height}. Open sky fraction ${placement.source.skyFraction}.`,
    "Set camera_angle to three_quarter only when two facades meet at a visible corner, front only when one facade faces the camera, and side only when a single side wall is visible.",
    "If that evidence is not visible, camera_angle is unverified. Do not describe an angle in the note that the enum refuses.",
    "camera_evidence is the visible cue, and confidence is 0 to 1. A named angle needs confidence of at least 0.6.",
    "sky_suitable_for_type is true only when the sky is a calm field that can hold type clear of the roof. A dramatic sky that belongs to the photograph is false.",
    "Do not choose premium_editorial only because sky exists. Keep the building as the hero.",
    "perspective_note must be one sentence about this specific photograph. An empty note is invalid.",
    "preserve_architecture, preserve_materials, and preserve_facade_colors are true.",
    "allow_perspective_transformation is false.",
    `aspect_ratio is ${placement.ratio}.`,
    "composition is one of hero_property, premium_editorial, full_bleed, split, minimal.",
    "Return only the JSON object with keys visual_analysis, creative_direction, and image_editing.",
  ].join(" ");
}

export function atmosphereEditPrompt(plan: DesignPlan): string {
  const camera = plan.visual_analysis.camera_accepted
    ? `The camera is ${plan.visual_analysis.camera_angle}. Keep that camera.`
    : "The camera angle is not verified. Keep the photograph's camera exactly.";
  return [
    "Edit only the atmosphere of this property photograph.",
    camera,
    "Do not rotate, stretch, or redraw the house.",
    "Lock the structure, roof, windows, doors, facade design, materials, and facade colors.",
    "You may clean the sky and refine the daylight already in the photo. Cars may be tidied without changing their shape.",
    "No text, no logo, no price, no border, no new building.",
  ].join(" ");
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const CAMERA_CUES: Record<Exclude<CameraAngle, "unverified">, RegExp> = {
  three_quarter: /three[- ]quarter|3\/4|tiga perempat|two (visible )?(facades|faces|walls)|dua (fasad|sisi|bidang)|meet at a (visible )?(vertical )?corner|visible (vertical )?corner|facade and .{0,48}side wall/i,
  front: /front elevation|frontal|straight-on|fasad depan|satu fasad|one facade/i,
  side: /side elevation|side wall|fasad samping|profil samping/i,
  eye_level: /eye[- ]level|sejajar mata/i,
  high_angle: /high angle|looking down|dari atas/i,
  low_angle: /low angle|looking up|dari bawah/i,
};

/**
 * A named angle is kept only when the model also states a confidence of at least 0.6
 * and a phrase that matches that angle. An unverified enum is never promoted from the note.
 */
export function acceptCameraAngle(input: {
  angle: CameraAngle;
  confidence: number;
  evidence: string;
}): { angle: CameraAngle; accepted: boolean } {
  if (input.angle === "unverified") return { angle: "unverified", accepted: false };
  const supported = CAMERA_CUES[input.angle].test(input.evidence);
  if (input.confidence >= 0.6 && supported) return { angle: input.angle, accepted: true };
  return { angle: "unverified", accepted: false };
}

/**
 * Sky area alone does not select a layout. Editorial type needs a calm sky the model marked as usable.
 */
export function chooseComposition(input: {
  requested: CompositionId;
  skyFraction: number;
  skySuitableForType: boolean;
  refusedCrop: boolean;
}): CompositionId {
  if (input.requested === "premium_editorial") {
    return input.skySuitableForType && input.skyFraction >= 0.22 ? "premium_editorial" : "hero_property";
  }
  if (input.requested === "split" && input.refusedCrop) return "hero_property";
  return input.requested;
}
