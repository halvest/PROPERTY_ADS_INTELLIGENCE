"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface CampaignDetailData {
  id: string;
  providerCampaignId: string;
  name: string;
  status: string;
  objective: string | null;
  totalAdsCount: number;
  activeAdsCount: number;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number | null;
  results: number;
  costPerResult: number | null;
  linkClicks: number;
  linkCtr: number | null;
  linkCpc: number | null;
  allClicks: number;
  allCtr: number | null;
  allCpc: number | null;
  cpm: number | null;
}

export interface AdInCampaignItem {
  id: string;
  adName: string;
  providerAdId: string;
  deliveryStatus: string;
  deliveryLabel: string;
  adsetName: string;
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  linkCtr: number | null;
  linkCpc: number | null;
  results: number;
  costPerResult: number | null;
}

interface CampaignDetailWorkspaceProps {
  campaign: CampaignDetailData;
  ads: AdInCampaignItem[];
  dateRange: string;
  onClose: () => void;
}

export function CampaignDetailWorkspace({
  campaign,
  ads,
  dateRange,
  onClose,
}: CampaignDetailWorkspaceProps) {
  const { formatCurrency, formatNumber, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<"overview" | "ads" | "ai_workspace">("overview");

  const isCmpActive = campaign.status === "ACTIVE";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden transition-all">
      {/* Campaign Header Bar */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isCmpActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              }`}
            >
              ● {isCmpActive ? (locale === "en" ? "Active Campaign" : "Campaign Aktif") : (locale === "en" ? "Paused Campaign" : "Campaign Dijeda")}
            </span>
            <span className="text-[11px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              ID: {campaign.providerCampaignId}
            </span>
            {campaign.objective && (
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-900">
                Objective: {campaign.objective}
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1 truncate">
            {campaign.name}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {locale === "en" ? "In-depth campaign analysis • Period:" : "Analisis mendalam campaign • Periode:"}{" "}
            {dateRange.toUpperCase()} • {ads.length} {locale === "en" ? "connected ads" : "Iklan terhubung"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-xs dark:border-zinc-800 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                activeTab === "overview"
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50 font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
              }`}
            >
              {locale === "en" ? "Performance" : "Performa"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ads")}
              className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                activeTab === "ads"
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50 font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
              }`}
            >
              {locale === "en" ? "Ads" : "Iklan"} ({ads.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai_workspace")}
              className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                activeTab === "ai_workspace"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800"
                  : "text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              }`}
            >
              <span>⚡</span> AI Analysis
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
            title={locale === "en" ? "Close Details" : "Tutup Detail"}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tab 1: Overview & Metrics */}
      {activeTab === "overview" && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Key Metric Strip for this Campaign */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {locale === "en" ? "Total Spend" : "Total Belanja"}
              </span>
              <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 font-mono mt-0.5">
                {formatCurrency(campaign.spend)}
              </p>
              <span className="text-[10px] text-zinc-400 font-mono">
                CPM: {campaign.cpm !== null ? formatCurrency(campaign.cpm) : "—"}
              </span>
            </div>

            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {locale === "en" ? "Results / Conversions" : "Hasil Pesan / Conversions"}
              </span>
              <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 font-mono mt-0.5">
                {campaign.results} {locale === "en" ? "conversations" : "percakapan"}
              </p>
              <span className="text-[10px] text-zinc-400 font-mono">
                Cost/Result: {campaign.costPerResult !== null ? formatCurrency(campaign.costPerResult) : "—"}
              </span>
            </div>

            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {locale === "en" ? "Link Clicks & CTR" : "Klik Tautan & Link CTR"}
              </span>
              <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 font-mono mt-0.5">
                {formatNumber(campaign.linkClicks)} ({campaign.linkCtr !== null ? `${campaign.linkCtr}%` : "—"})
              </p>
              <span className="text-[10px] text-zinc-400 font-mono">
                Link CPC: {campaign.linkCpc !== null ? formatCurrency(campaign.linkCpc) : "—"}
              </span>
            </div>

            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {locale === "en" ? "Reach & Frequency" : "Jangkauan & Frekuensi"}
              </span>
              <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 font-mono mt-0.5">
                {formatNumber(campaign.reach)}
              </p>
              <span className="text-[10px] text-zinc-400 font-mono">
                {locale === "en" ? "Frequency:" : "Frekuensi:"} {campaign.frequency !== null ? `${campaign.frequency}x` : "—"} • {locale === "en" ? "Impressions:" : "Impresi:"} {formatNumber(campaign.impressions)}
              </span>
            </div>
          </div>

          {/* Context & Data Integrity Callout */}
          <div className="rounded-lg border border-zinc-200 bg-white p-3.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 space-y-1.5">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 text-xs">
              <span>📋</span> {locale === "en" ? "Property Campaign Analysis Context" : "Konteks Analisis Campaign Properti"}
            </span>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {locale === "en" ? "This campaign is configured with status " : "Campaign ini terkonfigurasi dengan status "}
              <strong>{campaign.status}</strong>
              {locale === "en" ? " in Meta Ads Manager." : " di Meta Ads Manager."}
              {campaign.status === "PAUSED" && (
                <span className="text-amber-700 dark:text-amber-400 font-semibold ml-1">
                  {locale === "en"
                    ? "Because the campaign status is PAUSED, all ads inside are automatically inactive from serving new impressions on Meta, regardless of individual ad-level status."
                    : "Karena status campaign adalah PAUSED, seluruh iklan di dalamnya otomatis tidak aktif menayangkan impresi baru di Meta, terlepas dari pengaturan status ad-level."}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Ads Breakdown in this Campaign */}
      {activeTab === "ads" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-500 dark:bg-zinc-900/60 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{locale === "en" ? "Ad Name" : "Nama Iklan"}</th>
                <th className="py-2.5 px-3 font-semibold">{locale === "en" ? "Delivery Status" : "Status Penayangan"}</th>
                <th className="py-2.5 px-3 font-semibold font-mono">Spend</th>
                <th className="py-2.5 px-3 font-semibold font-mono">{locale === "en" ? "Results (Meta)" : "Hasil (Meta)"}</th>
                <th className="py-2.5 px-3 font-semibold font-mono">Link Clicks & CTR</th>
                <th className="py-2.5 px-3 font-semibold font-mono">Link CPC</th>
                <th className="py-2.5 px-4 font-semibold font-mono">{locale === "en" ? "Reach" : "Jangkauan"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
              {ads.map((ad) => (
                <tr key={ad.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                  <td className="py-3 px-4 font-medium max-w-xs truncate">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs truncate">
                      {ad.adName}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      ID: {ad.providerAdId} • {ad.adsetName}
                    </div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                        ad.deliveryStatus === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {ad.deliveryLabel}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    {formatCurrency(ad.spend)}
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {ad.results} {locale === "en" ? "messages" : "pesan"}
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {formatNumber(ad.linkClicks)} ({ad.linkCtr !== null ? `${ad.linkCtr}%` : "—"})
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {ad.linkCpc !== null ? formatCurrency(ad.linkCpc) : "—"}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {formatNumber(ad.reach)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Prepared AI Campaign Analysis Workspace */}
      {activeTab === "ai_workspace" && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3.5 dark:border-indigo-900 dark:bg-indigo-950/30 flex items-start gap-3">
            <span className="text-xl">⚡</span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs sm:text-sm text-indigo-950 dark:text-indigo-200">
                  Ruang Analisis Kampanye Meta AI Model (Muse Spark)
                </h4>
                <span className="rounded bg-indigo-200/70 px-1.5 py-0.2 text-[9px] font-bold text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200 uppercase">
                  Kontrak Desain Siap Pakai
                </span>
              </div>
              <p className="text-[11px] text-indigo-900/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                Struktur di bawah ini disiapkan untuk menerima analisis menyeluruh dari Meta AI Model API pada fase implementasi AI berikutnya. Tidak ada model eksternal yang dipanggil pada tahap ini guna menjamin kestabilan dan akurasi fondasi visual data.
              </p>
            </div>
          </div>

          {/* 8 Structured Analytical Sections Prepared for Meta AI Model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            {/* 1. Executive Summary */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60 shadow-2xs space-y-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[10px] font-mono dark:bg-zinc-700">1</span>
                Executive Summary
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Sintesis performa keseluruhan kampanye, evaluasi efisiensi biaya terhadap target volume prospek WhatsApp, serta status delivery saat ini ({campaign.status}).
              </p>
            </div>

            {/* 2. Diagnosis Performa */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60 shadow-2xs space-y-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[10px] font-mono dark:bg-zinc-700">2</span>
                Diagnosis Performa Berbasis Metrik
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Pemeriksaan mendalam per metrik: Link CTR ({campaign.linkCtr !== null ? `${campaign.linkCtr}%` : "—"}), CPC ({campaign.linkCpc !== null ? formatCurrency(campaign.linkCpc) : "—"}), dan titik drop-off antara klik tautan dan konversi percakapan.
              </p>
            </div>

            {/* 3. Indikator Pendukung */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60 shadow-2xs space-y-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[10px] font-mono dark:bg-zinc-700">3</span>
                Indikator Pendukung
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Fakta kuantitatif: Total spend {formatCurrency(campaign.spend)}, jangkauan {formatNumber(campaign.reach)} akun unik, dan rasio frekuensi paparan {campaign.frequency ?? "—"}x.
              </p>
            </div>

            {/* 4. Faktor yang Belum Pasti */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60 shadow-2xs space-y-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[10px] font-mono dark:bg-zinc-700">4</span>
                Faktor yang Belum Pasti
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Data mutu percakapan WhatsApp dan Buyer Score masih menunggu integrasi webhook WhatsApp Cloud API yang akan datang.
              </p>
            </div>

            {/* 5. Risiko & Keterbatasan Data */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60 shadow-2xs space-y-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[10px] font-mono dark:bg-zinc-700">5</span>
                Risiko & Keterbatasan Data
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Attribution window Meta dan volume sampel awal memerlukan kehati-hatian sebelum melakukan scaling agresif.
              </p>
            </div>

            {/* 6. Rekomendasi Tindakan */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60 shadow-2xs space-y-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[10px] font-mono dark:bg-zinc-700">6</span>
                Rekomendasi Tindakan
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Saran taktis: Evaluasi penawaran pembuka WhatsApp (pre-filled message) dan penyesuaian anggaran bertahap (bukan jaminan keuntungan pasti).
              </p>
            </div>

            {/* 7. Prioritas Eksperimen */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60 shadow-2xs space-y-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[10px] font-mono dark:bg-zinc-700">7</span>
                Prioritas Eksperimen
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Rencana pengujian A/B: Format video tour properti vs poster sertifikat legalitas SHM untuk membandingkan Link CTR.
              </p>
            </div>

            {/* 8. Metrik Evaluasi */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-800/60 shadow-2xs space-y-1">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[10px] font-mono dark:bg-zinc-700">8</span>
                Metrik yang Dipantau
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Indikator kunci: Rasio Cost per Messaging Conversation dan Link CTR mingguan untuk memvalidasi keberhasilan eksperimen.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
