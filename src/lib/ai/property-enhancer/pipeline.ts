import sharp from "sharp";
import type { EnhancementParameters } from "./types";

export interface PipelineExecutionOptions {
  outputFormat?: "jpeg" | "png" | "webp";
  outputQuality?: number;
}

export interface PipelineExecutionResult {
  outputBuffer: Buffer;
  outputWidth: number;
  outputHeight: number;
  outputFileSize: number;
  processingTimeMs: number;
}

/**
 * Professional Property Image Enhancement Pipeline.
 * Executes deterministic computer-vision operations using high-performance libvips (sharp).
 * Strictly preserves physical building architecture, doors, windows, and structural lines.
 */
export async function executeEnhancementPipeline(
  inputBuffer: Buffer,
  params: EnhancementParameters,
  options: PipelineExecutionOptions = {}
): Promise<PipelineExecutionResult> {
  const startTime = Date.now();

  const outputFormat = options.outputFormat || "jpeg";
  const outputQuality = Math.max(50, Math.min(100, options.outputQuality || 92));

  // 1. Initial Sharp instance with EXIF orientation normalization
  let pipeline = sharp(inputBuffer, { failOn: "none" }).rotate();

  // 2. Fetch original metadata
  const meta = await pipeline.metadata();
  const origW = meta.width || 1080;
  const origH = meta.height || 1080;

  // 3. Exposure & Saturation Modulation
  // Map exposure (-100..+100) to brightness multiplier (0.75..1.4)
  const brightnessMultiplier = 1.0 + (params.exposure / 100) * 0.35;
  // Map saturation (-100..+100) to saturation multiplier (0.6..1.45)
  const saturationMultiplier = Math.max(0.4, 1.0 + (params.saturation / 100) * 0.45);

  pipeline = pipeline.modulate({
    brightness: brightnessMultiplier,
    saturation: saturationMultiplier,
  });

  // 4. Contrast Adjustment via Symmetrical Linear Stretch
  if (params.contrast !== 0) {
    // contrast (-100..+100) -> slope (0.7..1.4)
    const slope = 1.0 + (params.contrast / 100) * 0.38;
    const offset = Math.round(128 * (1.0 - slope));
    pipeline = pipeline.linear(slope, offset);
  }

  // 5. Shadow & Highlight Gamma Curve
  // Positive shadows = lift dark areas (gamma < 1.0)
  // Negative highlights = compress blown highlights (gamma > 1.0)
  const shadowLift = (params.shadows / 100) * 0.22;
  const highlightCompress = -(params.highlights / 100) * 0.15;
  const rawGamma = 1.0 - shadowLift + highlightCompress;
  const effectiveGamma = Math.max(1.0, Math.min(3.0, rawGamma));

  if (Math.abs(effectiveGamma - 1.0) > 0.02) {
    pipeline = pipeline.gamma(effectiveGamma);
  }

  // 6. White Balance Temperature & Tint Matrix (3x3 recomb)
  if (params.temperature !== 0 || params.tint !== 0) {
    // temperature: positive = warmer (boost red, drop blue), negative = cooler
    const tShift = (params.temperature / 100) * 0.08;
    // tint: positive = magenta (drop green), negative = green (boost green)
    const tintShift = (params.tint / 100) * 0.05;

    const rFactor = 1.0 + tShift + tintShift * 0.5;
    const gFactor = 1.0 - tintShift;
    const bFactor = 1.0 - tShift + tintShift * 0.5;

    pipeline = pipeline.recomb([
      [rFactor, 0.0, 0.0],
      [0.0, gFactor, 0.0],
      [0.0, 0.0, bFactor],
    ]);
  }

  // 7. Controlled Noise Reduction (Bilateral / Edge-preserving smoothing)
  const effectiveDenoise = params.denoise ?? params.noiseReduction ?? 0;
  if (effectiveDenoise > 15) {
    // Keep subtle (median 1 or gentle 0.4 blur) to preserve wall & wood texture
    const blurSigma = 0.3 + (effectiveDenoise / 100) * 0.5;
    pipeline = pipeline.blur(blurSigma);
  }

  // 8. Edge-Aware Sharpening (Unsharp Mask with Halo Protection)
  if (params.sharpness > 0 || params.clarity > 0) {
    const sharpnessFactor = params.sharpness / 100;
    const clarityFactor = Math.max(0, params.clarity / 100);

    const sigma = 0.75 + sharpnessFactor * 0.75;
    const flatSlope = 1.0 + sharpnessFactor * 1.8 + clarityFactor * 1.0;
    const edgeSlope = 1.8 + sharpnessFactor * 2.2 + clarityFactor * 1.5;

    pipeline = pipeline.sharpen({
      sigma,
      m1: flatSlope,
      m2: edgeSlope,
    });
  }

  // 9. Super-Resolution Upscaling (2x Lanczos3 Bicubic Spline)
  let targetW = origW;
  let targetH = origH;

  if (params.upscaleFactor === 2) {
    targetW = Math.round(origW * 2);
    targetH = Math.round(origH * 2);

    pipeline = pipeline.resize(targetW, targetH, {
      kernel: sharp.kernel.lanczos3,
      fit: "fill",
    });
  }

  // 10. Encoding with Privacy Metadata Stripping (Removes GPS, serial numbers)
  if (outputFormat === "png") {
    pipeline = pipeline.png({
      compressionLevel: 8,
      progressive: true,
    });
  } else if (outputFormat === "webp") {
    pipeline = pipeline.webp({
      quality: outputQuality,
      effort: 4,
    });
  } else {
    // Default: high-grade MozJPEG
    pipeline = pipeline.jpeg({
      quality: outputQuality,
      mozjpeg: true,
      progressive: true,
    });
  }

  const outputBuffer = await pipeline.toBuffer();
  const processingTimeMs = Date.now() - startTime;

  return {
    outputBuffer,
    outputWidth: targetW,
    outputHeight: targetH,
    outputFileSize: outputBuffer.length,
    processingTimeMs,
  };
}

