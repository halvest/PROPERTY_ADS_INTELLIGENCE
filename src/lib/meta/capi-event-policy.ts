export interface CapiDispatchDecision {
  send: false;
  status: "not_configured" | "unmapped";
  reason: string;
}

/**
 * Internal pipeline stages are not Meta standard events.
 * Survey is not Schedule. Won is not Purchase.
 * There is no per-tenant dataset, so nothing is sent to a shared dataset.
 */
export function decideCapiDispatch(stage: string): CapiDispatchDecision {
  const normalized = stage.trim().toLowerCase();
  if (normalized === "survey" || normalized === "won" || normalized === "qualified") {
    return {
      send: false,
      status: "unmapped",
      reason: `Pipeline stage "${normalized}" is not a verified Meta conversion. No event was sent.`,
    };
  }
  return {
    send: false,
    status: "not_configured",
    reason: "No tenant-scoped Conversions API dataset is configured. No event was sent.",
  };
}
