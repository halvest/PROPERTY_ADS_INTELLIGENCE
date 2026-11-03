"use client";

import React, { useState } from "react";
import { AssetUploader } from "./AssetUploader";
import type {
  CreativeBriefInput,
  AspectRatio,
  StylePreset,
  UploadedAssetItem,
} from "@/lib/ai/creative-studio/types";

interface BriefFormProps {
  brief: CreativeBriefInput;
  onChange: (updated: CreativeBriefInput) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const STYLE_PRESETS: Array<{
  id: StylePreset;
  title: string;
  desc: string;
  color: string;
}> = [
  {
    id: "luxury",
    title: "Premium Luxury",
    desc: "Obsidian & Champagne Gold, tipografi berkelas, visual megah.",
    color: "#D4AF37",
  },
  {
    id: "minimalist",
    title: "Modern Minimalist",
    desc: "Komposisi bersih, Slate Blue, arsitektur terbuka natural.",
    color: "#38BDF8",
  },
  {
    id: "high_conversion",
    title: "High Conversion Ads",
    desc: "Emerald Green, kontras tinggi, dioptimasi untuk klik WhatsApp.",
    color: "#10B981",
  },
  {
    id: "promotional",
    title: "Promotional Campaign",
    desc: "Badge penawaran berani, urgensi tinggi, DP & cicilan mencolok.",
    color: "#F43F5E",
  },
  {
    id: "modern_residential",
    title: "Modern Residential",
    desc: "Hangat, earth-tones, ramah keluarga, fokus kenyamanan hidup.",
    color: "#F59E0B",
  },
  {
    id: "editorial_architecture",
    title: "Editorial Architecture",
    desc: "Estetika majalah arsitektur, framing simetris dramatis.",
    color: "#A1A1AA",
  },
  {
    id: "elegant_corporate",
    title: "Elegant Corporate",
    desc: "Navy & Platinum, reputasi developer terpercaya & mapan.",
    color: "#6366F1",
  },
  {
    id: "creative_freedom",
    title: "Creative Freedom (AI)",
    desc: "Biarkan AI menentukan komposisi dan palet paling efektif.",
    color: "#EC4899",
  },
];

export function BriefForm({
  brief,
  onChange,
  onGenerate,
  isGenerating,
}: BriefFormProps) {
  const [activeTab, setActiveTab] = useState<"property" | "promo" | "assets" | "style">("property");

  const updateField = <K extends keyof CreativeBriefInput>(
    field: K,
    value: CreativeBriefInput[K]
  ) => {
    onChange({
      ...brief,
      [field]: value,
    });
  };

  const handleAssetsChange = (assets: UploadedAssetItem[]) => {
    updateField("assets", assets);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full">
      {/* Tab Navigation Header */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-1.5 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("property")}
          className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "property"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          }`}
        >
          1. Properti
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("promo")}
          className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "promo"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          }`}
        >
          2. Promo & Finansial
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("assets")}
          className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all relative ${
            activeTab === "assets"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          }`}
        >
          3. Foto ({brief.assets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("style")}
          className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "style"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          }`}
        >
          4. Gaya & Rasio
        </button>
      </div>

      {/* Form Content Area */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4">
        {/* TAB 1: INFORMASI PROPERTI */}
        {activeTab === "property" && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Nama Proyek / Perumahan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={brief.projectName}
                onChange={(e) => updateField("projectName", e.target.value)}
                placeholder="Contoh: Grand Harmoni City"
                className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Jenis Properti
                </label>
                <select
                  value={brief.propertyType}
                  onChange={(e) => updateField("propertyType", e.target.value)}
                  className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Rumah Tinggal">Rumah Tinggal</option>
                  <option value="Cluster Premium">Cluster Premium</option>
                  <option value="Villa Mewah">Villa Mewah</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Apartemen">Apartemen</option>
                  <option value="Ruko Komersial">Ruko Komersial</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Lokasi Properti
                </label>
                <input
                  type="text"
                  value={brief.propertyLocation}
                  onChange={(e) => updateField("propertyLocation", e.target.value)}
                  placeholder="Contoh: BSD City, Tangerang"
                  className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Harga Mulai
              </label>
              <input
                type="text"
                value={brief.startingPrice}
                onChange={(e) => updateField("startingPrice", e.target.value)}
                placeholder="Contoh: Rp 850 Juta atau Rp 1,5 Miliar"
                className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Headline Utama Iklan
              </label>
              <input
                type="text"
                value={brief.headline}
                onChange={(e) => updateField("headline", e.target.value)}
                placeholder="Contoh: Hunian Modern 2 Lantai di Jantung BSD"
                className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Subheadline / Selling Point
              </label>
              <input
                type="text"
                value={brief.subheadline}
                onChange={(e) => updateField("subheadline", e.target.value)}
                placeholder="Contoh: 5 Menit ke Gerbang Tol & Mall Terbesar"
                className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Spesifikasi Teknis */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Luas Tanah (m²)
                </label>
                <input
                  type="text"
                  value={brief.landArea}
                  onChange={(e) => updateField("landArea", e.target.value)}
                  placeholder="72"
                  className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Luas Bangunan (m²)
                </label>
                <input
                  type="text"
                  value={brief.buildingArea}
                  onChange={(e) => updateField("buildingArea", e.target.value)}
                  placeholder="85"
                  className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Kamar Tidur
                </label>
                <input
                  type="text"
                  value={brief.bedrooms}
                  onChange={(e) => updateField("bedrooms", e.target.value)}
                  placeholder="3"
                  className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROMO & FINANSIAL */}
        {activeTab === "promo" && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Headline Promo Utama
              </label>
              <input
                type="text"
                value={brief.promoHeadline}
                onChange={(e) => updateField("promoHeadline", e.target.value)}
                placeholder="Contoh: Promo Spesial Launching Tahap 1"
                className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Uang Muka (DP)
                </label>
                <input
                  type="text"
                  value={brief.dpAmount}
                  onChange={(e) => updateField("dpAmount", e.target.value)}
                  placeholder="Contoh: DP 0%"
                  className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Cicilan per Bulan
                </label>
                <input
                  type="text"
                  value={brief.monthlyInstallment}
                  onChange={(e) => updateField("monthlyInstallment", e.target.value)}
                  placeholder="Contoh: Mulai Rp 4 Jt/bln"
                  className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Cashback
                </label>
                <input
                  type="text"
                  value={brief.cashback}
                  onChange={(e) => updateField("cashback", e.target.value)}
                  placeholder="Contoh: Rp 50 Juta"
                  className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Bunga KPR Promo
                </label>
                <input
                  type="text"
                  value={brief.kprRate}
                  onChange={(e) => updateField("kprRate", e.target.value)}
                  placeholder="Contoh: 2.75% Fixed 3 Thn"
                  className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Free PPN Toggle */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Insentif Bebas PPN (Free PPN DTP)
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tampilkan badge resmi Free PPN pada visual iklan
                </p>
              </div>
              <input
                type="checkbox"
                checked={brief.hasFreePpn}
                onChange={(e) => updateField("hasFreePpn", e.target.checked)}
                className="w-5 h-5 text-sky-600 rounded-sm focus:ring-sky-500 border-zinc-300 dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Call to Action (CTA Iklan)
              </label>
              <input
                type="text"
                value={brief.ctaText}
                onChange={(e) => updateField("ctaText", e.target.value)}
                placeholder="Contoh: Klaim Promo WhatsApp"
                className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        )}

        {/* TAB 3: ASSET UPLOAD */}
        {activeTab === "assets" && (
          <div className="animate-in fade-in-50 duration-150">
            <AssetUploader
              assets={brief.assets}
              onChange={handleAssetsChange}
            />
          </div>
        )}

        {/* TAB 4: GAYA & RASIO */}
        {activeTab === "style" && (
          <div className="space-y-5 animate-in fade-in-50 duration-150">
            {/* Aspect Ratio Selector */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Pilih Rasio Kanvas Iklan
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    ratio: "1:1" as AspectRatio,
                    label: "1:1 Square",
                    desc: "Feed Instagram",
                    boxClass: "w-8 h-8",
                  },
                  {
                    ratio: "4:5" as AspectRatio,
                    label: "4:5 Portrait",
                    desc: "Feed Meta Ads",
                    boxClass: "w-7 h-9",
                  },
                  {
                    ratio: "9:16" as AspectRatio,
                    label: "9:16 Vertical",
                    desc: "Stories & Reels",
                    boxClass: "w-6 h-10",
                  },
                ].map((item) => (
                  <button
                    key={item.ratio}
                    type="button"
                    onClick={() => updateField("aspectRatio", item.ratio)}
                    className={`p-3 rounded-xl border text-left flex flex-col items-center justify-center gap-1.5 transition-all ${
                      brief.aspectRatio === item.ratio
                        ? "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20 text-sky-600 dark:text-sky-400"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className={`border-2 border-current rounded-sm ${item.boxClass}`} />
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Style Preset Selector */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Pilih Gaya Desain (Art Direction)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STYLE_PRESETS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => updateField("stylePreset", style.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      brief.stylePreset === style.id
                        ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: style.color }}
                      />
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {style.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {style.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Generate Action */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || !brief.projectName.trim()}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-linear-to-r from-sky-600 via-indigo-600 to-sky-600 hover:from-sky-500 hover:to-indigo-500 shadow-md hover:shadow-sky-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Merancang Iklan Properti...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.2L12 16.8 5.7 21.2 8 14 2 9.4h7.6L12 2z" />
              </svg>
              <span>Generate Property Ad</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

