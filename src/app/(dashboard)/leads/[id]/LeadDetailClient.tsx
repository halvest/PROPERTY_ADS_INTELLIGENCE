"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AttributionBadge, FunnelBadge, ScorePill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { AttributionStatus } from "@/domain/attribution/types";
import type { LeadDetailView } from "@/lib/data/types";

export function LeadDetailClient({ leadId }: { leadId: string }) {
  const { t, formatDateTime, locale } = useI18n();
  const { addToast } = useToast();

  const [lead, setLead] = useState<LeadDetailView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Correction form state
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [newStatus, setNewStatus] = useState<AttributionStatus>("verified");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    async function fetchDetail() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/leads/${leadId}`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.success && json.data) {
            setLead(json.data);
            setNewStatus(json.data.attributionStatus);
          }
        }
      } catch {
        // Non-blocking fetch error
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchDetail();
    return () => {
      isCancelled = true;
    };
  }, [leadId, refreshKey]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>{locale === "id" ? "Memuat detail percakapan prospek..." : "Loading lead conversation detail..."}</span>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title={t.leads.detail.missingLeadTitle}
          description={`ID: '${leadId}' — ${t.leads.detail.missingLeadDesc}`}
        />
        <div className="mt-4 text-center">
          <Link
            href="/leads"
            className="text-xs text-indigo-600 hover:text-indigo-500 font-semibold"
          >
            &larr; {t.leads.detail.backToList}
          </Link>
        </div>
      </div>
    );
  }

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      setCorrectionError(
        locale === "id"
          ? "Alasan koreksi wajib diisi secara eksplisit"
          : "Correction reason is strictly required"
      );
      return;
    }

    setIsSubmitting(true);
    setCorrectionError("");

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attribution_correction",
          newStatus,
          reason: correctionReason.trim(),
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setShowCorrectionModal(false);
        setCorrectionReason("");
        setCorrectionError("");
        setRefreshKey((k) => k + 1);

        addToast(
          "success",
          locale === "id" ? "Status Atribusi Dikoreksi" : "Attribution Corrected",
          locale === "id"
            ? `Status prospek berhasil diperbarui menjadi "${newStatus}". Catatan audit persisten tersimpan.`
            : `Lead attribution status updated to "${newStatus}". Persistent audit record saved.`
        );
      } else {
        const err = json.error || (locale === "id" ? "Gagal menyimpan koreksi" : "Failed to save correction");
        setCorrectionError(err);
        addToast("error", locale === "id" ? "Gagal Koreksi" : "Correction Failed", err);
      }
    } catch {
      setCorrectionError("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buyerCriteria = Object.values(lead.buyerAssessment.criteria);
  const salesCriteria = Object.values(lead.salesAssessment.criteria);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-3"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t.leads.detail.backToList}
        </Link>

        {/* Lead Profile & Core Fields Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {lead.name}
                </h1>
                <FunnelBadge stage={lead.funnelStage} />
                {lead.qualityLabel === "Hot" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    🔥 Hot
                  </span>
                ) : lead.qualityLabel === "Warm" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    ☀️ Warm
                  </span>
                ) : lead.qualityLabel === "Cold" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    ❄️ Cold
                  </span>
                ) : null}
                <AttributionBadge status={lead.attributionStatus} />
              </div>

              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                ID: <span className="font-mono">{lead.id}</span> • {locale === "id" ? "WhatsApp:" : "Phone:"}{" "}
                <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{lead.phoneMasked}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewStatus(lead.attributionStatus === "verified" ? "inferred" : "verified");
                  setShowCorrectionModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
              >
                <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {t.leads.detail.correctAttributionButton}
              </button>
            </div>
          </div>

          {/* 7 Core Fields Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-2.5">
              <span className="text-zinc-400 block text-[10px] font-medium">{locale === "id" ? "Domisili" : "Domicile"}</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                {lead.domisili || <span className="text-zinc-400 italic">Belum diisi</span>}
              </span>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-2.5">
              <span className="text-zinc-400 block text-[10px] font-medium">{locale === "id" ? "Tanggal Masuk" : "Lead Date"}</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block font-mono">
                {lead.lastMessageAt ? new Date(lead.lastMessageAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </span>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-2.5">
              <span className="text-zinc-400 block text-[10px] font-medium">{locale === "id" ? "Kampanye / Iklan" : "Campaign / Ad"}</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block truncate" title={lead.adName || lead.campaignName || ""}>
                {lead.adName || lead.campaignName || <span className="text-zinc-400 italic">Tanpa tautan</span>}
              </span>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-2.5">
              <span className="text-zinc-400 block text-[10px] font-medium">{locale === "id" ? "Label Kualitas" : "Quality Label"}</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                {lead.qualityLabel ? (
                  lead.qualityLabel === "Hot" ? "🔥 Hot (Siap Beli)" :
                  lead.qualityLabel === "Warm" ? "☀️ Warm (Berminat)" : "❄️ Cold (Rendah)"
                ) : (
                  <span className="text-zinc-400 italic">Belum Dinilai</span>
                )}
              </span>
            </div>
          </div>

          {/* Catatan Singkat */}
          {(lead.notes || lead.description) && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-850/40">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                {locale === "id" ? "📝 Catatan Singkat Sales:" : "📝 Short Sales Notes:"}
              </span>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {lead.notes || lead.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Roadmap Notice: Tahap 1 vs Tahap 2 */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-xs text-sky-900 dark:text-sky-300 flex items-start gap-3">
        <span className="text-base shrink-0 mt-0.5">🚀</span>
        <div>
          <p className="font-bold text-sky-950 dark:text-sky-100 mb-0.5">
            {locale === "id"
              ? "Status CRM HD Creative: Tahap 1 Aktif (Scoring AI Otomatis Ditunda ke Tahap 2)"
              : "HD Creative CRM Status: Phase 1 Active (Automated AI Scoring Deferred to Phase 2)"}
          </p>
          <p className="leading-relaxed text-sky-800 dark:text-sky-300 text-[11px]">
            {locale === "id"
              ? "Saat ini tim sales memperbarui tahap funnel, label Hot/Warm/Cold, dan catatan singkat secara manual. Setelah integrasi percakapan WhatsApp terhubung (Tahap 2), AI akan otomatis menganalisis konteks chat untuk memberikan label kualitas objektif, alasan indikator percakapan, ringkasan kebutuhan (budget, tipe properti, lokasi), dan rekomendasi tindak lanjut."
              : "Currently sales reps manually update funnel stages, Hot/Warm/Cold labels, and short notes. Once WhatsApp conversation integration connects in Phase 2, AI will automatically analyze chat contexts to provide objective quality badges, conversation indicators, requirement summaries, and follow-up recommendations."}
          </p>
        </div>
      </div>

      {/* Buyer Score & Sales Score Dimension Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dimension 1: Buyer Score */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                1. {t.leads.detail.buyerScoreHeading}
              </h2>
              <span className="text-[11px] text-zinc-400 font-mono">
                {t.leads.detail.buyerScoreSubtitle} • v{lead.buyerAssessment.rubricVersion}
              </span>
            </div>

            <div className="flex items-center gap-2 text-right">
              <div>
                <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-mono">
                  {lead.buyerAssessment.normalizedScore !== null
                    ? `${lead.buyerAssessment.normalizedScore}`
                    : "—"}
                </span>
                <span className="text-xs text-zinc-400 block font-mono">/ 100</span>
              </div>
              <ScorePill
                score={lead.buyerAssessment.normalizedScore}
                completeness={lead.buyerAssessment.completeness}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-zinc-100 dark:border-zinc-800 text-xs">
            <div>
              <span className="text-zinc-400 block text-[10px]">{t.leads.detail.realPoints}</span>
              <span className="font-semibold font-mono">{lead.buyerAssessment.rawPoints}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">{t.leads.detail.dataCompleteness}</span>
              <span className="font-semibold font-mono">{lead.buyerAssessment.completeness}%</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">{t.leads.detail.evidenceConfidence}</span>
              <span className="font-semibold font-mono">
                {lead.buyerAssessment.confidence !== null
                  ? `${(lead.buyerAssessment.confidence * 100).toFixed(0)}%`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Criteria breakdown */}
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t.leads.detail.criteriaBreakdownTitle}:
            </p>

            {buyerCriteria.map((c) => (
              <div
                key={c.criterion}
                className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 text-xs dark:border-zinc-800/80 dark:bg-zinc-800/30"
              >
                <div className="flex items-center justify-between font-medium">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {c.criterion.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {c.status === "scored" ? `${c.score} / ${c.maxPoints}` : c.status.toUpperCase()}
                  </span>
                </div>

                {c.evidence.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {c.evidence.map((ev, i) => (
                      <p key={i} className="text-[11px] text-zinc-600 dark:text-zinc-400 pl-2 border-l-2 border-emerald-500">
                        {ev.explanation}
                      </p>
                    ))}
                  </div>
                )}

                {c.missingInformation.length > 0 && (
                  <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 pl-2 border-l-2 border-amber-400">
                    {c.missingInformation.join(", ")}
                  </div>
                )}

                {c.invalidReason && (
                  <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 pl-2 border-l-2 border-rose-500 font-semibold">
                    {c.invalidReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dimension 2: Sales Score */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                2. {t.leads.detail.salesScoreHeading}
              </h2>
              <span className="text-[11px] text-zinc-400 font-mono">
                {t.leads.detail.salesScoreSubtitle}
              </span>
            </div>

            <div className="flex items-center gap-2 text-right">
              <div>
                <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-mono">
                  {lead.salesAssessment.normalizedScore !== null
                    ? `${lead.salesAssessment.normalizedScore}`
                    : "—"}
                </span>
                <span className="text-xs text-zinc-400 block font-mono">/ 100</span>
              </div>
              <ScorePill
                score={lead.salesAssessment.normalizedScore}
                completeness={lead.salesAssessment.completeness}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-zinc-100 dark:border-zinc-800 text-xs">
            <div>
              <span className="text-zinc-400 block text-[10px]">{t.leads.detail.realPoints}</span>
              <span className="font-semibold font-mono">{lead.salesAssessment.rawPoints}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">{t.leads.detail.dataCompleteness}</span>
              <span className="font-semibold font-mono">{lead.salesAssessment.completeness}%</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">{t.leads.detail.evidenceConfidence}</span>
              <span className="font-semibold font-mono">
                {lead.salesAssessment.confidence !== null
                  ? `${(lead.salesAssessment.confidence * 100).toFixed(0)}%`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Criteria breakdown */}
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t.leads.detail.criteriaBreakdownTitle}:
            </p>

            {salesCriteria.map((c) => (
              <div
                key={c.criterion}
                className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 text-xs dark:border-zinc-800/80 dark:bg-zinc-800/30"
              >
                <div className="flex items-center justify-between font-medium">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {c.criterion.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {c.status === "scored" ? `${c.score} / ${c.maxPoints}` : c.status.toUpperCase()}
                  </span>
                </div>

                {c.evidence.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {c.evidence.map((ev, i) => (
                      <p key={i} className="text-[11px] text-zinc-600 dark:text-zinc-400 pl-2 border-l-2 border-indigo-500">
                        {ev.explanation}
                      </p>
                    ))}
                  </div>
                )}

                {c.missingInformation.length > 0 && (
                  <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 pl-2 border-l-2 border-amber-400">
                    {c.missingInformation.join(", ")}
                  </div>
                )}

                {c.invalidReason && (
                  <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 pl-2 border-l-2 border-rose-500 font-semibold">
                    {c.invalidReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WhatsApp Message Timeline */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          {t.leads.detail.conversationTimelineTitle}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          {t.leads.detail.conversationTimelineSubtitle}
        </p>

        {lead.messages.length === 0 ? (
          <p className="text-xs italic text-zinc-400 py-4 text-center">
            {t.leads.detail.noMessages}
          </p>
        ) : (
          <div className="space-y-3">
            {lead.messages.map((m) => {
              const isInbound = m.direction === "inbound";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-xl rounded-xl p-3.5 text-xs transition-colors ${
                    isInbound
                      ? "mr-auto bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/60"
                      : "ml-auto bg-indigo-600 text-white shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-80">
                    <span className="font-semibold uppercase tracking-wider">
                      {m.senderType === "buyer" ? t.leads.detail.buyerSpeaker : t.leads.detail.salesSpeaker}
                    </span>
                    <span className="font-mono">
                      {new Date(m.sentAt).toLocaleTimeString(locale === "id" ? "id-ID" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  {m.isAutomated && (
                    <span className="mt-1.5 inline-block text-[10px] font-semibold text-amber-300">
                      {t.leads.detail.automatedBotNotice}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attribution Audit History & Corrections */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          {t.leads.detail.auditTrailTitle}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          {t.leads.detail.auditTrailSubtitle}
        </p>

        {lead.correctionHistory.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-2">
            {t.leads.detail.noCorrections}
          </p>
        ) : (
          <div className="space-y-2.5">
            {lead.correctionHistory.map((hist, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-800/40"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {t.leads.detail.transitionPrefix} #{i + 1}:
                    </span>
                    <span className="font-mono text-zinc-500">{hist.previousStatus}</span>
                    <span>&rarr;</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {hist.newStatus}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {formatDateTime(hist.timestamp)}
                  </span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {t.leads.detail.reasonLabel}: &ldquo;{hist.reason}&rdquo;
                </p>
                {hist.actorName && (
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    {t.leads.detail.verifiedByPrefix}: {hist.actorName}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accessible Modal Dialog for Attribution Correction */}
      <Modal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        title={t.leads.detail.correctionModalTitle}
        description={t.leads.detail.correctionModalSubtitle}
      >
        <form onSubmit={handleCorrectionSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t.leads.detail.newStatusLabel}
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as AttributionStatus)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs font-medium text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="verified">Verified ({locale === "id" ? "Terverifikasi" : "Verified"})</option>
              <option value="inferred">Inferred ({locale === "id" ? "Inferensi" : "Inferred"})</option>
              <option value="unknown">Unknown ({locale === "id" ? "Tidak Diketahui" : "Unknown"})</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t.leads.detail.reasonLabel}
            </label>
            <textarea
              rows={3}
              value={correctionReason}
              onChange={(e) => {
                setCorrectionReason(e.target.value);
                setCorrectionError("");
              }}
              placeholder={t.leads.detail.reasonPlaceholder}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {correctionError && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {correctionError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowCorrectionModal(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && (
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {t.leads.detail.saveCorrection}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
