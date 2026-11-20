export interface SegmentBox {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sourceWidth: number;
  sourceHeight: number;
  maskHeight: number;
  maskWidth: number;
  encoding?: "lossless" | "one_bit";
  payload?: string;
}

const BOX = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)/g;
const MASK = /<\|mask;x=0;y=0(?:;c=[0-9.]+)?;data=(\d+),(\d+),([~!])([\s\S]*?)\|>/g;

/** Reads SAM 3.1 boxes and mask sizes from the documented output line. The mask bytes stay encoded. */
export function readSegmentBoxes(outputText: string): SegmentBox[] {
  const boxes = [...outputText.matchAll(BOX)].map((match) => ({
    x1: Number(match[1]),
    y1: Number(match[2]),
    x2: Number(match[3]),
    y2: Number(match[4]),
    sourceWidth: Number(match[5]),
    sourceHeight: Number(match[6]),
  }));
  const masks = [...outputText.matchAll(MASK)].map((match) => ({
    maskHeight: Number(match[1]),
    maskWidth: Number(match[2]),
    encoding: match[3] === "!" ? "one_bit" as const : "lossless" as const,
    payload: match[4],
  }));
  return boxes.map((box, index) => ({
    id: index,
    ...box,
    maskHeight: masks[index]?.maskHeight ?? 0,
    maskWidth: masks[index]?.maskWidth ?? 0,
    encoding: masks[index]?.encoding,
    payload: masks[index]?.payload,
  }));
}

export interface SegmentResult {
  ok: true;
  concept: string;
  boxes: SegmentBox[];
  outputText: string;
}

export interface SegmentFailure {
  ok: false;
  reason: string;
}

/**
 * One SAM 3.1 concept request. The prompt is a short noun phrase.
 * The call uses the documented message shape and does not stream, so the full line comes back in one response.
 */
export async function segmentConcept(input: {
  baseUrl: string;
  apiKey: string;
  imageDataUrl: string;
  concept: string;
  timeoutMs?: number;
}): Promise<SegmentResult | SegmentFailure> {
  let response: Response;
  try {
    response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: "sam-3.1",
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: input.concept },
              { type: "input_image", image_url: input.imageDataUrl },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 60000),
    });
  } catch {
    return { ok: false, reason: "request failed" };
  }
  if (!response.ok) return { ok: false, reason: `http ${response.status}` };
  const json = (await response.json()) as { output_text?: string; output?: Array<{ text?: string; content?: Array<{ text?: string }> }> };
  const chunks: string[] = [];
  if (typeof json.output_text === "string") chunks.push(json.output_text);
  for (const item of json.output || []) {
    if (typeof item.text === "string") chunks.push(item.text);
    for (const part of item.content || []) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  const outputText = chunks.join("\n");
  return { ok: true, concept: input.concept, boxes: readSegmentBoxes(outputText), outputText };
}
