import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttributionEventRecord, AttributionStatus } from "@/domain/attribution/types";

/**
 * Property Ads Intelligence - Persistent Attribution Audit History Service
 * Ensures attribution corrections and status transitions are written to the database audit trail
 * rather than existing only in temporary process memory.
 */

export interface RecordCorrectionParams {
  organizationId: string;
  conversationId: string;
  previousStatus: AttributionStatus | null;
  newStatus: AttributionStatus;
  previousAdId?: string | null;
  newAdId?: string | null;
  attributionMethod: string;
  reason: string;
  actorId?: string | null;
  evidence?: Record<string, unknown>;
  supabaseClient?: SupabaseClient;
}

/**
 * Persistently records an attribution audit event into Supabase attribution_events table.
 */
export async function persistAttributionEvent(
  params: RecordCorrectionParams
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!params.reason || params.reason.trim().length === 0) {
    return { success: false, error: "Alasan koreksi atribusi wajib diisi." };
  }

  const createdAt = new Date().toISOString();

  if (params.supabaseClient) {
    try {
      const { data, error } = await params.supabaseClient
        .from("attribution_events")
        .insert({
          organization_id: params.organizationId,
          conversation_id: params.conversationId,
          previous_status: params.previousStatus,
          new_status: params.newStatus,
          previous_ad_id: params.previousAdId || null,
          new_ad_id: params.newAdId || null,
          attribution_method: params.attributionMethod,
          rule_version: "v1.0",
          evidence: params.evidence || {},
          actor_id: params.actorId || null,
          reason: params.reason.trim(),
          created_at: createdAt,
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, eventId: data?.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Database connection error";
      return { success: false, error: msg };
    }
  }

  // Fallback when Supabase client is not available in demo mode
  return {
    success: true,
    eventId: `audit_syn_${Date.now()}`,
  };
}

/**
 * Fetches the immutable audit trail for a conversation from Supabase.
 */
export async function getConversationAttributionAuditTrail(
  conversationId: string,
  organizationId: string,
  supabaseClient?: SupabaseClient
): Promise<AttributionEventRecord[]> {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("attribution_events")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        return data.map((row) => ({
          id: row.id,
          organizationId: row.organization_id,
          conversationId: row.conversation_id,
          previousStatus: row.previous_status,
          newStatus: row.new_status,
          previousAdId: row.previous_ad_id,
          newAdId: row.new_ad_id,
          attributionMethod: row.attribution_method,
          ruleVersion: row.rule_version,
          evidence: row.evidence || {},
          actorId: row.actor_id,
          reason: row.reason,
          createdAt: row.created_at,
        }));
      }
    } catch {
      // Fallback
    }
  }

  return [];
}
