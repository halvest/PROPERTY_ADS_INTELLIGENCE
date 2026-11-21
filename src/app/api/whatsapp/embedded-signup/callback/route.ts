import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/security/token-crypto";
import {
  exchangeEmbeddedSignupCode,
  fetchPhoneNumberMetadata,
  listWabaPhoneNumbers,
  selectWabaPhoneNumber,
  startCoexistenceDataSync,
  subscribeAppToWaba,
  type PhoneNumberMetadata,
} from "@/lib/meta/whatsapp-onboarding";
import { readMetaAppScopedUserId } from "@/lib/meta/meta-data-deletion";
import { getMaxConnectionsForPlan } from "@/lib/workspaces/active-workspace";

const CallbackSchema = z.object({
  workspaceId: z.string().uuid(),
  code: z.string().trim().min(1, "Authorization code is required"),
  phoneNumberId: z.string().trim().min(1).optional(),
  wabaId: z.string().trim().min(1, "wabaId is required"),
  integrationMode: z.literal("coexistence").optional().default("coexistence"),
  salesMemberId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = CallbackSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { workspaceId, code, wabaId, integrationMode, salesMemberId } = parsed.data;
    let phoneNumberId = parsed.data.phoneNumberId ?? null;

    const admin = createAdminClient();

    // 1. Verify caller is owner or admin of workspaceId
    const { data: membership, error: memberErr } = await admin
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Hanya owner atau admin workspace yang dapat menghubungkan nomor WhatsApp.",
        },
        { status: 403 }
      );
    }

    if (salesMemberId) {
      const { data: salesMember } = await admin
        .from("workspace_members")
        .select("id")
        .eq("id", salesMemberId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (!salesMember) {
        return NextResponse.json(
          { success: false, error: "salesMemberId tidak terdaftar di workspace ini." },
          { status: 400 }
        );
      }
    }

    const [{ data: sub }, { count: connectedCount, error: countErr }] = await Promise.all([
      admin
        .from("subscriptions")
        .select("plan, max_whatsapp_connections, status")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      admin
        .from("whatsapp_connections")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("connection_status", "connected")
        .neq("phone_number_id", phoneNumberId ?? ""),
    ]);

    if (countErr) {
      throw new Error(`Failed to verify connection quota: ${countErr.message}`);
    }

    if (sub && !["active", "trialing"].includes(sub.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Langganan workspace tidak aktif (status: ${sub.status}). Aktifkan paket untuk menghubungkan nomor WhatsApp.`,
        },
        { status: 403 }
      );
    }

    const plan = sub?.plan ?? "starter";
    const maxConnections = getMaxConnectionsForPlan(plan, sub?.max_whatsapp_connections);

    if ((connectedCount ?? 0) >= maxConnections) {
      return NextResponse.json(
        {
          success: false,
          error: `Kuota nomor WhatsApp untuk paket ${plan} (${maxConnections} nomor) sudah penuh. Putuskan nomor lama atau upgrade paket Anda.`,
        },
        { status: 403 }
      );
    }

    const tokenResult = await exchangeEmbeddedSignupCode(code);
    let phoneMeta: PhoneNumberMetadata;
    if (!phoneNumberId) {
      const numbers = await listWabaPhoneNumbers(wabaId, tokenResult.accessToken);
      const selected = selectWabaPhoneNumber(numbers);
      phoneNumberId = selected.id;
      phoneMeta = {
        phoneNumberId: selected.id,
        displayPhoneNumber: selected.displayPhoneNumber,
        verifiedName: selected.verifiedName,
      };
    } else {
      phoneMeta = await fetchPhoneNumberMetadata(phoneNumberId, tokenResult.accessToken);
    }

    const { data: existingPhoneConn } = await admin
      .from("whatsapp_connections")
      .select("id, workspace_id, metadata")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();
    if (existingPhoneConn?.workspace_id && existingPhoneConn.workspace_id !== workspaceId) {
      return NextResponse.json(
        { success: false, error: "Nomor WhatsApp ini sudah terhubung dengan workspace lain." },
        { status: 409 }
      );
    }

    await subscribeAppToWaba(wabaId, tokenResult.accessToken);
    const sync =
      integrationMode === "coexistence"
        ? await startCoexistenceDataSync(phoneNumberId, tokenResult.accessToken)
        : { warnings: [] as string[] };

    // 5. Encrypt token with AES-256-GCM before persisting
    const { encryptedPayload, keyVersion } = encryptToken(tokenResult.accessToken);
    const metaUserId = await readMetaAppScopedUserId(tokenResult.accessToken).catch(() => null);
    const previousMetadata =
      existingPhoneConn?.metadata && typeof existingPhoneConn.metadata === "object" && !Array.isArray(existingPhoneConn.metadata)
        ? existingPhoneConn.metadata
        : {};
    const nowIso = new Date().toISOString();
    const tokenExpiresAt = tokenResult.expiresInSeconds
      ? new Date(Date.now() + tokenResult.expiresInSeconds * 1000).toISOString()
      : null;

    // 6. Upsert connection record (never storing token here)
    const { data: savedConn, error: upsertConnErr } = await admin
      .from("whatsapp_connections")
      .upsert(
        {
          workspace_id: workspaceId,
          sales_member_id: salesMemberId ?? null,
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          display_phone_number: phoneMeta.displayPhoneNumber,
          verified_name: phoneMeta.verifiedName,
          connection_status: "connected",
          integration_mode: integrationMode,
          coexistence_enabled: integrationMode === "coexistence",
          connected_by: user.id,
          connected_at: nowIso,
          disconnected_at: null,
          metadata: metaUserId ? { ...previousMetadata, meta_user_id: metaUserId } : previousMetadata,
        },
        { onConflict: "phone_number_id" }
      )
      .select(
        "id, workspace_id, sales_member_id, phone_number_id, waba_id, display_phone_number, verified_name, connection_status, integration_mode, last_echo_at, connected_at, disconnected_at, created_at, updated_at"
      )
      .single();

    if (upsertConnErr || !savedConn) {
      const msg = upsertConnErr?.message || "Failed to persist WhatsApp connection";
      const isQuotaError = msg.toLowerCase().includes("limit reached") || msg.toLowerCase().includes("inactive");
      return NextResponse.json(
        { success: false, error: msg },
        { status: isQuotaError ? 403 : 500 }
      );
    }

    // 7. Store encrypted token strictly inside whatsapp_connection_secrets via service_role
    const { error: secretErr } = await admin.from("whatsapp_connection_secrets").upsert(
      {
        connection_id: savedConn.id,
        workspace_id: workspaceId,
        encrypted_access_token: encryptedPayload,
        token_expires_at: tokenExpiresAt,
        expires_at: tokenExpiresAt,
        key_version: keyVersion,
        token_type: tokenResult.tokenType,
      },
      { onConflict: "connection_id" }
    );

    if (secretErr) {
      // Roll back connection status to error if secret persistence failed
      await admin
        .from("whatsapp_connections")
        .update({ connection_status: "error" })
        .eq("id", savedConn.id);
      throw new Error(`Failed to store encrypted connection credentials: ${secretErr.message}`);
    }

    return NextResponse.json({
      success: true,
      connection: savedConn,
      syncWarnings: sync.warnings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Embedded signup callback failed";
    console.error("[POST /api/whatsapp/embedded-signup/callback] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
