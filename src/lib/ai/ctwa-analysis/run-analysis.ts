import "server-only";

import { AIProviderError } from "@/lib/ai/providers/types";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { parseModelJson } from "@/lib/ai/parse-model-json";
import { applyGuardrailsToModelOutput, type ActionGuardrailInput } from "./guardrails";
import { CTWA_SYSTEM_PROMPT, buildCtwaUserPrompt, type CtwaPromptContext } from "./prompt";
import { CtwaDrawerModelSchema, type CtwaModelOutput, ACTION_TO_BUDGET_DECISION } from "./schema";
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

  const validationResult = CtwaDrawerModelSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    const details = validationResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new AIProviderError({
      code: "INVALID_MODEL_OUTPUT",
      message: `Format respons analisis AI tidak valid: ${details}`,
      isRecoverable: true,
    });
  }

  const drawer = validationResult.data;
  const recommended = drawer.budgetDecision.decision === "hentikan_sementara"
    ? "STOP"
    : drawer.budgetDecision.decision === "optimasi" || drawer.budgetDecision.decision === "kurangi"
      ? "OPTIMIZE"
      : drawer.budgetDecision.decision === "pertahankan"
        ? "MAINTAIN"
        : drawer.budgetDecision.decision === "reaktivasi"
          ? "RE_ACTIVATE"
          : "INVESTIGATE";
  const adapted: CtwaModelOutput = {
    recommended_action: recommended,
    justification_metrics: options.groundTruthMetrics,
    chain_of_thought: {
      meta_metrics: drawer.performanceSummary,
      chat_semantics: drawer.sourceDataStatus,
      score_conclusion: drawer.budgetDecision.reason,
    },
    performanceSummary: drawer.performanceSummary,
    budgetDecision: {
      decision: ACTION_TO_BUDGET_DECISION[recommended],
      reason: drawer.budgetDecision.reason,
    },
    keyFindings: drawer.keyFindings.map((finding) => ({
      finding,
      evidence: drawer.additionalDetails.facts[0] || finding,
      impact: drawer.additionalDetails.firstFailedFunnelStage,
      isHypothesis: false,
    })),
    priorityActions: drawer.priorityActions.map((item) => ({
      action: item.action,
      howToCheck: item.owner,
      expectedResult: item.expectedImpact,
    })),
    additionalDetails: {
      funnelEvaluation: {
        firstFailingStage: drawer.additionalDetails.firstFailedFunnelStage,
        explanation: drawer.additionalDetails.hypotheses[0] || drawer.additionalDetails.firstFailedFunnelStage,
      },
      facts: drawer.additionalDetails.facts,
      hypotheses: drawer.additionalDetails.hypotheses,
      unknowns: drawer.additionalDetails.unknowns,
      creativeNotes: drawer.additionalDetails.creativeNotes.join(" ") || null,
    },
    sourceDataStatus: {
      metaResults: drawer.sourceDataStatus,
      crmProspects: "",
    },
  };

  return applyGuardrailsToModelOutput(
    adapted,
    options.guardrails,
    options.groundTruthMetrics
  );
}
