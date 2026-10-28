import "server-only";

import type {
  MetaAdAccountResponse,
  MetaCampaignResponse,
  MetaAdResponse,
  MetaInsightResponse,
} from "./types";
import type { MetaMarketingApiClient } from "./client";

export const MOCK_META_AD_ACCOUNT: MetaAdAccountResponse = {
  id: "act_0812999001",
  account_id: "0812999001",
  name: "Demo Developer Nusantara - Meta Ads Account",
  currency: "IDR",
  timezone_name: "Asia/Jakarta",
  account_status: 1, // 1 = ACTIVE
  business_name: "PT Pengembang Properti Nusantara",
};

export const MOCK_META_CAMPAIGNS: MetaCampaignResponse[] = [
  {
    id: "cmp_sapphire_bsd",
    name: "Kampanye Cluster Sapphire BSD",
    status: "ACTIVE",
    objective: "OUTCOME_LEADS",
    created_time: "2026-10-01T08:00:00+07:00",
    updated_time: "2026-10-26T10:00:00+07:00",
  },
  {
    id: "cmp_emerald_residence",
    name: "Kampanye Emerald Residence Bintaro",
    status: "ACTIVE",
    objective: "OUTCOME_LEADS",
    created_time: "2026-10-05T09:00:00+07:00",
    updated_time: "2026-10-25T14:30:00+07:00",
  },
  {
    id: "cmp_grand_serpong",
    name: "Kampanye Grand Serpong Hills",
    status: "PAUSED",
    objective: "OUTCOME_TRAFFIC",
    created_time: "2026-09-15T11:00:00+07:00",
    updated_time: "2026-10-20T16:00:00+07:00",
  },
];

export const MOCK_META_ADS: MetaAdResponse[] = [
  {
    id: "ad_sapphire_72",
    name: "Cluster Sapphire BSD - Tipe 72 Hook Siap Huni",
    status: "ACTIVE",
    campaign_id: "cmp_sapphire_bsd",
    adset_id: "adset_sapphire_leads",
    created_time: "2026-10-01T08:30:00+07:00",
    updated_time: "2026-10-26T10:00:00+07:00",
  },
  {
    id: "ad_sapphire_promo",
    name: "Cluster Sapphire BSD - Promo DP 0% Cicilan Ringan",
    status: "ACTIVE",
    campaign_id: "cmp_sapphire_bsd",
    adset_id: "adset_sapphire_leads",
    created_time: "2026-10-02T09:00:00+07:00",
    updated_time: "2026-10-26T10:00:00+07:00",
  },
  {
    id: "ad_emerald_hook",
    name: "Emerald Residence Bintaro - Tipe 85 Hook Premium",
    status: "ACTIVE",
    campaign_id: "cmp_emerald_residence",
    adset_id: "adset_emerald_leads",
    created_time: "2026-10-05T09:30:00+07:00",
    updated_time: "2026-10-25T14:30:00+07:00",
  },
  {
    id: "ad_serpong_view",
    name: "Grand Serpong Hills - View Danau Alami",
    status: "PAUSED",
    campaign_id: "cmp_grand_serpong",
    adset_id: "adset_serpong_traffic",
    created_time: "2026-09-15T11:30:00+07:00",
    updated_time: "2026-10-20T16:00:00+07:00",
  },
];

export const MOCK_META_INSIGHTS: MetaInsightResponse[] = [
  {
    ad_id: "ad_sapphire_72",
    ad_name: "Cluster Sapphire BSD - Tipe 72 Hook Siap Huni",
    campaign_id: "cmp_sapphire_bsd",
    campaign_name: "Kampanye Cluster Sapphire BSD",
    spend: "4500000.00",
    impressions: "48200",
    clicks: "1250",
    cpc: "3600.00",
    cpm: "93361.00",
    ctr: "2.59",
    date_start: "2026-10-01",
    date_stop: "2026-10-26",
  },
  {
    ad_id: "ad_sapphire_promo",
    ad_name: "Cluster Sapphire BSD - Promo DP 0% Cicilan Ringan",
    campaign_id: "cmp_sapphire_bsd",
    campaign_name: "Kampanye Cluster Sapphire BSD",
    spend: "3200000.00",
    impressions: "39100",
    clicks: "980",
    cpc: "3265.31",
    cpm: "81841.43",
    ctr: "2.51",
    date_start: "2026-10-01",
    date_stop: "2026-10-26",
  },
  {
    ad_id: "ad_emerald_hook",
    ad_name: "Emerald Residence Bintaro - Tipe 85 Hook Premium",
    campaign_id: "cmp_emerald_residence",
    campaign_name: "Kampanye Emerald Residence Bintaro",
    spend: "5800000.00",
    impressions: "62400",
    clicks: "1640",
    cpc: "3536.59",
    cpm: "92948.72",
    ctr: "2.63",
    date_start: "2026-10-01",
    date_stop: "2026-10-26",
  },
  {
    ad_id: "ad_serpong_view",
    ad_name: "Grand Serpong Hills - View Danau Alami",
    campaign_id: "cmp_grand_serpong",
    campaign_name: "Kampanye Grand Serpong Hills",
    spend: "2100000.00",
    impressions: "28500",
    clicks: "620",
    cpc: "3387.10",
    cpm: "73684.21",
    ctr: "2.18",
    date_start: "2026-10-01",
    date_stop: "2026-10-26",
  },
];

export const MOCK_META_PAGES = [
  {
    id: "page_sapphire_bsd_01",
    name: "Cluster Sapphire BSD Official",
    category: "Real Estate Developer",
    instagram_business_account: {
      id: "ig_sapphire_bsd",
      username: "sapphire.bsd.official",
      name: "Cluster Sapphire BSD",
    },
  },
  {
    id: "page_emerald_bintaro_02",
    name: "Emerald Residence Bintaro",
    category: "Property Marketing",
    instagram_business_account: {
      id: "ig_emerald_bintaro",
      username: "emerald.residence.id",
      name: "Emerald Residence",
    },
  },
  {
    id: "page_nusantara_holding_03",
    name: "PT Pengembang Properti Nusantara",
    category: "Real Estate Agency",
  },
];

/**
 * Mock implementation of MetaMarketingApiClient for testing and offline demo mode.
 */
export class MockMetaMarketingApiClient implements Pick<
  MetaMarketingApiClient,
  "getAdAccounts" | "getAdAccount" | "getCampaigns" | "getAds" | "getAdInsights" | "getFacebookPages" | "getInstagramAccount"
> {
  async getFacebookPages() {
    return [...MOCK_META_PAGES];
  }

  async getInstagramAccount(pageId: string) {
    const page = MOCK_META_PAGES.find((p) => p.id === pageId);
    return page?.instagram_business_account || null;
  }

  async getAdAccounts(): Promise<MetaAdAccountResponse[]> {
    return [MOCK_META_AD_ACCOUNT];
  }

  async getAdAccount(): Promise<MetaAdAccountResponse> {
    return MOCK_META_AD_ACCOUNT;
  }

  async getCampaigns(): Promise<MetaCampaignResponse[]> {
    return [...MOCK_META_CAMPAIGNS];
  }

  async getAds(): Promise<MetaAdResponse[]> {
    return [...MOCK_META_ADS];
  }

  async getAdInsights(options: {
    targetAdAccountId?: string;
    timeRange?: { since: string; until: string };
    datePreset?: string;
    timeIncrement?: number | "all_days";
    limit?: number;
  } = {}): Promise<MetaInsightResponse[]> {
    if (options.timeRange?.since && options.timeRange?.until) {
      return MOCK_META_INSIGHTS.map((item) => ({
        ...item,
        date_start: options.timeRange!.since,
        date_stop: options.timeRange!.until,
      }));
    }
    return [...MOCK_META_INSIGHTS];
  }
}
