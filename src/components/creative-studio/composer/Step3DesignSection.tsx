"use client";

import React, { useState } from "react";
import type { StylePreset, PhotographyLightingStyle } from "@/lib/ai/creative-studio/types";

export interface Step3DesignSectionProps {
  selectedPreset: StylePreset;
  onSelectPreset: (preset: StylePreset) => void;
  logoPlacement: "top-left" | "top-right" | "auto" | undefined;
  onChangeLogoPlacement: (placement: "top-left" | "top-right" | "auto") => void;
  customHeadline?: string;
  onChangeCustomHeadline?: (headline: string) => void;
  photographyStyle?: PhotographyLightingStyle;
  onChangePhotographyStyle?: (style: PhotographyLightingStyle) => void;
}

interface TemplateOption {
  id: StylePreset;
  name: string;
  badge: string;
  badgeColor: string;
  desc: string;
  paletteClass: string;
  accentBorder: string;
  icon: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: "auto_director",
    name: "Auto Smart Match",
    badge: "Rekomendasi AI",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    desc: "AI menganalisis foto dan informasi properti untuk memilih formula komposisi terbaik secara otomatis.",
    paletteClass: "from-emerald-500 via-teal-600 to-indigo-600",
    accentBorder: "border-indigo-500",
    icon: "🪄",
  },
  {
    id: "architectural_editorial",
    name: "1. Architectural Editorial",
    badge: "Majalah Mewah",
    badgeColor: "bg-stone-500/10 text-stone-600 dark:text-stone-300 border-stone-500/20",
    desc: "Gaya cover majalah arsitektur papan atas. Tipografi serif elegan, full-bleed hero photo, dan negative space lapang.",
    paletteClass: "from-stone-700 via-zinc-800 to-amber-900",
    accentBorder: "border-stone-500",
    icon: "🏛️",
  },
  {
    id: "luxury_developer_brochure",
    name: "2. Luxury Developer Brochure",
    badge: "BSD / Ciputra Style",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    desc: "Standar brosur resmi pengembang prestisius. Kartu harga forest green asimetris, aksen champagne gold, dan 2-baris spesifikasi rapi.",
    paletteClass: "from-emerald-800 via-teal-900 to-amber-800",
    accentBorder: "border-emerald-600",
    icon: "👑",
  },
  {
    id: "swiss_grid_editorial",
    name: "3. Swiss Grid Editorial",
    badge: "Modernist Grid",
    badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    desc: "Struktur grid modernist Müller-Brockmann. Tipografi grotesque tegas, matriks 4-kotak spesifikasi, garis 1px presisi, dan CTA aksen crimson.",
    paletteClass: "from-zinc-900 via-neutral-800 to-red-800",
    accentBorder: "border-red-500",
    icon: "📐",
  },
  {
    id: "modern_japanese_minimalism",
    name: "4. Modern Japanese Minimalism",
    badge: "Wabi-Sabi Hening",
    badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    desc: "Estetika wabi-sabi dengan kartu linen/krem lembut, aksen vertikal sage green, tracking huruf lebar, dan badge promo natural.",
    paletteClass: "from-stone-600 via-emerald-800 to-amber-700",
    accentBorder: "border-teal-500",
    icon: "🎋",
  },
  {
    id: "premium_real_estate_campaign",
    name: "5. Premium Real Estate Campaign",
    badge: "High-CTR Meta Ads",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    desc: "Juara konversi Meta Ads. Kontras tajam, tiket promo DP 0% / Bebas PPN, harga bold mencolok, dan tombol aksi WhatsApp instan.",
    paletteClass: "from-amber-600 via-orange-600 to-emerald-700",
    accentBorder: "border-amber-500",
    icon: "🚀",
  },
  {
    id: "contemporary_corporate",
    name: "6. Contemporary Corporate",
    badge: "Paramount Land",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    desc: "Nuansa korporat prestisius navy & platinum. Kartu spesifikasi 3-kolom keunggulan lokasi (tol, stasiun, mall) dan lencana jaminan kualitas.",
    paletteClass: "from-blue-900 via-slate-800 to-indigo-950",
    accentBorder: "border-blue-600",
    icon: "🏢",
  },
  {
    id: "cinematic_architecture",
    name: "7. Cinematic Architecture",
    badge: "Twilight Blue Hour",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    desc: "Pencahayaan senja dramatis dengan cahaya interior kaca hangat, tipografi serif emas sampanye, dan floating dark pill mewah.",
    paletteClass: "from-indigo-950 via-purple-950 to-amber-900",
    accentBorder: "border-purple-600",
    icon: "🌌",
  },
  {
    id: "high_end_property_catalog",
    name: "8. High-End Property Catalog",
    badge: "Lookbook Spek",
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    desc: "Katalog lookbook properti modern dengan tag Tipe Unit (LB/LT), tabel spesifikasi horizontal elegan, dan footer developer resmi.",
    paletteClass: "from-teal-900 via-stone-800 to-slate-900",
    accentBorder: "border-cyan-500",
    icon: "📋",
  },
];

const LIGHTING_OPTIONS: { id: PhotographyLightingStyle; label: string; icon: string; desc: string }[] = [
  {
    id: "clean_daylight",
    label: "Clean Daylight",
    icon: "☀️",
    desc: "Siang terang alami dengan langit biru bersih dan bayangan arsitektur tajam.",
  },
  {
    id: "luxury_golden_hour",
    label: "Golden Hour",
    icon: "🌅",
    desc: "Sore keemasan hangat dengan pantulan matahari terbenam pada fasad.",
  },
  {
    id: "blue_hour_luxury",
    label: "Blue Hour Twilight",
    icon: "🌃",
    desc: "Senja dramatis bernuansa indigo dengan lampu interior kaca menyala hangat.",
  },
  {
    id: "tropical_architecture",
    label: "Tropical Modern",
    icon: "🌴",
    desc: "Pencahayaan tropis alami dengan lanskap taman hijau dan aksen kayu jati.",
  },
];

export function Step3DesignSection({
  selectedPreset,
  onSelectPreset,
  logoPlacement,
  onChangeLogoPlacement,
  customHeadline,
  onChangeCustomHeadline,
  photographyStyle = "clean_daylight",
  onChangePhotographyStyle,
}: Step3DesignSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activePreset =
    !selectedPreset || selectedPreset === "creative_freedom"
      ? "auto_director"
      : selectedPreset;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Section Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-extrabold text-xs flex items-center justify-center border border-sky-500/20">
            3
          </span>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Pilih 8 Formula Desain Arsitektural
          </h4>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed ml-8">
          Pilih 1 dari 8 gaya brosur standar Photoshop & Canva Pro, atau gunakan Auto Match rekomendasi AI.
        </p>
      </div>

      {/* 8 Architectural Design Niches Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
        {TEMPLATE_OPTIONS.map((tmpl) => {
          const isSelected = activePreset === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onSelectPreset(tmpl.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden select-none min-h-[148px] ${
                isSelected
                  ? `${tmpl.accentBorder} bg-white dark:bg-zinc-900 ring-2 ring-sky-500/30 shadow-md`
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {/* Subtle Color Accent Stripe at top */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r ${tmpl.paletteClass} ${
                  isSelected ? "opacity-100" : "opacity-40"
                }`}
              />

              {/* Card Header: Icon, Title, and Badge */}
              <div className="space-y-1.5 w-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl shrink-0">{tmpl.icon}</span>
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 block leading-tight">
                      {tmpl.name}
                    </span>
                  </div>

                  {isSelected ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-xs">
                      ✓
                    </span>
                  ) : (
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border shrink-0 ${tmpl.badgeColor}`}
                    >
                      {tmpl.badge}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                  {tmpl.desc}
                </p>
              </div>

              {/* Bottom Card Footer: Selected Status Indicator */}
              <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px]">
                <span className="text-zinc-400 font-medium">
                  {isSelected ? "Aktif Terpilih" : "Klik untuk Memilih"}
                </span>
                {isSelected && (
                  <span className="text-sky-600 dark:text-sky-400 font-bold">
                    Template Utama
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Collapsible: Pengaturan Desain & Fotografi Lanjutan */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/70 dark:bg-zinc-950/40">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">⚙️</span>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Pengaturan Fotografi & Desain Lanjutan
            </span>
          </div>
          <span className="text-xs text-zinc-400 font-bold">
            {showAdvanced ? "Sembunyikan ▲" : "Tampilkan Opsi ▼"}
          </span>
        </button>

        {showAdvanced && (
          <div className="p-3.5 pt-1 border-t border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            {/* Photography Lighting Style Selector */}
            {onChangePhotographyStyle && (
              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Gaya Pencahayaan Fotografi Arsitektur (AI Lighting)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LIGHTING_OPTIONS.map((light) => {
                    const isLightingActive = photographyStyle === light.id;
                    return (
                      <button
                        key={light.id}
                        type="button"
                        onClick={() => onChangePhotographyStyle(light.id)}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isLightingActive
                            ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/40"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-[11px]">
                          <span>{light.icon}</span>
                          <span>{light.label}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-tight">
                          {light.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Logo Placement */}
            <div>
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Posisi Peletakan Logo Brand
              </label>
              <select
                value={logoPlacement || "auto"}
                onChange={(e) =>
                  onChangeLogoPlacement(e.target.value as "top-left" | "top-right" | "auto")
                }
                className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100 font-medium"
              >
                <option value="auto">Kanan Atas (Aman dari Icon Story)</option>
                <option value="top-left">Kiri Atas (Samping Lokasi)</option>
                <option value="top-right">Kanan Atas (Eksklusif)</option>
              </select>
            </div>

            {/* Custom Headline Override */}
            {onChangeCustomHeadline && (
              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Variasi Headline Tambahan
                </label>
                <input
                  type="text"
                  value={customHeadline || ""}
                  onChange={(e) => onChangeCustomHeadline(e.target.value)}
                  placeholder="Kosongkan jika ingin mengikuti brief"
                  className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
