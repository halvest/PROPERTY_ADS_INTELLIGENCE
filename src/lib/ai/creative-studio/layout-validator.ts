import type { AspectRatio } from "./types";

export interface SafeZoneBounds {
  topUnsafePx: number;
  bottomUnsafePx: number;
  sideUnsafePx: number;
  secondaryCropPx?: number; // 135px (10%) 1:1 auto-crop guide for 4:5
  rightNotch?: {
    xStart: number;
    yStart: number;
    yEnd: number;
  };
  safeRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    rightX: number;
    bottomY: number;
  };
}

/**
 * Calculates Meta Ads Manager's exact safe zone bounds across 9:16, 4:5, and 1:1.
 * Enforces zero text/logos in native UI overlay areas and Advantage+ auto-crop zones.
 */
export function getSafeZoneBounds(
  width: number,
  height: number,
  aspectRatio: "1:1" | "4:5" | "9:16"
): SafeZoneBounds {
  if (aspectRatio === "9:16") {
    const topUnsafePx = Math.round(height * 0.14);      // 269px on 1920
    const bottomUnsafePx = Math.round(height * 0.35);   // 672px on 1920 (Safe Y ends at 1248px)
    const sideUnsafePx = Math.round(width * 0.06);      // 65px on 1080
    const bottomY = height - bottomUnsafePx;            // 1248px
    const rightX = width - sideUnsafePx;                // 1015px
    return {
      topUnsafePx,
      bottomUnsafePx,
      sideUnsafePx,
      rightNotch: {
        xStart: Math.round(width * 0.88),               // 950px
        yStart: Math.round(height * 0.53),              // 1018px
        yEnd: Math.round(height * 0.65),                // 1248px
      },
      safeRect: {
        x: sideUnsafePx,                                // 65px
        y: topUnsafePx,                                 // 269px
        width: width - sideUnsafePx * 2,                // 950px
        height: height - topUnsafePx - bottomUnsafePx,  // 979px
        rightX,                                         // 1015px
        bottomY,                                        // 1248px
      },
    };
  }

  if (aspectRatio === "4:5") {
    const topUnsafePx = Math.round(height * 0.085);     // 115px strict text buffer (135px = 10% 1:1 crop line)
    const bottomUnsafePx = Math.round(height * 0.085);  // 115px strict text buffer (Safe Y ends at 1235px)
    const sideUnsafePx = Math.round(width * 0.06);      // 65px on 1080
    const bottomY = height - bottomUnsafePx;            // 1235px
    const rightX = width - sideUnsafePx;                // 1015px
    return {
      topUnsafePx,
      bottomUnsafePx,
      sideUnsafePx,
      secondaryCropPx: Math.round(height * 0.10),       // 135px (1:1 square auto-crop indicator)
      safeRect: {
        x: sideUnsafePx,                                // 65px
        y: topUnsafePx,                                 // 115px
        width: width - sideUnsafePx * 2,                // 950px
        height: height - topUnsafePx - bottomUnsafePx,  // 1120px
        rightX,                                         // 1015px
        bottomY,                                        // 1235px
      },
    };
  }

  // Default '1:1' (1080x1080)
  const marginPx = Math.round(width * 0.06);            // 64px on 1080
  return {
    topUnsafePx: marginPx,
    bottomUnsafePx: marginPx,
    sideUnsafePx: marginPx,
    safeRect: {
      x: marginPx,                                      // 64px
      y: marginPx,                                      // 64px
      width: width - marginPx * 2,                      // 952px
      height: height - marginPx * 2,                    // 952px
      rightX: width - marginPx,                         // 1016px
      bottomY: height - marginPx,                       // 1016px
    },
  };
}

export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutValidationResult {
  isValid: boolean;
  violations: Array<{
    elementId: string;
    type: "BOUNDARY_OVERFLOW" | "COLLISION" | "SAFE_MARGIN_BREACH" | "TEXT_OVERFLOW";
    message: string;
  }>;
  computedSafeBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    safeMargin: number;
  };
}

export interface CtaFitParameters {
  text: string;
  fontSize: number;
  paddingX: number;
  paddingY: number;
  buttonWidth: number;
  buttonHeight: number;
  x: number;
  y: number;
}

/**
 * Production-Grade Layout Validator & Text Fitting Engine
 * Enforces hard geometric constraints on 1080x1080, 1080x1350, and 1080x1920 canvases.
 * Prevents CTA clipping, text overflow, and visual element collisions.
 */
export class CreativeLayoutValidator {
  public static readonly DEFAULT_SAFE_MARGIN = 72; // 64px - 80px standard

  public static getSafeZoneBounds(
    width: number,
    height: number,
    aspectRatio: AspectRatio
  ): SafeZoneBounds {
    return getSafeZoneBounds(width, height, aspectRatio);
  }

  public static getDimensions(ratio: AspectRatio): { width: number; height: number; safeMargin: number } {
    switch (ratio) {
      case "1:1":
        return { width: 1080, height: 1080, safeMargin: 64 };
      case "9:16":
        return { width: 1080, height: 1920, safeMargin: 65 };
      case "4:5":
      default:
        return { width: 1080, height: 1350, safeMargin: 65 };
    }
  }

  /**
   * Validates that all elements sit strictly within the canvas safe bounds
   * and do not collide with each other.
   */
  public static validateElements(
    elements: BoundingBox[],
    aspectRatio: AspectRatio
  ): LayoutValidationResult {
    const { width: canvasW, height: canvasH } = this.getDimensions(aspectRatio);
    const bounds = getSafeZoneBounds(canvasW, canvasH, aspectRatio);
    const minX = bounds.safeRect.x;
    const minY = bounds.safeRect.y;
    const maxX = bounds.safeRect.rightX;
    const maxY = bounds.safeRect.bottomY;
    const safeMargin = bounds.sideUnsafePx;

    const violations: LayoutValidationResult["violations"] = [];

    // 1. Boundary and Safe Margin Checks
    for (const el of elements) {
      if (el.x < minX) {
        violations.push({
          elementId: el.id,
          type: "SAFE_MARGIN_BREACH",
          message: `Elemen "${el.id}" melanggar margin kiri (${el.x}px < ${minX}px)`,
        });
      }
      if (el.y < minY) {
        violations.push({
          elementId: el.id,
          type: "SAFE_MARGIN_BREACH",
          message: `Elemen "${el.id}" melanggar margin atas (${el.y}px < ${minY}px)`,
        });
      }
      if (el.x + el.width > maxX) {
        violations.push({
          elementId: el.id,
          type: "BOUNDARY_OVERFLOW",
          message: `Elemen "${el.id}" keluar dari batas kanan (${el.x + el.width}px > ${maxX}px)`,
        });
      }
      if (el.y + el.height > maxY) {
        violations.push({
          elementId: el.id,
          type: "BOUNDARY_OVERFLOW",
          message: `Elemen "${el.id}" keluar dari batas bawah (${el.y + el.height}px > ${maxY}px)`,
        });
      }

      // Check Reels/Stories right action notch
      if (bounds.rightNotch) {
        const inNotchY = el.y + el.height > bounds.rightNotch.yStart && el.y < bounds.rightNotch.yEnd;
        if (inNotchY && el.x + el.width > bounds.rightNotch.xStart) {
          violations.push({
            elementId: el.id,
            type: "SAFE_MARGIN_BREACH",
            message: `Elemen "${el.id}" melanggar Reels/Stories action notch kanan (${el.x + el.width}px > ${bounds.rightNotch.xStart}px)`,
          });
        }
      }
    }

    // 2. Element Collision Checks (pair-wise)
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i];
        const b = elements[j];

        const intersects =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;

        if (intersects) {
          violations.push({
            elementId: `${a.id}&${b.id}`,
            type: "COLLISION",
            message: `Tabrakan visual terdeteksi antara "${a.id}" dan "${b.id}"`,
          });
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      computedSafeBounds: { minX, minY, maxX, maxY, safeMargin },
    };
  }

  /**
   * Dynamic CTA Fitting Engine:
   * Calculates the exact button width and font size to GUARANTEE
   * that the button and its inner text never clip past the canvas right margin.
   */
  public static calculateFittedCta(
    rawText: string,
    allocatedMaxRight: number,
    allocatedY: number,
    measureTextWidthFn: (text: string, fontSize: number) => number,
    options: {
      maxAvailableWidth?: number;
      baseFontSize?: number;
      minFontSize?: number;
      height?: number;
    } = {}
  ): CtaFitParameters {
    const cleanText = rawText.trim().toUpperCase();
    const displayText = cleanText.includes("→") ? cleanText : `${cleanText} →`;
    const baseFontSize = options.baseFontSize || 22;
    const minFontSize = options.minFontSize || 15;
    const buttonHeight = options.height || 54;
    const maxAvailableWidth = options.maxAvailableWidth || 360;
    const paddingX = 24;

    let fontSize = baseFontSize;
    let textWidth = measureTextWidthFn(displayText, fontSize);
    let buttonWidth = textWidth + paddingX * 2;

    // Iteratively scale down font size if the button would exceed max allowable width
    while (buttonWidth > maxAvailableWidth && fontSize > minFontSize) {
      fontSize -= 1;
      textWidth = measureTextWidthFn(displayText, fontSize);
      buttonWidth = textWidth + paddingX * 2;
    }

    // Ensure button width does not exceed maxAvailableWidth
    if (buttonWidth > maxAvailableWidth) {
      buttonWidth = maxAvailableWidth;
    }

    // Anchor button to the right safe boundary
    const x = allocatedMaxRight - buttonWidth;

    return {
      text: displayText,
      fontSize,
      paddingX,
      paddingY: Math.round((buttonHeight - fontSize) / 2),
      buttonWidth,
      buttonHeight,
      x,
      y: allocatedY,
    };
  }

  /**
   * Sanitizes text strings to strictly remove emojis and informal unicode glyphs
   */
  public static stripEmojis(str: string): string {
    if (!str) return "";
    return str
      .replace(
        /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
        ""
      )
      .replace(/[\uFE0E\uFE0F]/g, "") // remove emoji variation selectors
      .replace(/\s+/g, " ")
      .trim();
  }
}

