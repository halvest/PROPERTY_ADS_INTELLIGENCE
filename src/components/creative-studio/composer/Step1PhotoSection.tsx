"use client";

import React, { useRef, useState } from "react";
import type { AspectRatio, UploadedAssetItem } from "@/lib/ai/creative-studio/types";

export interface Step1PhotoSectionProps {
  aspectRatio: AspectRatio;
  onChangeAspectRatio: (ratio: AspectRatio) => void;
  primaryAsset: UploadedAssetItem | undefined;
  isUploadingPhoto: boolean;
  onUploadPhoto: (file: File) => Promise<void>;
  onRemovePhoto: () => void;
  fidelityMode: "preserve_original" | "ai_atmosphere";
  onChangeFidelityMode: (mode: "preserve_original" | "ai_atmosphere") => void;
  logoDataUrl: string | null | undefined;
  logoPlacement: "top-left" | "top-right" | "auto" | undefined;
  onChangeLogoPlacement: (placement: "top-left" | "top-right" | "auto") => void;
  onUploadLogo: (file: File) => void;
  onRemoveLogo: () => void;
  autoRemoveWhiteBg: boolean;
  onChangeAutoRemoveWhiteBg: (auto: boolean) => void;
}

const RATIOS: {
  id: AspectRatio;
  label: string;
  name: string;
  badge: string;
  desc: string;
  iconClass: string;
}[] = [
  {
    id: "1:1",
    label: "1:1",
    name: "Square Feed",
    badge: "Instagram & FB",
    desc: "1080 × 1080 px",
    iconClass: "w-5 h-5 rounded-sm border-2 border-current",
  },
  {
    id: "4:5",
    label: "4:5",
    name: "Portrait Feed",
    badge: "Meta Ads Optimal",
    desc: "1080 × 1350 px",
    iconClass: "w-4 h-5 rounded-sm border-2 border-current",
  },
  {
    id: "9:16",
    label: "9:16",
    name: "Story & Reels",
    badge: "Stories & Reels",
    desc: "1080 × 1920 px",
    iconClass: "w-3.5 h-6 rounded-sm border-2 border-current",
  },
];

export function Step1PhotoSection({
  aspectRatio,
  onChangeAspectRatio,
  primaryAsset,
  isUploadingPhoto,
  onUploadPhoto,
  onRemovePhoto,
  fidelityMode,
  onChangeFidelityMode,
  logoDataUrl,
  logoPlacement,
  onChangeLogoPlacement,
  onUploadLogo,
  onRemoveLogo,
  autoRemoveWhiteBg,
  onChangeAutoRemoveWhiteBg,
}: Step1PhotoSectionProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handlePhotoFile = (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("Format file tidak didukung. Harap pilih gambar format JPG, PNG, atau WEBP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Ukuran file terlalu besar (maksimal 10 MB).");
      return;
    }

    onUploadPhoto(file).catch(() => {
      setUploadError("Gagal mengunggah foto. Silakan coba kembali.");
    });
  };

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Harap pilih gambar format PNG, SVG, WEBP, atau JPG.");
      return;
    }
    onUploadLogo(file);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Section Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-extrabold text-xs flex items-center justify-center border border-sky-500/20">
            1
          </span>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Mulai dengan foto properti
          </h4>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed ml-8">
          Upload foto properti yang ingin dijadikan materi iklan. AI akan membantu menyusun komposisi desain berdasarkan foto ini.
        </p>
      </div>

      {/* A. Format Rasio Gambar (3 Options) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
          <span>Pilih Rasio Penempatan Iklan</span>
          <span className="text-[11px] font-normal text-zinc-400">
            Aktif: <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">{aspectRatio}</strong>
          </span>
        </label>

        <div className="grid grid-cols-3 gap-2.5">
          {RATIOS.map((r) => {
            const isSelected = aspectRatio === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onChangeAspectRatio(r.id)}
                className={`relative p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-22 select-none ${
                  isSelected
                    ? "border-sky-500 bg-sky-500/5 dark:bg-sky-500/10 ring-2 ring-sky-500/30 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <div
                    className={`${r.iconClass} ${
                      isSelected ? "text-sky-600 dark:text-sky-400" : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  />
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-sky-500 shadow-xs" />
                  )}
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-xs font-extrabold ${
                        isSelected ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {r.id}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                      {r.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 block truncate">
                    {r.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* B. Upload Foto Utama */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <span>Foto Fasad / Bangunan</span>
            {primaryAsset ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Foto Tersedia ✓
              </span>
            ) : (
              <span className="text-[10px] font-normal text-zinc-400">
                (Sangat Disarankan)
              </span>
            )}
          </label>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            handlePhotoFile(file);
            e.target.value = "";
          }}
        />

        {uploadError && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{uploadError}</span>
          </div>
        )}

        {primaryAsset ? (
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0 bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={primaryAsset.previewUrl}
                  alt="Fasad Properti"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block truncate">
                  {primaryAsset.fileName || "Foto Fasad Properti"}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                  <span>●</span> Arsitektur Bangunan Terkunci Presisi
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  Format aktif: {aspectRatio}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer shadow-2xs"
              >
                Ganti Foto
              </button>
              <button
                type="button"
                onClick={onRemovePhoto}
                disabled={isUploadingPhoto}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Hapus foto"
              >
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => photoInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              handlePhotoFile(file);
            }}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-center gap-3.5 ${
              isDragOver
                ? "border-sky-500 bg-sky-500/10"
                : "border-zinc-300 dark:border-zinc-700 hover:border-sky-500/80 bg-zinc-50/50 dark:bg-zinc-950/30"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
              {isUploadingPhoto ? (
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            <div className="text-center sm:text-left">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {isUploadingPhoto ? "Mengunggah foto properti..." : "Upload foto properti (Fasad / Eksterior)"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Klik untuk memilih file atau seret ke sini • Format JPG, PNG, WEBP (maks. 10MB)
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 italic">
                *Tanpa foto: AI akan merancang arsitektur baru sesuai deskripsi brief.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* C. Perlindungan Foto dan Arsitektur (2 Clear Cards) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
          Perlakuan Foto Properti
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onChangeFidelityMode("preserve_original")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 select-none ${
              fidelityMode === "preserve_original"
                ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-xs"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span className="text-lg shrink-0 mt-0.5">🔒</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 block">
                  Pertahankan Foto Asli
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Presisi 100%
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-1">
                Jaga bentuk bangunan, fasad, warna, material, pintu, jendela, dan detail arsitektur tetap sesuai foto asli.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeFidelityMode("ai_atmosphere")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 select-none ${
              fidelityMode === "ai_atmosphere"
                ? "border-sky-500 bg-sky-500/5 dark:bg-sky-500/10 ring-2 ring-sky-500/30 shadow-xs"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span className="text-lg shrink-0 mt-0.5">✨</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 block">
                  Optimalkan Suasana Foto
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  Lighting AI
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-1">
                AI boleh memperbaiki pencahayaan, langit, atmosfer, dan suasana foto tanpa mengubah karakter arsitektur bangunan.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* D. Upload Logo Developer / Agen (Opsional) */}
      <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-3">
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/webp,image/svg+xml,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            handleLogoFile(file);
            e.target.value = "";
          }}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base shrink-0">🏷️</span>
            <div>
              <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Logo developer / agen (Opsional)
              </h5>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Tambahkan identitas brand pada desain iklan.
              </p>
            </div>
          </div>

          {!logoDataUrl && (
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:border-sky-500 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer shadow-2xs shrink-0"
            >
              + Upload Logo
            </button>
          )}
        </div>

        {logoDataUrl && (
          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-16 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1.5 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={logoDataUrl}
                  alt="Logo Developer"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                  Logo Brand Aktif
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {autoRemoveWhiteBg ? "Background putih dihapus otomatis" : "Format transparan"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={logoPlacement || "auto"}
                onChange={(e) => onChangeLogoPlacement(e.target.value as "top-left" | "top-right" | "auto")}
                className="text-[11px] font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                title="Posisi Logo"
              >
                <option value="auto">Kanan Atas (Aman)</option>
                <option value="top-left">Kiri Atas</option>
                <option value="top-right">Kanan Atas</option>
              </select>

              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Ganti
              </button>
              <button
                type="button"
                onClick={onRemoveLogo}
                className="px-2 py-1 text-xs font-bold rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Hapus logo"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Auto Remove White Background Toggle */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRemoveWhiteBg}
              onChange={(e) => onChangeAutoRemoveWhiteBg(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
            />
            <span className="font-medium">Auto Hapus Background Putih Logo</span>
          </label>
          <span className="text-[10px] text-zinc-400">
            Rekomendasi ON
          </span>
        </div>
      </div>
    </div>
  );
}

