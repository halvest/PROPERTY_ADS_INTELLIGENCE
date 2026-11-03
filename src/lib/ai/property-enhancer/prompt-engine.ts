import type {
  EnhancementMode,
  PhotographyStyle,
  EnhancementIntensity,
  ArchitecturalStructureLock,
  ArchitecturalImageAnalysis,
} from "./types";
import { STYLE_DEFINITIONS } from "./presets";

export interface PromptEngineInput {
  mode: EnhancementMode;
  style?: PhotographyStyle;
  intensity: EnhancementIntensity;
  structureLock: ArchitecturalStructureLock;
  analysis: ArchitecturalImageAnalysis;
  targetAspectRatio?: string;
  detailNotes?: string;
}

/**
 * Architectural Structure Lock & Prompt Engine
 * Enforces strict architectural preservation while driving Meta Muse Image 1.0
 * to convert 3D CGI renders into professional full-frame architectural photography.
 */
export class ArchitecturalPromptEngine {
  /**
   * Generates the structured prompt sent to Meta Responses API alongside the input_image.
   */
  public static buildStructuredPrompt(input: PromptEngineInput): string {
    const { mode, style = "style_clean_daylight", intensity, structureLock, analysis } = input;
    const styleDef = STYLE_DEFINITIONS[style] || STYLE_DEFINITIONS.style_clean_daylight;

    const segments: string[] = [];

    // 1. PRIMARY ROLE & CORE DIRECTIVE
    segments.push(
      "Act as a world-class architectural photographer, professional architectural visualization artist, and photorealistic rendering specialist."
    );
    segments.push(
      "Transform the provided 3D architectural rendering into an exceptionally realistic, high-end architectural photograph."
    );
    segments.push("The uploaded image is the DEFINITIVE visual source of truth.");

    // 2. ARCHITECTURAL STRUCTURE LOCK — HIGHEST PRIORITY (PHASE 3)
    if (structureLock.preserveArchitecture) {
      segments.push(
        "[ARCHITECTURAL STRUCTURE LOCK — CRITICAL & HIGHEST PRIORITY]\n" +
          "Preserve the exact original building architecture, geometry, proportions, dimensions, silhouette, and massing.\n" +
          `Detected building structure: ${analysis.buildingType} with ${
            analysis.roofType === "flat_parapet" ? "flat concrete parapet roof" : "pitched roof"
          }.\n` +
          "1. KEEP EXACT ROOF CONFIGURATION: Never turn a flat roof into a pitched roof, nor alter eaves or parapet heights.\n" +
          "2. KEEP EXACT NUMBER OF FLOORS: Maintain all visible floor levels and horizontal facade divisions.\n" +
          "3. KEEP EXACT WINDOW & DOOR POSITIONS: Preserve the exact count, placement, frames, mullions, and proportions of every window, sliding door, and balcony glass.\n" +
          "4. KEEP EXACT STRUCTURAL ELEMENTS: Maintain all columns, beams, overhangs, exterior walls, fences, carport structures, and parked vehicles in their exact relative positions.\n" +
          "5. DO NOT REDESIGN: Do not add extra balconies, do not remove walls, do not invent new architectural wings, and do not reconstruct the building."
      );
    }

    // 3. CAMERA & COMPOSITION PRESERVATION
    if (structureLock.preserveComposition) {
      segments.push(
        "[CAMERA & PERSPECTIVE PRESERVATION]\n" +
          "Preserve the exact camera position, viewing angle, eye-level perspective, and image framing from the reference image.\n" +
          "Maintain perfectly straight architectural verticals (as if shot with a professional 24-35mm architectural tilt-shift lens on a full-frame Hasselblad / Sony camera).\n" +
          "Do not tilt, rotate, or re-frame the camera."
      );
    }

    // 4. MODE-SPECIFIC TRANSFORMATION STRATEGY (PHASE 2)
    if (mode === "mode_photorealistic") {
      segments.push(
        "[MODE A: CONSERVATIVE PHOTOREALISTIC CONVERSION]\n" +
          "Primary goal: Strip away all artificial CGI/SketchUp/Lumion appearance and replace with authentic physical materials.\n" +
          "- Replace flat computer graphics textures with physically based material roughness (subtle plaster imperfections, natural travertine stone pores, genuine wood grain with tactile depth).\n" +
          "- Render realistic glass with physically plausible sky and cloud reflections, subtle environmental bounce, and transparency.\n" +
          "- Replace plastic-looking 3D vegetation with believable natural foliage, individual leaves with subsurface scattering, and authentic garden landscaping.\n" +
          "- Maintain neutral, realistic daytime illumination with soft contact shadows (ambient occlusion) at base of walls and ground.\n" +
          "Architectural fidelity has absolute priority over creative alteration."
      );
    } else if (mode === "mode_architectural_photo") {
      segments.push(
        `[MODE B: PROFESSIONAL ARCHITECTURAL PHOTOGRAPHY — ${styleDef.name.toUpperCase()}]\n` +
          `Atmosphere: ${styleDef.desc}\n` +
          `Lighting specification: ${styleDef.lightingDetails}\n` +
          "- Render authentic lighting interaction: natural sunlight angle, realistic soft cast shadows, and warm ambient light bounce.\n" +
          "- Materials: High-end architectural listing quality with tactile micro-textures on concrete, metal trims, and stone.\n" +
          "- Glass & Reflections: Mirror-smooth tinted architectural glass reflecting the realistic sky and ambient environment.\n" +
          "- Vegetation: Lush, healthy landscaping with natural botanical variation."
      );
    } else {
      // mode_premium_visualization
      segments.push(
        "[MODE C: PREMIUM LUXURY PROPERTY VISUALIZATION]\n" +
          "Primary goal: Commercial luxury marketing presentation with editorial atmosphere while locking the building structure.\n" +
          "- Enhance atmospheric depth, clean environmental integration, and premium front yard paving.\n" +
          "- Elevate landscaping: Pristine manicured lawn, elegant ornamental plants, clean driveway paving with subtle wet/gloss sheen.\n" +
          "- Elevate reflections & lighting: Warm ambient interior lighting visible through floor-to-ceiling glass, subtle exterior landscape sconces.\n" +
          "- Strict rule: The building geometry, roof, doors, and windows MUST REMAIN 100% IDENTICAL to the source."
      );
    }

    // 5. INTENSITY MODIFIERS
    if (intensity === "conservative") {
      segments.push(
        "[INTENSITY: STRICT CONSERVATIVE] Apply the most conservative transformation possible. Modify only surface materials and lighting. Zero structural deviation is permitted."
      );
    } else if (intensity === "advanced") {
      segments.push(
        "[INTENSITY: ADVANCED REALISM] Maximize photographic realism, atmospheric haze, subtle lens optics, and rich micro-details while maintaining the structural lock."
      );
    }

    // 6. OPTIONAL USER DETAIL DIRECTIVES
    if (input.detailNotes && input.detailNotes.trim()) {
      segments.push(
        `[SPECIFIC ENHANCEMENT DIRECTIVES]\n${input.detailNotes.trim()}`
      );
    }

    // 7. NEGATIVE PROMPT & STRICT GUARDRAILS (ZERO HALLUCINATIONS)
    segments.push(
      "[STRICT GUARDRAILS & NEGATIVE DIRECTIVES]\n" +
        "DO NOT RENDER ANY TEXT, DO NOT RENDER NUMBERS, DO NOT RENDER LOGOS, DO NOT RENDER WATERMARKS, DO NOT RENDER GRAPHIC OVERLAYS, DO NOT RENDER BORDERS, DO NOT RENDER POSTER ELEMENTS.\n" +
        "Eliminate all CGI artifacts: no low-poly edges, no SketchUp wireframe lines, no unrealistic plastic shine, no cartoonish colors, no blurry textures, no video game look.\n" +
        "DO NOT redesign or modify the building structure.\n" +
        "OUTPUT REQUIREMENT: PURE HIGH-RESOLUTION PHOTOREALISTIC ARCHITECTURAL PHOTOGRAPHY ONLY."
    );

    return segments.join("\n\n");
  }
}

