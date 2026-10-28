/**
 * Property Ads Intelligence - Deterministic Response Speed Calculator
 * Calculates first-response duration from stored UTC message timestamps,
 * filtering out system/automated messages and enforcing SLA thresholds.
 */

export interface MessageTimestampRecord {
  id: string;
  direction: "inbound" | "outbound";
  senderType: "buyer" | "sales" | "system";
  messageType?: "text" | "image" | "document" | "audio" | "unknown";
  body: string;
  sentAt: string | Date; // ISO string or Date
  isAutomated?: boolean;
}

export interface SLAConfig {
  slaMinutes: number; // Deadline in minutes (default: 60 minutes)
  referenceNow?: Date; // For testing or checking pending status against current time
}

export interface ResponseSpeedResult {
  status: "scored" | "pending" | "overdue" | "invalid" | "no_inbound";
  points: number | null;
  responseTimeMs: number | null;
  responseTimeMinutes: number | null;
  firstInboundAt: string | null;
  firstReplyAt: string | null;
  inboundMessageId: string | null;
  replyMessageId: string | null;
  reason?: string;
}

/**
 * Checks if a message is substantive human sales communication (not empty, greeting bot, or system notice).
 */
export function isSubstantiveSalesReply(msg: MessageTimestampRecord): boolean {
  if (msg.direction !== "outbound" || msg.senderType !== "sales") {
    return false;
  }
  if (msg.isAutomated) {
    return false;
  }
  const trimmed = msg.body?.trim();
  if (!trimmed || trimmed.length === 0) {
    return false;
  }
  // Ignore known generic bot greeting templates if flagged
  if (trimmed.startsWith("[AUTO-REPLY]") || trimmed.startsWith("Pesan Otomatis:")) {
    return false;
  }
  return true;
}

/**
 * Calculates response speed and rubric points deterministically.
 * Default policy: Standard continuous calendar hours UTC timestamp difference.
 */
export function calculateResponseSpeed(
  messages: MessageTimestampRecord[],
  config: SLAConfig = { slaMinutes: 60 }
): ResponseSpeedResult {
  if (!messages || messages.length === 0) {
    return {
      status: "no_inbound",
      points: null,
      responseTimeMs: null,
      responseTimeMinutes: null,
      firstInboundAt: null,
      firstReplyAt: null,
      inboundMessageId: null,
      replyMessageId: null,
      reason: "Tidak ada pesan dalam percakapan",
    };
  }

  // 1. Find the first inbound customer message
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );

  const firstInbound = sortedMessages.find(
    (m) => m.direction === "inbound" && m.senderType === "buyer"
  );

  if (!firstInbound) {
    return {
      status: "no_inbound",
      points: null,
      responseTimeMs: null,
      responseTimeMinutes: null,
      firstInboundAt: null,
      firstReplyAt: null,
      inboundMessageId: null,
      replyMessageId: null,
      reason: "Belum ada pesan masuk dari calon pembeli",
    };
  }

  const inboundTime = new Date(firstInbound.sentAt).getTime();
  if (Number.isNaN(inboundTime)) {
    return {
      status: "invalid",
      points: null,
      responseTimeMs: null,
      responseTimeMinutes: null,
      firstInboundAt: String(firstInbound.sentAt),
      firstReplyAt: null,
      inboundMessageId: firstInbound.id,
      replyMessageId: null,
      reason: "Timestamp pesan masuk pertama tidak valid / malformed",
    };
  }

  // 2. Find substantive sales replies
  const allReplies = sortedMessages.filter((m) => isSubstantiveSalesReply(m));

  const prematureReplies = allReplies.filter(
    (m) => new Date(m.sentAt).getTime() < inboundTime
  );

  const validReplies = allReplies.filter(
    (m) => new Date(m.sentAt).getTime() >= inboundTime
  );

  if (validReplies.length === 0 && prematureReplies.length > 0) {
    const prematureReply = prematureReplies[0];
    const replyTime = new Date(prematureReply.sentAt).getTime();
    return {
      status: "invalid",
      points: null,
      responseTimeMs: replyTime - inboundTime,
      responseTimeMinutes: null,
      firstInboundAt: new Date(inboundTime).toISOString(),
      firstReplyAt: new Date(replyTime).toISOString(),
      inboundMessageId: firstInbound.id,
      replyMessageId: prematureReply.id,
      reason: "Kronologi tidak valid: balasan sales tercatat lebih awal dari pesan pelanggan",
    };
  }

  const firstReply = validReplies[0];

  if (!firstReply) {
    // No sales reply has arrived yet. Check against SLA deadline
    const nowTime = (config.referenceNow || new Date()).getTime();
    const elapsedMinutes = (nowTime - inboundTime) / 60000;

    if (elapsedMinutes <= config.slaMinutes) {
      // Pending response: within SLA window, MUST NOT be scored as zero!
      return {
        status: "pending",
        points: null,
        responseTimeMs: null,
        responseTimeMinutes: Number(elapsedMinutes.toFixed(1)),
        firstInboundAt: new Date(inboundTime).toISOString(),
        firstReplyAt: null,
        inboundMessageId: firstInbound.id,
        replyMessageId: null,
        reason: `Menunggu respons sales (berjalan ${Math.round(elapsedMinutes)} menit dari batas SLA ${config.slaMinutes} menit)`,
      };
    } else {
      // Overdue response: SLA expired without any reply
      return {
        status: "overdue",
        points: 0,
        responseTimeMs: null,
        responseTimeMinutes: Number(elapsedMinutes.toFixed(1)),
        firstInboundAt: new Date(inboundTime).toISOString(),
        firstReplyAt: null,
        inboundMessageId: firstInbound.id,
        replyMessageId: null,
        reason: `Batas waktu SLA (${config.slaMinutes} menit) telah terlampaui tanpa ada balasan sales`,
      };
    }
  }

  const replyTime = new Date(firstReply.sentAt).getTime();
  if (Number.isNaN(replyTime)) {
    return {
      status: "invalid",
      points: null,
      responseTimeMs: null,
      responseTimeMinutes: null,
      firstInboundAt: new Date(inboundTime).toISOString(),
      firstReplyAt: String(firstReply.sentAt),
      inboundMessageId: firstInbound.id,
      replyMessageId: firstReply.id,
      reason: "Timestamp balasan sales tidak valid / malformed",
    };
  }

  const responseTimeMs = replyTime - inboundTime;

  // Chronological validity: reply cannot precede the message it replies to
  if (responseTimeMs < 0) {
    return {
      status: "invalid",
      points: null,
      responseTimeMs,
      responseTimeMinutes: null,
      firstInboundAt: new Date(inboundTime).toISOString(),
      firstReplyAt: new Date(replyTime).toISOString(),
      inboundMessageId: firstInbound.id,
      replyMessageId: firstReply.id,
      reason: "Kronologi tidak valid: balasan sales tercatat lebih awal dari pesan pelanggan",
    };
  }

  const responseTimeMinutes = responseTimeMs / 60000;

  // Map to rubrik response speed (Max 15 points)
  let points = 1;
  if (responseTimeMinutes <= 5) {
    points = 15;
  } else if (responseTimeMinutes <= 15) {
    points = 12;
  } else if (responseTimeMinutes <= 30) {
    points = 9;
  } else if (responseTimeMinutes <= 60) {
    points = 6;
  } else if (responseTimeMinutes <= 240) {
    points = 3;
  } else {
    points = 1;
  }

  return {
    status: "scored",
    points,
    responseTimeMs,
    responseTimeMinutes: Number(responseTimeMinutes.toFixed(2)),
    firstInboundAt: new Date(inboundTime).toISOString(),
    firstReplyAt: new Date(replyTime).toISOString(),
    inboundMessageId: firstInbound.id,
    replyMessageId: firstReply.id,
  };
}
