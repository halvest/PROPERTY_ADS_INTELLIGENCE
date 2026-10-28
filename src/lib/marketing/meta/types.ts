/**
 * Property Ads Intelligence - Meta Marketing API Types
 * Definitions for Meta Graph API v21.0 responses, pagination, rate limits, and internal domain models.
 */

export type MarketingErrorCode =
  | "MISSING_CONFIGURATION"
  | "FORBIDDEN"
  | "AUTHENTICATION_ERROR"   // Code 190 (Expired/Invalid OAuth Token)
  | "PERMISSION_ERROR"       // Code 200, 294 (Missing ads_read / read_insights)
  | "RATE_LIMIT_ERROR"       // Code 17, 32, 613 (Throttling / calls limit)
  | "TIMEOUT_ERROR"
  | "ACCOUNT_NOT_FOUND"      // Code 100 / invalid ad account id
  | "UPSTREAM_ERROR";

export class MarketingApiError extends Error {
  readonly code: MarketingErrorCode;
  readonly isRecoverable: boolean;
  readonly metaErrorCode?: number;
  readonly metaErrorSubcode?: number;
  readonly statusCode?: number;
  readonly fbtraceId?: string;

  constructor(options: {
    code: MarketingErrorCode;
    message: string;
    isRecoverable?: boolean;
    metaErrorCode?: number;
    metaErrorSubcode?: number;
    statusCode?: number;
    fbtraceId?: string;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "MarketingApiError";
    this.code = options.code;
    this.isRecoverable = options.isRecoverable ?? false;
    this.metaErrorCode = options.metaErrorCode;
    this.metaErrorSubcode = options.metaErrorSubcode;
    this.statusCode = options.statusCode;
    this.fbtraceId = options.fbtraceId;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export interface MetaMarketingConfig {
  accessToken: string;
  adAccountId: string; // Standardized with "act_" prefix
  rawAdAccountId: string; // Numeric string without prefix
  appId?: string;
  appSecret?: string;
  apiVersion: string; // e.g. "v21.0"
  baseUrl: string; // e.g. "https://graph.facebook.com"
  timeoutMs: number;
  maxRetries: number;
  isConfigured: boolean;
}

export interface MetaAdAccountResponse {
  id: string; // e.g. "act_123456789"
  account_id: string; // e.g. "123456789"
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number; // 1 = ACTIVE, 2 = DISABLED, 3 = UNSETTLED, 7 = PENDING_RISK_REVIEW, 8 = PENDING_SETTLEMENT, 9 = IN_GRACE_PERIOD, 100 = PENDING_CLOSURE, 101 = CLOSED
  business_name?: string;
}

export interface MetaCampaignResponse {
  id: string;
  name: string;
  status: string; // "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED"
  objective?: string;
  created_time?: string;
  updated_time?: string;
}

export interface MetaAdResponse {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  adset_id?: string;
  created_time?: string;
  updated_time?: string;
}

export interface MetaInsightResponse {
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  spend: string; // String decimal, e.g. "450000.00"
  impressions: string; // String integer
  clicks: string; // String integer
  reach?: string;
  frequency?: string;
  link_clicks?: string;
  inline_link_clicks?: string;
  inline_link_click_ctr?: string;
  cost_per_inline_link_click?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  attribution_setting?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  date_start: string; // "YYYY-MM-DD"
  date_stop: string; // "YYYY-MM-DD"
}

export interface MetaPagingCursors {
  before?: string;
  after?: string;
}

export interface MetaPaging {
  cursors?: MetaPagingCursors;
  next?: string;
  previous?: string;
}

export interface MetaPaginatedResponse<T> {
  data: T[];
  paging?: MetaPaging;
}

export interface MetaApiErrorPayload {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
    is_transient?: boolean;
    error_user_title?: string;
    error_user_msg?: string;
  };
}

// Internal normalized models for idempotent persistence
export interface NormalizedAdAccount {
  organizationId: string;
  provider: "meta" | "demo";
  providerAccountId: string;
  accountName: string;
  currency: string;
  timezone: string;
  connectionStatus: "connected" | "disconnected" | "error";
  lastSyncedAt?: string;
}

export interface NormalizedCampaign {
  organizationId: string;
  adAccountId: string; // Internal UUID or mapped reference
  providerCampaignId: string;
  name: string;
  status: string;
  objective?: string | null;
}

export interface NormalizedAd {
  organizationId: string;
  campaignId: string; // Internal UUID or mapped reference
  providerAdId: string;
  name: string;
  status: string;
}

export interface NormalizedAdInsight {
  organizationId: string;
  adId: string; // Internal UUID or mapped reference
  dateStart: string;
  dateStop: string;
  level: "ad" | "campaign";
  spend: number;
  impressions: number;
  clicks: number;
  reach?: number;
  linkClicks?: number;
  conversions?: number;
  adsetId?: string | null;
  adsetName?: string | null;
  attributionSetting?: string | null;
  currency: string;
  source: "meta" | "demo";
  actionBreakdown?: Record<string, number>;
  conversionActionType?: string | null;
  mappingVersion?: string;
}

export interface MarketingSyncResult {
  status: "success" | "partial" | "failed";
  mode: "live" | "demo";
  adAccountsSynced: number;
  campaignsSynced: number;
  adsSynced: number;
  insightsSynced: number;
  recordsProcessed: number;
  recordsRejected: number;
  syncedAt: string;
  dateRange?: { since: string; until: string };
  error?: string;
  syncJobId?: string;
}

export interface MetaInstagramAccount {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
}

export interface MetaFacebookPage {
  id: string;
  name: string;
  category?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: MetaInstagramAccount;
}

export interface MetaAssetSelection {
  id?: string;
  organizationId: string;
  pageId?: string | null;
  pageName?: string | null;
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
  adAccountId: string;
  adAccountName?: string | null;
  connectionStatus: "connected" | "disconnected" | "error" | "pending_selection";
  lastValidatedAt?: string | null;
}

export interface MetaAvailableAssetsResponse {
  pages: MetaFacebookPage[];
  adAccounts: MetaAdAccountResponse[];
  selected?: MetaAssetSelection | null;
}


