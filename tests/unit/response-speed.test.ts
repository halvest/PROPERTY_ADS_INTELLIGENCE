import { describe, it, expect } from "vitest";
import {
  calculateResponseSpeed,
  isSubstantiveSalesReply,
  type MessageTimestampRecord,
} from "@/domain/scoring/response-speed";
import { calculateSalesScore } from "@/domain/scoring/sales-score";

describe("Deterministic Response Speed & Sales Score Calculation", () => {
  const baseInboundTime = "2026-10-25T10:00:00Z";

  function createMessages(replyTimeStr?: string, isAutomated = false): MessageTimestampRecord[] {
    const list: MessageTimestampRecord[] = [
      {
        id: "m_inbound",
        direction: "inbound",
        senderType: "buyer",
        body: "Halo saya tertarik cluster sapphire",
        sentAt: baseInboundTime,
      },
    ];

    if (replyTimeStr) {
      list.push({
        id: "m_reply",
        direction: "outbound",
        senderType: "sales",
        body: isAutomated ? "[AUTO-REPLY] Terima kasih telah menghubungi kami." : "Halo! Ada yang bisa kami bantu mengenai Cluster Sapphire?",
        sentAt: replyTimeStr,
        isAutomated,
      });
    }

    return list;
  }

  describe("Substantive reply identification", () => {
    it("identifies human substantive replies and filters out auto-replies or empty messages", () => {
      expect(
        isSubstantiveSalesReply({
          id: "1",
          direction: "outbound",
          senderType: "sales",
          body: "Halo selamat siang Pak!",
          sentAt: baseInboundTime,
        })
      ).toBe(true);

      // Automated message flag
      expect(
        isSubstantiveSalesReply({
          id: "2",
          direction: "outbound",
          senderType: "sales",
          body: "Halo!",
          sentAt: baseInboundTime,
          isAutomated: true,
        })
      ).toBe(false);

      // Empty / whitespace
      expect(
        isSubstantiveSalesReply({
          id: "3",
          direction: "outbound",
          senderType: "sales",
          body: "   ",
          sentAt: baseInboundTime,
        })
      ).toBe(false);

      // Auto-reply prefix
      expect(
        isSubstantiveSalesReply({
          id: "4",
          direction: "outbound",
          senderType: "sales",
          body: "[AUTO-REPLY] Terima kasih",
          sentAt: baseInboundTime,
        })
      ).toBe(false);
    });
  });

  describe("Rubric threshold points mapping", () => {
    it("awards 15 points for response <= 5 minutes", () => {
      const msgs = createMessages("2026-10-25T10:04:30Z"); // 4.5 minutes
      const res = calculateResponseSpeed(msgs);
      expect(res.status).toBe("scored");
      expect(res.points).toBe(15);
      expect(res.responseTimeMinutes).toBe(4.5);
    });

    it("awards 12 points for response > 5 and <= 15 minutes", () => {
      const msgs = createMessages("2026-10-25T10:12:00Z"); // 12 minutes
      const res = calculateResponseSpeed(msgs);
      expect(res.status).toBe("scored");
      expect(res.points).toBe(12);
      expect(res.responseTimeMinutes).toBe(12);
    });

    it("awards 9 points for response > 15 and <= 30 minutes", () => {
      const msgs = createMessages("2026-10-25T10:25:00Z"); // 25 minutes
      const res = calculateResponseSpeed(msgs);
      expect(res.status).toBe("scored");
      expect(res.points).toBe(9);
    });

    it("awards 6 points for response > 30 and <= 60 minutes", () => {
      const msgs = createMessages("2026-10-25T10:50:00Z"); // 50 minutes
      const res = calculateResponseSpeed(msgs);
      expect(res.status).toBe("scored");
      expect(res.points).toBe(6);
    });

    it("awards 3 points for response > 60 and <= 240 minutes", () => {
      const msgs = createMessages("2026-10-25T12:30:00Z"); // 150 minutes (2.5 hours)
      const res = calculateResponseSpeed(msgs);
      expect(res.status).toBe("scored");
      expect(res.points).toBe(3);
    });

    it("awards 1 point for response > 240 minutes", () => {
      const msgs = createMessages("2026-10-25T16:00:00Z"); // 360 minutes (6 hours)
      const res = calculateResponseSpeed(msgs);
      expect(res.status).toBe("scored");
      expect(res.points).toBe(1);
    });
  });

  describe("SLA Handling: Pending vs Overdue", () => {
    it("marks response as pending with points: null when SLA has not expired", () => {
      const msgs = createMessages(); // No reply yet
      // Reference now is 20 minutes after inbound, SLA is 60 minutes
      const referenceNow = new Date("2026-10-25T10:20:00Z");

      const res = calculateResponseSpeed(msgs, {
        slaMinutes: 60,
        referenceNow,
      });

      expect(res.status).toBe("pending");
      expect(res.points).toBeNull(); // MUST NOT BE 0!
      expect(res.responseTimeMinutes).toBe(20);
      expect(res.reason).toMatch(/Menunggu respons sales/);
    });

    it("marks response as overdue with points: 0 when SLA has expired without reply", () => {
      const msgs = createMessages(); // No reply yet
      // Reference now is 90 minutes after inbound, SLA is 60 minutes
      const referenceNow = new Date("2026-10-25T11:30:00Z");

      const res = calculateResponseSpeed(msgs, {
        slaMinutes: 60,
        referenceNow,
      });

      expect(res.status).toBe("overdue");
      expect(res.points).toBe(0);
      expect(res.reason).toMatch(/Batas waktu SLA.*terlampaui/);
    });
  });

  describe("Invalid and anomalous timestamps", () => {
    it("flags invalid chronological order when sales reply timestamp precedes customer message", () => {
      // Inbound at 10:00, reply recorded at 09:50 (anomalous clock drift / bad log)
      const msgs = createMessages("2026-10-25T09:50:00Z");
      const res = calculateResponseSpeed(msgs);

      expect(res.status).toBe("invalid");
      expect(res.points).toBeNull();
      expect(res.reason).toMatch(/Kronologi tidak valid/);
    });

    it("flags invalid when timestamp is malformed or unparseable", () => {
      const msgs: MessageTimestampRecord[] = [
        {
          id: "m_bad",
          direction: "inbound",
          senderType: "buyer",
          body: "Halo",
          sentAt: "invalid-date-string",
        },
      ];
      const res = calculateResponseSpeed(msgs);
      expect(res.status).toBe("invalid");
      expect(res.points).toBeNull();
    });
  });

  describe("Integration into calculateSalesScore", () => {
    it("automatically calculates response_speed and incorporates into Sales Score", () => {
      const messages = createMessages("2026-10-25T10:03:00Z"); // 3 min -> 15 pts

      const salesAssessment = calculateSalesScore({
        criteriaInputs: [
          { criterion: "relevance_of_answers", points: 20 },
          { criterion: "needs_discovery", points: 15 },
          { criterion: "follow_up_consistency", points: 15 },
          { criterion: "next_step_progression", points: 15 },
        ],
        messages,
      });

      expect(salesAssessment.criteria.response_speed.status).toBe("scored");
      expect(salesAssessment.criteria.response_speed.score).toBe(15);
      expect(salesAssessment.rawPoints).toBe(15 + 20 + 15 + 15 + 15); // 80
      expect(salesAssessment.completeness).toBe(100);
      expect(salesAssessment.normalizedScore).toBe(80);
      expect(salesAssessment.status).toBe("completed");
    });
  });
});
