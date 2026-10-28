import "server-only";

import {
  MarketingApiError,
  type MetaAdAccountResponse,
  type MetaCampaignResponse,
  type MetaAdResponse,
  type MetaInsightResponse,
  type MetaPaginatedResponse,
  type MetaApiErrorPayload,
  type MetaFacebookPage,
  type MetaInstagramAccount,
} from "./types";
import {
  getMetaMarketingConfig,
  normalizeAdAccountId,
  sanitizeMarketingLog,
} from "./config";

export interface MetaMarketingClientOptions {
  accessToken?: string;
  adAccountId?: string;
  apiVersion?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchFn?: typeof fetch;
}

/**
 * Meta Marketing API Server Client (Read-Only)
 * Connects directly to Meta Graph API (default v21.0) with cursor pagination,
 * rate limit detection, bounded retries, and sanitized error reporting.
 *
 * CRITICAL RULE: This client NEVER modifies campaigns, ads, bids, or budgets.
 * All requests are strictly HTTP GET operations.
 */
export class MetaMarketingApiClient {
  private readonly accessToken: string;
  private readonly defaultAdAccountId: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  /** True when the last fetchAllPages call stopped at the page cap with more data available. */
  public lastFetchTruncated = false;

  constructor(options: MetaMarketingClientOptions = {}) {
    const config = getMetaMarketingConfig({ requireConfigured: false });
    this.accessToken = options.accessToken !== undefined ? options.accessToken : config.accessToken;
    this.defaultAdAccountId = normalizeAdAccountId(options.adAccountId || config.adAccountId);
    this.apiVersion = options.apiVersion || config.apiVersion;
    this.baseUrl = (options.baseUrl || config.baseUrl).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? config.timeoutMs;
    this.maxRetries = options.maxRetries ?? config.maxRetries;
    this.fetchFn = options.fetchFn || fetch;
  }

  /**
   * Fetches Facebook Pages managed by the authenticated user along with connected Instagram business accounts.
   * Endpoint: GET /v21.0/me/accounts
   */
  async getFacebookPages(): Promise<MetaFacebookPage[]> {
    const fields = "id,name,category,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}";
    const endpoint = `/me/accounts?fields=${fields}&limit=50`;
    return this.fetchAllPages<MetaFacebookPage>(endpoint);
  }

  /**
   * Fetches the connected Instagram Professional Account for a given Page ID.
   * Endpoint: GET /v21.0/{pageId}?fields=instagram_business_account{...}
   */
  async getInstagramAccount(pageId: string): Promise<MetaInstagramAccount | null> {
    const fields = "instagram_business_account{id,username,name,profile_picture_url}";
    const endpoint = `/${pageId}?fields=${fields}`;
    try {
      const response = await this.requestSingle<{ instagram_business_account?: MetaInstagramAccount }>(endpoint);
      return response.instagram_business_account || null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches list of authorized Ad Accounts for the authenticated access token.
   * Endpoint: GET /v21.0/me/adaccounts
   */
  async getAdAccounts(): Promise<MetaAdAccountResponse[]> {
    const fields = "id,account_id,name,currency,timezone_name,account_status,business_name";
    const endpoint = `/me/adaccounts?fields=${fields}&limit=50`;
    return this.fetchAllPages<MetaAdAccountResponse>(endpoint);
  }

  /**
   * Fetches metadata for a single Ad Account.
   * Endpoint: GET /v21.0/act_<ID>
   */
  async getAdAccount(targetAdAccountId?: string): Promise<MetaAdAccountResponse> {
    const accountId = normalizeAdAccountId(targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const fields = "id,account_id,name,currency,timezone_name,account_status,business_name";
    const endpoint = `/${accountId}?fields=${fields}`;
    return this.requestSingle<MetaAdAccountResponse>(endpoint);
  }

  /**
   * Fetches all active & paused campaigns for an Ad Account.
   * Endpoint: GET /v21.0/act_<ID>/campaigns
   */
  async getCampaigns(targetAdAccountId?: string): Promise<MetaCampaignResponse[]> {
    const accountId = normalizeAdAccountId(targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const fields = "id,name,status,objective,created_time,updated_time";
    const endpoint = `/${accountId}/campaigns?fields=${fields}&limit=100`;
    return this.fetchAllPages<MetaCampaignResponse>(endpoint);
  }

  /**
   * Fetches all active & paused ads for an Ad Account.
   * Endpoint: GET /v21.0/act_<ID>/ads
   */
  async getAds(targetAdAccountId?: string): Promise<MetaAdResponse[]> {
    const accountId = normalizeAdAccountId(targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const fields = "id,name,status,campaign_id,adset_id,created_time,updated_time";
    const endpoint = `/${accountId}/ads?fields=${fields}&limit=100`;
    return this.fetchAllPages<MetaAdResponse>(endpoint);
  }

  /**
   * Fetches ad-level performance insights for a date range or preset.
   * Endpoint: GET /v21.0/act_<ID>/insights?level=ad
   */
  async getAdInsights(options: {
    targetAdAccountId?: string;
    timeRange?: { since: string; until: string };
    datePreset?: string;
    timeIncrement?: number | "all_days";
    limit?: number;
  } = {}): Promise<MetaInsightResponse[]> {
    const accountId = normalizeAdAccountId(options.targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const isDailyOrIncrement = options.timeIncrement !== undefined && options.timeIncrement !== "all_days";
    const fieldList = [
      "ad_id",
      "ad_name",
      "campaign_id",
      "campaign_name",
      "adset_id",
      "adset_name",
      "spend",
      "impressions",
      "clicks",
      "reach",
      "frequency",
      "cpm",
      "cpc",
      "ctr",
      "inline_link_clicks",
      "inline_link_click_ctr",
      "cost_per_inline_link_click",
      "actions",
      "action_values",
      "cost_per_action_type",
      ...(isDailyOrIncrement
        ? []
        : ["quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking"]),
      "date_start",
      "date_stop",
    ];

    const fields = fieldList.join(",");

    const params = new URLSearchParams({
      level: "ad",
      fields,
      use_account_attribution_setting: "true",
      limit: String(options.limit ?? 50),
    });

    if (options.timeIncrement !== undefined) {
      params.set("time_increment", String(options.timeIncrement));
    }

    if (options.datePreset) {
      params.set("date_preset", options.datePreset);
    } else if (options.timeRange?.since && options.timeRange?.until) {
      params.set(
        "time_range",
        JSON.stringify({
          since: options.timeRange.since,
          until: options.timeRange.until,
        })
      );
    }

    const endpoint = `/${accountId}/insights?${params.toString()}`;
    return this.fetchAllPages<MetaInsightResponse>(endpoint);
  }

  /**
   * Traverses cursor-based pagination to collect all records up to a safe maximum.
   */
  private async fetchAllPages<T>(initialEndpoint: string, maxPages = 20): Promise<T[]> {
    this.lastFetchTruncated = false;
    const allRecords: T[] = [];
    let currentEndpoint: string | null = initialEndpoint;
    let pageCount = 0;

    while (currentEndpoint && pageCount < maxPages) {
      pageCount++;
      const response: MetaPaginatedResponse<T> =
        await this.requestSingle<MetaPaginatedResponse<T>>(currentEndpoint);

      if (response?.data && Array.isArray(response.data)) {
        if (response.data.length === 0) {
          break;
        }
        allRecords.push(...response.data);
      } else {
        break;
      }

      // Check for cursor next page
      if (response?.paging?.next) {
        currentEndpoint = response.paging.next;
      } else if (response?.paging?.cursors?.after) {
        // If after cursor provided but no next URL, append cursor
        const separator = initialEndpoint.includes("?") ? "&" : "?";
        currentEndpoint = `${initialEndpoint}${separator}after=${encodeURIComponent(
          response.paging.cursors.after
        )}`;
      } else {
        currentEndpoint = null;
      }
    }

    if (currentEndpoint && pageCount >= maxPages) {
      this.lastFetchTruncated = true;
    }

    return allRecords;
  }

  /**
   * Executes a single HTTP GET request with retries, timeout, and error classification.
   */
  private async requestSingle<T>(path: string): Promise<T> {
    if (!this.accessToken || this.accessToken.trim() === "") {
      throw new MarketingApiError({
        code: "MISSING_CONFIGURATION",
        message: "Meta Marketing API access token is not configured. Set META_ACCESS_TOKEN in server environment.",
        isRecoverable: false,
      });
    }

    // Prepare full URL (handles both relative endpoints and absolute pagination URLs)
    const isFullUrl = path.startsWith("http://") || path.startsWith("https://");
    const url = isFullUrl
      ? path
      : `${this.baseUrl}/${this.apiVersion}${path.startsWith("/") ? path : `/${path}`}`;

    let lastError: unknown = null;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchFn(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: "application/json",
            "User-Agent": "PropertyAdsIntelligence/0.1.0 (Meta-Marketing-Sync)",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Success response
        if (response.ok) {
          const data = (await response.json()) as T;
          return data;
        }

        // Non-200 Graph API response
        const statusCode = response.status;
        let errorPayload: MetaApiErrorPayload | null = null;
        let rawBody = "";

        try {
          rawBody = await response.text();
          errorPayload = JSON.parse(rawBody) as MetaApiErrorPayload;
        } catch {
          // Non-JSON response
        }

        const sanitizedMsg = sanitizeMarketingLog(
          errorPayload?.error?.message || rawBody || `HTTP ${statusCode}`,
          this.accessToken
        );
        const metaCode = errorPayload?.error?.code;
        const metaSubcode = errorPayload?.error?.error_subcode;
        const fbtraceId = errorPayload?.error?.fbtrace_id;

        // Check for Token Expiration / Invalid Token (Code 190)
        if (metaCode === 190 || statusCode === 401) {
          throw new MarketingApiError({
            code: "AUTHENTICATION_ERROR",
            message: `Meta Access Token tidak valid atau telah kedaluwarsa (Code 190): ${sanitizedMsg}`,
            metaErrorCode: metaCode ?? 190,
            metaErrorSubcode: metaSubcode,
            statusCode,
            fbtraceId,
            isRecoverable: false,
          });
        }

        // Check for Permissions Error (Code 200, 294, etc.)
        if (metaCode === 200 || metaCode === 294 || statusCode === 403) {
          throw new MarketingApiError({
            code: "PERMISSION_ERROR",
            message: `Izin akses Meta Marketing API tidak mencukupi. Pastikan token memiliki izin 'ads_read' dan 'read_insights': ${sanitizedMsg}`,
            metaErrorCode: metaCode,
            metaErrorSubcode: metaSubcode,
            statusCode,
            fbtraceId,
            isRecoverable: false,
          });
        }

        // Check for Rate Limit Error (Codes 17, 32, 613, or HTTP 429)
        if (metaCode === 17 || metaCode === 32 || metaCode === 613 || statusCode === 429) {
          const rateLimitErr = new MarketingApiError({
            code: "RATE_LIMIT_ERROR",
            message: `Batas panggilan Meta Marketing API tercapai (Rate Limit Code ${metaCode || 429}): ${sanitizedMsg}`,
            metaErrorCode: metaCode,
            metaErrorSubcode: metaSubcode,
            statusCode,
            fbtraceId,
            isRecoverable: true,
          });

          if (attempt <= this.maxRetries) {
            lastError = rateLimitErr;
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
          throw rateLimitErr;
        }

        // Check for Meta Query Overload / Reduce Data Request (Code 1)
        if (metaCode === 1 && sanitizedMsg.toLowerCase().includes("reduce the amount of data")) {
          throw new MarketingApiError({
            code: "UPSTREAM_ERROR",
            message: `Beban data kueri Meta Graph API melampaui batas server Meta. Persempit rentang tanggal analisis atau gunakan periode 30-90 hari terakhir: ${sanitizedMsg}`,
            metaErrorCode: 1,
            statusCode,
            fbtraceId,
            isRecoverable: true,
          });
        }

        // Check for Account Not Found (Code 100 on missing ad account)
        if (metaCode === 100 && (sanitizedMsg.toLowerCase().includes("does not exist") || sanitizedMsg.toLowerCase().includes("unsupported get request"))) {
          throw new MarketingApiError({
            code: "ACCOUNT_NOT_FOUND",
            message: `Ad Account tidak ditemukan atau belum diotorisasi untuk token ini: ${sanitizedMsg}`,
            metaErrorCode: metaCode,
            statusCode,
            fbtraceId,
            isRecoverable: false,
          });
        }

        // 5xx Upstream server error (Recoverable)
        if (statusCode >= 500 && statusCode < 600) {
          const upstreamErr = new MarketingApiError({
            code: "UPSTREAM_ERROR",
            message: `Meta Graph API server error (HTTP ${statusCode}): ${sanitizedMsg}`,
            metaErrorCode: metaCode,
            statusCode,
            fbtraceId,
            isRecoverable: true,
          });

          if (attempt <= this.maxRetries) {
            lastError = upstreamErr;
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
          throw upstreamErr;
        }

        // Other client errors (400, 404, etc. - Not recoverable)
        throw new MarketingApiError({
          code: "UPSTREAM_ERROR",
          message: `Meta Marketing API error (HTTP ${statusCode}, Code ${metaCode}): ${sanitizedMsg}`,
          metaErrorCode: metaCode,
          statusCode,
          fbtraceId,
          isRecoverable: false,
        });
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof MarketingApiError) {
          throw err;
        }

        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.toLowerCase().includes("aborted"));

        if (isAbort) {
          const timeoutErr = new MarketingApiError({
            code: "TIMEOUT_ERROR",
            message: `Permintaan Meta Marketing API melampaui batas waktu (${this.timeoutMs}ms).`,
            isRecoverable: true,
            cause: err,
          });

          if (attempt <= this.maxRetries) {
            lastError = timeoutErr;
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
          throw timeoutErr;
        }

        const sanitizedErrMsg = sanitizeMarketingLog(
          err instanceof Error ? err.message : String(err),
          this.accessToken
        );

        const networkErr = new MarketingApiError({
          code: "UPSTREAM_ERROR",
          message: `Koneksi jaringan ke Meta Marketing API gagal: ${sanitizedErrMsg}`,
          isRecoverable: true,
          cause: err,
        });

        if (attempt <= this.maxRetries) {
          lastError = networkErr;
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }
        throw networkErr;
      }
    }

    throw lastError || new Error("Meta Marketing API request failed after retries.");
  }

  private assertAccountId(accountId?: string): asserts accountId is string {
    if (!accountId || accountId.trim() === "") {
      throw new MarketingApiError({
        code: "MISSING_CONFIGURATION",
        message: "Target Ad Account ID tidak ditentukan. Tentukan META_AD_ACCOUNT_ID di server environment atau berikan parameter targetAdAccountId.",
        isRecoverable: false,
      });
    }
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = 300;
    const exponential = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 100);
    return Math.min(exponential + jitter, 3000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let defaultMarketingClient: MetaMarketingApiClient | null = null;

export function getMetaMarketingApiClient(): MetaMarketingApiClient {
  if (!defaultMarketingClient) {
    defaultMarketingClient = new MetaMarketingApiClient();
  }
  return defaultMarketingClient;
}
