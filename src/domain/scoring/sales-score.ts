/**
 * Property Ads Intelligence - Sales Score Domain Calculator
 * Evaluates sales handling quality across 5 criteria (Max 100 points),
 * with deterministic response speed derived from UTC timestamps.
 */

import { SALES_RUBRIC_V1 } from "./rubrics";
import { calculateDimensionAssessment } from "./calculator";
import {
  calculateResponseSpeed,
  type MessageTimestampRecord,
  type ResponseSpeedResult,
  type SLAConfig,
} from "./response-speed";
import type { DimensionAssessment, RawCriterionInput } from "./types";

export interface CalculateSalesScoreOptions {
  criteriaInputs: RawCriterionInput[];
  messages?: MessageTimestampRecord[];
  responseSpeedResult?: ResponseSpeedResult;
  slaConfig?: SLAConfig;
}

export function calculateSalesScore(
  options: CalculateSalesScoreOptions
): DimensionAssessment {
  const { criteriaInputs, messages, slaConfig } = options;

  let responseSpeed = options.responseSpeedResult;
  if (!responseSpeed && messages) {
    responseSpeed = calculateResponseSpeed(messages, slaConfig);
  }

  const finalInputs: RawCriterionInput[] = criteriaInputs.filter(
    (c) => c.criterion !== "response_speed"
  );

  // Inject deterministic response_speed criterion
  if (responseSpeed) {
    if (responseSpeed.status === "scored") {
      finalInputs.push({
        criterion: "response_speed",
        points: responseSpeed.points,
        status: "scored",
        evidence: [
          {
            criterion: "response_speed",
            messageId: responseSpeed.replyMessageId,
            explanation: `Waktu respons sales terukur: ${responseSpeed.responseTimeMinutes} menit (${responseSpeed.responseTimeMs} ms)`,
            evidenceStatus: "supported",
            timestamp: responseSpeed.firstReplyAt || undefined,
          },
        ],
      });
    } else if (responseSpeed.status === "pending") {
      finalInputs.push({
        criterion: "response_speed",
        points: null,
        status: "missing",
        missingInformation: [
          responseSpeed.reason || "Menunggu balasan pertama sales dalam batas SLA",
        ],
      });
    } else if (responseSpeed.status === "overdue") {
      finalInputs.push({
        criterion: "response_speed",
        points: 0,
        status: "scored",
        evidence: [
          {
            criterion: "response_speed",
            messageId: responseSpeed.inboundMessageId,
            explanation: responseSpeed.reason || "Batas SLA telah terlampaui tanpa ada balasan",
            evidenceStatus: "contradictory",
          },
        ],
      });
    } else if (responseSpeed.status === "invalid") {
      finalInputs.push({
        criterion: "response_speed",
        points: null,
        status: "invalid",
        invalidReason: responseSpeed.reason || "Timestamp pesan tidak valid",
      });
    } else {
      // no_inbound
      finalInputs.push({
        criterion: "response_speed",
        points: null,
        status: "missing",
        missingInformation: ["Belum ada pesan masuk dari calon pembeli"],
      });
    }
  }

  return calculateDimensionAssessment({
    rubric: SALES_RUBRIC_V1,
    inputs: finalInputs,
    dimension: "sales",
  });
}
