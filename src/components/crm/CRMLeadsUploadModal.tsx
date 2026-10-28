"use client";

import React, { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import type { ParsedSheetSummary, CrmImportResult } from "@/lib/crm/crm-sheets-service";

interface CRMLeadsUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CRMLeadsUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: CRMLeadsUploadModalProps) {
  const { locale } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<"download" | "upload">("upload");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationSummary, setValidationSummary] = useState<ParsedSheetSummary | null>(null);
  const [importResult, setImportResult] = useState<CrmImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setValidationSummary(null);
    setImportResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileValidation = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setImportResult(null);
    setIsValidating(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/leads/upload?validateOnly=true", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success && json.summary) {
        setValidationSummary(json.summary);
      } else {
        setErrorMessage(json.error || (locale === "id" ? "Gagal memvalidasi file spreadsheet." : "Failed to validate spreadsheet file."));
        setValidationSummary(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMessage(locale === "id" ? `Gagal menghubungi server: ${msg}` : `Server connection error: ${msg}`);
      setValidationSummary(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        void handleFileValidation(file);
      } else {
        setErrorMessage(
          locale === "id"
            ? "Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv."
            : "Unsupported file format. Please upload a .xlsx, .xls, or .csv file."
        );
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      void handleFileValidation(file);
    }
  };

  const handleCommitImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/leads/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success && json.importResult) {
        setImportResult(json.importResult);
        addToast(
          "success",
          locale === "id" ? "Impor Data CRM Berhasil" : "CRM Import Successful",
          locale === "id"
            ? `${json.importResult.insertedCount} prospek baru ditambahkan, ${json.importResult.updatedCount} diperbarui.`
            : `${json.importResult.insertedCount} new leads inserted, ${json.importResult.updatedCount} updated.`
        );
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setErrorMessage(
          json.error ||
            (locale === "id" ? "Gagal menyimpan data prospek ke database." : "Failed to save leads to database.")
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMessage(locale === "id" ? `Gagal menghubungi server: ${msg}` : `Server connection error: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crm-upload-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0c0e14] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 p-5 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h2
                id="crm-upload-modal-title"
                className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                {locale === "id"
                  ? "Unggah & Sinkron Data Prospek CRM (Sheets / Excel)"
                  : "Upload & Sync CRM Leads (Sheets / Excel)"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {locale === "id"
                ? "Solusi alternatif cepat untuk mengupdate database prospek sebelum integrasi WhatsApp otomatis terhubung."
                : "Quick alternative to update prospects and funnel progression before automated WhatsApp connection."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            aria-label="Tutup modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* WhatsApp Coexistence Bridge Notice */}
        <div className="bg-sky-500/10 border-b border-sky-500/20 px-5 py-2.5 flex items-center justify-between text-xs text-sky-800 dark:text-sky-300">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sky-600 dark:text-sky-400 font-bold">ℹ️ Info:</span>
            <span>
              {locale === "id"
                ? "Koneksi WhatsApp API langsung berstatus 'Segera Hadir' (Coming Soon). Impor spreadsheet ini siap digunakan sebagai sumber data aktif."
                : "Direct WhatsApp API is marked 'Coming Soon'. This spreadsheet import serves as your active CRM leads source."}
            </span>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-zinc-200 px-5 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === "upload"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{locale === "id" ? "1. Unggah File (.xlsx / .csv)" : "1. Upload File (.xlsx / .csv)"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("download")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === "download"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{locale === "id" ? "2. Unduh Format Template" : "2. Download Template"}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 flex items-start gap-2.5">
              <svg className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* TAB 1: UPLOAD FILE */}
          {activeTab === "upload" && !importResult && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                  dragActive
                    ? "border-indigo-500 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/20"
                    : "border-zinc-300 hover:border-indigo-400 hover:bg-zinc-50/50 dark:border-zinc-700 dark:hover:border-indigo-500 dark:hover:bg-zinc-800/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>

                <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedFile
                    ? selectedFile.name
                    : locale === "id"
                    ? "Tarik & lepas file spreadsheet di sini, atau klik untuk memilih"
                    : "Drag & drop your spreadsheet file here, or click to browse"}
                </p>

                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB • ${selectedFile.type || "Spreadsheet"}`
                    : locale === "id"
                    ? "Mendukung file Excel (.xlsx, .xls) atau Google Sheets ekspor (.csv)"
                    : "Supports Excel (.xlsx, .xls) or Google Sheets export (.csv)"}
                </p>
              </div>

              {/* Validation Status / Preview */}
              {isValidating && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <svg className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{locale === "id" ? "Memvalidasi kolom dan baris data..." : "Validating columns and rows..."}</span>
                </div>
              )}

              {validationSummary && !isValidating && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {locale === "id" ? "Hasil Verifikasi File:" : "Verification Result:"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400 font-mono">
                        {validationSummary.validRows} {locale === "id" ? "Valid" : "Valid"}
                      </span>
                      {validationSummary.invalidRows > 0 && (
                        <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-rose-600 dark:text-rose-400 font-mono">
                          {validationSummary.invalidRows} {locale === "id" ? "Gagal" : "Errors"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preview Table of Rows */}
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">{locale === "id" ? "Nama" : "Name"}</th>
                          <th className="py-2 px-3">{locale === "id" ? "No. WA / HP" : "Phone"}</th>
                          <th className="py-2 px-3">{locale === "id" ? "Domisili" : "City"}</th>
                          <th className="py-2 px-3">{locale === "id" ? "Tahap" : "Stage"}</th>
                          <th className="py-2 px-3">{locale === "id" ? "Kualitas" : "Quality"}</th>
                          <th className="py-2 px-3">{locale === "id" ? "Iklan" : "Ad"}</th>
                          <th className="py-2 px-3">{locale === "id" ? "Status" : "Status"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {validationSummary.rows.slice(0, 10).map((row) => (
                          <tr key={row.rowIndex} className={row.valid ? "" : "bg-rose-50/50 dark:bg-rose-950/20"}>
                            <td className="py-1.5 px-3 font-mono text-zinc-400">{row.rowIndex}</td>
                            <td className="py-1.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                              {row.data?.nama || "—"}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-zinc-500">
                              {row.data?.phoneMasked || "—"}
                            </td>
                            <td className="py-1.5 px-3 text-zinc-600 dark:text-zinc-300">
                              {row.data?.domisili || "—"}
                            </td>
                            <td className="py-1.5 px-3">
                              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                {row.data?.tahapFunnel || "baru"}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              {row.data?.qualityLabel ? (
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                    row.data.qualityLabel === "Hot"
                                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                      : row.data.qualityLabel === "Warm"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                      : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                                  }`}
                                >
                                  {row.data.qualityLabel}
                                </span>
                              ) : (
                                <span className="text-zinc-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 truncate max-w-[140px] text-zinc-500">
                              {row.data?.namaIklan || "—"}
                            </td>
                            <td className="py-1.5 px-3">
                              {row.valid ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Siap</span>
                              ) : (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold" title={row.errors.join(", ")}>
                                  ✕ {row.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {validationSummary.rows.length > 10 && (
                    <p className="text-[11px] text-zinc-400 text-center">
                      {locale === "id"
                        ? `Menampilkan 10 dari ${validationSummary.rows.length} total baris prospek.`
                        : `Showing 10 of ${validationSummary.rows.length} total prospect rows.`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SUCCESS STATE */}
          {importResult && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {locale === "id" ? "Sinkronisasi Data Prospek Selesai!" : "Prospect Data Synced Successfully!"}
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {locale === "id"
                    ? "Data dari spreadsheet berhasil diproses dan disimpan ke database CRM HD Creative."
                    : "Spreadsheet records have been processed and saved to HD Creative CRM database."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-center">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-[11px] font-medium text-zinc-500">
                    {locale === "id" ? "Prospek Baru" : "New Prospects"}
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {importResult.insertedCount}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-[11px] font-medium text-zinc-500">
                    {locale === "id" ? "Diperbarui" : "Updated"}
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {importResult.updatedCount}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOWNLOAD TEMPLATE */}
          {activeTab === "download" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-50/40 p-4 dark:border-indigo-500/30 dark:bg-indigo-950/20">
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  {locale === "id" ? "Format Spreadsheet CRM HD Creative (Tahap 1 — Sekarang)" : "Official HD Creative CRM Template (Phase 1)"}
                </h4>
                <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
                  {locale === "id"
                    ? "Fokus pada pengisian manual tim sales: Nama & WA, Domisili, Tanggal Masuk, Kampanye/Iklan, Tahap Funnel, Label Kualitas (Hot/Warm/Cold), dan Catatan Singkat. AI scoring otomatis ditunda hingga integrasi WhatsApp aktif."
                    : "Focused on core sales manual entry: Name & WA, Domicile, Lead Date, Campaign/Ad, Funnel Stage, Quality Label (Hot/Warm/Cold), and Short Notes. Automated AI scoring is deferred until WhatsApp integration."}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a
                    href="/api/leads/template?format=xlsx"
                    download="template_crm_leads_hdcreative.xlsx"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{locale === "id" ? "Unduh Format Excel (.xlsx)" : "Download Excel (.xlsx)"}</span>
                  </a>

                  <a
                    href="/api/leads/template?format=csv"
                    download="template_crm_leads_hdcreative.csv"
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{locale === "id" ? "Unduh Format CSV (.csv)" : "Download CSV (.csv)"}</span>
                  </a>
                </div>
              </div>

              {/* Guidelines List */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {locale === "id" ? "7 Kolom Inti Pengisian Manual Sales:" : "7 Core Columns for Sales Manual Entry:"}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">1. Nama Prospek & WhatsApp (Wajib)</span>
                    <p className="text-[11px] mt-0.5">Identitas utama calon pembeli properti.</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">2. Domisili</span>
                    <p className="text-[11px] mt-0.5">Kota / kabupaten domisili tempat tinggal calon pembeli.</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">3. Tanggal Masuk</span>
                    <p className="text-[11px] mt-0.5">Mengukur perkembangan lead sejak kontak pertama.</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">4. Kampanye / Iklan</span>
                    <p className="text-[11px] mt-0.5">Menelusuri asal sumber promosi / iklan Meta.</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">5. Tahap Funnel (Wajib)</span>
                    <p className="text-[11px] mt-0.5">Memantau progres: Baru, Dihubungi, Prospek, Survei, Closing, Batal.</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">6. Label Kualitas (Hot / Warm / Cold)</span>
                    <p className="text-[11px] mt-0.5">Potensi beli (bisa ditunda bila belum cukup info).</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 col-span-1 sm:col-span-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">7. Catatan Singkat</span>
                    <p className="text-[11px] mt-0.5">Opsional, hanya bila ada informasi penting (budget, tipe unit, jadwal survei).</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            {importResult ? (locale === "id" ? "Tutup" : "Close") : (locale === "id" ? "Batal" : "Cancel")}
          </button>

          <div className="flex items-center gap-2">
            {activeTab === "download" && (
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer"
              >
                <span>{locale === "id" ? "Lanjut ke Upload File →" : "Proceed to Upload →"}</span>
              </button>
            )}

            {activeTab === "upload" && !importResult && (
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={!selectedFile || !validationSummary || validationSummary.validRows === 0 || isImporting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>{locale === "id" ? "Mengimpor Data..." : "Importing Data..."}</span>
                  </>
                ) : (
                  <span>
                    {locale === "id"
                      ? `Impor ${validationSummary ? validationSummary.validRows : ""} Prospek ke CRM`
                      : `Import ${validationSummary ? validationSummary.validRows : ""} Prospects to CRM`}
                  </span>
                )}
              </button>
            )}

            {importResult && (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <span>{locale === "id" ? "Selesai & Lihat Prospek" : "Done & View Prospects"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

