/**
 * Property Ads Intelligence - AI Provider Abstraction Types
 * Defines interfaces and types for Meta Model API (Muse Spark 1.3) and future model boundaries
 * (Muse Wonder, Muse Image, SAM 3.1, Muse Spark Open, Muse Glimmer).
 */

export type ModelProviderId =
  | "meta_model_api"    // Official Meta hosted Model API (https://api.meta.ai/v1)
  | "muse_spark_open"   // Open-weight Muse Spark runtime (Baseten/Modal/self-hosted)
  | "muse_glimmer";     // Open-weight Muse Glimmer runtime

export type SupportedHostedModelId =
  | "muse-spark-1.3"    // Official fast lead extraction & reasoning model
  | "muse-wonder"       // Complex reasoning & strategic campaign insights
  | "muse-image"        // Property creative generation and visual analysis
  | "sam-3.1";          // Spatial object segmentation for floorplans/renders

export type SupportedOpenWeightModelId =
  | "muse-spark-open-1026"
  | "muse-glimmer-2b";

export type AnyMetaModelId = SupportedHostedModelId | SupportedOpenWeightModelId | (string & {});

export type AIProviderErrorCode =
  | "MISSING_CONFIGURATION"
  | "AUTHENTICATION_ERROR"
  | "RATE_LIMIT_ERROR"
  | "TIMEOUT_ERROR"
  | "INVALID_MODEL_OUTPUT"
  | "PROMPT_INJECTION_DETECTED"
  | "UPSTREAM_ERROR";

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;
  readonly isRecoverable: boolean;
  readonly statusCode?: number;
  readonly provider: ModelProviderId;
  readonly modelId: string;

  constructor(options: {
    code: AIProviderErrorCode;
    message: string;
    provider?: ModelProviderId;
    modelId?: string;
    isRecoverable?: boolean;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "AIProviderError";
    this.code = options.code;
    this.provider = options.provider ?? "meta_model_api";
    this.modelId = options.modelId ?? "muse-spark-1.3";
    this.isRecoverable = options.isRecoverable ?? false;
    this.statusCode = options.statusCode;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export interface MetaModelConfig {
  apiKey: string;
  baseUrl: string;
  museSparkModel: string;
  timeoutMs: number;
  maxRetries: number;
  isConfigured: boolean;
}

export interface LeadEvidenceExtractionInput {
  conversationText: string;
  leadContext?: {
    contactId?: string;
    contactName?: string;
    platform?: string;
    adId?: string;
    adName?: string;
    campaignName?: string;
  };
  propertyContext?: {
    projectName?: string;
    unitTypesAvailable?: string[];
    startingPrice?: number;
    currency?: string;
    location?: string;
  };
  temperature?: number;
  maxTokens?: number;
}
