import sharp from "sharp";
import { selectPosterCopy, type PosterCopy } from "../ad-copy-selection";
import type { PlanRatio } from "../design-plan";
import { fitSubjectPhoto } from "../subject-crop";

export type AgencyConcept = "editorial_sky" | "commercial" | "facade_minimal";

const SIZES: Record<PlanRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

const SANS = "Segoe UI, Calibri, Arial, sans-serif";
const SERIF = "Georgia, Palatino Linotype, serif";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Renders one advertising concept directly on the photograph.
 * The type is part of the picture. There is no separate paper poster.
 */
export async function renderAgencyAd(input: {
  photoDataUrl: string;
  description: string;
  ratio: PlanRatio;
  concept: AgencyConcept;
}): Promise<{ imageUrl: string; width: number; height: number; concept: AgencyConcept }> {
  const size = SIZES[input.ratio];
  const copy = selectPosterCopy(input.description);
  const payload = input.photoDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const fitted = await fitSubjectPhoto(Buffer.from(payload, "base64"), size.width, size.height, "safe");
  const overlay = overlayFor(input.concept, size.width, size.height, copy);
  const composed = await sharp(fitted.buffer)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .webp({ quality: 92 })
    .toBuffer();
  return {
    imageUrl: `data:image/webp;base64,${composed.toString("base64")}`,
    width: size.width,
    height: size.height,
    concept: input.concept,
  };
}

export const AGENCY_CONCEPTS: AgencyConcept[] = ["editorial_sky", "commercial", "facade_minimal"];

function overlayFor(concept: AgencyConcept, width: number, height: number, copy: PosterCopy): string {
  if (concept === "commercial") return commercialOverlay(width, height, copy);
  if (concept === "facade_minimal") return minimalOverlay(width, height, copy);
  return editorialOverlay(width, height, copy);
}

function editorialOverlay(width: number, height: number, copy: PosterCopy): string {
  const specs = [copy.typeLabel, ...copy.factRow].filter(Boolean).join("   ·   ");
  const places = (copy.nearby || []).slice(0, 2).join("  ·  ");
  return svg(width, height, `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0E1216" stop-opacity="0.55"/>
        <stop offset="0.42" stop-color="#0E1216" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0E1216" stop-opacity="0"/>
        <stop offset="1" stop-color="#0E1216" stop-opacity="0.62"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${Math.round(height * 0.28)}" fill="url(#sky)"/>
    <rect y="${height - 120}" width="${width}" height="120" fill="url(#ground)"/>
    ${line(56, 72, (copy.eyebrow || "").toUpperCase(), 16, "#F6F1E8", SANS, 700, 3.6)}
    ${line(56, 132, copy.headline, 54, "#F6F1E8", SERIF, 400, 0)}
    ${copy.subhead ? line(56, 172, copy.subhead, 26, "#E4C48A", SERIF, 400, 0, "italic") : ""}
    ${line(56, height - 72, specs, 18, "#F6F1E8", SANS, 600, 0)}
    ${line(56, height - 42, [shownLocation(copy), places, copy.payment].filter(Boolean).join("   ·   "), 16, "#E7E1D6", SANS, 400, 0)}
    ${pill(width - 340, 64, 284, copy.cta)}
  `);
}

function commercialOverlay(width: number, height: number, copy: PosterCopy): string {
  const band = 250;
  const top = height - band;
  const specs = [copy.typeLabel, ...copy.factRow].filter(Boolean).slice(0, 5);
  const chips = flowChips(specs, 48, top + 108, width - 96, "#F4F1E8", "#12382C");
  const payment = copy.payment
    ? badge(48, top + 28, copy.payment, "#E7C56A", "#12382C")
    : "";
  const places = [shownLocation(copy), ...(copy.nearby || []).slice(0, 2)].filter(Boolean).join("  ·  ");
  return svg(width, height, `
    <defs>
      <filter id="read" x="-5%" y="-20%" width="110%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0E1216" flood-opacity="0.55"/>
      </filter>
    </defs>
    ${chipLabel(40, 36, (copy.eyebrow || "RESIDENCE").toUpperCase(), "#12382C", "#F4F1E8")}
    <text x="48" y="168" fill="#F7F4EE" font-family="${SERIF}" font-size="64" filter="url(#read)">${escapeXml(copy.headline)}</text>
    ${copy.subhead ? `<text x="48" y="214" fill="#E7C56A" font-family="${SANS}" font-size="28" font-weight="700" filter="url(#read)">${escapeXml(copy.subhead)}</text>` : ""}
    <rect y="${top}" width="${width}" height="${band}" fill="#12382C"/>
    ${payment}
    ${chips}
    ${line(48, height - 28, places, 15, "#D5E4DA", SANS, 600, 0)}
    ${pill(width - 360, top + 24, 312, copy.cta, "#F4F1E8", "#12382C")}
  `);
}

function minimalOverlay(width: number, height: number, copy: PosterCopy): string {
  const specs = [copy.typeLabel, ...copy.factRow].filter(Boolean).join("   ·   ");
  return svg(width, height, `
    <defs>
      <linearGradient id="skyMin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0E1216" stop-opacity="0.42"/>
        <stop offset="0.28" stop-color="#0E1216" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${Math.round(height * 0.26)}" fill="url(#skyMin)"/>
    ${line(56, 72, (copy.eyebrow || "").toUpperCase(), 15, "#F6F1E8", SANS, 700, 4)}
    ${line(56, 132, copy.headline, 52, "#F6F1E8", SERIF, 400, 0)}
    ${line(56, 164, copy.subhead, 24, "#E4C48A", SERIF, 400, 0, "italic")}
    <rect x="48" y="196" width="760" height="32" rx="6" fill="#0E1216" fill-opacity="0.55"/>
    ${line(60, 218, specs, 16, "#F6F1E8", SANS, 600, 0)}
    ${pill(width - 340, height - 88, 284, copy.cta)}
  `);
}

function shownLocation(copy: PosterCopy): string {
  if (!copy.location || copy.location === "Lokasi strategis") return "";
  return copy.location;
}

function pill(x: number, y: number, width: number, label: string, fill = "#F6F1E8", ink = "#141210"): string {
  const text = label || "Konsultasi WhatsApp";
  return `<rect x="${x}" y="${y}" width="${width}" height="52" rx="26" fill="${fill}"/>
    <text x="${x + width / 2}" y="${y + 33}" text-anchor="middle" fill="${ink}" font-family="${SANS}" font-size="16" font-weight="700">${escapeXml(text)}</text>`;
}

function chipLabel(x: number, y: number, label: string, fill: string, ink: string): string {
  const width = Math.max(160, label.length * 11 + 36);
  return `<rect x="${x}" y="${y}" width="${width}" height="36" rx="18" fill="${fill}"/>
    <text x="${x + width / 2}" y="${y + 24}" text-anchor="middle" fill="${ink}" font-family="${SANS}" font-size="13" font-weight="700" letter-spacing="1.4">${escapeXml(label)}</text>`;
}

function badge(x: number, y: number, label: string, fill: string, ink: string): string {
  const width = Math.min(640, Math.max(180, label.length * 9 + 32));
  return `<rect x="${x}" y="${y}" width="${width}" height="40" rx="8" fill="${fill}"/>
    <text x="${x + 16}" y="${y + 26}" fill="${ink}" font-family="${SANS}" font-size="15" font-weight="700">${escapeXml(label)}</text>`;
}

function flowChips(labels: string[], x: number, y: number, maxWidth: number, fill: string, ink: string): string {
  let cursor = x;
  let row = 0;
  const nodes: string[] = [];
  for (const label of labels) {
    const width = Math.max(108, label.length * 10 + 32);
    if (cursor + width > x + maxWidth) {
      row += 1;
      cursor = x;
    }
    const top = y + row * 46;
    nodes.push(`<rect x="${cursor}" y="${top}" width="${width}" height="36" rx="18" fill="${fill}"/>
      <text x="${cursor + width / 2}" y="${top + 24}" text-anchor="middle" fill="${ink}" font-family="${SANS}" font-size="15" font-weight="700">${escapeXml(label)}</text>`);
    cursor += width + 10;
  }
  return nodes.join("");
}

function line(
  x: number,
  y: number,
  value: string,
  size: number,
  fill: string,
  family: string,
  weight: number,
  tracking: number,
  style = "normal"
): string {
  if (!value) return "";
  const spacing = tracking ? ` letter-spacing="${tracking}"` : "";
  const italic = style === "italic" ? ` font-style="italic"` : "";
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}"${spacing}${italic}>${escapeXml(value)}</text>`;
}

function svg(width: number, height: number, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${body}
</svg>`;
}
