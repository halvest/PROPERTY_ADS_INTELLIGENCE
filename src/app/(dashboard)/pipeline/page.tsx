"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  LEAD_TEMPERATURES,
  PIPELINE_STAGES,
  STAGE_LABELS,
  TEMPERATURE_LABELS,
  type CtwaLeadListItem,
  type PipelineStage,
} from "@/lib/ctwa-leads/types";
import { TemperatureBadge } from "@/components/ctwa-leads/LeadBadges";

interface LeadsApiResponse {
  success: boolean;
  workspace?: { id: string; name: string; slug: string } | null;
  leads?: CtwaLeadListItem[];
  error?: string;
}

export default function PipelineKanbanPage() {
  const { locale } = useI18n();
  const isId = locale === "id";

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [leads, setLeads] = useState<CtwaLeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

  // Lightweight board filters
  const [temperatureFilter, setTemperatureFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/ctwa-leads", { cache: "no-store" });
      const json = (await res.json()) as LeadsApiResponse;
      if (!res.ok || !json.success) {
        setErrorMsg(json.error || (isId ? "Gagal memuat pipeline." : "Failed to load pipeline."));
        return;
      }
      setErrorMsg(null);
      setWorkspaceId(json.workspace?.id ?? null);
      setLeads(json.leads ?? []);
    } catch {
      setErrorMsg(isId ? "Kesalahan jaringan saat memuat pipeline." : "Network error loading pipeline.");
    } finally {
      setLoading(false);
    }
  }, [isId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void loadBoard();
      }
    });
    return () => {
      active = false;
    };
  }, [loadBoard]);

  // Supabase Realtime updates scoped by workspace_id
  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`pipeline-kanban-realtime-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void loadBoard();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, loadBoard]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (temperatureFilter !== "all" && lead.lead_temperature !== temperatureFilter) {
        return false;
      }
      if (q) {
        const match = [
          lead.customer_name,
          lead.customer_phone_masked,
          lead.attribution?.headline,
          lead.attribution?.source_id,
        ].some((val) => val && val.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [leads, temperatureFilter, search]);

  const leadsByStage = useMemo(() => {
    const map: Record<PipelineStage, CtwaLeadListItem[]> = {
      new_inquiry: [],
      contacted: [],
      qualified: [],
      survey: [],
      closing: [],
      won: [],
      lost: [],
    };
    for (const lead of filteredLeads) {
      map[lead.pipeline_stage].push(lead);
    }
    return map;
  }, [filteredLeads]);

  const handleMoveStage = async (lead: CtwaLeadListItem, targetStage: PipelineStage) => {
    if (lead.pipeline_stage === targetStage) return;

    const previousSnapshot = leads;
    setMovingLeadId(lead.id);
    setErrorMsg(null);

    // Optimistic update (stage changed + manual_stage_lock = true)
    setLeads((prev) =>
      prev.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              pipeline_stage: targetStage,
              manual_stage_lock: true,
              needs_human_review: false,
            }
          : item
      )
    );

    try {
      const res = await fetch(`/api/ctwa-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_stage: targetStage,
          manual_stage_lock: true,
          needs_human_review: false,
          reason: `Moved to ${STAGE_LABELS[targetStage]} on Kanban board`,
        }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        setLeads(previousSnapshot);
        setErrorMsg(json.error || (isId ? "Gagal memindahkan stage." : "Failed to move stage."));
        return;
      }
      await loadBoard();
    } catch {
      setLeads(previousSnapshot);
      setErrorMsg(isId ? "Kesalahan jaringan saat memindahkan stage." : "Network error updating stage.");
    } finally {
      setMovingLeadId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {isId ? "Pipeline Kanban" : "Pipeline Kanban"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {isId
              ? "Pemindahan stage manual otomatis mengaktifkan Manual Stage Lock dan mencatat audit trail."
              : "Manual stage moves automatically enable Manual Stage Lock and record an audit trail."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isId ? "Cari lead..." : "Search leads..."}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <select
            value={temperatureFilter}
            onChange={(e) => setTemperatureFilter(e.target.value)}
            aria-label="Filter temperature"
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="all">{isId ? "Semua Suhu" : "All Temperatures"}</option>
            {LEAD_TEMPERATURES.map((t) => (
              <option key={t} value={t}>
                {TEMPERATURE_LABELS[t]}
              </option>
            ))}
          </select>
          <Link
            href="/ctwa-leads"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {isId ? "Tampilan Tabel" : "Table View"}
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {isId ? "Memuat pipeline Kanban..." : "Loading pipeline board..."}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stageKey) => {
            const columnLeads = leadsByStage[stageKey];
            const isOver = dragOverStage === stageKey;

            return (
              <div
                key={stageKey}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverStage !== stageKey) setDragOverStage(stageKey);
                }}
                onDragLeave={() => {
                  if (dragOverStage === stageKey) setDragOverStage(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  const droppedId = e.dataTransfer.getData("text/plain") || draggedLeadId;
                  setDraggedLeadId(null);
                  if (!droppedId) return;
                  const targetLead = leads.find((l) => l.id === droppedId);
                  if (targetLead) {
                    void handleMoveStage(targetLead, stageKey);
                  }
                }}
                className={`flex min-h-[460px] w-72 shrink-0 flex-col rounded-xl border transition-colors ${
                  isOver
                    ? "border-indigo-400 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/20"
                    : "border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-zinc-200 px-3.5 py-3 dark:border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                    {STAGE_LABELS[stageKey]}
                  </span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-200 px-1.5 text-[11px] font-bold tabular-nums text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                    {columnLeads.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="flex-1 space-y-2.5 p-2.5">
                  {columnLeads.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-[11px] text-zinc-400 dark:border-zinc-800">
                      {isId ? "Kosong" : "Empty"}
                    </div>
                  ) : (
                    columnLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedLeadId(lead.id);
                          e.dataTransfer.setData("text/plain", lead.id);
                        }}
                        onDragEnd={() => {
                          setDraggedLeadId(null);
                          setDragOverStage(null);
                        }}
                        className={`rounded-lg border border-zinc-200 bg-white p-3 space-y-2 shadow-2xs transition-opacity dark:border-zinc-800 dark:bg-zinc-950 ${
                          movingLeadId === lead.id ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/ctwa-leads/${lead.id}`}
                            className="text-xs font-bold text-zinc-900 hover:underline dark:text-zinc-100 line-clamp-1"
                          >
                            {lead.customer_name || lead.customer_phone_masked || "Prospek CTWA"}
                          </Link>

                          {lead.manual_stage_lock && (
                            <span title="Manual Stage Locked" className="text-zinc-500 dark:text-zinc-400">
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                                />
                              </svg>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <TemperatureBadge temperature={lead.lead_temperature} size="xs" />
                          <span className="text-[11px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
                            AI: {lead.ai_score ?? "—"}
                          </span>
                        </div>

                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {lead.attribution?.headline ||
                            (lead.attribution ? `Ad ${lead.attribution.source_id}` : "Organic / No Headline")}
                        </p>

                        <div className="pt-1 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between gap-1.5">
                          <select
                            aria-label={`Move ${lead.customer_name || lead.id} to stage`}
                            disabled={movingLeadId === lead.id}
                            value={lead.pipeline_stage}
                            onChange={(e) => void handleMoveStage(lead, e.target.value as PipelineStage)}
                            className="w-full rounded border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer"
                          >
                            {PIPELINE_STAGES.map((st) => (
                              <option key={st} value={st}>
                                {STAGE_LABELS[st]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
