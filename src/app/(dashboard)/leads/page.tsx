"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { CRMLeadsUploadModal } from "@/components/crm/CRMLeadsUploadModal";
import { CRMManualLeadModal } from "@/components/crm/CRMManualLeadModal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { LeadListItem } from "@/lib/data/types";
import type { FunnelStage } from "@/domain/funnel/stages";
import { getAllowedFunnelTransitions } from "@/domain/funnel/stages";
import { useToast } from "@/components/ui/Toast";

interface LeadsSummary {
  total: number;
  newLeads: number;
  hotWarm: number;
  hotWarmRate: number;
  surveyOrClosing: number;
  leadToSurveyRate: number;
  linkedSources: number;
  unlinkedSources: number;
  adLinkRate: number;
}

type LeadSortKey = "lastMessageAt" | "name" | "funnelStage" | "qualityLabel";
const LEADS_PAGE_SIZE = 20;

function SummaryCard({ title, value, detail, warning = false }: { title: string; value: string | number; detail: string; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">{value}</div>
      <div className={`mt-1 text-[11px] ${warning ? "font-semibold text-amber-700 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"}`}>{detail}</div>
    </div>
  );
}

export default function LeadsDirectoryPage() {
  const { t, locale } = useI18n();
  const { addToast } = useToast();
  const [dateRange, setDateRange] = useState("all");
  const [funnelStage, setFunnelStage] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [attributionStatus, setAttributionStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<LeadsSummary | null>(null);
  const [sortKey, setSortKey] = useState<LeadSortKey>("lastMessageAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [savingLeadIds, setSavingLeadIds] = useState<Set<string>>(new Set());

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (dateRange && dateRange !== "all") params.set("dateRange", dateRange);
      if (funnelStage && funnelStage !== "all") params.set("funnelStage", funnelStage);
      if (qualityFilter && qualityFilter !== "all") params.set("qualityLabel", qualityFilter);
      if (attributionStatus && attributionStatus !== "all") params.set("attributionStatus", attributionStatus);
      if (search) params.set("search", search);

      const res = await fetch(`/api/leads?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || (locale === "id" ? "Gagal memuat daftar prospek." : "Failed to load leads."));
      }
      setLeads(json.data);
      setSummary(json.summary || null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : (locale === "id" ? "Terjadi kesalahan jaringan." : "A network error occurred."));
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, funnelStage, qualityFilter, attributionStatus, search, locale]);

  useEffect(() => {
    const timer = setTimeout(loadLeads, 150);
    return () => clearTimeout(timer);
  }, [loadLeads, refreshKey]);

  const updateLead = useCallback(async (
    leadId: string,
    payload: { newStage?: FunnelStage; funnelStage?: FunnelStage; reason?: string; qualityLabel?: string | null }
  ) => {
    const original = leads.find((lead) => lead.id === leadId);
    setSavingLeadIds((ids) => new Set(ids).add(leadId));
    setLeads((items) => items.map((lead) => lead.id !== leadId ? lead : {
      ...lead,
      ...(payload.newStage || payload.funnelStage ? { funnelStage: (payload.newStage || payload.funnelStage)! } : {}),
      ...(payload.qualityLabel !== undefined ? { qualityLabel: payload.qualityLabel as LeadListItem["qualityLabel"] } : {}),
    }));
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lead_update", ...payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal memperbarui prospek.");
      addToast("success", locale === "id" ? "Prospek Diperbarui" : "Lead Updated", locale === "id" ? "Perubahan berhasil disimpan." : "Changes saved.");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      if (original) setLeads((items) => items.map((lead) => lead.id === leadId ? original : lead));
      addToast("error", locale === "id" ? "Gagal Memperbarui" : "Update Failed", error instanceof Error ? error.message : "Network error");
    } finally {
      setSavingLeadIds((ids) => {
        const next = new Set(ids);
        next.delete(leadId);
        return next;
      });
    }
  }, [leads, addToast, locale]);

  const sortedLeads = useMemo(() => {
    const stageOrder: FunnelStage[] = ["baru", "dihubungi", "prospek", "survei", "closing", "batal"];
    const qualityOrder: Record<string, number> = { Hot: 0, Warm: 1, Cold: 2, "": 3 };
    return [...leads].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name, locale);
      else if (sortKey === "funnelStage") comparison = stageOrder.indexOf(a.funnelStage) - stageOrder.indexOf(b.funnelStage);
      else if (sortKey === "qualityLabel") comparison = (qualityOrder[a.qualityLabel || ""] ?? 3) - (qualityOrder[b.qualityLabel || ""] ?? 3);
      else comparison = new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [leads, sortKey, sortDirection, locale]);
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / LEADS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLeads = sortedLeads.slice((safeCurrentPage - 1) * LEADS_PAGE_SIZE, safeCurrentPage * LEADS_PAGE_SIZE);

  const handleSort = (key: LeadSortKey) => {
    if (sortKey === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection(key === "name" ? "asc" : "desc");
    }
  };

  const funnelTabs: Array<{ id: string; label: string }> = [
    { id: "all", label: t.common.all },
    { id: "baru", label: locale === "id" ? "Baru" : "New" },
    { id: "dihubungi", label: locale === "id" ? "Dihubungi" : "Contacted" },
    { id: "prospek", label: locale === "id" ? "Prospek" : "Prospect" },
    { id: "survei", label: locale === "id" ? "Survei" : "Survey" },
    { id: "closing", label: locale === "id" ? "Closing" : "Closed" },
    { id: "batal", label: locale === "id" ? "Batal" : "Lost" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t.leads.title}
            </h1>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Tahap 1 CRM
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {locale === "id"
              ? "Manajemen 7 kolom inti prospek sales properti secara manual & upload spreadsheet."
              : "Management of 7 core property sales prospect fields via manual entry and spreadsheet upload."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: Add Lead Manually */}
          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>{locale === "id" ? "+ Tambah Prospek Manual" : "+ Add Lead"}</span>
          </button>

          {/* Action 2: Upload CRM Leads Spreadsheet */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{locale === "id" ? "Unggah (.xlsx/.csv)" : "Upload (.xlsx/.csv)"}</span>
          </button>

          {/* Action 3: Quick Download Template */}
          <a
            href="/api/leads/template?format=xlsx"
            download="template_crm_leads_hdcreative.xlsx"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title={locale === "id" ? "Unduh template Excel resmi" : "Download official Excel template"}
          >
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">{locale === "id" ? "Template" : "Template"}</span>
          </a>

          <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 hidden sm:block mx-1" />

          {/* Period Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hidden sm:inline">
              {t.common.period}:
            </span>
            <DateRangeFilter currentRange={dateRange} onChange={(value) => { setCurrentPage(1); setDateRange(value); }} />
          </div>
        </div>
      </div>

      {/* Tahap 1 Architecture Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs text-sky-800 dark:text-sky-300">
        <div className="flex items-start sm:items-center gap-2.5">
          <span className="shrink-0 font-bold text-sky-600 dark:text-sky-400 text-sm">💡</span>
          <div>
            <span className="font-bold">
              {locale === "id" ? "Rancangan CRM HD Creative — Tahap 1 (Sekarang):" : "HD Creative CRM Architecture — Phase 1 (Current):"}
            </span>{" "}
            <span>
              {locale === "id"
                ? "Catat prospek secara manual atau unggah spreadsheet CRM. Analisis hanya memakai informasi yang benar-benar tersedia pada data yang Anda masukkan."
                : "Add prospects manually or upload a CRM spreadsheet. Analysis uses only information present in the data you provide."}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="font-bold underline hover:text-sky-900 dark:hover:text-sky-200 cursor-pointer"
          >
            {locale === "id" ? "+ Input Prospek" : "+ Add Lead"}
          </button>
          <span className="text-sky-400">•</span>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="font-bold underline hover:text-sky-900 dark:hover:text-sky-200 cursor-pointer"
          >
            {locale === "id" ? "Unggah File" : "Upload File"}
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="shrink-0 rounded-lg border border-rose-300 px-3 py-1.5 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40">
            {locale === "id" ? "Coba Lagi" : "Retry"}
          </button>
        </div>
      )}

      {/* CRM x Ads summary for the selected date range */}
      <section aria-label={locale === "id" ? "Ringkasan CRM" : "CRM Summary"} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title={locale === "id" ? "Total Prospek Masuk" : "Total Leads"} value={summary?.total ?? 0} detail={`${summary?.newLeads ?? 0} ${locale === "id" ? "baru · belum disentuh" : "new · untouched"}`} />
        <SummaryCard title={locale === "id" ? "Prospek Berkualitas" : "Qualified Leads"} value={summary?.hotWarm ?? 0} detail={`${(summary?.hotWarmRate ?? 0).toFixed(1)}% ${locale === "id" ? "Hot + Warm" : "Hot + Warm"}`} />
        <SummaryCard title={locale === "id" ? "Progres Survei & Closing" : "Survey & Closing"} value={summary?.surveyOrClosing ?? 0} detail={`${(summary?.leadToSurveyRate ?? 0).toFixed(1)}% ${locale === "id" ? "lead-to-survey rate" : "lead-to-survey rate"}`} />
        <SummaryCard title={locale === "id" ? "Keterhubungan Data Iklan" : "Ad Data Linkage"} value={`${(summary?.adLinkRate ?? 0).toFixed(1)}%`} detail={summary?.unlinkedSources ? `${summary.unlinkedSources} ${locale === "id" ? "prospek tanpa sumber iklan" : "leads without an ad source"}` : (locale === "id" ? "Semua prospek memiliki sumber" : "All leads have a source")} warning={Boolean(summary?.unlinkedSources)} />
      </section>

      {/* Funnel Stage Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex space-x-1.5 overflow-x-auto pb-2 scrollbar-none" aria-label="Funnel Tabs">
          {funnelTabs.map((tab) => {
            const isActive = funnelStage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setCurrentPage(1); setFunnelStage(tab.id); }}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <label htmlFor="search-leads" className="sr-only">
            {t.common.search}
          </label>
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="search-leads"
              type="text"
              placeholder={locale === "id" ? "Cari nama, WA, domisili, catatan, atau iklan..." : "Search name, phone, city, notes, or ad..."}
              value={search}
              onChange={(e) => { setCurrentPage(1); setSearch(e.target.value); }}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 py-1.5 pl-8 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setCurrentPage(1); setSearch(""); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quality Label Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="filter-quality" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Kualitas:" : "Quality:"}
            </label>
            <select
              id="filter-quality"
              value={qualityFilter}
              onChange={(e) => { setCurrentPage(1); setQualityFilter(e.target.value); }}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
            >
              <option value="all">{locale === "id" ? "Semua Kualitas" : "All Qualities"}</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">☀️ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>
          </div>

          {/* Attribution Status Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="filter-attribution" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t.leads.attributionFilter}:
            </label>
            <select
              id="filter-attribution"
              value={attributionStatus}
              onChange={(e) => { setCurrentPage(1); setAttributionStatus(e.target.value); }}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
            >
              <option value="all">{t.leads.allAttribution}</option>
              <option value="verified">Verified ({locale === "id" ? "Terverifikasi" : "Verified"})</option>
              <option value="inferred">Inferred ({locale === "id" ? "Inferensi" : "Inferred"})</option>
              <option value="unknown">Unknown ({locale === "id" ? "Tidak Diketahui" : "Unknown"})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      {isLoading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>{locale === "id" ? "Memuat data prospek..." : "Loading prospects data..."}</span>
          </div>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          title={t.leads.emptyTitle}
          description={t.leads.emptyDesc}
          onReset={() => {
            setCurrentPage(1);
            setFunnelStage("all");
            setQualityFilter("all");
            setAttributionStatus("all");
            setSearch("");
            setDateRange("all");
          }}
        />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-500 dark:bg-zinc-900/60 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="py-3 px-4 font-semibold"><button type="button" onClick={() => handleSort("name")} className="text-left hover:text-zinc-900 dark:hover:text-white">{t.leads.table.prospect} {sortKey === "name" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</button></th>
                  <th className="py-3 px-3 font-semibold">{t.leads.table.domisili}</th>
                  <th className="py-3 px-3 font-semibold"><button type="button" onClick={() => handleSort("lastMessageAt")} className="text-left hover:text-zinc-900 dark:hover:text-white">{t.leads.table.entryDate} {sortKey === "lastMessageAt" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</button></th>
                  <th className="py-3 px-3 font-semibold">{t.leads.table.linkedAd}</th>
                  <th className="py-3 px-3 font-semibold"><button type="button" onClick={() => handleSort("funnelStage")} className="text-left hover:text-zinc-900 dark:hover:text-white">{t.leads.table.funnelStage} {sortKey === "funnelStage" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</button></th>
                  <th className="py-3 px-3 font-semibold"><button type="button" onClick={() => handleSort("qualityLabel")} className="text-left hover:text-zinc-900 dark:hover:text-white">{t.leads.table.qualityLabel} {sortKey === "qualityLabel" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</button></th>
                  <th className="py-3 px-3 font-semibold">{t.leads.table.notes}</th>
                  <th className="py-3 px-4 font-semibold text-right">{t.leads.table.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {paginatedLeads.map((lead) => {
                  const entryDateFormatted = lead.lastMessageAt
                    ? new Date(lead.lastMessageAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={lead.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      {/* 1. Nama & WhatsApp */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {lead.name}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-400 mt-0.5">
                          {lead.phoneMasked}
                        </div>
                      </td>

                      {/* 2. Domisili */}
                      <td className="py-3 px-3">
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                          {lead.domisili || <span className="text-zinc-400 italic">—</span>}
                        </span>
                      </td>

                      {/* 3. Tanggal Masuk */}
                      <td className="py-3 px-3 whitespace-nowrap text-zinc-500 font-mono text-[11px]">
                        {entryDateFormatted}
                      </td>

                      {/* 4. Kampanye / Iklan */}
                      <td className="py-3 px-3">
                        {lead.adName ? (
                          <div className="max-w-[200px] truncate" title={lead.adName}>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {lead.adName}
                            </span>
                          </div>
                        ) : lead.campaignName ? (
                          <div className="max-w-[200px] truncate" title={lead.campaignName}>
                            <span className="text-zinc-600 dark:text-zinc-300">
                              {lead.campaignName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">{t.leads.table.noAdLinked}</span>
                        )}
                      </td>

                      {/* 5. Tahap Funnel */}
                      <td className="py-3 px-3">
                        <select value={lead.funnelStage} disabled={savingLeadIds.has(lead.id)} aria-label={`${locale === "id" ? "Ubah tahap funnel" : "Update funnel stage"}: ${lead.name}`} onChange={(event) => {
                          const nextStage = event.target.value as FunnelStage;
                          if (!getAllowedFunnelTransitions(lead.funnelStage).includes(nextStage)) return;
                          const defaultReason = "Pembaruan cepat dari tabel CRM";
                          const reason = ["survei", "closing", "batal"].includes(nextStage)
                            ? window.prompt(locale === "id" ? "Alasan/bukti perubahan tahap:" : "Reason/evidence for stage change:", defaultReason)
                            : defaultReason;
                          if (reason === null) return;
                          void updateLead(lead.id, { newStage: nextStage, funnelStage: nextStage, reason });
                        }} className="max-w-[145px] rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 disabled:opacity-50">
                          <option value={lead.funnelStage}>{lead.funnelStage}</option>
                          {getAllowedFunnelTransitions(lead.funnelStage).map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                        </select>
                      </td>

                      {/* 6. Label Kualitas (Hot / Warm / Cold) */}
                      <td className="py-3 px-3">
                        <select value={lead.qualityLabel || ""} disabled={savingLeadIds.has(lead.id)} aria-label={`${locale === "id" ? "Ubah kualitas" : "Update quality"}: ${lead.name}`} onChange={(event) => void updateLead(lead.id, { qualityLabel: event.target.value || null })} className={`max-w-[115px] rounded-md border px-2 py-1 text-[11px] font-bold disabled:opacity-50 ${lead.qualityLabel === "Hot" ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400" : lead.qualityLabel === "Warm" ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400" : lead.qualityLabel === "Cold" ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400" : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"}`}>
                          <option value="">{locale === "id" ? "Belum Dinilai" : "Not Assessed"}</option><option value="Hot">🔥 Hot</option><option value="Warm">☀️ Warm</option><option value="Cold">❄️ Cold</option>
                        </select>
                      </td>

                      {/* 7. Catatan Singkat */}
                      <td className="py-3 px-3">
                        {lead.notes ? (
                          <div className="max-w-[220px] truncate text-zinc-600 dark:text-zinc-400 text-[11px]" title={lead.notes}>
                            {lead.notes}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* 8. Aksi */}
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-zinc-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-indigo-400 dark:hover:bg-zinc-700 transition-colors"
                        >
                          {t.common.viewDetails}
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs dark:border-zinc-800">
              <span className="text-zinc-500">{(safeCurrentPage - 1) * LEADS_PAGE_SIZE + 1}–{Math.min(safeCurrentPage * LEADS_PAGE_SIZE, sortedLeads.length)} / {sortedLeads.length}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={safeCurrentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded-md border border-zinc-200 px-2.5 py-1 text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300">{locale === "id" ? "Sebelumnya" : "Previous"}</button>
                <span className="tabular-nums text-zinc-500">{safeCurrentPage} / {totalPages}</span>
                <button type="button" disabled={safeCurrentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded-md border border-zinc-200 px-2.5 py-1 text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300">{locale === "id" ? "Berikutnya" : "Next"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Lead Modal */}
      <CRMManualLeadModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1);
        }}
      />

      {/* CRM Leads Upload & Sync Modal */}
      <CRMLeadsUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}

