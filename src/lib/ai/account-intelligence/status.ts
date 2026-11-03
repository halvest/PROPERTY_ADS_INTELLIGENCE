export type OperationalStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | "UNKNOWN";

export interface ResolvedObjectStatus {
  configured: OperationalStatus;
  effective: OperationalStatus;
  delivery: OperationalStatus | null;
}

export function classifyMetaStatus(raw?: string | null): OperationalStatus {
  const status = (raw || "").trim().toUpperCase();
  if (!status) return "UNKNOWN";
  if (status.includes("DELETE")) return "DELETED";
  if (status.includes("ARCHIVED")) return "ARCHIVED";
  if (
    status.includes("PAUSED") ||
    status === "NOT_DELIVERING" ||
    status === "ADSET_PAUSED" ||
    status === "CAMPAIGN_PAUSED" ||
    status === "AD_PAUSED"
  ) {
    return "PAUSED";
  }
  if (status === "ACTIVE" || status === "DELIVERING") return "ACTIVE";
  return "UNKNOWN";
}

/**
 * Effective status follows the parent chain. A configured ACTIVE ad under a
 * paused campaign is paused. An unknown parent is not treated as active.
 * Ad set status is only applied when the caller actually has that status.
 */
export function resolveOperationalStatus(input: {
  configuredStatus?: string | null;
  campaignStatus?: string | null;
  adSetStatus?: string | null;
  adSetStatusKnown?: boolean;
  metaEffectiveStatus?: string | null;
}): ResolvedObjectStatus {
  const configured = classifyMetaStatus(input.configuredStatus);
  const campaign = input.campaignStatus === undefined ? null : classifyMetaStatus(input.campaignStatus);
  const adSet = input.adSetStatusKnown ? classifyMetaStatus(input.adSetStatus) : null;
  const delivery = input.metaEffectiveStatus === undefined || input.metaEffectiveStatus === null
    ? null
    : classifyMetaStatus(input.metaEffectiveStatus);

  const blockers = [campaign, adSet, configured, delivery].filter((status): status is OperationalStatus => status !== null);
  if (blockers.includes("DELETED")) return { configured, effective: "DELETED", delivery };
  if (blockers.includes("ARCHIVED")) return { configured, effective: "ARCHIVED", delivery };
  if (blockers.includes("PAUSED")) return { configured, effective: "PAUSED", delivery };
  if (campaign === "UNKNOWN" || adSet === "UNKNOWN" || configured === "UNKNOWN") {
    return { configured, effective: "UNKNOWN", delivery };
  }
  if (delivery && delivery !== "ACTIVE") return { configured, effective: delivery, delivery };
  if (configured === "ACTIVE" && (campaign === null || campaign === "ACTIVE") && (adSet === null || adSet === "ACTIVE")) {
    return { configured, effective: "ACTIVE", delivery };
  }
  return { configured, effective: "UNKNOWN", delivery };
}

export function accountReportSupersedesLegacyDecision(scope: string, hasReport: boolean): boolean {
  return scope === "account" && hasReport;
}
