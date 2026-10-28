/**
 * Property Ads Intelligence - Sales Funnel & Business Outcome Domain
 * Manages the 5-stage conceptual property sales funnel:
 * Baru -> Dihubungi -> Prospek -> Survei -> Closing / Batal.
 * 
 * STRICT INVARIANT: Funnel stage changes require verified business events,
 * and must NEVER be automatically advanced based solely on Buyer Score or Sales Score.
 */

export type FunnelStage =
  | "baru"
  | "dihubungi"
  | "prospek"
  | "survei"
  | "closing"
  | "batal";

export interface FunnelTransitionEvent {
  conversationId: string;
  fromStage: FunnelStage;
  toStage: FunnelStage;
  eventReason: string;
  verifiedEventEvidence?: string;
  occurredAt: string;
  actorId?: string | null;
}

export interface FunnelState {
  currentStage: FunnelStage;
  stageHistory: FunnelTransitionEvent[];
}

/**
 * Valid allowed forward/backward funnel transitions.
 */
const ALLOWED_TRANSITIONS: Record<FunnelStage, FunnelStage[]> = {
  baru: ["dihubungi", "prospek", "batal"],
  dihubungi: ["prospek", "survei", "batal"],
  prospek: ["survei", "closing", "batal"],
  survei: ["prospek", "closing", "batal"],
  closing: [], // Terminal won
  batal: ["prospek"], // Re-activation possible
};

/**
 * Pure function to transition a lead's funnel stage.
 * Validates transition rules and logs event history.
 */
export function transitionFunnelStage(
  currentState: FunnelState,
  targetStage: FunnelStage,
  params: {
    conversationId: string;
    eventReason: string;
    verifiedEventEvidence?: string;
    actorId?: string | null;
    occurredAt?: string;
  }
): FunnelState {
  if (currentState.currentStage === targetStage) {
    return currentState;
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentState.currentStage];
  if (!allowedNext.includes(targetStage)) {
    throw new Error(
      `Transisi tahap funnel tidak diizinkan: dari '${currentState.currentStage}' ke '${targetStage}'`
    );
  }

  if (!params.eventReason || params.eventReason.trim().length === 0) {
    throw new Error("Perubahan tahap funnel memerlukan alasan atau bukti peristiwa nyata");
  }

  const transitionEvent: FunnelTransitionEvent = {
    conversationId: params.conversationId,
    fromStage: currentState.currentStage,
    toStage: targetStage,
    eventReason: params.eventReason.trim(),
    verifiedEventEvidence: params.verifiedEventEvidence,
    occurredAt: params.occurredAt || new Date().toISOString(),
    actorId: params.actorId || null,
  };

  return {
    currentStage: targetStage,
    stageHistory: [...currentState.stageHistory, transitionEvent],
  };
}
