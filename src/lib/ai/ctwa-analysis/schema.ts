import { z } from "zod";

export const RecommendedActionSchema = z.enum([
  "SCALE",
  "MAINTAIN",
  "OPTIMIZE",
  "STOP",
  "INVESTIGATE",
  "RE_ACTIVATE",
]);

export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;

export const DataSufficiencySchema = z.enum(["cukup", "terbatas", "tidak_valid"]);

export const JustificationMetricsSchema = z.object({
  spend: z.number(),
  link_ctr: z.number().nullable(),
  cpm: z.number().nullable(),
  link_cpc: z.number().nullable(),
  messaging_conversations: z.number().nullable(),
  leads: z.number().nullable(),
  cost_per_messaging_conversation: z.number().nullable(),
  cost_per_lead: z.number().nullable(),
  unique_reach: z.number().nullable(),
});

export const ChainOfThoughtSchema = z.object({
  meta_metrics: z.string().min(1),
  chat_semantics: z.string().min(1),
  score_conclusion: z.string().min(1),
});

export const ContextAwarenessSchema = z.object({
  analyzed_scope: z.enum(["Account", "Campaign", "Ad"]),
  entity_status: z.enum(["Active", "Paused", "Unknown"]),
  period_confidence: z.enum(["High", "Medium", "Low"]),
  period_days: z.number().int().positive(),
});

export const CtwaModelOutputSchema = z.object({
  recommended_action: RecommendedActionSchema,
  justification_metrics: JustificationMetricsSchema,
  chain_of_thought: ChainOfThoughtSchema,
  performanceSummary: z.string(),
  budgetDecision: z.object({
    decision: z.enum(["NAIKKAN", "PERTAHANKAN", "TAHAN KENAIKAN", "KURANGI", "HENTIKAN SEMENTARA"]),
    reason: z.string(),
  }),
  keyFindings: z
    .array(
      z.object({
        finding: z.string(),
        evidence: z.string(),
        impact: z.string(),
        isHypothesis: z.boolean().default(false),
      })
    )
    .max(3),
  priorityActions: z
    .array(
      z.object({
        action: z.string(),
        howToCheck: z.string(),
        expectedResult: z.string(),
      })
    )
    .max(3),
  additionalDetails: z.object({
    funnelEvaluation: z.object({
      firstFailingStage: z.string(),
      explanation: z.string(),
    }),
    facts: z.array(z.string()).default([]),
    hypotheses: z.array(z.string()).default([]),
    unknowns: z.array(z.string()).default([]),
    creativeNotes: z.string().nullable().optional(),
  }),
  sourceDataStatus: z
    .object({
      metaResults: z.string(),
      crmProspects: z.string(),
      note: z.string().nullable().optional(),
    })
    .optional(),
  context_awareness: ContextAwarenessSchema.optional(),
});

export type CtwaModelOutput = z.infer<typeof CtwaModelOutputSchema>;

export const ACTION_TO_BUDGET_DECISION = {
  SCALE: "NAIKKAN",
  MAINTAIN: "PERTAHANKAN",
  OPTIMIZE: "KURANGI",
  STOP: "HENTIKAN SEMENTARA",
  INVESTIGATE: "TAHAN KENAIKAN",
  RE_ACTIVATE: "PERTAHANKAN",
} as const satisfies Record<RecommendedAction, CtwaModelOutput["budgetDecision"]["decision"]>;

export const ACTION_TO_VERDICT_STATUS = {
  SCALE: "scale",
  MAINTAIN: "maintain",
  OPTIMIZE: "optimize",
  STOP: "stop",
  INVESTIGATE: "maintain",
  RE_ACTIVATE: "maintain",
} as const;
