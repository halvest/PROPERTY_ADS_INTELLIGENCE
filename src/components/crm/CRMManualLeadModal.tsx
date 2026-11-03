"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { QualityLabel } from "@/lib/data/types";

const todayInJakarta = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

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
  const [tanggalMasuk, setTanggalMasuk] = useState(todayInJakarta);
  const [adId, setAdId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [adSetId, setAdSetId] = useState<string | null>(null);
  const [leadSource, setLeadSource] = useState("");
  const [attributionNote, setAttributionNote] = useState("");
  const [sourceOptions, setSourceOptions] = useState<Array<{ adId: string; campaignId: string; adName: string; campaignName: string; adStatus: string }>>([]);
  const [campaignOptions, setCampaignOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [adSetOptions, setAdSetOptions] = useState<Array<{ providerAdSetId: string; name: string; campaignId: string; adIds: string[] }>>([]);
  const [smartPasteOpen, setSmartPasteOpen] = useState(false);
  const [smartPasteText, setSmartPasteText] = useState("");
  const [keepContext, setKeepContext] = useState(true);
  const [tahapFunnel, setTahapFunnel] = useState<FunnelStage>("baru");
  const [qualityLabel, setQualityLabel] = useState<QualityLabel | "">("");
  const [catatan, setCatatan] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void fetch("/api/leads/sources")
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Gagal memuat sumber iklan.");
        setSourceOptions(json.data?.ads || []);
        setCampaignOptions(json.data?.campaigns || []);
        setAdSetOptions(json.data?.adSets || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat sumber iklan."));
  }, [isOpen]);

  const resetForm = () => {
    setNama("");
    setTelepon("");
    setDomisili("");
    setTanggalMasuk(todayInJakarta());
    setAdId(null);
    setCampaignId(null);
    setAdSetId(null);
    setLeadSource("");
    setAttributionNote("");
    setSmartPasteOpen(false);
    setSmartPasteText("");
    setKeepContext(true);
    setTahapFunnel("baru");
    setQualityLabel("");
    setCatatan("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const parseSmartPaste = () => {
    const text = smartPasteText.trim();
    if (!text) return;
    const phoneMatch = text.match(/(?:\+?62|0)(?:[\s().-]*\d){8,13}/);
    if (!phoneMatch) {
      setError(locale === "id" ? "Nomor WhatsApp tidak ditemukan. Gunakan nomor 08…, 62…, atau +62…." : "No phone number found. Use 08…, 62…, or +62…." );
      return;
    }
    const beforePhone = text.slice(0, phoneMatch.index || 0).replace(/[\s\-|,;:]+$/g, "").trim();
    const afterPhone = text.slice((phoneMatch.index || 0) + phoneMatch[0].length).replace(/^[\s\-|,;:]+/g, "").trim();
    const chunks = afterPhone.split(/\s+[|,;]\s+|\s+-\s+|\n+/).map((part) => part.trim()).filter(Boolean);
    const notesWords = /\b(tanya|minat|rumah|tipe|kpr|budget|survei|survey|unit|harga|butuh|ingin|cicil|cluster|booking|mencari|jadwal)\b/i;
    let domicile = "";
    let notes = afterPhone;
    if (chunks.length > 1 || (chunks[0] && chunks[0].length <= 40 && !notesWords.test(chunks[0]))) {
      domicile = chunks[0] || "";
      notes = chunks.slice(1).join(" · ");
    }
    if (beforePhone) setNama(beforePhone.replace(/^[\s\-|,;:]+|[\s\-|,;:]+$/g, ""));
    setTelepon(phoneMatch[0].trim());
    if (domicile) setDomisili(domicile);
    if (notes) setCatatan(notes);
    setSmartPasteOpen(false);
    setSmartPasteText("");
    setError(null);
    nameInputRef.current?.focus();
  };

  const submitLead = async (keepOpen: boolean) => {
    if (isSubmitting) return;
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
          adId: adId || undefined,
          campaignId: campaignId || undefined,
          adSetId: adSetId || undefined,
          leadSource: leadSource || undefined,
          attributionNote: attributionNote.trim() || undefined,
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
        if (keepOpen) {
          setNama("");
          setTelepon("");
          setCatatan("");
          if (!keepContext) {
            setDomisili("");
            setTanggalMasuk(todayInJakarta());
            setAdId(null);
            setCampaignId(null);
            setAdSetId(null);
            setLeadSource("");
            setAttributionNote("");
            setTahapFunnel("baru");
            setQualityLabel("");
          }
          setTimeout(() => nameInputRef.current?.focus(), 0);
        } else {
          resetForm();
          onClose();
        }
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitLead(true);
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

        <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <button type="button" onClick={() => setSmartPasteOpen((open) => !open)} className="inline-flex items-center gap-1.5 text-left text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer">
            <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>{locale === "id" ? "Tempel Cepat Format Chat / WhatsApp (Otomatis Isi Kolom)" : "Smart Paste Chat / WhatsApp (Auto-Fill)"}</span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">{smartPasteOpen ? "▲" : "▼"}</span>
          </button>
          {smartPasteOpen && <div className="mt-2 space-y-2">
            <textarea rows={2} value={smartPasteText} onChange={(event) => setSmartPasteText(event.target.value)} placeholder="Budi Santoso - 081234567890 - Sleman - Tanya rumah tipe 45 KPR" className="w-full rounded-lg border border-amber-200 bg-white p-2 text-xs text-zinc-900 dark:border-amber-900 dark:bg-zinc-900 dark:text-zinc-100" />
            <button type="button" onClick={parseSmartPaste} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">{locale === "id" ? "Isi Kolom Otomatis" : "Parse and Fill"}</button>
          </div>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 1. Nama Lengkap */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {locale === "id" ? "Nama Prospek (Wajib)" : "Prospect Name (Required)"}
            </label>
            <input
              type="text"
              ref={nameInputRef}
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

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{locale === "id" ? "Kampanye (opsional)" : "Campaign (optional)"}</label>
            <select value={campaignId || ""} onChange={(event) => { setCampaignId(event.target.value || null); setAdSetId(null); setAdId(null); }} className="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100">
              <option value="">{locale === "id" ? "Sumber belum diketahui" : "Source unknown"}</option>
              {campaignOptions.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{locale === "id" ? "Ad set (opsional)" : "Ad set (optional)"}</label>
            <select value={adSetId || ""} onChange={(event) => { setAdSetId(event.target.value || null); setAdId(null); }} className="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100">
              <option value="">{locale === "id" ? "Tidak dipilih" : "Not selected"}</option>
              {adSetOptions.filter((adSet) => !campaignId || adSet.campaignId === campaignId).map((adSet) => <option key={adSet.providerAdSetId} value={adSet.providerAdSetId}>{adSet.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{locale === "id" ? "Iklan (opsional)" : "Ad (optional)"}</label>
            <select value={adId || ""} onChange={(event) => setAdId(event.target.value || null)} className="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100">
              <option value="">{locale === "id" ? "Tidak dipilih" : "Not selected"}</option>
              {sourceOptions.filter((source) => {
                if (campaignId && source.campaignId !== campaignId) return false;
                const selectedSet = adSetOptions.find((adSet) => adSet.providerAdSetId === adSetId);
                return !selectedSet || selectedSet.adIds.includes(source.adId);
              }).map((source) => <option key={source.adId} value={source.adId}>{source.adName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{locale === "id" ? "Sumber prospek" : "Lead source"}</label>
            <select value={leadSource} onChange={(event) => setLeadSource(event.target.value)} className="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100">
              <option value="">{locale === "id" ? "Belum diketahui" : "Unknown"}</option>
              <option value="Iklan Meta">Meta Ads</option>
              <option value="Organik">Organik</option>
              <option value="Referral">Referral</option>
              <option value="Lainnya">{locale === "id" ? "Lainnya" : "Other"}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{locale === "id" ? "Catatan atribusi" : "Attribution note"}</label>
            <input type="text" value={attributionNote} onChange={(event) => setAttributionNote(event.target.value)} placeholder={locale === "id" ? "Opsional. Contoh: prospek dari grup kampanye, iklan pastinya belum diketahui." : "Optional."} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-100" />
            <p className="mt-1 text-[10px] text-zinc-400">{locale === "id" ? "Kosongkan jika sumber iklan tidak diketahui. Memilih kampanye saja tidak menghubungkan prospek ke satu iklan." : "Leave blank when the ad source is unknown. A campaign selection does not attach the prospect to one ad."}</p>
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
              <option value="Hot">Hot ({locale === "id" ? "Sangat Antusias & Siap Beli" : "High Intent"})</option>
              <option value="Warm">Warm ({locale === "id" ? "Berminat / Masih Pertimbangkan" : "Medium Intent"})</option>
              <option value="Cold">Cold ({locale === "id" ? "Minat Rendah / Belum Respon" : "Low Intent"})</option>
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

        <label className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
          <input type="checkbox" checked={keepContext} onChange={(event) => setKeepContext(event.target.checked)} className="mt-0.5 accent-indigo-600" />
          <span>{locale === "id" ? "Pertahankan Sumber Iklan & Tanggal untuk input berikutnya" : "Keep Ad Source & Date for the next entry"}</span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            {locale === "id" ? "Batal" : "Cancel"}
          </button>
          <button type="button" disabled={isSubmitting} onClick={() => void submitLead(false)} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {locale === "id" ? "Simpan & Tutup" : "Save & Close"}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-solar inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
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
              <span>{locale === "id" ? "Simpan & Tambah Lagi" : "Save & Add Another"}</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
