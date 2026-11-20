import { NextRequest, NextResponse } from "next/server";
import { getMetaAppSecret, getWhatsappWebhookVerifyToken } from "@/lib/meta/config";
import { verifyMetaWebhookSignature } from "@/lib/meta/webhook-security";
import { ingestWhatsAppWebhookPayload } from "@/lib/meta/webhook-ingestion";

export async function GET(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get("hub.mode");
    const verifyToken = req.nextUrl.searchParams.get("hub.verify_token");
    const challenge = req.nextUrl.searchParams.get("hub.challenge");

    const expectedToken = getWhatsappWebhookVerifyToken();

    if (mode === "subscribe" && verifyToken === expectedToken && challenge !== null) {
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook verification error";
    console.error("[GET /api/webhooks/whatsapp] Error:", message);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const appSecret = getMetaAppSecret();

    if (!verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret)) {
      return NextResponse.json(
        { success: false, error: "Invalid X-Hub-Signature-256" },
        { status: 401 }
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    await ingestWhatsAppWebhookPayload(payload);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook ingestion error";
    console.error("[POST /api/webhooks/whatsapp] Error:", message);
    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
