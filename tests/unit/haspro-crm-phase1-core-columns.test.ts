import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  generateCrmLeadsTemplate,
  parseCrmLeadsFile,
  normalizeQualityLabel,
  normalizeFunnelStage,
  cleanPhoneNumber,
} from "@/lib/crm/crm-sheets-service";
import { getLeadsList } from "@/lib/data/dashboard-service";

describe("Haspro CRM Tahap 1 — Manual Sales Input & 7 Core Columns", () => {
  it("generates spreadsheet template with the exact 7 core columns requested", () => {
    const buffer = generateCrmLeadsTemplate("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets["Data Prospek CRM"];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

    const header = rows[0];
    expect(header).toBeDefined();

    // 1. Nama & WhatsApp
    expect(header[0]).toContain("Nama Prospek");
    expect(header[1]).toContain("Nomor WhatsApp");

    // 2. Domisili
    expect(header[2]).toContain("Domisili");

    // 3. Tanggal Masuk
    expect(header[3]).toContain("Tanggal Masuk");

    // 4. Kampanye / Iklan
    expect(header[4]).toContain("Kampanye / Iklan");

    // 5. Tahap Funnel
    expect(header[5]).toContain("Tahap Funnel");

    // 6. Label Kualitas (Hot / Warm / Cold)
    expect(header[6]).toContain("Label Kualitas Hot/Warm/Cold");

    // 7. Catatan Singkat
    expect(header[7]).toContain("Catatan Singkat");
  });

  it("normalizes quality labels (Hot, Warm, Cold) and allows empty/delayed assessment", () => {
    expect(normalizeQualityLabel("Hot")).toBe("Hot");
    expect(normalizeQualityLabel("warm")).toBe("Warm");
    expect(normalizeQualityLabel("COLD")).toBe("Cold");
    expect(normalizeQualityLabel("panas")).toBe("Hot");
    expect(normalizeQualityLabel("hangat")).toBe("Warm");
    expect(normalizeQualityLabel("dingin")).toBe("Cold");

    // When quality assessment is delayed/unspecified (Tahap 1)
    expect(normalizeQualityLabel("")).toBeNull();
    expect(normalizeQualityLabel(null)).toBeNull();
    expect(normalizeQualityLabel(undefined)).toBeNull();
    expect(normalizeQualityLabel("belum dinilai")).toBeNull();
  });

  it("parses 7 core columns from uploaded spreadsheet correctly", () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      "Nama Prospek",
      "Nomor WhatsApp",
      "Domisili",
      "Tanggal Masuk",
      "Kampanye / Iklan",
      "Tahap Funnel",
      "Label Kualitas",
      "Catatan Singkat",
    ];

    const testRows = [
      [
        "Farhan Maulana",
        "081299887711",
        "Surabaya",
        "2026-10-27",
        "Cluster Sapphire BSD",
        "survei",
        "Hot",
        "Minta jadwal survei Sabtu jam 10 pagi, minat hook",
      ],
      [
        "Siti Nurhaliza",
        "085612345678",
        "Jakarta Selatan",
        "2026-10-26",
        "Maliosewu A",
        "prospek",
        "Warm",
        "Tanya simulasi KPR bank syariah",
      ],
      [
        "Bambang Hermanto",
        "087811223344",
        "Bandung",
        "2026-10-25",
        "",
        "baru",
        "",
        "",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...testRows]);
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const summary = parseCrmLeadsFile(buffer);
    expect(summary.totalRows).toBe(3);
    expect(summary.validRows).toBe(3);

    const r0 = summary.rows[0].data;
    expect(r0?.nama).toBe("Farhan Maulana");
    expect(r0?.telepon).toBe("6281299887711");
    expect(r0?.domisili).toBe("Surabaya");
    expect(r0?.namaIklan).toBe("Cluster Sapphire BSD");
    expect(r0?.tahapFunnel).toBe("survei");
    expect(r0?.qualityLabel).toBe("Hot");
    expect(r0?.catatan).toContain("Minta jadwal survei");

    const r1 = summary.rows[1].data;
    expect(r1?.nama).toBe("Siti Nurhaliza");
    expect(r1?.domisili).toBe("Jakarta Selatan");
    expect(r1?.qualityLabel).toBe("Warm");

    const r2 = summary.rows[2].data;
    expect(r2?.nama).toBe("Bambang Hermanto");
    expect(r2?.domisili).toBe("Bandung");
    expect(r2?.qualityLabel).toBeNull(); // Empty quality label allowed
    expect(r2?.catatan).toBeUndefined();
  });

  it("filters leads by quality label (Hot, Warm, Cold) and searches by domisili", () => {
    const hotLeads = getLeadsList({ qualityLabel: "Hot" });
    hotLeads.forEach((l) => {
      expect(l.qualityLabel).toBe("Hot");
    });

    const warmLeads = getLeadsList({ qualityLabel: "Warm" });
    warmLeads.forEach((l) => {
      expect(l.qualityLabel).toBe("Warm");
    });

    // Search by domisili
    const jktLeads = getLeadsList({ search: "jakarta" });
    expect(jktLeads.length).toBeGreaterThan(0);
    jktLeads.forEach((l) => {
      const match =
        l.name.toLowerCase().includes("jakarta") ||
        (l.domisili && l.domisili.toLowerCase().includes("jakarta")) ||
        (l.notes && l.notes.toLowerCase().includes("jakarta"));
      expect(match).toBe(true);
    });
  });

  it("validates funnel stages and phone numbers for manual input", () => {
    expect(normalizeFunnelStage("baru").stage).toBe("baru");
    expect(normalizeFunnelStage("dihubungi").stage).toBe("dihubungi");
    expect(normalizeFunnelStage("prospek").stage).toBe("prospek");
    expect(normalizeFunnelStage("survei").stage).toBe("survei");
    expect(normalizeFunnelStage("closing").stage).toBe("closing");
    expect(normalizeFunnelStage("batal").stage).toBe("batal");

    // Clean phone numbers
    expect(cleanPhoneNumber("081234567890")).toBe("6281234567890");
    expect(cleanPhoneNumber("+6281234567890")).toBe("6281234567890");
    expect(cleanPhoneNumber("6281234567890")).toBe("6281234567890");
  });
});
