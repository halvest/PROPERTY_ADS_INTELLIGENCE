export type ResponseGapSeverity = "fast" | "normal" | "slow";

export interface TranscriptAuditMessageRef {
  id: string;
  wamid: string | null;
  direction: string;
  sent_at: string;
}

export interface ResponseGapItem {
  salesMessageId: string;
  prospectMessageId: string;
  gapSeconds: number;
  severity: ResponseGapSeverity;
}

export type UnansweredProspectStatus =
  | {
      isUnanswered: true;
      sinceIso: string;
      waitingSeconds: number;
    }
  | {
      isUnanswered: false;
    };

const PROSPECT_DIRECTIONS = new Set(["inbound_prospect", "inbound"]);
const SALES_DIRECTIONS = new Set(["outbound_sales_echo", "outbound"]);

export function classifyResponseGapSeverity(gapSeconds: number): ResponseGapSeverity {
  if (gapSeconds <= 300) return "fast";
  if (gapSeconds <= 1800) return "normal";
  return "slow";
}

function sortChronologically<T extends { sent_at: string }>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    const aMs = Date.parse(a.sent_at);
    const bMs = Date.parse(b.sent_at);
    if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return 0;
    return aMs - bMs;
  });
}

/**
 * Computes response-time gaps for every unanswered `inbound_prospect` message (or burst)
 * followed by an `outbound_sales_echo` reply.
 */
export function computeResponseGaps(
  messages: TranscriptAuditMessageRef[]
): ResponseGapItem[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const ordered = sortChronologically(messages);
  const gaps: ResponseGapItem[] = [];
  let pendingProspect: TranscriptAuditMessageRef | null = null;

  for (const msg of ordered) {
    if (PROSPECT_DIRECTIONS.has(msg.direction)) {
      if (!pendingProspect) {
        pendingProspect = msg;
      }
      continue;
    }

    if (SALES_DIRECTIONS.has(msg.direction) && pendingProspect) {
      const prospectMs = Date.parse(pendingProspect.sent_at);
      const salesMs = Date.parse(msg.sent_at);
      if (Number.isFinite(prospectMs) && Number.isFinite(salesMs)) {
        const gapSeconds = Math.max(0, Math.round((salesMs - prospectMs) / 1000));
        gaps.push({
          salesMessageId: msg.id,
          prospectMessageId: pendingProspect.id,
          gapSeconds,
          severity: classifyResponseGapSeverity(gapSeconds),
        });
      }
      pendingProspect = null;
    }
  }

  return gaps;
}

/**
 * Checks whether the latest message in the conversation is an unanswered `inbound_prospect`
 * message and calculates elapsed waiting seconds relative to `now`.
 */
export function getUnansweredProspectStatus(
  messages: TranscriptAuditMessageRef[],
  now: Date | number = Date.now()
): UnansweredProspectStatus {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { isUnanswered: false };
  }

  const ordered = sortChronologically(messages);
  const lastMsg = ordered[ordered.length - 1];

  if (!lastMsg || !PROSPECT_DIRECTIONS.has(lastMsg.direction)) {
    return { isUnanswered: false };
  }

  const nowMs = typeof now === "number" ? now : now.getTime();
  const msgMs = Date.parse(lastMsg.sent_at);
  const waitingSeconds = Number.isFinite(msgMs)
    ? Math.max(0, Math.round((nowMs - msgMs) / 1000))
    : 0;

  return {
    isUnanswered: true,
    sinceIso: lastMsg.sent_at,
    waitingSeconds,
  };
}

/**
 * Formats seconds into concise Indonesian duration strings (`45d`, `2m 10d`, `1j 15m`).
 */
export function formatIndonesianDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0d";
  const totalSec = Math.round(seconds);
  if (totalSec < 60) return `${totalSec}d`;

  const mins = Math.floor(totalSec / 60);
  const remSec = totalSec % 60;
  if (mins < 60) {
    return remSec > 0 ? `${mins}m ${remSec}d` : `${mins}m`;
  }

  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return remMins > 0 ? `${hours}j ${remMins}m` : `${hours}j`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}h ${remHours}j` : `${days}h`;
}
