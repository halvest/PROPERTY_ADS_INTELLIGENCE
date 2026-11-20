import { z } from "zod";

export const LEAD_TEMPERATURES = ["hot", "warm", "cold", "junk"] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const PIPELINE_STAGES = [
  "new_inquiry",
  "contacted",
  "qualified",
  "survey",
  "closing",
  "won",
  "lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new_inquiry: "New Inquiry",
  contacted: "Contacted",
  qualified: "Qualified",
  survey: "Survey",
  closing: "Closing",
  won: "Won",
  lost: "Lost",
};

export const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  junk: "Junk",
};

export const PatchCtwaLeadBodySchema = z
  .object({
    pipeline_stage: z.enum(PIPELINE_STAGES).optional(),
    lead_temperature: z.enum(LEAD_TEMPERATURES).optional(),
    manual_stage_lock: z.boolean().optional(),
    needs_human_review: z.boolean().optional(),
    reason: z.string().trim().max(400).optional(),
  })
  .refine(
    (data) =>
      data.pipeline_stage !== undefined ||
      data.lead_temperature !== undefined ||
      data.manual_stage_lock !== undefined ||
      data.needs_human_review !== undefined,
    {
      message:
        "Minimal satu field perubahan (pipeline_stage, lead_temperature, manual_stage_lock, atau needs_human_review) harus diisi.",
    }
  );

export type PatchCtwaLeadBody = z.infer<typeof PatchCtwaLeadBodySchema>;

export interface CtwaLeadSummaryMetrics {
  total_leads: number;
  qualified_leads: number;
  needs_review_count: number;
  avg_frt_seconds: number | null;
}

export interface CtwaLeadListItem {
  id: string;
  workspace_id: string;
  conversation_id: string;
  connection_id: string;
  assigned_sales_id: string | null;
  customer_name: string | null;
  customer_phone_masked: string | null;
  lead_temperature: LeadTemperature;
  pipeline_stage: PipelineStage;
  ai_score: number | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  manual_stage_lock: boolean;
  needs_human_review: boolean;
  created_at: string;
  updated_at: string;
  conversation: {
    id: string;
    first_response_time_seconds: number | null;
    last_message_at: string;
    source_type: string;
  } | null;
  attribution: {
    source_id: string;
    headline: string | null;
    campaign_name: string | null;
    adset_name: string | null;
    ad_name: string | null;
  } | null;
  connection: {
    id: string;
    display_phone_number: string | null;
    verified_name: string | null;
  } | null;
}

export interface CtwaLeadEvidenceEntry {
  message_id: string;
  reason: string;
}

export interface CtwaLeadAnalysisDetail {
  id: string;
  model_name: string;
  prompt_version: string;
  lead_temperature: LeadTemperature;
  pipeline_stage_suggestion: PipelineStage;
  score: number;
  confidence: number;
  evidence: CtwaLeadEvidenceEntry[];
  summary: string | null;
  intent_signals: string[];
  property_preferences: {
    project: string | null;
    location: string | null;
    budget: string | null;
    unit_type: string | null;
  };
  objections: string[];
  unanswered_questions: string[];
  created_at: string;
}

export interface CtwaLeadMessageItem {
  id: string;
  wamid: string | null;
  direction: string;
  sender_type: string;
  message_type: string;
  body_text: string | null;
  body: string;
  sent_at: string;
}

export interface CtwaLeadPipelineEventItem {
  id: string;
  actor_type: "ai" | "human" | "system";
  actor_user_id: string | null;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage | null;
  from_temperature: LeadTemperature | null;
  to_temperature: LeadTemperature | null;
  reason: string | null;
  created_at: string;
}

export interface CtwaLeadDetailPayload {
  lead: CtwaLeadListItem;
  attribution: {
    id: string;
    source_id: string;
    source_type: string;
    source_url: string | null;
    headline: string | null;
    body: string | null;
    ctwa_clid: string | null;
    campaign_id: string | null;
    campaign_name: string | null;
    adset_id: string | null;
    adset_name: string | null;
    ad_name: string | null;
    attribution_confidence: number | null;
    created_at: string;
  } | null;
  messages: CtwaLeadMessageItem[];
  analyses: CtwaLeadAnalysisDetail[];
  pipeline_events: CtwaLeadPipelineEventItem[];
}

const QUALIFIED_OR_HIGHER_STAGES = new Set<string>([
  "qualified",
  "survey",
  "closing",
  "won",
]);

export function computeWorkspaceLeadMetrics(
  leads: Array<{
    lead_temperature: string;
    pipeline_stage: string;
    needs_human_review: boolean;
    conversation?: {
      first_response_time_seconds: number | null;
    } | null;
  }>
): CtwaLeadSummaryMetrics {
  let qualifiedLeads = 0;
  let needsReviewCount = 0;
  let frtSum = 0;
  let frtCount = 0;

  for (const lead of leads) {
    if (
      lead.lead_temperature === "warm" ||
      lead.lead_temperature === "hot" ||
      QUALIFIED_OR_HIGHER_STAGES.has(lead.pipeline_stage)
    ) {
      qualifiedLeads += 1;
    }

    if (lead.needs_human_review) {
      needsReviewCount += 1;
    }

    const frt = lead.conversation?.first_response_time_seconds;
    if (typeof frt === "number" && Number.isFinite(frt) && frt >= 0) {
      frtSum += frt;
      frtCount += 1;
    }
  }

  return {
    total_leads: leads.length,
    qualified_leads: qualifiedLeads,
    needs_review_count: needsReviewCount,
    avg_frt_seconds: frtCount > 0 ? Math.round(frtSum / frtCount) : null,
  };
}

export function formatFrtDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const totalSec = Math.round(seconds);
  if (totalSec < 60) {
    return `${totalSec}s`;
  }
  const mins = Math.floor(totalSec / 60);
  const remSec = totalSec % 60;
  if (mins < 60) {
    return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}j ${remMins}m` : `${hours}j`;
}

export function maskCtwaClid(clid: string | null | undefined): string {
  if (!clid || !clid.trim()) return "—";
  const trimmed = clid.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}
