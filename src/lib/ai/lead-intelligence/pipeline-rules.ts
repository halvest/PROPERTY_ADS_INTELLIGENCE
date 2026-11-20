import type {
  LeadAnalysisOutput,
  LeadEvidenceItem,
  LeadTemperature,
  PipelineStage,
} from "@/lib/ai/lead-intelligence/schema";

const PIPELINE_STAGE_RANK: Record<PipelineStage, number> = {
  new_inquiry: 0,
  contacted: 1,
  qualified: 2,
  survey: 3,
  closing: 4,
  won: 5,
  lost: 5,
};

const STAGES_REQUIRING_PROSPECT_EVIDENCE = new Set<PipelineStage>([
  "qualified",
  "survey",
  "closing",
]);

const TERMINAL_HUMAN_GATE_STAGES = new Set<PipelineStage>(["won", "lost"]);

const PROSPECT_DIRECTIONS = new Set(["inbound_prospect", "inbound"]);

export interface LeadTransitionMessageRef {
  wamid: string | null;
  direction: string;
}

export interface LeadTransitionInput {
  currentLead: {
    pipeline_stage: PipelineStage;
    lead_temperature: LeadTemperature;
    manual_stage_lock: boolean;
  };
  aiOutput: LeadAnalysisOutput;
  messages: LeadTransitionMessageRef[];
}

export interface LeadTransitionResult {
  nextStage: PipelineStage;
  nextTemperature: LeadTemperature;
  needsHumanReview: boolean;
  validEvidence: LeadEvidenceItem[];
  droppedEvidenceCount: number;
  stageChanged: boolean;
  temperatureChanged: boolean;
  transitionReason: string;
}

/**
 * Deterministic pipeline state machine guarding AI stage suggestions against
 * hallucinated evidence, stage downgrades, unverified sales-only claims,
 * low-confidence terminal transitions, and manual stage locks.
 */
export function evaluateLeadTransition(input: LeadTransitionInput): LeadTransitionResult {
  const { currentLead, aiOutput, messages } = input;

  // 1. Evidence verification: discard any wamid not actually present in conversation messages
  const directionByWamid = new Map<string, string>();
  for (const msg of messages) {
    const cleanWamid = msg.wamid?.trim();
    if (cleanWamid) {
      directionByWamid.set(cleanWamid, msg.direction);
    }
  }

  const validEvidence: LeadEvidenceItem[] = [];
  for (const item of aiOutput.evidence) {
    const cleanId = item.message_id.trim();
    if (directionByWamid.has(cleanId)) {
      validEvidence.push({
        message_id: cleanId,
        reason: item.reason,
      });
    }
  }
  const droppedEvidenceCount = aiOutput.evidence.length - validEvidence.length;

  const hasProspectEvidence = validEvidence.some((ev) => {
    const dir = directionByWamid.get(ev.message_id);
    return dir ? PROSPECT_DIRECTIONS.has(dir) : false;
  });

  // 2. Low-confidence review baseline
  let needsHumanReview = aiOutput.needs_human_review || aiOutput.confidence < 0.65;
  const reasonNotes: string[] = [];

  if (droppedEvidenceCount > 0) {
    reasonNotes.push(`dropped ${droppedEvidenceCount} unverifiable evidence item(s)`);
  }
  if (aiOutput.confidence < 0.65) {
    reasonNotes.push(`low confidence (${aiOutput.confidence.toFixed(2)} < 0.65) requires human review`);
  }

  // 3. Stage transition rules (anti-downgrade, prospect proof, human-gate, manual lock)
  const currentStage = currentLead.pipeline_stage;
  const suggestedStage = aiOutput.pipeline_stage_suggestion;
  let nextStage: PipelineStage = currentStage;

  if (currentLead.manual_stage_lock) {
    reasonNotes.push(`manual_stage_lock active: preserved stage '${currentStage}'`);
  } else if (PIPELINE_STAGE_RANK[suggestedStage] <= PIPELINE_STAGE_RANK[currentStage]) {
    if (PIPELINE_STAGE_RANK[suggestedStage] < PIPELINE_STAGE_RANK[currentStage]) {
      reasonNotes.push(
        `anti-downgrade guard: refused '${currentStage}' -> '${suggestedStage}'`
      );
    } else if (suggestedStage !== currentStage) {
      reasonNotes.push(
        `terminal-stage guard: refused lateral switch '${currentStage}' -> '${suggestedStage}'`
      );
    }
  } else if (STAGES_REQUIRING_PROSPECT_EVIDENCE.has(suggestedStage) && !hasProspectEvidence) {
    reasonNotes.push(
      `prospect-evidence guard: refused upgrade to '${suggestedStage}' without inbound_prospect wamid`
    );
  } else if (TERMINAL_HUMAN_GATE_STAGES.has(suggestedStage) && aiOutput.confidence < 0.9) {
    needsHumanReview = true;
    reasonNotes.push(
      `human-gate guard: '${suggestedStage}' requires confidence >= 0.90 (got ${aiOutput.confidence.toFixed(2)})`
    );
  } else {
    nextStage = suggestedStage;
    reasonNotes.push(
      `AI promoted stage '${currentStage}' -> '${nextStage}' (confidence=${aiOutput.confidence.toFixed(2)})`
    );
  }

  const nextTemperature: LeadTemperature = aiOutput.lead_temperature;
  const stageChanged = nextStage !== currentLead.pipeline_stage;
  const temperatureChanged = nextTemperature !== currentLead.lead_temperature;

  if (temperatureChanged) {
    reasonNotes.push(
      `temperature '${currentLead.lead_temperature}' -> '${nextTemperature}'`
    );
  }

  const transitionReason =
    reasonNotes.length > 0
      ? reasonNotes.join("; ")
      : `AI analysis confirmed stage '${nextStage}' and temperature '${nextTemperature}'`;

  return {
    nextStage,
    nextTemperature,
    needsHumanReview,
    validEvidence,
    droppedEvidenceCount,
    stageChanged,
    temperatureChanged,
    transitionReason,
  };
}
