import { describe, it, expect } from "vitest";

describe("CRM Lead FAB and Pipeline Rules", () => {
  it("verifies pipeline funnel stage allowed transitions", async () => {
    const { getAllowedFunnelTransitions } = await import("@/domain/funnel/stages");

    // Check transitions from 'baru'
    const fromBaru = getAllowedFunnelTransitions("baru");
    expect(fromBaru).toContain("dihubungi");
    expect(fromBaru).toContain("prospek");
    expect(fromBaru).toContain("batal");

    // Check transitions from 'survei'
    const fromSurvei = getAllowedFunnelTransitions("survei");
    expect(fromSurvei).toContain("closing");
    expect(fromSurvei).toContain("batal");
  });

  it("verifies CRM lead template endpoints for XLSX and CSV format", async () => {
    const { generateCrmLeadsTemplate } = await import("@/lib/crm/crm-sheets-service");

    const xlsxBuffer = generateCrmLeadsTemplate("xlsx");
    expect(xlsxBuffer.length).toBeGreaterThan(500);

    const csvBuffer = generateCrmLeadsTemplate("csv");
    const csvString = csvBuffer.toString("utf-8");
    expect(csvString).toContain("Nama Prospek (Wajib)");
    expect(csvString).toContain("Nomor WhatsApp / HP (Wajib)");
  });
});
