"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { CRMLeadsUploadModal } from "@/components/crm/CRMLeadsUploadModal";
import { CRMManualLeadModal } from "@/components/crm/CRMManualLeadModal";
import { CRMLeadFab } from "@/components/crm/CRMLeadFab";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { LeadListItem } from "@/lib/data/types";
import type { FunnelStage } from "@/domain/funnel/stages";
import { getAllowedFunnelTransitions } from "@/domain/funnel/stages";
import { useToast } from "@/components/ui/Toast";

interface LeadsSummary {
  total: number;
  newLeads: number;
  hotWarm: number;
  hot?: number;
  warm?: number;
  cold?: number;
  qualifiedLeads?: number;
  hotWarmRate: number;
  surveyOrClosing: number;
  leadToSurveyRate: number;
  linkedSources: number;
  unlinkedSources: number;
  adLinkRate: number;
}

type LeadSortKey = "lastMessageAt" | "name" | "funnelStage" | "qualityLabel";
const LEADS_PAGE_SIZE = 20;

function KPICard({
  title,
  value,
  detail,
  icon,
  badge,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  badge?: { text: string; color: string };
}) {
  return (
    <div className="surface-card flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-4.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {icon}
        </div>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-zinc-50">
          {value}
        </span>
        {badge && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={detail}>
        {detail}
      </div>
    </div>
  );
}

function getFunnelStageClasses(stage: string) {
  switch (stage.toLowerCase()) {
    case "baru":
      return "bg-sky-50 text-sky-700 border-sky-200/90 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/70";
    case "dihubungi":
      return "bg-indigo-50 text-indigo-700 border-indigo-200/90 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/70";
    case "prospek":
      return "bg-amber-50 text-amber-700 border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/70";
    case "survei":
      return "bg-purple-50 text-purple-700 border-purple-200/90 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/70";
    case "closing":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/70";
    case "batal":
      return "bg-zinc-100 text-zinc-600 border-zinc-200/90 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700/70";
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
  }
}

function getQualityClasses(quality: string | null | undefined) {
  switch (quality) {
    case "Hot":
      return "border-rose-500/20 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300";
    case "Warm":
      return "border-amber-500/20 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300";
    case "Cold":
      return "border-sky-500/20 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300";
    default:
      return "border-zinc-200/90 bg-zinc-50/80 text-zinc-500 dark:border-zinc-700/80 dark:bg-zinc-800/60 dark:text-zinc-400";
  }
}

export default function LeadsDirectoryPage() {
  const { t, locale } = useI18n();
  const stageLabel = (stage: string) => t.funnel[stage as keyof typeof t.funnel] || stage;
  const { addToast } = useToast();

  // Filters & State
  const [dateRange, setDateRange] = useState("all");
  const [funnelStage, setFunnelStage] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [attributionStatus, setAttributionStatus] = useState<string>("all");
  const [adSourceFilter, setAdSourceFilter] = useState<string>("all");
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

  // Interactive Stage Transition Modal State (Native Dialog)
  const [stageModalLead, setStageModalLead] = useState<LeadListItem | null>(null);
  const [targetStage, setTargetStage] = useState<FunnelStage | null>(null);
  const [stageReason, setStageReason] = useState("");
  const [isSavingStage, setIsSavingStage] = useState(false);

  // Load leads from server
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
        throw new Error(json.error || (locale === "id" ? "Gagal memuat daftar prospek CRM." : "Failed to load CRM leads."));
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

  // Update funnel stage or quality
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
      if (!res.ok || !json.success) throw new Error(json.error || (locale === "id" ? "Gagal memperbarui prospek." : "Failed to update lead."));
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

  // Open interactive stage transition modal
  const handleOpenStageModal = (lead: LeadListItem) => {
    setStageModalLead(lead);
    const allowed = getAllowedFunnelTransitions(lead.funnelStage);
    setTargetStage(allowed[0] || lead.funnelStage);
    setStageReason("");
  };

  // Confirm stage transition from modal
  const handleConfirmStageTransition = async () => {
    if (!stageModalLead || !targetStage) return;
    setIsSavingStage(true);
    try {
      const defaultReason = locale === "id" ? "Pembaruan cepat status pipeline CRM" : "Quick CRM pipeline update";
      const reason = stageReason.trim() || defaultReason;
      await updateLead(stageModalLead.id, {
        newStage: targetStage,
        funnelStage: targetStage,
        reason,
      });
      setStageModalLead(null);
    } finally {
      setIsSavingStage(false);
    }
  };

  // Distinct sources for ad source filter dropdown
  const distinctSources = useMemo(() => {
    const sources = new Set<string>();
    leads.forEach((l) => {
      if (l.adName) sources.add(l.adName);
      else if (l.campaignName) sources.add(l.campaignName);
    });
    return Array.from(sources);
  }, [leads]);

  // Filter by ad source if selected on client
  const sourceFilteredLeads = useMemo(() => {
    if (adSourceFilter === "all") return leads;
    return leads.filter((l) => l.adName === adSourceFilter || l.campaignName === adSourceFilter);
  }, [leads, adSourceFilter]);

  // Sort leads
  const sortedLeads = useMemo(() => {
    const stageOrder: FunnelStage[] = ["baru", "dihubungi", "prospek", "survei", "closing", "batal"];
    const qualityOrder: Record<string, number> = { Hot: 0, Warm: 1, Cold: 2, "": 3 };
    return [...sourceFilteredLeads].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name, locale);
      else if (sortKey === "funnelStage") comparison = stageOrder.indexOf(a.funnelStage) - stageOrder.indexOf(b.funnelStage);
      else if (sortKey === "qualityLabel") comparison = (qualityOrder[a.qualityLabel || ""] ?? 3) - (qualityOrder[b.qualityLabel || ""] ?? 3);
      else comparison = new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [sourceFilteredLeads, sortKey, sortDirection, locale]);

  // Pagination calculations
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

  // Funnel stage counts for interactive tab chips
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: leads.length,
      baru: 0,
      dihubungi: 0,
      prospek: 0,
      survei: 0,
      closing: 0,
      batal: 0,
    };
    leads.forEach((l) => {
      if (counts[l.funnelStage] !== undefined) {
        counts[l.funnelStage]++;
      }
    });
    return counts;
  }, [leads]);

  const funnelTabs: Array<{ id: string; label: string }> = [
    { id: "all", label: locale === "id" ? "Semua" : "All" },
    { id: "baru", label: locale === "id" ? "Baru" : "New" },
    { id: "dihubungi", label: locale === "id" ? "Dihubungi" : "Contacted" },
    { id: "prospek", label: locale === "id" ? "Prospek" : "Prospect" },
    { id: "survei", label: locale === "id" ? "Survei" : "Survey" },
    { id: "closing", label: locale === "id" ? "Closing" : "Closed" },
    { id: "batal", label: locale === "id" ? "Batal" : "Lost" },
  ];

  // Derived follow-up pending count
  const followUpPendingCount = useMemo(() => {
    return leads.filter((l) => l.funnelStage === "baru" || l.funnelStage === "dihubungi").length;
  }, [leads]);

  const isAnyFilterActive =
    funnelStage !== "all" ||
    qualityFilter !== "all" ||
    attributionStatus !== "all" ||
    adSourceFilter !== "all" ||
    search.trim().length > 0 ||
    dateRange !== "all";

  const handleResetFilters = () => {
    setCurrentPage(1);
    setFunnelStage("all");
    setQualityFilter("all");
    setAttributionStatus("all");
    setAdSourceFilter("all");
    setSearch("");
    setDateRange("all");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-32 sm:pb-36">
      {/* 1. Page Header & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
            <Link href="/dashboard" className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-semibold">CRM &amp; Pipeline</span>
          </nav>

          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t.leads.title}
            </h1>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[10.5px] font-semibold text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-750">
              Lead Intelligence
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            {t.leads.subtitle}
          </p>
        </div>

        {/* Right Header Toolbar: Period Filter & Refresh */}
        <div className="flex items-center gap-2">
          <DateRangeFilter
            currentRange={dateRange}
            onChange={(value) => {
              setCurrentPage(1);
              setDateRange(value);
            }}
          />

          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            aria-label="Refresh leads"
            title={locale === "id" ? "Segarkan data" : "Refresh data"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-2xs hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 cursor-pointer transition-colors"
          >
            <svg
              className={`h-4 w-4 ${isLoading ? "animate-spin text-amber-600" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="shrink-0 rounded-lg border border-rose-300 px-3 py-1.5 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40 cursor-pointer">
            {locale === "id" ? "Coba Lagi" : "Retry"}
          </button>
        </div>
      )}

      {/* 2. Compact Modern 4-KPI Grid (Adaptive 2x2 Mobile, 4-in-a-row Desktop) */}
      <section aria-label="CRM Metrics Summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Leads */}
        <KPICard
          title={t.leads.kpi.totalLeads}
          value={summary?.total ?? leads.length}
          detail={t.leads.kpi.totalLeadsDesc}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        />

        {/* KPI 2: New Leads */}
        <KPICard
          title={t.leads.kpi.newLeads}
          value={summary?.newLeads ?? 0}
          detail={t.leads.kpi.newLeadsDesc}
          badge={{
            text: locale === "id" ? "Baru" : "New",
            color: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20",
          }}
          icon={
            <svg className="h-4 w-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.765z" />
            </svg>
          }
        />

        {/* KPI 3: Qualified Leads */}
        <KPICard
          title={t.leads.kpi.qualifiedLeads}
          value={summary?.qualifiedLeads ?? ((summary?.hot ?? 0) + (summary?.warm ?? 0))}
          detail={`${summary?.hot ?? 0} hot · ${summary?.warm ?? 0} warm · ${summary?.cold ?? 0} cold. ${t.leads.kpi.qualifiedLeadsDesc}`}
          icon={
            <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          }
        />

        {/* KPI 4: Survey & Closing (with active follow-up count) */}
        <KPICard
          title={t.leads.kpi.surveyClosing}
          value={summary?.surveyOrClosing ?? 0}
          detail={`${followUpPendingCount} ${t.leads.kpi.followUpPending}`}
          icon={
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </section>

      {/* 3. Funnel Stage Tabs (Smooth Horizontal Scroll, Clean Live Count) */}
      <div className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs overflow-x-auto scrollbar-none">
        <nav className="flex items-center gap-1.5 min-w-max" aria-label="Pipeline Stages">
          {funnelTabs.map((tab) => {
            const isActive = funnelStage === tab.id;
            const count = stageCounts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  setFunnelStage(tab.id);
                }}
                className={`inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md font-mono text-[10.5px] ${
                    isActive
                      ? "bg-white/20 text-white dark:bg-black/15 dark:text-zinc-950"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 4. Search & Compact Filters Toolbar (High-Contrast & Responsive) */}
      <div className="surface-card flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs transition-colors">
        {/* Search input */}
        <div className="flex-1 max-w-md relative">
          <label htmlFor="search-leads" className="sr-only">
            {t.common.search}
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            id="search-leads"
            type="text"
            placeholder={locale === "id" ? "Cari nama, WhatsApp, kota, catatan, atau iklan..." : "Search name, WhatsApp, city, notes, or ad..."}
            value={search}
            onChange={(e) => {
              setCurrentPage(1);
              setSearch(e.target.value);
            }}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/15 dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                setSearch("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer p-1"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quality Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-quality" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Kualitas:" : "Quality:"}
            </label>
            <select
              id="filter-quality"
              value={qualityFilter}
              onChange={(e) => {
                setCurrentPage(1);
                setQualityFilter(e.target.value);
              }}
              className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-200 cursor-pointer shadow-2xs"
            >
              <option value="all">{locale === "id" ? "Semua Kualitas" : "All Qualities"}</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
          </div>

          {/* Attribution Status Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-attribution" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {locale === "id" ? "Atribusi:" : "Attribution:"}
            </label>
            <select
              id="filter-attribution"
              value={attributionStatus}
              onChange={(e) => {
                setCurrentPage(1);
                setAttributionStatus(e.target.value);
              }}
              className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-200 cursor-pointer shadow-2xs"
            >
              <option value="all">{locale === "id" ? "Semua Atribusi" : "All Status"}</option>
              <option value="verified">{t.attribution.verified}</option>
              <option value="inferred">{t.attribution.inferred}</option>
              <option value="unknown">{t.attribution.unknown}</option>
            </select>
          </div>

          {/* Ad Source Filter */}
          {distinctSources.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="filter-source" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Iklan:" : "Ad:"}
              </label>
              <select
                id="filter-source"
                value={adSourceFilter}
                onChange={(e) => {
                  setCurrentPage(1);
                  setAdSourceFilter(e.target.value);
                }}
                className="max-w-[170px] truncate rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-200 cursor-pointer shadow-2xs"
              >
                <option value="all">{locale === "id" ? "Semua Sumber" : "All Sources"}</option>
                {distinctSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters Shortcut */}
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
            >
              {locale === "id" ? "Reset Filter" : "Reset"}
            </button>
          )}
        </div>
      </div>

      {/* 5. Main Leads Table (Desktop) & Cards (Mobile) */}
      {isLoading ? (
        <div className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
          <div className="inline-flex items-center gap-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <svg className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>{locale === "id" ? "Memuat data CRM..." : "Loading CRM data..."}</span>
          </div>
        </div>
      ) : sortedLeads.length === 0 ? (
        <EmptyState
          title={t.leads.emptyTitle}
          description={t.leads.emptyDesc}
          onReset={handleResetFilters}
        />
      ) : (
        <div className="surface-card overflow-hidden rounded-2xl border border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs transition-colors">
          {/* A. DESKTOP / TABLET TABLE VIEW (Hidden on Mobile) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[960px]">
              <thead className="bg-zinc-50/90 border-b border-zinc-200/80 text-zinc-600 dark:bg-zinc-900/80 dark:border-zinc-800 dark:text-zinc-400 uppercase text-[10.5px] font-semibold tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">
                    <button type="button" onClick={() => handleSort("name")} className="inline-flex items-center gap-1 text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer">
                      <span>{t.leads.table.prospect}</span>
                      <span className="text-zinc-400">{sortKey === "name" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                  <th className="py-3 px-3 font-semibold">{t.leads.table.domisili}</th>
                  <th className="py-3 px-3 font-semibold">
                    <button type="button" onClick={() => handleSort("lastMessageAt")} className="inline-flex items-center gap-1 text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer">
                      <span>{t.leads.table.entryDate}</span>
                      <span className="text-zinc-400">{sortKey === "lastMessageAt" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                  <th className="py-3 px-3 font-semibold">{t.leads.table.linkedAd}</th>
                  <th className="py-3 px-3 font-semibold">
                    <button type="button" onClick={() => handleSort("funnelStage")} className="inline-flex items-center gap-1 text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer">
                      <span>{t.leads.table.funnelStage}</span>
                      <span className="text-zinc-400">{sortKey === "funnelStage" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                  <th className="py-3 px-3 font-semibold">
                    <button type="button" onClick={() => handleSort("qualityLabel")} className="inline-flex items-center gap-1 text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer">
                      <span>{locale === "id" ? "Kualitas" : "Quality"}</span>
                      <span className="text-zinc-400">{sortKey === "qualityLabel" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
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

                  const isSaving = savingLeadIds.has(lead.id);

                  return (
                    <tr key={lead.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      {/* 1. Nama & WhatsApp */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[170px]" title={lead.name}>
                          {lead.name}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                          {lead.phoneMasked}
                        </div>
                      </td>

                      {/* 2. Domisili */}
                      <td className="py-3.5 px-3">
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium block truncate max-w-[120px]" title={lead.domisili || ""}>
                          {lead.domisili || <span className="text-zinc-400 italic">—</span>}
                        </span>
                      </td>

                      {/* 3. Tanggal Masuk */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400 font-mono text-[11px] tabular-nums">
                        {entryDateFormatted}
                      </td>

                      {/* 4. Kampanye / Iklan & Status Atribusi */}
                      <td className="py-3.5 px-3">
                        {lead.adName ? (
                          <div className="max-w-[180px]" title={lead.adName}>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200 block truncate">
                              {lead.adName}
                            </span>
                            <span className={`inline-block mt-0.5 text-[9.5px] font-semibold px-1.5 py-0.2 rounded border ${
                              lead.attributionStatus === "verified"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/70"
                                : lead.attributionStatus === "inferred"
                                ? "bg-sky-50 text-sky-700 border-sky-200/90 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/70"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700"
                            }`}>
                              {lead.attributionStatus === "verified"
                                ? (locale === "id" ? "Terverifikasi" : "Verified")
                                : lead.attributionStatus === "inferred"
                                ? (locale === "id" ? "Inferensi" : "Inferred")
                                : (locale === "id" ? "Organik" : "Organic")}
                            </span>
                          </div>
                        ) : lead.campaignName ? (
                          <div className="max-w-[180px]" title={lead.campaignName}>
                            <span className="text-zinc-700 dark:text-zinc-300 block truncate">
                              {lead.campaignName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">{t.leads.table.noAdLinked}</span>
                        )}
                      </td>

                      {/* 5. Tahap Funnel (Interactive Stage Button, Opens Modal with Zero Truncation) */}
                      <td className="py-3.5 px-3">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenStageModal(lead)}
                            disabled={isSaving}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all hover:opacity-90 cursor-pointer disabled:opacity-50 ${getFunnelStageClasses(lead.funnelStage)}`}
                            title={locale === "id" ? "Klik untuk ubah tahap funnel" : "Click to change funnel stage"}
                          >
                            <span>{stageLabel(lead.funnelStage)}</span>
                            <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isSaving && (
                            <svg className="h-3.5 w-3.5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          )}
                        </div>
                      </td>

                      {/* Kualitas */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={lead.qualityLabel || ""}
                            disabled={isSaving}
                            aria-label={`${locale === "id" ? "Ubah kualitas" : "Update quality"}: ${lead.name}`}
                            onChange={(event) => void updateLead(lead.id, { qualityLabel: event.target.value || null })}
                            className={`max-w-[115px] rounded-lg border px-2 py-0.5 text-[10.5px] font-bold transition-all cursor-pointer disabled:opacity-50 ${getQualityClasses(lead.qualityLabel)}`}
                          >
                            <option value="">{t.leads.scoringTooltip.notAssessed}</option>
                            <option value="Hot">Hot</option>
                            <option value="Warm">Warm</option>
                            <option value="Cold">Cold</option>
                          </select>

                        </div>
                      </td>

                      {/* 7. Catatan Singkat */}
                      <td className="py-3.5 px-3">
                        {lead.notes ? (
                          <div className="max-w-[190px] truncate text-zinc-600 dark:text-zinc-400 text-[11px]" title={lead.notes}>
                            {lead.notes}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* 8. Aksi (WhatsApp + Detail Link) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {lead.phoneMasked && (
                            <a
                              href={`https://wa.me/${lead.phoneMasked.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40 transition-colors"
                              title={locale === "id" ? "Buka Chat WhatsApp" : "Open WhatsApp Chat"}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.842-.981z" />
                              </svg>
                            </a>
                          )}
                          <Link
                            href={`/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-750 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
                          >
                            <span>{t.common.viewDetails}</span>
                            <svg className="h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* B. MOBILE CARD LIST VIEW (Hidden on Tablet / Desktop) */}
          <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800 p-2.5 space-y-3">
            {paginatedLeads.map((lead) => {
              const entryDateFormatted = lead.lastMessageAt
                ? new Date(lead.lastMessageAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—";

              const isSaving = savingLeadIds.has(lead.id);
              return (
                <div key={lead.id} className="rounded-xl border border-zinc-200/90 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs space-y-3">
                  {/* Top Row: Name, Phone, Entry Date */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm block">
                        {lead.name}
                      </span>
                      <span className="font-mono text-xs text-zinc-500 mt-0.5 block">
                        {lead.phoneMasked} {lead.domisili ? `• ${lead.domisili}` : ""}
                      </span>
                    </div>

                    <span className="text-[10.5px] font-mono text-zinc-400 shrink-0">
                      {entryDateFormatted}
                    </span>
                  </div>

                  {/* Middle Row: Funnel Stage Button & Quality Select */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenStageModal(lead)}
                      disabled={isSaving}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${getFunnelStageClasses(lead.funnelStage)}`}
                    >
                      <span>{stageLabel(lead.funnelStage)}</span>
                      <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <select
                      value={lead.qualityLabel || ""}
                      disabled={isSaving}
                      onChange={(event) => void updateLead(lead.id, { qualityLabel: event.target.value || null })}
                      className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${getQualityClasses(lead.qualityLabel)}`}
                    >
                      <option value="">{t.leads.scoringTooltip.notAssessed}</option>
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                    </select>

                  </div>

                  {/* Ad Source & Notes */}
                  {(lead.adName || lead.campaignName || lead.notes) && (
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      {(lead.adName || lead.campaignName) && (
                        <p className="truncate">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{locale === "id" ? "Sumber" : "Source"}: </span>
                          {lead.adName || lead.campaignName}
                        </p>
                      )}
                      {lead.notes && (
                        <p className="truncate italic">
                          &ldquo;{lead.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons: WhatsApp & Detail Link */}
                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    {lead.phoneMasked && (
                      <a
                        href={`https://wa.me/${lead.phoneMasked.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.842-.981z" />
                        </svg>
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <Link
                      href={`/leads/${lead.id}`}
                      className="flex-1 text-center rounded-lg border border-zinc-200 bg-white py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {t.common.viewDetails}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 6. Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs dark:border-zinc-800">
              <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                {(safeCurrentPage - 1) * LEADS_PAGE_SIZE + 1}–{Math.min(safeCurrentPage * LEADS_PAGE_SIZE, sortedLeads.length)} / {sortedLeads.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 font-semibold text-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {locale === "id" ? "Sebelumnya" : "Previous"}
                </button>
                <span className="tabular-nums font-mono text-zinc-500 dark:text-zinc-400 text-[11px]">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 font-semibold text-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {locale === "id" ? "Berikutnya" : "Next"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Interactive Funnel Stage Transition Sheet / Modal (Native Dialog) */}
      {stageModalLead && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stage-transition-title"
        >
          {/* Backdrop dismissal */}
          <div className="fixed inset-0" onClick={() => setStageModalLead(null)} aria-hidden="true" />

          {/* Sheet / Modal Card */}
          <div className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 id="stage-transition-title" className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50">
                  {t.leads.stageModal.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {stageModalLead.name} • {stageModalLead.phoneMasked}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStageModalLead(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                aria-label={t.common.close}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current Stage */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t.leads.stageModal.currentStage}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${getFunnelStageClasses(stageModalLead.funnelStage)}`}>
                {stageLabel(stageModalLead.funnelStage)}
              </span>
            </div>

            {/* Allowed Target Stages */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                {t.leads.stageModal.selectNewStage}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {getAllowedFunnelTransitions(stageModalLead.funnelStage).map((stage) => {
                  const isSelected = targetStage === stage;
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setTargetStage(stage)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 shadow-xs"
                          : "border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      <span>{stageLabel(stage)}</span>
                      <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-amber-400 dark:bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reason / Evidence input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                {t.leads.stageModal.reasonLabel}
              </label>
              <textarea
                rows={2}
                value={stageReason}
                onChange={(e) => setStageReason(e.target.value)}
                placeholder={t.leads.stageModal.reasonPlaceholder}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setStageModalLead(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                {t.leads.stageModal.cancel}
              </button>
              <button
                type="button"
                disabled={!targetStage || isSavingStage}
                onClick={handleConfirmStageTransition}
                className="px-4 py-2 rounded-xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSavingStage ? t.leads.stageModal.saving : t.leads.stageModal.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Floating Action Button (FAB) for Lead Management */}
      <CRMLeadFab
        onOpenManual={() => setIsManualModalOpen(true)}
        onOpenUpload={() => setIsUploadModalOpen(true)}
      />

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
