/**
 * Phase 2 Forensic Data Verification Script: Meta Ads Manager CSV vs Supabase DB
 *
 * Reads ground-truth Indonesian Meta Ads Manager CSV exports:
 *   1. docs/sample-data-ads/Iklan-Titik-Huni-Kampanye-8-Okt-2023-8-Nov-2026.csv
 *   2. docs/sample-data-ads/HDC-Property-Kampanye-8-Okt-2023-8-Nov-2026.csv
 *
 * Aggregates metrics by `Nama kampanye` and cross-references them against
 * the local Supabase PostgreSQL database (`campaigns` + `ad_insights`) for
 * the exact reporting window (2023-10-08 to 2026-11-08).
 *
 * Usage:
 *   npx tsx scripts/verify-csv-vs-db.ts
 *   npm run verify:csv-parity
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Allow importing Next.js server-only modules when --sync flag is used in standalone CLI mode
const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    paths: [],
    children: [],
    isPreloading: false,
    require,
  } as unknown as NodeModule;
} catch {}

// ============================================================================
// 0. Environment Loader (.env.local / .env)
// ============================================================================

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

// ============================================================================
// 1. Types & Constants
// ============================================================================

export interface CsvCampaignAggregate {
  campaignName: string;
  normalizedKey: string;
  rowCount: number;
  dateStart: string;
  dateStop: string;
  spend: number;
  impressions: number;
  allClicks: number;
  linkClicks: number;
  results: number;
  resultIndicators: Set<string>;
}

export interface DbCampaignAggregate {
  campaignName: string;
  normalizedKey: string;
  campaignIds: string[];
  spend: number;
  impressions: number;
  allClicks: number;
  linkClicks: number;
  results: number;
}

export interface DiffTableRow {
  "Campaign Name": string;
  Metric: "Spend (IDR)" | "Impressions" | "All Clicks" | "Link Clicks";
  "CSV Truth": number;
  "DB Value": number;
  Variance: number;
  Status: "PASS" | "FAIL";
}

const DEFAULT_CSV_FILES = [
  {
    label: "Iklan Titik Huni (8 Okt 2023 - 8 Nov 2026)",
    accountHint: "Titik Huni",
    relativePath: "docs/sample-data-ads/Iklan-Titik-Huni-Kampanye-8-Okt-2023-8-Nov-2026.csv",
  },
  {
    label: "HDC Property (8 Okt 2023 - 8 Nov 2026)",
    accountHint: "HDC",
    relativePath: "docs/sample-data-ads/HDC-Property-Kampanye-8-Okt-2023-8-Nov-2026.csv",
  },
];

const SPEND_TOLERANCE = 10.0;
const COUNT_TOLERANCE = 0;

// ============================================================================
// 2. RFC-4180 Multiline CSV Parser & Indonesian Number Parser
// ============================================================================

/**
 * Parses raw CSV content into an array of header-keyed record objects.
 * Strictly handles RFC-4180 multiline quoted fields (e.g. Instagram post captions
 * spanning multiple lines) and escaped double quotes (`""`).
 */
export function parseCsvRecords(csvText: string): Array<Record<string, string>> {
  const cleaned = csvText.replace(/^\uFEFF/, ""); // Strip UTF-8 BOM if present
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const nextCh = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && nextCh === '"') {
        currentField += '"';
        i++; // Skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\r" && nextCh === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++; // Skip \n
      } else if (ch === "\n" || ch === "\r") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const records: Array<Record<string, string>> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === "") continue;
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = row[c] ?? "";
    }
    records.push(record);
  }

  return records;
}

/**
 * Parses a numerical field from a Meta CSV export.
 * Gracefully handles empty strings, "-", NaN, standard dot decimals ("864279", "35674.20"),
 * and Indonesian thousand-dot / decimal-comma formatting ("1.250.000,50").
 */
export function parseLocalizedMetricNumber(raw: string | undefined | null): number {
  if (raw === undefined || raw === null) return 0;
  const trimmed = String(raw).trim();
  if (trimmed === "" || trimmed === "-" || trimmed.toLowerCase() === "nan") {
    return 0;
  }

  let normalized = trimmed;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // Determine which separator appears last (decimal separator)
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      // Indonesian format: 1.234.567,89 -> 1234567.89
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: 1,234,567.89 -> 1234567.89
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Comma used as decimal separator: 1234,56 -> 1234.56
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normalizes campaign names across CSV and DB by standardizing CRLF to LF
 * and trimming outer whitespace.
 */
export function normalizeCampaignKey(name: string): string {
  return name.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/**
 * Formats a potentially multiline campaign name for clean single-line console table display.
 */
function formatDisplayCampaignName(name: string, maxLength = 46): string {
  const singleLine = name.replace(/\s*\r?\n\s*/g, " ↵ ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

// ============================================================================
// 3. CSV Aggregation by `Nama kampanye`
// ============================================================================

export function aggregateCsvByCampaign(csvFilePath: string): {
  campaigns: Map<string, CsvCampaignAggregate>;
  minDateStart: string;
  maxDateStop: string;
  totalRows: number;
} {
  const rawText = fs.readFileSync(csvFilePath, "utf-8");
  const records = parseCsvRecords(rawText);
  const campaigns = new Map<string, CsvCampaignAggregate>();

  let minDateStart = "9999-12-31";
  let maxDateStop = "0000-01-01";
  let validRows = 0;

  for (const row of records) {
    const rawCampaignName = row["Nama kampanye"] ?? "";
    const normalizedKey = normalizeCampaignKey(rawCampaignName);
    // Skip summary/total rows where `Nama kampanye` is blank
    if (!normalizedKey) continue;

    validRows++;
    const dateStart = (row["Awal pelaporan"] || "").trim();
    const dateStop = (row["Akhir pelaporan"] || "").trim();
    if (dateStart && dateStart < minDateStart) minDateStart = dateStart;
    if (dateStop && dateStop > maxDateStop) maxDateStop = dateStop;

    const spend = parseLocalizedMetricNumber(row["Jumlah yang dibelanjakan (IDR)"]);
    const impressions = Math.round(parseLocalizedMetricNumber(row["Impresi"]));
    const allClicks = Math.round(parseLocalizedMetricNumber(row["Klik (semua)"]));
    const linkClicks = Math.round(parseLocalizedMetricNumber(row["Klik tautan"]));
    const results = Math.round(parseLocalizedMetricNumber(row["Hasil"]));
    const indicator = (row["Indikator Hasil"] || "").trim();

    const existing = campaigns.get(normalizedKey);
    if (existing) {
      existing.rowCount += 1;
      existing.spend = Number((existing.spend + spend).toFixed(2));
      existing.impressions += impressions;
      existing.allClicks += allClicks;
      existing.linkClicks += linkClicks;
      existing.results += results;
      if (indicator && indicator !== "-") existing.resultIndicators.add(indicator);
    } else {
      const indicators = new Set<string>();
      if (indicator && indicator !== "-") indicators.add(indicator);
      campaigns.set(normalizedKey, {
        campaignName: normalizedKey,
        normalizedKey,
        rowCount: 1,
        dateStart,
        dateStop,
        spend: Number(spend.toFixed(2)),
        impressions,
        allClicks,
        linkClicks,
        results,
        resultIndicators: indicators,
      });
    }
  }

  return {
    campaigns,
    minDateStart: minDateStart === "9999-12-31" ? "2023-10-08" : minDateStart,
    maxDateStop: maxDateStop === "0000-01-01" ? "2026-11-08" : maxDateStop,
    totalRows: validRows,
  };
}

// ============================================================================
// 4. Supabase Database Fetch & Aggregation
// ============================================================================

async function fetchAllRows<T>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await queryFactory(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

export async function fetchSupabaseCampaignAggregates(
  supabase: SupabaseClient,
  dateStart: string,
  dateStop: string
): Promise<Map<string, DbCampaignAggregate>> {
  // 1. Fetch all campaigns
  const dbCampaigns = await fetchAllRows<{
    id: string;
    name: string;
    provider_campaign_id: string;
    ad_account_id: string;
  }>((from, to) =>
    supabase
      .from("campaigns")
      .select("id, name, provider_campaign_id, ad_account_id")
      .range(from, to)
  );

  // 2. Fetch all ads to map ad.id -> campaign.id
  const dbAds = await fetchAllRows<{
    id: string;
    campaign_id: string;
    provider_ad_id: string;
  }>((from, to) =>
    supabase
      .from("ads")
      .select("id, campaign_id, provider_ad_id")
      .range(from, to)
  );

  // 3. Fetch all ad_insights within [dateStart, dateStop] at level='ad'
  const dbInsights = await fetchAllRows<{
    id: string;
    ad_id: string;
    date_start: string;
    date_stop: string;
    level: string;
    spend: number | string | null;
    impressions: number | string | null;
    clicks: number | string | null;
    link_clicks: number | string | null;
    conversions: number | string | null;
    fetched_at: string | null;
  }>((from, to) =>
    supabase
      .from("ad_insights")
      .select("id, ad_id, date_start, date_stop, level, spend, impressions, clicks, link_clicks, conversions, fetched_at")
      .eq("level", "ad")
      .gte("date_start", dateStart)
      .lte("date_stop", dateStop)
      .order("id", { ascending: true })
      .range(from, to)
  );

  const campaignById = new Map<string, { name: string; normalizedKey: string; providerCampaignId: string }>();
  const aggregates = new Map<string, DbCampaignAggregate>();

  for (const c of dbCampaigns) {
    const normalizedKey = normalizeCampaignKey(c.name || "");
    campaignById.set(c.id, {
      name: normalizedKey,
      normalizedKey,
      providerCampaignId: c.provider_campaign_id,
    });

    const existing = aggregates.get(normalizedKey);
    if (existing) {
      if (!existing.campaignIds.includes(c.provider_campaign_id)) {
        existing.campaignIds.push(c.provider_campaign_id);
      }
    } else {
      aggregates.set(normalizedKey, {
        campaignName: normalizedKey,
        normalizedKey,
        campaignIds: [c.provider_campaign_id],
        spend: 0,
        impressions: 0,
        allClicks: 0,
        linkClicks: 0,
        results: 0,
      });
    }
  }

  const adInfoByInternalId = new Map<string, { campaignKey: string; providerAdId: string }>();
  for (const ad of dbAds) {
    const cmp = campaignById.get(ad.campaign_id);
    if (cmp) {
      adInfoByInternalId.set(ad.id, {
        campaignKey: cmp.normalizedKey,
        providerAdId: ad.provider_ad_id,
      });
    }
  }

  // Deduplicate insight rows by canonical Meta (provider_ad_id, date_start, date_stop)
  // keeping the most recently fetched snapshot when multiple tenant orgs synced the same ad account.
  const canonicalInsights = new Map<
    string,
    (typeof dbInsights)[number] & { campaignKey: string }
  >();

  for (const ins of dbInsights) {
    const adInfo = adInfoByInternalId.get(ins.ad_id);
    if (!adInfo) continue;
    const dedupeKey = `${adInfo.providerAdId}::${ins.date_start}::${ins.date_stop}`;
    const existing = canonicalInsights.get(dedupeKey);
    if (
      !existing ||
      String(ins.fetched_at || "") >= String(existing.fetched_at || "")
    ) {
      canonicalInsights.set(dedupeKey, { ...ins, campaignKey: adInfo.campaignKey });
    }
  }

  for (const ins of canonicalInsights.values()) {
    const agg = aggregates.get(ins.campaignKey);
    if (!agg) continue;

    const spend = Number(ins.spend ?? 0);
    const impressions = Math.round(Number(ins.impressions ?? 0));
    const clicks = Math.round(Number(ins.clicks ?? 0));
    const linkClicks = Math.round(Number(ins.link_clicks ?? 0));
    const conversions = Math.round(Number(ins.conversions ?? 0));

    agg.spend = Number((agg.spend + (Number.isFinite(spend) ? spend : 0)).toFixed(2));
    agg.impressions += Number.isFinite(impressions) ? impressions : 0;
    agg.allClicks += Number.isFinite(clicks) ? clicks : 0;
    agg.linkClicks += Number.isFinite(linkClicks) ? linkClicks : 0;
    agg.results += Number.isFinite(conversions) ? conversions : 0;
  }

  return aggregates;
}

// ============================================================================
// 5. Forensic Diffing & Console Output
// ============================================================================

export function compareCsvWithDb(
  csvCampaigns: Map<string, CsvCampaignAggregate>,
  dbCampaigns: Map<string, DbCampaignAggregate>
): {
  tableRows: DiffTableRow[];
  passedCount: number;
  failedCount: number;
  missingCampaignsInDb: string[];
} {
  const tableRows: DiffTableRow[] = [];
  let passedCount = 0;
  let failedCount = 0;
  const missingCampaignsInDb: string[] = [];

  for (const [key, csvAgg] of csvCampaigns.entries()) {
    const dbAgg = dbCampaigns.get(key);
    if (!dbAgg) {
      missingCampaignsInDb.push(csvAgg.campaignName);
    }

    const dbSpend = dbAgg?.spend ?? 0;
    const dbImpressions = dbAgg?.impressions ?? 0;
    const dbAllClicks = dbAgg?.allClicks ?? 0;
    const dbLinkClicks = dbAgg?.linkClicks ?? 0;

    const spendVariance = Number((dbSpend - csvAgg.spend).toFixed(2));
    const impressionsVariance = dbImpressions - csvAgg.impressions;
    const allClicksVariance = dbAllClicks - csvAgg.allClicks;
    const linkClicksVariance = dbLinkClicks - csvAgg.linkClicks;

    const spendPass = Boolean(dbAgg) && Math.abs(spendVariance) <= SPEND_TOLERANCE;
    const impressionsPass = Boolean(dbAgg) && Math.abs(impressionsVariance) <= COUNT_TOLERANCE;
    const allClicksPass = Boolean(dbAgg) && Math.abs(allClicksVariance) <= COUNT_TOLERANCE;
    const linkClicksPass = Boolean(dbAgg) && Math.abs(linkClicksVariance) <= COUNT_TOLERANCE;

    const displayName = formatDisplayCampaignName(csvAgg.campaignName);

    const rowsForCampaign: DiffTableRow[] = [
      {
        "Campaign Name": displayName,
        Metric: "Spend (IDR)",
        "CSV Truth": csvAgg.spend,
        "DB Value": dbSpend,
        Variance: spendVariance,
        Status: spendPass ? "PASS" : "FAIL",
      },
      {
        "Campaign Name": displayName,
        Metric: "Impressions",
        "CSV Truth": csvAgg.impressions,
        "DB Value": dbImpressions,
        Variance: impressionsVariance,
        Status: impressionsPass ? "PASS" : "FAIL",
      },
      {
        "Campaign Name": displayName,
        Metric: "All Clicks",
        "CSV Truth": csvAgg.allClicks,
        "DB Value": dbAllClicks,
        Variance: allClicksVariance,
        Status: allClicksPass ? "PASS" : "FAIL",
      },
      {
        "Campaign Name": displayName,
        Metric: "Link Clicks",
        "CSV Truth": csvAgg.linkClicks,
        "DB Value": dbLinkClicks,
        Variance: linkClicksVariance,
        Status: linkClicksPass ? "PASS" : "FAIL",
      },
    ];

    for (const r of rowsForCampaign) {
      if (r.Status === "PASS") passedCount++;
      else failedCount++;
      tableRows.push(r);
    }
  }

  return {
    tableRows,
    passedCount,
    failedCount,
    missingCampaignsInDb,
  };
}

// ============================================================================
// 6. Main CLI Runner
// ============================================================================

async function main() {
  console.log("================================================================================");
  console.log(" PHASE 2 FORENSIC DATA VERIFICATION: META ADS CSV TRUTH vs SUPABASE POSTGRESQL");
  console.log("================================================================================");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[ERROR] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local / environment."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Parse all configured CSV files first to determine global date range
  const parsedDatasets = DEFAULT_CSV_FILES.map((entry) => {
    const fullPath = path.resolve(process.cwd(), entry.relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`CSV file not found at: ${fullPath}`);
    }
    const aggregated = aggregateCsvByCampaign(fullPath);
    return {
      ...entry,
      fullPath,
      ...aggregated,
    };
  });

  const globalStart = parsedDatasets.reduce(
    (min, d) => (d.minDateStart < min ? d.minDateStart : min),
    "2023-10-08"
  );
  const globalStop = parsedDatasets.reduce(
    (max, d) => (d.maxDateStop > max ? d.maxDateStop : max),
    "2026-11-08"
  );

  console.log(`Reporting Window : ${globalStart} -> ${globalStop}`);
  console.log(`Spend Tolerance  : ±${SPEND_TOLERANCE.toFixed(1)} IDR`);
  console.log(`Count Tolerance  : ±${COUNT_TOLERANCE} (Strict Exact Match)\n`);

  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, organization_id, provider_account_id, account_name, last_synced_at");
  if (accounts && accounts.length > 0) {
    console.log("Connected Ad Accounts in Supabase:");
    for (const acc of accounts) {
      console.log(
        `  - ${acc.account_name} (${acc.provider_account_id}) | Org: ${acc.organization_id} | Last Synced: ${acc.last_synced_at || "Never"}`
      );
    }
    console.log("");
  }

  // Optional --sync flag: calls executeMarketingSync (Live Meta Marketing Graph API v26.0) before diffing
  if (process.argv.includes("--sync") && accounts && accounts.length > 0) {
    console.log("[SYNC] Fetching directly from Live Meta Marketing Graph API (https://graph.facebook.com/v26.0)...");
    const { executeMarketingSync } = await import("../src/lib/marketing/meta/sync-service");
    const { data: tokenOrgs } = await supabase
      .from("meta_user_tokens")
      .select("organization_id");
    const validOrgIds = new Set((tokenOrgs || []).map((t) => t.organization_id));

    const seenAccountIds = new Set<string>();
    for (const acc of accounts) {
      if (!validOrgIds.has(acc.organization_id)) continue;
      if (acc.provider_account_id.includes("demo")) continue;
      if (seenAccountIds.has(acc.provider_account_id)) continue;
      seenAccountIds.add(acc.provider_account_id);

      console.log(`  -> Syncing ${acc.account_name} (${acc.provider_account_id}) [${globalStart} .. ${globalStop}] via Meta Marketing API...`);
      const res = await executeMarketingSync({
        organizationId: acc.organization_id,
        targetAdAccountId: acc.provider_account_id,
        timeRange: { since: globalStart, until: globalStop },
        supabaseClient: supabase,
      });
      console.log(
        `     Status: ${res.status} | Mode: ${res.mode} | Campaigns: ${res.campaignsSynced} | Ads: ${res.adsSynced} | Insights Stored: ${res.insightsSynced}`
      );
    }
    console.log("");
  }

  const dbAggregates = await fetchSupabaseCampaignAggregates(supabase, globalStart, globalStop);
  console.log(`Loaded ${dbAggregates.size} distinct campaign names from Supabase database.\n`);

  let grandTotalPassed = 0;
  let grandTotalFailed = 0;

  for (const dataset of parsedDatasets) {
    console.log("--------------------------------------------------------------------------------");
    console.log(`DATASET: ${dataset.label}`);
    console.log(`File   : ${dataset.relativePath}`);
    console.log(`Rows   : ${dataset.totalRows} CSV rows -> ${dataset.campaigns.size} unique campaigns`);
    console.log("--------------------------------------------------------------------------------");

    const diff = compareCsvWithDb(dataset.campaigns, dbAggregates);
    grandTotalPassed += diff.passedCount;
    grandTotalFailed += diff.failedCount;

    console.table(diff.tableRows);

    const totalChecks = diff.passedCount + diff.failedCount;
    console.log(
      `Summary for ${dataset.label}: ${diff.passedCount}/${totalChecks} checks PASSED | ${diff.failedCount} FAILED | ${diff.missingCampaignsInDb.length} Campaigns Missing in DB\n`
    );
  }

  console.log("================================================================================");
  console.log(
    `OVERALL VERIFICATION RESULT: ${grandTotalPassed} PASSED | ${grandTotalFailed} FAILED`
  );
  console.log("================================================================================");

  if (grandTotalFailed > 0) {
    process.exitCode = 1;
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("scripts/verify-csv-vs-db.ts");

if (isDirectExecution) {
  main().catch((err) => {
    console.error("[FATAL] Verification script failed:", err);
    process.exit(1);
  });
}
