import "server-only";

import { getMetaConfig } from "../meta/config";
import type { AspectRatio } from "./types";
import { type AdArchetypeId, getArchetype } from "./ad-archetypes";
import { AdPosterSynthesizer } from "./ad-poster-synthesizer";

export interface MuseImageGenerationParams {
  prompt: string;
  aspectRatio: AspectRatio;
  width?: number;
  height?: number;
  referenceImageUrl?: string;
  previousResponseId?: string;
  negativePrompt?: string;
  fidelityMode?: "preserve_original" | "ai_atmosphere";
  archetypeId?: AdArchetypeId;
  posterMetadata?: {
    projectName: string;
    propertyType?: string;
    propertyLocation?: string;
    startingPrice?: string;
    promoHeadline?: string;
    headline?: string;
    subheadline?: string;
    bedrooms?: string;
    bathrooms?: string;
    buildingArea?: string;
    landArea?: string;
    contactNumber?: string;
    logoDataUrl?: string | null;
    specsText?: string;
  };
}

export interface MuseImageGenerationResult {
  imageUrl: string;
  rawPhotoUrl?: string;
  provider: "muse_image_api" | "ad_poster_synthesizer" | "property_fidelity_engine";
  modelUsed: "muse-image-1.0" | "ad-poster-engine" | "muse-image-fidelity";
  generationTimeMs: number;
  isFallback: boolean;
  responseId?: string;
  imageCallId?: string;
  reasoningSummary?: string;
}

export type StudioAspectRatio = "auto" | "1:1" | "4:5" | "2:3" | "9:16" | "16:9";

export interface StudioImageParams {
  prompt: string;
  images?: string[];
  aspectRatio?: StudioAspectRatio;
  previousResponseId?: string | null;
}

export interface StudioImageResult {
  imageUrl: string;
  responseId: string;
  reasoning?: string;
  aspectRatio: StudioAspectRatio;
  nativeSize: string;
  generationTimeMs: number;
  isFallback: boolean;
}

/**
 * Official Meta Muse Image 1.0 Provider
 * Connects to Meta's agentic image model for text-to-image, reference-based rendering,
 * and conversational multi-turn image refinement with automatic visual grounding.
 */
export class MuseImageProvider {
  public static readonly MODEL_NAME = "muse-image-1.0";

  /**
   * Generates or iteratively refines a property advertisement image using Muse Image 1.0
   * When live Meta Model API is unavailable, synthesizes a complete advertising flyer image
   * matching the 5 Indonesian property ad archetypes with ZERO HTML overlays.
   */
  static async generateImage(
    params: MuseImageGenerationParams
  ): Promise<MuseImageGenerationResult> {
    const startTime = Date.now();
    const config = getMetaConfig({ requireApiKey: false });

    // 1. Check live Meta Model API configuration
    if (config.isConfigured && config.apiKey) {
      try {
        const liveResult = await this.callResponsesApi(config.baseUrl, config.apiKey, params);
        if (liveResult) {
          return {
            ...liveResult,
            generationTimeMs: Date.now() - startTime,
            isFallback: false,
          };
        }
      } catch (err) {
        console.warn("[Muse Image 1.0] Primary Responses API call encountered an error:", err);
        // Fallback to single-shot endpoint if responses API had an issue
        try {
          const singleShotResult = await this.callImagesEndpoint(config.baseUrl, config.apiKey, params);
          if (singleShotResult) {
            return {
              ...singleShotResult,
              generationTimeMs: Date.now() - startTime,
              isFallback: false,
            };
          }
        } catch (singleShotErr) {
          console.warn("[Muse Image 1.0] Single-shot image endpoint error:", singleShotErr);
        }
      }
    }

    // 2. High-Fidelity Ad Poster Graphic Synthesizer (Pure Image Output, Zero HTML DOM)
    const hasReference = Boolean(params.referenceImageUrl && params.referenceImageUrl.trim().length > 0);
    const rawPhotoSource = hasReference && params.referenceImageUrl
      ? params.referenceImageUrl
      : this.getRealisticPropertyPlaceholder(params.aspectRatio);
    const photoUrl = await this.ensureDataUrl(rawPhotoSource);

    // If poster metadata is not provided, return the raw visual backdrop
    if (!params.posterMetadata) {
      return {
        imageUrl: photoUrl,
        provider: "property_fidelity_engine",
        modelUsed: "muse-image-fidelity",
        generationTimeMs: Date.now() - startTime,
        isFallback: true,
        reasoningSummary: "Menggunakan referensi visual properti asli dengan rendering adaptif.",
      };
    }

    const archetypeId = params.archetypeId || "emerald_minimalist";
    const meta = params.posterMetadata;

    try {
      const synthesizedPosterUrl = AdPosterSynthesizer.synthesize({
        archetypeId,
        aspectRatio: params.aspectRatio,
        projectName: meta.projectName,
        propertyType: meta.propertyType,
        propertyLocation: meta.propertyLocation,
        startingPrice: meta.startingPrice,
        promoHeadline: meta.promoHeadline,
        headline: meta.headline,
        subheadline: meta.subheadline,
        bedrooms: meta.bedrooms,
        bathrooms: meta.bathrooms,
        buildingArea: meta.buildingArea,
        landArea: meta.landArea,
        contactNumber: meta.contactNumber,
        photoUrl,
        logoDataUrl: meta.logoDataUrl || null,
        specsText: meta.specsText,
      });

      const archetype = getArchetype(archetypeId);

      return {
        imageUrl: synthesizedPosterUrl,
        rawPhotoUrl: photoUrl,
        provider: "ad_poster_synthesizer",
        modelUsed: "ad-poster-engine",
        generationTimeMs: Date.now() - startTime,
        isFallback: true,
        reasoningSummary: `Flyer iklan utuh dibuat menggunakan arsitektur "${archetype.name}" (${archetype.tag}). Output merupakan full image siap pakai tanpa overlay HTML.`,
      };
    } catch (synthErr) {
      console.warn("[Muse Image 1.0] Fallback synthesis error:", synthErr);
      return {
        imageUrl: photoUrl,
        rawPhotoUrl: photoUrl,
        provider: "property_fidelity_engine",
        modelUsed: "muse-image-fidelity",
        generationTimeMs: Date.now() - startTime,
        isFallback: true,
        reasoningSummary: "Menggunakan referensi visual properti asli dengan rendering adaptif.",
      };
    }
  }

  /**
   * Primary: Calls Meta's Conversational Responses API for Muse Image 1.0
   * Handles text-to-image, reference images, and multi-turn iterative editing.
   */
  private static async callResponsesApi(
    baseUrl: string,
    apiKey: string,
    params: MuseImageGenerationParams
  ): Promise<Omit<MuseImageGenerationResult, "generationTimeMs" | "isFallback"> | null> {
    const size = this.resolveMuseSize(params.aspectRatio);
    let referenceDataUrl: string | undefined = undefined;

    if (params.referenceImageUrl) {
      referenceDataUrl = await this.ensureDataUrl(params.referenceImageUrl);
    }

    // Build Conversational Responses Input Payload
    let inputPayload: unknown;

    if (params.previousResponseId) {
      // Turn 2+: Multi-turn refinement chaining from previous response
      inputPayload = params.prompt;
    } else if (referenceDataUrl) {
      // Reference-based generation: preserve building structure while adapting sky/composition
      const referenceRules = [
        "STRICT ARCHITECTURAL PRESERVATION RULES:",
        "1. PRESERVE 100% OF THE BUILDING STRUCTURE: Keep exact roof geometry, window/door positions, and wall materials from reference.",
        `2. NO CROPPING: Fit the full horizontal facade width cleanly inside the ${params.aspectRatio} frame.`,
        "3. FLEXIBLE SKY ADJUSTMENT: Harmonize upper sky and lighting seamlessly with the building.",
      ].join("\n");

      const brochurePrompt = params.prompt.startsWith("buat jadi brosur properti")
        ? `${params.prompt}\n\n${referenceRules}`
        : `buat jadi brosur properti mempertahankan fasad arsitektur rumah pada gambar referensi ini. ${params.prompt}\n\n${referenceRules}`;

      inputPayload = [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: referenceDataUrl,
            },
            {
              type: "input_text",
              text: brochurePrompt,
            },
          ],
        },
      ];
    } else {
      // Text-to-image mode (pure natural brochure synthesis as in Meta AI playground)
      inputPayload = params.prompt.startsWith("buat jadi brosur properti")
        ? params.prompt
        : `buat jadi brosur properti ${params.prompt}`;
    }

    const requestBody: Record<string, unknown> = {
      model: this.MODEL_NAME,
      input: inputPayload,
      tools: [
        {
          type: "image_generation",
          size,
          output_format: "png",
          reasoning_strength: "high",
        },
      ],
    };

    if (params.previousResponseId) {
      requestBody.previous_response_id = params.previousResponseId;
    }

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(45000), // Generative image requests take 5-20s
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`[Muse Image 1.0] /responses returned ${response.status}:`, errBody);
      return null;
    }

    const json = await response.json();
    const outputArray: Array<{ type: string; id?: string; result?: string; summary?: Array<{ text: string }> }> =
      json.output || [];

    // Extract image generation call
    const imgCall = outputArray.find((item) => item.type === "image_generation_call");
    if (!imgCall?.result) {
      return null;
    }

    // Extract reasoning summary if generated
    const reasoningItem = outputArray.find((item) => item.type === "reasoning");
    const reasoningSummary = reasoningItem?.summary?.map((s) => s.text).join("\n");

    const isPng = imgCall.result.startsWith("iVBORw0KGgo");
    const mime = isPng ? "image/png" : "image/webp";
    const dataUri = imgCall.result.startsWith("data:")
      ? imgCall.result
      : `data:${mime};base64,${imgCall.result}`;

    return {
      imageUrl: dataUri,
      provider: "muse_image_api",
      modelUsed: "muse-image-1.0",
      responseId: json.id,
      imageCallId: imgCall.id,
      reasoningSummary,
    };
  }

  /**
   * Secondary Single-Shot Endpoint (/images/generations & /images/edits)
   */
  private static async callImagesEndpoint(
    baseUrl: string,
    apiKey: string,
    params: MuseImageGenerationParams
  ): Promise<Omit<MuseImageGenerationResult, "generationTimeMs" | "isFallback"> | null> {
    const size = this.resolveMuseSize(params.aspectRatio);

    const endpoint = `${baseUrl}/images/generations`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.MODEL_NAME,
        prompt: params.prompt.startsWith("buat jadi brosur properti")
          ? params.prompt
          : `buat jadi brosur properti ${params.prompt}`,
        n: 1,
        size,
        response_format: "b64_json",
        output_format: "png",
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return null;

    const isPng = b64.startsWith("iVBORw0KGgo");
    const mime = isPng ? "image/png" : "image/webp";

    return {
      imageUrl: `data:${mime};base64,${b64}`,
      provider: "muse_image_api",
      modelUsed: "muse-image-1.0",
      reasoningSummary: "Generated via Muse Image 1.0 single-shot endpoint.",
    };
  }

  /**
   * Resolves aspect ratio generation sizes for Muse Image 1.0
   * Meta Model API supported sizes: 1024x1024 (1:1), 1024x1536 (vertical 4:5 and 9:16), 1536x1024 (landscape)
   */
  public static resolveMuseSize(aspectRatio: AspectRatio): string {
    switch (aspectRatio) {
      case "1:1":
        return "1024x1024";
      case "4:5":
      case "9:16":
      default:
        return "1024x1536";
    }
  }

  /**
   * Converts any image URL (including external URLs) into a base64 data URL
   * to ensure Meta's servers never fail due to CORS or media_url_not_fetchable.
   */
  private static async ensureDataUrl(url: string): Promise<string> {
    if (url.startsWith("data:")) {
      return url;
    }

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) return url;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buffer = await res.arrayBuffer();
      const b64 = Buffer.from(buffer).toString("base64");
      return `data:${contentType};base64,${b64}`;
    } catch {
      return url;
    }
  }

  /**
   * Curated high-res architectural fallback images (uncropped full-width facade)
   */
  private static getRealisticPropertyPlaceholder(aspectRatio: AspectRatio): string {
    switch (aspectRatio) {
      case "1:1":
        return "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=max&w=1440&q=85";
      case "9:16":
        return "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=max&w=1440&q=85";
      case "4:5":
      default:
        return "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=max&w=1440&q=85";
    }
  }

  /**
   * Resolves ratio to native size for conversational studio
   */
  public static resolveStudioSize(ratio: StudioAspectRatio = "auto"): string {
    switch (ratio) {
      case "1:1":
        return "1024x1024";
      case "4:5":
      case "2:3":
      case "9:16":
        return "1024x1536";
      case "16:9":
        return "1536x1024";
      case "auto":
      default:
        return "auto";
    }
  }

  /**
   * Curated fallback images for studio
   */
  public static getStudioFallbackImage(ratio: StudioAspectRatio = "auto"): string {
    switch (ratio) {
      case "1:1":
        return "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=max&w=1440&q=85";
      case "16:9":
        return "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=max&w=1920&q=85";
      case "9:16":
      case "4:5":
      case "2:3":
      case "auto":
      default:
        return "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=max&w=1440&q=85";
    }
  }

  /**
   * Pure Conversational Generation & Revision via Meta Muse Image 1.0 (/responses)
   */
  static async generateStudioImage(
    params: StudioImageParams
  ): Promise<StudioImageResult> {
    const startTime = Date.now();
    const config = getMetaConfig({ requireApiKey: false });
    const ratio = params.aspectRatio || "auto";
    const nativeSize = this.resolveStudioSize(ratio);

    // 1. Process attached images into base64 Data URLs
    const processedImages: string[] = [];
    if (params.images && params.images.length > 0) {
      for (const imgUrl of params.images) {
        if (imgUrl && imgUrl.trim()) {
          try {
            const dataUrl = await this.ensureDataUrl(imgUrl.trim());
            processedImages.push(dataUrl);
          } catch {
            // Skip invalid image
          }
        }
      }
    }

    // 2. Build structured multimodal prompt
    let promptText = params.prompt.trim();
    if (processedImages.length > 0) {
      promptText = `[CRITICAL ARCHITECTURAL REFERENCE PRESERVATION]
Analyze and preserve the real architectural geometry, building facade, roofline, window placements, and structural proportions of the provided property image.
Translate this property into a world-class, agency-grade real estate advertisement suited for the requested aspect ratio without destructive cropping.
User design directive: ${params.prompt.trim()}`;
    }

    // 3. Connect to live Meta Responses API
    if (config.isConfigured && config.apiKey) {
      try {
        const inputContent: Array<{ type: "input_image" | "input_text"; image_url?: string; text?: string }> = [];
        for (const dataUrl of processedImages) {
          inputContent.push({
            type: "input_image",
            image_url: dataUrl,
          });
        }
        inputContent.push({
          type: "input_text",
          text: promptText,
        });

        const requestBody: Record<string, unknown> = {
          model: this.MODEL_NAME,
          input: [
            {
              role: "user",
              content: inputContent,
            },
          ],
          tools: [
            {
              type: "image_generation",
              size: nativeSize,
              output_format: "webp",
              reasoning_strength: "high",
            },
          ],
        };

        if (params.previousResponseId && params.previousResponseId.trim()) {
          requestBody.previous_response_id = params.previousResponseId.trim();
        }

        const response = await fetch(`${config.baseUrl}/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(50000),
        });

        if (response.ok) {
          const json = await response.json();
          const outputArray: Array<{ type: string; id?: string; result?: string; summary?: Array<{ text: string }> }> =
            json.output || [];

          const imgCall = outputArray.find((item) => item.type === "image_generation_call");
          if (imgCall?.result) {
            const reasoningItem = outputArray.find((item) => item.type === "reasoning");
            const reasoningSummary = reasoningItem?.summary?.map((s) => s.text).join("\n");

            const isPng = imgCall.result.startsWith("iVBORw0KGgo");
            const mime = isPng ? "image/png" : "image/webp";
            const dataUri = imgCall.result.startsWith("data:")
              ? imgCall.result
              : `data:${mime};base64,${imgCall.result}`;

            return {
              imageUrl: dataUri,
              responseId: json.id || `resp_${Date.now()}`,
              reasoning: reasoningSummary,
              aspectRatio: ratio,
              nativeSize,
              generationTimeMs: Date.now() - startTime,
              isFallback: false,
            };
          }
        } else {
          const errText = await response.text();
          console.warn(`[Muse Image 1.0] Studio /responses returned ${response.status}:`, errText);
        }
      } catch (err) {
        console.warn("[Muse Image 1.0] generateStudioImage error:", err);
      }
    }

    // 4. Reliable Offline / Fallback Result
    const fallbackImage = processedImages[0] || this.getStudioFallbackImage(ratio);
    return {
      imageUrl: fallbackImage,
      responseId: `fallback_${Date.now()}`,
      reasoning: "Studio fallback generator.",
      aspectRatio: ratio,
      nativeSize,
      generationTimeMs: Date.now() - startTime,
      isFallback: true,
    };
  }
}
