import "server-only";

import {
  AD_EFFECTIVE_STATUSES,
  ADSET_EFFECTIVE_STATUSES,
  ALL_EFFECTIVE_STATUSES,
  CAMPAIGN_EFFECTIVE_STATUSES,
  MarketingApiError,
  type MetaAdAccountResponse,
  type MetaCampaignResponse,
  type MetaAdSetResponse,
  type MetaAdResponse,
  type MetaInsightResponse,
  type MetaAccountInsightResponse,
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

export { AD_EFFECTIVE_STATUSES, ADSET_EFFECTIVE_STATUSES, ALL_EFFECTIVE_STATUSES, CAMPAIGN_EFFECTIVE_STATUSES };

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
 * Connects directly to Meta Graph API (default v27.0) with strict cursor pagination
 * (`while (hasNextPage)` traversal via `paging.cursors.after`), comprehensive
 * `effective_status` filtering, BUC rate limit header throttling, bounded retries,
 * and sanitized error reporting.
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
  /** Pages actually fetched by the last fetchAllPages call. */
  public lastFetchPages = 0;
  /** Whether Meta indicated another page existed when traversal stopped. */
  public lastFetchHasMore = false;
  /** Latest parsed Meta Business Use Case (BUC) / Ad Account usage telemetry header. */
  public lastBucUsageHeader: Record<string, unknown> | null = null;

  constructor(options: MetaMarketingClientOptions = {}) {
    const config = getMetaMarketingConfig({ requireConfigured: false });
    // Tenant credentials and account context must always be explicit. Global
    // environment credentials are never a fallback for a client organization.
    this.accessToken = options.accessToken || "";
    this.defaultAdAccountId = normalizeAdAccountId(options.adAccountId);
    this.apiVersion = options.apiVersion || config.apiVersion;
    this.baseUrl = (options.baseUrl || config.baseUrl).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? config.timeoutMs;
    this.maxRetries = options.maxRetries ?? config.maxRetries;
    this.fetchFn = options.fetchFn || fetch;
  }

  /** Creates an independent pagination-state client for parallel Insights requests. */
  fork(): MetaMarketingApiClient {
    return new MetaMarketingApiClient({
      accessToken: this.accessToken,
      adAccountId: this.defaultAdAccountId,
      apiVersion: this.apiVersion,
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      fetchFn: this.fetchFn,
    });
  }

  /**
   * Fetches Facebook Pages managed by the authenticated user along with connected Instagram business accounts.
   * Endpoint: GET /v27.0/me/accounts
   */
  async getFacebookPages(): Promise<MetaFacebookPage[]> {
    // Page access tokens are never requested: they are credentials and must
    // not flow toward any caller that serializes pages to a browser.
    const fields = "id,name,category,tasks,instagram_business_account{id,username,name,profile_picture_url}";
    const endpoint = `/me/accounts?fields=${fields}&limit=50`;
    const pages = await this.fetchAllPages<MetaFacebookPage>(endpoint, 8);
    return pages.map((p) => ({ ...p, access_token: undefined }));
  }

  /**
   * Fetches the connected Instagram Professional Account for a given Page ID.
   * Endpoint: GET /v27.0/{pageId}?fields=instagram_business_account{...}
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
   * Endpoint: GET /v27.0/me/adaccounts
   */
  async getAdAccounts(): Promise<MetaAdAccountResponse[]> {
    this.lastFetchTruncated = false;
    const fields = "id,account_id,name,currency,timezone_name,account_status,business_name";
    const endpoint = `/me/adaccounts?fields=${fields}&limit=50`;
    const accounts = await this.fetchAllPages<MetaAdAccountResponse>(endpoint, 8);
    if (this.lastFetchTruncated) {
      throw new MarketingApiError({
        code: "PAGINATION_ERROR",
        message: "Meta account discovery exceeded its safe pagination limit; refresh later or contact support.",
        isRecoverable: true,
      });
    }
    return accounts;
  }

  /**
   * Fetches metadata for a single Ad Account.
   * Endpoint: GET /v27.0/act_<ID>
   */
  async getAdAccount(targetAdAccountId?: string): Promise<MetaAdAccountResponse> {
    const accountId = normalizeAdAccountId(targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const fields = "id,account_id,name,currency,timezone_name,account_status,business_name";
    const endpoint = `/${accountId}?fields=${fields}`;
    return this.requestSingle<MetaAdAccountResponse>(endpoint);
  }

  /**
   * Fetches campaigns for an ad account using cursor pagination.
   * The status filter is limited to values this edge accepts, so the first request succeeds.
   * Endpoint: GET /v27.0/act_<ID>/campaigns
   */
  async getCampaigns(targetAdAccountId?: string): Promise<MetaCampaignResponse[]> {
    const accountId = normalizeAdAccountId(targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const fields = "id,name,status,effective_status,objective,created_time,updated_time";
    const params = new URLSearchParams({
      fields,
      effective_status: JSON.stringify(CAMPAIGN_EFFECTIVE_STATUSES),
      limit: "100",
    });
    const endpoint = `/${accountId}/campaigns?${params.toString()}`;
    try {
      return await this.fetchAllPages<MetaCampaignResponse>(endpoint, 200);
    } catch (err) {
      if (err instanceof MarketingApiError && err.metaErrorCode === 100) {
        return this.fetchAllPages<MetaCampaignResponse>(
          `/${accountId}/campaigns?fields=${fields}&limit=100`,
          200
        );
      }
      throw err;
    }
  }

  /**
   * Fetches ad sets for an ad account using cursor pagination.
   * Endpoint: GET /v27.0/act_<ID>/adsets
   */
  async getAdSets(targetAdAccountId?: string): Promise<MetaAdSetResponse[]> {
    const accountId = normalizeAdAccountId(targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const fields = "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,created_time,updated_time";
    const params = new URLSearchParams({
      fields,
      effective_status: JSON.stringify(ADSET_EFFECTIVE_STATUSES),
      limit: "100",
    });
    const endpoint = `/${accountId}/adsets?${params.toString()}`;
    try {
      return await this.fetchAllPages<MetaAdSetResponse>(endpoint, 200);
    } catch (err) {
      if (err instanceof MarketingApiError && err.metaErrorCode === 100) {
        return this.fetchAllPages<MetaAdSetResponse>(
          `/${accountId}/adsets?fields=${fields}&limit=100`,
          200
        );
      }
      throw err;
    }
  }

  /**
   * Fetches ads for an ad account using cursor pagination.
   * Endpoint: GET /v27.0/act_<ID>/ads
   */
  async getAds(targetAdAccountId?: string): Promise<MetaAdResponse[]> {
    const accountId = normalizeAdAccountId(targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const fields = "id,name,status,effective_status,campaign_id,adset_id,created_time,updated_time";
    const params = new URLSearchParams({
      fields,
      effective_status: JSON.stringify(AD_EFFECTIVE_STATUSES),
      limit: "100",
    });
    const endpoint = `/${accountId}/ads?${params.toString()}`;
    try {
      return await this.fetchAllPages<MetaAdResponse>(endpoint, 200);
    } catch (err) {
      if (err instanceof MarketingApiError && err.metaErrorCode === 100) {
        return this.fetchAllPages<MetaAdResponse>(
          `/${accountId}/ads?fields=${fields}&limit=100`,
          200
        );
      }
      throw err;
    }
  }

  /**
   * Splits a wide `timeRange` into safe windows (max `maxDaysPerWindow` days each)
   * so Meta Graph API `/insights` with `time_increment=1` never rejects or truncates
   * multi-year historical syncs.
   */
  private splitTimeRangeWindows(
    timeRange: { since: string; until: string },
    maxDaysPerWindow = 365
  ): Array<{ since: string; until: string }> {
    const startMs = Date.parse(`${timeRange.since}T00:00:00Z`);
    const endMs = Date.parse(`${timeRange.until}T00:00:00Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return [timeRange];
    }
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((endMs - startMs) / dayMs) + 1;
    if (totalDays <= maxDaysPerWindow) {
      return [timeRange];
    }

    const windows: Array<{ since: string; until: string }> = [];
    let cursorMs = startMs;
    while (cursorMs <= endMs) {
      const windowEndMs = Math.min(cursorMs + (maxDaysPerWindow - 1) * dayMs, endMs);
      windows.push({
        since: new Date(cursorMs).toISOString().slice(0, 10),
        until: new Date(windowEndMs).toISOString().slice(0, 10),
      });
      cursorMs = windowEndMs + dayMs;
    }
    return windows;
  }

  /**
   * Fetches ad-level (`level=ad`) performance insights for a date range or preset,
   * traversing all cursor pages and applying the 7-day click / 1-day view attribution window.
   * Automatically splits multi-year `timeRange` spans into 365-day windows when `timeIncrement`
   * is daily so Meta Graph API never rejects or drops historical rows.
   * Endpoint: GET /v27.0/act_<ID>/insights?level=ad
   */
  async getAdInsights(options: {
    targetAdAccountId?: string;
    timeRange?: { since: string; until: string };
    datePreset?: string;
    timeIncrement?: number | "all_days";
    limit?: number;
    maxPages?: number;
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
      "account_currency",
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
    const maxPages = options.maxPages ?? 20;

    const buildEndpoint = (rangeOverride?: { since: string; until: string }) => {
      const params = new URLSearchParams({
        level: "ad",
        fields,
        use_account_attribution_setting: "true",
        action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
        limit: String(options.limit ?? 50),
      });

      if (options.timeIncrement !== undefined) {
        params.set("time_increment", String(options.timeIncrement));
      }

      if (options.datePreset) {
        params.set("date_preset", options.datePreset);
      } else if (rangeOverride?.since && rangeOverride?.until) {
        params.set(
          "time_range",
          JSON.stringify({
            since: rangeOverride.since,
            until: rangeOverride.until,
          })
        );
      }
      return `/${accountId}/insights?${params.toString()}`;
    };

    if (!options.datePreset && options.timeRange?.since && options.timeRange?.until) {
      const windows = this.splitTimeRangeWindows(options.timeRange, 365);
      if (windows.length > 1) {
        const aggregated: MetaInsightResponse[] = [];
        let totalPages = 0;
        let anyTruncated = false;
        let anyHasMore = false;
        for (const win of windows) {
          const rows = await this.fetchAllPages<MetaInsightResponse>(buildEndpoint(win), maxPages);
          aggregated.push(...rows);
          totalPages += this.lastFetchPages;
          if (this.lastFetchTruncated) anyTruncated = true;
          if (this.lastFetchHasMore) anyHasMore = true;
        }
        this.lastFetchPages = totalPages;
        this.lastFetchTruncated = anyTruncated;
        this.lastFetchHasMore = anyHasMore;
        return aggregated;
      }
    }

    return this.fetchAllPages<MetaInsightResponse>(buildEndpoint(options.timeRange), maxPages);
  }

  /**
   * Fetches account-level Insights for one exact date range. Meta computes
   * reach and frequency at the account scope, so these values remain valid
   * across multiple campaigns, ads, and days.
   */
  async getAccountInsights(options: {
    targetAdAccountId?: string;
    timeRange: { since: string; until: string };
    datePreset?: string;
    limit?: number;
    maxPages?: number;
  }): Promise<MetaAccountInsightResponse[]> {
    const accountId = normalizeAdAccountId(options.targetAdAccountId || this.defaultAdAccountId);
    this.assertAccountId(accountId);

    const buildAccountEndpoint = (range: { since: string; until: string }) => {
      const params = new URLSearchParams({
        level: "account",
        fields: "spend,impressions,reach,frequency,cpm,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,clicks,ctr,cpc,actions,account_currency,date_start,date_stop",
        time_increment: "all_days",
        use_account_attribution_setting: "true",
        action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
        limit: String(options.limit ?? 100),
      });
      if (options.datePreset) params.set("date_preset", options.datePreset);
      else params.set("time_range", JSON.stringify(range));
      return `/${accountId}/insights?${params.toString()}`;
    };

    try {
      return await this.fetchAllPages<MetaAccountInsightResponse>(
        buildAccountEndpoint(options.timeRange),
        options.maxPages ?? 20
      );
    } catch (err) {
      // Meta restricts single account-level reach/frequency window to ~37 months
      if (err instanceof MarketingApiError && err.metaErrorCode === 100 && !options.datePreset) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Traverses Meta Graph API cursor-based pagination using a strict `while (hasNextPage)`
   * loop driven by `paging.cursors.after` (and `paging.next`), collecting all pages up to
   * `maxPages` while respecting Meta BUC rate-limit telemetry between page fetches.
   */
  private async fetchAllPages<T>(initialEndpoint: string, maxPages = 100): Promise<T[]> {
    this.lastFetchTruncated = false;
    this.lastFetchPages = 0;
    this.lastFetchHasMore = false;
    const allRecords: T[] = [];
    let currentEndpoint: string | null = initialEndpoint;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage && currentEndpoint && pageCount < maxPages) {
      pageCount++;
      const response: MetaPaginatedResponse<T> =
        await this.requestSingle<MetaPaginatedResponse<T>>(currentEndpoint);

      if (response?.data && Array.isArray(response.data)) {
        if (response.data.length === 0) {
          hasNextPage = false;
          currentEndpoint = null;
          break;
        }
        allRecords.push(...response.data);
      } else {
        hasNextPage = false;
        currentEndpoint = null;
        break;
      }

      // A cursor on its own is not another page. Graph includes cursors.after
      // on the last page; paging.next is what means more rows exist.
      const afterCursor = response?.paging?.cursors?.after;
      const nextUrl = response?.paging?.next;

      if (nextUrl && afterCursor) {
        currentEndpoint = this.withAfterCursor(initialEndpoint, afterCursor);
        hasNextPage = true;
      } else if (nextUrl) {
        currentEndpoint = nextUrl;
        hasNextPage = true;
      } else {
        currentEndpoint = null;
        hasNextPage = false;
      }

      // If another page is queued and Meta BUC usage headers indicate high utilization,
      // apply a proactive throttle pause before requesting the next cursor page.
      if (hasNextPage && pageCount < maxPages) {
        const cooldownMs = this.evaluateBucThrottleDelayMs();
        if (cooldownMs > 0) {
          await this.sleep(cooldownMs);
        }
      }
    }

    if (hasNextPage && currentEndpoint && pageCount >= maxPages) {
      this.lastFetchTruncated = true;
    }
    this.lastFetchPages = pageCount;
    this.lastFetchHasMore = Boolean(hasNextPage && currentEndpoint);

    return allRecords;
  }

  /**
   * Attaches or replaces the `after` cursor parameter on `endpoint` without
   * duplicating existing query parameters across multi-page cursor loops.
   */
  private withAfterCursor(endpoint: string, afterCursor: string): string {
    const qIndex = endpoint.indexOf("?");
    if (qIndex === -1) {
      return `${endpoint}?after=${encodeURIComponent(afterCursor)}`;
    }
    const basePath = endpoint.slice(0, qIndex);
    const params = new URLSearchParams(endpoint.slice(qIndex + 1));
    params.set("after", afterCursor);
    return `${basePath}?${params.toString()}`;
  }

  /**
   * Parses Meta's Business Use Case (`x-business-use-case-usage`), Ad Account
   * (`x-ad-account-usage`), and App (`x-app-usage`) rate-limit headers when present.
   */
  private captureBucUsageHeaders(headers?: Headers): void {
    if (!headers || typeof headers.get !== "function") return;
    const bucRaw = headers.get("x-business-use-case-usage");
    const accRaw = headers.get("x-ad-account-usage");
    const appRaw = headers.get("x-app-usage");
    if (!bucRaw && !accRaw && !appRaw) return;

    const parsed: Record<string, unknown> = {};
    for (const [key, raw] of [
      ["business_use_case", bucRaw],
      ["ad_account", accRaw],
      ["app", appRaw],
    ] as const) {
      if (!raw) continue;
      try {
        parsed[key] = JSON.parse(raw);
      } catch {
        // Ignore malformed header JSON
      }
    }
    if (Object.keys(parsed).length > 0) {
      this.lastBucUsageHeader = parsed;
    }
  }

  /**
   * Evaluates the latest Meta BUC / Ad Account usage telemetry and returns a protective
   * delay in milliseconds (0 when utilization is well below the 80% threshold).
   */
  private evaluateBucThrottleDelayMs(): number {
    if (!this.lastBucUsageHeader) return 0;
    let maxPct = 0;
    let regainMinutes = 0;

    const acc = this.lastBucUsageHeader.ad_account as Record<string, unknown> | undefined;
    if (acc && typeof acc.acc_id_util_pct === "number") {
      maxPct = Math.max(maxPct, acc.acc_id_util_pct);
    }

    const app = this.lastBucUsageHeader.app as Record<string, unknown> | undefined;
    if (app) {
      for (const k of ["call_count", "total_cputime", "total_time"]) {
        if (typeof app[k] === "number") maxPct = Math.max(maxPct, app[k] as number);
      }
    }

    const buc = this.lastBucUsageHeader.business_use_case as Record<string, unknown> | undefined;
    if (buc && typeof buc === "object") {
      for (const entries of Object.values(buc)) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          if (entry && typeof entry === "object") {
            const rec = entry as Record<string, unknown>;
            for (const k of ["call_count", "total_cputime", "total_time"]) {
              if (typeof rec[k] === "number") maxPct = Math.max(maxPct, rec[k] as number);
            }
            if (typeof rec.estimated_time_to_regain_access === "number") {
              regainMinutes = Math.max(regainMinutes, rec.estimated_time_to_regain_access);
            }
          }
        }
      }
    }

    if (regainMinutes > 0) return Math.min(regainMinutes * 1000, 3000);
    if (maxPct >= 95) return 1500;
    if (maxPct >= 85) return 600;
    if (maxPct >= 80) return 250;
    return 0;
  }

  /**
   * Executes a single HTTP GET request with retries, timeout, BUC header inspection,
   * and error classification.
   */
  private async requestSingle<T>(path: string): Promise<T> {
    if (!this.accessToken || this.accessToken.trim() === "") {
      throw new MarketingApiError({
        code: "MISSING_CONFIGURATION",
        message: "Tenant Meta access token is unavailable. Reconnect the organization's Meta account.",
        isRecoverable: false,
      });
    }

    // Prepare full URL (handles both relative endpoints and absolute pagination URLs)
    const isFullUrl = path.startsWith("http://") || path.startsWith("https://");
    if (isFullUrl) {
      const pageUrl = new URL(path);
      if (pageUrl.protocol !== "https:" || pageUrl.hostname !== "graph.facebook.com") {
        throw new MarketingApiError({
          code: "UPSTREAM_ERROR",
          message: "Meta returned an invalid pagination URL; the request was stopped for credential safety.",
          isRecoverable: false,
        });
      }
    }
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
        this.captureBucUsageHeaders(response.headers);

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
            message: `Meta Access Token tidak valid atau telah kedaluwarsa (Code 190). Silakan hubungkan ulang akun Meta Anda di Pengaturan, tab Integrasi Meta Ads: ${sanitizedMsg}`,
            metaErrorCode: metaCode ?? 190,
            metaErrorSubcode: metaSubcode,
            statusCode,
            fbtraceId,
            isRecoverable: false,
          });
        }

        // Check for Permissions Error (Code 10, 200, 294, etc.)
        if (metaCode === 10 || metaCode === 200 || metaCode === 294 || statusCode === 403) {
          throw new MarketingApiError({
            code: "PERMISSION_ERROR",
            message: `Izin akses akun iklan Meta tidak mencukupi (Code ${metaCode || 403}). Pastikan akun menyetujui ads_read dan memiliki akses ke Ad Account di Pengaturan, tab Integrasi Meta Ads: ${sanitizedMsg}`,
            metaErrorCode: metaCode,
            metaErrorSubcode: metaSubcode,
            statusCode,
            fbtraceId,
            isRecoverable: false,
          });
        }

        // Check for Rate Limit Error (Standard & BUC Codes: 4, 17, 32, 613, 80000, 80003, 80004, or HTTP 429)
        const isBucOrRateLimit =
          metaCode === 4 ||
          metaCode === 17 ||
          metaCode === 32 ||
          metaCode === 613 ||
          metaCode === 80000 ||
          metaCode === 80003 ||
          metaCode === 80004 ||
          statusCode === 429;

        if (isBucOrRateLimit) {
          const rateLimitErr = new MarketingApiError({
            code: "RATE_LIMIT_ERROR",
            message: `Batas panggilan Meta Marketing API tercapai (Rate Limit Code ${metaCode || 429}). Data snapshot lokal tetap aman; silakan tunggu beberapa menit sebelum menyinkronkan kembali: ${sanitizedMsg}`,
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
        message: "Target Ad Account ID tidak ditentukan. Pilih akun iklan yang tersimpan pada organisasi ini.",
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
