import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { idDictionary } from "@/lib/i18n/dictionaries/id";
import { enDictionary } from "@/lib/i18n/dictionaries/en";

describe("CRM Leads Redesign Invariants & Quality Verification", () => {
  it("strictly enforces elimination of window.prompt in leads page", () => {
    const pagePath = path.resolve(process.cwd(), "src/app/(dashboard)/leads/page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    // window.prompt must NOT exist in the leads page
    expect(content).not.toContain("window.prompt");
    expect(content).toContain("handleOpenStageModal");
    expect(content).toContain("handleConfirmStageTransition");
  });

  it("verifies zero decorative emojis in CRMManualLeadModal", () => {
    const modalPath = path.resolve(process.cwd(), "src/components/crm/CRMManualLeadModal.tsx");
    const content = fs.readFileSync(modalPath, "utf-8");

    expect(content).not.toContain("⚡");
    expect(content).not.toContain("🔥");
    expect(content).not.toContain("☀️");
    expect(content).not.toContain("❄️");
  });

  it("ensures complete ID and EN localization parity for CRM keys", () => {
    // KPI keys
    expect(idDictionary.leads.kpi.totalLeads).toBeTruthy();
    expect(enDictionary.leads.kpi.totalLeads).toBeTruthy();
    expect(idDictionary.leads.kpi.newLeads).toBeTruthy();
    expect(enDictionary.leads.kpi.newLeads).toBeTruthy();
    expect(idDictionary.leads.kpi.qualifiedLeads).toBeTruthy();
    expect(enDictionary.leads.kpi.qualifiedLeads).toBeTruthy();
    expect(idDictionary.leads.kpi.surveyClosing).toBeTruthy();
    expect(enDictionary.leads.kpi.surveyClosing).toBeTruthy();

    // Scoring Tooltip keys
    expect(idDictionary.leads.scoringTooltip.buyerScoreTitle).toBeTruthy();
    expect(enDictionary.leads.scoringTooltip.buyerScoreTitle).toBeTruthy();
    expect(idDictionary.leads.scoringTooltip.salesScoreTitle).toBeTruthy();
    expect(enDictionary.leads.scoringTooltip.salesScoreTitle).toBeTruthy();

    // Stage Modal keys
    expect(idDictionary.leads.stageModal.title).toBeTruthy();
    expect(enDictionary.leads.stageModal.title).toBeTruthy();
    expect(idDictionary.leads.stageModal.selectNewStage).toBeTruthy();
    expect(enDictionary.leads.stageModal.selectNewStage).toBeTruthy();
    expect(idDictionary.leads.stageModal.reasonLabel).toBeTruthy();
    expect(enDictionary.leads.stageModal.reasonLabel).toBeTruthy();

    // Upload Modal keys
    expect(idDictionary.leads.uploadModal.readyBadge).toBeTruthy();
    expect(enDictionary.leads.uploadModal.readyBadge).toBeTruthy();
    expect(idDictionary.leads.uploadModal.totalProcessed).toBeTruthy();
    expect(enDictionary.leads.uploadModal.totalProcessed).toBeTruthy();
  });

  it("ensures safe bottom padding for FAB clearance", () => {
    const pagePath = path.resolve(process.cwd(), "src/app/(dashboard)/leads/page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    // Must have safe bottom spacing pb-32 or pb-36
    expect(content).toMatch(/pb-32|pb-36/);
  });
});

