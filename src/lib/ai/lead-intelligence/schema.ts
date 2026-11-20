import { z } from "zod";

export const LeadTemperatureSchema = z.enum(["cold", "warm", "hot", "junk"]);
export type LeadTemperature = z.infer<typeof LeadTemperatureSchema>;

export const PipelineStageSchema = z.enum([
  "new_inquiry",
  "contacted",
  "qualified",
  "survey",
  "closing",
  "won",
  "lost",
]);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

const NullableTrimmedTextSchema = z
  .string()
  .nullable()
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const CleanStringListSchema = z
  .array(z.string())
  .transform((items) => items.map((s) => s.trim()).filter((s) => s.length > 0));

export const PropertyPreferencesSchema = z.object({
  project: NullableTrimmedTextSchema,
  location: NullableTrimmedTextSchema,
  budget: NullableTrimmedTextSchema,
  unit_type: NullableTrimmedTextSchema,
});
export type PropertyPreferences = z.infer<typeof PropertyPreferencesSchema>;

export const LeadEvidenceItemSchema = z.object({
  message_id: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});
export type LeadEvidenceItem = z.infer<typeof LeadEvidenceItemSchema>;

export const LeadAnalysisOutputSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  lead_temperature: LeadTemperatureSchema,
  pipeline_stage_suggestion: PipelineStageSchema,
  score: z.number().int().min(0).max(100),
  intent_signals: CleanStringListSchema,
  property_preferences: PropertyPreferencesSchema,
  objections: CleanStringListSchema,
  unanswered_questions: CleanStringListSchema,
  evidence: z.array(LeadEvidenceItemSchema),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
});
export type LeadAnalysisOutput = z.infer<typeof LeadAnalysisOutputSchema>;
