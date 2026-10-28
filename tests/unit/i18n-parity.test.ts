import { describe, it, expect } from "vitest";
import { idDictionary } from "@/lib/i18n/dictionaries/id";
import { enDictionary } from "@/lib/i18n/dictionaries/en";

function collectKeys(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectKeys(item, `${prefix}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      collectKeys(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [prefix];
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
}

describe("i18n dictionary parity", () => {
  it("id and en dictionaries have identical keys", () => {
    const idKeys = collectKeys(idDictionary).sort();
    const enKeys = collectKeys(enDictionary).sort();
    expect(enKeys).toEqual(idKeys);
  });

  it("landing copy contains no prohibited overclaim phrases", () => {
    const banned = [
      "100% deterministic",
      "zero guesswork",
      "zero hallucination",
      "tanpa data palsu",
      "terbaik",
      "#1",
      "nomor satu",
      "garansi",
      "pasti",
      "tanpa risiko",
      "super premium",
      "ultra",
      "siap produksi",
      "v1.0 ready",
      "kelas dunia",
      "terdepan",
      "best in class",
      "world-class",
      "guarantee",
      "risk-free",
      "number one",
    ];
    const texts = [
      ...collectStrings(idDictionary.landing),
      ...collectStrings(enDictionary.landing),
    ].map((s) => s.toLowerCase());
    for (const phrase of banned) {
      const found = texts.filter((t) => t.includes(phrase));
      expect(found, `phrase "${phrase}"`).toEqual([]);
    }
  });
});
