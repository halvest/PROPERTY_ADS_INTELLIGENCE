import sharp from "sharp";

/** Marks a generated design so it cannot be read as a photograph of the listed property. */
export async function stampConceptLabel(dataUrl: string): Promise<string> {
  const payload = dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const source = Buffer.from(payload, "base64");
  const meta = await sharp(source).metadata();
  const width = meta.width || 1080;
  const height = meta.height || 1350;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="24" y="24" width="420" height="44" rx="8" fill="#141210"/>
  <text x="44" y="52" fill="#F6F1E8" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">KONSEP ARSITEKTUR</text>
</svg>`;
  const stamped = await sharp(source).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).webp({ quality: 92 }).toBuffer();
  return `data:image/webp;base64,${stamped.toString("base64")}`;
}
