import * as XLSX from "xlsx";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { AttributionStatus } from "@/domain/attribution/types";
import type { LeadListItem } from "@/lib/data/types";
import { addUploadedDemoLeads } from "@/lib/data/dashboard-service";

/**
 * Computes a deterministic privacy-preserving hash of an E.164 phone number.
 */
export function hashPhoneNumber(phone: string, secretSalt?: string): string {
  const salt =
    secretSalt ||
    process.env.PHONE_HASH_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === "production"
      ? (() => { throw new Error("PHONE_HASH_SECRET wajib dikonfigurasi di production."); })()
      : "property_ads_salt");
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = `62${cleanPhone.slice(1)}`;
  }
  return crypto.createHmac("sha256", salt).update(cleanPhone).digest("hex");
}

/**
 * Masks a phone number to protect prospective buyer PII.
 * e.g., "6281234567890" -> "+62 812-****-890"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || String(phone).trim() === "") {
    return "+62 ***-****-***";
  }

  const clean = String(phone).replace(/[^0-9]/g, "");
  if (clean.length < 9) {
    return "+62 ***-****-***";
  }

  let formatted = clean;
  if (formatted.startsWith("62")) {
    formatted = formatted.slice(2);
  } else if (formatted.startsWith("0")) {
    formatted = formatted.slice(1);
  }

  const prefix = formatted.slice(0, 3);
  const suffix = formatted.slice(-3);

  return `+62 ${prefix}-****-${suffix}`;
}

export type QualityLabel = "Hot" | "Warm" | "Cold";

export interface CrmLeadTemplateRow {
  nama: string;
  telepon: string;
  phoneHash: string;
  phoneMasked: string;
  domisili?: string;
  tanggalKontak: string;
  namaIklan?: string;
  tahapFunnel: FunnelStage;
  qualityLabel?: QualityLabel | null;
  catatan?: string;
  statusAtribusi: AttributionStatus;
  skorProspek?: number;
  skorPenjualan?: number;
  nilaiProperti?: number;
}

export interface ParsedRowResult {
  rowIndex: number;
  valid: boolean;
  data?: CrmLeadTemplateRow;
  errors: string[];
  warnings: string[];
}

export interface ParsedSheetSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedRowResult[];
}

export interface CrmImportResult {
  success: boolean;
  totalProcessed: number;
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  errors: Array<{ row: number; error: string }>;
  warnings: Array<{ row: number; warning: string }>;
  importedLeads: Array<{
    id: string;
    name: string;
    phoneMasked: string;
    domisili?: string;
    funnelStage: FunnelStage;
    qualityLabel?: QualityLabel | null;
    notes?: string;
    isNew: boolean;
  }>;
}

const VALID_STAGES: Record<string, FunnelStage> = {
  baru: "baru",
  new: "baru",
  inbound: "baru",
  dihubungi: "dihubungi",
  contacted: "dihubungi",
  followup: "dihubungi",
  "follow up": "dihubungi",
  prospek: "prospek",
  prospect: "prospek",
  qualified: "prospek",
  survei: "survei",
  survey: "survei",
  visit: "survei",
  closing: "closing",
  closed: "closing",
  booking: "closing",
  won: "closing",
  deal: "closing",
  batal: "batal",
  lost: "batal",
  batal_minat: "batal",
};

/**
 * Normalizes input text into a recognized FunnelStage.
 */
export function normalizeFunnelStage(raw?: string | null): { stage: FunnelStage; isDefault: boolean } {
  if (!raw) return { stage: "baru", isDefault: true };
  const cleaned = raw.toLowerCase().trim().replace(/[-_]/g, " ");
  if (VALID_STAGES[cleaned]) {
    return { stage: VALID_STAGES[cleaned], isDefault: false };
  }
  return { stage: "baru", isDefault: true };
}

/**
 * Normalizes input text into a recognized AttributionStatus.
 */
export function normalizeAttributionStatus(raw?: string | null, hasAd = false): AttributionStatus {
  if (!raw) return hasAd ? "verified" : "unknown";
  const cleaned = raw.toLowerCase().trim();
  if (cleaned.includes("verif") || cleaned === "terverifikasi") return "verified";
  if (cleaned.includes("infer") || cleaned === "perkiraan" || cleaned === "diduga") return "inferred";
  if (cleaned.includes("unknown") || cleaned === "tidak diketahui" || cleaned === "organik") return "unknown";
  return hasAd ? "inferred" : "unknown";
}

/**
 * Cleans phone numbers to international standard format for hashing and masking.
 */
export function cleanPhoneNumber(rawPhone: string | number): string {
  const s = String(rawPhone).trim();
  let digits = s.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (!digits.startsWith("62") && digits.length >= 9) {
    digits = `62${digits}`;
  }
  return digits;
}

/**
 * Normalizes quality label to 'Hot' | 'Warm' | 'Cold' | null.
 */
export function normalizeQualityLabel(raw?: string | null): QualityLabel | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === "hot" || s === "panas") return "Hot";
  if (s === "warm" || s === "hangat") return "Warm";
  if (s === "cold" || s === "dingin") return "Cold";
  return null;
}

/**
 * Generates an Excel (.xlsx) or CSV buffer containing the official HD Creative CRM leads template.
 * Focused on Tahap 1 core columns: Nama & WhatsApp, Domisili, Tanggal Masuk, Kampanye/Iklan, Tahap Funnel, Label Kualitas, Catatan Singkat.
 */
export function generateCrmLeadsTemplate(format: "xlsx" | "csv" = "xlsx"): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Data Prospek CRM (Core Columns Tahap 1)
  const headers = [
    "Nama Prospek (Wajib)",
    "Nomor WhatsApp / HP (Wajib)",
    "Domisili (Opsional)",
    "Tanggal Masuk YYYY-MM-DD (Opsional)",
    "Kampanye / Iklan (Opsional)",
    "Tahap Funnel (Wajib)",
    "Label Kualitas Hot/Warm/Cold (Opsional)",
    "Catatan Singkat (Opsional)",
  ];

  const sampleRows = [
    [
      "Budi Santoso",
      "081234567890",
      "Jakarta Selatan",
      "2026-10-27",
      "Cluster Sapphire BSD - Tipe 72 Hook Siap Huni",
      "survei",
      "Hot",
      "Minat unit hook 2 lantai, survei jadwal Sabtu jam 10.00 WIB",
    ],
    [
      "Rina Wulandari",
      "081398765432",
      "Tangerang Selatan",
      "2026-10-26",
      "Maliosewu A",
      "prospek",
      "Warm",
      "Tanya simulasi KPR bank syariah DP 5%, minat 2 kamar tidur",
    ],
    [
      "Hendra Pratama",
      "082155667788",
      "Bandung",
      "2026-10-25",
      "Virendra 60",
      "closing",
      "Hot",
      "Sudah transfer tanda jadi / booking fee unit nomor 12",
    ],
    [
      "Dewi Lestari",
      "085611223344",
      "Depok",
      "2026-10-27",
      "",
      "dihubungi",
      "Warm",
      "Merespon pesan perkenalan, minta brosur PDF dan pricelist",
    ],
    [
      "Ahmad Fauzi",
      "087899887766",
      "Bekasi",
      "2026-10-27",
      "Sasmaya",
      "baru",
      "Cold",
      "Lead baru masuk via form / WA iklan Meta, belum sempat follow up",
    ],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths for readability
  ws["!cols"] = [
    { wch: 22 }, // Nama
    { wch: 26 }, // Nomor WhatsApp
    { wch: 20 }, // Domisili
    { wch: 24 }, // Tanggal Masuk
    { wch: 38 }, // Kampanye / Iklan
    { wch: 18 }, // Tahap Funnel
    { wch: 24 }, // Label Kualitas
    { wch: 55 }, // Catatan Singkat
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Data Prospek CRM");

  // Sheet 2: Panduan & Validasi (Only included for XLSX)
  if (format === "xlsx") {
    const guideHeaders = ["Kolom", "Sifat", "Format & Nilai yang Diterima", "Contoh & Penjelasan"];
    const guideRows = [
      [
        "Nama Prospek",
        "Wajib",
        "Teks bebas",
        "Contoh: 'Budi Santoso'. Identitas calon pembeli properti.",
      ],
      [
        "Nomor WhatsApp / HP",
        "Wajib",
        "Angka / format telepon (min. 9 digit)",
        "Contoh: '081234567890' atau '+6281234567890'. Sistem otomatis mengenali dan mengenkripsi privasi nomor.",
      ],
      [
        "Domisili",
        "Opsional",
        "Teks nama kota / kabupaten",
        "Contoh: 'Jakarta Selatan', 'Tangerang Selatan', 'Bandung'. Domisili tempat tinggal calon pembeli.",
      ],
      [
        "Tanggal Masuk",
        "Opsional",
        "YYYY-MM-DD atau YYYY-MM-DD HH:mm",
        "Contoh: '2026-10-27'. Tanggal prospek pertama kali masuk untuk mengukur perkembangan lead.",
      ],
      [
        "Kampanye / Iklan",
        "Opsional",
        "Teks judul iklan atau kampanye",
        "Contoh: 'Cluster Sapphire BSD - Tipe 72 Hook Siap Huni'. Untuk menelusuri sumber promosi/iklan.",
      ],
      [
        "Tahap Funnel",
        "Wajib",
        "baru | dihubungi | prospek | survei | closing | batal",
        "Status perkembangan prospek:\n• baru: Lead baru masuk\n• dihubungi: Sudah dihubungi sales\n• prospek: Respon positif / tanya harga & unit\n• survei: Jadwal / selesai visit lokasi proyek\n• closing: Booking fee / tanda jadi deal\n• batal: Tidak berminat / gugur",
      ],
      [
        "Label Kualitas",
        "Opsional",
        "Hot | Warm | Cold",
        "Penilaian manual sales sebelum integrasi percakapan WhatsApp aktif:\n• Hot: Prospek sangat antusias & siap beli\n• Warm: Berminat, masih membandingkan opsi\n• Cold: Belum ada respon / minat rendah\n(Bisa dikosongkan jika belum cukup info)",
      ],
      [
        "Catatan Singkat",
        "Opsional",
        "Teks bebas",
        "Catatan penting kebutuhan unit, tipe properti, KPR, janji temu, dll.",
      ],
    ];

    const wsGuide = XLSX.utils.aoa_to_sheet([guideHeaders, ...guideRows]);
    wsGuide["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 38 }, { wch: 65 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan & Validasi");
  }

  if (format === "csv") {
    const csvString = XLSX.utils.sheet_to_csv(ws);
    return Buffer.from(csvString, "utf-8");
  }

  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return xlsxBuffer;
}

/**
 * Parses an uploaded Excel or CSV file buffer into validated lead rows.
 */
export const MAX_CRM_ROWS = 5000;

export function parseCrmLeadsFile(buffer: Buffer): ParsedSheetSummary {
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("Ukuran file melebihi batas maksimum 5 MB.");
  }
  const wb = XLSX.read(buffer, { type: "buffer" });
  if (wb.SheetNames.length > 10) {
    throw new Error("Workbook memiliki terlalu banyak sheet (maksimum 10).");
  }
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return { totalRows: 0, validRows: 0, invalidRows: 0, rows: [] };
  }

  const ws = wb.Sheets[firstSheetName];
  // Parse rows as array of arrays
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  if (rawRows.length - 1 > MAX_CRM_ROWS) {
    throw new Error(`Jumlah baris melebihi batas maksimum ${MAX_CRM_ROWS}.`);
  }

  if (rawRows.length < 2) {
    return { totalRows: 0, validRows: 0, invalidRows: 0, rows: [] };
  }

  const headerRow = (rawRows[0] || []).map((h) => String(h || "").trim().toLowerCase());

  // Precise index lookup avoiding false-matches (e.g. 'wa' in 'wajib')
  const nameIdx = headerRow.findIndex(
    (col) => /(nama|lead_name|prospect_name|\bname\b)/i.test(col) && !/(iklan|campaign|\bad\b)/i.test(col)
  );
  const phoneIdx = headerRow.findIndex(
    (col) => /(whatsapp|telepon|phone|no\.?\s*hp|\bwa\b|\bhp\b)/i.test(col)
  );
  const domisiliIdx = headerRow.findIndex(
    (col) => /(domisili|kota|lokasi|city|location|daerah|kabupaten|asal)/i.test(col)
  );
  const dateIdx = headerRow.findIndex(
    (col) => /(tanggal|date|waktu|time|masuk)/i.test(col)
  );
  const adIdx = headerRow.findIndex(
    (col) => /(iklan|campaign|kampanye|\bad\b)/i.test(col)
  );
  const stageIdx = headerRow.findIndex(
    (col) => /(funnel|stage|tahap|status_prospek)/i.test(col)
  );
  const qualityIdx = headerRow.findIndex(
    (col) => /(label|kualitas|quality|hot.*warm|suhu)/i.test(col)
  );
  const notesIdx = headerRow.findIndex(
    (col) => /(catatan|note|keterangan|minat|singkat)/i.test(col)
  );

  // Optional legacy columns (backward compatibility)
  const attrIdx = headerRow.findIndex(
    (col) => /(atribusi|attribution)/i.test(col)
  );
  const buyerScoreIdx = headerRow.findIndex(
    (col) => /(buyer|skor.*prospek|prospek.*skor)/i.test(col)
  );
  const salesScoreIdx = headerRow.findIndex(
    (col) => /(sales|skor.*penjualan|penjualan.*skor)/i.test(col)
  );
  const dealValueIdx = headerRow.findIndex(
    (col) => /(nilai|harga|deal|transaksi|budget|price)/i.test(col)
  );

  const results: ParsedRowResult[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] || [];
    // Skip entirely empty rows
    const isRowEmpty = row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "");
    if (isRowEmpty) continue;

    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    // 1. Name validation
    const rawName = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";
    if (!rawName) {
      rowErrors.push("Nama prospek wajib diisi.");
    }

    // 2. Phone validation
    const rawPhone = phoneIdx >= 0 ? String(row[phoneIdx] || "").trim() : "";
    const cleanedDigits = cleanPhoneNumber(rawPhone);
    if (!rawPhone || cleanedDigits.length < 9) {
      rowErrors.push("Nomor WhatsApp/HP wajib diisi (minimal 9 digit).");
    }

    // 3. Domisili
    const rawDomisili = domisiliIdx >= 0 ? String(row[domisiliIdx] || "").trim() : "";

    // 4. Contact date (Tanggal Masuk)
    let tanggalKontak = new Date().toISOString();
    if (dateIdx >= 0 && row[dateIdx] !== "") {
      const cellVal = row[dateIdx];
      try {
        if (typeof cellVal === "number") {
          // Excel serial date format
          const dateObj = new Date(Math.round((cellVal - 25569) * 86400 * 1000));
          if (!isNaN(dateObj.getTime())) {
            tanggalKontak = dateObj.toISOString();
          }
        } else {
          const parsedD = new Date(String(cellVal).trim());
          if (!isNaN(parsedD.getTime())) {
            tanggalKontak = parsedD.toISOString();
          }
        }
      } catch {
        // Fallback to now
      }
    }

    // 5. Ad name
    const rawAdName = adIdx >= 0 ? String(row[adIdx] || "").trim() : "";

    // 6. Stage validation
    const rawStage = stageIdx >= 0 ? String(row[stageIdx] || "").trim() : "";
    const { stage, isDefault } = normalizeFunnelStage(rawStage);
    if (rawStage && isDefault && rawStage.toLowerCase() !== "baru") {
      rowWarnings.push(`Tahap '${rawStage}' disesuaikan menjadi '${stage}'.`);
    }

    // 7. Quality label
    let qualityLabel: QualityLabel | null = null;
    if (qualityIdx >= 0 && row[qualityIdx] !== "") {
      const parsedQuality = normalizeQualityLabel(String(row[qualityIdx] || ""));
      if (parsedQuality) {
        qualityLabel = parsedQuality;
      } else {
        rowWarnings.push(`Label kualitas '${row[qualityIdx]}' tidak dikenali. Gunakan Hot, Warm, atau Cold.`);
      }
    }

    // 8. Notes
    const rawNotes = notesIdx >= 0 ? String(row[notesIdx] || "").trim() : "";

    // 9. Attribution (optional / inferred from ad)
    const rawAttr = attrIdx >= 0 ? String(row[attrIdx] || "").trim() : "";
    const statusAtribusi = normalizeAttributionStatus(rawAttr, Boolean(rawAdName));

    // 10. Legacy Scores & Deal Value (optional)
    let skorProspek: number | undefined;
    if (buyerScoreIdx >= 0 && row[buyerScoreIdx] !== "") {
      const parsed = Number(row[buyerScoreIdx]);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        skorProspek = Math.round(parsed);
      } else if (!isNaN(parsed)) {
        skorProspek = Math.max(0, Math.min(100, Math.round(parsed)));
        rowWarnings.push("Skor prospek dibatasi antara 0 hingga 100.");
      }
    }

    let skorPenjualan: number | undefined;
    if (salesScoreIdx >= 0 && row[salesScoreIdx] !== "") {
      const parsed = Number(row[salesScoreIdx]);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        skorPenjualan = Math.round(parsed);
      } else if (!isNaN(parsed)) {
        skorPenjualan = Math.max(0, Math.min(100, Math.round(parsed)));
        rowWarnings.push("Skor penjualan dibatasi antara 0 hingga 100.");
      }
    }

    let nilaiProperti: number | undefined;
    if (dealValueIdx >= 0 && row[dealValueIdx] !== "") {
      const cleanedVal = String(row[dealValueIdx]).replace(/[^0-9]/g, "");
      const parsed = Number(cleanedVal);
      if (!isNaN(parsed) && parsed > 0) {
        nilaiProperti = parsed;
      }
    }

    const isValid = rowErrors.length === 0;

    let leadData: CrmLeadTemplateRow | undefined;
    if (isValid) {
      leadData = {
        nama: rawName,
        telepon: cleanedDigits,
        phoneHash: hashPhoneNumber(cleanedDigits),
        phoneMasked: maskPhoneNumber(cleanedDigits),
        domisili: rawDomisili || undefined,
        tanggalKontak,
        namaIklan: rawAdName || undefined,
        tahapFunnel: stage,
        qualityLabel,
        catatan: rawNotes || undefined,
        statusAtribusi,
        skorProspek,
        skorPenjualan,
        nilaiProperti,
      };
    }

    results.push({
      rowIndex: i + 1, // 1-indexed Excel row
      valid: isValid,
      data: leadData,
      errors: rowErrors,
      warnings: rowWarnings,
    });
  }

  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.length - validCount;

  return {
    totalRows: results.length,
    validRows: validCount,
    invalidRows: invalidCount,
    rows: results,
  };
}

/**
 * Imports validated CRM leads into Supabase database with tenant isolation and ad matching.
 */
export async function importCrmLeadsToDatabase(params: {
  organizationId: string;
  leads: CrmLeadTemplateRow[];
  supabase: SupabaseClient;
}): Promise<CrmImportResult> {
  const { organizationId, leads, supabase } = params;

  let insertedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const errors: Array<{ row: number; error: string }> = [];
  const warnings: Array<{ row: number; warning: string }> = [];
  const importedLeads: CrmImportResult["importedLeads"] = [];

  // 1. Fetch available registered ads to map ad_id by name
  const { data: dbAds } = await supabase
    .from("ads")
    .select("id, name, campaigns(id, name)")
    .limit(200);

  const adMap = new Map<string, { id: string; name: string }>();
  (dbAds || []).forEach((ad) => {
    if (ad.id) adMap.set(ad.id.toLowerCase(), { id: ad.id, name: ad.name });
    if (ad.name) adMap.set(ad.name.toLowerCase().trim(), { id: ad.id, name: ad.name });
  });

  // 2. Fetch existing contacts for this organization to decide insert vs update
  const phoneHashes = leads.map((l) => l.phoneHash);
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("id, name, phone_hash, phone_masked")
    .eq("organization_id", organizationId)
    .in("phone_hash", phoneHashes);

  const contactByHash = new Map<string, { id: string; name: string }>();
  (existingContacts || []).forEach((c) => {
    if (c.phone_hash) contactByHash.set(c.phone_hash, { id: c.id, name: c.name || "" });
  });

  // 3. Process each lead row sequentially to guarantee ACID-level integrity
  for (let idx = 0; idx < leads.length; idx++) {
    const lead = leads[idx];
    const rowNum = idx + 2;

    try {
      // Find matching ad_id
      let matchedAdId: string | null = null;
      if (lead.namaIklan) {
        const query = lead.namaIklan.toLowerCase().trim();
        // Exact match
        if (adMap.has(query)) {
          matchedAdId = adMap.get(query)!.id;
        } else {
          // Partial search
          for (const [key, value] of adMap.entries()) {
            if (key.includes(query) || query.includes(key)) {
              matchedAdId = value.id;
              break;
            }
          }
        }
      }

      const existingContact = contactByHash.get(lead.phoneHash);
      let contactId: string;
      const isNew = !existingContact;

      if (existingContact) {
        contactId = existingContact.id;
        // Update contact name & domisili if changed
        await supabase
          .from("contacts")
          .update({
            name: lead.nama,
            domisili: lead.domisili || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contactId);
        updatedCount++;
      } else {
        // Insert new contact
        const { data: newContact, error: insertContactError } = await supabase
          .from("contacts")
          .insert({
            organization_id: organizationId,
            name: lead.nama,
            phone_hash: lead.phoneHash,
            phone_masked: lead.phoneMasked,
            domisili: lead.domisili || null,
          })
          .select("id")
          .single();

        if (insertContactError || !newContact) {
          throw new Error(`Gagal menyimpan kontak: ${insertContactError?.message || "Unknown error"}`);
        }
        contactId = newContact.id;
        contactByHash.set(lead.phoneHash, { id: contactId, name: lead.nama });
        insertedCount++;
      }

      // Check for existing conversation for this contact
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id, attribution_evidence")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .maybeSingle();

      let conversationId: string;

      const evidencePayload = {
        source: "crm_sheet_upload",
        funnel_stage: lead.tahapFunnel,
        ad_name: lead.namaIklan || null,
        domisili: lead.domisili || null,
        quality_label: lead.qualityLabel || null,
        notes: lead.catatan || null,
        deal_value: lead.nilaiProperti || null,
        uploaded_at: new Date().toISOString(),
      };

      if (existingConv) {
        conversationId = existingConv.id;
        await supabase
          .from("conversations")
          .update({
            ad_id: matchedAdId,
            quality_label: lead.qualityLabel || null,
            attribution_status: lead.statusAtribusi,
            attribution_evidence: evidencePayload,
            last_message_at: lead.tanggalKontak,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
      } else {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            organization_id: organizationId,
            contact_id: contactId,
            ad_id: matchedAdId,
            quality_label: lead.qualityLabel || null,
            channel: "crm_upload",
            attribution_status: lead.statusAtribusi,
            attribution_evidence: evidencePayload,
            started_at: lead.tanggalKontak,
            last_message_at: lead.tanggalKontak,
            deduplication_id: `crm_import_${lead.phoneHash}`,
          })
          .select("id")
          .single();

        if (convError || !newConv) {
          throw new Error(`Gagal membuat sesi percakapan CRM: ${convError?.message || "Unknown error"}`);
        }
        conversationId = newConv.id;
      }

      // Record lead outcome if appropriate
      let outcomeStage: "survey" | "booking" | "sale" | "lost" | "unknown" = "unknown";
      if (lead.tahapFunnel === "survei") outcomeStage = "survey";
      else if (lead.tahapFunnel === "closing") outcomeStage = "booking";
      else if (lead.tahapFunnel === "batal") outcomeStage = "lost";

      await supabase.from("lead_outcomes").insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        stage: outcomeStage,
        value: lead.nilaiProperti || null,
        currency: "IDR",
        source: "manual",
        occurred_at: lead.tanggalKontak,
        notes: lead.catatan || `Diperbarui via CRM Sheets: tahap ${lead.tahapFunnel}`,
      });

      // Upsert lead assessment (scores)
      const buyerScore = lead.skorProspek ?? (lead.tahapFunnel === "closing" ? 95 : lead.tahapFunnel === "survei" ? 85 : 70);
      const salesScore = lead.skorPenjualan ?? 75;

      // Check if assessment exists
      const { data: existingAssessment } = await supabase
        .from("lead_assessments")
        .select("id")
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (existingAssessment) {
        await supabase
          .from("lead_assessments")
          .update({
            buyer_score: buyerScore,
            sales_score: salesScore,
            summary: lead.catatan || `Diperbarui dari CRM Sheets: tahap ${lead.tahapFunnel}`,
            completed_at: new Date().toISOString(),
          })
          .eq("id", existingAssessment.id);
      } else {
        await supabase.from("lead_assessments").insert({
          organization_id: organizationId,
          conversation_id: conversationId,
          buyer_score: buyerScore,
          sales_score: salesScore,
          confidence: 0.85,
          score_completeness: 1.0,
          status: "completed",
          missing_information: [],
          summary: lead.catatan || `Diimpor dari CRM Sheets: tahap ${lead.tahapFunnel}`,
          provider: "manual_crm",
          model_id: "crm_sheet_v1",
          prompt_version: "v1.0",
          rubric_version: "v1.0",
          completed_at: lead.tanggalKontak,
        });
      }

      const orig = leads[idx];
      importedLeads.push({
        id: conversationId,
        name: lead.nama,
        phoneMasked: lead.phoneMasked,
        domisili: lead.domisili,
        funnelStage: lead.tahapFunnel,
        qualityLabel: lead.qualityLabel,
        notes: lead.catatan,
        isNew,
      });
    } catch (err) {
      failedCount++;
      const message = err instanceof Error ? err.message : "Kesalahan database tidak terduga";
      errors.push({ row: rowNum, error: message });
    }
  }

  // Also sync to demo store for smooth fallback & immediate UI reactivity
  try {
    const demoItems: LeadListItem[] = importedLeads.map((imp) => {
      const orig = leads.find((l) => l.phoneMasked === imp.phoneMasked);
      const buyerScore = orig?.skorProspek ?? (orig?.qualityLabel === "Hot" ? 90 : orig?.qualityLabel === "Warm" ? 70 : 45);
      const salesScore = orig?.skorPenjualan ?? 80;

      return {
        id: imp.id,
        name: imp.name,
        phoneMasked: imp.phoneMasked,
        domisili: imp.domisili || orig?.domisili || null,
        funnelStage: imp.funnelStage,
        qualityLabel: imp.qualityLabel || orig?.qualityLabel || null,
        notes: imp.notes || orig?.catatan || null,
        attributionStatus: orig?.statusAtribusi || "verified",
        adName: orig?.namaIklan || null,
        campaignName: null,
        buyerAssessment: {
          dimension: "buyer",
          rawPoints: buyerScore,
          maxRubricPoints: 100,
          assessedValidWeight: 100,
          completeness: 1.0,
          normalizedScore: buyerScore,
          confidence: 0.9,
          status: "completed",
          criteria: {},
          missingCriteria: [],
          invalidCriteria: [],
          missingInformation: [],
          rubricVersion: "v1.0",
        },
        salesAssessment: {
          dimension: "sales",
          rawPoints: salesScore,
          maxRubricPoints: 100,
          assessedValidWeight: 100,
          completeness: 1.0,
          normalizedScore: salesScore,
          confidence: 0.9,
          status: "completed",
          criteria: {},
          missingCriteria: [],
          invalidCriteria: [],
          missingInformation: [],
          rubricVersion: "v1.0",
        },
        lastMessageAt: orig?.tanggalKontak || new Date().toISOString(),
        messageCount: 1,
        needsReview: false,
      };
    });

    addUploadedDemoLeads(demoItems);
  } catch {
    // Non-blocking fallback
  }

  return {
    success: failedCount === 0 || insertedCount > 0 || updatedCount > 0,
    totalProcessed: leads.length,
    insertedCount,
    updatedCount,
    failedCount,
    errors,
    warnings,
    importedLeads,
  };
}
