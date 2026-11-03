import type { DataSufficiencyStatus, PerformanceStatus } from "@/lib/ads/performance-evaluator";
import {
  buildContextAwareness,
  classifyPeriodConfidence,
  isShortObservation,
  isStructuralDecisionWindow,
  meetsPerformanceSla,
  pausedPreferredAction,
  spentBeyondDoubleTarget,
  type AnalysisScope,
  type EntityDeliveryStatus,
} from "./dynamic-context";
import {
  ACTION_TO_BUDGET_DECISION,
  type CtwaModelOutput,
  type RecommendedAction,
} from "./schema";

export interface ActionGuardrailInput {
  dataStatus: DataSufficiencyStatus;
  durationDays: number;
  hasChatTranscript: boolean;
  entityStatus?: EntityDeliveryStatus;
  analysisScope?: AnalysisScope;
  spend?: number;
  results?: number | null;
  targetCpr?: number | null;
  performanceStatus?: PerformanceStatus;
  actualCpr?: number | null;
}

/**
 * Server-side policy: LLM narrative cannot override data-sufficiency math,
 * paused-object rules, or short-window confidence.
 */
export function enforceRecommendedAction(
  proposed: RecommendedAction,
  input: ActionGuardrailInput
): { action: RecommendedAction; overridden: boolean; reason: string | null } {
  const entityStatus = input.entityStatus ?? "UNKNOWN";
  const paused = entityStatus === "PAUSED" || entityStatus === "ARCHIVED";
  const sla = meetsPerformanceSla(
    input.performanceStatus ?? "belum_dapat_dinilai",
    input.actualCpr ?? null,
    input.targetCpr ?? null
  );
  const doubleBurn = spentBeyondDoubleTarget(input.spend ?? 0, input.targetCpr ?? null, input.results ?? null);
  const thinSample = input.dataStatus !== "cukup" || isShortObservation(input.durationDays);

  if (paused) {
    const action = pausedPreferredAction(sla);
    if (proposed === "STOP" || proposed === "OPTIMIZE" || proposed === "SCALE" || proposed !== action) {
      return {
        action,
        overridden: proposed !== action,
        reason: "Objek sedang dijeda. CPR historis tidak menjadi perintah aktivasi, kenaikan anggaran, atau stop-loss.",
      };
    }
  }

  if (isShortObservation(input.durationDays)) {
    if (proposed === "STOP" || proposed === "SCALE" || proposed === "OPTIMIZE") {
      const action: RecommendedAction = doubleBurn || proposed === "STOP" || proposed === "SCALE" ? "INVESTIGATE" : "MAINTAIN";
      return {
        action,
        overridden: true,
        reason: doubleBurn
          ? `Periode ${input.durationDays} hari (1–3): confidence rendah/sedang. Belanja > 2x target CPR tanpa hasil — PANTAU/INVESTIGATE, bukan perubahan struktural.`
          : `Periode ${input.durationDays} hari (1–3): confidence LOW. Hanya MAINTAIN/PANTAU; jangan SCALE/KILL.`,
      };
    }
  }

  if (proposed === "STOP" && thinSample) {
    return {
      action: "INVESTIGATE",
      overridden: true,
      reason: `STOP dilarang: status data ${input.dataStatus}, durasi ${input.durationDays} hari (≤ 3 atau tidak cukup).`,
    };
  }

  if (proposed === "SCALE" && thinSample) {
    return {
      action: "INVESTIGATE",
      overridden: true,
      reason: `SCALE dilarang: sampel belum memadai (status ${input.dataStatus}, ${input.durationDays} hari).`,
    };
  }

  if ((proposed === "SCALE" || proposed === "STOP") && !isStructuralDecisionWindow(input.durationDays)) {
    return {
      action: proposed === "STOP" && doubleBurn && input.durationDays >= 7 ? "STOP" : proposed === "SCALE" ? "MAINTAIN" : "INVESTIGATE",
      overridden: !(proposed === "STOP" && doubleBurn && input.durationDays >= 7),
      reason:
        proposed === "STOP" && doubleBurn && input.durationDays >= 7
          ? null
          : `SCALE/KILL hanya diizinkan pada jendela 14–30 hari (periode aktual ${input.durationDays} hari).`,
    };
  }

  if (proposed === "SCALE" && !input.hasChatTranscript && input.dataStatus === "tidak_valid") {
    return {
      action: "INVESTIGATE",
      overridden: true,
      reason: "SCALE dilarang tanpa transkrip CTWA dan saat data tidak valid.",
    };
  }

  return { action: proposed, overridden: false, reason: null };
}

export function removeUnconfiguredBudgetClaims(text: string, targetCpr: number | null | undefined): string {
  if (targetCpr && targetCpr > 0) return text;
  return text
    .replace(/stop-?loss[^.]{0,80}/gi, "Stop-loss numerik tidak dihitung karena target CPR belum diatur")
    .replace(/naikkan (anggaran|budget)[^.]{0,60}/gi, "Kenaikan anggaran tidak dihitung karena target belum diatur");
}

export function applyGuardrailsToModelOutput(
  output: CtwaModelOutput,
  input: ActionGuardrailInput,
  groundTruthMetrics: CtwaModelOutput["justification_metrics"]
): CtwaModelOutput {
  const enforced = enforceRecommendedAction(output.recommended_action, input);
  const decision = ACTION_TO_BUDGET_DECISION[enforced.action];
  const reason = removeUnconfiguredBudgetClaims(
    enforced.overridden
      ? `${enforced.reason} ${output.budgetDecision.reason}`.trim()
      : output.budgetDecision.reason,
    input.targetCpr
  );
  const performanceSummary = removeUnconfiguredBudgetClaims(output.performanceSummary, input.targetCpr);
  const context_awareness = buildContextAwareness({
    scope: input.analysisScope ?? "ad",
    entityStatus: input.entityStatus ?? "UNKNOWN",
    durationDays: input.durationDays,
  });

  return {
    ...output,
    performanceSummary,
    recommended_action: enforced.action,
    justification_metrics: groundTruthMetrics,
    budgetDecision: {
      decision,
      reason,
    },
    context_awareness,
  };
}

export { classifyPeriodConfidence };
