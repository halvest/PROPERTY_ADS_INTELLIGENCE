"use client";

import React, { useRef, useState } from "react";
import type { UploadedAssetItem, AssetCategory } from "@/lib/ai/creative-studio/types";

interface AssetUploaderProps {
  assets: UploadedAssetItem[];
  onChange: (assets: UploadedAssetItem[]) => void;
  onUploadError?: (message: string) => void;
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  facade: "Fasad Rumah",
  interior: "Interior",
  living_room: "Ruang Keluarga",
  bedroom: "Kamar Tidur",
  environment: "Lingkungan",
  facility: "Fasilitas",
  logo: "Logo Developer",
  other: "Lainnya",
};

export function AssetUploader({ assets, onChange, onUploadError }: AssetUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setIsUploading(true);
    const newAssets: UploadedAssetItem[] = [...assets];

    for (const file of fileList) {
      if (!file.type.startsWith("image/")) {
        onUploadError?.(`File ${file.name} bukan format gambar yang valid`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        onUploadError?.(`File ${file.name} melebihi batas 10MB`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "facade");

        const res = await fetch("/api/creative-studio/upload", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Gagal upload gambar");
        }

        const uploadedUrl = json.data.url;
        const isFirst = newAssets.length === 0;

        newAssets.push({
          id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          previewUrl: uploadedUrl,
          category: isFirst ? "facade" : "interior",
          isPrimary: isFirst,
          fileName: file.name,
        });
      } catch (err) {
        // Fallback local Object URL if network or storage upload fails
        const localUrl = URL.createObjectURL(file);
        const isFirst = newAssets.length === 0;
        newAssets.push({
          id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          previewUrl: localUrl,
          category: isFirst ? "facade" : "interior",
          isPrimary: isFirst,
          fileName: file.name,
        });
      }
    }

    setIsUploading(false);
    onChange(newAssets);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const setPrimary = (index: number) => {
    const updated = assets.map((a, i) => ({
      ...a,
      isPrimary: i === index,
    }));
    onChange(updated);
  };

  const removeAsset = (index: number) => {
    const updated = assets.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((a) => a.isPrimary)) {
      updated[0].isPrimary = true;
    }
    onChange(updated);
  };

  const updateCategory = (index: number, category: AssetCategory) => {
    const updated = [...assets];
    updated[index] = { ...updated[index], category };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20"
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/60 dark:bg-zinc-900/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
            {isUploading ? (
              <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {isUploading ? "Mengunggah & Memvalidasi Aset..." : "Klik atau seret foto properti ke sini"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Mendukung JPG, PNG, WEBP hingga 10MB per foto.
            </p>
          </div>
        </div>
      </div>

      {/* Architectural Truth Guarantee Note */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5">
        <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <strong className="text-amber-600 dark:text-amber-400">Prinsip Kebenaran Visual:</strong> Foto properti asli adalah sumber utama arsitektur. AI menjaga bentuk fasad asli, jumlah lantai, dan proporsi jendela tetap presisi saat ditingkatkan pencahayaan dan lingkungannya.
        </p>
      </div>

      {/* Uploaded Assets Grid */}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          {assets.map((asset, index) => (
            <div
              key={asset.id}
              className={`relative group rounded-xl overflow-hidden border transition-all ${
                asset.isPrimary
                  ? "border-sky-500 ring-2 ring-sky-500/20 bg-sky-950/10"
                  : "border-zinc-200 dark:border-zinc-800 bg-zinc-900/5"
              }`}
            >
              {/* Preview Image */}
              <div className="aspect-video w-full bg-zinc-900 relative overflow-hidden">
                <img
                  src={asset.previewUrl}
                  alt={asset.fileName || `Asset ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Primary Tag */}
                {asset.isPrimary && (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 text-[10px] font-bold bg-sky-600 text-white rounded-md shadow-sm">
                    ★ Foto Utama (Fasad)
                  </span>
                )}

                {/* Action Buttons Overlay */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1 rounded-lg backdrop-blur-xs">
                  {!asset.isPrimary && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrimary(index);
                      }}
                      title="Jadikan Foto Utama"
                      className="p-1 text-zinc-300 hover:text-amber-400 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAsset(index);
                    }}
                    title="Hapus Foto"
                    className="p-1 text-zinc-300 hover:text-rose-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Category Picker */}
              <div className="p-2 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                <select
                  value={asset.category}
                  onChange={(e) => updateCategory(index, e.target.value as AssetCategory)}
                  className="w-full text-[11px] font-medium bg-transparent border-0 text-zinc-700 dark:text-zinc-300 focus:ring-0 cursor-pointer p-0"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key} className="dark:bg-zinc-900">
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
