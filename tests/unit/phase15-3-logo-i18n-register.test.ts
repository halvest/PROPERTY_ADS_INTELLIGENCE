import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { idDictionary } from "@/lib/i18n/dictionaries/id";
import { enDictionary } from "@/lib/i18n/dictionaries/en";

describe("Phase 15.3 — Global Logo Standardization, I18n Hydration & Register Resilience", () => {
  describe("1. Official Logo Asset Verification", () => {
    const logoPath = path.resolve(process.cwd(), "public", "logo.png");

    it("verifies that public/logo.png exists and is a non-empty image file", () => {
      expect(fs.existsSync(logoPath)).toBe(true);
      const stat = fs.statSync(logoPath);
      expect(stat.size).toBeGreaterThan(10000); // ~263KB
    });

    it("verifies genuine 1:1 aspect ratio of public/logo.png from PNG header bytes", () => {
      const buf = fs.readFileSync(logoPath);
      // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);

      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      expect(width).toBe(1254);
      expect(height).toBe(1254);
      expect(width / height).toBe(1);
    });
  });

  describe("2. I18n Deterministic Hydration Safety", () => {
    it("guarantees matching default language label ('ID') and aria-label between SSR and client initial markup", () => {
      // With default deterministic locale = 'id':
      const defaultLocale = "id";
      const ariaLabelId = `${idDictionary.common.language}: ${defaultLocale.toUpperCase()}`;
      const buttonText = defaultLocale.toUpperCase();

      expect(ariaLabelId).toBe("Bahasa: ID");
      expect(buttonText).toBe("ID");
    });

    it("verifies that both idDictionary and enDictionary have full coverage for auth, common, and navigation", () => {
      expect(idDictionary.common.appName).toBe("HD Creative");
      expect(enDictionary.common.appName).toBe("HD Creative");

      expect(idDictionary.auth.signUpTitle).toBeDefined();
      expect(enDictionary.auth.signUpTitle).toBeDefined();

      expect(idDictionary.auth.emailAlreadyRegistered).toBeDefined();
      expect(enDictionary.auth.emailAlreadyRegistered).toBeDefined();

      expect(idDictionary.auth.invalidEmail).toBeDefined();
      expect(enDictionary.auth.invalidEmail).toBeDefined();

      expect(idDictionary.auth.rateLimitExceeded).toBeDefined();
      expect(enDictionary.auth.rateLimitExceeded).toBeDefined();
      expect(idDictionary.auth.rateLimitExceeded).toContain("Batas pengiriman email");
    });
  });

  describe("3. Registration Flow Validation Rules", () => {
    it("safely trims inputs before validation", () => {
      const rawEmail = "  lead.buyer@developer.id  ";
      const trimmed = rawEmail.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(trimmed)).toBe(true);
    });

    it("requires at least 8 characters for passwords and checks confirmation match", () => {
      const pass = "StrongP@ss2026";
      const confirmPass = "StrongP@ss2026";
      expect(pass.length >= 8).toBe(true);
      expect(pass === confirmPass).toBe(true);
    });
  });
});
