import type { PerformanceStatus } from "@/lib/ads/performance-evaluator";
import type { RecommendedAction } from "./schema";

export type AnalysisScope = "account" | "campaign" | "ad";
export type EntityDeliveryStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "UNKNOWN";
export type PeriodConfidence = "high" | "medium" | "low";

export interface ContextAwareness {
  analyzed_scope: "Account" | "Campaign" | "Ad";
  entity_status: "Active" | "Paused" | "Unknown";
  period_confidence: "High" | "Medium" | "Low";
  period_days: number;
}

export function effectiveDeliveryStatus(
  entityStatus?: string | null,
  parentStatus?: string | null
): EntityDeliveryStatus {
  const parent = normalizeEntityStatus(parentStatus);
  const own = normalizeEntityStatus(entityStatus);
  if (parent === "ARCHIVED" || own === "ARCHIVED") return "ARCHIVED";
  if (parent === "PAUSED" || own === "PAUSED") return "PAUSED";
  if (own === "ACTIVE" && (parent === "ACTIVE" || parent === "UNKNOWN")) return "ACTIVE";
  if (own === "UNKNOWN" && parent === "ACTIVE") return "ACTIVE";
  return own === "UNKNOWN" ? parent : own;
}

export function deliveryStatusLabelId(status: EntityDeliveryStatus): string {
  if (status === "ACTIVE") return "Aktif";
  if (status === "PAUSED") return "Dijeda";
  if (status === "ARCHIVED") return "Diarsipkan";
  return "Tidak diketahui";
}

export function aggregateAccountStatus(statuses: Array<string | null | undefined>): EntityDeliveryStatus {
  if (!statuses.length) return "UNKNOWN";
  const normalized = statuses.map((s) => normalizeEntityStatus(s));
  const unique = new Set(normalized);
  if (unique.size === 1) return normalized[0];
  if (normalized.every((s) => s === "PAUSED" || s === "ARCHIVED")) return "PAUSED";
  return "UNKNOWN";
}

export function normalizeEntityStatus(raw?: string | null): EntityDeliveryStatus {
  const status = (raw || "").toUpperCase();
  if (status === "ACTIVE" || status === "DELIVERING") return "ACTIVE";
  if (
    status === "PAUSED" ||
    status === "CAMPAIGN_PAUSED" ||
    status === "AD_PAUSED" ||
    status === "NOT_DELIVERING"
  ) {
    return "PAUSED";
  }
  if (status === "ARCHIVED" || status === "DELETED") return "ARCHIVED";
  return "UNKNOWN";
}

export function classifyPeriodConfidence(durationDays: number): PeriodConfidence {
  if (durationDays <= 3) return "low";
  if (durationDays < 14) return "medium";
  return "high";
}

export function meetsPerformanceSla(
  performanceStatus: PerformanceStatus,
  actualCpr: number | null,
  targetCpr: number | null
): boolean {
  if (!targetCpr || targetCpr <= 0) return false;
  if (performanceStatus === "memenuhi_target") return true;
  if (actualCpr !== null && targetCpr !== null && targetCpr > 0 && actualCpr <= targetCpr) return true;
  return false;
}

export function isShortObservation(durationDays: number): boolean {
  return durationDays <= 3;
}

export function isStructuralDecisionWindow(durationDays: number): boolean {
  return durationDays >= 14;
}

export function spentBeyondDoubleTarget(spend: number, targetCpr: number | null, results: number | null): boolean {
  if (!targetCpr || targetCpr <= 0) return false;
  const recordedResults = results ?? 0;
  return spend > 2 * targetCpr && recordedResults <= 0;
}

export function buildContextAwareness(input: {
  scope: AnalysisScope;
  entityStatus: EntityDeliveryStatus;
  durationDays: number;
}): ContextAwareness {
  const scopeLabel = input.scope === "account" ? "Account" : input.scope === "campaign" ? "Campaign" : "Ad";
  const entityStatus =
    input.entityStatus === "ACTIVE"
      ? "Active"
      : input.entityStatus === "PAUSED" || input.entityStatus === "ARCHIVED"
        ? "Paused"
        : "Unknown";
  const confidence = classifyPeriodConfidence(input.durationDays);
  return {
    analyzed_scope: scopeLabel,
    entity_status: entityStatus,
    period_confidence: confidence === "high" ? "High" : confidence === "medium" ? "Medium" : "Low",
    period_days: input.durationDays,
  };
}

export function scopeNarrativeRules(scope: AnalysisScope): string {
  if (scope === "account") {
    return "CAKUPAN ACCOUNT: narasi makro portofolio saja. Evaluasi distribusi belanja antar kampanye dan efisiensi akun. DILARANG mengomentari hook, teks iklan, atau kreatif satuan.";
  }
  if (scope === "campaign") {
    return "CAKUPAN CAMPAIGN: bandingkan distribusi performa antar iklan/ad set di dalam kampanye. Jangan memperlakukan ini sebagai audit kreatif satu iklan.";
  }
  return "CAKUPAN AD: fokus mikro pada materi kreatif, CTR tautan, CPC tautan, dan kualitas percakapan CTWA iklan ini.";
}

export function pausedPreferredAction(_meetsSla: boolean): RecommendedAction {
  return "INVESTIGATE";
}
