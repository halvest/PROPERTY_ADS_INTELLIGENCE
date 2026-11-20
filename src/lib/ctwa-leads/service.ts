import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { tryDispatchLeadStageCapi } from "@/lib/meta/capi-messaging";
import {
  computeWorkspaceLeadMetrics,
  LEAD_TEMPERATURES,
  PIPELINE_STAGES,
  type CtwaLeadAnalysisDetail,
  type CtwaLeadDetailPayload,
  type CtwaLeadEvidenceEntry,
  type CtwaLeadListItem,
  type CtwaLeadSummaryMetrics,
  type LeadTemperature,
  type PatchCtwaLeadBody,
  type PipelineStage,
} from "@/lib/ctwa-leads/types";

export interface CtwaLeadsFilter {
  temperature?: string | null;
  stage?: string | null;
  needsReview?: boolean;
  connectionId?: string | null;
  search?: string | null;
}

export interface CtwaLeadsListResult {
  summary: CtwaLeadSummaryMetrics;
  leads: CtwaLeadListItem[];
  connections: Array<{
    id: string;
    display_phone_number: string | null;
    verified_name: string | null;
    connection_status: string;
  }>;
}

const VALID_TEMPS = new Set<string>(LEAD_TEMPERATURES);
const VALID_STAGES = new Set<string>(PIPELINE_STAGES);

function normalizeTemp(raw: string): LeadTemperature {
  return VALID_TEMPS.has(raw) ? (raw as LeadTemperature) : "cold";
}

function normalizeStage(raw: string): PipelineStage {
  return VALID_STAGES.has(raw) ? (raw as PipelineStage) : "new_inquiry";
}

function unwrapSingle<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

function parseEvidenceList(raw: unknown): CtwaLeadEvidenceEntry[] {
  if (!Array.isArray(raw)) return [];
  const items: CtwaLeadEvidenceEntry[] = [];
  for (const entry of raw) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).message_id === "string" &&
      typeof (entry as Record<string, unknown>).reason === "string"
    ) {
      items.push({
        message_id: String((entry as Record<string, unknown>).message_id),
        reason: String((entry as Record<string, unknown>).reason),
      });
    }
  }
  return items;
}

function parseAnalysisRow(row: {
  id: string;
  model_name: string;
  prompt_version: string;
  lead_temperature: string;
  pipeline_stage_suggestion: string;
  score: number;
  confidence: number;
  evidence: unknown;
  raw_output: unknown;
  created_at: string;
}): CtwaLeadAnalysisDetail {
  const rawObj =
    row.raw_output && typeof row.raw_output === "object" && !Array.isArray(row.raw_output)
      ? (row.raw_output as Record<string, unknown>)
      : {};

  const prefs =
    rawObj.property_preferences &&
    typeof rawObj.property_preferences === "object" &&
    !Array.isArray(rawObj.property_preferences)
      ? (rawObj.property_preferences as Record<string, unknown>)
      : {};

  const toStringArray = (val: unknown): string[] =>
    Array.isArray(val) ? val.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];

  const toNullableString = (val: unknown): string | null =>
    typeof val === "string" && val.trim().length > 0 ? val.trim() : null;

  return {
    id: row.id,
    model_name: row.model_name,
    prompt_version: row.prompt_version,
    lead_temperature: normalizeTemp(row.lead_temperature),
    pipeline_stage_suggestion: normalizeStage(row.pipeline_stage_suggestion),
    score: row.score,
    confidence: Number(row.confidence),
    evidence: parseEvidenceList(row.evidence),
    summary: toNullableString(rawObj.summary),
    intent_signals: toStringArray(rawObj.intent_signals),
    property_preferences: {
      project: toNullableString(prefs.project),
      location: toNullableString(prefs.location),
      budget: toNullableString(prefs.budget),
      unit_type: toNullableString(prefs.unit_type),
    },
    objections: toStringArray(rawObj.objections),
    unanswered_questions: toStringArray(rawObj.unanswered_questions),
    created_at: row.created_at,
  };
}

export async function listCtwaLeads(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  filters: CtwaLeadsFilter
): Promise<CtwaLeadsListResult> {
  const [leadsRes, attrsRes, connsRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        `
        id,
        workspace_id,
        conversation_id,
        connection_id,
        assigned_sales_id,
        customer_name,
        customer_phone_masked,
        lead_temperature,
        pipeline_stage,
        ai_score,
        ai_confidence,
        ai_summary,
        manual_stage_lock,
        needs_human_review,
        created_at,
        updated_at,
        conversation:conversations(id, first_response_time_seconds, last_message_at, source_type),
        connection:whatsapp_connections(id, display_phone_number, verified_name)
      `
      )
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("ctwa_attributions")
      .select("conversation_id, source_id, headline, campaign_name, adset_name, ad_name")
      .eq("workspace_id", workspaceId),
    supabase
      .from("whatsapp_connections")
      .select("id, display_phone_number, verified_name, connection_status")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  if (leadsRes.error) {
    throw new Error(`Failed to fetch CTWA leads: ${leadsRes.error.message}`);
  }
  if (attrsRes.error) {
    throw new Error(`Failed to fetch CTWA attributions: ${attrsRes.error.message}`);
  }

  const attrByConvId = new Map<
    string,
    {
      source_id: string;
      headline: string | null;
      campaign_name: string | null;
      adset_name: string | null;
      ad_name: string | null;
    }
  >();

  for (const attr of attrsRes.data ?? []) {
    attrByConvId.set(attr.conversation_id, {
      source_id: attr.source_id,
      headline: attr.headline,
      campaign_name: attr.campaign_name,
      adset_name: attr.adset_name,
      ad_name: attr.ad_name,
    });
  }

  const allLeads: CtwaLeadListItem[] = (leadsRes.data ?? []).map((row) => {
    const conv = unwrapSingle(
      row.conversation as
        | {
            id: string;
            first_response_time_seconds: number | null;
            last_message_at: string;
            source_type: string;
          }
        | Array<{
            id: string;
            first_response_time_seconds: number | null;
            last_message_at: string;
            source_type: string;
          }>
        | null
    );
    const conn = unwrapSingle(
      row.connection as
        | {
            id: string;
            display_phone_number: string | null;
            verified_name: string | null;
          }
        | Array<{
            id: string;
            display_phone_number: string | null;
            verified_name: string | null;
          }>
        | null
    );

    return {
      id: row.id,
      workspace_id: row.workspace_id,
      conversation_id: row.conversation_id,
      connection_id: row.connection_id,
      assigned_sales_id: row.assigned_sales_id,
      customer_name: row.customer_name,
      customer_phone_masked: row.customer_phone_masked,
      lead_temperature: normalizeTemp(row.lead_temperature),
      pipeline_stage: normalizeStage(row.pipeline_stage),
      ai_score: row.ai_score,
      ai_confidence: row.ai_confidence !== null ? Number(row.ai_confidence) : null,
      ai_summary: row.ai_summary,
      manual_stage_lock: Boolean(row.manual_stage_lock),
      needs_human_review: Boolean(row.needs_human_review),
      created_at: row.created_at,
      updated_at: row.updated_at,
      conversation: conv,
      attribution: attrByConvId.get(row.conversation_id) ?? null,
      connection: conn,
    };
  });

  // Sort by latest conversation activity descending
  allLeads.sort((a, b) => {
    const aTime = a.conversation?.last_message_at ?? a.updated_at;
    const bTime = b.conversation?.last_message_at ?? b.updated_at;
    return Date.parse(bTime) - Date.parse(aTime);
  });

  const summary = computeWorkspaceLeadMetrics(allLeads);

  const tempFilter = filters.temperature?.trim().toLowerCase();
  const stageFilter = filters.stage?.trim().toLowerCase();
  const connFilter = filters.connectionId?.trim();
  const searchLower = filters.search?.trim().toLowerCase();

  const filteredLeads = allLeads.filter((lead) => {
    if (tempFilter && tempFilter !== "all" && lead.lead_temperature !== tempFilter) {
      return false;
    }
    if (stageFilter && stageFilter !== "all" && lead.pipeline_stage !== stageFilter) {
      return false;
    }
    if (filters.needsReview && !lead.needs_human_review) {
      return false;
    }
    if (connFilter && connFilter !== "all" && lead.connection_id !== connFilter) {
      return false;
    }
    if (searchLower) {
      const haystacks = [
        lead.customer_name,
        lead.customer_phone_masked,
        lead.attribution?.headline,
        lead.attribution?.source_id,
        lead.attribution?.campaign_name,
      ]
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase());

      if (!haystacks.some((h) => h.includes(searchLower))) {
        return false;
      }
    }
    return true;
  });

  return {
    summary,
    leads: filteredLeads,
    connections: connsRes.data ?? [],
  };
}

export async function getCtwaLeadDetail(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  leadId: string
): Promise<CtwaLeadDetailPayload | null> {
  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select(
      `
      id,
      workspace_id,
      conversation_id,
      connection_id,
      assigned_sales_id,
      customer_name,
      customer_phone_masked,
      lead_temperature,
      pipeline_stage,
      ai_score,
      ai_confidence,
      ai_summary,
      manual_stage_lock,
      needs_human_review,
      created_at,
      updated_at,
      conversation:conversations(id, first_response_time_seconds, last_message_at, source_type),
      connection:whatsapp_connections(id, display_phone_number, verified_name)
    `
    )
    .eq("id", leadId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (leadErr) {
    throw new Error(`Failed to fetch lead detail: ${leadErr.message}`);
  }
  if (!leadRow) {
    return null;
  }

  const [attrRes, messagesRes, analysesRes, eventsRes] = await Promise.all([
    supabase
      .from("ctwa_attributions")
      .select(
        "id, source_id, source_type, source_url, headline, body, ctwa_clid, campaign_id, campaign_name, adset_id, adset_name, ad_name, attribution_confidence, created_at"
      )
      .eq("conversation_id", leadRow.conversation_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id, wamid, direction, sender_type, message_type, body_text, body, sent_at")
      .eq("conversation_id", leadRow.conversation_id)
      .eq("workspace_id", workspaceId)
      .order("sent_at", { ascending: true }),
    supabase
      .from("lead_ai_analyses")
      .select(
        "id, model_name, prompt_version, lead_temperature, pipeline_stage_suggestion, score, confidence, evidence, raw_output, created_at"
      )
      .eq("lead_id", leadRow.id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_pipeline_events")
      .select(
        "id, actor_type, actor_user_id, from_stage, to_stage, from_temperature, to_temperature, reason, created_at"
      )
      .eq("lead_id", leadRow.id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  if (messagesRes.error) {
    throw new Error(`Failed to fetch conversation messages: ${messagesRes.error.message}`);
  }
  if (analysesRes.error) {
    throw new Error(`Failed to fetch AI analyses: ${analysesRes.error.message}`);
  }
  if (eventsRes.error) {
    throw new Error(`Failed to fetch pipeline events: ${eventsRes.error.message}`);
  }

  const conv = unwrapSingle(
    leadRow.conversation as
      | {
          id: string;
          first_response_time_seconds: number | null;
          last_message_at: string;
          source_type: string;
        }
      | Array<{
          id: string;
          first_response_time_seconds: number | null;
          last_message_at: string;
          source_type: string;
        }>
      | null
  );
  const conn = unwrapSingle(
    leadRow.connection as
      | {
          id: string;
          display_phone_number: string | null;
          verified_name: string | null;
        }
      | Array<{
          id: string;
          display_phone_number: string | null;
          verified_name: string | null;
        }>
      | null
  );

  const attr = attrRes.data ?? null;

  return {
    lead: {
      id: leadRow.id,
      workspace_id: leadRow.workspace_id,
      conversation_id: leadRow.conversation_id,
      connection_id: leadRow.connection_id,
      assigned_sales_id: leadRow.assigned_sales_id,
      customer_name: leadRow.customer_name,
      customer_phone_masked: leadRow.customer_phone_masked,
      lead_temperature: normalizeTemp(leadRow.lead_temperature),
      pipeline_stage: normalizeStage(leadRow.pipeline_stage),
      ai_score: leadRow.ai_score,
      ai_confidence: leadRow.ai_confidence !== null ? Number(leadRow.ai_confidence) : null,
      ai_summary: leadRow.ai_summary,
      manual_stage_lock: Boolean(leadRow.manual_stage_lock),
      needs_human_review: Boolean(leadRow.needs_human_review),
      created_at: leadRow.created_at,
      updated_at: leadRow.updated_at,
      conversation: conv,
      attribution: attr
        ? {
            source_id: attr.source_id,
            headline: attr.headline,
            campaign_name: attr.campaign_name,
            adset_name: attr.adset_name,
            ad_name: attr.ad_name,
          }
        : null,
      connection: conn,
    },
    attribution: attr
      ? {
          ...attr,
          attribution_confidence:
            attr.attribution_confidence !== null ? Number(attr.attribution_confidence) : null,
        }
      : null,
    messages: messagesRes.data ?? [],
    analyses: (analysesRes.data ?? []).map(parseAnalysisRow),
    pipeline_events: (eventsRes.data ?? []).map((ev) => ({
      id: ev.id,
      actor_type: ev.actor_type === "ai" || ev.actor_type === "human" ? ev.actor_type : "system",
      actor_user_id: ev.actor_user_id,
      from_stage: ev.from_stage ? normalizeStage(ev.from_stage) : null,
      to_stage: ev.to_stage ? normalizeStage(ev.to_stage) : null,
      from_temperature: ev.from_temperature ? normalizeTemp(ev.from_temperature) : null,
      to_temperature: ev.to_temperature ? normalizeTemp(ev.to_temperature) : null,
      reason: ev.reason,
      created_at: ev.created_at,
    })),
  };
}

export interface UpdateCtwaLeadOverrideResult {
  lead: {
    id: string;
    pipeline_stage: PipelineStage;
    lead_temperature: LeadTemperature;
    manual_stage_lock: boolean;
    needs_human_review: boolean;
    updated_at: string;
  };
  auditEventRecorded: boolean;
}

export async function updateCtwaLeadOverride(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  leadId: string,
  body: PatchCtwaLeadBody
): Promise<UpdateCtwaLeadOverrideResult | null> {
  const { data: current, error: fetchErr } = await supabase
    .from("leads")
    .select(
      "id, workspace_id, pipeline_stage, lead_temperature, manual_stage_lock, needs_human_review"
    )
    .eq("id", leadId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Failed to load lead for override: ${fetchErr.message}`);
  }
  if (!current) {
    return null;
  }

  const currentStage = normalizeStage(current.pipeline_stage);
  const currentTemp = normalizeTemp(current.lead_temperature);
  const currentLock = Boolean(current.manual_stage_lock);
  const currentReview = Boolean(current.needs_human_review);

  const nextStage = body.pipeline_stage ?? currentStage;
  const nextTemperature = body.lead_temperature ?? currentTemp;

  const stageChanged = nextStage !== currentStage;
  const tempChanged = nextTemperature !== currentTemp;

  // Hard rule: manual stage change ALWAYS sets manual_stage_lock = true
  const nextManualStageLock = stageChanged
    ? true
    : body.manual_stage_lock !== undefined
      ? body.manual_stage_lock
      : currentLock;

  // Hard rule: confirming review (explicit false or human override) clears needs_human_review
  const nextNeedsHumanReview =
    body.needs_human_review !== undefined
      ? body.needs_human_review
      : stageChanged || tempChanged
        ? false
        : currentReview;

  const lockChanged = nextManualStageLock !== currentLock;
  const reviewResolved = currentReview && !nextNeedsHumanReview;

  const { data: updated, error: updateErr } = await supabase
    .from("leads")
    .update({
      pipeline_stage: nextStage,
      lead_temperature: nextTemperature,
      manual_stage_lock: nextManualStageLock,
      needs_human_review: nextNeedsHumanReview,
    })
    .eq("id", leadId)
    .eq("workspace_id", workspaceId)
    .select("id, pipeline_stage, lead_temperature, manual_stage_lock, needs_human_review, updated_at")
    .single();

  if (updateErr || !updated) {
    throw new Error(`Failed to update lead: ${updateErr?.message || "Unknown error"}`);
  }

  const shouldInsertAudit =
    stageChanged || tempChanged || lockChanged || reviewResolved || Boolean(body.reason);

  let auditEventRecorded = false;
  if (shouldInsertAudit) {
    const fallbackReasonParts: string[] = [];
    if (stageChanged) fallbackReasonParts.push(`Manual stage change: ${currentStage} -> ${nextStage}`);
    if (tempChanged) fallbackReasonParts.push(`Manual temperature change: ${currentTemp} -> ${nextTemperature}`);
    if (lockChanged) {
      fallbackReasonParts.push(
        nextManualStageLock ? "Manual stage lock enabled" : "Manual stage lock disabled"
      );
    }
    if (reviewResolved) fallbackReasonParts.push("AI classification reviewed and confirmed by human");

    const auditReason = body.reason?.trim() || fallbackReasonParts.join("; ") || "Manual review update";

    const { error: eventErr } = await supabase.from("lead_pipeline_events").insert({
      workspace_id: workspaceId,
      lead_id: current.id,
      actor_type: "human",
      actor_user_id: userId,
      from_stage: currentStage,
      to_stage: nextStage,
      from_temperature: currentTemp,
      to_temperature: nextTemperature,
      reason: auditReason,
    });

    if (eventErr) {
      throw new Error(`Failed to record audit event: ${eventErr.message}`);
    }
    auditEventRecorded = true;
  }

  if (stageChanged) {
    await tryDispatchLeadStageCapi({
      workspaceId,
      leadId: current.id,
      nextStage,
    });
  }

  return {
    lead: {
      id: updated.id,
      pipeline_stage: normalizeStage(updated.pipeline_stage),
      lead_temperature: normalizeTemp(updated.lead_temperature),
      manual_stage_lock: Boolean(updated.manual_stage_lock),
      needs_human_review: Boolean(updated.needs_human_review),
      updated_at: updated.updated_at,
    },
    auditEventRecorded,
  };
}
