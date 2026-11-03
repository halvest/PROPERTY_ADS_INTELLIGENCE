import * as XLSX from "xlsx";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelStage } from "@/domain/funnel/stages";
import type { AttributionStatus } from "@/domain/attribution/types";

/**
 * Computes a deterministic privacy-preserving hash of an E.164 phone number.
 */
export function hashPhoneNumber(phone: string, secretSalt?: string): string {
  const salt =
    secretSalt ||
    process.env.PHONE_HASH_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === "production"
      ? (() => { throw new Error("PHONE_HASH_SECRET wajib dikonfigurasi di production."); })()
      : "property_ads_salt");
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = `62${cleanPhone.slice(1)}`;
  }
  return crypto.createHmac("sha256", salt).update(cleanPhone).digest("hex");
}

/**
 * Masks a phone number to protect prospective buyer PII.
 * e.g., "6281234567890" -> "+62 812-****-890"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || String(phone).trim() === "") {
    return "+62 ***-****-***";
  }

  const clean = String(phone).replace(/[^0-9]/g, "");
  if (clean.length < 9) {
    return "+62 ***-****-***";
  }

  let formatted = clean;
  if (formatted.startsWith("62")) {
    formatted = formatted.slice(2);
  } else if (formatted.startsWith("0")) {
    formatted = formatted.slice(1);
  }

  const prefix = formatted.slice(0, 3);
  const suffix = formatted.slice(-3);

  return `+62 ${prefix}-****-${suffix}`;
}

export type QualityLabel = "Hot" | "Warm" | "Cold";

export interface CrmLeadTemplateRow {
  nama: string;
  telepon: string;
  phoneHash: string;
  phoneMasked: string;
  domisili?: string;
  tanggalKontak: string;
  namaIklan?: string;
  adId?: string | null;
  campaignId?: string | null;
  adSetId?: string | null;
  sourceAdSet?: string | null;
  sourceCampaign?: string | null;
  attributionNote?: string | null;
  tahapFunnel: FunnelStage;
  qualityLabel?: QualityLabel | null;
  catatan?: string;
  statusAtribusi: AttributionStatus;
  skorProspek?: number;
  skorPenjualan?: number;
  nilaiProperti?: number;
}

export interface ParsedRowResult {
  rowIndex: number;
  valid: boolean;
  data?: CrmLeadTemplateRow;
  errors: string[];
  warnings: string[];
  attributionPreview?: string;
  previewStatus?: CrmPreviewStatus;
}

export interface ParsedSheetSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows?: number;
  rowsToSave?: number;
  attributionCounts?: Record<string, number>;
  previewCounts?: Partial<Record<CrmPreviewStatus, number>>;
  rows: ParsedRowResult[];
  headers?: string[];
}

export type CrmColumnMap = Partial<Record<"name" | "phone" | "ad" | "adId" | "adSet" | "campaign", string>>;

export type CrmPreviewStatus =
  | "READY_TO_IMPORT"
  | "DUPLICATE"
  | "INVALID_DATA"
  | "INVALID_IDENTIFIER"
  | "AMBIGUOUS_IDENTIFIER"
  | "UNATTRIBUTED"
  | "REQUIRES_USER_CONFIRMATION";

export type CrmImportRowStatus = "SUCCESS" | "FAILED" | "DUPLICATE" | "SKIPPED";

export function decideCrmImportRow(input: {
  prospectValid: boolean;
  seenInFile: boolean;
  existsInWorkspace: boolean;
  matchMethod: CrmMatchMethod;
  allowUnattributed: boolean;
}): { status: CrmImportRowStatus; previewStatus: CrmPreviewStatus; save: boolean; clearAttribution: boolean } {
  if (!input.prospectValid) {
    return { status: "SKIPPED", previewStatus: "INVALID_DATA", save: false, clearAttribution: true };
  }
  if (input.seenInFile || input.existsInWorkspace) {
    return { status: "DUPLICATE", previewStatus: "DUPLICATE", save: false, clearAttribution: true };
  }
  if (input.matchMethod === "invalid_identifier") {
    return {
      status: input.allowUnattributed ? "SUCCESS" : "SKIPPED",
      previewStatus: "INVALID_IDENTIFIER",
      save: input.allowUnattributed,
      clearAttribution: true,
    };
  }
  if (input.matchMethod === "ambiguous") {
    return {
      status: input.allowUnattributed ? "SUCCESS" : "SKIPPED",
      previewStatus: "AMBIGUOUS_IDENTIFIER",
      save: input.allowUnattributed,
      clearAttribution: true,
    };
  }
  if (input.matchMethod === "none") {
    return { status: "SUCCESS", previewStatus: "UNATTRIBUTED", save: true, clearAttribution: true };
  }
  return { status: "SUCCESS", previewStatus: "READY_TO_IMPORT", save: true, clearAttribution: false };
}

export interface CrmImportResult {
  success: boolean;
  totalProcessed: number;
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  duplicateCount?: number;
  skippedCount?: number;
  batchId?: string;
  partial?: boolean;
  attribution?: { direct: number; adSet: number; campaign: number; unattributed: number };
  rowResults?: Array<{
    rowNumber: number;
    status: CrmImportRowStatus;
    error: string | null;
    recordId: string | null;
    at: string;
  }>;
  errors: Array<{ row: number; error: string }>;
  warnings: Array<{ row: number; warning: string }>;
  importedLeads: Array<{
    id: string;
    name: string;
    phoneMasked: string;
    domisili?: string;
    funnelStage: FunnelStage;
    qualityLabel?: QualityLabel | null;
    notes?: string;
    isNew: boolean;
  }>;
}

export interface CrmAdSourceOption {
  adId: string;
  providerAdId?: string | null;
  campaignId: string;
  providerCampaignId?: string | null;
  adName: string;
  campaignName: string;
  adStatus: string;
  campaignStatus: string;
}

export type CrmMatchMethod =
  | "internal_ad_id"
  | "meta_ad_id"
  | "ad_name"
  | "meta_adset_id"
  | "adset_name"
  | "internal_campaign_id"
  | "meta_campaign_id"
  | "campaign_name"
  | "sole_campaign_ad"
  | "ambiguous"
  | "invalid_identifier"
  | "none";

export interface CrmAdSetSource {
  providerAdSetId: string;
  name: string;
  campaignId: string;
  adIds: string[];
}

export interface ResolvedCrmSource {
  adId: string | null;
  campaignId: string | null;
  sourceName: string | null;
  providerAdSetId: string | null;
  matched: boolean;
  matchMethod: CrmMatchMethod;
}

export function attributionStatusForCrmMatch(method: CrmMatchMethod): "verified" | "inferred" | "unknown" {
  if (method === "internal_ad_id" || method === "meta_ad_id") return "verified";
  if (method === "none" || method === "ambiguous" || method === "invalid_identifier") return "unknown";
  return "inferred";
}

export function crmAttributionLabel(method: CrmMatchMethod): string {
  if (method === "internal_ad_id" || method === "meta_ad_id") return "Terhubung ke iklan";
  if (method === "meta_adset_id" || method === "adset_name") return "Terhubung ke ad set";
  if (method === "sole_campaign_ad") return "Terhubung ke satu-satunya iklan kampanye";
  if (method === "internal_campaign_id" || method === "meta_campaign_id" || method === "campaign_name") return "Terhubung ke kampanye";
  if (method === "ad_name") return "Perlu verifikasi";
  if (method === "ambiguous") return "Perlu verifikasi";
  if (method === "invalid_identifier") return "Identifier tidak valid";
  return "Sumber belum diketahui";
}

async function getTenantCrmSourceCatalog(supabase: SupabaseClient, organizationId: string) {
  const [{ data: ads, error: adsError }, { data: campaigns, error: campaignsError }, { data: insightRows }] = await Promise.all([
    supabase.from("ads").select("id, name, status, campaign_id, provider_ad_id").eq("organization_id", organizationId).order("name").limit(5000),
    supabase.from("campaigns").select("id, name, status, provider_campaign_id").eq("organization_id", organizationId).order("name").limit(5000),
    supabase.from("ad_insights").select("ad_id, adset_id, adset_name").eq("organization_id", organizationId).limit(5000),
  ]);
  if (adsError) throw new Error(`Gagal memuat referensi iklan: ${adsError.message}`);
  if (campaignsError) throw new Error(`Gagal memuat referensi kampanye: ${campaignsError.message}`);
  const campaignMap = new Map((campaigns || []).map((campaign) => [campaign.id, campaign]));
  const adOptions: CrmAdSourceOption[] = (ads || []).flatMap((ad) => {
    const campaign = campaignMap.get(ad.campaign_id);
    if (!campaign) return [];
    return [{
      adId: ad.id,
      providerAdId: ad.provider_ad_id,
      campaignId: ad.campaign_id,
      providerCampaignId: campaign.provider_campaign_id,
      adName: ad.name,
      campaignName: campaign.name,
      adStatus: String(ad.status || "UNKNOWN").toUpperCase(),
      campaignStatus: String(campaign.status || "UNKNOWN").toUpperCase(),
    }];
  });
  const adCampaign = new Map((ads || []).map((ad) => [ad.id, ad.campaign_id]));
  const adSets = new Map<string, CrmAdSetSource>();
  for (const row of insightRows || []) {
    if (!row.adset_id || !row.ad_id) continue;
    const campaignId = adCampaign.get(row.ad_id);
    if (!campaignId) continue;
    const current: CrmAdSetSource = adSets.get(row.adset_id) || {
      providerAdSetId: row.adset_id,
      name: row.adset_name || row.adset_id,
      campaignId,
      adIds: [] as string[],
    };
    if (current.campaignId === campaignId && !current.adIds.includes(row.ad_id)) current.adIds.push(row.ad_id);
    if (row.adset_name) current.name = row.adset_name;
    adSets.set(row.adset_id, current);
  }
  return {
    ads: adOptions,
    campaigns: (campaigns || []).map((c) => ({
      id: c.id,
      providerCampaignId: c.provider_campaign_id,
      name: c.name,
      status: String(c.status || "UNKNOWN").toUpperCase(),
    })),
    adSets: [...adSets.values()],
  };
}

export async function listCrmLeadSources(supabase: SupabaseClient, organizationId: string) {
  const catalog = await getTenantCrmSourceCatalog(supabase, organizationId);
  const { data: insightRows } = await supabase
    .from("ad_insights")
    .select("ad_id")
    .eq("organization_id", organizationId)
    .limit(5000);
  const adsWithInsights = new Set((insightRows || []).map((row) => row.ad_id));
  const ads = catalog.ads.filter((ad) =>
    ["ACTIVE", "PAUSED"].includes(ad.adStatus) || adsWithInsights.has(ad.adId)
  );
  const campaignIds = new Set(ads.map((ad) => ad.campaignId));
  const campaigns = catalog.campaigns.filter((campaign) =>
    campaign.status === "ACTIVE" || campaignIds.has(campaign.id)
  );
  return { ads, campaigns, adSets: catalog.adSets.filter((adSet) => campaignIds.has(adSet.campaignId)) };
}

export function resolveCrmSourceFromCatalog(
  catalog: Awaited<ReturnType<typeof getTenantCrmSourceCatalog>>,
  input: {
    adId?: string | null;
    campaignId?: string | null;
    adSetId?: string | null;
    sourceName?: string | null;
    sourceAdSet?: string | null;
    sourceCampaign?: string | null;
  }
): ResolvedCrmSource {
  const sourceName = input.sourceName?.trim() || null;
  const adSets = catalog.adSets || [];
  const linked = (
    adId: string | null,
    campaignId: string | null,
    name: string | null,
    matchMethod: CrmMatchMethod,
    providerAdSetId: string | null = null
  ): ResolvedCrmSource => ({
    adId,
    campaignId,
    sourceName: name,
    providerAdSetId,
    matched: matchMethod !== "none" && matchMethod !== "ambiguous" && matchMethod !== "invalid_identifier",
    matchMethod,
  });
  const soleAdInCampaign = (campaignId: string) => {
    const matches = catalog.ads.filter((ad) => ad.campaignId === campaignId);
    return matches.length === 1 ? matches[0] : null;
  };
  const finishCampaign = (campaignId: string, name: string | null, method: CrmMatchMethod): ResolvedCrmSource => {
    const only = soleAdInCampaign(campaignId);
    if (!only) return linked(null, campaignId, name, method);
    return linked(only.adId, campaignId, only.adName, "sole_campaign_ad", adSetForAd(only.adId));
  };
  const finishAdSet = (adSet: CrmAdSetSource): ResolvedCrmSource => {
    if (adSet.adIds.length === 1) {
      const ad = catalog.ads.find((candidate) => candidate.adId === adSet.adIds[0]);
      if (ad) return linked(ad.adId, ad.campaignId, ad.adName, "sole_campaign_ad", adSet.providerAdSetId);
    }
    return linked(null, adSet.campaignId, adSet.name, "meta_adset_id", adSet.providerAdSetId);
  };
  const adSetForAd = (adId: string, requested?: string | null) => {
    const sets = adSets.filter((adSet) => adSet.adIds.includes(adId));
    if (requested) {
      const chosen = sets.find((adSet) => adSet.providerAdSetId === requested);
      if (!chosen) throw new Error("Ad set tidak berisi iklan yang dipilih.");
      return chosen.providerAdSetId;
    }
    return sets.length === 1 ? sets[0].providerAdSetId : null;
  };

  if (input.adId) {
    const ad = catalog.ads.find((candidate) => candidate.adId === input.adId || candidate.providerAdId === input.adId);
    if (!ad) throw new Error("Iklan yang dipilih tidak termasuk organisasi ini.");
    if (
      input.campaignId &&
      input.campaignId !== ad.campaignId &&
      input.campaignId !== ad.providerCampaignId
    ) {
      throw new Error("Kampanye tidak sesuai dengan iklan yang dipilih.");
    }
    return linked(
      ad.adId,
      ad.campaignId,
      ad.adName,
      ad.adId === input.adId ? "internal_ad_id" : "meta_ad_id",
      adSetForAd(ad.adId, input.adSetId)
    );
  }
  if (input.adSetId) {
    const adSet = adSets.find((candidate) => candidate.providerAdSetId === input.adSetId);
    if (!adSet) throw new Error("Ad set yang dipilih tidak termasuk organisasi ini.");
    if (input.campaignId && input.campaignId !== adSet.campaignId) {
      throw new Error("Kampanye tidak sesuai dengan ad set yang dipilih.");
    }
    return finishAdSet(adSet);
  }
  if (input.campaignId) {
    const campaign = catalog.campaigns.find(
      (candidate) => candidate.id === input.campaignId || candidate.providerCampaignId === input.campaignId
    );
    if (!campaign) throw new Error("Kampanye yang dipilih tidak termasuk organisasi ini.");
    return finishCampaign(
      campaign.id,
      sourceName || campaign.name,
      campaign.id === input.campaignId ? "internal_campaign_id" : "meta_campaign_id"
    );
  }
  const textAdSet = input.sourceAdSet?.trim() || null;
  const textCampaign = input.sourceCampaign?.trim() || null;
  if (!sourceName && !textAdSet && !textCampaign) return linked(null, null, null, "none");
  const looksLikeId = (value: string | null) => Boolean(value && /^\d{8,}$/.test(value));

  const byAdId = catalog.ads.filter((ad) => ad.adId === sourceName || ad.providerAdId === sourceName);
  if (byAdId.length === 1) {
    const ad = byAdId[0];
    return linked(ad.adId, ad.campaignId, ad.adName, ad.adId === sourceName ? "internal_ad_id" : "meta_ad_id", adSetForAd(ad.adId));
  }
  const byAdSetId = adSets.filter((adSet) => adSet.providerAdSetId === (textAdSet || sourceName));
  if (byAdSetId.length === 1) {
    return finishAdSet(byAdSetId[0]);
  }
  const byCampaignId = catalog.campaigns.filter(
    (campaign) => campaign.id === sourceName || campaign.providerCampaignId === sourceName
  );
  if (byCampaignId.length === 1) {
    const campaign = byCampaignId[0];
    return finishCampaign(
      campaign.id,
      campaign.name,
      campaign.id === sourceName ? "internal_campaign_id" : "meta_campaign_id"
    );
  }

  const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");
  const query = sourceName ? normalize(sourceName) : "";
  const exactAds = sourceName ? catalog.ads.filter((ad) => normalize(ad.adName) === query) : [];
  if (exactAds.length > 1) return linked(null, null, sourceName, "ambiguous");
  if (exactAds.length === 1) {
    const ad = exactAds[0];
    return linked(ad.adId, ad.campaignId, ad.adName, "ad_name", adSetForAd(ad.adId));
  }
  const adSetQuery = textAdSet ? normalize(textAdSet) : query;
  const exactAdSets = adSets.filter((adSet) => normalize(adSet.name) === adSetQuery);
  if (exactAdSets.length > 1) return linked(null, null, textAdSet || sourceName, "ambiguous");
  if (exactAdSets.length === 1 && (textAdSet || !textCampaign)) {
    const adSet = exactAdSets[0];
    if (adSet.adIds.length === 1) {
      const ad = catalog.ads.find((candidate) => candidate.adId === adSet.adIds[0]);
      if (ad) return linked(ad.adId, ad.campaignId, ad.adName, "sole_campaign_ad", adSet.providerAdSetId);
    }
    return linked(null, adSet.campaignId, adSet.name, "adset_name", adSet.providerAdSetId);
  }
  const campaignQuery = textCampaign ? normalize(textCampaign) : query;
  const exactCampaigns = catalog.campaigns.filter((campaign) => normalize(campaign.name) === campaignQuery);
  if (exactCampaigns.length > 1) return linked(null, null, textCampaign || sourceName, "ambiguous");
  if (exactCampaigns.length === 1) {
    return finishCampaign(exactCampaigns[0].id, exactCampaigns[0].name, "campaign_name");
  }
  if (looksLikeId(sourceName) || looksLikeId(textAdSet) || looksLikeId(textCampaign)) {
    return linked(null, null, sourceName || textAdSet || textCampaign, "invalid_identifier");
  }

  return linked(null, null, sourceName, "none");
}

export async function resolveCrmLeadSource(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    adId?: string | null;
    campaignId?: string | null;
    adSetId?: string | null;
    sourceName?: string | null;
    sourceAdSet?: string | null;
    sourceCampaign?: string | null;
  }
) {
  const catalog = await getTenantCrmSourceCatalog(supabase, organizationId);
  return resolveCrmSourceFromCatalog(catalog, input);
}

export async function annotateCrmImportPreview(
  supabase: SupabaseClient,
  organizationId: string,
  summary: ParsedSheetSummary
): Promise<ParsedSheetSummary> {
  const catalog = await getTenantCrmSourceCatalog(supabase, organizationId);
  const hashes = summary.rows.flatMap((row) => (row.data?.phoneHash ? [row.data.phoneHash] : []));
  const existing = new Set<string>();
  for (let index = 0; index < hashes.length; index += 200) {
    const slice = hashes.slice(index, index + 200);
    const { data: contacts } = await supabase.from("contacts").select("id, phone_hash").eq("organization_id", organizationId).in("phone_hash", slice);
    const ids = (contacts || []).map((contact) => contact.id);
    if (ids.length === 0) continue;
    const { data: conversations } = await supabase.from("conversations").select("contact_id").eq("organization_id", organizationId).in("contact_id", ids);
    const withConversation = new Set((conversations || []).map((conversation) => conversation.contact_id));
    for (const contact of contacts || []) {
      if (contact.phone_hash && withConversation.has(contact.id)) existing.add(contact.phone_hash);
    }
  }
  const seen = new Set<string>();
  let duplicateRows = 0;
  let rowsToSave = 0;
  const attributionCounts: Record<string, number> = {};
  const previewCounts: Partial<Record<CrmPreviewStatus, number>> = {};
  const rows = summary.rows.map((row) => {
    let method: CrmMatchMethod = "none";
    if (row.valid && row.data) {
      try {
        method = resolveCrmSourceFromCatalog(catalog, {
          sourceName: row.data.namaIklan,
          sourceAdSet: row.data.sourceAdSet,
          sourceCampaign: row.data.sourceCampaign,
        }).matchMethod;
      } catch {
        method = "invalid_identifier";
      }
    }
    const seenInFile = Boolean(row.data && seen.has(row.data.phoneHash));
    if (row.data) seen.add(row.data.phoneHash);
    const decision = decideCrmImportRow({
      prospectValid: Boolean(row.valid && row.data),
      seenInFile,
      existsInWorkspace: Boolean(row.data && existing.has(row.data.phoneHash)),
      matchMethod: method,
      allowUnattributed: false,
    });
    if (decision.previewStatus === "DUPLICATE") duplicateRows += 1;
    if (decision.save) rowsToSave += 1;
    previewCounts[decision.previewStatus] = (previewCounts[decision.previewStatus] || 0) + 1;
    const label = crmAttributionLabel(method);
    if (row.valid) attributionCounts[label] = (attributionCounts[label] || 0) + 1;
    return { ...row, attributionPreview: label, previewStatus: decision.previewStatus };
  });
  return { ...summary, rows, duplicateRows, rowsToSave, attributionCounts, previewCounts };
}

const VALID_STAGES: Record<string, FunnelStage> = {
  baru: "baru",
  new: "baru",
  inbound: "baru",
  dihubungi: "dihubungi",
  contacted: "dihubungi",
  followup: "dihubungi",
  "follow up": "dihubungi",
  prospek: "prospek",
  prospect: "prospek",
  qualified: "prospek",
  survei: "survei",
  survey: "survei",
  visit: "survei",
  closing: "closing",
  closed: "closing",
  booking: "closing",
  won: "closing",
  deal: "closing",
  batal: "batal",
  lost: "batal",
  batal_minat: "batal",
};

/**
 * Normalizes input text into a recognized FunnelStage.
 */
export function normalizeFunnelStage(raw?: string | null): { stage: FunnelStage; isDefault: boolean } {
  if (!raw) return { stage: "baru", isDefault: true };
  const cleaned = raw.toLowerCase().trim().replace(/[-_]/g, " ");
  if (VALID_STAGES[cleaned]) {
    return { stage: VALID_STAGES[cleaned], isDefault: false };
  }
  return { stage: "baru", isDefault: true };
}

/**
 * Normalizes input text into a recognized AttributionStatus.
 */
export function normalizeAttributionStatus(raw?: string | null, hasAd = false): AttributionStatus {
  if (!raw) return hasAd ? "verified" : "unknown";
  const cleaned = raw.toLowerCase().trim();
  if (cleaned.includes("verif") || cleaned === "terverifikasi") {
    return "verified";
  }
  if (cleaned.includes("infer") || cleaned === "perkiraan" || cleaned === "diduga") return "inferred";
  if (cleaned.includes("unknown") || cleaned === "tidak diketahui" || cleaned === "organik") return "unknown";
  return hasAd ? "verified" : "unknown";
}

/**
 * Cleans phone numbers to international standard format for hashing and masking.
 */
export function cleanPhoneNumber(rawPhone: string | number): string {
  const s = String(rawPhone).trim();
  let digits = s.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (!digits.startsWith("62") && digits.length >= 9) {
    digits = `62${digits}`;
  }
  return digits;
}

/**
 * Normalizes quality label to 'Hot' | 'Warm' | 'Cold' | null.
 */
export function normalizeQualityLabel(raw?: string | null): QualityLabel | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === "hot" || s === "panas") return "Hot";
  if (s === "warm" || s === "hangat") return "Warm";
  if (s === "cold" || s === "dingin") return "Cold";
  return null;
}

/**
 * Generates an Excel (.xlsx) or CSV buffer containing the official HD Creative CRM leads template.
 * Focused on Tahap 1 core columns: Nama & WhatsApp, Domisili, Tanggal Masuk, Kampanye/Iklan, Tahap Funnel, Label Kualitas, Catatan Singkat.
 */
export function generateCrmLeadsTemplate(format: "xlsx" | "csv" = "xlsx", sourceOptions: CrmAdSourceOption[] = []): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Data Prospek CRM (Core Columns Tahap 1)
  const headers = [
    "Nama Prospek (Wajib)",
    "Nomor WhatsApp / HP (Wajib)",
    "Domisili (Opsional)",
    "Tanggal Masuk YYYY-MM-DD (Opsional)",
    "Kampanye / Iklan (Opsional)",
    "Tahap Funnel (Wajib)",
    "Label Kualitas Hot/Warm/Cold (Opsional)",
    "Catatan Singkat (Opsional)",
  ];

  const sampleRows = [
    [
      "Budi Santoso",
      "081234567890",
      "Jakarta Selatan",
      "2026-10-27",
      "Cluster Sapphire BSD - Tipe 72 Hook Siap Huni",
      "survei",
      "Hot",
      "Minat unit hook 2 lantai, survei jadwal Sabtu jam 10.00 WIB",
    ],
    [
      "Rina Wulandari",
      "081398765432",
      "Tangerang Selatan",
      "2026-10-26",
      "Maliosewu A",
      "prospek",
      "Warm",
      "Tanya simulasi KPR bank syariah DP 5%, minat 2 kamar tidur",
    ],
    [
      "Hendra Pratama",
      "082155667788",
      "Bandung",
      "2026-10-25",
      "Virendra 60",
      "closing",
      "Hot",
      "Sudah transfer tanda jadi / booking fee unit nomor 12",
    ],
    [
      "Dewi Lestari",
      "085611223344",
      "Depok",
      "2026-10-27",
      "",
      "dihubungi",
      "Warm",
      "Merespon pesan perkenalan, minta brosur PDF dan pricelist",
    ],
    [
      "Ahmad Fauzi",
      "087899887766",
      "Bekasi",
      "2026-10-27",
      "Sasmaya",
      "baru",
      "Cold",
      "Lead baru masuk via form / WA iklan Meta, belum sempat follow up",
    ],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths for readability
  ws["!cols"] = [
    { wch: 22 }, // Nama
    { wch: 26 }, // Nomor WhatsApp
    { wch: 20 }, // Domisili
    { wch: 24 }, // Tanggal Masuk
    { wch: 38 }, // Kampanye / Iklan
    { wch: 18 }, // Tahap Funnel
    { wch: 24 }, // Label Kualitas
    { wch: 55 }, // Catatan Singkat
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Data Prospek CRM");

  // Sheet 2: Panduan & Validasi (Only included for XLSX)
  if (format === "xlsx") {
    const guideHeaders = ["Kolom", "Sifat", "Format & Nilai yang Diterima", "Contoh & Penjelasan"];
    const guideRows = [
      [
        "Nama Prospek",
        "Wajib",
        "Teks bebas",
        "Contoh: 'Budi Santoso'. Identitas calon pembeli properti.",
      ],
      [
        "Nomor WhatsApp / HP",
        "Wajib",
        "Angka / format telepon (min. 9 digit)",
        "Contoh: '081234567890' atau '+6281234567890'. Sistem otomatis mengenali dan mengenkripsi privasi nomor.",
      ],
      [
        "Domisili",
        "Opsional",
        "Teks nama kota / kabupaten",
        "Contoh: 'Jakarta Selatan', 'Tangerang Selatan', 'Bandung'. Domisili tempat tinggal calon pembeli.",
      ],
      [
        "Tanggal Masuk",
        "Opsional",
        "YYYY-MM-DD atau YYYY-MM-DD HH:mm",
        "Contoh: '2026-10-27'. Tanggal prospek pertama kali masuk untuk mengukur perkembangan lead.",
      ],
      [
        "Kampanye / Iklan",
        "Opsional",
        "Teks judul iklan atau kampanye",
        "Contoh: 'Cluster Sapphire BSD - Tipe 72 Hook Siap Huni'. Untuk menelusuri sumber promosi/iklan.",
      ],
      [
        "Tahap Funnel",
        "Wajib",
        "baru | dihubungi | prospek | survei | closing | batal",
        "Status perkembangan prospek:\n• baru: Lead baru masuk\n• dihubungi: Sudah dihubungi sales\n• prospek: Respon positif / tanya harga & unit\n• survei: Jadwal / selesai visit lokasi proyek\n• closing: Booking fee / tanda jadi deal\n• batal: Tidak berminat / gugur",
      ],
      [
        "Label Kualitas",
        "Opsional",
        "Hot | Warm | Cold",
        "Penilaian manual sales sebelum integrasi percakapan WhatsApp aktif:\n• Hot: Prospek sangat antusias & siap beli\n• Warm: Berminat, masih membandingkan opsi\n• Cold: Belum ada respon / minat rendah\n(Bisa dikosongkan jika belum cukup info)",
      ],
      [
        "Catatan Singkat",
        "Opsional",
        "Teks bebas",
        "Catatan penting kebutuhan unit, tipe properti, KPR, janji temu, dll.",
      ],
    ];

    const wsGuide = XLSX.utils.aoa_to_sheet([guideHeaders, ...guideRows]);
    wsGuide["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 38 }, { wch: 65 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan & Validasi");

    const sourceRows = sourceOptions.map((source) => [source.campaignName, source.adName, source.adStatus]);
    const wsSources = XLSX.utils.aoa_to_sheet([
      ["Nama Kampanye", "Nama Iklan", "Status Iklan"],
      ...(sourceRows.length ? sourceRows : [["Belum ada kampanye/iklan aktif atau pernah tayang", "", ""]]),
    ]);
    wsSources["!cols"] = [{ wch: 42 }, { wch: 52 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSources, "Daftar Iklan Aktif");
  }

  if (format === "csv") {
    const csvString = XLSX.utils.sheet_to_csv(ws);
    return Buffer.from(csvString, "utf-8");
  }

  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return xlsxBuffer;
}

/**
 * Parses an uploaded Excel or CSV file buffer into validated lead rows.
 */
export const MAX_CRM_ROWS = 5000;

export function parseCrmLeadsFile(buffer: Buffer, columnMap?: CrmColumnMap): ParsedSheetSummary {
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("Ukuran file melebihi batas maksimum 5 MB.");
  }
  const wb = XLSX.read(buffer, { type: "buffer" });
  if (wb.SheetNames.length > 10) {
    throw new Error("Workbook memiliki terlalu banyak sheet (maksimum 10).");
  }
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return { totalRows: 0, validRows: 0, invalidRows: 0, rows: [] };
  }

  const ws = wb.Sheets[firstSheetName];
  // Parse rows as array of arrays
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  if (rawRows.length - 1 > MAX_CRM_ROWS) {
    throw new Error(`Jumlah baris melebihi batas maksimum ${MAX_CRM_ROWS}.`);
  }

  if (rawRows.length < 2) {
    return { totalRows: 0, validRows: 0, invalidRows: 0, rows: [] };
  }

  const headerRow = (rawRows[0] || []).map((h) => String(h || "").trim().toLowerCase());

  // Precise index lookup avoiding false-matches (e.g. 'wa' in 'wajib')
  const mappedIndex = (field: keyof CrmColumnMap, automatic: number) => {
    const header = columnMap?.[field];
    if (!header) return automatic;
    const index = headerRow.findIndex((col) => col.trim().toLocaleLowerCase("id-ID") === header.trim().toLocaleLowerCase("id-ID"));
    return index;
  };
  const nameIdx = mappedIndex("name", headerRow.findIndex(
    (col) => /(nama|lead_name|prospect_name|\bname\b)/i.test(col) && !/(iklan|campaign|\bad\b)/i.test(col)
  ));
  const phoneIdx = mappedIndex("phone", headerRow.findIndex(
    (col) => /(whatsapp|telepon|phone|no\.?\s*hp|\bwa\b|\bhp\b)/i.test(col)
  ));
  const domisiliIdx = headerRow.findIndex(
    (col) => /(domisili|kota|lokasi|city|location|daerah|kabupaten|asal)/i.test(col)
  );
  const dateIdx = headerRow.findIndex(
    (col) => /(tanggal|date|waktu|time|masuk)/i.test(col)
  );
  const adSetIdx = mappedIndex("adSet", headerRow.findIndex((col) => /(ad\s*set|adset|kelompok iklan)/i.test(col)));
  const campaignIdx = mappedIndex("campaign", headerRow.findIndex(
    (col) => /(kampanye|campaign)/i.test(col) && !/(ad\s*set|adset|kelompok|iklan|\bad\b)/i.test(col)
  ));
  const adIdIdx = mappedIndex("adId", headerRow.findIndex(
    (col) => /(id iklan|ad id|meta ad|provider ad)/i.test(col) && !/(ad\s*set|adset|kampanye|campaign)/i.test(col)
  ));
  const namedAdIdx = headerRow.findIndex(
    (col) => /(nama iklan|iklan|\bad name\b|\bad\b)/i.test(col) && !/(ad\s*set|adset|kelompok|kampanye|campaign)/i.test(col)
  );
  const adIdx = mappedIndex("ad", namedAdIdx >= 0
    ? namedAdIdx
    : headerRow.findIndex((col, index) => index !== adIdIdx && index !== adSetIdx && index !== campaignIdx && /(iklan|kampanye|campaign|\bad\b)/i.test(col) && !/(ad\s*set|adset)/i.test(col)));
  const stageIdx = headerRow.findIndex(
    (col) => /(funnel|stage|tahap|status_prospek)/i.test(col)
  );
  const qualityIdx = headerRow.findIndex(
    (col) => /(label|kualitas|quality|hot.*warm|suhu)/i.test(col)
  );
  const notesIdx = headerRow.findIndex(
    (col) => /(catatan|note|keterangan|minat|singkat)/i.test(col)
  );

  // Optional legacy columns (backward compatibility)
  const attrIdx = headerRow.findIndex(
    (col) => /(atribusi|attribution)/i.test(col)
  );
  const buyerScoreIdx = headerRow.findIndex(
    (col) => /(buyer|skor.*prospek|prospek.*skor)/i.test(col)
  );
  const salesScoreIdx = headerRow.findIndex(
    (col) => /(sales|skor.*penjualan|penjualan.*skor)/i.test(col)
  );
  const dealValueIdx = headerRow.findIndex(
    (col) => /(nilai|harga|deal|transaksi|budget|price)/i.test(col)
  );

  const results: ParsedRowResult[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] || [];
    // Skip entirely empty rows
    const isRowEmpty = row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "");
    if (isRowEmpty) continue;

    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    // 1. Name validation
    const rawName = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";
    if (!rawName) {
      rowErrors.push("Nama prospek wajib diisi.");
    }

    // 2. Phone validation
    const rawPhone = phoneIdx >= 0 ? String(row[phoneIdx] || "").trim() : "";
    const cleanedDigits = cleanPhoneNumber(rawPhone);
    if (!rawPhone || cleanedDigits.length < 9) {
      rowErrors.push("Nomor WhatsApp/HP wajib diisi (minimal 9 digit).");
    }

    // 3. Domisili
    const rawDomisili = domisiliIdx >= 0 ? String(row[domisiliIdx] || "").trim() : "";

    // 4. Contact date (Tanggal Masuk)
    let tanggalKontak = new Date().toISOString();
    if (dateIdx >= 0 && row[dateIdx] !== "") {
      const cellVal = row[dateIdx];
      try {
        if (typeof cellVal === "number") {
          // Excel serial date format
          const dateObj = new Date(Math.round((cellVal - 25569) * 86400 * 1000));
          if (!isNaN(dateObj.getTime())) {
            tanggalKontak = dateObj.toISOString();
          }
        } else {
          const parsedD = new Date(String(cellVal).trim());
          if (!isNaN(parsedD.getTime())) {
            tanggalKontak = parsedD.toISOString();
          }
        }
      } catch {
        // Fallback to now
      }
    }

    // 5. Ad name
    const rawAdId = adIdIdx >= 0 ? String(row[adIdIdx] || "").trim() : "";
    const rawAdName = adIdx >= 0 ? String(row[adIdx] || "").trim() : "";
    const rawAdSet = adSetIdx >= 0 ? String(row[adSetIdx] || "").trim() : "";
    const rawCampaign = campaignIdx >= 0 ? String(row[campaignIdx] || "").trim() : "";

    // 6. Stage validation
    const rawStage = stageIdx >= 0 ? String(row[stageIdx] || "").trim() : "";
    const { stage, isDefault } = normalizeFunnelStage(rawStage);
    if (rawStage && isDefault && rawStage.toLowerCase() !== "baru") {
      rowWarnings.push(`Tahap '${rawStage}' disesuaikan menjadi '${stage}'.`);
    }

    // 7. Quality label
    let qualityLabel: QualityLabel | null = null;
    if (qualityIdx >= 0 && row[qualityIdx] !== "") {
      const parsedQuality = normalizeQualityLabel(String(row[qualityIdx] || ""));
      if (parsedQuality) {
        qualityLabel = parsedQuality;
      } else {
        rowWarnings.push(`Label kualitas '${row[qualityIdx]}' tidak dikenali. Gunakan Hot, Warm, atau Cold.`);
      }
    }

    // 8. Notes
    const rawNotes = notesIdx >= 0 ? String(row[notesIdx] || "").trim() : "";

    // 9. Attribution (optional / inferred from ad)
    const rawAttr = attrIdx >= 0 ? String(row[attrIdx] || "").trim() : "";
    const statusAtribusi = normalizeAttributionStatus(rawAttr, Boolean(rawAdName));

    // 10. Legacy Scores & Deal Value (optional)
    let skorProspek: number | undefined;
    if (buyerScoreIdx >= 0 && row[buyerScoreIdx] !== "") {
      const parsed = Number(row[buyerScoreIdx]);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        skorProspek = Math.round(parsed);
      } else if (!isNaN(parsed)) {
        skorProspek = Math.max(0, Math.min(100, Math.round(parsed)));
        rowWarnings.push("Skor prospek dibatasi antara 0 hingga 100.");
      }
    }

    let skorPenjualan: number | undefined;
    if (salesScoreIdx >= 0 && row[salesScoreIdx] !== "") {
      const parsed = Number(row[salesScoreIdx]);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        skorPenjualan = Math.round(parsed);
      } else if (!isNaN(parsed)) {
        skorPenjualan = Math.max(0, Math.min(100, Math.round(parsed)));
        rowWarnings.push("Skor penjualan dibatasi antara 0 hingga 100.");
      }
    }

    let nilaiProperti: number | undefined;
    if (dealValueIdx >= 0 && row[dealValueIdx] !== "") {
      const cleanedVal = String(row[dealValueIdx]).replace(/[^0-9]/g, "");
      const parsed = Number(cleanedVal);
      if (!isNaN(parsed) && parsed > 0) {
        nilaiProperti = parsed;
      }
    }

    const isValid = rowErrors.length === 0;

    let leadData: CrmLeadTemplateRow | undefined;
    if (isValid) {
      leadData = {
        nama: rawName,
        telepon: cleanedDigits,
        phoneHash: hashPhoneNumber(cleanedDigits),
        phoneMasked: maskPhoneNumber(cleanedDigits),
        domisili: rawDomisili || undefined,
        tanggalKontak,
        namaIklan: rawAdId || rawAdName || undefined,
        sourceAdSet: rawAdSet || undefined,
        sourceCampaign: rawCampaign || undefined,
        tahapFunnel: stage,
        qualityLabel,
        catatan: rawNotes || undefined,
        statusAtribusi,
        skorProspek,
        skorPenjualan,
        nilaiProperti,
      };
    }

    results.push({
      rowIndex: i + 1, // 1-indexed Excel row
      valid: isValid,
      data: leadData,
      errors: rowErrors,
      warnings: rowWarnings,
    });
  }

  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.length - validCount;

  return {
    totalRows: results.length,
    validRows: validCount,
    invalidRows: invalidCount,
    rows: results,
    headers: headerRow.filter(Boolean),
  };
}

/**
 * Imports validated CRM leads into Supabase database with tenant isolation and ad matching.
 */
export async function importCrmLeadsToDatabase(params: {
  organizationId: string;
  leads: CrmLeadTemplateRow[];
  supabase: SupabaseClient;
  allowUnattributed?: boolean;
  updateExisting?: boolean;
}): Promise<CrmImportResult> {
  const { organizationId, leads, supabase, allowUnattributed = false, updateExisting = false } = params;
  const batchId = crypto.randomUUID();

  let insertedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  let skippedCount = 0;
  const attribution = { direct: 0, adSet: 0, campaign: 0, unattributed: 0 };
  const rowResults: NonNullable<CrmImportResult["rowResults"]> = [];
  const errors: Array<{ row: number; error: string }> = [];
  const warnings: Array<{ row: number; warning: string }> = [];
  const importedLeads: CrmImportResult["importedLeads"] = [];

  // Resolve only against this organization's catalog. Ambiguous text is never
  // linked to an arbitrary ad or campaign.
  const sourceCatalog = await getTenantCrmSourceCatalog(supabase, organizationId);

  // 2. Fetch existing contacts for this organization to decide insert vs update
  const phoneHashes = leads.map((l) => l.phoneHash);
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("id, name, phone_hash, phone_masked")
    .eq("organization_id", organizationId)
    .in("phone_hash", phoneHashes);

  const contactByHash = new Map<string, { id: string; name: string }>();
  (existingContacts || []).forEach((c) => {
    if (c.phone_hash) contactByHash.set(c.phone_hash, { id: c.id, name: c.name || "" });
  });
  const conversationByContact = new Map<string, string>();
  const existingContactIds = [...contactByHash.values()].map((contact) => contact.id);
  if (existingContactIds.length > 0) {
    const { data: existingConversations } = await supabase
      .from("conversations")
      .select("id, contact_id")
      .eq("organization_id", organizationId)
      .in("contact_id", existingContactIds);
    for (const conversation of existingConversations || []) {
      if (conversation.contact_id) conversationByContact.set(conversation.contact_id, conversation.id);
    }
  }
  const seenInBatch = new Set<string>();

  // 3. Process each lead row sequentially to guarantee ACID-level integrity
  for (let idx = 0; idx < leads.length; idx++) {
    const lead = leads[idx];
    const rowNum = idx + 2;

    try {
      const resolvedSource = resolveCrmSourceFromCatalog(sourceCatalog, {
        adId: lead.adId,
        campaignId: lead.campaignId,
        adSetId: lead.adSetId,
        sourceName: lead.namaIklan,
        sourceAdSet: lead.sourceAdSet,
        sourceCampaign: lead.sourceCampaign,
      });
      const existingContact = contactByHash.get(lead.phoneHash);
      const decision = decideCrmImportRow({
        prospectValid: true,
        seenInFile: seenInBatch.has(lead.phoneHash),
        existsInWorkspace: !updateExisting && Boolean(existingContact && conversationByContact.has(existingContact.id)),
        matchMethod: resolvedSource.matchMethod,
        allowUnattributed,
      });
      seenInBatch.add(lead.phoneHash);
      if (!decision.save) {
        if (decision.status === "DUPLICATE") duplicateCount += 1;
        else skippedCount += 1;
        rowResults.push({
          rowNumber: rowNum,
          status: decision.status,
          error: decision.previewStatus === "INVALID_IDENTIFIER"
            ? "Identifier tidak ditemukan. Prospek tidak disimpan."
            : decision.previewStatus === "AMBIGUOUS_IDENTIFIER"
              ? "Nama cocok dengan lebih dari satu iklan. Prospek tidak disimpan."
              : null,
          recordId: existingContact ? conversationByContact.get(existingContact.id) || null : null,
          at: new Date().toISOString(),
        });
        continue;
      }
      if (decision.clearAttribution) {
        resolvedSource.adId = null;
        resolvedSource.campaignId = null;
        resolvedSource.providerAdSetId = null;
        resolvedSource.matchMethod = "none";
      }
      let contactId: string;
      const isNew = !existingContact;

      if (existingContact) {
        contactId = existingContact.id;
        // Update contact name & domisili if changed
        await supabase
          .from("contacts")
          .update({
            name: lead.nama,
            domisili: lead.domisili || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contactId);
        updatedCount++;
      } else {
        // Insert new contact
        const { data: newContact, error: insertContactError } = await supabase
          .from("contacts")
          .insert({
            organization_id: organizationId,
            name: lead.nama,
            phone_hash: lead.phoneHash,
            phone_masked: lead.phoneMasked,
            domisili: lead.domisili || null,
          })
          .select("id")
          .single();

        if (insertContactError || !newContact) {
          throw new Error(`Gagal menyimpan kontak: ${insertContactError?.message || "Unknown error"}`);
        }
        contactId = newContact.id;
        contactByHash.set(lead.phoneHash, { id: contactId, name: lead.nama });
        insertedCount++;
      }

      // Check for existing conversation for this contact
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id, attribution_evidence")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .maybeSingle();

      let conversationId: string;

      const evidencePayload = {
        source: "crm_sheet_upload",
        funnel_stage: lead.tahapFunnel,
        ad_name: resolvedSource.sourceName,
        ad_id: resolvedSource.adId,
        campaign_id: resolvedSource.campaignId,
        provider_adset_id: resolvedSource.providerAdSetId,
        attribution_note: lead.attributionNote || null,
        match_method: resolvedSource.matchMethod,
        import_batch_id: batchId,
        domisili: lead.domisili || null,
        quality_label: lead.qualityLabel || null,
        notes: lead.catatan || null,
        deal_value: lead.nilaiProperti || null,
        uploaded_at: new Date().toISOString(),
      };

      if (existingConv && !updateExisting) {
        duplicateCount += 1;
        rowResults.push({
          rowNumber: rowNum,
          status: "DUPLICATE",
          error: null,
          recordId: existingConv.id,
          at: new Date().toISOString(),
        });
        continue;
      } else if (existingConv) {
        conversationId = existingConv.id;
        await supabase.from("conversations").update({
          ad_id: resolvedSource.adId,
          campaign_id: resolvedSource.campaignId,
          quality_label: lead.qualityLabel || null,
          attribution_status: attributionStatusForCrmMatch(resolvedSource.matchMethod),
          attribution_evidence: evidencePayload,
          last_message_at: lead.tanggalKontak,
          updated_at: new Date().toISOString(),
        }).eq("id", conversationId).eq("organization_id", organizationId);
      } else {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            organization_id: organizationId,
            contact_id: contactId,
            ad_id: resolvedSource.adId,
            campaign_id: resolvedSource.campaignId,
            quality_label: lead.qualityLabel || null,
            channel: "crm_upload",
            attribution_status: attributionStatusForCrmMatch(resolvedSource.matchMethod),
            attribution_evidence: evidencePayload,
            started_at: lead.tanggalKontak,
            last_message_at: lead.tanggalKontak,
            deduplication_id: `crm_import_${lead.phoneHash}`,
          })
          .select("id")
          .single();

        if (convError || !newConv) {
          throw new Error(`Gagal membuat sesi percakapan CRM: ${convError?.message || "Unknown error"}`);
        }
        conversationId = newConv.id;
      }

      // Record lead outcome if appropriate
      let outcomeStage: "survey" | "booking" | "sale" | "lost" | "unknown" = "unknown";
      if (lead.tahapFunnel === "survei") outcomeStage = "survey";
      else if (lead.tahapFunnel === "closing") outcomeStage = "booking";
      else if (lead.tahapFunnel === "batal") outcomeStage = "lost";

      const { error: outcomeError } = await supabase.from("lead_outcomes").insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        stage: outcomeStage,
        value: lead.nilaiProperti || null,
        currency: "IDR",
        source: "manual",
        occurred_at: lead.tanggalKontak,
        notes: lead.catatan || `Diperbarui via CRM Sheets: tahap ${lead.tahapFunnel}`,
      });
      if (outcomeError) warnings.push({ row: rowNum, warning: "Prospek tersimpan, tetapi tahap tindak lanjut belum tercatat." });

      if (resolvedSource.matchMethod === "internal_ad_id" || resolvedSource.matchMethod === "meta_ad_id") attribution.direct += 1;
      else if (resolvedSource.matchMethod === "meta_adset_id" || resolvedSource.matchMethod === "adset_name") attribution.adSet += 1;
      else if (resolvedSource.matchMethod === "none") attribution.unattributed += 1;
      else attribution.campaign += 1;

      rowResults.push({
        rowNumber: rowNum,
        status: "SUCCESS",
        error: null,
        recordId: conversationId,
        at: new Date().toISOString(),
      });
      importedLeads.push({
        id: conversationId,
        name: lead.nama,
        phoneMasked: lead.phoneMasked,
        domisili: lead.domisili,
        funnelStage: lead.tahapFunnel,
        qualityLabel: lead.qualityLabel,
        notes: lead.catatan,
        isNew,
      });
    } catch (err) {
      failedCount++;
      const message = err instanceof Error ? err.message : "Kesalahan database tidak terduga";
      errors.push({ row: rowNum, error: message });
      rowResults.push({ rowNumber: rowNum, status: "FAILED", error: message, recordId: null, at: new Date().toISOString() });
    }
  }

  return {
    success: failedCount === 0 || insertedCount > 0,
    totalProcessed: leads.length,
    insertedCount,
    updatedCount,
    failedCount,
    duplicateCount,
    skippedCount,
    batchId,
    partial: failedCount > 0 && insertedCount > 0,
    attribution,
    rowResults,
    errors,
    warnings,
    importedLeads,
  };
}
