import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  generateCrmLeadsTemplate,
  parseCrmLeadsFile,
  cleanPhoneNumber,
  normalizeFunnelStage,
  normalizeAttributionStatus,
  normalizeQualityLabel,
} from "@/lib/crm/crm-sheets-service";

describe("CRM Sheets Service - Template & Parser", () => {
  it("generates a valid .xlsx template with 2 sheets and correct headers", () => {
    const buffer = generateCrmLeadsTemplate("xlsx");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    const wb = XLSX.read(buffer, { type: "buffer" });
    expect(wb.SheetNames).toContain("Data Prospek CRM");
    expect(wb.SheetNames).toContain("Panduan & Validasi");

    const ws = wb.Sheets["Data Prospek CRM"];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(rows.length).toBeGreaterThanOrEqual(5);

    const header = rows[0];
    expect(header[0]).toContain("Nama Prospek");
    expect(header[1]).toContain("Nomor WhatsApp");
    expect(header[2]).toContain("Domisili");
    expect(header).toContain("Tahap Funnel (Wajib)");
    expect(header).toContain("Label Kualitas Hot/Warm/Cold (Opsional)");
  });

  it("generates a valid .csv template", () => {
    const buffer = generateCrmLeadsTemplate("csv");
    const csvContent = buffer.toString("utf-8");
    expect(csvContent).toContain("Nama Prospek (Wajib)");
    expect(csvContent).toContain("Nomor WhatsApp / HP (Wajib)");
    expect(csvContent).toContain("Domisili (Opsional)");
    expect(csvContent).toContain("Label Kualitas Hot/Warm/Cold (Opsional)");
    expect(csvContent).toContain("Budi Santoso");
  });

  it("normalizes phone numbers to standard 62xxx digits", () => {
    expect(cleanPhoneNumber("081234567890")).toBe("6281234567890");
    expect(cleanPhoneNumber("+62 812-3456-7890")).toBe("6281234567890");
    expect(cleanPhoneNumber("6281234567890")).toBe("6281234567890");
    expect(cleanPhoneNumber("0856-1122-3344")).toBe("6285611223344");
  });

  it("normalizes quality labels (Hot, Warm, Cold) correctly", () => {
    expect(normalizeQualityLabel("Hot")).toBe("Hot");
    expect(normalizeQualityLabel("hot")).toBe("Hot");
    expect(normalizeQualityLabel("panas")).toBe("Hot");
    expect(normalizeQualityLabel("Warm")).toBe("Warm");
    expect(normalizeQualityLabel("hangat")).toBe("Warm");
    expect(normalizeQualityLabel("Cold")).toBe("Cold");
    expect(normalizeQualityLabel("dingin")).toBe("Cold");
    expect(normalizeQualityLabel("")).toBeNull();
    expect(normalizeQualityLabel(null)).toBeNull();
    expect(normalizeQualityLabel("unknown_label")).toBeNull();
  });

  it("normalizes Indonesian and English funnel stages accurately", () => {
    expect(normalizeFunnelStage("survei").stage).toBe("survei");
    expect(normalizeFunnelStage("survey").stage).toBe("survei");
    expect(normalizeFunnelStage("visit").stage).toBe("survei");

    expect(normalizeFunnelStage("closing").stage).toBe("closing");
    expect(normalizeFunnelStage("booking").stage).toBe("closing");
    expect(normalizeFunnelStage("deal").stage).toBe("closing");

    expect(normalizeFunnelStage("prospek").stage).toBe("prospek");
    expect(normalizeFunnelStage("prospect").stage).toBe("prospek");

    expect(normalizeFunnelStage("dihubungi").stage).toBe("dihubungi");
    expect(normalizeFunnelStage("contacted").stage).toBe("dihubungi");

    expect(normalizeFunnelStage("batal").stage).toBe("batal");
    expect(normalizeFunnelStage("lost").stage).toBe("batal");

    expect(normalizeFunnelStage("unknown_stage").isDefault).toBe(true);
    expect(normalizeFunnelStage("unknown_stage").stage).toBe("baru");
  });

  it("normalizes attribution status accurately", () => {
    expect(normalizeAttributionStatus("verified")).toBe("verified");
    expect(normalizeAttributionStatus("terverifikasi")).toBe("verified");
    expect(normalizeAttributionStatus("inferred")).toBe("inferred");
    expect(normalizeAttributionStatus("perkiraan")).toBe("inferred");
    expect(normalizeAttributionStatus("unknown")).toBe("unknown");
    expect(normalizeAttributionStatus("", true)).toBe("verified");
    expect(normalizeAttributionStatus("", false)).toBe("unknown");
  });

  it("parses and validates template rows without errors", () => {
    const templateBuffer = generateCrmLeadsTemplate("xlsx");
    const summary = parseCrmLeadsFile(templateBuffer);

    expect(summary.totalRows).toBe(5);
    expect(summary.validRows).toBe(5);
    expect(summary.invalidRows).toBe(0);

    const firstRow = summary.rows[0];
    expect(firstRow.valid).toBe(true);
    expect(firstRow.data?.nama).toBe("Budi Santoso");
    expect(firstRow.data?.telepon).toBe("6281234567890");
    expect(firstRow.data?.phoneMasked).toContain("+62 812-****-");
    expect(firstRow.data?.domisili).toBe("Jakarta Selatan");
    expect(firstRow.data?.tahapFunnel).toBe("survei");
    expect(firstRow.data?.qualityLabel).toBe("Hot");
    expect(firstRow.data?.statusAtribusi).toBe("verified");
  });

  it("flags missing required fields (name, invalid phone)", () => {
    const wb = XLSX.utils.book_new();
    const headers = ["Nama Prospek", "Nomor WhatsApp", "Tahap Funnel"];
    const invalidRows = [
      ["", "081234567890", "prospek"], // Missing name
      ["Joko Susanto", "123", "survei"], // Phone too short
      ["Siti Aminah", "081299887766", "closing"], // Valid
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...invalidRows]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const summary = parseCrmLeadsFile(buffer);
    expect(summary.totalRows).toBe(3);
    expect(summary.validRows).toBe(1);
    expect(summary.invalidRows).toBe(2);

    expect(summary.rows[0].valid).toBe(false);
    expect(summary.rows[0].errors).toContain("Nama prospek wajib diisi.");

    expect(summary.rows[1].valid).toBe(false);
    expect(summary.rows[1].errors).toContain("Nomor WhatsApp/HP wajib diisi (minimal 9 digit).");

    expect(summary.rows[2].valid).toBe(true);
    expect(summary.rows[2].data?.nama).toBe("Siti Aminah");
    expect(summary.rows[2].data?.tahapFunnel).toBe("closing");
  });
});
