import "server-only";

import { AIProviderError } from "../providers/types";
import { getMetaConfig, sanitizeLogOutput } from "./config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MetaClientOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

/**
 * Meta Model API Server Client
 * Direct HTTP client connecting to Meta Model API (https://api.meta.ai/v1)
 * with bounded retries, timeouts, and sanitized error handling.
 */
export class MetaModelApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: MetaClientOptions = {}) {
    const config = getMetaConfig({ requireApiKey: false });
    this.baseUrl = (options.baseUrl || config.baseUrl).replace(/\/+$/, "");
    this.apiKey = options.apiKey !== undefined ? options.apiKey : config.apiKey;
    this.defaultModel = options.model || config.museSparkModel;
    this.timeoutMs = options.timeoutMs ?? config.timeoutMs;
    this.maxRetries = options.maxRetries ?? config.maxRetries;
    this.fetchFn = options.fetchFn || fetch;
  }

  /**
   * Executes a chat completion request against Meta Model API (/chat/completions).
   */
  async createChatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const model = request.model || this.defaultModel;

    if (!this.apiKey || this.apiKey.trim() === "") {
      throw new AIProviderError({
        code: "MISSING_CONFIGURATION",
        message:
          "Cannot execute Meta Model API request: MODEL_API_KEY is not configured.",
        isRecoverable: false,
        provider: "meta_model_api",
        modelId: model,
      });
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const payload = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.1,
      max_tokens: request.max_tokens ?? 1200,
      ...(request.response_format ? { response_format: request.response_format } : {}),
    };

    let lastError: unknown = null;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "User-Agent": "PropertyAdsIntelligence/0.1.0 (Meta-Hackathon)",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Success
        if (response.ok) {
          const data = (await response.json()) as ChatCompletionResponse;
          return data;
        }

        // Non-200 response
        const statusCode = response.status;
        let responseBodyText = "";
        try {
          responseBodyText = await response.text();
        } catch {
          responseBodyText = "(Failed to read response body)";
        }

        const sanitizedErrorBody = sanitizeLogOutput(responseBodyText, this.apiKey);

        // 401 / 403: Authentication / Permission issues (Never retry)
        if (statusCode === 401 || statusCode === 403) {
          throw new AIProviderError({
            code: "AUTHENTICATION_ERROR",
            message: `Meta Model API authentication failed (HTTP ${statusCode}). Verify that MODEL_API_KEY is valid. Response: ${sanitizedErrorBody}`,
            statusCode,
            isRecoverable: false,
            provider: "meta_model_api",
            modelId: model,
          });
        }

        // 429: Rate limit (Recoverable, retry if attempts remain)
        if (statusCode === 429) {
          const error = new AIProviderError({
            code: "RATE_LIMIT_ERROR",
            message: `Meta Model API rate limit exceeded (HTTP 429). Response: ${sanitizedErrorBody}`,
            statusCode,
            isRecoverable: true,
            provider: "meta_model_api",
            modelId: model,
          });

          if (attempt <= this.maxRetries) {
            lastError = error;
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
          throw error;
        }

        // 5xx: Upstream server errors (Recoverable, retry if attempts remain)
        if (statusCode >= 500 && statusCode < 600) {
          const error = new AIProviderError({
            code: "UPSTREAM_ERROR",
            message: `Meta Model API returned upstream server error (HTTP ${statusCode}). Response: ${sanitizedErrorBody}`,
            statusCode,
            isRecoverable: true,
            provider: "meta_model_api",
            modelId: model,
          });

          if (attempt <= this.maxRetries) {
            lastError = error;
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
          throw error;
        }

        // 4xx client errors (400, 404, 422, etc. - Not recoverable)
        throw new AIProviderError({
          code: "UPSTREAM_ERROR",
          message: `Meta Model API request failed (HTTP ${statusCode}). Response: ${sanitizedErrorBody}`,
          statusCode,
          isRecoverable: false,
          provider: "meta_model_api",
          modelId: model,
        });
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof AIProviderError) {
          throw err;
        }

        // Timeout via AbortController
        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.toLowerCase().includes("aborted"));

        if (isAbort) {
          const error = new AIProviderError({
            code: "TIMEOUT_ERROR",
            message: `Meta Model API request timed out after ${this.timeoutMs}ms.`,
            isRecoverable: true,
            provider: "meta_model_api",
            modelId: model,
            cause: err,
          });

          if (attempt <= this.maxRetries) {
            lastError = error;
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
          throw error;
        }

        // Network / connection error
        const sanitizedErrMsg = sanitizeLogOutput(
          err instanceof Error ? err.message : String(err),
          this.apiKey
        );

        const networkError = new AIProviderError({
          code: "UPSTREAM_ERROR",
          message: `Network connection to Meta Model API failed: ${sanitizedErrMsg}`,
          isRecoverable: true,
          provider: "meta_model_api",
          modelId: model,
          cause: err,
        });

        if (attempt <= this.maxRetries) {
          lastError = networkError;
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }
        throw networkError;
      }
    }

    throw lastError || new Error("Meta Model API request failed after retries.");
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = 300;
    const exponential = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 100);
    return Math.min(exponential + jitter, 3000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for server-side usage.
 */
let defaultClient: MetaModelApiClient | null = null;

export function getMetaModelApiClient(): MetaModelApiClient {
  if (!defaultClient) {
    defaultClient = new MetaModelApiClient();
  }
  return defaultClient;
}
