import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { formatOptionalNumber } from "@/lib/ads/display";
import { aggregateAdInsights } from "@/lib/ads/aggregation";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

describe("Reach null handling (final fix)", () => {
  it("renders null reach as unavailable, not zero", () => {
    expect(formatOptionalNumber(null, fmt)).toBe("—");
  });

  it("renders undefined reach as unavailable", () => {
    expect(formatOptionalNumber(undefined, fmt)).toBe("—");
  });

  it("renders explicit zero reach as 0", () => {
    expect(formatOptionalNumber(0, fmt)).toBe("0");
  });

  it("renders positive reach with the provided formatter", () => {
    expect(formatOptionalNumber(20157, fmt)).toBe("20.157");
  });

  it("multi-day aggregation never fabricates a summed unique reach", () => {
    const agg = aggregateAdInsights([
      { spend: 100, impressions: 100, clicks: 5, reach: 80, date_start: "2026-10-01" },
      { spend: 100, impressions: 100, clicks: 5, reach: 70, date_start: "2026-10-02" },
    ]);
    expect(agg.reach).toBeNull();
    expect(formatOptionalNumber(agg.reach, fmt)).toBe("—");
  });

  it("single-day reach remains available and displays its value", () => {
    const agg = aggregateAdInsights([
      { spend: 100, impressions: 100, clicks: 5, reach: 80, date_start: "2026-10-01" },
    ]);
    expect(agg.reach).toBe(80);
    expect(formatOptionalNumber(agg.reach, fmt)).toBe("80");
  });

  it("the Ads page no longer coerces totalReach to 0 for display", () => {
    const page = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/(dashboard)/ads/page.tsx"),
      "utf-8"
    );
    expect(page).not.toContain("totalReach ?? 0");
    expect(page).toContain("formatOptionalNumber(kpis?.totalReach, formatNumber)");
  });

  it("the reach strip is labelled as unique reach with the multi-day tooltip", () => {
    const page = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/(dashboard)/ads/page.tsx"),
      "utf-8"
    );
    expect(page).not.toContain("Reach harian (akumulasi)");
    expect(page).not.toContain("Daily reach (accumulated)");
    expect(page).not.toContain("Akumulasi reach harian per iklan");
    expect(page).toContain('"Jangkauan" : "Reach"');
    expect(page).toContain(
      "Jumlah akun unik yang dijangkau. Untuk periode lebih dari satu hari, nilai tidak ditampilkan karena data harian tidak dapat dijumlahkan untuk memperoleh jangkauan unik periode tersebut."
    );
  });
});
