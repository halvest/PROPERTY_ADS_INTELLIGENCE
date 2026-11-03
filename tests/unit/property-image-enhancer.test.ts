import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  MODE_DEFINITIONS,
  STYLE_DEFINITIONS,
  INTENSITY_DEFINITIONS,
  ASPECT_RATIO_OPTIONS,
  DEFAULT_STRUCTURE_LOCK,
} from "@/lib/ai/property-enhancer/presets";
import { analyzeArchitecturalImage } from "@/lib/ai/property-enhancer/analyzer";
import { adaptImageToAspectRatio } from "@/lib/ai/property-enhancer/aspect-ratio";
import { ArchitecturalPromptEngine } from "@/lib/ai/property-enhancer/prompt-engine";
import { evaluateEnhancementQuality } from "@/lib/ai/property-enhancer/quality-checker";
import { executeEnhancementPipeline } from "@/lib/ai/property-enhancer/pipeline";
import type { EnhancementParameters } from "@/lib/ai/property-enhancer/types";

describe("Property Image Enhancer — Architectural Studio Test Suite", () => {
  describe("1. Preset & Mode Definitions", () => {
    it("should provide exactly 3 architectural enhancement modes", () => {
      const modes = Object.keys(MODE_DEFINITIONS);
      expect(modes).toHaveLength(3);
      expect(modes).toContain("mode_photorealistic");
      expect(modes).toContain("mode_architectural_photo");
      expect(modes).toContain("mode_premium_visualization");
    });

    it("should define complete metadata for all architectural modes", () => {
      for (const [key, def] of Object.entries(MODE_DEFINITIONS)) {
        expect(def.id).toBe(key);
        expect(def.name).toBeTruthy();
        expect(def.tagline).toBeTruthy();
        expect(def.badge).toBeTruthy();
        expect(def.desc).toBeTruthy();
        expect(def.recommendedFor).toBeTruthy();
      }
    });

    it("should provide exactly 6 curated architectural lighting styles", () => {
      const styles = Object.keys(STYLE_DEFINITIONS);
      expect(styles).toHaveLength(6);
      expect(styles).toContain("style_golden_hour");
      expect(styles).toContain("style_clean_daylight");
      expect(styles).toContain("style_blue_hour");
      expect(styles).toContain("style_tropical");
      expect(styles).toContain("style_overcast_editorial");
      expect(styles).toContain("style_bright_morning");
    });

    it("should define valid structure lock defaults", () => {
      expect(DEFAULT_STRUCTURE_LOCK.preserveArchitecture).toBe(true);
      expect(DEFAULT_STRUCTURE_LOCK.preserveComposition).toBe(true);
      expect(DEFAULT_STRUCTURE_LOCK.preserveAspect).toBe(true);
      expect(DEFAULT_STRUCTURE_LOCK.naturalLighting).toBe(true);
    });

    it("should provide standard advertising aspect ratio options", () => {
      const ratioIds = ASPECT_RATIO_OPTIONS.map((r) => r.id);
      expect(ratioIds).toContain("original");
      expect(ratioIds).toContain("1:1");
      expect(ratioIds).toContain("4:5");
      expect(ratioIds).toContain("9:16");
      expect(ratioIds).toContain("16:9");
    });
  });

  describe("2. Architectural Prompt Engine & Directives", () => {
    it("should generate strict structure lock prompt for photorealistic mode", async () => {
      const sampleBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 160, g: 190, b: 220 },
        },
      })
        .jpeg()
        .toBuffer();

      const analysis = await analyzeArchitecturalImage(sampleBuffer);

      const prompt = ArchitecturalPromptEngine.buildStructuredPrompt({
        mode: "mode_photorealistic",
        style: "style_clean_daylight",
        intensity: "conservative",
        structureLock: DEFAULT_STRUCTURE_LOCK,
        analysis,
        targetAspectRatio: "4:5",
      });

      expect(prompt).toContain("ARCHITECTURAL STRUCTURE LOCK");
      expect(prompt).toContain("Preserve the exact original building architecture");
      expect(prompt).toContain("NEGATIVE DIRECTIVES");
      expect(prompt).toContain("DO NOT RENDER ANY TEXT");
    });

    it("should include lighting details for chosen photography style", async () => {
      const sampleBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 160, g: 190, b: 220 },
        },
      })
        .jpeg()
        .toBuffer();

      const analysis = await analyzeArchitecturalImage(sampleBuffer);

      const goldenHourPrompt = ArchitecturalPromptEngine.buildStructuredPrompt({
        mode: "mode_architectural_photo",
        style: "style_golden_hour",
        intensity: "balanced",
        structureLock: DEFAULT_STRUCTURE_LOCK,
        analysis,
        targetAspectRatio: "1:1",
      });

      expect(goldenHourPrompt).toContain("sunlight");
      expect(goldenHourPrompt).toContain("golden");
    });
  });

  describe("3. Computer Vision & Architectural Image Analysis", () => {
    it("should accurately analyze image dimensions, aspect ratio, and luminance", async () => {
      // Create a 400x500 portrait image (4:5 ratio)
      const sampleBuffer = await sharp({
        create: {
          width: 400,
          height: 500,
          channels: 3,
          background: { r: 160, g: 190, b: 220 }, // Sky-like blue
        },
      })
        .jpeg()
        .toBuffer();

      const analysis = await analyzeArchitecturalImage(sampleBuffer);

      expect(analysis.width).toBe(400);
      expect(analysis.height).toBe(500);
      expect(analysis.aspectRatio).toBeCloseTo(0.8, 2);
      expect(analysis.buildingType).toBeTruthy();
      expect(analysis.estimatedFloors).toBeTruthy();
      expect(analysis.dominantColors.length).toBeGreaterThan(0);
      expect(analysis.analysisSummary).toBeTruthy();
    });
  });

  describe("4. Aspect Ratio Normalization & Export Engine", () => {
    it("should preserve original dimensions when target ratio is original", async () => {
      const inputBuffer = await sharp({
        create: {
          width: 600,
          height: 400,
          channels: 3,
          background: { r: 200, g: 200, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const res = await adaptImageToAspectRatio(inputBuffer, "original");
      expect(res.width).toBe(600);
      expect(res.height).toBe(400);
      expect(res.aspectRatio).toBeCloseTo(1.5, 1);
    });

    it("should adapt to 4:5 without stretching building geometry", async () => {
      const inputBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 150, g: 180, b: 210 },
        },
      })
        .jpeg()
        .toBuffer();

      const res = await adaptImageToAspectRatio(inputBuffer, "4:5");
      expect(res.width).toBe(1080);
      expect(res.height).toBe(1350);
      expect(res.aspectRatio).toBeCloseTo(0.8, 2);
    });
  });

  describe("5. Quality Assessment & Deterministic Pipeline", () => {
    it("should calculate objective quality scorecard for enhanced image", async () => {
      const origBuffer = await sharp({
        create: {
          width: 200,
          height: 250,
          channels: 3,
          background: { r: 100, g: 120, b: 140 },
        },
      })
        .jpeg()
        .toBuffer();

      const enhancedBuffer = await sharp({
        create: {
          width: 1080,
          height: 1350,
          channels: 3,
          background: { r: 110, g: 130, b: 150 },
        },
      })
        .jpeg()
        .toBuffer();

      const analysis = await analyzeArchitecturalImage(origBuffer);

      const score = await evaluateEnhancementQuality(
        origBuffer,
        enhancedBuffer,
        analysis,
        "mode_photorealistic"
      );

      expect(score.overallScore).toBeGreaterThanOrEqual(50);
      expect(score.architecturalFidelityScore).toBeGreaterThanOrEqual(50);
      expect(score.photographicRealismScore).toBeGreaterThanOrEqual(50);
      expect(score.technicalQualityScore).toBeGreaterThanOrEqual(50);
      expect(score.checks.length).toBeGreaterThan(0);
    });

    it("should execute deterministic image processing pipeline without errors", async () => {
      const inputBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg()
        .toBuffer();

      const params: EnhancementParameters = {
        exposure: 10,
        contrast: 5,
        highlights: -5,
        shadows: 15,
        temperature: 0,
        tint: 0,
        vibrance: 10,
        saturation: 5,
        clarity: 15,
        sharpness: 20,
        noiseReduction: 10,
      };

      const result = await executeEnhancementPipeline(inputBuffer, params);
      expect(result.outputBuffer).toBeDefined();
      expect(result.outputWidth).toBe(200);
      expect(result.outputHeight).toBe(200);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
