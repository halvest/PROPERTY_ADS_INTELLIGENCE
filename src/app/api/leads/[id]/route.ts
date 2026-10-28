import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLeadDetail as getDemoLeadDetail } from "@/lib/data/dashboard-service";
import { persistAttributionEvent } from "@/lib/data/attribution-history-service";
import type { LeadDetailView, QualityLabel } from "@/lib/data/types";
import type { AttributionStatus } from "@/domain/attribution/types";
import { transitionFunnelStage, type FunnelStage } from "@/domain/funnel/stages";

/**
 * GET /api/leads/[id]
 * Retrieves authentic lead detail, conversation history, and scoring evidence.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const isDemoId = id.startsWith("lead_syn_") || id.startsWith("demo_");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Return demo detail if requested or synthetic ID
    if (isDemoId || !user) {
      const demoLead = getDemoLeadDetail(id);
      if (demoLead) {
        return NextResponse.json({ success: true, isDemo: true, data: demoLead });
      }
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user!.id)
      .maybeSingle();

    const organizationId =
      profile?.organization_id || "00000000-0000-0000-0000-000000000001";

    // 2. Query authentic conversation
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select(`
        id,
        attribution_status,
        attribution_evidence,
        quality_label,
        started_at,
        last_message_at,
        contacts (id, name, phone_masked, domisili),
        ads (id, name, campaigns(id, name)),
        lead_assessments (
          id,
          buyer_score,
          sales_score,
          confidence,
          score_completeness,
          status,
          summary,
          missing_information
        ),
        lead_outcomes (stage, occurred_at)
      `)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (convErr || !conv) {
      return NextResponse.json(
        { success: false, error: "Lead tidak ditemukan", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 3. Query authentic messages for timeline
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_type, direction, body, sent_at")
      .eq("conversation_id", conv.id)
      .eq("organization_id", organizationId)
      .order("sent_at", { ascending: true });

    // 4. Query attribution history events
    const { data: historyEvents } = await supabase
      .from("attribution_events")
      .select("previous_status, new_status, reason, created_at, actor_id")
      .eq("conversation_id", conv.id)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
    const ad = Array.isArray(conv.ads) ? conv.ads[0] : conv.ads;
    const campaign = ad?.campaigns
      ? Array.isArray(ad.campaigns)
        ? ad.campaigns[0]
        : ad.campaigns
      : null;

    const assessment = Array.isArray(conv.lead_assessments)
      ? conv.lead_assessments[0]
      : conv.lead_assessments;

    const outcomes = Array.isArray(conv.lead_outcomes) ? conv.lead_outcomes : [];
    let currentStage: FunnelStage = "baru";
    if (outcomes.length > 0) {
      const sortedOutcomes = [...outcomes].sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      );
      const stage = sortedOutcomes[0].stage;
      if (stage === "survey") currentStage = "survei";
      else if (stage === "booking" || stage === "sale") currentStage = "closing";
      else if (stage === "lost") currentStage = "batal";
      else currentStage = "dihubungi";
    }

    const buyerScore = assessment?.buyer_score ?? null;
    const salesScore = assessment?.sales_score ?? null;
    const confidence = assessment?.confidence ? Number(assessment.confidence) : null;
    const completeness = assessment?.score_completeness ? Number(assessment.score_completeness) : 1.0;

    const evidence = (conv.attribution_evidence as Record<string, unknown>) || {};
    const contactDomisili = contact && typeof contact === "object" && "domisili" in contact ? (contact as { domisili?: string | null }).domisili : null;
    const evidenceDomisili = evidence.domisili as string | null;
    const evidenceQuality = evidence.quality_label as QualityLabel | null;
    const evidenceNotes = evidence.notes as string | null;

    const domisili = contactDomisili || evidenceDomisili || null;
    const qualityLabel = (conv.quality_label as QualityLabel | null) || evidenceQuality || null;
    const notes = evidenceNotes || assessment?.summary || null;

    const detailView: LeadDetailView = {
      id: conv.id,
      name: contact?.name || "Calon Pembeli Properti",
      phoneMasked: contact?.phone_masked || "+62 8**-****-****",
      domisili,
      funnelStage: currentStage,
      qualityLabel,
      notes,
      attributionStatus: conv.attribution_status as AttributionStatus,
      adName: ad?.name || null,
      campaignName: campaign?.name || null,
      buyerAssessment: {
        dimension: "buyer",
        rawPoints: buyerScore ?? 0,
        maxRubricPoints: 100,
        assessedValidWeight: 100,
        completeness,
        normalizedScore: buyerScore,
        confidence,
        status: buyerScore !== null ? (completeness >= 80 ? "completed" : "partial") : "insufficient_evidence",
        criteria: {},
        missingCriteria: [],
        invalidCriteria: [],
        missingInformation: assessment?.missing_information || [],
        rubricVersion: "v1.0",
      },
      salesAssessment: {
        dimension: "sales",
        rawPoints: salesScore ?? 0,
        maxRubricPoints: 100,
        assessedValidWeight: 100,
        completeness,
        normalizedScore: salesScore,
        confidence,
        status: salesScore !== null ? (completeness >= 80 ? "completed" : "partial") : "insufficient_evidence",
        criteria: {},
        missingCriteria: [],
        invalidCriteria: [],
        missingInformation: [],
        rubricVersion: "v1.0",
      },
      lastMessageAt: conv.last_message_at,
      messageCount: messages?.length || 1,
      needsReview: conv.attribution_status === "inferred",
      description: assessment?.summary || "Percakapan prospek properti melalui WhatsApp.",
      messages: (messages || []).map((m) => ({
        id: m.id,
        direction: m.sender_type === "buyer" ? ("inbound" as const) : ("outbound" as const),
        senderType: m.sender_type === "buyer" ? ("buyer" as const) : ("sales" as const),
        messageType: "text" as const,
        body: m.body,
        sentAt: m.sent_at,
        isAutomated: false,
      })),
      attributionEvidence: (conv.attribution_evidence as Record<string, unknown>) || {},
      attributionReason:
        conv.attribution_status === "verified"
          ? "Tautan resmi Meta Click-to-WhatsApp Referral"
          : conv.attribution_status === "inferred"
          ? "Kecocokan kata kunci promosi / judul iklan"
          : "Sumber tidak diketahui (organik / tanpa referral)",
      correctionHistory: (historyEvents || []).map((h) => ({
        previousStatus: (h.previous_status || "unknown") as AttributionStatus,
        newStatus: h.new_status as AttributionStatus,
        reason: h.reason || "Koreksi tinjauan supervisor",
        timestamp: h.created_at,
        actorName: "Supervisor (Review Queue)",
      })),
    };

    return NextResponse.json({
      success: true,
      isDemo: false,
      data: detailView,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server";
    return NextResponse.json(
      { success: false, error: "Gagal memuat detail lead: " + errorMsg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads/[id]
 * Updates lead outcome or submits persistent attribution correction.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const isProduction = process.env.NODE_ENV === "production";
    if ((authError || !user) && isProduction) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak terautentikasi", code: "UNAUTHORIZED" },
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

    const body = await request.json();
    const { action, newStatus, reason, newStage, qualityLabel, notes, domisili } = body;

    // 1. Attribution Correction Action
    if (action === "attribution_correction") {
      if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Alasan koreksi atribusi wajib diisi secara eksplisit." },
          { status: 400 }
        );
      }

      const validStatuses: AttributionStatus[] = ["verified", "inferred", "unknown"];
      if (!validStatuses.includes(newStatus)) {
        return NextResponse.json(
          { success: false, error: "Status atribusi baru tidak valid." },
          { status: 400 }
        );
      }

      // Fetch current status
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, attribution_status, ad_id")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (!conv) {
        return NextResponse.json(
          { success: false, error: "Percakapan tidak ditemukan dalam tenant Anda." },
          { status: 404 }
        );
      }

      const prevStatus = conv.attribution_status as AttributionStatus;

      // Update conversation status
      await supabase
        .from("conversations")
        .update({
          attribution_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id)
        .eq("organization_id", organizationId);

      // Persist audit trail event
      await persistAttributionEvent({
        organizationId,
        conversationId: conv.id,
        previousStatus: prevStatus,
        newStatus,
        previousAdId: conv.ad_id,
        newAdId: conv.ad_id,
        attributionMethod: "manual_supervisor_correction",
        reason: reason.trim(),
        actorId: user?.id || "manual-sales-user",
        supabaseClient: supabase,
      });

      return NextResponse.json({
        success: true,
        message: "Koreksi atribusi berhasil disimpan ke audit log persisten.",
      });
    }

    // 2. Funnel Stage & Lead Manual Update Action (Tahap 1)
    if (action === "funnel_update" || action === "lead_update") {
      const validStages: FunnelStage[] = ["baru", "dihubungi", "prospek", "survei", "closing", "batal"];

      if (newStage && !validStages.includes(newStage)) {
        return NextResponse.json(
          { success: false, error: "Tahap funnel baru tidak valid." },
          { status: 400 }
        );
      }

      // Fetch current conversation evidence
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, contact_id, attribution_evidence, quality_label")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (!conv) {
        return NextResponse.json(
          { success: false, error: "Percakapan prospek tidak ditemukan." },
          { status: 404 }
        );
      }

      // Stage changes must follow the domain transition rules with an explicit reason.
      if (newStage) {
        const stageReason =
          typeof reason === "string" && reason.trim()
            ? reason.trim()
            : typeof notes === "string" && notes.trim()
              ? notes.trim()
              : "";
        if (!stageReason) {
          return NextResponse.json(
            { success: false, error: "Perubahan tahap funnel wajib menyertakan alasan (reason)." },
            { status: 400 }
          );
        }
        const prevEvidenceEarly = (conv.attribution_evidence as Record<string, unknown>) || {};
        let currentStage: FunnelStage = "baru";
        if (typeof prevEvidenceEarly.funnel_stage === "string") {
          currentStage = prevEvidenceEarly.funnel_stage as FunnelStage;
        } else {
          const { data: lastOutcome } = await supabase
            .from("lead_outcomes")
            .select("stage, occurred_at")
            .eq("conversation_id", id)
            .eq("organization_id", organizationId)
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const s = (lastOutcome?.stage || "").toLowerCase();
          if (s === "survey") currentStage = "survei";
          else if (s === "booking" || s === "sale") currentStage = "closing";
          else if (s === "lost") currentStage = "batal";
          else if (lastOutcome) currentStage = "dihubungi";
        }
        try {
          transitionFunnelStage(
            { currentStage, stageHistory: [] },
            newStage as FunnelStage,
            {
              conversationId: id,
              eventReason: stageReason,
              actorId: user?.id || null,
            }
          );
        } catch (transitionErr) {
          return NextResponse.json(
            {
              success: false,
              error: transitionErr instanceof Error ? transitionErr.message : "Transisi funnel tidak valid.",
            },
            { status: 400 }
          );
        }
      }

      const prevEvidence = (conv.attribution_evidence as Record<string, unknown>) || {};
      const updatedEvidence = {
        ...prevEvidence,
        ...(newStage ? { funnel_stage: newStage } : {}),
        ...(qualityLabel !== undefined ? { quality_label: qualityLabel } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(domisili !== undefined ? { domisili } : {}),
        updated_at: new Date().toISOString(),
      };

      // Update conversation
      await supabase
        .from("conversations")
        .update({
          ...(qualityLabel !== undefined ? { quality_label: qualityLabel || null } : {}),
          attribution_evidence: updatedEvidence,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", organizationId);

      // Update contact domisili if provided
      if (domisili !== undefined && conv.contact_id) {
        await supabase
          .from("contacts")
          .update({
            domisili: domisili || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conv.contact_id)
          .eq("organization_id", organizationId);
      }

      // Record lead outcome if newStage is provided
      if (newStage) {
        let dbStage: "survey" | "booking" | "sale" | "lost" | "unknown" = "unknown";
        if (newStage === "survei") dbStage = "survey";
        else if (newStage === "closing") dbStage = "booking";
        else if (newStage === "batal") dbStage = "lost";

        await supabase.from("lead_outcomes").insert({
          organization_id: organizationId,
          conversation_id: id,
          stage: dbStage,
          occurred_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        message: "Data prospek berhasil diperbarui.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Aksi tidak dikenal." },
      { status: 400 }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Kesalahan server";
    return NextResponse.json(
      { success: false, error: "Gagal memproses aksi: " + errorMsg },
      { status: 500 }
    );
  }
}
