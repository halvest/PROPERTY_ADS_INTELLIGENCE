import { NextResponse } from "next/server";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  getWhatsAppConfig,
  sanitizeWhatsAppLog,
} from "@/lib/whatsapp/config";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/inbound-service";
import { resolveWebhookTenant, getWebhookSupabaseClient } from "@/lib/whatsapp/connection-service";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";

/**
 * Meta WhatsApp Cloud API Webhook Handler
 *
 * Implements:
 * 1. GET: Webhook verification challenge (hub.mode, hub.verify_token, hub.challenge).
 * 2. POST: Inbound message notification with X-Hub-Signature-256 HMAC verification.
 * 3. Idempotent processing and immediate HTTP 200 acknowledgment.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const config = getWhatsAppConfig();

  // Fail closed if verify token is not configured on server
  if (!config.verifyToken || config.verifyToken.trim() === "") {
    return new Response("Forbidden: WHATSAPP_VERIFY_TOKEN belum dikonfigurasi pada server.", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const verification = verifyWebhookChallenge(
    mode,
    token,
    challenge,
    config.verifyToken
  );

  if (verification.isValid && verification.challenge) {
    return new Response(verification.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden: Invalid verification token or mode.", {
    status: 403,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  try {
    const rl = checkRateLimit(rateLimitKey(request, "whatsapp-webhook"), 300, 60_000);
    if (!rl.allowed) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");
    const config = getWhatsAppConfig();

    // Reject immediately if App Secret is not configured (fail closed)
    if (!config.appSecret || config.appSecret.trim() === "") {
      return new Response("Unauthorized: WHATSAPP_APP_SECRET tidak dikonfigurasi pada server.", {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Verify HMAC-SHA256 signature using raw body
    const isSignatureValid = verifyWebhookSignature(rawBody, signatureHeader, config.appSecret);

    if (!isSignatureValid) {
      return new Response("Unauthorized: Signature HMAC-SHA256 tidak valid atau tidak disertakan.", {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      });
    }

    let parsedPayload: WhatsAppWebhookPayload;
    try {
      parsedPayload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
    } catch {
      return NextResponse.json(
        { status: "error", message: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    const incomingPhoneNumberId =
      parsedPayload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const incomingWabaId = parsedPayload?.entry?.[0]?.id;

    // Strict tenant resolution from whatsapp_connections registry
    const { organizationId, isDisconnected, isUnregistered } =
      await resolveWebhookTenant(incomingPhoneNumberId, incomingWabaId);

    if (isDisconnected) {
      return NextResponse.json(
        {
          status: "IGNORED_DISCONNECTED_CONNECTION",
          message: "Koneksi WhatsApp tenant dalam status non-aktif.",
        },
        { status: 200 }
      );
    }

    const isProduction = process.env.NODE_ENV === "production";

    // In production or whenever an incoming phone number is unregistered, reject arbitrary tenant writing
    if (isUnregistered || (!organizationId && isProduction)) {
      return NextResponse.json(
        {
          status: "IGNORED_UNREGISTERED_PHONE_NUMBER",
          message: "Nomor WhatsApp belum terdaftar pada tenant manapun.",
        },
        { status: 200 }
      );
    }

    // Default mock tenant only for local dev test environments
    const resolvedOrgId = organizationId || "00000000-0000-0000-0000-000000000001";

    // Persistence is mandatory: without a service-role client the processor
    // would silently drop every message. Fail closed in production.
    let adminClient: ReturnType<typeof getWebhookSupabaseClient> | undefined;
    try {
      adminClient = getWebhookSupabaseClient();
    } catch {
      if (isProduction) {
        return NextResponse.json(
          { status: "error", message: "Database service tidak terkonfigurasi." },
          { status: 500 }
        );
      }
    }

    const result = await processWhatsAppWebhookPayload(parsedPayload, {
      organizationId: resolvedOrgId,
      supabaseClient: adminClient,
      allowDemoFallback: !isProduction,
    });

    // Return immediate 200 to acknowledge Meta webhook
    return NextResponse.json(
      {
        status: "EVENT_RECEIVED",
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    const sanitizedError = sanitizeWhatsAppLog(
      error instanceof Error ? error.message : "Internal webhook processing error"
    );

    // Meta expects 200/500 without crashing
    return NextResponse.json(
      {
        status: "error",
        message: sanitizedError,
      },
      { status: 500 }
    );
  }
}
