export type AdResultMetricKind = "conversion" | "link_click" | "interaction" | "zero" | "unavailable";

export interface AdResultMetricInput {
  spend: number | null | undefined;
  impressions: number | null | undefined;
  conversions: number | null | undefined;
  linkClicks: number | null | undefined;
  clicks: number | null | undefined;
  objective?: string | null;
}

export interface ResolvedAdResultMetric {
  value: number | null;
  label: string;
  costPerResult: number | null;
  kind: AdResultMetricKind;
  unitLabel: string;
}

const finite = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function conversionLabel(objective?: string | null, locale: "id" | "en" = "id") {
  const value = (objective || "").toUpperCase();
  if (value === "MESSAGES") return locale === "en" ? "WhatsApp Chats" : "Chat WhatsApp";
  if (value === "OUTCOME_ENGAGEMENT") return locale === "en" ? "Interactions" : "Interaksi";
  if (value === "OUTCOME_LEADS" || value === "LEAD_GENERATION") return locale === "en" ? "Leads" : "Prospek";
  return locale === "en" ? "Conversions" : "Konversi";
}

/** Keeps verified conversions primary, then uses clearly labelled click proxies. */
export function resolveAdResultMetric(
  input: AdResultMetricInput,
  locale: "id" | "en" = "id"
): ResolvedAdResultMetric {
  const spend = Math.max(0, finite(input.spend) ?? 0);
  const impressions = Math.max(0, finite(input.impressions) ?? 0);
  const conversions = Math.max(0, finite(input.conversions) ?? 0);
  const linkClicks = Math.max(0, finite(input.linkClicks) ?? 0);
  const clicks = Math.max(0, finite(input.clicks) ?? 0);
  const hasActivity = spend > 0 || impressions > 0 || linkClicks > 0 || clicks > 0 || conversions > 0;

  if (conversions > 0) {
    return {
      value: conversions,
      label: conversionLabel(input.objective, locale),
      costPerResult: Math.round(spend / conversions),
      kind: "conversion",
      unitLabel: locale === "en" ? "result" : "hasil",
    };
  }
  if (linkClicks > 0) {
    return {
      value: linkClicks,
      label: locale === "en" ? "Link Clicks" : "Klik Tujuan",
      costPerResult: Math.round(spend / linkClicks),
      kind: "link_click",
      unitLabel: locale === "en" ? "click" : "klik",
    };
  }
  if (clicks > 0) {
    return {
      value: clicks,
      label: locale === "en" ? "Interactions" : "Interaksi",
      costPerResult: Math.round(spend / clicks),
      kind: "interaction",
      unitLabel: locale === "en" ? "interaction" : "interaksi",
    };
  }
  if (impressions > 0 || spend > 0) {
    return {
      value: 0,
      label: locale === "en" ? "Results" : "Hasil",
      costPerResult: 0,
      kind: "zero",
      unitLabel: locale === "en" ? "result" : "hasil",
    };
  }
  return {
    value: null,
    label: locale === "en" ? "No data yet" : "Belum ada data",
    costPerResult: null,
    kind: hasActivity ? "zero" : "unavailable",
    unitLabel: locale === "en" ? "result" : "hasil",
  };
}

/** Localizes server-returned result labels across ID and EN. */
export function localizeResultLabel(rawLabel?: string | null, locale: "id" | "en" = "id"): string {
  const trimmed = rawLabel?.trim() || "";
  if (!trimmed) return locale === "en" ? "Results" : "Hasil";
  const lower = trimmed.toLowerCase();
  if (locale === "en") {
    if (lower === "chat whatsapp" || lower === "percakapan whatsapp") return "WhatsApp Chats";
    if (lower === "percakapan" || lower === "percakapan messaging") return "Conversations";
    if (lower === "pesan") return "Messages";
    if (lower === "interaksi") return "Interactions";
    if (lower === "prospek" || lower === "leads") return "Leads";
    if (lower === "konversi") return "Conversions";
    if (lower === "klik tujuan" || lower === "klik tautan") return "Link Clicks";
    if (lower === "tayangan") return "Impressions";
    if (lower === "hasil" || lower === "hasil meta") return "Results";
    if (lower === "belum ada data") return "No data yet";
    return trimmed;
  }
  if (lower === "whatsapp chats") return "Chat WhatsApp";
  if (lower === "conversations") return "Percakapan";
  if (lower === "messages") return "Pesan";
  if (lower === "interactions") return "Interaksi";
  if (lower === "leads") return "Prospek";
  if (lower === "conversions") return "Konversi";
  if (lower === "link clicks") return "Klik Tujuan";
  if (lower === "impressions") return "Tayangan";
  if (lower === "results") return "Hasil";
  if (lower === "no data yet") return "Belum ada data";
  return trimmed;
}

/** Localizes server-returned unit labels across ID and EN. */
export function localizeResultUnitLabel(rawUnit?: string | null, locale: "id" | "en" = "id"): string {
  const trimmed = rawUnit?.trim() || "";
  if (!trimmed) return locale === "en" ? "result" : "hasil";
  const lower = trimmed.toLowerCase();
  if (locale === "en") {
    if (lower === "hasil") return "result";
    if (lower === "klik") return "click";
    if (lower === "interaksi") return "interaction";
    if (lower === "percakapan") return "conversation";
    if (lower === "prospek") return "lead";
    return trimmed;
  }
  if (lower === "result" || lower === "results") return "hasil";
  if (lower === "click" || lower === "clicks") return "klik";
  if (lower === "interaction" || lower === "interactions") return "interaksi";
  if (lower === "conversation" || lower === "conversations") return "percakapan";
  if (lower === "lead" || lower === "leads") return "prospek";
  return trimmed;
}

/** Localizes server-returned delivery status labels across ID and EN. */
export function localizeDeliveryLabel(
  rawLabel?: string | null,
  deliveryStatus?: string | null,
  campaignStatus?: string | null,
  adStatus?: string | null,
  locale: "id" | "en" = "id"
): string {
  const del = (deliveryStatus || "").toUpperCase();
  const camp = (campaignStatus || "").toUpperCase();
  const ad = (adStatus || "").toUpperCase();

  if (del === "DELIVERING") return locale === "en" ? "Delivering" : "Menayangkan";
  if (camp === "PAUSED") return locale === "en" ? "Campaign Paused" : "Kampanye Dijeda";
  if (ad === "PAUSED") return locale === "en" ? "Ad Paused" : "Iklan Dijeda";
  if (camp === "ARCHIVED" || ad === "ARCHIVED") return locale === "en" ? "Archived" : "Diarsipkan";
  if (camp === "DELETED" || ad === "DELETED") return locale === "en" ? "Deleted" : "Dihapus";
  if (del === "NOT_DELIVERING") return locale === "en" ? "Not Delivering" : "Tidak Tayang";

  const trimmed = rawLabel?.trim() || "";
  if (!trimmed) return locale === "en" ? "Unknown" : "Belum diketahui";
  const lower = trimmed.toLowerCase();
  if (locale === "en") {
    if (lower.includes("menayangkan") && !lower.includes("tidak")) return "Delivering";
    if (lower.includes("kampanye dijeda") || lower.includes("campaign dijeda")) return "Campaign Paused";
    if (lower.includes("iklan dijeda")) return "Ad Paused";
    if (lower.includes("diarsipkan")) return "Archived";
    if (lower.includes("dihapus")) return "Deleted";
    if (lower.includes("tidak tayang") || lower.includes("tidak menayangkan")) return "Not Delivering";
    if (lower.includes("belum diketahui") || lower.includes("tidak diketahui")) return "Unknown";
  }
  return trimmed;
}

const GENERIC_AD_NAME = /^(carousel|carausel|corousel|video|vidio|image|single image|photo|foto|post|iklan|ad|ads|advantage\+?)(\s*\d*)?$/i;
const GENERIC_ADSET_NAME = /^(ad\s*set(\s*meta)?|set\s*iklan|ad\s*set\s*\d+)$/i;

export function isGenericAdIdentity(value?: string | null) {
  const normalized = value?.trim() || "";
  return !normalized || normalized.length < 9 || GENERIC_AD_NAME.test(normalized) || GENERIC_ADSET_NAME.test(normalized);
}

export function normalizeCreativeFormat(value?: string | null, locale: "id" | "en" = "id") {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (/^(carousel|carausel|corousel)(\s*\d*)?$/.test(normalized)) return "Carousel";
  if (/^(video|vidio)(\s*\d*)?$/.test(normalized)) return "Video";
  if (["image", "single image", "photo", "foto"].includes(normalized)) return locale === "en" ? "Image" : "Gambar";
  if (normalized === "post") return locale === "en" ? "Post Content" : "Konten Post";
  if (["ad", "ads", "iklan"].includes(normalized)) return locale === "en" ? "Ad" : "Iklan";
  if (normalized.startsWith("advantage")) return "Advantage+";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatSmartAdIdentity(
  input: {
    adName?: string | null;
    adSetName?: string | null;
    campaignName?: string | null;
    providerAdId?: string | null;
    creativeFormat?: string | null;
  },
  locale: "id" | "en" = "id"
) {
  const adName = input.adName?.trim() || "";
  const adSetName = input.adSetName?.trim() || "";
  const campaignName = input.campaignName?.trim() || "";
  const adIsGeneric = isGenericAdIdentity(adName);
  const adSetIsGeneric = isGenericAdIdentity(adSetName);
  const campaignIsGeneric = isGenericAdIdentity(campaignName);
  const fallbackName = locale === "en" ? "Meta Ad" : "Iklan Meta";
  let title = adName || fallbackName;

  if (adIsGeneric) {
    const base = !adSetIsGeneric ? adSetName : !campaignIsGeneric ? campaignName : fallbackName;
    const context = !adSetIsGeneric && !campaignIsGeneric && adSetName.toLocaleLowerCase("id-ID") !== campaignName.toLocaleLowerCase("id-ID")
      ? campaignName
      : "";
    title = context ? `${base} · ${context}` : base;
  } else if (!campaignIsGeneric && campaignName.toLocaleLowerCase("id-ID") !== adName.toLocaleLowerCase("id-ID")) {
    title = `${adName} · ${campaignName}`;
  }

  const detectedFormat = input.creativeFormat || (adIsGeneric ? adName : null);
  return {
    title,
    formatBadge: normalizeCreativeFormat(detectedFormat, locale),
    subtitle: input.providerAdId
      ? locale === "en"
        ? `Ad ID: ${input.providerAdId}`
        : `ID Iklan: ${input.providerAdId}`
      : locale === "en"
        ? "Ad ID unavailable"
        : "ID Iklan tidak tersedia",
  };
}

const META_OBJECTIVE_LABELS_ID: Record<string, string> = {
  OUTCOME_ENGAGEMENT: "Tujuan: Interaksi & Chat WA",
  MESSAGES: "Tujuan: Interaksi & Chat WA",
  OUTCOME_LEADS: "Tujuan: Pengumpulan Prospek",
  LEAD_GENERATION: "Tujuan: Pengumpulan Prospek",
  OUTCOME_SALES: "Tujuan: Konversi & Penjualan",
  CONVERSIONS: "Tujuan: Konversi & Penjualan",
  OUTCOME_TRAFFIC: "Tujuan: Kunjungan Tautan",
  LINK_CLICKS: "Tujuan: Kunjungan Tautan",
  OUTCOME_AWARENESS: "Tujuan: Jangkauan Merek",
  REACH: "Tujuan: Jangkauan Merek",
};

const META_OBJECTIVE_LABELS_EN: Record<string, string> = {
  OUTCOME_ENGAGEMENT: "Objective: Engagement & WA Chat",
  MESSAGES: "Objective: Engagement & WA Chat",
  OUTCOME_LEADS: "Objective: Lead Generation",
  LEAD_GENERATION: "Objective: Lead Generation",
  OUTCOME_SALES: "Objective: Conversions & Sales",
  CONVERSIONS: "Objective: Conversions & Sales",
  OUTCOME_TRAFFIC: "Objective: Link Traffic",
  LINK_CLICKS: "Objective: Link Traffic",
  OUTCOME_AWARENESS: "Objective: Brand Reach",
  REACH: "Objective: Brand Reach",
};

export function translateMetaTerm(value?: string | null, locale: "id" | "en" = "id") {
  const raw = value?.trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  const objectiveMap = locale === "en" ? META_OBJECTIVE_LABELS_EN : META_OBJECTIVE_LABELS_ID;
  if (objectiveMap[upper]) return objectiveMap[upper];
  const statusLabels: Record<string, string> =
    locale === "en"
      ? {
          ACTIVE: "Active",
          PAUSED: "Paused",
          ARCHIVED: "Archived",
          DELETED: "Deleted",
          DELIVERING: "Delivering",
          NOT_DELIVERING: "Not delivering",
          CAMPAIGN_PAUSED: "Campaign Paused",
          AD_PAUSED: "Ad Paused",
          UNKNOWN: "Unknown",
        }
      : {
          ACTIVE: "Aktif",
          PAUSED: "Dijeda",
          ARCHIVED: "Diarsipkan",
          DELETED: "Dihapus",
          DELIVERING: "Menayangkan",
          NOT_DELIVERING: "Tidak menayangkan",
          CAMPAIGN_PAUSED: "Kampanye Dijeda",
          AD_PAUSED: "Iklan Dijeda",
          UNKNOWN: "Belum diketahui",
        };
  if (statusLabels[upper]) return statusLabels[upper];
  if (upper.startsWith("OUTCOME_")) {
    const prefix = locale === "en" ? "Objective" : "Tujuan";
    return `${prefix}: ${upper.slice("OUTCOME_".length).toLocaleLowerCase(locale === "en" ? "en-US" : "id-ID").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
  }
  return raw;
}

export function formatMetaDateRange(
  start?: string | null,
  stop?: string | null,
  locale: "id" | "en" = "id"
) {
  if (!start || !stop) return null;
  const formatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const parse = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00+07:00`);
  const startDate = parse(start);
  const stopDate = parse(stop);
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(stopDate.valueOf())) return null;
  return `${formatter.format(startDate)} – ${formatter.format(stopDate)}`;
}
