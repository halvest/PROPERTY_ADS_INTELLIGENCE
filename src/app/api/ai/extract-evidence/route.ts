import { NextResponse } from "next/server";
import { z } from "zod";
import { extractLeadEvidence } from "@/lib/ai/lead-evidence/extract";
import { mapEvidenceToBuyerCriteriaInputs } from "@/lib/ai/lead-evidence/domain-adapter";
import { calculateBuyerScore } from "@/domain/scoring/buyer-score";
import { isMetaModelApiConfigured, maskApiKey, getMetaConfig } from "@/lib/ai/meta/config";
import { AIProviderError } from "@/lib/ai/providers/types";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

const RequestPayloadSchema = z.object({
  conversationId: z.string().uuid().optional(),
  conversationText: z
    .string()
    .max(15000, "conversationText melebihi batas maksimum 15.000 karakter")
    .optional(),
  leadContext: z
    .object({
      contactId: z.string().optional(),
      contactName: z.string().optional(),
      platform: z.string().optional(),
      adId: z.string().optional(),
      adName: z.string().optional(),
      campaignName: z.string().optional(),
    })
    .optional(),
  propertyContext: z
    .object({
      projectName: z.string().optional(),
      unitTypesAvailable: z.array(z.string()).optional(),
      startingPrice: z.number().optional(),
      currency: z.string().optional(),
      location: z.string().optional(),
    })
    .optional(),
  allowDemoFallback: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const rl = checkRateLimit(rateLimitKey(request, "ai-extract"), 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { status: "error", code: "RATE_LIMITED", message: "Terlalu banyak permintaan. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
    const rawBody = await request.json();
    const parseResult = RequestPayloadSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          status: "error",
          code: "VALIDATION_ERROR",
          message: "Payload tidak valid.",
          errors: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    // 1. Session & Tenant Verification
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    // Demo fallback is a server deployment mode, never a client-controlled
    // auth bypass. Production always requires an authenticated session.
    const isDemoMode = process.env.DATA_MODE === "demo";

    if ((authErr || !user) && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { status: "error", code: "UNAUTHORIZED", message: "Sesi tidak terautentikasi." },
        { status: 401 }
      );
    }

    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("organization_id, role")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };

    const organizationId =
      profile?.organization_id || "00000000-0000-0000-0000-000000000001";

    let textToAnalyze = parseResult.data.conversationText || "";
    const conversationId = parseResult.data.conversationId;

    // 2. If conversationId is provided, fetch ground-truth messages from database
    if (conversationId && user) {
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .select("id, organization_id")
        .eq("id", conversationId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (convErr || !conv) {
        return NextResponse.json(
          {
            status: "error",
            code: "FORBIDDEN",
            message: "Percakapan tidak ditemukan atau di luar tenant Anda.",
          },
          { status: 403 }
        );
      }

      // Fetch authentic messages in chronological order
      const { data: dbMessages } = await supabase
        .from("messages")
        .select("sender_type, direction, body, sent_at")
        .eq("conversation_id", conversationId)
        .eq("organization_id", organizationId)
        .order("sent_at", { ascending: true });

      if (dbMessages && dbMessages.length > 0) {
        textToAnalyze = dbMessages
          .map((m) => `${m.sender_type === "buyer" ? "Lead" : "Sales"}: ${m.body}`)
          .join("\n");
      }
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      return NextResponse.json(
        {
          status: "error",
          code: "VALIDATION_ERROR",
          message: "Teks percakapan tidak boleh kosong.",
        },
        { status: 400 }
      );
    }

    const { leadContext, propertyContext } = parseResult.data;

    const isConfigured = isMetaModelApiConfigured();
    const config = getMetaConfig({ requireApiKey: false });

    // Demo fallback only in server demo mode or non-production development.
    const allowDemoFallback =
      isDemoMode || process.env.NODE_ENV !== "production" ? !isConfigured : false;
    if (!isConfigured && !allowDemoFallback) {
      return NextResponse.json(
        { status: "error", code: "MISSING_CONFIGURATION", message: "Model AI belum dikonfigurasi pada server." },
        { status: 503 }
      );
    }

    const evidence = await extractLeadEvidence(
      {
        conversationText: textToAnalyze,
        leadContext,
        propertyContext,
      },
      {
        allowDemoFallback,
      }
    );

    // Feed extracted facts into deterministic Buyer Score engine
    const buyerCriteriaInputs = mapEvidenceToBuyerCriteriaInputs(evidence, propertyContext);
    const deterministicBuyerAssessment = calculateBuyerScore(buyerCriteriaInputs);

    let persistedAssessmentId: string | null = null;

    // 3. Persist Assessment and Evidence if valid conversationId exists
    if (conversationId && user) {
      try {
        const summaryText = evidence.preferredLocation
          ? `Minat: ${evidence.preferredLocation}${evidence.propertyType ? ` (${evidence.propertyType})` : ""}`
          : (evidence.readinessForNextStep || null);

        const { data: assessmentRow } = await supabase
          .from("lead_assessments")
          .insert({
            organization_id: organizationId,
            conversation_id: conversationId,
            buyer_score: deterministicBuyerAssessment.normalizedScore,
            confidence: deterministicBuyerAssessment.confidence,
            score_completeness: deterministicBuyerAssessment.completeness,
            status: "completed",
            missing_information: deterministicBuyerAssessment.missingInformation,
            summary: summaryText,
            provider: evidence.provider,
            model_id: evidence.model,
            prompt_version: "v1.1",
            rubric_version: "v1.0",
            raw_assessment: JSON.parse(JSON.stringify(evidence)),
          })
          .select("id")
          .single();

        if (assessmentRow?.id) {
          persistedAssessmentId = assessmentRow.id;

          // Insert individual criteria evidence
          const criteriaList = Object.values(deterministicBuyerAssessment.criteria);
          const evidenceRows = criteriaList.map((crit) => ({
            organization_id: organizationId,
            assessment_id: assessmentRow.id,
            score_type: "buyer" as const,
            criterion: crit.criterion,
            points_awarded: crit.score ?? 0,
            max_points: crit.maxPoints,
            explanation: crit.missingInformation.length > 0 ? crit.missingInformation.join("; ") : "Kriteria dinilai dari bukti transkrip",
            evidence_status: crit.status === "scored" ? ("supported" as const) : ("missing" as const),
          }));

          if (evidenceRows.length > 0) {
            await supabase.from("assessment_evidence").insert(evidenceRows);
          }
        }
      } catch {
        // Non-fatal persistence error: output still returned to caller
      }
    }

    return NextResponse.json({
      status: "success",
      isLiveMetaApi: isConfigured && evidence.model !== "muse-spark-demo-fallback",
      provider: evidence.provider,
      model: evidence.model,
      maskedApiKey: maskApiKey(config.apiKey),
      baseUrl: config.baseUrl,
      evidence,
      deterministicBuyerAssessment,
      persistedAssessmentId,
    });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json(
        {
          status: "error",
          code: error.code,
          message: error.message,
          provider: error.provider,
          model: error.modelId,
          isRecoverable: error.isRecoverable,
        },
        { status: error.statusCode ?? (error.code === "MISSING_CONFIGURATION" ? 503 : 500) }
      );
    }

    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal";
    return NextResponse.json(
      {
        status: "error",
        code: "INTERNAL_ERROR",
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * Health check / configuration status for internal Meta Model API diagnostic.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { status: "error", code: "UNAUTHORIZED", message: "Sesi tidak terautentikasi." },
      { status: 401 }
    );
  }
  const isConfigured = isMetaModelApiConfigured();
  const config = getMetaConfig({ requireApiKey: false });

  return NextResponse.json({
    status: "ok",
    provider: "meta_model_api",
    configured: isConfigured,
    model: config.museSparkModel,
    supportedModels: [
      { id: "muse-spark-1.3", description: "Official fast lead extraction & reasoning model" },
      { id: "muse-wonder", description: "Complex reasoning & campaign strategy (future)" },
      { id: "muse-image", description: "Property creative generation (future)" },
      { id: "sam-3.1", description: "Spatial object segmentation (future)" },
    ],
  });
}
