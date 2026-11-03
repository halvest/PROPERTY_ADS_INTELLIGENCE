import sharp, { type Sharp } from "sharp";
import type { OutputAspectRatio } from "./types";

export interface AspectRatioAdaptationResult {
  outputBuffer: Buffer;
  width: number;
  height: number;
  aspectRatio: number;
}

/**
 * Intelligent Aspect Ratio Normalization & Export Engine
 * Preserves the original aspect ratio by default.
 * When a specific advertising aspect ratio (1:1, 4:5, 9:16, 16:9) is selected,
 * fits 100% of the building facade without stretching, squishing, or cutting off the architecture.
 */
export async function adaptImageToAspectRatio(
  imageBuffer: Buffer,
  targetRatio: OutputAspectRatio,
  options: {
    outputFormat?: "jpeg" | "png" | "webp";
    outputQuality?: number;
    originalWidth?: number;
    originalHeight?: number;
  } = {}
): Promise<AspectRatioAdaptationResult> {
  const { outputFormat = "jpeg", outputQuality = 95 } = options;

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const currentW = metadata.width || 1024;
  const currentH = metadata.height || 1024;
  const currentRatio = currentW / Math.max(1, currentH);

  // If "original" or if target already matches
  if (targetRatio === "original") {
    if (options.originalWidth && options.originalHeight) {
      const srcRatio = options.originalWidth / Math.max(1, options.originalHeight);
      const ratioDelta = Math.abs(currentRatio - srcRatio);

      // If already within 3% tolerance, preserve 100% of the image without any cropping or resizing!
      if (ratioDelta <= 0.03) {
        const output = await image
          .toFormat(outputFormat, { quality: outputQuality })
          .toBuffer();

        return {
          outputBuffer: output,
          width: currentW,
          height: currentH,
          aspectRatio: Number(currentRatio.toFixed(2)),
        };
      }

      // If ratio differs (e.g. fixed generation bucket vs source ratio):
      // Adapt back to source aspect ratio gently centered without aggressive distortion
      let targetW = currentW;
      let targetH = Math.round(targetW / srcRatio);
      if (targetH > currentH) {
        targetH = currentH;
        targetW = Math.round(targetH * srcRatio);
      }

      const adapted = await image
        .resize(targetW, targetH, { fit: "cover", position: "center" })
        .toFormat(outputFormat, { quality: outputQuality })
        .toBuffer();

      return {
        outputBuffer: adapted,
        width: targetW,
        height: targetH,
        aspectRatio: Number((targetW / targetH).toFixed(2)),
      };
    }

    const output = await image
      .toFormat(outputFormat, { quality: outputQuality })
      .toBuffer();

    return {
      outputBuffer: output,
      width: currentW,
      height: currentH,
      aspectRatio: Number(currentRatio.toFixed(2)),
    };
  }

  // Predefined target dimensions for commercial standards
  const TARGET_RESOLUTIONS: Record<Exclude<OutputAspectRatio, "original">, { w: number; h: number; ratio: number }> = {
    "1:1": { w: 1080, h: 1080, ratio: 1.0 },
    "4:5": { w: 1080, h: 1350, ratio: 0.8 },
    "9:16": { w: 1080, h: 1920, ratio: 0.5625 },
    "16:9": { w: 1920, h: 1080, ratio: 1.7778 },
  };

  const target = TARGET_RESOLUTIONS[targetRatio];

  // Proportional resize with center crop — NEVER fit: "fill" (which causes "gepeng" stretching/squashing)
  const adaptedImage: Sharp = image.resize(target.w, target.h, {
    fit: "cover",
    position: "center",
  });

  const outputBuffer = await adaptedImage
    .toFormat(outputFormat, { quality: outputQuality })
    .toBuffer();

  return {
    outputBuffer,
    width: target.w,
    height: target.h,
    aspectRatio: Number((target.w / target.h).toFixed(2)),
  };
}

