import { describe, it, expect } from "vitest";
import {
  MARKETING_ANGLES,
  ANGLE_CLUSTERS,
  getAngleById,
} from "@/lib/ai/creative-studio/marketing-angles";
import { NaturalLanguageBriefParser } from "@/lib/ai/creative-studio/brief-parser";

describe("Conversational Creative Brief & Marketing Angle Engine", () => {
  describe("1. Marketing Angle Library (20 Templates across 5 Clusters)", () => {
    it("should provide exactly 20 distinct marketing angle templates", () => {
      expect(MARKETING_ANGLES).toHaveLength(20);
    });

    it("should cover all 5 specified marketing clusters", () => {
      const clusterIds = ANGLE_CLUSTERS.map((c) => c.id);
      expect(clusterIds).toEqual([
        "conversion",
        "emotional",
        "financial",
        "location",
        "architectural",
      ]);

      const foundClusters = new Set(MARKETING_ANGLES.map((a) => a.cluster));
      expect(foundClusters.size).toBe(5);
      clusterIds.forEach((id) => expect(foundClusters.has(id)).toBe(true));
    });

    it("should provide valid color palettes, typography, and CTAs for every template", () => {
      for (const angle of MARKETING_ANGLES) {
        expect(angle.id).toBeDefined();
        expect(angle.name).toBeTruthy();
        expect(angle.recommendedColorPalette.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(angle.recommendedColorPalette.backgroundOverlay).toContain("linear-gradient");
        expect(angle.recommendedHeadlineHook).toBeTruthy();
        expect(angle.ctaRecommendation).toBeTruthy();
        expect(angle.suggestedPills.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should resolve template safely via getAngleById with fallback", () => {
      const found = getAngleById("whatsapp_direct");
      expect(found.id).toBe("whatsapp_direct");
      expect(found.cluster).toBe("conversion");

      const fallback = getAngleById("non_existent_angle_xyz");
      expect(fallback.id).toBe("whatsapp_direct");
    });
  });

  describe("2. Natural Language Entity Extraction (NLP Parser)", () => {
    it("should extract complete property attributes from a standard Indonesian prompt", () => {
      const narrative =
        "Buatkan iklan rumah modern 2 lantai di BSD City, Tangerang Selatan. Harga mulai Rp850 juta. Luas tanah 90 m², bangunan 120 m². 3 kamar tidur, 2 kamar mandi. DP 0% dan Bebas PPN. Dekat akses tol dan stasiun. Target keluarga muda kelas menengah atas.";

      const brief = NaturalLanguageBriefParser.parse(narrative, {
        angleId: "whatsapp_direct",
        aspectRatio: "4:5",
      });

      expect(brief.propertyLocation).toContain("BSD City");
      expect(brief.startingPrice).toContain("850 Juta");
      expect(brief.landArea).toBe("90");
      expect(brief.buildingArea).toBe("120");
      expect(brief.bedrooms).toBe("3");
      expect(brief.bathrooms).toBe("2");
      expect(brief.floors).toBe("2");
      expect(brief.hasFreePpn).toBe(true);
      expect(brief.dpAmount).toBe("DP 0%");
      expect(brief.targetAudience).toContain("keluarga muda");
      expect(brief.aspectRatio).toBe("4:5");
    });

    it("should extract luxury villa in Bali with Miliar currency", () => {
      const narrative =
        "Pasarkan Villa Mewah 1 lantai di Ubud, Bali. Harga mulai Rp 2,5 Miliar. Pemandangan sawah asri dan private pool. Target investor ekspatriat.";

      const brief = NaturalLanguageBriefParser.parse(narrative, {
        angleId: "luxury_exterior",
        aspectRatio: "1:1",
      });

      expect(brief.propertyType).toBe("Villa Mewah");
      expect(brief.propertyLocation).toContain("Bali");
      expect(brief.startingPrice).toContain("2,5 Miliar");
      expect(brief.floors).toBe("1");
      expect(brief.aspectRatio).toBe("1:1");
    });

    it("should extract shophouse / ruko with monthly installment", () => {
      const narrative =
        "Iklankan Ruko Komersial 3 lantai di Gading Serpong. Cicilan mulai 15 juta/bln. DP 10%. Cocok untuk kantor, kafe, atau klinik.";

      const brief = NaturalLanguageBriefParser.parse(narrative, {
        angleId: "affordable_opportunity",
      });

      expect(brief.propertyType).toBe("Ruko Komersial");
      expect(brief.propertyLocation).toContain("Gading Serpong");
      expect(brief.monthlyInstallment).toContain("15");
      expect(brief.dpAmount).toContain("10%");
      expect(brief.floors).toBe("3");
    });

    it("should safely provide fallback defaults when minimal input is provided without blocking", () => {
      const minimalText = "Rumah minimalis murah";

      const brief = NaturalLanguageBriefParser.parse(minimalText, {
        angleId: "family_lifestyle",
      });

      expect(brief.projectName).toBe("");
      expect(brief.hasExplicitProjectName).toBe(false);
      expect(brief.propertyType).toBe("Rumah Tinggal");
      expect(brief.propertyLocation).toBe("Lokasi Strategis");
      expect(brief.headline).toBe("Hunian Modern Siap Huni di lokasi strategis");
      expect(brief.ctaText).toBe("Jadwalkan Kunjungan");
      expect(brief.aspectRatio).toBe("4:5");
    });

    it("should extract and normalize Indonesian WhatsApp numbers and update specs dynamically", () => {
      const textWithWa =
        "Cluster Harmoni di Bekasi. 4 kamar tidur, 3 kamar mandi, LT 90m², LB 110m². Hubungi WA +62 831-4494-0611.";

      const brief = NaturalLanguageBriefParser.parse(textWithWa, {
        whatsappNumber: null,
        specsText: "3 KT • 2 KM • LT 72m² • LB 85m²",
      });

      expect(brief.whatsappNumber).toBe("0831-4494-0611");
      expect(brief.specsText).toBe("4 KT • 3 KM • LT 90m² • LB 110m²");
    });
  });
});

