"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  CtwaLeadDetailPayload,
  CtwaLeadEvidenceEntry,
  CtwaLeadMessageItem,
} from "@/lib/ctwa-leads/types";
import {
  computeResponseGaps,
  formatIndonesianDuration,
  getUnansweredProspectStatus,
  type ResponseGapSeverity,
} from "@/lib/ctwa-leads/transcript-audit";

export interface ReadOnlyTranscriptViewerProps {
  messages: CtwaLeadMessageItem[];
  attribution: CtwaLeadDetailPayload["attribution"];
  evidence: CtwaLeadEvidenceEntry[];
  highlightedWamid: string | null;
  onSelectEvidenceWamid?: (wamid: string) => void;
  locale?: string;
}

const GAP_PILL_STYLES: Record<ResponseGapSeverity, string> = {
  fast: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-200",
  normal:
    "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  slow: "border-amber-300 bg-amber-50 text-amber-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-amber-200",
};

function formatMessageTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale === "id" ? "id-ID" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) {
    return <>{text}</>;
  }

  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, "gi");
  const parts = text.split(regex);
  const lowerQuery = trimmed.toLowerCase();

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === lowerQuery ? (
          <mark
            key={idx}
            className="rounded bg-amber-200 px-0.5 text-zinc-950 dark:bg-amber-400/80 dark:text-zinc-950"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

export function ReadOnlyTranscriptViewer({
  messages,
  attribution,
  evidence,
  highlightedWamid,
  onSelectEvidenceWamid,
  locale = "id",
}: ReadOnlyTranscriptViewerProps) {
  const [filterMode, setFilterMode] = useState<"all" | "evidence">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const evidenceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of evidence) {
      if (!map.has(ev.message_id)) {
        map.set(ev.message_id, ev.reason);
      }
    }
    return map;
  }, [evidence]);

  const orderedEvidenceWamids = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const ev of evidence) {
      if (!seen.has(ev.message_id) && messages.some((m) => m.wamid === ev.message_id)) {
        seen.add(ev.message_id);
        list.push(ev.message_id);
      }
    }
    return list;
  }, [evidence, messages]);

  const evidenceMessageCount = useMemo(
    () => messages.filter((m) => Boolean(m.wamid && evidenceMap.has(m.wamid))).length,
    [messages, evidenceMap]
  );

  const responseGapBySalesMsgId = useMemo(() => {
    const gaps = computeResponseGaps(messages);
    return new Map(gaps.map((g) => [g.salesMessageId, g]));
  }, [messages]);

  const unansweredStatus = useMemo(
    () => getUnansweredProspectStatus(messages, nowMs),
    [messages, nowMs]
  );

  const visibleMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((msg) => {
      if (filterMode === "evidence" && (!msg.wamid || !evidenceMap.has(msg.wamid))) {
        return false;
      }
      if (q) {
        const text = (msg.body_text ?? msg.body ?? "").toLowerCase();
        const reason = msg.wamid ? (evidenceMap.get(msg.wamid) ?? "").toLowerCase() : "";
        if (!text.includes(q) && !reason.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [messages, filterMode, searchQuery, evidenceMap]);

  const activeEvidenceIndex = highlightedWamid
    ? orderedEvidenceWamids.indexOf(highlightedWamid)
    : -1;

  const jumpEvidence = (step: 1 | -1) => {
    if (orderedEvidenceWamids.length === 0) return;
    const nextIdx =
      activeEvidenceIndex === -1
        ? step === 1
          ? 0
          : orderedEvidenceWamids.length - 1
        : (activeEvidenceIndex + step + orderedEvidenceWamids.length) %
          orderedEvidenceWamids.length;
    const targetWamid = orderedEvidenceWamids[nextIdx];
    if (filterMode === "evidence" && searchQuery.trim()) {
      setSearchQuery("");
    }
    onSelectEvidenceWamid?.(targetWamid);
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-wamid-${targetWamid}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Sticky Transcript Toolbar */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 p-3.5 space-y-2.5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === "all"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Semua Pesan ({messages.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("evidence")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === "evidence"
                  ? "bg-white text-indigo-700 shadow-2xs dark:bg-zinc-950 dark:text-indigo-300"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Hanya Bukti AI ({evidenceMessageCount})
            </button>
          </div>

          {orderedEvidenceWamids.length > 0 && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 py-1 text-[11px] font-semibold text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-200">
              <span className="mr-1">
                Bukti AI{" "}
                {activeEvidenceIndex >= 0
                  ? `${activeEvidenceIndex + 1}/${orderedEvidenceWamids.length}`
                  : `(${orderedEvidenceWamids.length})`}
              </span>
              <button
                type="button"
                onClick={() => jumpEvidence(-1)}
                aria-label="Prev AI Evidence"
                className="rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-[10px] hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-zinc-900 dark:hover:bg-indigo-900/50 cursor-pointer"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => jumpEvidence(1)}
                aria-label="Next AI Evidence"
                className="rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-[10px] hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-zinc-900 dark:hover:bg-indigo-900/50 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kata kunci dalam transkrip..."
            aria-label="Cari kata kunci dalam transkrip"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
          />
        </div>
      </div>

      {/* Scrollable Transcript Stream */}
      <div className="flex-1 max-h-[720px] overflow-y-auto p-4 space-y-3">
        {/* Pinned CTWA Ad Referral Card */}
        {attribution && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs dark:border-indigo-500/30 dark:bg-indigo-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                CTWA Ad Click
              </span>
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                Ad ID: {attribution.source_id}
              </span>
            </div>
            <p className="mt-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
              {attribution.headline || `Ad ID: ${attribution.source_id}`}
            </p>
            {attribution.campaign_name && (
              <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                Campaign: {attribution.campaign_name}
              </p>
            )}
          </div>
        )}

        {visibleMessages.length === 0 ? (
          <p className="py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {messages.length === 0
              ? "Belum ada pesan tersimpan pada percakapan ini."
              : "Tidak ada pesan yang cocok dengan filter atau kata kunci pencarian."}
          </p>
        ) : (
          visibleMessages.map((msg) => {
            const isSales =
              msg.direction === "outbound_sales_echo" || msg.direction === "outbound";
            const evidenceReason = msg.wamid ? evidenceMap.get(msg.wamid) : undefined;
            const isCited = Boolean(evidenceReason);
            const isFocused = Boolean(msg.wamid && highlightedWamid === msg.wamid);
            const textContent = (msg.body_text ?? msg.body ?? "").trim();
            const gapInfo = isSales ? responseGapBySalesMsgId.get(msg.id) : undefined;

            return (
              <div key={msg.id} className="space-y-1.5">
                {gapInfo && (
                  <div className="flex justify-center py-0.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium ${GAP_PILL_STYLES[gapInfo.severity]}`}
                    >
                      <span>{gapInfo.severity === "fast" ? "⚡" : "⏱"}</span>
                      <span>Dibalas dalam {formatIndonesianDuration(gapInfo.gapSeconds)}</span>
                    </span>
                  </div>
                )}

                <div
                  id={msg.wamid ? `msg-wamid-${msg.wamid}` : undefined}
                  className={`flex flex-col ${isSales ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[86%] rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
                      isFocused
                        ? "border-indigo-500 ring-2 ring-indigo-500/35 bg-indigo-50/80 dark:bg-indigo-950/50"
                        : isCited
                          ? "border-indigo-400 bg-indigo-50/40 dark:border-indigo-500/60 dark:bg-indigo-950/25"
                          : isSales
                            ? "border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                            : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                      <span
                        className={
                          isSales
                            ? "text-zinc-600 dark:text-zinc-400"
                            : "text-emerald-700 dark:text-emerald-400"
                        }
                      >
                        {isSales ? "SALES ECHO" : "PROSPECT"}
                      </span>
                      <span className="text-zinc-400 font-normal">
                        {formatMessageTime(msg.sent_at, locale)}
                      </span>
                      {isCited && (
                        <span className="rounded bg-indigo-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                          AI Evidence
                        </span>
                      )}
                    </div>

                    <p className="whitespace-pre-wrap leading-relaxed text-zinc-900 dark:text-zinc-100">
                      <HighlightedText
                        text={textContent || `[${msg.message_type}]`}
                        query={searchQuery}
                      />
                    </p>

                    {msg.wamid && (
                      <p className="mt-1.5 font-mono text-[10px] text-zinc-400 truncate">
                        {msg.wamid}
                      </p>
                    )}
                  </div>

                  {isCited && evidenceReason && (
                    <div className="mt-1 max-w-[86%] rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-[11px] text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-200">
                      <span className="font-semibold">Alasan AI:</span> {evidenceReason}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Read-Only Footer Status (Strictly Analysis-Only, NO reply composer) */}
      {unansweredStatus.isUnanswered ? (
        <div className="border-t border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
          Prospek menunggu balasan sales sejak{" "}
          <span className="font-bold">{formatIndonesianDuration(unansweredStatus.waitingSeconds)}</span>{" "}
          lalu • Mode Read-Only (balas langsung dari WhatsApp Business App)
        </div>
      ) : (
        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
          Transkrip Read-Only tersinkronisasi via WhatsApp Coexistence
        </div>
      )}
    </div>
  );
}
