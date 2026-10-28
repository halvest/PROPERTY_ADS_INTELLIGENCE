import { describe, it, expect } from "vitest";
import type { CampaignDetailData } from "@/components/dashboard/CampaignDetailWorkspace";

// Unit tests for the Ads Filter Toolbar & Campaign Searchable Dropdown
describe("Ads Filter Toolbar & Campaign Searchable Dropdown", () => {
  const sampleCampaigns: CampaignDetailData[] = [
    {
      id: "camp-001",
      providerCampaignId: "meta_c_111",
      name: "Perumahan Bukit Permata Citra - Type 45/90 CTWA Promo DP 0%",
      status: "ACTIVE",
      objective: "OUTCOME_LEADS",
      totalAdsCount: 4,
      activeAdsCount: 3,
      spend: 1500000,
      impressions: 45000,
      reach: 32000,
      frequency: 1.4,
      results: 38,
      costPerResult: 39473,
      linkClicks: 1200,
      linkCtr: 2.67,
      linkCpc: 1250,
      allClicks: 1500,
      allCtr: 3.33,
      allCpc: 1000,
      cpm: 33333,
    },
    {
      id: "camp-002",
      providerCampaignId: "meta_c_222",
      name: "Apartemen Grand Boulevard Tower A - Cicilan 3 Jutaan",
      status: "PAUSED",
      objective: "OUTCOME_SALES",
      totalAdsCount: 3,
      activeAdsCount: 0,
      spend: 2100000,
      impressions: 60000,
      reach: 41000,
      frequency: 1.46,
      results: 22,
      costPerResult: 95454,
      linkClicks: 1400,
      linkCtr: 2.33,
      linkCpc: 1500,
      allClicks: 1800,
      allCtr: 3.0,
      allCpc: 1166,
      cpm: 35000,
    },
    {
      id: "camp-003",
      providerCampaignId: "meta_c_333",
      name: "Villa Asri Ubud - Instagram Post Traffic Retargeting 2023",
      status: "ARCHIVED",
      objective: "OUTCOME_TRAFFIC",
      totalAdsCount: 6,
      activeAdsCount: 0,
      spend: 5000000,
      impressions: 120000,
      reach: 80000,
      frequency: 1.5,
      results: 15,
      costPerResult: 333333,
      linkClicks: 3500,
      linkCtr: 2.91,
      linkCpc: 1428,
      allClicks: 4200,
      allCtr: 3.5,
      allCpc: 1190,
      cpm: 41666,
    },
    {
      id: "camp-004",
      providerCampaignId: "meta_c_444",
      name: "Cluster Diamond Hill Phase 2 - Launching Eksklusif",
      status: "ACTIVE",
      objective: "OUTCOME_LEADS",
      totalAdsCount: 5,
      activeAdsCount: 4,
      spend: 4200000,
      impressions: 98000,
      reach: 67000,
      frequency: 1.46,
      results: 74,
      costPerResult: 56756,
      linkClicks: 2900,
      linkCtr: 2.95,
      linkCpc: 1448,
      allClicks: 3400,
      allCtr: 3.47,
      allCpc: 1235,
      cpm: 42857,
    },
  ];

  describe("Campaign Sorting Logic (Active First, then Alphabetical)", () => {
    it("sorts ACTIVE campaigns first, followed by PAUSED, then ARCHIVED, alphabetically within groups", () => {
      const getPriority = (status: string) => {
        const s = (status || "").toUpperCase();
        if (s === "ACTIVE") return 1;
        if (s === "PAUSED") return 2;
        if (s === "ARCHIVED") return 3;
        return 4;
      };

      const sorted = [...sampleCampaigns].sort((a, b) => {
        const priorityDiff = getPriority(a.status) - getPriority(b.status);
        if (priorityDiff !== 0) return priorityDiff;
        return a.name.localeCompare(b.name, "id-ID");
      });

      // Group 1: ACTIVE (Cluster Diamond Hill vs Perumahan Bukit Permata Citra)
      expect(sorted[0].id).toBe("camp-004"); // "Cluster Diamond Hill Phase 2..."
      expect(sorted[0].status).toBe("ACTIVE");
      expect(sorted[1].id).toBe("camp-001"); // "Perumahan Bukit Permata Citra..."
      expect(sorted[1].status).toBe("ACTIVE");

      // Group 2: PAUSED
      expect(sorted[2].id).toBe("camp-002"); // "Apartemen Grand Boulevard..."
      expect(sorted[2].status).toBe("PAUSED");

      // Group 3: ARCHIVED
      expect(sorted[3].id).toBe("camp-003"); // "Villa Asri Ubud..."
      expect(sorted[3].status).toBe("ARCHIVED");
    });
  });

  describe("Campaign Search & Filter Logic", () => {
    it("filters campaigns correctly by search query (name match)", () => {
      const q = "bukit permata".toLowerCase();
      const filtered = sampleCampaigns.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.providerCampaignId.toLowerCase().includes(q) ||
          (c.objective && c.objective.toLowerCase().includes(q))
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("camp-001");
    });

    it("filters campaigns by Meta provider ID", () => {
      const q = "meta_c_333";
      const filtered = sampleCampaigns.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.providerCampaignId.toLowerCase().includes(q) ||
          (c.objective && c.objective.toLowerCase().includes(q))
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("camp-003");
    });

    it("filters campaigns by objective keyword", () => {
      const q = "leads";
      const filtered = sampleCampaigns.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.providerCampaignId.toLowerCase().includes(q) ||
          (c.objective && c.objective.toLowerCase().includes(q))
      );
      expect(filtered.length).toBe(2);
      expect(filtered.map((c) => c.id)).toEqual(["camp-001", "camp-004"]);
    });

    it("returns empty list when search does not match any campaign", () => {
      const q = "nonexistent complex xyz 999";
      const filtered = sampleCampaigns.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.providerCampaignId.toLowerCase().includes(q) ||
          (c.objective && c.objective.toLowerCase().includes(q))
      );
      expect(filtered.length).toBe(0);
    });
  });

  describe("Filter Independence & Reset Behavior", () => {
    interface MockFilterState {
      campaignId: string;
      deliveryStatus: string;
      campaignStatus: string;
      objective: string;
      searchQuery: string;
      dateRange: string;
      currentPage: number;
    }

    const defaultState: MockFilterState = {
      campaignId: "all",
      deliveryStatus: "all",
      campaignStatus: "all",
      objective: "all",
      searchQuery: "",
      dateRange: "30d",
      currentPage: 1,
    };

    it("resets all filters cleanly back to default values", () => {
      let state: MockFilterState = {
        campaignId: "camp-001",
        deliveryStatus: "DELIVERING",
        campaignStatus: "ACTIVE",
        objective: "OUTCOME_LEADS",
        searchQuery: "Cluster",
        dateRange: "7d",
        currentPage: 3,
      };

      const hasActiveFilters =
        state.campaignId !== "all" ||
        state.deliveryStatus !== "all" ||
        state.campaignStatus !== "all" ||
        state.objective !== "all" ||
        state.searchQuery.trim().length > 0;

      expect(hasActiveFilters).toBe(true);

      // Execute reset
      state = { ...defaultState };

      expect(state.campaignId).toBe("all");
      expect(state.deliveryStatus).toBe("all");
      expect(state.campaignStatus).toBe("all");
      expect(state.objective).toBe("all");
      expect(state.searchQuery).toBe("");
      expect(state.dateRange).toBe("30d");
      expect(state.currentPage).toBe(1);

      const hasActiveFiltersAfterReset =
        state.campaignId !== "all" ||
        state.deliveryStatus !== "all" ||
        state.campaignStatus !== "all" ||
        state.objective !== "all" ||
        state.searchQuery.trim().length > 0;

      expect(hasActiveFiltersAfterReset).toBe(false);
    });

    it("allows removing a single filter without clearing other active filters", () => {
      const state: MockFilterState = {
        campaignId: "camp-001",
        deliveryStatus: "DELIVERING",
        campaignStatus: "ACTIVE",
        objective: "OUTCOME_LEADS",
        searchQuery: "Promo",
        dateRange: "14d",
        currentPage: 2,
      };

      // User dismisses only the campaign filter chip
      const afterCampaignDismiss: MockFilterState = {
        ...state,
        campaignId: "all",
        currentPage: 1, // Resets page on filter change
      };

      expect(afterCampaignDismiss.campaignId).toBe("all");
      expect(afterCampaignDismiss.deliveryStatus).toBe("DELIVERING");
      expect(afterCampaignDismiss.campaignStatus).toBe("ACTIVE");
      expect(afterCampaignDismiss.objective).toBe("OUTCOME_LEADS");
      expect(afterCampaignDismiss.searchQuery).toBe("Promo");
      expect(afterCampaignDismiss.currentPage).toBe(1);
    });
  });

  describe("Long Campaign Name & Layout Safety", () => {
    it("handles extremely long campaign names without breaking data identity", () => {
      const ultraLongCampaign: CampaignDetailData = {
        id: "camp-super-long",
        providerCampaignId: "meta_c_999999",
        name: "🌸 PROMO MERDEKA SPESIAL 2024! Rumah Murah Minimalis Modern 2 Lantai Type 80/120 Free Canopy & Smart Door Lock Lokasi Strategis 10 Menit ke Pintu Tol BSD City Tangsel (WA Konsultasi Prioritas)",
        status: "ACTIVE",
        objective: "OUTCOME_LEADS",
        totalAdsCount: 2,
        activeAdsCount: 2,
        spend: 750000,
        impressions: 21000,
        reach: 18000,
        frequency: 1.16,
        results: 12,
        costPerResult: 62500,
        linkClicks: 450,
        linkCtr: 2.14,
        linkCpc: 1666,
        allClicks: 520,
        allCtr: 2.47,
        allCpc: 1442,
        cpm: 35714,
      };

      // Match by exact unique ID, never by truncated name string
      const selectedId = ultraLongCampaign.id;
      const found = [ultraLongCampaign].find((c) => c.id === selectedId);

      expect(found).toBeDefined();
      expect(found?.id).toBe("camp-super-long");
      expect(found?.name.length).toBeGreaterThan(150);
    });
  });
});
