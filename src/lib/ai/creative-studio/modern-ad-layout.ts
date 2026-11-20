import sharp from "sharp";
import { formatSpecLine, selectAdCopy, type SelectedAdCopy } from "./ad-copy-selection";

export type ModernAdRatio = "1:1" | "4:5" | "9:16" | "16:9" | "2:3" | "auto";

const SIZES: Record<Exclude<ModernAdRatio, "auto">, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "2:3": { width: 1080, height: 1620 },
};

const SANS = "Segoe UI, Calibri, Arial, sans-serif";
const SERIF = "Georgia, Palatino Linotype, serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function monographSvg(width: number, plinthH: number, copy: SelectedAdCopy): string {
  const side = 72;
  const baseH = 84;
  const facts = formatSpecLine(copy.specs);
  const place = [copy.location, copy.proof].filter(Boolean).join("   ·   ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${plinthH}" viewBox="0 0 ${width} ${plinthH}">
  <rect width="${width}" height="${plinthH}" fill="#E7E1D6"/>
  <rect width="${width}" height="2" fill="#1C1915"/>
  <text x="${side}" y="64" fill="#8A6840" font-family="${SANS}" font-size="15" font-weight="700" letter-spacing="3.2">${escapeXml(copy.eyebrow.toUpperCase())}</text>
  <text x="${side}" y="128" fill="#1C1915" font-family="${SERIF}" font-size="52">${escapeXml(copy.headline)}</text>
  ${copy.offer ? `<text x="${width - side}" y="128" text-anchor="end" fill="#1C1915" font-family="${SANS}" font-size="28" font-weight="700">${escapeXml(copy.offer)}</text>` : ""}
  <text x="${side}" y="176" fill="#5C554C" font-family="${SANS}" font-size="20">${escapeXml(place)}</text>
  <text x="${side}" y="232" fill="#1C1915" font-family="${SANS}" font-size="26" font-weight="600">${escapeXml(facts)}</text>
  <rect x="0" y="${plinthH - baseH}" width="${width}" height="${baseH}" fill="#1C1915"/>
  <text x="${width / 2}" y="${plinthH - 32}" text-anchor="middle" fill="#F4EFE6" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="0.6">${escapeXml(copy.cta)}</text>
</svg>`;
}

export async function renderModernAd(input: {
  photoDataUrl: string;
  description: string;
  aspectRatio?: ModernAdRatio;
}): Promise<{ imageUrl: string; copy: SelectedAdCopy; width: number; height: number }> {
  const ratio: Exclude<ModernAdRatio, "auto"> = input.aspectRatio && input.aspectRatio !== "auto" ? input.aspectRatio : "4:5";
  const size = SIZES[ratio] || SIZES["4:5"];
  const copy = selectAdCopy(input.description);
  const plinthH = ratio === "9:16" ? 460 : 320;
  const photoH = size.height - plinthH;
  const payload = input.photoDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const photo = await sharp(Buffer.from(payload, "base64"))
    .resize(size.width, photoH, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92 })
    .toBuffer();
  const composed = await sharp({
    create: {
      width: size.width,
      height: size.height,
      channels: 3,
      background: { r: 231, g: 225, b: 214 },
    },
  })
    .composite([
      { input: photo, top: 0, left: 0 },
      { input: Buffer.from(monographSvg(size.width, plinthH, copy)), top: photoH, left: 0 },
    ])
    .webp({ quality: 92 })
    .toBuffer();

  return {
    imageUrl: `data:image/webp;base64,${composed.toString("base64")}`,
    copy,
    width: size.width,
    height: size.height,
  };
}
