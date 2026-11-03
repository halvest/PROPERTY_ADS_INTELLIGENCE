/**
 * Unified Thin-Line Architectural Vector Icons (Zero Emojis)
 * Supports both HTML5 Canvas 2D rendering and SVG path definitions.
 * Default viewBox: 24 x 24, strokeWidth: 1.5px, round caps/joins.
 */

export type MinimalistIconId =
  | "icon_lt"
  | "icon_lb"
  | "icon_floors"
  | "icon_bed"
  | "icon_bath"
  | "icon_carport"
  | "icon_living"
  | "icon_kitchen"
  | "icon_compass"
  | "icon_pin"
  | "icon_shield"
  | "icon_whatsapp";

export const MINIMALIST_ICON_SVG_PATHS: Record<MinimalistIconId, string[]> = {
  // Land square with corner dimension arrows
  icon_lt: [
    "M4 4h16v16H4z",
    "M7 7l4 4M7 7h3M7 7v3",
    "M17 17l-4-4M17 17h-3M17 17v-3",
  ],
  // House outline with horizontal width arrow
  icon_lb: [
    "M3 10.5L12 3l9 7.5",
    "M5.5 9v10.5h13V9",
    "M8 15h8M8 15l2-2M8 15l2 2M16 15l-2-2M16 15l-2 2",
  ],
  // 2-story architectural building elevation
  icon_floors: [
    "M4 20h16",
    "M6 20V5l6-2 6 2v15",
    "M6 12h12",
    "M9 8h2M13 8h2M9 15h2M13 15h2",
  ],
  // Double bed outline with headboard & pillows
  icon_bed: [
    "M3 18v-5a2 2 0 012-2h14a2 2 0 012 2v5",
    "M3 16h18M3 18v2M21 18v2",
    "M5 11V7a1 1 0 011-1h12a1 1 0 011 1v4",
    "M7 11V9h4v2M13 11V9h4v2",
  ],
  // Rain shower head & water droplets
  icon_bath: [
    "M5 20V7a4 4 0 014-4h3a3 3 0 013 3v1",
    "M11 7h8l-1 3h-6z",
    "M13 13v2M16 13v2M14.5 16v2M17.5 16v2",
  ],
  // SUV inside modern carport canopy
  icon_carport: [
    "M3 7l9-3 9 3",
    "M4 7v13M20 7v13",
    "M6.5 16.5h11v-3l-1.5-3.5h-8L6.5 13.5v3z",
    "M7.5 16.5v2h2v-2M14.5 16.5v2h2v-2",
    "M8.5 14h2M13.5 14h2",
  ],
  // Modern sofa + wall art frame
  icon_living: [
    "M8 4h8v4H8z",
    "M4 15v-2a2 2 0 012-2h12a2 2 0 012 2v2",
    "M3 13v5h18v-5",
    "M5 18v2M19 18v2",
  ],
  // Minimalist kitchen counter & range hood
  icon_kitchen: [
    "M4 13h16v7H4z",
    "M12 13v7M8 16h1M15 16h1",
    "M7 4h10l1.5 4h-13z",
  ],
  // North orientation compass diamond
  icon_compass: [
    "M12 3a9 9 0 100 18 9 9 0 000-18z",
    "M14.8 9.2l-1.8 5.6-5.6 1.8 1.8-5.6 5.6-1.8z",
  ],
  // Architectural location pin
  icon_pin: [
    "M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z",
    "M12 11m-2.2 0a2.2 2.2 0 104.4 0 2.2 2.2 0 10-4.4 0",
  ],
  // Verification check shield
  icon_shield: [
    "M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z",
    "M9 12l2 2 4-4",
  ],
  // Clean vector phone / WhatsApp chat emblem
  icon_whatsapp: [
    "M12 3a8.5 8.5 0 00-7.4 12.7L3.5 20.5l5-1.1A8.5 8.5 0 1012 3z",
    "M9.2 8.8c.3-.3.7-.3 1 0l1 1.2c.2.3.1.7-.1.9l-.6.5c.5 1 1.3 1.8 2.3 2.3l.5-.6c.2-.2.6-.3.9-.1l1.2 1c.3.3.3.7 0 1-.6.6-1.5.9-2.4.6-2.3-.7-4.1-2.5-4.8-4.8-.3-.9 0-1.8.6-2.4z",
  ],
};

/**
 * Draws a crisp thin-line architectural vector icon onto an HTML5 2D Canvas.
 * Uses Path2D when available and falls back to clean geometric primitives.
 */
export function drawMinimalistIcon(
  ctx: CanvasRenderingContext2D,
  iconId: MinimalistIconId,
  x: number,
  y: number,
  size: number = 28,
  strokeColor: string = "#FFFFFF",
  strokeWidth: number = 1.6
): void {
  const paths = MINIMALIST_ICON_SVG_PATHS[iconId] || MINIMALIST_ICON_SVG_PATHS.icon_shield;
  const scale = size / 24;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth / scale * (size / 24);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (typeof Path2D !== "undefined") {
    for (const d of paths) {
      const p = new Path2D(d);
      ctx.stroke(p);
    }
  } else {
    // Fallback basic outline in non-Path2D headless test environments
    ctx.beginPath();
    ctx.rect(3, 3, 18, 18);
    ctx.stroke();
  }

  ctx.restore();
}

