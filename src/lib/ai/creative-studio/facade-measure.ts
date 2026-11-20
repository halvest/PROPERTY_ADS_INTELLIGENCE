import sharp from "sharp";
import type { FacadeMeasurement } from "./facade-placement";

/**
 * Reads the frame only. The camera angle is not inferred from the aspect ratio.
 * Server-only: the studio page imports the placement rules, and sharp cannot ship to the browser.
 */
export async function measureFacadePhoto(buffer: Buffer): Promise<FacadeMeasurement> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1;
  const height = metadata.height || 1;
  const sampleWidth = 32;
  const sampleHeight = 24;
  const raw = await image.resize(sampleWidth, sampleHeight, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const channels = 3;
  let skyRows = 0;
  for (let y = 0; y < sampleHeight; y++) {
    let bright = 0;
    for (let x = 0; x < sampleWidth; x++) {
      const index = (y * sampleWidth + x) * channels;
      const luminance = 0.299 * raw[index] + 0.587 * raw[index + 1] + 0.114 * raw[index + 2];
      if (luminance > 150) bright += 1;
    }
    if (bright / sampleWidth > 0.62) skyRows += 1;
    else break;
  }
  return {
    width,
    height,
    aspect: Number((width / height).toFixed(3)),
    skyFraction: Number((skyRows / sampleHeight).toFixed(3)),
  };
}
