"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  formatFrtDuration,
  LEAD_TEMPERATURES,
  maskCtwaClid,
  PIPELINE_STAGES,
  STAGE_LABELS,
  TEMPERATURE_LABELS,
  type CtwaLeadDetailPayload,
  type LeadTemperature,
  type PipelineStage,
} from "@/lib/ctwa-leads/types";
import {
  ActorTypeBadge,
  PipelineStageBadge,
  TemperatureBadge,
} from "@/components/ctwa-leads/LeadBadges";
import { ReadOnlyTranscriptViewer } from "@/components/ctwa-leads/ReadOnlyTranscriptViewer";

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CtwaLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params?.id;
  const { locale } = useI18n();
  const isId = locale === "id";

  const [detail, setDetail] = useState<CtwaLeadDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [highlightedWamid, setHighlightedWamid] = useState<string | null>(null);

  // Override form state
  const [stageInput, setStageInput] = useState<PipelineStage>("new_inquiry");
  const [tempInput, setTempInput] = useState<LeadTemperature>("cold");
  const [lockInput, setLockInput] = useState<boolean>(false);
  const [reasonInput, setReasonInput] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const loadDetail = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await fetch(`/api/ctwa-leads/${leadId}`, { cache: "no-store" });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
      } & Partial<CtwaLeadDetailPayload>;

      if (!res.ok || !json.success || !json.lead) {
        setErrorMsg(json.error || (isId ? "Lead tidak ditemukan." : "Lead not found."));
        return;
      }

      const payload: CtwaLeadDetailPayload = {
        lead: json.lead,
        attribution: json.attribution ?? null,
        messages: json.messages ?? [],
        analyses: json.analyses ?? [],
        pipeline_events: json.pipeline_events ?? [],
      };
      setDetail(payload);
      setStageInput(payload.lead.pipeline_stage);
      setTempInput(payload.lead.lead_temperature);
      setLockInput(payload.lead.manual_stage_lock);
      setErrorMsg(null);
    } catch {
      setErrorMsg(isId ? "Gagal memuat detail lead." : "Failed to load lead detail.");
    } finally {
      setLoading(false);
    }
  }, [leadId, isId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void loadDetail();
      }
    });
    return () => {
      active = false;
    };
  }, [loadDetail]);

  // Realtime sync on this specific lead row
  useEffect(() => {
    if (!leadId) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`ctwa-lead-detail-${leadId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leads",
          filter: `id=eq.${leadId}`,
        },
        () => {
          void loadDetail();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [leadId, loadDetail]);

  const latestAnalysis = detail?.analyses[0] ?? null;

  const handleJumpToEvidence = (wamid: string) => {
    setHighlightedWamid(wamid);
    const el = document.getElementById(`msg-wamid-${wamid}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSaveOverride = async (
    confirmReviewOnly = false,
    customConfirmReason?: string
  ) => {
    if (!detail) return;
    setSaving(true);
    setNotice(null);

    try {
      const payload = confirmReviewOnly
        ? {
            needs_human_review: false,
            reason: customConfirmReason || reasonInput.trim() || "AI review confirmed by human",
          }
        : {
            pipeline_stage: stageInput,
            lead_temperature: tempInput,
            manual_stage_lock: lockInput,
            needs_human_review: false,
            reason: reasonInput.trim() || undefined,
          };

      const res = await fetch(`/api/ctwa-leads/${detail.lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        setNotice({
          kind: "error",
          text: json.error || (isId ? "Gagal menyimpan perubahan." : "Failed to save override."),
        });
        return;
      }

      setReasonInput("");
      setNotice({
        kind: "success",
        text: confirmReviewOnly
          ? isId
            ? "Review AI berhasil dikonfirmasi dan dicatat ke audit trail."
            : "AI review confirmed and logged."
          : isId
            ? "Override pipeline disimpan & dicatat ke audit trail."
            : "Override saved and recorded in audit trail.",
      });
      await loadDetail();
    } catch {
      setNotice({
        kind: "error",
        text: isId ? "Kesalahan jaringan saat menyimpan perubahan." : "Network error saving changes.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {isId ? "Memuat detail percakapan & analisis AI..." : "Loading lead detail..."}
      </div>
    );
  }

  if (errorMsg || !detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200">
          {errorMsg || (isId ? "Lead tidak ditemukan." : "Lead not found.")}
        </div>
        <Link
          href="/ctwa-leads"
          className="inline-flex items-center text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
        >
          ← {isId ? "Kembali ke CTWA Leads" : "Back to CTWA Leads"}
        </Link>
      </div>
    );
  }

  const { lead, attribution, messages, pipeline_events } = detail;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/ctwa-leads" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              CTWA Leads
            </Link>
            <span>/</span>
            <Link href="/pipeline" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Pipeline
            </Link>
            <span>/</span>
            <span className="font-mono">{lead.id.slice(0, 8)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {lead.customer_name || lead.customer_phone_masked || "Prospek CTWA"}
            </h1>
            <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
              {lead.customer_phone_masked || ""}
            </span>
            <TemperatureBadge temperature={lead.lead_temperature} />
            <PipelineStageBadge stage={lead.pipeline_stage} locked={lead.manual_stage_lock} />
            {lead.needs_human_review && (
              <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-200">
                Needs Human Review
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-zinc-400">Sales FRT</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatFrtDuration(lead.conversation?.first_response_time_seconds)}
            </span>
          </div>
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-zinc-400">Nomor Sales</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
              {lead.connection?.display_phone_number || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Validation Banner (Human-in-the-Loop) */}
      {lead.needs_human_review && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/40 dark:bg-amber-950/40"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
              {isId ? "Perlu Validasi Manusia (Human-in-the-Loop)" : "Needs Human Review"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
              <span>Saran AI:</span>
              <TemperatureBadge
                temperature={latestAnalysis?.lead_temperature ?? lead.lead_temperature}
                size="xs"
              />
              <PipelineStageBadge
                stage={latestAnalysis?.pipeline_stage_suggestion ?? lead.pipeline_stage}
                size="xs"
              />
              <span className="font-mono font-semibold">
                Confidence:{" "}
                {Math.round((latestAnalysis?.confidence ?? lead.ai_confidence ?? 0) * 100)}%
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveOverride(true, "Confirmed AI review from transcript")}
            className="shrink-0 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (isId ? "Memproses..." : "Saving...") : "Konfirmasi & Setujui"}
          </button>
        </div>
      )}

      {/* Main Split View */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT PANEL: Upgraded Read-Only Conversation Transcript Viewer */}
        <div className="lg:col-span-6">
          <ReadOnlyTranscriptViewer
            messages={messages}
            attribution={attribution}
            evidence={latestAnalysis?.evidence ?? []}
            highlightedWamid={highlightedWamid}
            onSelectEvidenceWamid={setHighlightedWamid}
            locale={locale}
          />
        </div>

        {/* RIGHT PANEL: AI Intelligence, Human Override, Ad Attribution & Audit */}
        <div className="lg:col-span-6 space-y-5">
          {/* AI Intelligence Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {isId ? "AI Lead Intelligence" : "AI Lead Intelligence"}
                </h2>
                {latestAnalysis && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {latestAnalysis.model_name} · {latestAnalysis.prompt_version} ·{" "}
                    {formatDateTime(latestAnalysis.created_at, locale)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    AI Score
                  </span>
                  <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {lead.ai_score ?? "—"}
                    {lead.ai_score !== null && (
                      <span className="text-xs font-normal text-zinc-400">/100</span>
                    )}
                  </span>
                </div>
                <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-800" />
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Confidence
                  </span>
                  <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {lead.ai_confidence !== null ? `${Math.round(lead.ai_confidence * 100)}%` : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200">
              {lead.ai_summary ||
                latestAnalysis?.summary ||
                (isId
                  ? "Menunggu analisis AI (percakapan diproses setelah jeda debounce)."
                  : "Pending AI analysis.")}
            </div>

            {latestAnalysis && (
              <>
                {/* Property Preferences */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Property Preferences
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                      <span className="text-zinc-400 block">Project</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {latestAnalysis.property_preferences.project || "-"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                      <span className="text-zinc-400 block">Location</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {latestAnalysis.property_preferences.location || "-"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                      <span className="text-zinc-400 block">Budget</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {latestAnalysis.property_preferences.budget || "-"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
                      <span className="text-zinc-400 block">Unit Type</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {latestAnalysis.property_preferences.unit_type || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Signals, Objections, Unanswered */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-zinc-700 dark:text-zinc-300">Intent Signals</h4>
                    {latestAnalysis.intent_signals.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400">
                        {latestAnalysis.intent_signals.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-400">-</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-zinc-700 dark:text-zinc-300">Objections</h4>
                    {latestAnalysis.objections.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-400">
                        {latestAnalysis.objections.map((o, idx) => (
                          <li key={idx}>{o}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-400">-</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Unanswered Questions
                    </h4>
                    {latestAnalysis.unanswered_questions.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-amber-700 dark:text-amber-300">
                        {latestAnalysis.unanswered_questions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-400">-</p>
                    )}
                  </div>
                </div>

                {/* Clickable Evidence */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isId ? "Bukti Terverifikasi (Klik untuk sorot pesan)" : "Verified Evidence"}
                  </h3>
                  {latestAnalysis.evidence.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                      {isId ? "Tidak ada bukti wamid terverifikasi." : "No verified message evidence."}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {latestAnalysis.evidence.map((ev, idx) => (
                        <button
                          key={`${ev.message_id}-${idx}`}
                          type="button"
                          onClick={() => handleJumpToEvidence(ev.message_id)}
                          className={`w-full rounded-lg border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                            highlightedWamid === ev.message_id
                              ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/50"
                              : "border-zinc-200 hover:border-indigo-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-indigo-500/50 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{ev.reason}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                            {ev.message_id}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Human Override Controls */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {isId ? "Human Override & Review Controls" : "Human Override & Review Controls"}
              </h2>
              {lead.needs_human_review && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveOverride(true)}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  Confirm AI Review
                </button>
              )}
            </div>

            {notice && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  notice.kind === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200"
                }`}
              >
                {notice.text}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Pipeline Stage
                </label>
                <select
                  value={stageInput}
                  onChange={(e) => setStageInput(e.target.value as PipelineStage)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {PIPELINE_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {STAGE_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Lead Temperature
                </label>
                <select
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value as LeadTemperature)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {LEAD_TEMPERATURES.map((tmp) => (
                    <option key={tmp} value={tmp}>
                      {TEMPERATURE_LABELS[tmp]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {isId ? "Alasan Perubahan (Opsional)" : "Change Reason (Optional)"}
              </label>
              <input
                type="text"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder={
                  isId
                    ? "Contoh: Sudah konfirmasi DP via WhatsApp Business"
                    : "e.g. Confirmed booking fee via WhatsApp"
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lockInput}
                  onChange={(e) => setLockInput(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 dark:border-zinc-700"
                />
                <span>Manual Stage Lock ({isId ? "Cegah AI ubah stage" : "Prevent AI stage updates"})</span>
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveOverride(false)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
              >
                {saving ? (isId ? "Menyimpan..." : "Saving...") : isId ? "Simpan Override" : "Save Override"}
              </button>
            </div>
          </div>

          {/* Ad Attribution Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Ad Attribution (CTWA Referral)
            </h2>
            {attribution ? (
              <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-400">Ad Headline</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {attribution.headline || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Source ID</dt>
                  <dd className="font-mono text-zinc-800 dark:text-zinc-200">
                    {attribution.source_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">CTWA CLID</dt>
                  <dd className="font-mono text-zinc-700 dark:text-zinc-300">
                    {maskCtwaClid(attribution.ctwa_clid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Campaign</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">
                    {attribution.campaign_name || (
                      <span className="italic text-zinc-400">Pending Ads API sync</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Ad Set</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">
                    {attribution.adset_name || (
                      <span className="italic text-zinc-400">Pending Ads API sync</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Ad Name</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">
                    {attribution.ad_name || (
                      <span className="italic text-zinc-400">Pending Ads API sync</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isId
                  ? "Tidak ada data referral CTWA pada percakapan ini."
                  : "No CTWA referral metadata recorded."}
              </p>
            )}
          </div>

          {/* Pipeline Audit History */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Pipeline Audit History
            </h2>
            {pipeline_events.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isId ? "Belum ada riwayat perubahan stage." : "No stage transitions recorded yet."}
              </p>
            ) : (
              <ul className="space-y-3">
                {pipeline_events.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-lg border border-zinc-200 p-3 text-xs space-y-1 dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ActorTypeBadge actor={ev.actor_type} />
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {ev.from_stage ? STAGE_LABELS[ev.from_stage] : "—"} →{" "}
                          {ev.to_stage ? STAGE_LABELS[ev.to_stage] : "—"}
                        </span>
                        {ev.from_temperature &&
                          ev.to_temperature &&
                          ev.from_temperature !== ev.to_temperature && (
                            <span className="text-zinc-500 dark:text-zinc-400">
                              ({TEMPERATURE_LABELS[ev.from_temperature]} →{" "}
                              {TEMPERATURE_LABELS[ev.to_temperature]})
                            </span>
                          )}
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {formatDateTime(ev.created_at, locale)}
                      </span>
                    </div>
                    {ev.reason && (
                      <p className="text-zinc-600 dark:text-zinc-400">{ev.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
