import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 4: Client Security & Domain Contract Invariants", () => {
  it("strictly prohibits client components from importing supabase/admin.ts", () => {
    const srcAppDir = path.resolve(import.meta.dirname, "../../src/app");

    // Recursively scan all files in src/app
    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
          results.push(fullPath);
        }
      });
      return results;
    }

    const appFiles = scanFiles(srcAppDir);
    expect(appFiles.length).toBeGreaterThan(0);

    appFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      // Check for illegal client imports of admin
      const hasIllegalAdminImport =
        content.includes('from "@/lib/supabase/admin"') ||
        content.includes("from '../lib/supabase/admin'") ||
        content.includes('from "../../../lib/supabase/admin"');

      expect(
        hasIllegalAdminImport,
        `Security Violation: ${filePath} imports supabase/admin.ts into App Router client path!`
      ).toBe(false);
    });
  });

  it("ensures admin.ts contains 'server-only' import guard", () => {
    const adminPath = path.resolve(
      import.meta.dirname,
      "../../src/lib/supabase/admin.ts"
    );
    const content = fs.readFileSync(adminPath, "utf-8");
    expect(content.startsWith('import "server-only";')).toBe(true);
  });
});
