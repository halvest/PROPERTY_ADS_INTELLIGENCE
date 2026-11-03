import "server-only";

import { AIProviderError } from "@/lib/ai/providers/types";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { parseModelJson } from "@/lib/ai/parse-model-json";
import { applyGuardrailsToModelOutput, type ActionGuardrailInput } from "./guardrails";
import { CTWA_SYSTEM_PROMPT, buildCtwaUserPrompt, type CtwaPromptContext } from "./prompt";
import { CtwaModelOutputSchema, type CtwaModelOutput } from "./schema";
import type { JustificationMetrics } from "./types";

export async function runCtwaStructuredAnalysis(options: {
  client: MetaModelApiClient;
  promptContext: CtwaPromptContext;
  guardrails: ActionGuardrailInput;
  groundTruthMetrics: JustificationMetrics;
  temperature?: number;
  maxTokens?: number;
}): Promise<CtwaModelOutput> {
  const response = await options.client.createChatCompletion({
    messages: [
      { role: "system", content: CTWA_SYSTEM_PROMPT },
      { role: "user", content: buildCtwaUserPrompt(options.promptContext) },
    ],
    response_format: { type: "json_object" },
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 6000,
  });

  const finishReason = response.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    throw new AIProviderError({
      code: "INVALID_MODEL_OUTPUT",
      message: "Respons analisis AI terpotong karena melampaui batas token.",
      isRecoverable: true,
    });
  }

  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent || rawContent.trim() === "") {
    throw new AIProviderError({
      code: "INVALID_MODEL_OUTPUT",
      message: "Model AI mengembalikan respons kosong.",
      isRecoverable: true,
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = parseModelJson(rawContent);
  } catch {
    throw new AIProviderError({
      code: "INVALID_MODEL_OUTPUT",
      message: "Format respons analisis AI tidak valid.",
      isRecoverable: true,
    });
  }

  const validationResult = CtwaModelOutputSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    const details = validationResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new AIProviderError({
      code: "INVALID_MODEL_OUTPUT",
      message: `Format respons analisis AI tidak valid: ${details}`,
      isRecoverable: true,
    });
  }

  return applyGuardrailsToModelOutput(
    validationResult.data,
    options.guardrails,
    options.groundTruthMetrics
  );
}
