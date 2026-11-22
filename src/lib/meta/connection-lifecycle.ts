export const WHATSAPP_CONNECTION_STATUSES = [
  "pending",
  "connected",
  "syncing",
  "sync_failed",
  "disconnected",
  "revoked",
] as const;

export type WhatsAppConnectionStatus = (typeof WHATSAPP_CONNECTION_STATUSES)[number];

/** Live inbound events are accepted only while the number is authorized. */
export function canAcceptInboundMessages(status: string | null | undefined): boolean {
  return status === "connected" || status === "syncing";
}

export interface CoexistenceOutcome {
  coexistenceEnabled: boolean;
  syncStatus: "not_applicable" | "succeeded" | "failed";
  connectionStatus: "connected";
}

/**
 * Connection status and history sync are separate.
 * A failed sync keeps the number authorized for new messages, and it does
 * not report Coexistence as active.
 */
export function resolveCoexistenceOutcome(input: {
  integrationMode: string;
  warnings: string[];
}): CoexistenceOutcome {
  if (input.integrationMode !== "coexistence") {
    return {
      coexistenceEnabled: false,
      syncStatus: "not_applicable",
      connectionStatus: "connected",
    };
  }
  if (input.warnings.length > 0) {
    return {
      coexistenceEnabled: false,
      syncStatus: "failed",
      connectionStatus: "connected",
    };
  }
  return {
    coexistenceEnabled: true,
    syncStatus: "succeeded",
    connectionStatus: "connected",
  };
}
