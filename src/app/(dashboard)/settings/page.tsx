"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MetaAssetOnboarding } from "@/components/meta/MetaAssetOnboarding";
import { WhatsAppCoexistenceConnect } from "@/components/whatsapp/WhatsAppCoexistenceConnect";
import { CRMLeadsUploadModal } from "@/components/crm/CRMLeadsUploadModal";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { IntegrationStatusItem } from "@/app/api/integrations/status/route";

export default function SettingsPage() {
  const { t, formatDateTime, locale } = useI18n();
  const { addToast } = useToast();
  const [integrations, setIntegrations] = useState<IntegrationStatusItem[]>([]);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string>("Workspace");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const refreshIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIntegrations(data.integrations || []);
          if (data.organizationId) {
            setOrganizationId(data.organizationId);
          }
          if (data.organizationName) {
            setOrganizationName(data.organizationName);
          }
        }
      }
    } catch {
      // Non-blocking error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch("/api/integrations/status");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setIntegrations(data.integrations || []);
            if (data.organizationId) {
              setOrganizationId(data.organizationId);
            }
            if (data.organizationName) {
              setOrganizationName(data.organizationName);
            }
          }
        }
      } catch {
        // Non-blocking error
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowDemoFallback: false }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        const count = data.syncResult?.recordsProcessed ?? 0;
        addToast(
          "success",
          locale === "id" ? "Sinkronisasi Berhasil" : "Sync Successful",
          locale === "id"
            ? `Meta Marketing API sinkron: ${count} record berhasil diproses dan disimpan ke database.`
            : `Meta Marketing API synced: ${count} records processed and saved to database.`
        );
        refreshIntegrations();
      } else {
        addToast(
          "error",
          locale === "id" ? "Sinkronisasi Gagal" : "Sync Failed",
          data.message || (locale === "id" ? "Gagal melakukan sinkronisasi Meta Marketing API." : "Failed to sync Meta Marketing API.")
        );
      }
    } catch (err) {
      addToast(
        "error",
        locale === "id" ? "Kesalahan Jaringan" : "Network Error",
        err instanceof Error ? err.message : (locale === "id" ? "Gagal terhubung ke API sinkronisasi." : "Failed to reach sync API.")
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t.settings.title}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Mode Data & Tenant Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t.settings.workspaceCardTitle}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {locale === "id" ? "Identifikasi tenant dan ruang kerja aktif terisolasi." : "Tenant identification and isolated workspace boundary."}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t.common.active}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-zinc-400 block text-[11px] font-medium">
              {locale === "id" ? "Organisasi Aktif (Tenant):" : "Active Organization (Tenant):"}
            </span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm block mt-0.5">
              {organizationName}
            </span>
            <span className="block text-[10px] text-zinc-400 font-mono mt-1">
              ID: {organizationId || "Memuat..."}
            </span>
          </div>

          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-zinc-400 block text-[11px] font-medium">
              {locale === "id" ? "Mode Operasi Data:" : "Data Operation Mode:"}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                Mode Produksi Riil
              </span>
              <span className="text-[11px] text-zinc-400">
                ({locale === "id" ? "Konektor live external API & database PostgreSQL" : "Live external API connectors & PostgreSQL DB"})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Meta Facebook Page, Instagram & Ad Account Onboarding Card */}
      <MetaAssetOnboarding />

      {/* WhatsApp Business App Coexistence Connect Card */}
      <WhatsAppCoexistenceConnect />

      {/* Integration Providers Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t.settings.providersTableTitle}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t.settings.providersTableSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className={`h-3.5 w-3.5 text-zinc-500 ${isSyncing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing
              ? (locale === "id" ? "Menyinkronkan..." : "Syncing...")
              : (locale === "id" ? "Sinkronkan Sekarang" : "Sync Now")}
          </button>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              {locale === "id" ? "Memeriksa status konektor integrasi..." : "Checking integration connector statuses..."}
            </div>
          ) : integrations.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              {locale === "id" ? "Tidak ada penyedia integrasi yang terdaftar." : "No integration providers registered."}
            </div>
          ) : (
            integrations.map((item) => (
              <div key={item.provider} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                      {item.name}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                        item.status === "connected"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                          : item.status === "error"
                          ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {item.status === "connected"
                        ? (locale === "id" ? "Terhubung" : "Connected")
                        : item.status === "error"
                        ? (locale === "id" ? "Gagal / Error" : "Error")
                        : (locale === "id" ? "Belum Terhubung" : "Disconnected")}
                    </span>
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400">{item.details}</p>
                  {item.error && (
                    <p className="text-rose-600 dark:text-rose-400 text-[11px] font-mono">
                      Error: {item.error}
                    </p>
                  )}
                  {item.maskedCredential && (
                    <p className="font-mono text-[11px] text-zinc-400">
                      {locale === "id" ? "Identitas Akun:" : "Account Identity:"}{" "}
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono border border-zinc-200 dark:border-zinc-700">
                        {item.maskedCredential}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                  {item.provider === "crm_sheets" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>{locale === "id" ? "Unggah Prospek" : "Upload Leads"}</span>
                      </button>

                      <a
                        href="/api/leads/template?format=xlsx"
                        download="template_crm_leads_hdcreative.xlsx"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{locale === "id" ? "Template .xlsx" : "Template .xlsx"}</span>
                      </a>
                    </div>
                  )}

                  <div className="text-right text-[11px] text-zinc-400 shrink-0">
                    <span>{locale === "id" ? "Sinkronisasi Terakhir:" : "Last Synced:"}</span>
                    <span className="block font-mono text-zinc-700 dark:text-zinc-300 mt-0.5">
                      {item.lastSyncedAt ? formatDateTime(item.lastSyncedAt) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CRM Leads Upload Modal */}
      <CRMLeadsUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          refreshIntegrations();
        }}
      />

      {/* Security & Architecture Guarantees */}
      <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 space-y-2.5">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
          <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {t.settings.securityGuaranteesTitle}
        </h3>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong>Server-Only Protection:</strong> Service-role Supabase key dan token rahasia Meta dilindungi oleh modul <code>import &quot;server-only&quot;</code> dan tidak pernah dibocorkan ke client browser.
          </li>
          <li>
            <strong>Row Level Security (RLS):</strong> Akses database diisolasi otomatis berdasarkan klausa <code>organization_id = current_user_org_id()</code>.
          </li>
          <li>
            <strong>Fail-Closed Principle:</strong> Jika autentikasi atau bukti rujukan tidak sah, sistem mengembalikan status <em>Unknown</em> dan tidak membuat atribusi fiktif.
          </li>
        </ul>
      </div>
    </div>
  );
}

