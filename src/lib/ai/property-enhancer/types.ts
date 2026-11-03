/**
 * Property Image Enhancer — Core Domain Types
 * Principles:
 * 1. "Enhance image quality, not property reality."
 * 2. "Architectural accuracy has the highest priority."
 * 3. "Convert 3D architectural renders (SketchUp/Lumion/Enscape/D5) into professional full-frame photographs."
 */

export type EnhancementMode =
  | "mode_photorealistic"       // MODE A: Conservative Render-to-Photo Conversion (Strict Structure Lock)
  | "mode_architectural_photo"  // MODE B: Professional Architectural Photography (Selectable Atmosphere)
  | "mode_premium_visualization"; // MODE C: Premium Property Visualization (Marketing Realism)

export type PhotographyStyle =
  | "style_golden_hour"        // A. Luxury Golden Hour (warm natural sunlight, golden reflections)
  | "style_clean_daylight"      // B. Clean Daylight (bright natural daylight, neutral white balance)
  | "style_blue_hour"           // C. Blue Hour Luxury (indigo twilight sky, warm interior glass glow)
  | "style_tropical"            // D. Tropical Architectural Photography (Indonesian tropical greenery)
  | "style_overcast_editorial"  // E. Overcast Editorial (soft diffused daylight, magazine quality)
  | "style_bright_morning";     // F. Bright Morning (fresh morning sunlight, clear atmosphere)

export type EnhancementIntensity = "conservative" | "balanced" | "advanced";

export type OutputAspectRatio = "original" | "1:1" | "4:5" | "9:16" | "16:9";

export interface EnhancementParameters {
  exposure: number;        // -100 to +100
  contrast: number;        // -100 to +100
  highlights: number;      // -100 to +100
  shadows: number;         // -100 to +100
  temperature: number;     // -100 to +100
  tint: number;            // -100 to +100
  saturation: number;      // -100 to +100
  vibrance: number;        // -100 to +100
  sharpness: number;       // 0 to 100
  clarity: number;         // 0 to 100
  noiseReduction: number;  // 0 to 100
  denoise?: number;        // 0 to 100 (alias for noiseReduction)
  upscaleFactor?: number;  // 1, 2, or 4
}

export interface ArchitecturalStructureLock {
  preserveArchitecture: boolean;     // Lock building geometry, massing, silhouette
  preserveComposition: boolean;      // Lock camera angle, perspective, framing
  preserveAspect: boolean;           // Lock original aspect ratio
  enhanceMaterials: boolean;          // Convert CGI textures to realistic materials (wood, stone, glass)
  enhanceLandscaping: boolean;        // Natural vegetation, realistic foliage, garden
  naturalLighting: boolean;           // Natural global illumination and realistic shadows
  glassReflections: boolean;          // Physically plausible window and water reflections
}

export interface ArchitecturalImageAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  format: string;
  fileSizeBytes: number;
  buildingType: string;               // e.g. "Modern 2-Story Residential", "Luxury Villa"
  estimatedFloors: "1_floor" | "2_floors" | "3_plus_floors" | "unknown";
  roofType: "flat_parapet" | "pitched_gable" | "hip_roof" | "tropical_overhang" | "unknown";
  facadeMaterials: string[];          // e.g. ["travertine", "timber slats", "glass curtain"]
  lightingCondition: "daylight" | "golden_hour" | "twilight" | "flat_ambient";
  cameraPerspective: "eye_level_straight" | "low_angle_hero" | "three_quarter_perspective";
  dominantColors: { r: number; g: number; b: number; hex: string }[];
  isCgiRender: boolean;               // Detected SketchUp/Lumion/Enscape characteristics
  confidenceScore: number;            // 0 - 1
  analysisSummary: string;
}

export interface ArchitecturalQualityScorecard {
  overallScore: number;               // 0 - 100 (Objective composite score)
  architecturalFidelityScore: number; // 0 - 100 (Geometry, roof, openings preservation)
  photographicRealismScore: number;   // 0 - 100 (Material roughness, reflections, lighting)
  technicalQualityScore: number;      // 0 - 100 (Sharpness, dynamic range, artifact-free)
  checks: {
    name: string;
    category: "fidelity" | "realism" | "technical";
    passed: boolean;
    details: string;
  }[];
  flagsForReview: string[];           // Warnings if building geometry deviated
  isFidelityGuaranteed: boolean;
}

export interface EnhancementJobConfig {
  mode: EnhancementMode;
  style?: PhotographyStyle;
  intensity: EnhancementIntensity;
  aspectRatio: OutputAspectRatio;
  structureLock: ArchitecturalStructureLock;
  outputFormat: "jpeg" | "png" | "webp";
  outputQuality: number;              // 70 to 100 (Default: 95)
}

export interface EnhancementJobResult {
  id: string;
  originalUrl: string;
  enhancedUrl: string;
  originalWidth: number;
  originalHeight: number;
  enhancedWidth: number;
  enhancedHeight: number;
  originalFileSize: number;
  enhancedFileSize: number;
  mode: EnhancementMode;
  style: PhotographyStyle;
  intensity: EnhancementIntensity;
  aspectRatio: OutputAspectRatio;
  structureLock: ArchitecturalStructureLock;
  analysis: ArchitecturalImageAnalysis;
  scorecard: ArchitecturalQualityScorecard;
  modelUsed: string;                  // e.g. "muse-image-1.0"
  provider: "meta_muse_api" | "local_photorealistic_engine";
  aiReasoning?: string;               // Meta Muse internal architectural reasoning
  processingTimeMs: number;
  status: "completed" | "failed";
  errorMessage?: string;
  isSimulated?: boolean;
  createdAt: string;
}
