export type AdFormat = "4:5" | "9:16" | "1:1";
export type ExportTier = "primary" | "alternative";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface SafeZone {
  format: AdFormat;
  tier: ExportTier;
  canvasWidth: number;
  canvasHeight: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const PROFILES: Record<AdFormat, { primary: CanvasSize; alternative: CanvasSize; left: number; right: number; top: number; bottom: number }> = {
  "4:5": {
    primary: { width: 1440, height: 1800 },
    alternative: { width: 1080, height: 1350 },
    left: 0.06,
    right: 0.06,
    top: 0.08,
    bottom: 0.08,
  },
  "9:16": {
    primary: { width: 1440, height: 2560 },
    alternative: { width: 1080, height: 1920 },
    left: 0.06,
    right: 0.06,
    top: 0.14,
    bottom: 0.35,
  },
  "1:1": {
    primary: { width: 1080, height: 1080 },
    alternative: { width: 1200, height: 1200 },
    left: 0.07,
    right: 0.07,
    top: 0.07,
    bottom: 0.07,
  },
};

export const AD_FORMATS: AdFormat[] = ["4:5", "9:16", "1:1"];

export function canvasSize(format: AdFormat, tier: ExportTier = "primary"): CanvasSize {
  return PROFILES[format][tier];
}

/** Pixel box that critical text must fit inside. Bottom is the lowest allowed y. */
export function safeZone(format: AdFormat, tier: ExportTier = "primary"): SafeZone {
  const canvas = canvasSize(format, tier);
  const profile = PROFILES[format];
  return {
    format,
    tier,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    left: Math.round(canvas.width * profile.left),
    top: Math.round(canvas.height * profile.top),
    right: Math.round(canvas.width * (1 - profile.right)),
    bottom: Math.round(canvas.height * (1 - profile.bottom)),
  };
}

export interface ContentBox {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SafeZoneViolation {
  name: string;
  reason: string;
}

export function validateSafeZone(zone: SafeZone, boxes: ContentBox[]): SafeZoneViolation[] {
  const violations: SafeZoneViolation[] = [];
  for (const box of boxes) {
    if (box.x < zone.left) violations.push({ name: box.name, reason: "left" });
    if (box.y < zone.top) violations.push({ name: box.name, reason: "top" });
    if (box.x + box.width > zone.right) violations.push({ name: box.name, reason: "right" });
    if (box.y + box.height > zone.bottom) violations.push({ name: box.name, reason: "bottom" });
    if (box.x < 0 || box.y < 0 || box.x + box.width > zone.canvasWidth || box.y + box.height > zone.canvasHeight) {
      violations.push({ name: box.name, reason: "canvas" });
    }
  }
  return violations;
}

export function overlapsFocalPoint(box: ContentBox, focal: { x: number; y: number; width: number; height: number }): boolean {
  return box.x < focal.x + focal.width
    && box.x + box.width > focal.x
    && box.y < focal.y + focal.height
    && box.y + box.height > focal.y;
}
