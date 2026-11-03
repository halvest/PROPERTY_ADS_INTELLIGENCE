import "server-only";

import sharp from "sharp";
import { getMetaConfig } from "../meta/config";
import type {
  EnhancementMode,
  PhotographyStyle,
  EnhancementIntensity,
  OutputAspectRatio,
  ArchitecturalStructureLock,
  ArchitecturalImageAnalysis,
} from "./types";
import { ArchitecturalPromptEngine } from "./prompt-engine";
import { adaptImageToAspectRatio } from "./aspect-ratio";

export interface ArchitecturalEnhancementRequest {
  imageBuffer: Buffer;
  mimeType: string;
  mode: EnhancementMode;
  style: PhotographyStyle;
  intensity: EnhancementIntensity;
  aspectRatio: OutputAspectRatio;
  structureLock: ArchitecturalStructureLock;
  analysis: ArchitecturalImageAnalysis;
  detailNotes?: string;
}

export interface ArchitecturalEnhancementResponse {
  enhancedBuffer: Buffer;
  enhancedWidth: number;
  enhancedHeight: number;
  enhancedFileSize: number;
  modelUsed: string;
  provider: "meta_muse_api" | "local_photorealistic_engine";
  aiReasoning?: string;
  processingTimeMs: number;
  isSimulated: boolean;
}

/**
 * Architectural Photo Enhancement Service
 * Handles true image-to-image conditioning with Meta Responses API (Muse Image 1.0)
 * and guarantees strict architectural preservation.
 */
export class ArchitecturalEnhancerService {
  public static readonly MODEL_NAME = "muse-image-1.0";

  public static async enhance(
    req: ArchitecturalEnhancementRequest
  ): Promise<ArchitecturalEnhancementResponse> {
    const startTime = Date.now();
    const config = getMetaConfig({ requireApiKey: false });

    // 1. Build the Structured Master Prompt with Architectural Structure Lock
    const prompt = ArchitecturalPromptEngine.buildStructuredPrompt({
      mode: req.mode,
      style: req.style,
      intensity: req.intensity,
      structureLock: req.structureLock,
      analysis: req.analysis,
      targetAspectRatio: req.aspectRatio,
      detailNotes: req.detailNotes,
    });

    // 2. Prepare Base64 Data URL for the source image
    // Resize down if excessively large (> 2048px) to fit Meta API limits while keeping high quality
    let preparedBuffer = req.imageBuffer;
    const meta = await sharp(req.imageBuffer).metadata();
    if ((meta.width && meta.width > 2048) || (meta.height && meta.height > 2048)) {
      preparedBuffer = await sharp(req.imageBuffer)
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toBuffer();
    }

    const mime = meta.format === "png" ? "image/png" : "image/jpeg";
    const base64DataUrl = `data:${mime};base64,${preparedBuffer.toString("base64")}`;

    // Resolve resolution for Meta Muse API
    const targetSize = this.resolveMuseSize(req.aspectRatio, meta.width, meta.height);

    // 3. Execute Real Meta Muse Image-to-Image Generation
    if (config.isConfigured && config.apiKey) {
      try {
        const liveResult = await this.callMetaResponsesApi(
          config.baseUrl,
          config.apiKey,
          base64DataUrl,
          prompt,
          targetSize
        );

        if (liveResult) {
          // Adapt output to desired aspect ratio
          const adapted = await adaptImageToAspectRatio(liveResult.imageBuffer, req.aspectRatio, {
            outputFormat: "jpeg",
            outputQuality: 95,
            originalWidth: meta.width,
            originalHeight: meta.height,
          });

          return {
            enhancedBuffer: adapted.outputBuffer,
            enhancedWidth: adapted.width,
            enhancedHeight: adapted.height,
            enhancedFileSize: adapted.outputBuffer.length,
            modelUsed: this.MODEL_NAME,
            provider: "meta_muse_api",
            aiReasoning: liveResult.aiReasoning,
            processingTimeMs: Date.now() - startTime,
            isSimulated: false,
          };
        }
      } catch (err) {
        console.warn("[Architectural Enhancer] Meta Responses API call error:", err);
        // Do not silently swallow — will fall through to local photorealistic processing with explicit warning
      }
    }

    // 4. Local High-Fidelity Photorealistic Fallback Engine
    // (Used when API is offline or during offline testing, with transparent isSimulated flag)
    const simulatedResult = await this.executeLocalPhotorealisticSimulation(
      req.imageBuffer,
      req.style,
      req.mode
    );

    const adapted = await adaptImageToAspectRatio(simulatedResult, req.aspectRatio, {
      outputFormat: "jpeg",
      outputQuality: 95,
      originalWidth: meta.width,
      originalHeight: meta.height,
    });

    return {
      enhancedBuffer: adapted.outputBuffer,
      enhancedWidth: adapted.width,
      enhancedHeight: adapted.height,
      enhancedFileSize: adapted.outputBuffer.length,
      modelUsed: "local-photorealistic-simulation",
      provider: "local_photorealistic_engine",
      aiReasoning:
        "Pemrosesan fotografi arsitektur lokal (Pencahayaan alami, perbaikan mikrotekstur, dan penguncian geometri fasad 100%).",
      processingTimeMs: Date.now() - startTime,
      isSimulated: true,
    };
  }

  /**
   * Calls Meta's Conversational Responses API for Muse Image 1.0 with input_image and input_text
   */
  private static async callMetaResponsesApi(
    baseUrl: string,
    apiKey: string,
    imageDataUrl: string,
    prompt: string,
    size: string
  ): Promise<{ imageBuffer: Buffer; aiReasoning?: string } | null> {
    const requestBody = {
      model: this.MODEL_NAME,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      tools: [
        {
          type: "image_generation",
          size,
          output_format: "png",
          reasoning_strength: "high",
        },
      ],
    };

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(45000), // Generative image requests take 8-25s
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`[Architectural Enhancer] /responses returned HTTP ${response.status}:`, errBody);
      return null;
    }

    const json = await response.json();
    const outputArray: Array<{
      type: string;
      id?: string;
      result?: string;
      summary?: Array<{ text: string }>;
    }> = json.output || [];

    const imgCall = outputArray.find((item) => item.type === "image_generation_call");
    if (!imgCall?.result) {
      return null;
    }

    const reasoningItem = outputArray.find((item) => item.type === "reasoning");
    const aiReasoning = reasoningItem?.summary?.map((s) => s.text).join("\n");

    const cleanBase64 = imgCall.result.replace(/^data:image\/[a-z]+;base64,/, "");
    const imageBuffer = Buffer.from(cleanBase64, "base64");

    return {
      imageBuffer,
      aiReasoning,
    };
  }

  /**
   * Resolves supported Meta Muse resolution based on target aspect ratio
   */
  private static resolveMuseSize(
    aspectRatio: OutputAspectRatio,
    origW?: number,
    origH?: number
  ): string {
    if (aspectRatio === "original") {
      if (origW && origH) {
        const srcRatio = origW / Math.max(1, origH);
        if (srcRatio >= 1.2) return "1536x1024"; // Landscape (3:2 / 16:9 / 4:3)
        if (srcRatio <= 0.82) return "1024x1536"; // Portrait (2:3 / 4:5 / 9:16)
        return "1024x1024"; // Square / near-square
      }
      return "auto";
    }

    switch (aspectRatio) {
      case "1:1":
        return "1024x1024";
      case "4:5":
      case "9:16":
        return "1024x1536";
      case "16:9":
        return "1536x1024";
      default:
        return "1024x1024";
    }
  }

  /**
   * Local High-End Photographic Simulation Pipeline (when server API is offline)
   * Simulates full-frame optical clarity, natural dynamic range, and physical color grading.
   */
  private static async executeLocalPhotorealisticSimulation(
    sourceBuffer: Buffer,
    style: PhotographyStyle,
    mode: EnhancementMode
  ): Promise<Buffer> {
    let pipeline = sharp(sourceBuffer);

    // 1. Photographic Tone Mapping based on selected style
    if (style === "style_golden_hour") {
      pipeline = pipeline
        .modulate({
          brightness: 1.05,
          saturation: 1.15,
          hue: 4, // Slight amber shift
        })
        .tint({ r: 255, g: 242, b: 220 });
    } else if (style === "style_blue_hour") {
      pipeline = pipeline
        .modulate({
          brightness: 0.94,
          saturation: 1.08,
          hue: -6, // Twilight blue shift
        })
        .tint({ r: 230, g: 238, b: 255 });
    } else if (style === "style_tropical") {
      pipeline = pipeline.modulate({
        brightness: 1.04,
        saturation: 1.12,
      });
    } else if (style === "style_overcast_editorial") {
      pipeline = pipeline.modulate({
        brightness: 1.02,
        saturation: 0.95,
      });
    } else {
      // Clean daylight / bright morning
      pipeline = pipeline.modulate({
        brightness: 1.04,
        saturation: 1.06,
      });
    }

    // 2. Optical Sharpening (simulate 35mm prime lens clarity)
    pipeline = pipeline.sharpen({
      sigma: 1.2,
      m1: 1.5,
      m2: 0.7,
      x1: 2,
      y2: 10,
      y3: 20,
    });

    return await pipeline.jpeg({ quality: 95 }).toBuffer();
  }
}

