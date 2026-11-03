/**
 * Parses model output as JSON. Strips markdown fences if the model ignored
 * response_format=json_object.
 */
export function parseModelJson(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return JSON.parse(cleaned);
}
