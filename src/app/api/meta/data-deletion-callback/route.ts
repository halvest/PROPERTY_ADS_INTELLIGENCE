import { NextRequest, NextResponse } from "next/server";
import { getMetaAppSecret } from "@/lib/meta/config";
import {
  initiateMetaUserDataDeletion,
  metaUserIdFromUnknown,
  verifyMetaSignedRequest,
} from "@/lib/meta/meta-data-deletion";

const CANONICAL_DATA_DELETION_URL = "https://hdcreative.cloud/data-deletion";

async function extractSignedRequestParam(req: NextRequest): Promise<string | null> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  const rawBody = await req.text();
  if (!rawBody.trim()) return null;

  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(rawBody) as { signed_request?: unknown };
      return typeof json.signed_request === "string" ? json.signed_request : null;
    } catch {
      return null;
    }
  }

  const fromForm = new URLSearchParams(rawBody).get("signed_request");
  if (fromForm) return fromForm;

  try {
    const json = JSON.parse(rawBody) as { signed_request?: unknown };
    return typeof json.signed_request === "string" ? json.signed_request : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const signedRequest = await extractSignedRequestParam(req);
    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request parameter" }, { status: 400 });
    }

    const verified = verifyMetaSignedRequest(signedRequest, getMetaAppSecret());
    if (!verified.valid) {
      return NextResponse.json({ error: verified.error }, { status: verified.status });
    }

    const metaUserId = metaUserIdFromUnknown(verified.payload.user_id);
    if (!metaUserId) {
      return NextResponse.json({ error: "signed_request is missing user_id" }, { status: 400 });
    }

    const deletion = await initiateMetaUserDataDeletion(metaUserId);
    return NextResponse.json(
      {
        url: `${CANONICAL_DATA_DELETION_URL}?code=${encodeURIComponent(deletion.confirmationCode)}`,
        confirmation_code: deletion.confirmationCode,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Data deletion callback failed";
    console.error("[POST /api/meta/data-deletion-callback] Error:", message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
