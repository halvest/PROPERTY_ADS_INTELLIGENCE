import sharp, { type OverlayOptions } from "sharp";
import { selectPosterCopy, type PosterCopy } from "./ad-copy-selection";
import type { CompositionId, PlanRatio } from "./design-plan";
import { fitSubjectPhoto } from "./subject-crop";

const SIZES: Record<PlanRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

const SANS = "Segoe UI, Calibri, Arial, sans-serif";
const SERIF = "Georgia, Palatino Linotype, serif";
const INK = "#1C1915";
const GOLD = "#8C6840";
const MUTED = "#5E584F";
const PAPER = "#F6F1E8";
const PAD = 56;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function renderCampaignAd(input: {
  photoDataUrl: string;
  description: string;
  ratio: PlanRatio;
  composition: CompositionId;
}): Promise<{ imageUrl: string; width: number; height: number }> {
  const size = SIZES[input.ratio];
  const copy = selectPosterCopy(input.description);
  const frame = layoutFor(input.composition, size.width, size.height, copy);
  const payload = input.photoDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const fitted = await fitSubjectPhoto(Buffer.from(payload, "base64"), size.width, frame.photoH, frame.align);
  const layers: OverlayOptions[] = [{ input: fitted.buffer, top: frame.photoTop, left: 0 }];
  for (const panel of frame.panels) {
    layers.push({ input: Buffer.from(panel.svg), top: panel.top, left: 0 });
  }
  const composed = await sharp({
    create: { width: size.width, height: size.height, channels: 3, background: { r: 246, g: 241, b: 232 } },
  })
    .composite(layers)
    .webp({ quality: 92 })
    .toBuffer();
  return {
    imageUrl: `data:image/webp;base64,${composed.toString("base64")}`,
    width: size.width,
    height: size.height,
  };
}

function layoutFor(composition: CompositionId, width: number, height: number, copy: PosterCopy) {
  if (composition === "premium_editorial") {
    const header = nameBlock(width, copy, 48);
    const footer = infoBlock(width, copy, false);
    const photoH = Math.max(360, height - header.height - footer.height);
    return {
      photoTop: header.height,
      photoH,
      align: "safe" as const,
      panels: [
        { svg: header.svg, top: 0 },
        { svg: footer.svg, top: height - footer.height },
      ],
    };
  }
  if (composition === "split") {
    const panel = asymmetricBlock(width, copy);
    return {
      photoTop: 0,
      photoH: Math.max(420, height - panel.height),
      align: "safe" as const,
      panels: [{ svg: panel.svg, top: height - panel.height }],
    };
  }
  if (composition === "full_bleed") {
    const panel = infoBlock(width, copy, false);
    return {
      photoTop: 0,
      photoH: height,
      align: "end" as const,
      panels: [{ svg: panel.svg, top: height - panel.height }],
    };
  }
  const panel = nameBlock(width, copy, 40, true);
  return {
    photoTop: 0,
    photoH: Math.max(480, height - panel.height),
    align: "safe" as const,
    panels: [{ svg: panel.svg, top: height - panel.height }],
  };
}

function nameBlock(width: number, copy: PosterCopy, top: number, withFacts = false): { svg: string; height: number } {
  const nodes: string[] = [];
  let y = top;
  nodes.push(line(PAD, y, (copy.eyebrow || "").toUpperCase(), 18, GOLD, SANS, 700, 3.4));
  y += 52;
  nodes.push(line(PAD, y, copy.headline, 56, INK, SERIF, 400, 0));
  y += 48;
  if (copy.subhead) {
    nodes.push(line(PAD, y, copy.subhead, 30, GOLD, SERIF, 400, 0, "italic"));
    y += 46;
  }
  if (withFacts) {
    y = pushFacts(nodes, width, copy, y);
  }
  y += 28;
  return panel(width, y, nodes);
}

function infoBlock(width: number, copy: PosterCopy, includeName: boolean): { svg: string; height: number } {
  const nodes: string[] = [];
  let y = includeName ? 40 : 36;
  if (includeName) {
    nodes.push(line(PAD, y, (copy.eyebrow || "").toUpperCase(), 18, GOLD, SANS, 700, 3.4));
    y += 48;
    nodes.push(line(PAD, y, copy.headline, 48, INK, SERIF, 400, 0));
    y += 42;
  }
  y = pushFacts(nodes, width, copy, y);
  y += 24;
  return panel(width, y, nodes);
}

function asymmetricBlock(width: number, copy: PosterCopy): { svg: string; height: number } {
  const nodes: string[] = [];
  const right = Math.round(width * 0.52);
  let leftY = 48;
  nodes.push(line(PAD, leftY, (copy.eyebrow || "").toUpperCase(), 16, GOLD, SANS, 700, 3));
  leftY += 46;
  nodes.push(line(PAD, leftY, copy.headline, 42, INK, SERIF, 400, 0));
  leftY += 40;
  if (copy.subhead) {
    nodes.push(line(PAD, leftY, copy.subhead, 24, GOLD, SERIF, 400, 0, "italic"));
    leftY += 40;
  }
  if (shownLocation(copy)) {
    nodes.push(line(PAD, leftY, copy.location, 20, INK, SANS, 400, 0));
    leftY += 32;
  }
  for (const row of wrapWords(nearbyLine(copy), 28)) {
    nodes.push(line(PAD, leftY, row, 16, MUTED, SANS, 400, 0));
    leftY += 24;
  }
  let rightY = 52;
  const specs = specItems(copy);
  for (const item of specs) {
    nodes.push(line(right, rightY, item, 24, INK, SANS, 700, 0));
    rightY += 38;
  }
  if (copy.payment) {
    rightY += 8;
    nodes.push(line(right, rightY, copy.payment, 16, MUTED, SANS, 700, 0.4));
    rightY += 36;
  }
  nodes.push(ctaButton(right, rightY, Math.min(420, width - right - PAD), copy.cta));
  rightY += 68;
  const height = Math.max(leftY, rightY) + 36;
  return panel(width, height, nodes);
}

function pushFacts(nodes: string[], width: number, copy: PosterCopy, y: number): number {
  const specs = specItems(copy);
  const colW = Math.round((width - PAD * 2) / 2);
  specs.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    nodes.push(line(PAD + col * colW, y + row * 38, item, 24, INK, SANS, 700, 0));
  });
  y += Math.ceil(specs.length / 2) * 38 + 8;
  if (shownLocation(copy)) {
    nodes.push(line(PAD, y, copy.location, 22, INK, SANS, 400, 0));
    y += 32;
  }
  for (const row of wrapWords(nearbyLine(copy), 58)) {
    nodes.push(line(PAD, y, row, 18, MUTED, SANS, 400, 0));
    y += 26;
  }
  if (copy.payment) {
    y += 6;
    nodes.push(line(PAD, y, copy.payment, 18, INK, SANS, 700, 0.8));
    y += 36;
  }
  nodes.push(ctaButton(PAD, y, 480, copy.cta));
  return y + 72;
}

function specItems(copy: PosterCopy): string[] {
  return [copy.typeLabel, ...copy.factRow].filter(Boolean);
}

function nearbyLine(copy: PosterCopy): string {
  const places = copy.nearby?.length ? copy.nearby : copy.proofs;
  return places.join("   ·   ");
}

function shownLocation(copy: PosterCopy): string {
  if (!copy.location || copy.location === "Lokasi strategis") return "";
  return copy.location;
}

function ctaButton(x: number, y: number, width: number, label: string): string {
  const text = label || "Konsultasi WhatsApp";
  return `<rect x="${x}" y="${y}" width="${width}" height="64" rx="12" fill="${INK}"/>
    <path d="M${x + 34} ${y + 22}c-7.2 0-13 5.2-13 11.6 0 2.4.8 4.6 2.2 6.5l-1.2 4.7 4.8-2.2c1.6.8 3.4 1.2 5.2 1.2 7.2 0 13-5.2 13-11.6s-5.8-11.6-13-11.6z" fill="#F6F1E8"/>
    <text x="${x + 62}" y="${y + 40}" fill="${PAPER}" font-family="${SANS}" font-size="22" font-weight="700">${escapeXml(text)}</text>`;
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

function wrapWords(value: string, max: number): string[] {
  if (!value) return [];
  const rows: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      rows.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) rows.push(current);
  return rows.slice(0, 4);
}

function panel(width: number, height: number, nodes: string[]): { svg: string; height: number } {
  return {
    height,
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${PAPER}"/>
  ${nodes.join("\n")}
</svg>`,
  };
}
