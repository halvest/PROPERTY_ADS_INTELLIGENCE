"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { QualityLabel } from "@/lib/data/types";

interface CRMManualLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CRMManualLeadModal({
  isOpen,
  onClose,
  onSuccess,
}: CRMManualLeadModalProps) {
  const { locale } = useI18n();
  const { addToast } = useToast();

  const [nama, setNama] = useState("");
  const [telepon, setTelepon] = useState("");
  const [domisili, setDomisili] = useState("");
  const [tanggalMasuk, setTanggalMasuk] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [namaIklan, setNamaIklan] = useState("");
  const [tahapFunnel, setTahapFunnel] = useState<FunnelStage>("baru");
  const [qualityLabel, setQualityLabel] = useState<QualityLabel | "">("");
  const [catatan, setCatatan] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setNama("");
    setTelepon("");
    setDomisili("");
    setTanggalMasuk(new Date().toISOString().split("T")[0]);
    setNamaIklan("");
    setTahapFunnel("baru");
    setQualityLabel("");
    setCatatan("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nama.trim()) {
      setError(locale === "id" ? "Nama prospek wajib diisi." : "Prospect name is required.");
      return;
    }

    const cleanPhone = telepon.replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 9) {
      setError(locale === "id" ? "Nomor WhatsApp wajib diisi (minimal 9 digit)." : "WhatsApp phone number is required (min 9 digits).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          telepon: telepon.trim(),
          domisili: domisili.trim() || undefined,
          tanggalMasuk: tanggalMasuk || undefined,
          namaIklan: namaIklan.trim() || undefined,
          tahapFunnel,
          qualityLabel: qualityLabel || null,
          catatan: catatan.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        addToast(
          "success",
          locale === "id" ? "Prospek Berhasil Disimpan" : "Lead Successfully Saved",
          locale === "id"
            ? `${nama.trim()} berhasil ditambahkan ke tahap "${tahapFunnel}".`
            : `${nama.trim()} successfully added to stage "${tahapFunnel}".`
        );
        resetForm();
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(json.error || (locale === "id" ? "Gagal menyimpan prospek." : "Failed to save lead."));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(locale === "id" ? `Terjadi kesalahan jaringan: ${msg}` : `Network error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            {locale === "id" ? "Tambah Prospek Manual (Sales Tahap 1)" : "Add Manual Prospect (Sales Phase 1)"}
          </span>
        </div>
      }
      description={
        locale === "id"
          ? "Input data prospek secara langsung ke CRM HD Creative menggunakan 7 kolom inti."
          : "Directly enter prospect records into HD Creative CRM using the 7 core fields."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 1. Nama Lengkap */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Nama Prospek (Wajib)" : "Prospect Name (Required)"}
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Budi Santoso"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100"
            />
          </div>

          {/* 2. Nomor WhatsApp */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Nomor WhatsApp / HP (Wajib)" : "WhatsApp Phone (Required)"}
            </label>
            <input
              type="tel"
              required
              placeholder="Contoh: 081234567890"
              value={telepon}
              onChange={(e) => setTelepon(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100"
            />
          </div>

          {/* 3. Domisili */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Domisili" : "Domicile / City"}
            </label>
            <input
              type="text"
              placeholder="Contoh: Jakarta Selatan, Bandung, dll."
              value={domisili}
              onChange={(e) => setDomisili(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100"
            />
          </div>

          {/* 4. Tanggal Masuk */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Tanggal Masuk" : "Lead Date"}
            </label>
            <input
              type="date"
              value={tanggalMasuk}
              onChange={(e) => setTanggalMasuk(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100"
            />
          </div>

          {/* 5. Kampanye / Iklan */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Sumber Kampanye / Iklan" : "Campaign / Source Ad"}
            </label>
            <input
              type="text"
              placeholder="Contoh: Cluster Sapphire BSD - Tipe 72 Hook Siap Huni"
              value={namaIklan}
              onChange={(e) => setNamaIklan(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100"
            />
          </div>

          {/* 6. Tahap Funnel */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Tahap Funnel (Wajib)" : "Funnel Stage (Required)"}
            </label>
            <select
              value={tahapFunnel}
              onChange={(e) => setTahapFunnel(e.target.value as FunnelStage)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100 cursor-pointer"
            >
              <option value="baru">{locale === "id" ? "Baru (Kontak Masuk)" : "New"}</option>
              <option value="dihubungi">{locale === "id" ? "Dihubungi (Sudah Dihubungi)" : "Contacted"}</option>
              <option value="prospek">{locale === "id" ? "Prospek (Respon Positif/Tanya Harga)" : "Prospect"}</option>
              <option value="survei">{locale === "id" ? "Survei (Jadwal/Visit Lokasi)" : "Survey / Visit"}</option>
              <option value="closing">{locale === "id" ? "Closing (Booking Fee/Transaksi)" : "Closed / Booking"}</option>
              <option value="batal">{locale === "id" ? "Batal (Tidak Berminat/Gugur)" : "Lost"}</option>
            </select>
          </div>

          {/* 7. Label Kualitas (Hot / Warm / Cold) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Label Kualitas" : "Quality Label"}
              <span className="ml-1 text-[11px] font-normal text-zinc-400">({locale === "id" ? "Opsional" : "Optional"})</span>
            </label>
            <select
              value={qualityLabel}
              onChange={(e) => setQualityLabel(e.target.value as QualityLabel | "")}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100 cursor-pointer"
            >
              <option value="">{locale === "id" ? "Belum Dinilai (Tunda)" : "Not Assessed Yet"}</option>
              <option value="Hot">🔥 Hot ({locale === "id" ? "Sangat Antusias & Siap Beli" : "High Intent"})</option>
              <option value="Warm">☀️ Warm ({locale === "id" ? "Berminat / Masih Pertimbangkan" : "Medium Intent"})</option>
              <option value="Cold">❄️ Cold ({locale === "id" ? "Minat Rendah / Belum Respon" : "Low Intent"})</option>
            </select>
          </div>

          {/* 8. Catatan Singkat */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Catatan Singkat (Opsional)" : "Short Notes (Optional)"}
            </label>
            <textarea
              rows={3}
              placeholder={locale === "id" ? "Kebutuhan unit, budget, jadwal survei, opsi KPR, dll." : "Property needs, budget, schedule, KPR details, etc."}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            {locale === "id" ? "Batal" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>{locale === "id" ? "Menyimpan..." : "Saving..."}</span>
              </>
            ) : (
              <span>{locale === "id" ? "Simpan Prospek" : "Save Lead"}</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
