import { describe, it, expect } from "vitest";
import {
  computeResponseGaps,
  formatIndonesianDuration,
  getUnansweredProspectStatus,
} from "@/lib/ctwa-leads/transcript-audit";

describe("Transcript Audit Helpers — computeResponseGaps & getUnansweredProspectStatus", () => {
  it("1. classifies response gaps into fast (<=300s), normal (301s..1800s), and slow (>1800s)", () => {
    const baseMs = Date.parse("2026-11-20T02:00:00.000Z");
    const ts = (offsetSec: number) => new Date(baseMs + offsetSec * 1000).toISOString();

    const messages = [
      // Fast reply: 130s (2m 10d)
      { id: "m1", wamid: "w1", direction: "inbound_prospect", sent_at: ts(0) },
      { id: "m2", wamid: "w2", direction: "outbound_sales_echo", sent_at: ts(130) },
      // Normal reply: 900s (15m)
      { id: "m3", wamid: "w3", direction: "inbound_prospect", sent_at: ts(200) },
      { id: "m4", wamid: "w4", direction: "outbound_sales_echo", sent_at: ts(1100) },
      // Slow reply: 4500s (1j 15m) from first unanswered prospect message in burst
      { id: "m5", wamid: "w5", direction: "inbound_prospect", sent_at: ts(2000) },
      { id: "m6", wamid: "w6", direction: "inbound_prospect", sent_at: ts(2300) },
      { id: "m7", wamid: "w7", direction: "outbound_sales_echo", sent_at: ts(6500) },
      // Consecutive sales follow-up echo without preceding prospect message should NOT create a duplicate gap
      { id: "m8", wamid: "w8", direction: "outbound_sales_echo", sent_at: ts(6600) },
    ];

    const gaps = computeResponseGaps(messages);
    expect(gaps).toHaveLength(3);

    expect(gaps[0]).toEqual({
      salesMessageId: "m2",
      prospectMessageId: "m1",
      gapSeconds: 130,
      severity: "fast",
    });
    expect(formatIndonesianDuration(gaps[0].gapSeconds)).toBe("2m 10d");

    expect(gaps[1]).toEqual({
      salesMessageId: "m4",
      prospectMessageId: "m3",
      gapSeconds: 900,
      severity: "normal",
    });

    expect(gaps[2]).toEqual({
      salesMessageId: "m7",
      prospectMessageId: "m5",
      gapSeconds: 4500,
      severity: "slow",
    });
    expect(formatIndonesianDuration(gaps[2].gapSeconds)).toBe("1j 15m");
  });

  it("2. detects unanswered prospect status accurately vs answered conversations and empty lists", () => {
    const baseMs = Date.parse("2026-11-20T03:00:00.000Z");
    const ts = (offsetSec: number) => new Date(baseMs + offsetSec * 1000).toISOString();

    expect(getUnansweredProspectStatus([], baseMs)).toEqual({ isUnanswered: false });

    const answered = [
      { id: "m1", wamid: "w1", direction: "inbound_prospect", sent_at: ts(0) },
      { id: "m2", wamid: "w2", direction: "outbound_sales_echo", sent_at: ts(60) },
    ];
    expect(getUnansweredProspectStatus(answered, baseMs + 300_000)).toEqual({
      isUnanswered: false,
    });

    const unanswered = [
      { id: "m1", wamid: "w1", direction: "inbound_prospect", sent_at: ts(0) },
      { id: "m2", wamid: "w2", direction: "outbound_sales_echo", sent_at: ts(60) },
      { id: "m3", wamid: "w3", direction: "inbound_prospect", sent_at: ts(120) },
    ];
    const status = getUnansweredProspectStatus(unanswered, baseMs + 420_000);
    expect(status).toEqual({
      isUnanswered: true,
      sinceIso: ts(120),
      waitingSeconds: 300,
    });
  });
});
