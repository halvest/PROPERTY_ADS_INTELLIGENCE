export type WebhookRedeliveryDecision = "skip_duplicate" | "reprocess" | "dead_letter";

const DEFAULT_MAX_ATTEMPTS = 5;
export const WEBHOOK_PROCESSING_LEASE_MS = 120_000;

export function readWebhookAttempt(errorMessage: string | null | undefined): number {
  const match = /(?:^|\s)attempts=(\d+)/.exec(errorMessage ?? "");
  if (!match) return 0;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function formatWebhookFailure(attempt: number, message: string): string {
  const clean = message.replace(/\s+/g, " ").slice(0, 420);
  return `attempts=${attempt} ${clean}`;
}

/**
 * A Meta retry of an event that already finished is a duplicate.
 * A retry of an event that failed, or a processing row whose worker died,
 * must be processed again. Past the attempt cap it is dead-lettered.
 */
export function decideWebhookRedelivery(input: {
  status: string | null | undefined;
  attempt: number;
  processingAgeMs: number | null;
  maxAttempts?: number;
}): WebhookRedeliveryDecision {
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const status = input.status ?? "pending";
  if (status === "processed") return "skip_duplicate";
  if (status === "dead_letter" || input.attempt >= maxAttempts) return "dead_letter";
  if (
    status === "processing" &&
    input.processingAgeMs !== null &&
    input.processingAgeMs < WEBHOOK_PROCESSING_LEASE_MS
  ) {
    return "skip_duplicate";
  }
  return "reprocess";
}

/** Prefer the claim timestamp. received_at is only a fallback for rows claimed before that column existed. */
export function webhookProcessingAgeMs(input: {
  claimedAt?: string | null;
  receivedAt?: string | null;
  now?: number;
}): number | null {
  const stamp = input.claimedAt || input.receivedAt;
  if (!stamp) return null;
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) return null;
  return (input.now ?? Date.now()) - parsed;
}

export function deadLetterRequeuePatch(): {
  status: "retrying";
  error_message: string;
  claimed_at: null;
  processed_at: null;
} {
  return {
    status: "retrying",
    error_message: "attempts=0 requeued",
    claimed_at: null,
    processed_at: null,
  };
}
