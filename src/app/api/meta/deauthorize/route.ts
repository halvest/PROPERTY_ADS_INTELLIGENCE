import { NextRequest, NextResponse } from "next/server";
import { getMetaAppSecret } from "@/lib/meta/config";
import {
  initiateMetaUserDataDeletion,
  metaUserIdFromUnknown,
  verifyMetaSignedRequest,
} from "@/lib/meta/meta-data-deletion";

async function extractSignedRequestParam(req: NextRequest): Promise<string | null> {
  const rawBody = await req.text();
  if (!rawBody.trim()) return null;
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
    await initiateMetaUserDataDeletion(metaUserId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Deauthorize callback failed";
    console.error("[POST /api/meta/deauthorize] Error:", message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
