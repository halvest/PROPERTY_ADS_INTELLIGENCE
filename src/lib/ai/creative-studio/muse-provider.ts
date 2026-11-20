import "server-only";

import { getMetaConfig } from "../meta/config";
import type { AspectRatio } from "./types";
import sharp from "sharp";
import { type AdArchetypeId, getArchetype, inferArchetypeFromBrief } from "./ad-archetypes";
import { NaturalLanguageBriefParser } from "./brief-parser";
import { AdPosterSynthesizer } from "./ad-poster-synthesizer";
import { composeStudioAdPrompt, type StudioAdReadiness } from "./studio-ad-prompt";
import { renderAgencyAd, type AgencyConcept } from "./agency/render";
import { measureFacadePhoto } from "./facade-measure";
import { resolveFacadePlacement } from "./facade-placement";
import { fallbackDesignPlan, parseDesignPlan, sparkAnalysisPrompt, type PlanRatio } from "./design-plan";
import { compareAboveBottomField, compareAtmosphereEdit } from "./atmosphere-check";
import { composeWithMuseImage } from "./muse-creative/compose";
import { stampConceptLabel } from "./muse-creative/concept-label";
import {
  buildIntegratedAdPrompt,
  museSizeForRatio,
  refinementPrompt,
  type CreativeDirectionId,
} from "./muse-creative/directions";
import { segmentConcept, type SegmentBox } from "./muse-creative/sam";
import { chooseStudioRoute } from "./muse-creative/route";
import { acceptPhotographicEdit, buildConceptPrompt, buildPhotographyPrompt, chooseStudioOperation, requestNeedsListingType } from "./muse-creative/operation";
import { META_MODELS } from "./muse-creative/registry";
import { assignReferenceRoles, buildCritiquePrompt, parseVisualCritique, usableCorrection, type ModelRun } from "./muse-creative/critic";
import { buildCampaignPrompt, conceptsAreDistinct, parseCampaignConcepts, rankConcepts, type CampaignConcept } from "./muse-creative/art-direction";

function overlayForDirection(direction: CreativeDirectionId): AgencyConcept {
  if (direction === "premium_editorial") return "editorial_sky";
  if (direction === "architectural_portfolio") return "facade_minimal";
  return "commercial";
}

function localizedEditPrompt(kind: "sky" | "vehicle", boxes: SegmentBox[], request: string): string {
  const where = boxes
    .map((box) => `${box.x1},${box.y1} to ${box.x2},${box.y2} on ${box.sourceWidth}x${box.sourceHeight}`)
    .join("; ");
  if (kind === "sky") {
    return [
      "Change only the open sky. The SAM box is a search region and it includes the roof, so do not recolor the roof, walls, or windows inside it.",
      where,
      request.trim(),
      "Keep the building, cars, and camera. No text.",
    ].join(" ");
  }
  return [
    "Remove only the cars inside these SAM 3.1 regions and continue the paving:",
    where,
    request.trim(),
    "Keep the building, roof, windows, door, and camera. No text.",
  ].join(" ");
}

function asPlanRatio(ratio: StudioAspectRatio): PlanRatio {
  if (ratio === "1:1" || ratio === "9:16" || ratio === "16:9") return ratio;
  return "4:5";
}

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
  creativeContext?: string;
  userPreferences?: string[];
  projectContext?: string;
  creativeDirection?: CreativeDirectionId;
}

export interface StudioImageResult {
  imageUrl: string;
  responseId: string;
  reasoning?: string;
  aspectRatio: StudioAspectRatio;
  nativeSize: string;
  generationTimeMs: number;
  isFallback: boolean;
  provider?: string;
  modelUsed?: string;
  fallbackReason?: string;
  modelLog?: ModelRun[];
  artDirections?: CampaignConcept[];
  adFacts?: StudioAdReadiness;
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
        "FACADE LOCK, ATMOSPHERE OPEN:",
        "1. LOCK the building structure, facade design, and materials. Do not redesign the house.",
        `2. Fit the full facade inside the ${params.aspectRatio} frame without cropping the roof.`,
        "3. Sky, daylight, cars, and one quiet family activity may be improved so the scene feels like one professional advertisement.",
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
   * Curated high-res architectural photos mapped to Indonesian property ad archetypes
   */
  public static getCuratedArchetypePhoto(archetypeId: AdArchetypeId): string {
    switch (archetypeId) {
      case "emerald_minimalist":
        return "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=max&w=1440&q=85";
      case "luxury_architecture":
        return "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=max&w=1440&q=85";
      case "royal_navy_metro":
        return "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=max&w=1440&q=85";
      case "golden_aurora_wave":
        return "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=max&w=1440&q=85";
      case "kaba_direct_offer":
      default:
        return "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=max&w=1440&q=85";
    }
  }

  /**
   * High-Fidelity Optical Tone Mapping for Property Ad Photos via Sharp
   */
  public static async applyArchetypeToneMapping(
    imageBuffer: Buffer,
    archetypeId: AdArchetypeId
  ): Promise<Buffer> {
    let pipeline = sharp(imageBuffer);

    switch (archetypeId) {
      case "golden_aurora_wave":
        pipeline = pipeline
          .modulate({
            brightness: 1.05,
            saturation: 1.15,
            hue: 4,
          })
          .tint({ r: 255, g: 242, b: 220 });
        break;
      case "luxury_architecture":
        pipeline = pipeline.modulate({
          brightness: 0.98,
          saturation: 1.08,
        });
        break;
      case "emerald_minimalist":
        pipeline = pipeline.modulate({
          brightness: 1.04,
          saturation: 1.08,
        });
        break;
      case "royal_navy_metro":
        pipeline = pipeline.modulate({
          brightness: 1.02,
          saturation: 1.06,
        });
        break;
      case "kaba_direct_offer":
      default:
        pipeline = pipeline.modulate({
          brightness: 1.05,
          saturation: 1.12,
        });
        break;
    }

    pipeline = pipeline.sharpen({
      sigma: 1.1,
      m1: 1.3,
      m2: 0.6,
    });

    return await pipeline.jpeg({ quality: 95 }).toBuffer();
  }

  /**
   * Conversational State Decoder for Multi-Turn Session Memory
   */
  private static decodeConversationState(
    token?: string | null
  ): Record<string, any> | null {
    if (!token || !token.startsWith("st_")) return null;
    try {
      const raw = token.slice(3);
      const json = Buffer.from(raw, "base64url").toString("utf-8");
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * Conversational State Encoder for Multi-Turn Session Memory
   */
  private static encodeConversationState(state: Record<string, any>): string {
    try {
      const json = JSON.stringify(state);
      return `st_${Buffer.from(json, "utf-8").toString("base64url")}`;
    } catch {
      return `resp_${Date.now()}`;
    }
  }

  /**
   * Pure Conversational Generation & Revision via Meta Muse Image 1.0 (/responses)
   * Improves sky, light, cars, and a quiet human presence.
   * The building structure, materials, and facade design stay locked.
   * Returns a photograph with no advertising text.
   */
  private static async designCampaignPoster(
    baseUrl: string,
    apiKey: string,
    photoDataUrl: string,
    prompt: string,
    size: string
  ): Promise<string | null> {
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.MODEL_NAME,
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: photoDataUrl },
              { type: "input_text", text: prompt },
            ],
          },
        ],
        tools: [
          {
            type: "image_generation",
            size,
            output_format: "webp",
            reasoning_strength: "high",
          },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const outputArray: Array<{ type: string; result?: string }> = json.output || [];
    const imgCall = outputArray.find((item) => item.type === "image_generation_call");
    if (!imgCall?.result) return null;
    const isPng = imgCall.result.startsWith("iVBORw0KGgo");
    const mime = isPng ? "image/png" : "image/webp";
    return imgCall.result.startsWith("data:") ? imgCall.result : `data:${mime};base64,${imgCall.result}`;
  }

  private static async askSpark(baseUrl: string, apiKey: string, photoDataUrl: string, prompt: string, timeoutMs = 25000): Promise<string | null> {
    try {
      const response = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: META_MODELS.spark.id,
          input: [
            {
              role: "user",
              content: [
                { type: "input_image", image_url: photoDataUrl },
                { type: "input_text", text: prompt },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      const json = await response.json();
      if (typeof json.output_text === "string") return json.output_text;
      const output = Array.isArray(json.output) ? json.output : [];
      const chunks: string[] = [];
      for (const item of output) {
        if (typeof item?.text === "string") chunks.push(item.text);
        if (Array.isArray(item?.content)) {
          for (const part of item.content) {
            if (typeof part?.text === "string") chunks.push(part.text);
          }
        }
      }
      return chunks.join("\n") || null;
    } catch (err) {
      console.warn("[Muse Spark] Photo analysis failed, measurement plan is used:", err);
      return null;
    }
  }

  /**
   * With Agency-Grade Fallback Synthesizer Rendering Pure High-Density Ad Flyers
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

    // 2. Build structured multimodal prompt for Meta API
    // 2. Lock brochure facts before calling Muse Image 1.0
    const adFacts = composeStudioAdPrompt({
      userPrompt: params.prompt,
      aspectRatio: ratio,
      hasReference: processedImages.length > 0,
      isRevision: Boolean(params.previousResponseId),
    });
    let promptText = adFacts.prompt;

    if (processedImages.length > 0) {
      const route = chooseStudioRoute({
        prompt: params.prompt,
        imageCount: processedImages.length,
        previousResponseId: params.previousResponseId,
      });
      if ((route.route === "sky" || route.route === "vehicle") && config.isConfigured && config.apiKey) {
        const concept = route.route === "sky" ? "sky" : "car";
        const segmented = await segmentConcept({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          imageDataUrl: processedImages[0],
          concept,
        });
        const boxes = segmented.ok ? segmented.boxes : [];
        if (boxes.length === 0) {
          return {
            imageUrl: processedImages[0],
            responseId: this.encodeConversationState({ v: 4, layout: route.route, aspectRatio: asPlanRatio(ratio) }),
            reasoning: segmented.ok
              ? `SAM 3.1 tidak menemukan ${concept} pada foto ini, jadi bangunan tidak diubah.`
              : `Segmentasi gagal: ${segmented.reason}. Foto asli dikembalikan.`,
            aspectRatio: asPlanRatio(ratio),
            nativeSize: museSizeForRatio(asPlanRatio(ratio)),
            generationTimeMs: Date.now() - startTime,
            isFallback: true,
            provider: "sam_3.1",
            modelUsed: "sam-3.1",
            adFacts,
          };
        }
        const edited = await composeWithMuseImage({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          photoDataUrl: processedImages[0],
          instruction: localizedEditPrompt(route.route, boxes, params.prompt),
          size: museSizeForRatio(asPlanRatio(ratio)),
        });
        if (edited.ok) {
          const originalBytes = Buffer.from(processedImages[0].replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""), "base64");
          const editedBytes = Buffer.from(edited.imageUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""), "base64");
          const verdict = await compareAtmosphereEdit(originalBytes, editedBytes);
          const keep = verdict.accepted || acceptPhotographicEdit(verdict);
          return {
            imageUrl: keep ? edited.imageUrl : processedImages[0],
            responseId: edited.responseId,
            reasoning: keep
              ? `SAM 3.1 menemukan ${boxes.length} ${concept}. Muse Image mengubah hanya bagian itu.`
              : `Edit ditolak karena bangunan berubah: ${verdict.reason}`,
            aspectRatio: asPlanRatio(ratio),
            nativeSize: museSizeForRatio(asPlanRatio(ratio)),
            generationTimeMs: Date.now() - startTime,
            isFallback: !keep,
            provider: keep ? "sam_3.1+muse_image" : "original_photo",
            modelUsed: "muse-image-1.0",
            adFacts,
          };
        }
      }
      const operation = chooseStudioOperation({
        prompt: params.prompt,
        imageCount: processedImages.length,
        previousResponseId: params.previousResponseId,
      });
      if ((operation === "photography" || operation === "concept") && config.isConfigured && config.apiKey) {
        const frame = asPlanRatio(ratio);
        const instruction = operation === "concept" ? buildConceptPrompt(params.prompt) : buildPhotographyPrompt(params.prompt);
        const composed = await composeWithMuseImage({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          photoDataUrl: processedImages[0],
          instruction,
          size: museSizeForRatio(frame),
        });
        if (composed.ok && operation === "photography") {
          const originalBytes = Buffer.from(processedImages[0].replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""), "base64");
          const editedBytes = Buffer.from(composed.imageUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""), "base64");
          const verdict = await compareAtmosphereEdit(originalBytes, editedBytes);
          const keep = verdict.accepted || acceptPhotographicEdit(verdict);
          return {
            imageUrl: keep ? composed.imageUrl : processedImages[0],
            responseId: composed.responseId,
            reasoning: keep
              ? "Muse Image mengedit fotonya. Bangunan tetap, dan tidak ada teks iklan yang ditambahkan."
              : `Edit ditolak karena bangunan berubah: ${verdict.reason} Foto asli dikembalikan.`,
            aspectRatio: frame,
            nativeSize: museSizeForRatio(frame),
            generationTimeMs: Date.now() - startTime,
            isFallback: !keep,
            provider: keep ? "muse_image_photography" : "original_photo",
            modelUsed: META_MODELS.image.id,
            adFacts,
          };
        }
        if (composed.ok && operation === "concept") {
          const labeled = await stampConceptLabel(composed.imageUrl);
          return {
            imageUrl: labeled,
            responseId: composed.responseId,
            reasoning: "Ini konsep arsitektur, bukan foto properti yang sudah ada.",
            aspectRatio: frame,
            nativeSize: museSizeForRatio(frame),
            generationTimeMs: Date.now() - startTime,
            isFallback: false,
            provider: "muse_image_concept",
            modelUsed: META_MODELS.image.id,
            adFacts,
          };
        }
      }
      const payload = processedImages[0].replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
      const measured = await measureFacadePhoto(Buffer.from(payload, "base64")).catch(() => null);
      const placement = measured
        ? resolveFacadePlacement(measured, ratio)
        : resolveFacadePlacement({ width: 1080, height: 1350, aspect: 0.8, skyFraction: 0.2 }, ratio === "auto" ? "4:5" : ratio);
      let plan = fallbackDesignPlan(placement);
      const modelLog: ModelRun[] = [];
      if (config.isConfigured && config.apiKey) {
        const sparkStarted = Date.now();
        const sparkText = await this.askSpark(config.baseUrl, config.apiKey, processedImages[0], sparkAnalysisPrompt(placement));
        modelLog.push({
          model: "muse-spark-1.3",
          task: "Rencana komposisi",
          status: sparkText ? "completed" : "failed",
          durationMs: Date.now() - sparkStarted,
          output: sparkText ? "Rencana format diterima dari foto." : "Rencana pengukuran dipakai.",
          error: sparkText ? undefined : "Tidak ada jawaban.",
        });
        if (sparkText) plan = parseDesignPlan(sparkText, placement);
      }
      const direction = params.creativeDirection || (plan.visual_analysis.sky_suitable_for_type ? "premium_editorial" : "commercial_performance");
      const cameraNote = plan.visual_analysis.camera_accepted
        ? `The camera is ${plan.visual_analysis.camera_angle}. Keep that camera.`
        : "The camera angle is not verified. Keep the photograph's camera exactly.";
      let photoForType = processedImages[0];
      let museResponseId: string | null = null;
      let editNote = "Foto asli dipertahankan karena komposisi Muse tidak tersedia.";
      let artDirections: CampaignConcept[] | undefined;
      let directionNote: string | undefined;
      if (config.isConfigured && config.apiKey) {
        const directionStarted = Date.now();
        const directionPrompt = buildCampaignPrompt({
          ratio: plan.creative_direction.aspect_ratio,
          conceptCount: 3,
          photoNote: `${cameraNote} Sky occupies about ${Math.round((measured?.skyFraction ?? 0.3) * 100)} percent of the photograph.`,
        });
        let directionText = await this.askSpark(config.baseUrl, config.apiKey, processedImages[0], directionPrompt, 90000);
        let concepts = directionText ? parseCampaignConcepts(directionText) : null;
        if (concepts && concepts.length >= 3 && !conceptsAreDistinct(concepts)) {
          const retryText = await this.askSpark(
            config.baseUrl,
            config.apiKey,
            processedImages[0],
            `${directionPrompt}\nThe previous concepts were too alike. Change the grid, the type scale, and where the words sit.`,
            90000,
          );
          const retried = retryText ? parseCampaignConcepts(retryText) : null;
          if (retried && conceptsAreDistinct(retried)) concepts = retried;
        }
        const distinct = concepts ? conceptsAreDistinct(concepts) : false;
        modelLog.push({
          model: "muse-spark-1.3",
          task: "Arah kreatif",
          status: concepts && concepts.length >= 3 ? "completed" : "failed",
          durationMs: Date.now() - directionStarted,
          output: concepts && concepts.length >= 3
            ? concepts.map((item) => item.title).join(" · ")
            : "Tiga konsep tidak terbaca.",
          error: concepts && concepts.length >= 3
            ? distinct ? undefined : "Struktur konsep masih terlalu mirip."
            : "Jawaban model tidak berisi tiga konsep.",
        });
        if (concepts && concepts.length > 0) {
          artDirections = rankConcepts(concepts, plan.creative_direction.aspect_ratio, measured?.skyFraction ?? 0.3);
          directionNote = artDirections[0]?.composition;
        }
      }
      if (config.isConfigured && config.apiKey) {
        const extraRoles = assignReferenceRoles(processedImages.length).slice(1);
        const imageStarted = Date.now();
        const composed = await composeWithMuseImage({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          photoDataUrl: processedImages[0],
          references: processedImages.slice(1),
          referenceRoles: extraRoles.filter((role): role is "design_reference" | "brand_asset" => role !== "property"),
          instruction: buildIntegratedAdPrompt({
            description: params.prompt,
            ratio: plan.creative_direction.aspect_ratio,
            cameraNote,
            directionNote,
            textDensity: "sheet",
            treatment: "modern",
          }),
          size: museSizeForRatio(plan.creative_direction.aspect_ratio),
        });
        modelLog.push({
          model: "muse-image-1.0",
          task: "Komposisi iklan",
          status: composed.ok ? "completed" : "failed",
          durationMs: Date.now() - imageStarted,
          output: composed.ok ? `Poster ${plan.creative_direction.aspect_ratio} tersusun.` : "Poster model tidak tersedia.",
          error: composed.ok ? undefined : composed.reason,
        });
        if (composed.ok) {
          let imageUrl = composed.imageUrl;
          let responseId = composed.responseId;
          const criticStarted = Date.now();
          const preview = await sharp(Buffer.from(composed.imageUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""), "base64"))
            .resize({ width: 768, withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();
          const criticText = await this.askSpark(
            config.baseUrl,
            config.apiKey,
            `data:image/jpeg;base64,${preview.toString("base64")}`,
            buildCritiquePrompt(plan.creative_direction.aspect_ratio),
            90000,
          );
          const critique = criticText ? parseVisualCritique(criticText) : null;
          modelLog.push({
            model: "muse-spark-1.3",
            task: "Kritik visual",
            status: critique ? "completed" : "failed",
            durationMs: Date.now() - criticStarted,
            output: critique
              ? critique.accepted
                ? "Gambar diterima."
                : critique.defects.join("; ")
              : "Kritik tidak terbaca.",
            error: critique ? undefined : "Jawaban model tidak berisi JSON.",
          });
          const correction = critique && !critique.accepted ? usableCorrection(critique.correction) : null;
          if (correction) {
            const refineStarted = Date.now();
            const refined = await composeWithMuseImage({
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              previousResponseId: composed.responseId,
              instruction: correction,
              size: museSizeForRatio(plan.creative_direction.aspect_ratio),
            });
            modelLog.push({
              model: "muse-image-1.0",
              task: "Perbaikan terarah",
              status: refined.ok ? "completed" : "failed",
              durationMs: Date.now() - refineStarted,
              output: refined.ok ? "Gambar diperbarui dari koreksi." : "Gambar pertama dipertahankan.",
              error: refined.ok ? undefined : refined.reason,
            });
            if (refined.ok) {
              imageUrl = refined.imageUrl;
              responseId = refined.responseId;
            }
          }
          return {
            imageUrl,
            responseId,
            reasoning: [
              "Muse Image menyusun poster sebagai satu desain, bukan teks yang ditempel di foto.",
              cameraNote,
              critique?.accepted ? "Kritik visual menerima gambar." : "Kritik visual memeriksa gambar yang sudah jadi.",
              "Kata-kata diambil dari brief. Harga dan nomor telepon tidak ditambahkan.",
            ].join(" "),
            aspectRatio: plan.creative_direction.aspect_ratio,
            nativeSize: museSizeForRatio(plan.creative_direction.aspect_ratio),
            generationTimeMs: Date.now() - startTime,
            isFallback: false,
            provider: "muse_image_integrated",
            modelUsed: this.MODEL_NAME,
            adFacts,
            modelLog,
            artDirections,
          };
        }
        editNote = `Komposisi Muse gagal: ${composed.reason}`;
        console.warn("[Muse Image 1.0] Integrated poster failed, local layout is used:", composed.reason);
      }
      const laidOut = await renderAgencyAd({
        photoDataUrl: photoForType,
        description: params.prompt,
        ratio: plan.creative_direction.aspect_ratio,
        concept: overlayForDirection(direction),
      });
      return {
        imageUrl: laidOut.imageUrl,
        responseId: museResponseId || this.encodeConversationState({
          v: 4,
          layout: direction,
          aspectRatio: plan.creative_direction.aspect_ratio,
        }),
        reasoning: [
          plan.source === "muse_spark" ? "Muse Spark membaca fotonya." : "Rencana dibuat dari ukuran foto karena analisis model tidak tersedia.",
          plan.visual_analysis.camera_accepted
            ? `Sudut ${plan.visual_analysis.camera_angle} diterima dari bukti foto.`
            : "Sudut kamera tetap unverified.",
          plan.visual_analysis.perspective_note,
          `Arah kreatif ${direction}, rasio ${plan.creative_direction.aspect_ratio}.`,
          editNote,
          "Teks dicetak aplikasi dari data iklan, bukan dari model gambar.",
          placement.note,
        ].join(" "),
        aspectRatio: plan.creative_direction.aspect_ratio,
        nativeSize: `${laidOut.width}x${laidOut.height}`,
        generationTimeMs: Date.now() - startTime,
        isFallback: !museResponseId || photoForType === processedImages[0],
        provider: photoForType === processedImages[0] ? "campaign_render" : "muse_spark+muse_image+type",
        modelUsed: photoForType === processedImages[0] ? "layout-engine" : this.MODEL_NAME,
        adFacts,
        modelLog,
        artDirections,
      };
    }

    const priorMuseId = params.previousResponseId?.trim() || "";
    if (priorMuseId.startsWith("resp_") && config.isConfigured && config.apiKey) {
      const refined = await composeWithMuseImage({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        instruction: refinementPrompt(params.prompt),
        size: nativeSize === "auto" ? "1024x1536" : nativeSize,
        previousResponseId: priorMuseId,
      });
      if (refined.ok) {
        if (!requestNeedsListingType(params.prompt)) {
          return {
            imageUrl: refined.imageUrl,
            responseId: refined.responseId,
            reasoning: "Giliran lanjutan mengubah suasana foto. Teks iklan tidak ditambahkan.",
            aspectRatio: ratio === "auto" ? "4:5" : ratio,
            nativeSize,
            generationTimeMs: Date.now() - startTime,
            isFallback: false,
            provider: "muse_image_refine",
            modelUsed: this.MODEL_NAME,
            adFacts,
          };
        }
        const laidOut = await renderAgencyAd({
          photoDataUrl: refined.imageUrl,
          description: params.prompt,
          ratio: asPlanRatio(ratio),
          concept: "commercial",
        });
        return {
          imageUrl: laidOut.imageUrl,
          responseId: refined.responseId,
          reasoning: "Perubahan dikirim sebagai giliran lanjutan. Teks dicetak ulang dari data iklan.",
          aspectRatio: ratio === "auto" ? "4:5" : ratio,
          nativeSize: `${laidOut.width}x${laidOut.height}`,
          generationTimeMs: Date.now() - startTime,
          isFallback: false,
          provider: "muse_image_refine+type",
          modelUsed: this.MODEL_NAME,
          adFacts,
        };
      }
    }

    // Append creative context & user preferences if provided
    const contextSegments: string[] = [];
    if (params.userPreferences && params.userPreferences.length > 0) {
      contextSegments.push(`User Creative Preferences: ${params.userPreferences.join("; ")}`);
    }
    if (params.projectContext) {
      contextSegments.push(`Project Context: ${params.projectContext}`);
    }
    if (params.creativeContext) {
      contextSegments.push(params.creativeContext);
    }
    if (contextSegments.length > 0) {
      promptText = `${promptText}\n\n[CREATIVE MEMORY & CONTEXT]\n${contextSegments.join("\n")}`;
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

        if (
          params.previousResponseId &&
          params.previousResponseId.trim() &&
          !params.previousResponseId.startsWith("st_")
        ) {
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
              provider: "muse_image_api",
              modelUsed: this.MODEL_NAME,
              adFacts,
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

    // 4. Advanced High-Fidelity Local Studio Engine
    // Generates an agency-grade property flyer rasterized via sharp to high-density WebP
    try {
      const prevState = this.decodeConversationState(params.previousResponseId);
      const promptLower = params.prompt.toLowerCase();

      // Determine ratio (explicit prompt takes precedence over UI selection)
      let finalRatio: StudioAspectRatio = ratio !== "auto" ? ratio : (prevState?.aspectRatio || "4:5");
      if (promptLower.includes("9:16") || promptLower.includes("story") || promptLower.includes("reels") || promptLower.includes("tiktok") || promptLower.includes("vertikal")) {
        finalRatio = "9:16";
      } else if (promptLower.includes("1:1") || promptLower.includes("persegi") || promptLower.includes("square") || promptLower.includes("carousel")) {
        finalRatio = "1:1";
      } else if (promptLower.includes("16:9") || promptLower.includes("landscape") || promptLower.includes("banner")) {
        finalRatio = "16:9";
      } else if (promptLower.includes("4:5") || promptLower.includes("feed")) {
        finalRatio = "4:5";
      } else if (promptLower.includes("2:3")) {
        finalRatio = "2:3";
      }

      // Parse entities using natural language brief parser
      const parsedBrief = NaturalLanguageBriefParser.parse(params.prompt, {
        aspectRatio: (finalRatio === "16:9" || finalRatio === "2:3" || finalRatio === "auto" ? "4:5" : finalRatio) as AspectRatio,
      });

      // Determine archetype
      let archetypeId: AdArchetypeId = prevState?.archetypeId || "emerald_minimalist";
      if (
        promptLower.includes("kaba") ||
        promptLower.includes("dp 0") ||
        promptLower.includes("tanpa dp") ||
        promptLower.includes("subsidi") ||
        promptLower.includes("cashback") ||
        promptLower.includes("promo kpr") ||
        promptLower.includes("direct offer")
      ) {
        archetypeId = "kaba_direct_offer";
      } else if (
        promptLower.includes("aurora") ||
        promptLower.includes("senja") ||
        promptLower.includes("sore") ||
        promptLower.includes("sunset") ||
        promptLower.includes("golden hour") ||
        promptLower.includes("keemasan")
      ) {
        archetypeId = "golden_aurora_wave";
      } else if (
        promptLower.includes("luxury") ||
        promptLower.includes("mewah") ||
        promptLower.includes("villa") ||
        promptLower.includes("sultan") ||
        promptLower.includes("arsitektur") ||
        promptLower.includes("custom build")
      ) {
        archetypeId = "luxury_architecture";
      } else if (
        promptLower.includes("navy") ||
        promptLower.includes("metro") ||
        promptLower.includes("regency") ||
        promptLower.includes("apartemen") ||
        promptLower.includes("residence") ||
        promptLower.includes("cluster elite")
      ) {
        archetypeId = "royal_navy_metro";
      } else if (
        promptLower.includes("minimalis") ||
        promptLower.includes("hijau") ||
        promptLower.includes("century") ||
        promptLower.includes("emerald") ||
        promptLower.includes("asri")
      ) {
        archetypeId = "emerald_minimalist";
      } else if (!prevState) {
        archetypeId = inferArchetypeFromBrief(parsedBrief).id;
      }

      // Merge multi-turn properties
      const projectName =
        parsedBrief.projectName ||
        prevState?.projectName ||
        (parsedBrief.propertyType ? `${parsedBrief.propertyType.toUpperCase()} RESIDENCE` : "HUNIAN MODERN");

      const propertyType = parsedBrief.propertyType || prevState?.propertyType || "Rumah Tinggal Modern";
      const propertyLocation =
        parsedBrief.propertyLocation && parsedBrief.propertyLocation !== "Lokasi Strategis"
          ? parsedBrief.propertyLocation
          : prevState?.propertyLocation || parsedBrief.propertyLocation || "Lokasi Strategis";

      const startingPrice = parsedBrief.startingPrice || prevState?.startingPrice || "Rp 850 Juta";
      const promoHeadline =
        parsedBrief.promoHeadline ||
        prevState?.promoHeadline ||
        ((parsedBrief.promos && parsedBrief.promos.length > 0) ? parsedBrief.promos.join(" • ") : "Promo DP 0% & Free Semua Biaya");

      const contactNumber = parsedBrief.whatsappNumber || prevState?.contactNumber || "0812-3456-7890";
      const headline = parsedBrief.headline || prevState?.headline;
      const subheadline = parsedBrief.subheadline || prevState?.subheadline;
      const specsText =
        parsedBrief.specsText ||
        prevState?.specsText ||
        `${parsedBrief.bedrooms || 3} KT • ${parsedBrief.bathrooms || 2} KM • LB ${parsedBrief.buildingArea || 90}m² • LT ${parsedBrief.landArea || 120}m²`;

      // Resolve Photo Source
      let photoSource =
        processedImages[0] ||
        prevState?.photoUrl ||
        this.getCuratedArchetypePhoto(archetypeId);

      let photoDataUrl = await this.ensureDataUrl(photoSource);

      // Apply optical tone mapping if base64 data URL
      if (photoDataUrl.startsWith("data:image/")) {
        try {
          const rawBase64 = photoDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
          const buffer = Buffer.from(rawBase64, "base64");
          const gradedBuffer = await this.applyArchetypeToneMapping(buffer, archetypeId);
          photoDataUrl = `data:image/jpeg;base64,${gradedBuffer.toString("base64")}`;
        } catch {
          // If tone mapping fails, continue with original data URL
        }
      }

      // Safeguard: Ensure valid data URL for SVG embedding
      if (!photoDataUrl.startsWith("data:")) {
        const solid = await sharp({
          create: {
            width: 1080,
            height: 1080,
            channels: 3,
            background: { r: 24, g: 36, b: 48 },
          },
        })
          .jpeg({ quality: 85 })
          .toBuffer();
        photoDataUrl = `data:image/jpeg;base64,${solid.toString("base64")}`;
      }

      // Synthesize Ad Poster SVG
      const synthesizedSvgUrl = AdPosterSynthesizer.synthesize({
        archetypeId,
        aspectRatio: finalRatio,
        projectName,
        propertyType,
        propertyLocation,
        startingPrice,
        promoHeadline,
        headline,
        subheadline,
        bedrooms: parsedBrief.bedrooms || prevState?.bedrooms || "3",
        bathrooms: parsedBrief.bathrooms || prevState?.bathrooms || "2",
        buildingArea: parsedBrief.buildingArea || prevState?.buildingArea || "90",
        landArea: parsedBrief.landArea || prevState?.landArea || "120",
        contactNumber,
        photoUrl: photoDataUrl,
        specsText,
      });

      // Rasterize SVG to WebP using sharp
      const svgBase64 = synthesizedSvgUrl.replace(/^data:image\/svg\+xml;base64,/, "");
      const svgBuffer = Buffer.from(svgBase64, "base64");
      const rasterWebp = await sharp(svgBuffer)
        .webp({ quality: 95, effort: 4 })
        .toBuffer();
      const outputWebpUrl = `data:image/webp;base64,${rasterWebp.toString("base64")}`;

      // Encode state token for conversational multi-turn refinement
      const newResponseId = this.encodeConversationState({
        v: 1,
        t: Date.now(),
        archetypeId,
        aspectRatio: finalRatio,
        projectName,
        propertyType,
        propertyLocation,
        startingPrice,
        promoHeadline,
        headline,
        subheadline,
        bedrooms: parsedBrief.bedrooms || prevState?.bedrooms,
        bathrooms: parsedBrief.bathrooms || prevState?.bathrooms,
        buildingArea: parsedBrief.buildingArea || prevState?.buildingArea,
        landArea: parsedBrief.landArea || prevState?.landArea,
        contactNumber,
        specsText,
        photoUrl: photoDataUrl.length < 80000 ? photoDataUrl : undefined,
      });

      // Construct AI Creative Director Reasoning
      const archetypeMeta = getArchetype(archetypeId);
      const dimensionsDesc = {
        "1:1": "1080×1080 (Feed / Carousel)",
        "4:5": "1080×1350 (Feed Ads)",
        "9:16": "1080×1920 (Story & Reels)",
        "16:9": "1920×1080 (Landscape Banner)",
        "2:3": "1080×1620 (Vertical Poster)",
        "auto": "1080×1350 (Feed Ads)",
      }[finalRatio] || "1080×1350";

      const reasoning = [
        `### 🎨 AI Creative Director Synthesis`,
        `**Visual Archetype:** ${archetypeMeta.name} — *${archetypeMeta.tag}*`,
        `**Inspirasi Desain:** ${archetypeMeta.subtitle}`,
        ``,
        `#### 📐 Arsitektur & Hierarki Visual:`,
        `- **Aspek Rasio & Safe Zones:** ${dimensionsDesc} dengan batas aman atas dan bawah Meta Ads agar teks tidak tertutup header profil atau caption.`,
        `- **Color Palette & Kontras:** ${archetypeMeta.palette.primary} dengan aksen ${archetypeMeta.palette.accentGold || archetypeMeta.palette.accent} untuk daya tarik visual tinggi.`,
        `- **Tipografi Utama:** Penekanan nama properti **${projectName}** dan penawaran harga **${startingPrice}** pada zona fokus mata pembeli.`,
        ``,
        `#### 🎯 Strategi Konversi & CTWA (Click-to-WhatsApp):`,
        `- **Promosi Utama:** ${promoHeadline}`,
        `- **Spesifikasi Unit:** ${specsText}`,
        `- **Direct WhatsApp:** Tombol booking langsung terhubung ke **${contactNumber}** untuk mempercepat konversi lead.`,
        ``,
        `💡 **Saran Revisi Cepat:**`,
        `1. *"Ubah tema ke Luxury Architecture bernuansa gelap dan emas"*`,
        `2. *"Ganti penawaran harga menjadi Rp 1,5 Miliar dengan DP 0%"*`,
        `3. *"Ubah rasio ke 9:16 Vertikal untuk Instagram Story & Reels"*`,
      ].join("\n");

      return {
        imageUrl: outputWebpUrl,
        responseId: newResponseId,
        reasoning,
        aspectRatio: finalRatio,
        nativeSize: this.resolveStudioSize(finalRatio),
        generationTimeMs: Date.now() - startTime,
        isFallback: true,
        provider: "ad_poster_synthesizer",
        modelUsed: "local-studio-synthesizer",
        fallbackReason: "Live Meta Muse API unavailable or unconfigured — synthesized via local high-fidelity visual engine",
        adFacts,
      };
    } catch (synthErr) {
      console.error("[Muse Image 1.0] Advanced Studio Synthesizer error:", synthErr);
      const fallbackImage = processedImages[0] || this.getStudioFallbackImage(ratio);
      return {
        imageUrl: fallbackImage,
        responseId: `fallback_${Date.now()}`,
        reasoning: "Studio fallback generator.",
        aspectRatio: ratio,
        nativeSize,
        generationTimeMs: Date.now() - startTime,
        isFallback: true,
        provider: "studio_fallback",
        modelUsed: "curated-fallback-asset",
        fallbackReason: synthErr instanceof Error ? synthErr.message : "Studio synthesis failure",
        adFacts,
      };
    }
  }
}
