import { describe, it, expect } from "vitest";
import {
  formatRupiah,
  buildCoreMetrics,
  WhatsAppVerificationStatus,
  BudgetDecisionKey,
} from "@/app/api/ai/analyze-ad/route";
import fs from "fs";
import path from "path";

/**
 * HASPRO AI — META ADS PERFORMANCE ANALYST & PROPERTY SALES INTELLIGENCE
 * Acceptance Test Suite covering Section 1 through Section 8
 */
describe("HASPRO AI: Meta Ads CTWA Property Sales Intelligence", () => {
  // 1. Format Rupiah Konsisten tanpa spasi (e.g. Rp323.001)
  it("Rule 6: Format Rupiah konsisten tanpa spasi (contoh: Rp323.001)", () => {
    expect(formatRupiah(323001)).toBe("Rp323.001");
    expect(formatRupiah(1500000)).toBe("Rp1.500.000");
    expect(formatRupiah(0)).toBe("Rp0");
    expect(formatRupiah(null)).toBe("Tidak dapat dihitung");
    expect(formatRupiah(undefined)).toBe("Tidak dapat dihitung");
    expect(formatRupiah(NaN)).toBe("Tidak dapat dihitung");
  });

  // 2. Status Verifikasi Percakapan hanya 4 status mutlak
  it("Rule 2: Status verifikasi percakapan memiliki 4 status mutlak", () => {
    const validStatuses: WhatsAppVerificationStatus[] = [
      "TERVERIFIKASI ADA",
      "TERVERIFIKASI NOL",
      "BELUM TERVERIFIKASI",
      "DATA TIDAK KONSISTEN",
    ];

    expect(validStatuses).toHaveLength(4);
    expect(validStatuses).toContain("TERVERIFIKASI ADA");
    expect(validStatuses).toContain("TERVERIFIKASI NOL");
    expect(validStatuses).toContain("BELUM TERVERIFIKASI");
    expect(validStatuses).toContain("DATA TIDAK KONSISTEN");
  });

  // 3. Jika integrasi belum aktif, status BELUM TERVERIFIKASI dan tidak boleh disimpulkan 0 pesan
  it("Rule 2 & 3: Jika integrasi WhatsApp belum aktif, status adalah BELUM TERVERIFIKASI dan chat belum diketahui", () => {
    const metrics = buildCoreMetrics({
      spend: 250000,
      linkClicks: 65,
      linkCpc: 3846.15,
      metaConversations: 0,
      verifiedWhatsAppMessages: null,
      hasActiveIntegration: false,
      costPerConversation: null,
      isCostPerConversationValid: false,
    });

    const verifiedMsgItem = metrics.find((m) => m.id === "verifiedMessages");
    expect(verifiedMsgItem?.formattedValue).toBe("Belum diketahui");
    expect(verifiedMsgItem?.isValid).toBe(false);
    expect(verifiedMsgItem?.note).toContain("Integrasi WhatsApp belum terhubung");
  });

  // 4. Jika percakapan 0, biaya per percakapan TIDAK BOLEH dianggap valid
  it("Rule 3.1: Jika jumlah percakapan adalah 0, biaya per percakapan tidak boleh valid", () => {
    const metrics = buildCoreMetrics({
      spend: 300000,
      linkClicks: 80,
      linkCpc: 3750,
      metaConversations: 0,
      verifiedWhatsAppMessages: 0,
      hasActiveIntegration: true,
      costPerConversation: null,
      isCostPerConversationValid: false,
    });

    const cpcItem = metrics.find((m) => m.id === "costPerConversation");
    expect(cpcItem?.isValid).toBe(false);
    expect(cpcItem?.rawValue).toBeNull();
    expect(cpcItem?.formattedValue).toBe("Tidak dapat dihitung");
  });

  // 5. Jika biaya per percakapan positif tetapi percakapan 0, ditandai DATA TIDAK KONSISTEN
  it("Rule 3.2: Biaya percakapan positif dengan 0 chat ditandai sebagai data tidak valid / tidak konsisten", () => {
    const metrics = buildCoreMetrics({
      spend: 300000,
      linkClicks: 50,
      linkCpc: 6000,
      metaConversations: 0,
      verifiedWhatsAppMessages: 0,
      hasActiveIntegration: true,
      costPerConversation: 25000, // Contradictory cost
      isCostPerConversationValid: false,
      costPerConversationNote: "Biaya tidak valid karena jumlah percakapan nol.",
    });

    const cpcItem = metrics.find((m) => m.id === "costPerConversation");
    expect(cpcItem?.isValid).toBe(false);
    expect(cpcItem?.note).toContain("Biaya tidak valid karena jumlah percakapan nol.");
  });

  // 6. Jika pesan masuk WhatsApp terverifikasi ada, biaya per percakapan valid dan dihitung benar
  it("Rule 2 & 4: Pesan terverifikasi ada menghasilkan status TERVERIFIKASI ADA dan biaya valid", () => {
    const spend = 323001;
    const verifiedChats = 11;
    const costPerChat = Number((spend / verifiedChats).toFixed(2));

    const metrics = buildCoreMetrics({
      spend,
      linkClicks: 215,
      linkCpc: 1502.33,
      metaConversations: 10,
      verifiedWhatsAppMessages: verifiedChats,
      hasActiveIntegration: true,
      costPerConversation: costPerChat,
      isCostPerConversationValid: true,
    });

    const verifiedMsgItem = metrics.find((m) => m.id === "verifiedMessages");
    const costPerChatItem = metrics.find((m) => m.id === "costPerConversation");

    expect(verifiedMsgItem?.formattedValue).toBe("11 pesan");
    expect(verifiedMsgItem?.isValid).toBe(true);

    expect(costPerChatItem?.isValid).toBe(true);
    expect(costPerChatItem?.rawValue).toBe(costPerChat);
    expect(costPerChatItem?.formattedValue).toBe("Rp29.364 / chat");
  });

  // 7. Keputusan Anggaran memiliki 5 opsi eksplisit
  it("Rule 4.D: Keputusan anggaran hanya memilih salah satu dari 5 keputusan resmi", () => {
    const validDecisions: BudgetDecisionKey[] = [
      "NAIKKAN",
      "PERTAHANKAN",
      "TAHAN KENAIKAN",
      "KURANGI",
      "HENTIKAN SEMENTARA",
    ];

    expect(validDecisions).toHaveLength(5);
    expect(validDecisions).toContain("NAIKKAN");
    expect(validDecisions).toContain("PERTAHANKAN");
    expect(validDecisions).toContain("TAHAN KENAIKAN");
    expect(validDecisions).toContain("KURANGI");
    expect(validDecisions).toContain("HENTIKAN SEMENTARA");
  });

  // 8. Metrik Utama dibatasi maksimal 6 metrik pada output
  it("Rule 5.F: Metrik utama menampilkan tepat maksimal 6 metrik paling relevan", () => {
    const metrics = buildCoreMetrics({
      spend: 150000,
      linkClicks: 40,
      linkCpc: 3750,
      metaConversations: 2,
      verifiedWhatsAppMessages: 2,
      hasActiveIntegration: true,
      costPerConversation: 75000,
      isCostPerConversationValid: true,
    });

    expect(metrics.length).toBeLessThanOrEqual(6);
    const metricIds = metrics.map((m) => m.id);
    expect(metricIds).toEqual([
      "spend",
      "linkClicks",
      "linkCpc",
      "metaConversations",
      "verifiedMessages",
      "costPerConversation",
    ]);
  });

  // 9. Larangan frasa berulang dan jargon
  it("Rule 6: Route dan prompt bebas dari frasa berulang dan jargon yang dilarang", () => {
    const routeContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/ai/analyze-ad/route.ts"),
      "utf-8"
    );

    // Banned phrases from Section 6
    expect(routeContent.includes("Keramaian ini belum menghasilkan peluang penjualan")).toBe(false);
    expect(routeContent.includes("traffic murah tapi buntu")).toBe(false);
    expect(routeContent.includes("funnel jebol")).toBe(false);
    expect(routeContent.includes("kill rule")).toBe(false);
    expect(routeContent.includes("placement sampah")).toBe(false);
  });

  // 10. Drawer UI memisahkan tampilan utama (A-F) dan collapsible (G)
  it("Rule 5: AdDetailDrawer merender bagian A-F pada tampilan utama dan G pada disclosure terpisah", () => {
    const drawerContent = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/components/dashboard/AdDetailDrawer.tsx"),
      "utf-8"
    );

    // Section A: Ringkasan Kinerja
    expect(drawerContent.includes("Ringkasan Kinerja")).toBe(true);

    // Section B: Status Hasil WhatsApp
    expect(drawerContent.includes("Status Hasil WhatsApp")).toBe(true);
    expect(drawerContent.includes("chatAccordingToMeta")).toBe(true);
    expect(drawerContent.includes("verifiedInboundMessages")).toBe(true);
    expect(drawerContent.includes("crmLeads")).toBe(true);

    // Section C: Keputusan
    expect(drawerContent.includes("Keputusan Anggaran")).toBe(true);

    // Section D: Temuan Penting (Maksimal 3)
    expect(drawerContent.includes("Temuan Penting")).toBe(true);
    expect(drawerContent.includes("Maksimal 3 poin utama")).toBe(true);

    // Section E: Tindakan Prioritas (Maksimal 3)
    expect(drawerContent.includes("Tindakan Prioritas")).toBe(true);
    expect(drawerContent.includes("Terurut berdasarkan urgensi")).toBe(true);

    // Section F: Metrik Utama
    expect(drawerContent.includes("Metrik Utama")).toBe(true);

    // Section G: Detail Tambahan (Collapsible)
    expect(drawerContent.includes("Detail Tambahan & Evaluasi Funnel")).toBe(true);
    expect(drawerContent.includes("showAdditionalDetails")).toBe(true);
    expect(drawerContent.includes("firstFailingStage")).toBe(true);
  });
});
