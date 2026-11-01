import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Quota stays off for testing until explicitly enabled in production. */
export function isAiAnalysisQuotaEnabled() {
  return process.env.AI_ANALYSIS_QUOTA_ENABLED === "true";
}

/**
 * Validates a client-supplied Idempotency-Key.
 *
 * Returns the key only when it is a well-formed UUID; otherwise null.
 * The server NEVER invents a replacement key: a missing or malformed key
 * must be rejected by the caller, otherwise a retry could silently consume
 * quota twice under a fresh random key.
 */
export function validateIdempotencyKey(value: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

export async function reserveAiAnalysis(userId: string, key: string) {
  if (!isAiAnalysisQuotaEnabled()) {
    return { ok: true as const, reservationId: null, bypassed: true as const };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_ai_analysis_usage", {
    p_user_id: userId,
    p_idempotency_key: key,
  });
  if (error || !data?.[0]) {
    console.error("[AI quota] Reservation failed", error?.code || "NO_RESULT");
    return { ok: false as const, unavailable: true as const };
  }
  const result = data[0];
  if (!result.allowed || !result.reservation_id) {
    return { ok: false as const, unavailable: false as const, status: result.reservation_status, resetAt: result.next_available_at };
  }
  return { ok: true as const, reservationId: result.reservation_id, bypassed: false as const };
}

export async function finishAiAnalysis(userId: string, reservationId: string, succeeded: boolean, failureCode?: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("complete_ai_analysis_usage", {
    p_user_id: userId,
    p_reservation_id: reservationId,
    p_succeeded: succeeded,
    p_failure_code: failureCode || null,
  });
  if (error || data !== true) {
    console.error("[AI quota] Reservation completion failed", error?.code || "NO_RESULT");
    return false;
  }
  return true;
}

export async function readAiAnalysisUsage(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_ai_analysis_usage", { p_user_id: userId });
  if (error || !data?.[0]) {
    console.error("[AI quota] Usage read failed", error?.code || "NO_RESULT");
    return null;
  }
  return data[0];
}

