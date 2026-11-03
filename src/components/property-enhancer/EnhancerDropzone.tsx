"use client";

import React, { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface EnhancerDropzoneProps {
  onSelectFile: (file: File) => void;
  selectedFile: File | null;
  previewUrl: string | null;
  onClear: () => void;
  isProcessing: boolean;
  imageDimensions?: { width: number; height: number } | null;
}

type ValidationErrorCode = "INVALID_FORMAT" | "FILE_TOO_LARGE" | null;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EnhancerDropzone({
  onSelectFile,
  selectedFile,
  previewUrl,
  onClear,
  isProcessing,
  imageDimensions,
}: EnhancerDropzoneProps) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorCode, setErrorCode] = useState<ValidationErrorCode>(null);

  const errorMsg =
    errorCode === "INVALID_FORMAT"
      ? isEn
        ? "Unsupported file format. Please use JPG, PNG, or WEBP."
        : "Format file tidak didukung. Harap gunakan format JPG, PNG, atau WEBP."
      : errorCode === "FILE_TOO_LARGE"
      ? isEn
        ? "File size exceeds the 15 MB maximum limit."
        : "Ukuran file melebihi batas maksimal 15 MB."
      : null;

  const handleValidateAndSelect = (file: File | undefined) => {
    if (!file) return;
    setErrorCode(null);

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setErrorCode("INVALID_FORMAT");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorCode("FILE_TOO_LARGE");
      return;
    }

    onSelectFile(file);
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          handleValidateAndSelect(file);
          e.target.value = "";
        }}
      />

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs">
          {errorMsg}
        </div>
      )}

      {selectedFile && previewUrl ? (
        /* When Uploaded: Compact horizontal preview card */
        <div className="p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <img
                src={previewUrl}
                alt={isEn ? "Source Photo" : "Foto Sumber"}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                {selectedFile.name}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                {imageDimensions ? (
                  <span>
                    {imageDimensions.width} × {imageDimensions.height} px
                  </span>
                ) : (
                  <span>{formatBytes(selectedFile.size)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isEn ? "Replace" : "Ganti"}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={isProcessing}
              className="p-1 rounded-md text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
              aria-label={isEn ? "Remove image" : "Hapus gambar"}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        /* When Empty: Compact dropzone card */
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            handleValidateAndSelect(file);
          }}
          className={`border border-dashed rounded-xl p-5 text-center transition cursor-pointer select-none flex flex-col items-center justify-center gap-2 ${
            isDragOver
              ? "border-neutral-900 bg-neutral-100 dark:border-white dark:bg-neutral-800"
              : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-900/40"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center justify-center">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 block">
              {isEn ? "Upload photo or 3D render" : "Unggah foto atau render 3D"}
            </span>
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
              {isEn ? "JPG, PNG, WEBP up to 15MB" : "JPG, PNG, WEBP hingga 15MB"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
