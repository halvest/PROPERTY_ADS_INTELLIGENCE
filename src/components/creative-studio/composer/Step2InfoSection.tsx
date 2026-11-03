"use client";

import React, { useRef, useEffect } from "react";
import type { CreativeBriefInput } from "@/lib/ai/creative-studio/types";

export interface Step2InfoSectionProps {
  narrativeText: string;
  onNarrativeChange: (text: string) => void;
  brief: CreativeBriefInput;
  verifiedFields: Set<string>;
  onUpdateField: <K extends keyof CreativeBriefInput>(field: K, value: CreativeBriefInput[K]) => void;
  onPromoFieldChange: (text: string) => void;
  onSpecsFieldChange: (text: string) => void;
}

const QUICK_PROMO_CHIPS = [
  "DP 0%",
  "Bebas PPN",
  "Dekat gerbang tol",
  "Cicilan mulai 4 juta/bulan",
  "Promo khusus",
  "Free biaya KPR",
  "Free biaya AJB",
  "Booking fee 5 juta",
];

const STANDARD_CTAS = [
  "Klaim Promo WhatsApp",
  "Hubungi Sekarang",
  "Chat WhatsApp",
  "Dapatkan Info Promo",
  "Jadwalkan Survey",
  "Konsultasi Gratis",
];

export function Step2InfoSection({
  narrativeText,
  onNarrativeChange,
  brief,
  verifiedFields,
  onUpdateField,
  onPromoFieldChange,
  onSpecsFieldChange,
}: Step2InfoSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const waInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea when narrative text changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(220, Math.max(88, textareaRef.current.scrollHeight))}px`;
    }
  }, [narrativeText]);

  // Append promo chip without duplication
  const handleTogglePromoChip = (chip: string) => {
    const escaped = chip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");

    if (regex.test(narrativeText)) {
      // If already present, don't duplicate; notify or remove cleanly
      const updated = narrativeText
        .replace(new RegExp(`(\\s*•\\s*|\\s*\\.\\s*|\\s*\\,\\s*|^|\\s+)${escaped}`, "gi"), "")
        .replace(/\s{2,}/g, " ")
        .trim();
      onNarrativeChange(updated);
    } else {
      const trimmed = narrativeText.trim();
      const updated = trimmed
        ? `${trimmed}${trimmed.endsWith(".") || trimmed.endsWith("•") ? " " : ". "}${chip}`
        : chip;
      onNarrativeChange(updated);
    }
  };

  const isChipActive = (chip: string): boolean => {
    const escaped = chip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(narrativeText) || (brief.promos || []).some((p) => regex.test(p));
  };

  const isFieldVerified = (fieldKey: string) => verifiedFields.has(fieldKey);

  const getStatusBadge = (fieldKey: string, hasValue: boolean) => {
    if (isFieldVerified(fieldKey)) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Terverifikasi ✓
        </span>
      );
    }
    if (hasValue) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
          Terdeteksi AI
        </span>
      );
    }
    return (
      <span className="text-[10px] font-medium text-zinc-400">
        Belum tersedia
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Section Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-extrabold text-xs flex items-center justify-center border border-sky-500/20">
            2
          </span>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Informasi properti
          </h4>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed ml-8">
          Berikan informasi utama agar AI dapat membuat iklan yang relevan, akurat, dan berdaya konversi tinggi.
        </p>
      </div>

      {/* A. Smart Brief Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <span>Ceritakan properti Anda</span>
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              ● AI Live Extraction
            </span>
          </label>
          <span className="text-[10px] text-zinc-400">
            Teks bebas atau paste brief
          </span>
        </div>

        <textarea
          ref={textareaRef}
          value={narrativeText}
          onChange={(e) => onNarrativeChange(e.target.value)}
          placeholder="Contoh: Rumah modern di BSD City, harga mulai Rp850 juta, DP 0%, 3 kamar tidur, 2 kamar mandi, free PPN, dan hanya 5 menit ke gerbang tol."
          rows={3}
          className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-3 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs leading-relaxed resize-none transition-all"
        />

        {/* B. Quick Insert Promo Chips */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold text-zinc-400 block">
            Sisipkan Penawaran Cepat:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMO_CHIPS.map((chip) => {
              const active = isChipActive(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleTogglePromoChip(chip)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 select-none ${
                    active
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                      : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                  title={active ? "Penawaran aktif dalam brief (Klik untuk hapus)" : "Klik untuk menyisipkan ke brief"}
                >
                  <span>{active ? "✓" : "+"}</span>
                  <span>{chip}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* C. AI Auto-Detection & Verification Summary */}
      <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <span>🔍 Ringkasan Data Terdeteksi AI</span>
          </span>
          <span className="text-[10px] text-zinc-400 font-medium">
            3 Tingkat Status: Terverifikasi • Terdeteksi AI • Belum ada
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {brief.propertyLocation ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
              <span>📍 {brief.propertyLocation}</span>
              {getStatusBadge("propertyLocation", true)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-800">
              <span>📍 Lokasi belum terdeteksi</span>
            </span>
          )}

          {brief.startingPrice ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-zinc-900 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
              <span>💰 {brief.startingPrice}</span>
              {getStatusBadge("startingPrice", true)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-800">
              <span>💰 Harga belum ditentukan</span>
            </span>
          )}

          {brief.dpAmount && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-zinc-900 border border-amber-500/30 text-amber-700 dark:text-amber-300">
              <span>🏷️ {brief.dpAmount}</span>
              {getStatusBadge("dpAmount", true)}
            </span>
          )}

          <button
            type="button"
            onClick={() => onUpdateField("hasFreePpn", !brief.hasFreePpn)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              brief.hasFreePpn
                ? "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300"
                : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400"
            }`}
            title="Klik untuk menyalakan/mematikan badge Bebas PPN"
          >
            <span>✨ Free PPN 100%</span>
            <span className="text-[10px] font-extrabold">
              {brief.hasFreePpn ? "AKTIF ✓" : "OFF"}
            </span>
          </button>

          {brief.bedrooms && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
              <span>🛏️ {brief.bedrooms} KT {brief.bathrooms ? `/ ${brief.bathrooms} KM` : ""}</span>
              {getStatusBadge("bedrooms", true)}
            </span>
          )}

          {brief.whatsappNumber ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-zinc-900 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
              <span>📞 {brief.whatsappNumber}</span>
              {getStatusBadge("whatsappNumber", true)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => waInputRef.current?.focus()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 cursor-pointer"
            >
              <span>+ No. WA Sales (Opsional)</span>
            </button>
          )}
        </div>
      </div>

      {/* D. Form Informasi Terstruktur (Grouped Fields) */}
      <div className="space-y-4">
        {/* GROUP 1: Informasi Dasar */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>🏢</span> Grup 1: Informasi Dasar Properti
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">
              Nama &amp; Lokasi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Nama Proyek / Perumahan
                </label>
                {getStatusBadge("projectName", Boolean(brief.projectName))}
              </div>
              <input
                type="text"
                value={brief.projectName}
                onChange={(e) => onUpdateField("projectName", e.target.value)}
                placeholder="Opsional (Contoh: Grand Harmoni Residence)"
                className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Lokasi Properti <span className="text-rose-500">*</span>
                </label>
                {getStatusBadge("propertyLocation", Boolean(brief.propertyLocation))}
              </div>
              <input
                type="text"
                value={brief.propertyLocation}
                onChange={(e) => onUpdateField("propertyLocation", e.target.value)}
                placeholder="Contoh: BSD City, Tangerang Selatan"
                className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                Harga Mulai
              </label>
              {getStatusBadge("startingPrice", Boolean(brief.startingPrice))}
            </div>
            <input
              type="text"
              value={brief.startingPrice}
              onChange={(e) => onUpdateField("startingPrice", e.target.value)}
              placeholder="Contoh: Rp 850 Juta (atau Mulai 800 Jt-an)"
              className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        {/* GROUP 2: Spesifikasi Unit */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>📐</span> Grup 2: Spesifikasi Unit
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">
              Kamar Tidur, Mandi &amp; Luas
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                Format Baris Spesifikasi (Dicetak di Brosur/Desain)
              </label>
              {getStatusBadge("specsText", Boolean(brief.specsText))}
            </div>
            <input
              type="text"
              value={brief.specsText || ""}
              onChange={(e) => onSpecsFieldChange(e.target.value)}
              placeholder="Contoh: 3 KT • 2 KM • LT 72m² • LB 85m²"
              className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                Kamar Tidur
              </label>
              <input
                type="text"
                value={brief.bedrooms || ""}
                onChange={(e) => onUpdateField("bedrooms", e.target.value)}
                placeholder="3 KT"
                className="w-full text-xs text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                Kamar Mandi
              </label>
              <input
                type="text"
                value={brief.bathrooms || ""}
                onChange={(e) => onUpdateField("bathrooms", e.target.value)}
                placeholder="2 KM"
                className="w-full text-xs text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                Luas Tanah
              </label>
              <input
                type="text"
                value={brief.landArea || ""}
                onChange={(e) => onUpdateField("landArea", e.target.value)}
                placeholder="72 m²"
                className="w-full text-xs text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                Bangunan
              </label>
              <input
                type="text"
                value={brief.buildingArea || ""}
                onChange={(e) => onUpdateField("buildingArea", e.target.value)}
                placeholder="85 m²"
                className="w-full text-xs text-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* GROUP 3: Penawaran & Promo */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>🎁</span> Grup 3: Penawaran &amp; Promo Khusus
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">
              DP &amp; Fasilitas Bebas Biaya
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Promo &amp; Uang Muka (DP)
                </label>
                {getStatusBadge("promoHeadline", Boolean(brief.promoHeadline || (brief.promos && brief.promos.length > 0)))}
              </div>
              <input
                type="text"
                value={
                  brief.promoHeadline ||
                  (brief.promos && brief.promos.length > 0
                    ? brief.promos.join(" • ")
                    : brief.dpAmount || "")
                }
                onChange={(e) => onPromoFieldChange(e.target.value)}
                placeholder="Contoh: DP 0% • Subsidi Biaya KPR"
                className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(brief.hasFreePpn)}
                  onChange={(e) => onUpdateField("hasFreePpn", e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Sertakan Badge &quot;Free PPN 100%&quot;
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* GROUP 4: Kontak & Pesan */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>💬</span> Grup 4: Kontak &amp; Pesan Konversi
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">
              WhatsApp &amp; Tombol CTA
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  No. WhatsApp Sales (Opsional)
                </label>
                {getStatusBadge("whatsappNumber", Boolean(brief.whatsappNumber))}
              </div>
              <input
                ref={waInputRef}
                type="text"
                value={brief.whatsappNumber || ""}
                onChange={(e) => onUpdateField("whatsappNumber", e.target.value.trim() ? e.target.value : null)}
                placeholder="Contoh: 0812-8899-5500 (Kosongkan jika tanpa nomor)"
                className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Teks Tombol CTA
                </label>
                {getStatusBadge("ctaText", Boolean(brief.ctaText))}
              </div>
              <div className="flex gap-2">
                <select
                  value={
                    STANDARD_CTAS.includes(brief.ctaText || "")
                      ? brief.ctaText
                      : "custom"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "custom") {
                      onUpdateField("ctaText", val);
                    }
                  }}
                  className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-zinc-900 dark:text-zinc-100 font-semibold cursor-pointer"
                >
                  {STANDARD_CTAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="custom">-- Teks Kustom --</option>
                </select>
              </div>
            </div>
          </div>

          {/* Custom CTA Input if needed */}
          {!STANDARD_CTAS.includes(brief.ctaText || "") && (
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                Tulis Teks Tombol CTA Kustom:
              </label>
              <input
                type="text"
                value={brief.ctaText || ""}
                onChange={(e) => onUpdateField("ctaText", e.target.value)}
                placeholder="Contoh: Dapatkan Brosur Lengkap"
                className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          )}

          {/* Custom Headline (Full-Width) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                Custom Headline (Opsional)
              </label>
              <span className="text-[10px] text-zinc-400">
                Kosongkan untuk dirumuskan otomatis oleh AI
              </span>
            </div>
            <input
              type="text"
              value={brief.headline || ""}
              onChange={(e) => onUpdateField("headline", e.target.value)}
              placeholder="Contoh: Punya Rumah Impian di BSD City Tanpa Pusing Uang Muka"
              className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

