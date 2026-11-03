import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decideCrmImportRow } from "@/lib/crm/crm-sheets-service";

describe("CRM import row decisions", () => {
  it("saves a valid new prospect", () => {
    expect(decideCrmImportRow({
      prospectValid: true,
      seenInFile: false,
      existsInWorkspace: false,
      matchMethod: "meta_ad_id",
      allowUnattributed: false,
    })).toMatchObject({ previewStatus: "READY_TO_IMPORT", save: true, clearAttribution: false });
  });

  it("skips a phone already stored in the workspace", () => {
    expect(decideCrmImportRow({
      prospectValid: true,
      seenInFile: false,
      existsInWorkspace: true,
      matchMethod: "meta_ad_id",
      allowUnattributed: false,
    })).toMatchObject({ status: "DUPLICATE", save: false });
  });

  it("skips a repeated phone inside the same file", () => {
    expect(decideCrmImportRow({
      prospectValid: true,
      seenInFile: true,
      existsInWorkspace: false,
      matchMethod: "none",
      allowUnattributed: false,
    })).toMatchObject({ status: "DUPLICATE", save: false });
  });

  it("does not save an unknown ad id unless the user confirms an unattributed prospect", () => {
    const blocked = decideCrmImportRow({
      prospectValid: true,
      seenInFile: false,
      existsInWorkspace: false,
      matchMethod: "invalid_identifier",
      allowUnattributed: false,
    });
    expect(blocked).toMatchObject({ previewStatus: "INVALID_IDENTIFIER", save: false, clearAttribution: true });
    const confirmed = decideCrmImportRow({
      prospectValid: true,
      seenInFile: false,
      existsInWorkspace: false,
      matchMethod: "invalid_identifier",
      allowUnattributed: true,
    });
    expect(confirmed).toMatchObject({ save: true, clearAttribution: true });
  });

  it("does not link an ambiguous ad name", () => {
    expect(decideCrmImportRow({
      prospectValid: true,
      seenInFile: false,
      existsInWorkspace: false,
      matchMethod: "ambiguous",
      allowUnattributed: false,
    })).toMatchObject({ previewStatus: "AMBIGUOUS_IDENTIFIER", save: false, clearAttribution: true });
  });

  it("keeps a blank source as an unattributed prospect", () => {
    expect(decideCrmImportRow({
      prospectValid: true,
      seenInFile: false,
      existsInWorkspace: false,
      matchMethod: "none",
      allowUnattributed: false,
    })).toMatchObject({ previewStatus: "UNATTRIBUTED", save: true, clearAttribution: true });
  });

  it("does not render retired score labels on the CRM screens", () => {
    const files = [
      "src/app/(dashboard)/leads/page.tsx",
      "src/app/(dashboard)/leads/[id]/LeadDetailClient.tsx",
      "src/components/crm/CRMLeadsUploadModal.tsx",
      "src/components/crm/CRMManualLeadModal.tsx",
    ];
    const text = files.map((file) => fs.readFileSync(path.resolve(import.meta.dirname, "../../", file), "utf8")).join("\n");
    expect(text).not.toMatch(/Buyer Score|Sales Score|Buyer Intent/);
  });

  it("skips a row with invalid prospect data", () => {
    expect(decideCrmImportRow({
      prospectValid: false,
      seenInFile: false,
      existsInWorkspace: false,
      matchMethod: "meta_ad_id",
      allowUnattributed: true,
    })).toMatchObject({ previewStatus: "INVALID_DATA", save: false });
  });
});
