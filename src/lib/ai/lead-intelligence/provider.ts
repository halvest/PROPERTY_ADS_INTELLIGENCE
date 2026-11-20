import "server-only";

import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { parseModelJson } from "@/lib/ai/parse-model-json";
import {
  buildLeadAnalysisUserPrompt,
  LEAD_ANALYZER_PROMPT_VERSION,
  LEAD_ANALYZER_SYSTEM_PROMPT,
  type CtwaAttributionContext,
  type TranscriptMessageInput,
} from "@/lib/ai/lead-intelligence/prompt";
import {
  LeadAnalysisOutputSchema,
  type LeadAnalysisOutput,
} from "@/lib/ai/lead-intelligence/schema";

export interface LeadAiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AnalyzeLeadConversationInput {
  messages: TranscriptMessageInput[];
  attribution?: CtwaAttributionContext | null;
}

export interface AnalyzeLeadConversationResult {
  output: LeadAnalysisOutput;
  modelName: string;
  promptVersion: string;
  rawOutput: unknown;
}

/**
 * Resolves Lead Intelligence LLM config, defaulting to the Meta Model API
 * env vars (`MODEL_API_KEY`, `META_MODEL_BASE_URL`, `META_MUSE_SPARK_MODEL`)
 * while still honoring explicit `LEAD_AI_*` overrides if set.
 */
export function getLeadAiProviderConfig(): LeadAiProviderConfig {
  const baseUrl = (
    process.env.LEAD_AI_API_BASE_URL?.trim() ||
    process.env.META_MODEL_BASE_URL?.trim() ||
    "https://api.meta.ai/v1"
  ).replace(/\/+$/, "");

  const apiKey =
    process.env.LEAD_AI_API_KEY?.trim() ||
    process.env.MODEL_API_KEY?.trim() ||
    process.env.META_MODEL_API_KEY?.trim() ||
    "";

  const model =
    process.env.LEAD_AI_MODEL?.trim() ||
    process.env.META_MUSE_SPARK_MODEL?.trim() ||
    process.env.META_MODEL_ID?.trim() ||
    "muse-spark-1.3";

  if (!apiKey) {
    throw new Error(
      "Missing MODEL_API_KEY (or LEAD_AI_API_KEY) environment variable for Lead Intelligence Engine."
    );
  }

  return {
    baseUrl,
    apiKey,
    model,
  };
}

export async function analyzeLeadConversation(
  input: AnalyzeLeadConversationInput
): Promise<AnalyzeLeadConversationResult> {
  const config = getLeadAiProviderConfig();
  const userPrompt = buildLeadAnalysisUserPrompt(input.messages, input.attribution);

  const client = new MetaModelApiClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
  });

  const completion = await client.createChatCompletion({
    model: config.model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: LEAD_ANALYZER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const rawText = completion.choices?.[0]?.message?.content;
  if (!rawText || typeof rawText !== "string" || rawText.trim() === "") {
    throw new Error("Lead AI provider returned an empty message content.");
  }

  const parsedJson = parseModelJson(rawText);
  const validatedOutput = LeadAnalysisOutputSchema.parse(parsedJson);

  return {
    output: validatedOutput,
    modelName: completion.model?.trim() || config.model,
    promptVersion: LEAD_ANALYZER_PROMPT_VERSION,
    rawOutput: validatedOutput,
  };
}
