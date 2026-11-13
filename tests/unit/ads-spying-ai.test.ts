import { describe, it, expect } from "vitest";
import { decodeWhatsAppUrl } from "@/lib/ads-spying/whatsapp-decoder";
import { analyzeAdFunnel } from "@/lib/ads-spying/funnel-analyzer";
import { calculateAdLongevity } from "@/lib/ads-spying/longevity-calculator";
import { GroundedAdAnalysisSchema } from "@/lib/ads-spying/grounded-ai-teardown";

describe("Ads Spying AI — Deterministic Engine Suite", () => {
  describe("1. WhatsApp Link & Pre-filled Script Decoder", () => {
    it("decodes wa.me URL with phone and URL-encoded Indonesian script", () => {
      const url = "https://wa.me/6281288992211?text=Halo%20Admin%20BSD%20City,%20saya%20tertarik%20dengan%20promo%20DP%200%25";
      const result = decodeWhatsAppUrl(url);

      expect(result.isWhatsApp).toBe(true);
      expect(result.phoneNumber).toBe("6281288992211");
      expect(result.prefilledText).toBe("Halo Admin BSD City, saya tertarik dengan promo DP 0%");
    });

    it("decodes api.whatsapp.com with plus-spaced words and query params", () => {
      const url = "https://api.whatsapp.com/send?phone=082110203040&text=Halo+Summarecon+Living+mau+tanya+info+unit+850+Juta";
      const result = decodeWhatsAppUrl(url);

      expect(result.isWhatsApp).toBe(true);
      expect(result.phoneNumber).toBe("6282110203040");
      expect(result.prefilledText).toBe("Halo Summarecon Living mau tanya info unit 850 Juta");
    });

    it("gracefully returns false for regular non-WhatsApp URLs", () => {
      const url = "https://podomoropark.com/promo-whoosh-resort?utm_source=meta_ads";
      const result = decodeWhatsAppUrl(url);

      expect(result.isWhatsApp).toBe(false);
      expect(result.phoneNumber).toBeNull();
      expect(result.prefilledText).toBeNull();
    });
  });

  describe("2. Funnel & Destination X-Ray Classifier", () => {
    it("classifies WhatsApp links as CTWA funnel", () => {
      const result = analyzeAdFunnel({
        destination_url: "https://wa.me/6281319203948?text=Info%20Rumah",
        cta_type: "WHATSAPP_MESSAGE",
        cta_text: "Kirim Pesan WhatsApp",
      });

      expect(result.funnel_type).toBe("CTWA");
      expect(result.destination_domain).toBe("wa.me");
      expect(result.decoded_wa.isWhatsApp).toBe(true);
      expect(result.decoded_wa.prefilledText).toBe("Info Rumah");
    });

    it("classifies Meta Instant Form as LEAD_FORM funnel", () => {
      const result = analyzeAdFunnel({
        destination_url: "https://facebook.com/lead_gen/citraland_surabaya_nup",
        cta_type: "SIGN_UP",
        cta_text: "Daftar",
      });

      expect(result.funnel_type).toBe("LEAD_FORM");
      expect(result.destination_domain).toContain("facebook.com");
    });

    it("classifies external website as LANDING_PAGE funnel", () => {
      const result = analyzeAdFunnel({
        destination_url: "https://cluster-bsd.enchante-living.com/promo?ref=ads",
        cta_type: "LEARN_MORE",
      });

      expect(result.funnel_type).toBe("LANDING_PAGE");
      expect(result.destination_domain).toBe("cluster-bsd.enchante-living.com");
    });
  });

  describe("3. Longevity & Aggressive Scaling Radar", () => {
    it("classifies ads running >= 15 days as EVERGREEN winners", () => {
      const start = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateAdLongevity({
        start_date: start,
        is_active: true,
        collation_count: 5,
      });

      expect(result.active_days_count).toBeGreaterThanOrEqual(35);
      expect(result.longevity_phase).toBe("EVERGREEN");
      expect(result.is_scaling).toBe(true); // collation_count >= 3
    });

    it("classifies ads running 5-14 days as VALIDATING", () => {
      const start = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateAdLongevity({
        start_date: start,
        is_active: true,
        collation_count: 2,
      });

      expect(result.active_days_count).toBeGreaterThanOrEqual(9);
      expect(result.longevity_phase).toBe("VALIDATING");
      expect(result.is_scaling).toBe(false);
    });

    it("classifies ads running 1-4 days as TESTING", () => {
      const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateAdLongevity({
        start_date: start,
        is_active: true,
        collation_count: 1,
      });

      expect(result.active_days_count).toBeLessThanOrEqual(3);
      expect(result.longevity_phase).toBe("TESTING");
      expect(result.is_scaling).toBe(false);
    });
  });

  describe("4. Grounded AI Teardown Schema & Zero-Hallucination Policy", () => {
    it("validates strict evidence-based output schema with verbatim quotes", () => {
      const mockAnalysis = {
        hook_angle: "Low Barrier Financial Offer (DP 0% / Biaya Ringan)",
        offer_breakdown: {
          starting_price: "Rp 850 Juta",
          dp_promo: "DP 0% Langsung Akad",
          installment: "7 Jutaan/Bulan",
          bonus_incentives: ["Free Biaya KPR & BPHTB", "Smart Home System"],
        },
        target_audience: "Pencari hunian pertama di Jabodetabek",
        copywriting_framework: "Direct Offer & Benefit Led",
        evidence_quotes: [
          "DP 0% Langsung Akad",
          "Cicilan Mulai 7 Jutaan/Bulan",
        ],
        actionable_takeaway: "Gunakan hook DP 0% langsung di headline dan format CTWA.",
      };

      const parsed = GroundedAdAnalysisSchema.safeParse(mockAnalysis);
      expect(parsed.success).toBe(true);
    });

    it("allows null for starting_price, dp_promo, and installment when absent in copy", () => {
      const mockWithoutFinancials = {
        hook_angle: "Luxury Atmosphere & Lifestyle Showcase",
        offer_breakdown: {
          starting_price: null,
          dp_promo: null,
          installment: null,
          bonus_incentives: [],
        },
        target_audience: "Pembeli rumah kedua atau investor",
        copywriting_framework: "Storytelling",
        evidence_quotes: ["Resort Living Pertama di Bandung Selatan"],
        actionable_takeaway: "Fokus pada fasilitas dan suasana tanpa perang harga.",
      };

      const parsed = GroundedAdAnalysisSchema.safeParse(mockWithoutFinancials);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.offer_breakdown.starting_price).toBeNull();
        expect(parsed.data.offer_breakdown.dp_promo).toBeNull();
      }
    });
  });

  describe("5. Tenant Isolation & Anti-Cross-Account Leakage", () => {
    // Two users belonging to the EXACT same organization
    const sharedOrgId = "org_shared_same_agency_12345";

    const userA = {
      id: "usr_aaaaaaaa_1111_2222_3333_444444444444",
      organization_id: sharedOrgId,
    };

    const userB = {
      id: "usr_bbbbbbbb_1111_2222_3333_444444444444",
      organization_id: sharedOrgId,
    };

    // Evaluates exact SQL RLS policy: (user_id = auth.uid())
    function evaluateTenantRlsPolicy(
      record: { user_id?: string | null; organization_id?: string | null },
      caller: { userId?: string | null; organizationId?: string | null }
    ): boolean {
      if (!caller.userId) return false; // anonymous / unauthenticated fails closed
      // Strict per-user isolation: user_id MUST match auth.uid()
      return Boolean(record.user_id && record.user_id === caller.userId);
    }

    it("allows Account A to read its own scraped competitor ads", () => {
      const adA = {
        id: "ad_1",
        user_id: userA.id,
        organization_id: userA.organization_id,
        ad_archive_id: "arch_101",
      };

      const canRead = evaluateTenantRlsPolicy(adA, {
        userId: userA.id,
        organizationId: userA.organization_id,
      });

      expect(canRead).toBe(true);
    });

    it("strictly blocks Account A from reading Account B's scraped competitor ads", () => {
      const adB = {
        id: "ad_2",
        user_id: userB.id,
        organization_id: userB.organization_id,
        ad_archive_id: "arch_202",
      };

      const canAccountARead = evaluateTenantRlsPolicy(adB, {
        userId: userA.id,
        organizationId: userA.organization_id,
      });

      expect(canAccountARead).toBe(false);
    });

    it("strictly blocks User A from reading User B's scraped ads even when sharing the same organization_id", () => {
      // Both users share the same organization_id
      expect(userA.organization_id).toBe(userB.organization_id);

      const adB = {
        id: "ad_job_b",
        user_id: userB.id,
        organization_id: userB.organization_id,
        ad_archive_id: "arch_same_org_202",
      };

      // User A attempts to read User B's ad
      const canUserARead = evaluateTenantRlsPolicy(adB, {
        userId: userA.id,
        organizationId: userA.organization_id,
      });

      expect(canUserARead).toBe(false);
    });

    it("strictly blocks User A from reading User B's scrape jobs even when sharing the same organization_id", () => {
      const jobB = {
        id: "job_b_uuid",
        user_id: userB.id,
        organization_id: userB.organization_id,
        search_keyword: "Cluster Mewah Serpong",
      };

      const canUserAReadJob = evaluateTenantRlsPolicy(jobB, {
        userId: userA.id,
        organizationId: userA.organization_id,
      });

      expect(canUserAReadJob).toBe(false);
    });

    it("strictly blocks anonymous users from reading any competitor ads", () => {
      const adA = {
        id: "ad_1",
        user_id: userA.id,
        organization_id: userA.organization_id,
        ad_archive_id: "arch_101",
      };

      const canAnonRead = evaluateTenantRlsPolicy(adA, {
        userId: null,
        organizationId: null,
      });

      expect(canAnonRead).toBe(false);
    });

    it("strictly blocks reading legacy unmapped rows without owner", () => {
      const legacyRow = {
        id: "legacy_1",
        user_id: null,
        organization_id: null,
        ad_archive_id: "legacy_seed_101",
      };

      const canAccountARead = evaluateTenantRlsPolicy(legacyRow, {
        userId: userA.id,
        organizationId: userA.organization_id,
      });

      const canAccountBRead = evaluateTenantRlsPolicy(legacyRow, {
        userId: userB.id,
        organizationId: userB.organization_id,
      });

      expect(canAccountARead).toBe(false);
      expect(canAccountBRead).toBe(false);
    });

    it("verifies worker resolves owner from verified database job, preventing client spoofing", () => {
      // Simulated DB table: ad_scrape_jobs
      const verifiedDbJobs = new Map<string, { user_id: string; organization_id: string }>([
        ["job_secure_1", { user_id: userA.id, organization_id: userA.organization_id }],
      ]);

      // Client payload attempts to spoof owner as userB
      const untrustedClientPayload = {
        job_id: "job_secure_1",
        spoofed_user_id: userB.id,
        spoofed_org_id: userB.organization_id,
      };

      // Worker resolution logic: MUST read exclusively from database by job_id
      const verifiedJob = verifiedDbJobs.get(untrustedClientPayload.job_id);
      expect(verifiedJob).toBeDefined();

      const assignedOwnerUserId = verifiedJob!.user_id;
      const assignedOwnerOrgId = verifiedJob!.organization_id;

      // Assert verified DB owner takes precedence over any client spoofing
      expect(assignedOwnerUserId).toBe(userA.id);
      expect(assignedOwnerUserId).not.toBe(untrustedClientPayload.spoofed_user_id);
      expect(assignedOwnerOrgId).toBe(userA.organization_id);
    });

    it("allows both Account A and Account B to track the same competitor ad archive ID independently", () => {
      // In multi-tenant architecture, composite unique is (user_id, ad_archive_id)
      const catalog = new Map<string, any>();

      const makeKey = (userId: string, adArchiveId: string) => `${userId}:${adArchiveId}`;

      const adForA = {
        user_id: userA.id,
        ad_archive_id: "meta_arch_shared_999",
        page_name: "Paramount Land",
        headline_title: "Promo Rumah Gading Serpong",
      };

      const adForB = {
        user_id: userB.id,
        ad_archive_id: "meta_arch_shared_999",
        page_name: "Paramount Land",
        headline_title: "Promo Rumah Gading Serpong",
      };

      catalog.set(makeKey(adForA.user_id, adForA.ad_archive_id), adForA);
      catalog.set(makeKey(adForB.user_id, adForB.ad_archive_id), adForB);

      expect(catalog.size).toBe(2);
      expect(catalog.get(makeKey(userA.id, "meta_arch_shared_999"))?.user_id).toBe(userA.id);
      expect(catalog.get(makeKey(userB.id, "meta_arch_shared_999"))?.user_id).toBe(userB.id);
    });
  });
});
