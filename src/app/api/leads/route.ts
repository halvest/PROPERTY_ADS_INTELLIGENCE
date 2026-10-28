import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLeadsList as getDemoLeads } from "@/lib/data/dashboard-service";
import type { LeadListItem, QualityLabel } from "@/lib/data/types";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { AttributionStatus } from "@/domain/attribution/types";
import type { DimensionAssessment } from "@/domain/scoring/types";
import {
  importCrmLeadsToDatabase,
  cleanPhoneNumber,
  hashPhoneNumber,
  maskPhoneNumber,
  normalizeQualityLabel,
  normalizeFunnelStage,
} from "@/lib/crm/crm-sheets-service";

/**
 * GET /api/leads
 * Retrieves authoritative list of leads for the authenticated tenant.
 * Supports dateRange, funnelStage, attributionStatus, and search filters.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const { searchParams } = request.nextUrl;
    const isDemoQuery = process.env.DATA_MODE === "demo";
    const dateRange = searchParams.get("dateRange") || "all";
    const funnelStage = searchParams.get("funnelStage") || "all";
    const attributionStatus = searchParams.get("attributionStatus") || "all";
    const qualityLabel = searchParams.get("qualityLabel") || "all";
    const search = searchParams.get("search")?.toLowerCase().trim() || "";

    if ((authError || !user) && !isDemoQuery && process.env.NODE_ENV === "production") {
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

    // 1. If explicit demo mode is requested, return sanitized demo leads
    if (isDemoQuery) {
      const demoList = getDemoLeads({
        dateRange,
        funnelStage,
        attributionStatus,
        qualityLabel,
        search,
      });
      return NextResponse.json({
        success: true,
        isDemoMode: true,
        data: demoList,
      });
    }

    // 2. Live mode: Query authentic database conversations
    let query = supabase
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
          buyer_score,
          sales_score,
          confidence,
          score_completeness,
          status,
          missing_information,
          summary
        ),
        lead_outcomes (stage, occurred_at)
      `)
      .eq("organization_id", organizationId)
      .order("last_message_at", { ascending: false });

    // Date range filtering
    if (dateRange && dateRange !== "all") {
      const today = new Date();
      let days = 30;
      if (dateRange === "7d") days = 7;
      else if (dateRange === "14d") days = 14;
      else if (dateRange === "today") days = 1;

      const sinceDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("last_message_at", sinceDate);
    }

    if (attributionStatus && attributionStatus !== "all") {
      query = query.eq("attribution_status", attributionStatus);
    }

    const { data: rows, error: dbError } = await query;

    if (dbError) {
      return NextResponse.json(
        { success: false, error: `Gagal memuat daftar lead: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Also get message counts per conversation
    const convIds = (rows || []).map((r) => r.id);
    const messageCountMap = new Map<string, number>();

    if (convIds.length > 0) {
      const { data: msgCounts } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convIds);

      (msgCounts || []).forEach((m) => {
        messageCountMap.set(
          m.conversation_id,
          (messageCountMap.get(m.conversation_id) || 0) + 1
        );
      });
    }

    // 3. Map to LeadListItem format
    const leads: LeadListItem[] = (rows || []).map((r) => {
      const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
      const ad = Array.isArray(r.ads) ? r.ads[0] : r.ads;
      const campaign = ad?.campaigns
        ? Array.isArray(ad.campaigns)
          ? ad.campaigns[0]
          : ad.campaigns
        : null;

      const assessment = Array.isArray(r.lead_assessments)
        ? r.lead_assessments[0]
        : r.lead_assessments;

      const outcomes = Array.isArray(r.lead_outcomes) ? r.lead_outcomes : [];
      // Resolve latest outcome stage
      let currentStage: FunnelStage = "baru";
      const evidence = r.attribution_evidence as Record<string, unknown> | null;
      if (evidence && typeof evidence === "object" && typeof evidence.funnel_stage === "string") {
        currentStage = evidence.funnel_stage as FunnelStage;
      } else if (outcomes.length > 0) {
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

      const needsReview =
        r.attribution_status === "inferred" ||
        (buyerScore !== null && buyerScore < 50) ||
        assessment?.status === "needs_review";

      const buyerAssessment: DimensionAssessment = {
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
      };

      const salesAssessment: DimensionAssessment = {
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
      };

      const contactDomisili = contact && typeof contact === "object" && "domisili" in contact ? (contact as { domisili?: string | null }).domisili : null;
      const evidenceDomisili = evidence && typeof evidence === "object" ? (evidence.domisili as string | null) : null;
      const evidenceQuality = evidence && typeof evidence === "object" ? (evidence.quality_label as QualityLabel | null) : null;
      const evidenceNotes = evidence && typeof evidence === "object" ? (evidence.notes as string | null) : null;

      const domisili = contactDomisili || evidenceDomisili || null;
      const qualityLabel = (r.quality_label as QualityLabel | null) || evidenceQuality || null;
      const notes = evidenceNotes || assessment?.summary || null;

      return {
        id: r.id,
        name: contact?.name || "Calon Pembeli Properti",
        phoneMasked: contact?.phone_masked || "+62 8**-****-****",
        domisili,
        funnelStage: currentStage,
        qualityLabel,
        notes,
        attributionStatus: r.attribution_status as AttributionStatus,
        adName: ad?.name || null,
        campaignName: campaign?.name || null,
        buyerAssessment,
        salesAssessment,
        lastMessageAt: r.last_message_at,
        messageCount: messageCountMap.get(r.id) || 1,
        needsReview,
        reviewReason:
          r.attribution_status === "inferred"
            ? "Atribusi terinferensi (perlu verifikasi)"
            : undefined,
      };
    });

    // 4. Client-requested post-filters (funnelStage, qualityLabel, search)
    let filteredLeads = leads;
    if (funnelStage && funnelStage !== "all") {
      filteredLeads = filteredLeads.filter((l) => l.funnelStage === funnelStage);
    }

    if (qualityLabel && qualityLabel !== "all") {
      filteredLeads = filteredLeads.filter((l) => l.qualityLabel === qualityLabel);
    }

    if (search) {
      filteredLeads = filteredLeads.filter(
        (l) =>
          l.name.toLowerCase().includes(search) ||
          l.phoneMasked.includes(search) ||
          (l.domisili && l.domisili.toLowerCase().includes(search)) ||
          (l.notes && l.notes.toLowerCase().includes(search)) ||
          (l.adName && l.adName.toLowerCase().includes(search)) ||
          (l.campaignName && l.campaignName.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      isDemoMode: false,
      data: filteredLeads,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Kesalahan server internal";
    return NextResponse.json(
      { success: false, error: "Gagal memproses data leads: " + errorMsg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads
 * Handles direct manual input of a single lead by sales (Tahap 1 — Sekarang, tanpa integrasi WhatsApp).
 * Core fields: Nama & WhatsApp, Domisili, Tanggal Masuk, Kampanye/Iklan, Tahap Funnel, Label Kualitas, Catatan Singkat.
 */
export async function POST(request: NextRequest) {
  try {
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

    const nama = typeof body.nama === "string" ? body.nama.trim() : "";
    if (!nama) {
      return NextResponse.json(
        { success: false, error: "Nama prospek wajib diisi." },
        { status: 400 }
      );
    }

    const rawPhone = typeof body.telepon === "string" || typeof body.telepon === "number" ? String(body.telepon) : "";
    const cleanedDigits = cleanPhoneNumber(rawPhone);
    if (!rawPhone || cleanedDigits.length < 9) {
      return NextResponse.json(
        { success: false, error: "Nomor WhatsApp/HP wajib diisi (minimal 9 digit)." },
        { status: 400 }
      );
    }

    const { stage } = normalizeFunnelStage(body.tahapFunnel);
    const qualityLabel = normalizeQualityLabel(body.qualityLabel);
    const domisili = typeof body.domisili === "string" ? body.domisili.trim() : undefined;
    const namaIklan = typeof body.namaIklan === "string" ? body.namaIklan.trim() : undefined;
    const catatan = typeof body.catatan === "string" ? body.catatan.trim() : undefined;
    const tanggalKontak = body.tanggalMasuk
      ? new Date(body.tanggalMasuk).toISOString()
      : new Date().toISOString();

    const singleLead = {
      nama,
      telepon: cleanedDigits,
      phoneHash: hashPhoneNumber(cleanedDigits),
      phoneMasked: maskPhoneNumber(cleanedDigits),
      domisili,
      tanggalKontak,
      namaIklan,
      tahapFunnel: stage,
      qualityLabel,
      catatan,
      statusAtribusi: (namaIklan ? "verified" : "unknown") as AttributionStatus,
    };

    const importResult = await importCrmLeadsToDatabase({
      organizationId,
      leads: [singleLead],
      supabase,
    });

    if (!importResult.success && importResult.insertedCount === 0 && importResult.updatedCount === 0) {
      return NextResponse.json(
        { success: false, error: importResult.errors[0]?.error || "Gagal menyimpan prospek ke database." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Prospek baru berhasil disimpan ke CRM.",
      lead: importResult.importedLeads[0],
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Kesalahan server";
    return NextResponse.json(
      { success: false, error: "Gagal membuat prospek manual: " + errorMsg },
      { status: 500 }
    );
  }
}
