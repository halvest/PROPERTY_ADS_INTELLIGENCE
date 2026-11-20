export type MarketingRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface FacadeMeasurement {
  width: number;
  height: number;
  /** Width divided by height. */
  aspect: number;
  /** Share of the frame, from the top, that reads as open sky. */
  skyFraction: number;
}

export interface FacadePlacement {
  source: FacadeMeasurement;
  ratio: MarketingRatio;
  /** The requested ratio would slice the building, so it was not applied. */
  refusedCrop: boolean;
  /** Where type can sit without covering the facade. */
  openRegion: "sky" | "foreground";
  note: string;
}

const RATIOS: MarketingRatio[] = ["1:1", "4:5", "9:16", "16:9"];

function isRatio(value: string): value is MarketingRatio {
  return RATIOS.includes(value as MarketingRatio);
}

/**
 * Picks a marketing ratio from the photograph.
 * A requested ratio is kept when the building still fits.
 * A request that would slice a wide or tall facade is refused.
 */
export function resolveFacadePlacement(
  source: FacadeMeasurement,
  requested: string
): FacadePlacement {
  const openRegion: FacadePlacement["openRegion"] = source.skyFraction >= 0.16 ? "sky" : "foreground";
  const fitted = ratioForFrame(source.aspect);
  const asked = isRatio(requested) ? requested : null;
  const refusedCrop = asked !== null && wouldSliceBuilding(source.aspect, asked);
  const ratio = refusedCrop || !asked ? fitted : asked;
  const note = refusedCrop
    ? `Rasio ${asked} memotong bangunan pada foto ${source.width}×${source.height}. Dipakai ${ratio}, dengan langit atau halaman yang diperluas, tanpa memotong atap, pintu, atau sisi fasad.`
    : `Foto ${source.width}×${source.height} memakai ${ratio}. Sudut kamera foto dipertahankan. Teks duduk di ${openRegion === "sky" ? "langit yang sudah ada" : "area bawah, di luar bukaan fasad"}.`;
  return { source, ratio, refusedCrop, openRegion, note };
}

function ratioForFrame(aspect: number): MarketingRatio {
  if (aspect >= 1.45) return "16:9";
  if (aspect <= 0.62) return "9:16";
  if (aspect <= 0.92) return "4:5";
  return "1:1";
}

function wouldSliceBuilding(aspect: number, requested: MarketingRatio): boolean {
  if (requested === "9:16" && aspect > 1.15) return true;
  if (requested === "16:9" && aspect < 0.8) return true;
  if (requested === "1:1" && (aspect > 1.45 || aspect < 0.7)) return true;
  if (requested === "4:5" && aspect > 1.55) return true;
  return false;
}

export function placementInstruction(placement: FacadePlacement): string {
  const where =
    placement.openRegion === "sky"
      ? "Put the type in the open sky that is already in the photograph, clear of the roof."
      : "Put the type below the building, clear of the door and windows. Do not cover the facade with a panel.";
  return [
    "FACADE PLACEMENT, decided from this photograph only.",
    placement.note,
    "Read the camera first: front elevation, three-quarter view, side perspective, eye level, high angle, or low angle. Keep that camera. Do not rotate the house to a different angle.",
    "Match the original perspective lines, scale, and verticals. Do not stretch, skew, or redraw the roof, walls, doors, or windows.",
    "Match the existing light, shadow direction, and color temperature. The house must not look pasted on.",
    where,
    `Deliver ${placement.ratio} by extending sky or ground that already belongs to the photo. Do not crop the roof, the front door, or a side wall to force the ratio.`,
    "Before finishing, confirm the angle still matches, the scale is believable, the perspective lines agree, the facade is not pasted, the ratio fits the marketing need, and no important part of the building is cut or distorted. If a realistic fit is impossible, keep the original photograph and add type only in the open area.",
  ].join(" ");
}
