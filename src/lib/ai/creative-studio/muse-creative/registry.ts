/**
 * Models verified against https://dev.meta.ai/docs/models on 15 Nov 2026.
 * Voice and segmentation are listed so the registry matches the catalog.
 * Studio calls Muse Image for pictures and Muse Spark for text. It does not call the others.
 */
export const META_MODELS = {
  image: {
    id: "muse-image-1.0",
    endpoint: "POST /v1/responses",
    input: ["text", "image"],
    output: "image",
  },
  spark: {
    id: "muse-spark-1.3",
    endpoint: "POST /v1/responses",
    input: ["text", "image", "video", "audio", "pdf"],
    output: "text",
  },
  wonder: {
    id: "muse-wonder-1.0",
    endpoint: "POST /v1/responses",
    input: ["text", "image", "video", "audio", "pdf"],
    output: "text",
  },
  ember: {
    id: "muse-ember-1.0",
    endpoint: "POST /v1/responses",
    input: ["text", "image", "video", "audio", "pdf"],
    output: "text",
  },
  segment: {
    id: "sam-3.1",
    endpoint: "POST /v1/responses",
    input: ["text", "image", "video"],
    output: "masks",
  },
  voice: {
    id: "muse-voice-transcribe-1.0",
    endpoint: "POST /v1/asr/transcribe",
    input: ["audio"],
    output: "text",
  },
} as const;
