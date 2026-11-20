import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeLeadConversation } from "@/lib/ai/lead-intelligence/provider";
import { evaluateLeadTransition } from "@/lib/ai/lead-intelligence/pipeline-rules";
import { tryDispatchLeadStageCapi } from "@/lib/meta/capi-messaging";
import type {
  LeadTemperature,
  PipelineStage,
} from "@/lib/ai/lead-intelligence/schema";
import type { Json } from "@/types/database.types";

export interface ProcessPendingLeadAnalysesOptions {
  debounceSeconds?: number;
  batchSize?: number;
  now?: Date;
}

export interface ProcessPendingLeadAnalysesSummary {
  scanned: number;
  analyzed: number;
  skipped: number;
  failed: number;
  stageTransitions: number;
  temperatureTransitions: number;
  errors: Array<{ conversationId: string; message: string }>;
}

const VALID_STAGES = new Set<string>([
  "new_inquiry",
  "contacted",
  "qualified",
  "survey",
  "closing",
  "won",
  "lost",
]);

const VALID_TEMPERATURES = new Set<string>(["cold", "warm", "hot", "junk"]);

function asPipelineStage(raw: string): PipelineStage {
  return VALID_STAGES.has(raw) ? (raw as PipelineStage) : "new_inquiry";
}

function asLeadTemperature(raw: string): LeadTemperature {
  return VALID_TEMPERATURES.has(raw) ? (raw as LeadTemperature) : "cold";
}

export async function processPendingLeadAnalyses(
  options?: ProcessPendingLeadAnalysesOptions
): Promise<ProcessPendingLeadAnalysesSummary> {
  const debounceSeconds = Math.max(0, Math.floor(options?.debounceSeconds ?? 120));
  const batchSize = Math.min(100, Math.max(1, Math.floor(options?.batchSize ?? 10)));
  const referenceNow = options?.now ?? new Date();
  const cutoffIso = new Date(referenceNow.getTime() - debounceSeconds * 1000).toISOString();

  const summary: ProcessPendingLeadAnalysesSummary = {
    scanned: 0,
    analyzed: 0,
    skipped: 0,
    failed: 0,
    stageTransitions: 0,
    temperatureTransitions: 0,
    errors: [],
  };

  const admin = createAdminClient();

  const { data: conversations, error: queryError } = await admin
    .from("conversations")
    .select("id, workspace_id, last_message_at")
    .eq("source_type", "ctwa")
    .eq("needs_ai_analysis", true)
    .lte("last_message_at", cutoffIso)
    .order("last_message_at", { ascending: true })
    .limit(batchSize);

  if (queryError) {
    throw new Error(`Failed to fetch pending CTWA conversations: ${queryError.message}`);
  }

  const pendingList = conversations ?? [];
  summary.scanned = pendingList.length;

  for (const conv of pendingList) {
    try {
      const workspaceId = conv.workspace_id;
      if (!workspaceId) {
        summary.skipped += 1;
        continue;
      }

      const [messagesRes, attributionRes, leadRes] = await Promise.all([
        admin
          .from("messages")
          .select("wamid, direction, body_text, body, message_type, sent_at")
          .eq("conversation_id", conv.id)
          .order("sent_at", { ascending: true }),
        admin
          .from("ctwa_attributions")
          .select("headline, body, source_id, source_url, campaign_name")
          .eq("conversation_id", conv.id)
          .maybeSingle(),
        admin
          .from("leads")
          .select("id, pipeline_stage, lead_temperature, manual_stage_lock")
          .eq("conversation_id", conv.id)
          .maybeSingle(),
      ]);

      if (messagesRes.error) {
        throw new Error(`Failed to load messages: ${messagesRes.error.message}`);
      }
      if (leadRes.error) {
        throw new Error(`Failed to load lead: ${leadRes.error.message}`);
      }

      const messages = messagesRes.data ?? [];
      const lead = leadRes.data;

      if (messages.length === 0 || !lead) {
        summary.skipped += 1;
        continue;
      }

      const analysis = await analyzeLeadConversation({
        messages,
        attribution: attributionRes.data ?? null,
      });

      const currentStage = asPipelineStage(lead.pipeline_stage);
      const currentTemp = asLeadTemperature(lead.lead_temperature);

      const transition = evaluateLeadTransition({
        currentLead: {
          pipeline_stage: currentStage,
          lead_temperature: currentTemp,
          manual_stage_lock: Boolean(lead.manual_stage_lock),
        },
        aiOutput: analysis.output,
        messages: messages.map((m) => ({
          wamid: m.wamid,
          direction: m.direction,
        })),
      });

      const roundedConfidence = Number(analysis.output.confidence.toFixed(2));

      const { error: snapshotErr } = await admin.from("lead_ai_analyses").insert({
        workspace_id: workspaceId,
        lead_id: lead.id,
        conversation_id: conv.id,
        model_name: analysis.modelName,
        prompt_version: analysis.promptVersion,
        raw_output: analysis.rawOutput as Json,
        lead_temperature: transition.nextTemperature,
        pipeline_stage_suggestion: analysis.output.pipeline_stage_suggestion,
        score: analysis.output.score,
        confidence: roundedConfidence,
        evidence: transition.validEvidence as unknown as Json,
      });

      if (snapshotErr) {
        throw new Error(`Failed to save lead_ai_analyses: ${snapshotErr.message}`);
      }

      const { error: updateLeadErr } = await admin
        .from("leads")
        .update({
          ai_score: analysis.output.score,
          ai_confidence: roundedConfidence,
          ai_summary: analysis.output.summary,
          lead_temperature: transition.nextTemperature,
          pipeline_stage: transition.nextStage,
          needs_human_review: transition.needsHumanReview,
        })
        .eq("id", lead.id);

      if (updateLeadErr) {
        throw new Error(`Failed to update lead: ${updateLeadErr.message}`);
      }

      if (transition.stageChanged || transition.temperatureChanged) {
        const { error: eventErr } = await admin.from("lead_pipeline_events").insert({
          workspace_id: workspaceId,
          lead_id: lead.id,
          actor_type: "ai",
          from_stage: currentStage,
          to_stage: transition.nextStage,
          from_temperature: currentTemp,
          to_temperature: transition.nextTemperature,
          reason: transition.transitionReason,
        });

        if (eventErr) {
          throw new Error(`Failed to insert lead_pipeline_events: ${eventErr.message}`);
        }
      }

      const analyzedAtIso = new Date().toISOString();
      const { error: convUpdateErr } = await admin
        .from("conversations")
        .update({
          needs_ai_analysis: false,
          last_ai_analyzed_at: analyzedAtIso,
        })
        .eq("id", conv.id);

      if (convUpdateErr) {
        throw new Error(`Failed to mark conversation analyzed: ${convUpdateErr.message}`);
      }

      if (transition.stageChanged) {
        await tryDispatchLeadStageCapi({
          workspaceId,
          leadId: lead.id,
          nextStage: transition.nextStage,
          conversationId: conv.id,
        });
      }

      summary.analyzed += 1;
      if (transition.stageChanged) summary.stageTransitions += 1;
      if (transition.temperatureChanged) summary.temperatureTransitions += 1;
    } catch (err: unknown) {
      summary.failed += 1;
      summary.errors.push({
        conversationId: conv.id,
        message: err instanceof Error ? err.message : "Unknown worker error",
      });
    }
  }

  return summary;
}
