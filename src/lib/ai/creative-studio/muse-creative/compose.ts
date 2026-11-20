import { referenceRoleLine, type ReferenceRole } from "./critic";

export interface MuseComposeInput {
  baseUrl: string;
  apiKey: string;
  instruction: string;
  size: string;
  photoDataUrl?: string;
  references?: string[];
  referenceRoles?: Array<Exclude<ReferenceRole, "property">>;
  previousResponseId?: string;
  timeoutMs?: number;
}

export interface MuseComposeSuccess {
  ok: true;
  imageUrl: string;
  responseId: string;
  imageCallId?: string;
}

export interface MuseComposeFailure {
  ok: false;
  reason: string;
}

type ImageCall = { type?: string; id?: string; status?: string; result?: string };

/**
 * Reads the image from a Responses payload by item type.
 * A completed call must carry a result. Position in the output list is ignored.
 */
export function readImageGenerationCall(payload: {
  id?: string;
  status?: string;
  output?: ImageCall[];
}): MuseComposeSuccess | MuseComposeFailure {
  if (payload.status && payload.status !== "completed") {
    return { ok: false, reason: `response status ${payload.status}` };
  }
  const call = (payload.output || []).find((item) => item.type === "image_generation_call");
  if (!call) return { ok: false, reason: "no image_generation_call" };
  if (call.status && call.status !== "completed") {
    return { ok: false, reason: `image_generation_call status ${call.status}` };
  }
  if (!call.result) return { ok: false, reason: "image_generation_call has no result" };
  const mime = call.result.startsWith("iVBORw0KGgo") ? "image/png" : "image/webp";
  const imageUrl = call.result.startsWith("data:") ? call.result : `data:${mime};base64,${call.result}`;
  if (!payload.id) return { ok: false, reason: "response has no id" };
  return { ok: true, imageUrl, responseId: payload.id, imageCallId: call.id };
}

/**
 * One Responses API turn for muse-image-1.0.
 * Reference images are wrapped in a user message. A follow-up sends only the new instruction.
 * Web search, image search, and shell are off so the model cannot replace the property with looked-up facts.
 */
export async function composeWithMuseImage(input: MuseComposeInput): Promise<MuseComposeSuccess | MuseComposeFailure> {
  const content: Array<{ type: "input_text" | "input_image"; text?: string; image_url?: string }> = [
    { type: "input_text", text: input.instruction },
  ];
  if (input.photoDataUrl) {
    content.unshift({ type: "input_image", image_url: input.photoDataUrl });
  }
  (input.references || []).forEach((reference, index) => {
    content.push({
      type: "input_text",
      text: referenceRoleLine(input.referenceRoles?.[index] || "design_reference"),
    });
    content.push({ type: "input_image", image_url: reference });
  });
  const body: Record<string, unknown> = {
    model: "muse-image-1.0",
    input: input.previousResponseId
      ? input.instruction
      : [{ role: "user", content }],
    tools: [
      {
        type: "image_generation",
        size: input.size,
        output_format: "webp",
        reasoning_strength: "high",
        enable_web_search: false,
        enable_image_search: false,
        enable_shell: false,
      },
    ],
  };
  if (input.previousResponseId) body.previous_response_id = input.previousResponseId;

  let response: Response;
  try {
    response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs ?? 90000),
    });
  } catch {
    return { ok: false, reason: "request failed" };
  }
  if (!response.ok) return { ok: false, reason: `http ${response.status}` };
  const json = (await response.json()) as { id?: string; status?: string; output?: ImageCall[] };
  return readImageGenerationCall(json);
}
