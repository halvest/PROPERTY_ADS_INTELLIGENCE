/**
 * Provider-Agnostic Image Generation Abstraction
 * Allows pluggable generative vision models (Meta Muse Image 1.0, Stable Diffusion, Recraft, etc.)
 */

export interface ImageGenerationInput {
  prompt: string;
  images?: string[];
  aspectRatio?: string;
  previousResponseId?: string | null;
  parentGenerationId?: string | null;
  isEditing?: boolean;
  creativeContext?: string;
  userPreferences?: string[];
  projectContext?: string;
}

export interface ImageGenerationOutput {
  imageUrl: string;
  responseId?: string;
  reasoning?: string;
  aspectRatio: string;
  nativeSize: string;
  generationTimeMs: number;
  isFallback: boolean;
  provider: string;
  modelUsed: string;
  fallbackReason?: string;
}

export interface ImageGenerationProvider {
  readonly id: string;
  readonly name: string;
  generate(input: ImageGenerationInput): Promise<ImageGenerationOutput>;
}

