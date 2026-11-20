"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  formatFrtDuration,
  LEAD_TEMPERATURES,
  PIPELINE_STAGES,
  STAGE_LABELS,
  TEMPERATURE_LABELS,
  type CtwaLeadListItem,
  type CtwaLeadSummaryMetrics,
} from "@/lib/ctwa-leads/types";
import {
  PipelineStageBadge,
  TemperatureBadge,
} from "@/components/ctwa-leads/LeadBadges";

interface CpqlBreakdownItem {
  ad_id: string;
  headline: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_name: string | null;
  total_ctwa_leads: number;
  qualified_leads: number;
  qualification_rate: number | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  currency: string;
  cpl: number | null;
  cpql: number | null;
}

interface CpqlApiResponse {
  success: boolean;
  has_spend_data: boolean;
  currency: string;
  total_spend: number | null;
  total_ctwa_leads: number;
  qualified_leads: number;
  qualification_rate: number | null;
  cpl: number | null;
  cpql: number | null;
  last_synced_at: string | null;
  breakdown: CpqlBreakdownItem[];
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("id-ID")}`;
  }
}

interface LeadsApiResponse {
  success: boolean;
  workspace?: { id: string; name: string; slug: string } | null;
  summary?: CtwaLeadSummaryMetrics;
  leads?: CtwaLeadListItem[];
  connections?: Array<{
    id: string;
    display_phone_number: string | null;
    verified_name: string | null;
    connection_status: string;
  }>;
  error?: string;
}

function formatRelativeOrDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CtwaLeadsPage() {
  const { locale } = useI18n();
  const isId = locale === "id";

  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [summary, setSummary] = useState<CtwaLeadSummaryMetrics>({
    total_leads: 0,
    qualified_leads: 0,
    needs_review_count: 0,
    avg_frt_seconds: null,
  });
  const [leads, setLeads] = useState<CtwaLeadListItem[]>([]);
  const [connections, setConnections] = useState<
    Array<{ id: string; display_phone_number: string | null; verified_name: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"leads" | "cpql">("leads");
  const [cpqlData, setCpqlData] = useState<CpqlApiResponse | null>(null);

  // Filters
  const [temperature, setTemperature] = useState<string>("all");
  const [stage, setStage] = useState<string>("all");
  const [connectionId, setConnectionId] = useState<string>("all");
  const [needsReview, setNeedsReview] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (temperature !== "all") params.set("temperature", temperature);
    if (stage !== "all") params.set("stage", stage);
    if (connectionId !== "all") params.set("connectionId", connectionId);
    if (needsReview) params.set("needsReview", "true");
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString();
    return qs ? `/api/ctwa-leads?${qs}` : "/api/ctwa-leads";
  }, [temperature, stage, connectionId, needsReview, search]);

  const loadLeads = useCallback(async () => {
    try {
      const [leadsRes, cpqlRes] = await Promise.all([
        fetch(queryUrl, { cache: "no-store" }),
        fetch("/api/ctwa-leads/cpql", { cache: "no-store" }),
      ]);
      const json = (await leadsRes.json()) as LeadsApiResponse;
      if (!leadsRes.ok || !json.success) {
        setErrorMsg(json.error || (isId ? "Gagal memuat CTWA leads." : "Failed to load CTWA leads."));
        return;
      }
      setErrorMsg(null);
      setWorkspace(json.workspace ?? null);
      if (json.summary) setSummary(json.summary);
      setLeads(json.leads ?? []);
      setConnections(json.connections ?? []);

      if (cpqlRes.ok) {
        const cpqlJson = (await cpqlRes.json()) as CpqlApiResponse;
        if (cpqlJson.success) {
          setCpqlData(cpqlJson);
        }
      }
    } catch {
      setErrorMsg(
        isId ? "Terjadi kesalahan jaringan saat memuat leads." : "Network error loading leads."
      );
    } finally {
      setLoading(false);
    }
  }, [queryUrl, isId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void loadLeads();
      }
    });
    return () => {
      active = false;
    };
  }, [loadLeads]);

  // Supabase Realtime updates on leads table scoped by workspace_id
  useEffect(() => {
    if (!workspace?.id) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`ctwa-leads-realtime-${workspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          void loadLeads();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspace?.id, loadLeads]);

  const resetFilters = () => {
    setTemperature("all");
    setStage("all");
    setConnectionId("all");
    setNeedsReview(false);
    setSearch("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {isId ? "CTWA Lead Intelligence" : "CTWA Lead Intelligence"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {isId
              ? "Evaluasi kualitas prospek WhatsApp dari iklan CTWA secara objektif berbasis bukti percakapan."
              : "Evidence-based WhatsApp CTWA prospect intelligence and pipeline governance."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setActiveTab("leads")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "leads"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {isId ? "Daftar Leads" : "Leads Table"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cpql")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "cpql"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Ad Attribution &amp; CPQL
            </button>
          </div>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isId ? "Lihat Pipeline Kanban" : "Open Kanban Pipeline"}
          </Link>
          <Link
            href="/connections"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isId ? "Koneksi WhatsApp" : "WhatsApp Connections"}
          </Link>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isId ? "Total CTWA Leads" : "Total CTWA Leads"}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {summary.total_leads}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isId ? "Qualified Leads (Warm+Hot)" : "Qualified Leads (Warm+Hot)"}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {summary.qualified_leads}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isId ? "Rata-rata First Response Time" : "Avg Sales FRT"}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatFrtDuration(summary.avg_frt_seconds)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNeedsReview((prev) => !prev)}
          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            needsReview
              ? "border-amber-400 bg-amber-50/70 dark:border-amber-500/60 dark:bg-amber-950/30"
              : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          }`}
        >
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isId ? "Needs Human Review" : "Needs Human Review"}
          </p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {summary.needs_review_count}
            </span>
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {needsReview ? (isId ? "Filter aktif" : "Filtered") : isId ? "Klik untuk filter" : "Click to filter"}
            </span>
          </div>
        </button>
      </div>

      {activeTab === "cpql" ? (
        <div className="space-y-5">
          {/* CPQL KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Total Ad Spend
              </p>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatMoney(cpqlData?.total_spend ?? null, cpqlData?.currency || "IDR")}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                CPL (Cost / Lead)
              </p>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatMoney(cpqlData?.cpl ?? null, cpqlData?.currency || "IDR")}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                CPQL (Cost / Qualified Lead)
              </p>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {formatMoney(cpqlData?.cpql ?? null, cpqlData?.currency || "IDR")}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Qualification Rate (%)
              </p>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {cpqlData?.qualification_rate !== null && cpqlData?.qualification_rate !== undefined
                  ? `${cpqlData.qualification_rate}%`
                  : "—"}
              </p>
            </div>
          </div>

          {!cpqlData?.has_spend_data && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              Hubungkan izin <code className="font-mono font-semibold">ads_read</code> untuk sinkronisasi Ad Spend &amp; Auto-CPQL.
            </div>
          )}

          {/* Ad / Campaign Breakdown Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            {!cpqlData || cpqlData.breakdown.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {isId
                  ? "Belum ada data atribusi iklan CTWA pada workspace ini."
                  : "No CTWA ad attribution breakdown available yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                  <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Ad / Campaign</th>
                      <th className="px-4 py-3">Ad ID</th>
                      <th className="px-4 py-3 text-right">CTWA Leads</th>
                      <th className="px-4 py-3 text-right">Qualified</th>
                      <th className="px-4 py-3 text-right">Qual. Rate</th>
                      <th className="px-4 py-3 text-right">Ad Spend</th>
                      <th className="px-4 py-3 text-right">CPL</th>
                      <th className="px-4 py-3 text-right">CPQL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {cpqlData.breakdown.map((row) => (
                      <tr key={row.ad_id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {row.ad_name || row.headline || `Ad ${row.ad_id}`}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {row.campaign_name || (
                              <span className="italic text-zinc-400">Pending Ads API sync</span>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {row.ad_id}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {row.total_ctwa_leads}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                          {row.qualified_leads}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.qualification_rate !== null ? `${row.qualification_rate}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(row.spend, row.currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(row.cpl, row.currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {formatMoney(row.cpql, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Temperature Pill Filters */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter temperature">
            <button
              type="button"
              onClick={() => setTemperature("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                temperature === "all"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {isId ? "Semua Suhu" : "All Temperatures"}
            </button>
            {LEAD_TEMPERATURES.map((temp) => (
              <button
                key={temp}
                type="button"
                onClick={() => setTemperature(temp)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  temperature === temp
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {TEMPERATURE_LABELS[temp]}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(e) => setNeedsReview(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700"
            />
            <span>{isId ? "Needs Review Only" : "Needs Review Only"}</span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isId
                  ? "Cari nama, nomor masked, atau headline iklan..."
                  : "Search name, masked phone, or ad headline..."
              }
              aria-label={isId ? "Cari leads" : "Search leads"}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              aria-label="Filter stage"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="all">{isId ? "Semua Stage" : "All Stages"}</option>
              {PIPELINE_STAGES.map((st) => (
                <option key={st} value={st}>
                  {STAGE_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              aria-label="Filter WhatsApp connection"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="all">{isId ? "Semua Nomor Sales" : "All Sales Numbers"}</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_phone_number || c.verified_name || c.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1 flex items-center justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Leads Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {isId ? "Memuat data CTWA leads..." : "Loading CTWA leads..."}
          </div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {isId ? "Belum ada CTWA lead yang sesuai filter" : "No matching CTWA leads found"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isId
                ? "Hubungkan nomor WhatsApp Business di halaman Koneksi WhatsApp agar percakapan masuk dari iklan CTWA otomatis tercatat dan dianalisis AI."
                : "Connect your WhatsApp Business number on WhatsApp Connections to capture and analyze incoming CTWA inquiries."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">{isId ? "Prospek" : "Prospect"}</th>
                  <th className="px-4 py-3">{isId ? "Sumber Iklan CTWA" : "Ad Source"}</th>
                  <th className="px-4 py-3">{isId ? "Nomor Sales" : "Sales Number"}</th>
                  <th className="px-4 py-3">{isId ? "Suhu" : "Temp"}</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">AI Score</th>
                  <th className="px-4 py-3">FRT</th>
                  <th className="px-4 py-3">{isId ? "Aktivitas" : "Last Activity"}</th>
                  <th className="px-4 py-3 text-right">{isId ? "Aksi" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-zinc-50/90 dark:hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div>
                          <Link
                            href={`/ctwa-leads/${lead.id}`}
                            className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                          >
                            {lead.customer_name || lead.customer_phone_masked || "Prospek CTWA"}
                          </Link>
                          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                            {lead.customer_phone_masked || "—"}
                          </p>
                        </div>
                        {lead.needs_human_review && (
                          <span
                            title="Needs Human Review"
                            className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                          >
                            Review
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-[240px]">
                      {lead.attribution ? (
                        <div>
                          <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                            {lead.attribution.headline || `Ad ${lead.attribution.source_id}`}
                          </p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {lead.attribution.campaign_name || `source_id: ${lead.attribution.source_id}`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {lead.connection?.display_phone_number || "—"}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <TemperatureBadge temperature={lead.lead_temperature} />
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <PipelineStageBadge stage={lead.pipeline_stage} locked={lead.manual_stage_lock} />
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {lead.ai_score !== null ? (
                        <div>
                          <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {lead.ai_score}
                          </span>
                          <span className="text-xs text-zinc-400">/100</span>
                          {lead.ai_confidence !== null && (
                            <p className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                              {Math.round(lead.ai_confidence * 100)}% conf.
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">Pending AI</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatFrtDuration(lead.conversation?.first_response_time_seconds)}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                      {formatRelativeOrDate(
                        lead.conversation?.last_message_at ?? lead.updated_at,
                        locale
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <Link
                        href={`/ctwa-leads/${lead.id}`}
                        className="inline-flex items-center rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {isId ? "Detail" : "Inspect"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
