import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getMetaAppSecret } from "@/lib/meta/config";

const CANONICAL_DATA_DELETION_URL = "https://hdcreative.cloud/data-deletion";

function decodeBase64UrlToBuffer(input: string): Buffer {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  return Buffer.from(base64 + "=".repeat(padLen), "base64");
}

function parseSignedRequestPayload(
  signedRequest: string,
  appSecret: string
): { valid: true; payload: Record<string, unknown> } | { valid: false; status: 400 | 401; error: string } {
  const parts = signedRequest.trim().split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, status: 400, error: "Malformed signed_request" };
  }

  const [encodedSig, encodedPayload] = parts;

  let sigBuf: Buffer;
  let payloadJson: Record<string, unknown>;
  try {
    sigBuf = decodeBase64UrlToBuffer(encodedSig);
    const payloadStr = decodeBase64UrlToBuffer(encodedPayload).toString("utf8");
    const parsed = JSON.parse(payloadStr);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { valid: false, status: 400, error: "Invalid signed_request payload" };
    }
    payloadJson = parsed as Record<string, unknown>;
  } catch {
    return { valid: false, status: 400, error: "Failed to decode signed_request" };
  }

  const algorithm = typeof payloadJson.algorithm === "string" ? payloadJson.algorithm.toUpperCase() : "";
  if (algorithm !== "HMAC-SHA256") {
    return { valid: false, status: 401, error: "Unsupported signed_request algorithm" };
  }

  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();

  if (sigBuf.length !== expectedSig.length || !crypto.timingSafeEqual(sigBuf, expectedSig)) {
    return { valid: false, status: 401, error: "Invalid signed_request signature" };
  }

  return { valid: true, payload: payloadJson };
}

async function extractSignedRequestParam(req: NextRequest): Promise<string | null> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  const rawBody = await req.text();
  if (!rawBody.trim()) return null;

  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(rawBody) as { signed_request?: unknown };
      return typeof json?.signed_request === "string" ? json.signed_request : null;
    } catch {
      return null;
    }
  }

  // Primary Meta format: application/x-www-form-urlencoded (`signed_request=...`)
  const params = new URLSearchParams(rawBody);
  const fromForm = params.get("signed_request");
  if (fromForm) return fromForm;

  // Fallback JSON attempt even if header omitted
  try {
    const json = JSON.parse(rawBody) as { signed_request?: unknown };
    return typeof json?.signed_request === "string" ? json.signed_request : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const signedRequest = await extractSignedRequestParam(req);
    if (!signedRequest) {
      return NextResponse.json(
        { error: "Missing signed_request parameter" },
        { status: 400 }
      );
    }

    const appSecret = getMetaAppSecret();
    const verified = parseSignedRequestPayload(signedRequest, appSecret);
    if (!verified.valid) {
      return NextResponse.json(
        { error: verified.error },
        { status: verified.status }
      );
    }

    const userIdPart =
      typeof verified.payload.user_id === "string" && verified.payload.user_id.trim()
        ? crypto
            .createHash("sha256")
            .update(verified.payload.user_id.trim())
            .digest("hex")
            .slice(0, 8)
        : crypto.randomBytes(4).toString("hex");

    const confirmationCode = `haspro_del_${userIdPart}_${crypto.randomBytes(4).toString("hex")}`;

    return NextResponse.json(
      {
        url: `${CANONICAL_DATA_DELETION_URL}?code=${encodeURIComponent(confirmationCode)}`,
        confirmation_code: confirmationCode,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Data deletion callback failed";
    console.error("[POST /api/meta/data-deletion-callback] Error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
