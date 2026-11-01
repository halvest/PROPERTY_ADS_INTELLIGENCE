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

function conversionLabel(objective?: string | null) {
  const value = (objective || "").toUpperCase();
  if (value === "MESSAGES") return "Chat WhatsApp";
  if (value === "OUTCOME_ENGAGEMENT") return "Interaksi";
  if (value === "OUTCOME_LEADS" || value === "LEAD_GENERATION") return "Prospek";
  return "Konversi";
}

/** Keeps verified conversions primary, then uses clearly labelled click proxies. */
export function resolveAdResultMetric(input: AdResultMetricInput): ResolvedAdResultMetric {
  const spend = Math.max(0, finite(input.spend) ?? 0);
  const impressions = Math.max(0, finite(input.impressions) ?? 0);
  const conversions = Math.max(0, finite(input.conversions) ?? 0);
  const linkClicks = Math.max(0, finite(input.linkClicks) ?? 0);
  const clicks = Math.max(0, finite(input.clicks) ?? 0);
  const hasActivity = spend > 0 || impressions > 0 || linkClicks > 0 || clicks > 0 || conversions > 0;

  if (conversions > 0) {
    return {
      value: conversions,
      label: conversionLabel(input.objective),
      costPerResult: Math.round(spend / conversions),
      kind: "conversion",
      unitLabel: "hasil",
    };
  }
  if (linkClicks > 0) {
    return { value: linkClicks, label: "Klik Tujuan", costPerResult: Math.round(spend / linkClicks), kind: "link_click", unitLabel: "klik" };
  }
  if (clicks > 0) {
    return { value: clicks, label: "Interaksi", costPerResult: Math.round(spend / clicks), kind: "interaction", unitLabel: "interaksi" };
  }
  if (impressions > 0 || spend > 0) {
    return { value: 0, label: "Hasil", costPerResult: 0, kind: "zero", unitLabel: "hasil" };
  }
  return { value: null, label: "Belum ada data", costPerResult: null, kind: hasActivity ? "zero" : "unavailable", unitLabel: "hasil" };
}

const GENERIC_AD_NAME = /^(carousel|carausel|corousel|video|vidio|image|single image|photo|foto|post|iklan|ad|ads|advantage\+?)(\s*\d*)?$/i;
const GENERIC_ADSET_NAME = /^(ad\s*set(\s*meta)?|set\s*iklan|ad\s*set\s*\d+)$/i;

export function isGenericAdIdentity(value?: string | null) {
  const normalized = value?.trim() || "";
  return !normalized || normalized.length < 9 || GENERIC_AD_NAME.test(normalized) || GENERIC_ADSET_NAME.test(normalized);
}

export function normalizeCreativeFormat(value?: string | null) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (/^(carousel|carausel|corousel)(\s*\d*)?$/.test(normalized)) return "Carousel";
  if (/^(video|vidio)(\s*\d*)?$/.test(normalized)) return "Video";
  if (["image", "single image", "photo", "foto"].includes(normalized)) return "Gambar";
  if (normalized === "post") return "Konten Post";
  if (["ad", "ads", "iklan"].includes(normalized)) return "Iklan";
  if (normalized.startsWith("advantage")) return "Advantage+";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatSmartAdIdentity(input: {
  adName?: string | null;
  adSetName?: string | null;
  campaignName?: string | null;
  providerAdId?: string | null;
  creativeFormat?: string | null;
}) {
  const adName = input.adName?.trim() || "";
  const adSetName = input.adSetName?.trim() || "";
  const campaignName = input.campaignName?.trim() || "";
  const adIsGeneric = isGenericAdIdentity(adName);
  const adSetIsGeneric = isGenericAdIdentity(adSetName);
  const campaignIsGeneric = isGenericAdIdentity(campaignName);
  let title = adName || "Iklan Meta";

  if (adIsGeneric) {
    const base = !adSetIsGeneric ? adSetName : !campaignIsGeneric ? campaignName : "Iklan Meta";
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
    formatBadge: normalizeCreativeFormat(detectedFormat),
    subtitle: input.providerAdId ? `ID Iklan: ${input.providerAdId}` : "ID Iklan tidak tersedia",
  };
}

const META_OBJECTIVE_LABELS: Record<string, string> = {
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

export function translateMetaTerm(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (META_OBJECTIVE_LABELS[upper]) return META_OBJECTIVE_LABELS[upper];
  const statusLabels: Record<string, string> = {
    ACTIVE: "Aktif",
    PAUSED: "Dijeda",
    ARCHIVED: "Diarsipkan",
    DELETED: "Dihapus",
    DELIVERING: "Menayangkan",
    NOT_DELIVERING: "Tidak menayangkan",
    UNKNOWN: "Belum diketahui",
  };
  if (statusLabels[upper]) return statusLabels[upper];
  if (upper.startsWith("OUTCOME_")) {
    return `Tujuan: ${upper.slice("OUTCOME_".length).toLocaleLowerCase("id-ID").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
  }
  return raw;
}

export function formatMetaDateRange(start?: string | null, stop?: string | null) {
  if (!start || !stop) return null;
  const formatter = new Intl.DateTimeFormat("id-ID", {
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
