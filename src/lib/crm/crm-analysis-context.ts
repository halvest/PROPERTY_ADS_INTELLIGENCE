export const CRM_CONTEXT_VERSION = "crm-context-v1";
export const QUALIFIED_LEAD_DEFINITION = {
  includedTemperatures: ["HOT", "WARM"] as const,
  excludedTemperatures: ["COLD"] as const,
};

export type CqplStatus = "available" | "unavailable";

export type CrmDataState = "available" | "unavailable" | "incomplete" | "not_configured";

export interface CrmCount {
  status: CrmDataState;
  value: number | null;
}

export interface CqplResult {
  status: CqplStatus;
  value: number | null;
  message: string;
  spend: number | null;
  qualifiedLeads: number | null;
}

export interface CrmAnalysisRow {
  id: string;
  organization_id?: string | null;
  started_at?: string | null;
  ad_id?: string | null;
  campaign_id?: string | null;
  attribution_status?: string | null;
  quality_label?: string | null;
  channel?: string | null;
  attribution_evidence?: { funnel_stage?: string | null; provider_adset_id?: string | null } | null;
}

export interface CrmAnalysisContext {
  version: string;
  organizationId: string | null;
  period: { since: string | null; until: string | null; timezone: "Asia/Jakarta" };
  sourceTable: "conversations";
  scope: "workspace" | "campaign" | "ad_set" | "ad";
  availability: "available" | "empty" | "error" | "incomplete";
  workspaceRecords: CrmCount;
  totalRecords: CrmCount;
  temperature: { hot: CrmCount; warm: CrmCount; cold: CrmCount; unclassified: CrmCount };
  workspaceTemperature: { hot: CrmCount; warm: CrmCount; cold: CrmCount; unclassified: CrmCount };
  stageDistribution: Record<string, number> | null;
  attribution: {
    directAd: CrmCount;
    adSet: CrmCount;
    campaign: CrmCount;
    unattributed: CrmCount;
  };
  outcomes: {
    surveyStage: CrmCount;
    surveysScheduled: CrmCount;
    surveysCompleted: CrmCount;
    bookings: CrmCount;
    closingStage: CrmCount;
    lost: CrmCount;
  };
  qualifiedLeads: CrmCount;
  cqpl: { workspace: CqplResult; campaign: CqplResult; adSet: CqplResult; ad: CqplResult };
  limitations: string[];
}

function counted(value: number, incomplete = false): CrmCount {
  return { status: incomplete ? "incomplete" : "available", value };
}

function unavailable(): CrmCount {
  return { status: "unavailable", value: null };
}

export function classifyTemperature(label: string | null | undefined): "hot" | "warm" | "cold" | "unclassified" {
  const value = (label || "").trim().toLowerCase();
  if (value === "hot" || value === "panas") return "hot";
  if (value === "warm" || value === "hangat") return "warm";
  if (value === "cold" || value === "dingin") return "cold";
  return "unclassified";
}

export function calculateCqpl(spend: number | null, qualifiedLeads: number | null, crmAvailable: boolean): CqplResult {
  if (!crmAvailable || qualifiedLeads === null) {
    return { status: "unavailable", value: null, message: "Data tidak tersedia", spend: null, qualifiedLeads: null };
  }
  if (spend === null || !Number.isFinite(spend) || spend < 0) {
    return { status: "unavailable", value: null, message: "Tidak dapat dihitung", spend: null, qualifiedLeads };
  }
  if (qualifiedLeads <= 0) {
    return { status: "unavailable", value: null, message: "Tidak dapat dihitung", spend, qualifiedLeads: 0 };
  }
  if (spend === 0) {
    return { status: "available", value: 0, message: "Spend pada periode dan cakupan ini nol.", spend: 0, qualifiedLeads };
  }
  return {
    status: "available",
    value: Number((spend / qualifiedLeads).toFixed(2)),
    message: "",
    spend,
    qualifiedLeads,
  };
}

export function calendarDayBounds(since?: string | null, until?: string | null) {
  const start = since ? new Date(`${since}T00:00:00+07:00`).toISOString() : null;
  const end = until ? new Date(`${until}T23:59:59.999+07:00`).toISOString() : null;
  return { start, end };
}

function blankCqpl(): CqplResult {
  return { status: "unavailable", value: null, message: "Tidak dihitung pada cakupan ini", spend: null, qualifiedLeads: null };
}

export function buildCrmAnalysisContext(
  rows: CrmAnalysisRow[] | null,
  options: {
    failed?: boolean;
    truncated?: boolean;
    organizationId?: string | null;
    since?: string | null;
    until?: string | null;
    scope: "workspace" | "campaign" | "ad_set" | "ad";
    campaignId?: string | null;
    adId?: string | null;
    providerAdSetId?: string | null;
    spend?: number | null;
  }
): CrmAnalysisContext {
  const spend = options.spend ?? null;
  const bounds = calendarDayBounds(options.since, options.until);
  const base = {
    version: CRM_CONTEXT_VERSION,
    organizationId: options.organizationId || null,
    period: { since: options.since || null, until: options.until || null, timezone: "Asia/Jakarta" as const },
    sourceTable: "conversations" as const,
    scope: options.scope,
  };

  if (options.failed || rows === null) {
    return {
      ...base,
      availability: "error",
      workspaceRecords: unavailable(),
      totalRecords: unavailable(),
      qualifiedLeads: unavailable(),
      cqpl: { workspace: calculateCqpl(null, null, false), campaign: calculateCqpl(null, null, false), adSet: calculateCqpl(null, null, false), ad: calculateCqpl(null, null, false) },
      temperature: { hot: unavailable(), warm: unavailable(), cold: unavailable(), unclassified: unavailable() },
      workspaceTemperature: { hot: unavailable(), warm: unavailable(), cold: unavailable(), unclassified: unavailable() },
      stageDistribution: null,
      attribution: { directAd: unavailable(), adSet: unavailable(), campaign: unavailable(), unattributed: unavailable() },
      outcomes: {
        surveyStage: unavailable(),
        surveysScheduled: unavailable(),
        surveysCompleted: unavailable(),
        bookings: unavailable(),
        closingStage: unavailable(),
        lost: unavailable(),
      },
      limitations: ["Query CRM gagal. Angka nol tidak dipakai sebagai pengganti."],
    };
  }

  const incomplete = Boolean(options.truncated);
  const seen = new Set<string>();
  let workspaceHot = 0;
  let workspaceWarm = 0;
  let workspaceCold = 0;
  let workspaceUnclassified = 0;
  let hot = 0;
  let warm = 0;
  let cold = 0;
  let unclassified = 0;
  let directAd = 0;
  let adSet = 0;
  let campaign = 0;
  let unattributed = 0;
  let surveyStage = 0;
  let closingStage = 0;
  let lost = 0;
  let scopeRecords = 0;
  const stages: Record<string, number> = {};
  const adSetKnown = options.scope === "workspace" || options.scope === "campaign" || Boolean(options.providerAdSetId);

  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    if (row.channel && row.channel !== "crm_upload") continue;
    if (options.organizationId && row.organization_id && row.organization_id !== options.organizationId) continue;
    if (row.started_at && (bounds.start || bounds.end)) {
      const at = new Date(row.started_at).getTime();
      if (bounds.start && at < new Date(bounds.start).getTime()) continue;
      if (bounds.end && at > new Date(bounds.end).getTime()) continue;
    }
    seen.add(row.id);
    const temperature = classifyTemperature(row.quality_label);
    if (temperature === "hot") workspaceHot += 1;
    else if (temperature === "warm") workspaceWarm += 1;
    else if (temperature === "cold") workspaceCold += 1;
    else workspaceUnclassified += 1;

    const verified = (row.attribution_status || "").toLowerCase() === "verified";
    const adSetId = row.attribution_evidence?.provider_adset_id || null;
    const inCampaign = Boolean(options.campaignId && row.campaign_id === options.campaignId);
    const linkedToAd = Boolean(options.adId && row.ad_id === options.adId);
    const directMatch = linkedToAd && verified;
    const adSetMatch = Boolean(!row.ad_id && adSetId && options.providerAdSetId && adSetId === options.providerAdSetId);
    const inScope = options.scope === "workspace"
      || (options.scope === "campaign" && inCampaign)
      || (options.scope === "ad_set" && adSetMatch)
      || (options.scope === "ad" && linkedToAd);
    if (inScope) {
      scopeRecords += 1;
      if (temperature === "hot") hot += 1;
      else if (temperature === "warm") warm += 1;
      else if (temperature === "cold") cold += 1;
      else unclassified += 1;
      const stage = row.attribution_evidence?.funnel_stage?.trim().toLowerCase() || "";
      if (stage) {
        stages[stage] = (stages[stage] || 0) + 1;
        if (stage === "survei" || stage === "survey") surveyStage += 1;
        if (stage === "closing") closingStage += 1;
        if (stage === "batal") lost += 1;
      }
    }

    if (options.scope === "ad" && directMatch) directAd += 1;
    else if (options.scope === "ad_set" && adSetMatch) adSet += 1;
    else if (options.scope === "workspace" && row.ad_id && verified) directAd += 1;
    else if (options.scope === "campaign" && inCampaign && row.ad_id && verified) directAd += 1;
    else if (!row.ad_id && adSetId && (options.scope === "workspace" || (options.scope === "campaign" && inCampaign) || (options.scope === "ad_set" && adSetMatch))) adSet += 1;
    else if (!row.ad_id && row.campaign_id && (options.scope === "workspace" || (options.scope === "campaign" && inCampaign))) campaign += 1;
    else if (!row.ad_id && !row.campaign_id && !adSetId && options.scope === "workspace") unattributed += 1;
  }
  const qualified = hot + warm;
  const activeCqpl = calculateCqpl(spend, qualified, true);
  const cqpl = {
    workspace: options.scope === "workspace" ? activeCqpl : blankCqpl(),
    campaign: options.scope === "campaign" ? activeCqpl : blankCqpl(),
    adSet: options.scope === "ad_set" ? activeCqpl : blankCqpl(),
    ad: options.scope === "ad" ? activeCqpl : blankCqpl(),
  };
  const scopedTotal = options.scope === "workspace" ? seen.size : scopeRecords;

  if (seen.size === 0) {
    return {
      ...base,
      availability: "empty",
      qualifiedLeads: counted(0),
      cqpl,
      workspaceRecords: counted(0),
      totalRecords: counted(0),
      temperature: { hot: counted(0), warm: counted(0), cold: counted(0), unclassified: counted(0) },
      workspaceTemperature: { hot: counted(0), warm: counted(0), cold: counted(0), unclassified: counted(0) },
      stageDistribution: {},
      attribution: { directAd: counted(0), adSet: adSetKnown ? counted(0) : unavailable(), campaign: counted(0), unattributed: counted(0) },
      outcomes: {
        surveyStage: counted(0),
        surveysScheduled: unavailable(),
        surveysCompleted: unavailable(),
        bookings: unavailable(),
        closingStage: counted(0),
        lost: counted(0),
      },
      limitations: [
        "Tidak ada prospek CRM pada cakupan dan periode ini.",
        "Qualified lead = Hot + Warm. Cold dan suhu kosong tidak dihitung.",
        activeCqpl.message || "CQPL dihitung dari spend dan qualified lead pada cakupan yang sama.",
      ],
    };
  }

  return {
    ...base,
    availability: incomplete ? "incomplete" : "available",
    qualifiedLeads: counted(qualified, incomplete),
    cqpl,
    workspaceRecords: counted(seen.size, incomplete),
    totalRecords: counted(scopedTotal, incomplete),
    temperature: { hot: counted(hot, incomplete), warm: counted(warm, incomplete), cold: counted(cold, incomplete), unclassified: counted(unclassified, incomplete) },
    workspaceTemperature: { hot: counted(workspaceHot, incomplete), warm: counted(workspaceWarm, incomplete), cold: counted(workspaceCold, incomplete), unclassified: counted(workspaceUnclassified, incomplete) },
    stageDistribution: stages,
    attribution: {
      directAd: counted(directAd, incomplete),
      adSet: adSetKnown ? counted(adSet, incomplete) : unavailable(),
      campaign: counted(campaign, incomplete),
      unattributed: counted(unattributed, incomplete),
    },
    outcomes: {
      surveyStage: counted(surveyStage, incomplete),
      surveysScheduled: unavailable(),
      surveysCompleted: unavailable(),
        bookings: unavailable(),
      closingStage: counted(closingStage, incomplete),
      lost: counted(lost, incomplete),
    },
    limitations: [
      "Qualified lead = Hot + Warm pada cakupan atribusi ini. Cold tidak dihitung. Suhu kosong atau tidak dikenal masuk unclassified.",
      "Tahap pipeline tidak menentukan qualified lead.",
      "Prospek yang hanya punya campaign_id tidak dihitung sebagai hasil satu iklan.",
      "Tahap survei tidak membedakan jadwal dan survei selesai. Tahap closing bukan transaksi.",
      activeCqpl.message || "CQPL = spend / qualified lead pada cakupan dan periode yang sama.",
    ],
  };
}

function show(count: CrmCount) {
  if (count.status === "available" || count.status === "incomplete") return String(count.value ?? 0);
  if (count.status === "not_configured") return "belum ditetapkan";
  return "tidak tersedia";
}

export function cqplForScope(context: CrmAnalysisContext): CqplResult {
  if (context.scope === "campaign") return context.cqpl.campaign;
  if (context.scope === "ad_set") return context.cqpl.adSet;
  if (context.scope === "ad") return context.cqpl.ad;
  return context.cqpl.workspace;
}

export function formatCrmContextForPrompt(context: CrmAnalysisContext) {
  const stages = context.stageDistribution
    ? Object.entries(context.stageDistribution).map(([stage, count]) => `${stage} ${count}`).join(", ") || "tidak ada"
    : "tidak tersedia";
  const cqpl = cqplForScope(context);
  const cqplText = cqpl.status === "available" && cqpl.value !== null ? String(cqpl.value) : cqpl.message;
  return [
    "CRM TERSTRUKTUR (fakta backend, jangan dihitung ulang):",
    "- Qualified Lead = HOT + WARM. COLD bukan qualified lead. Tahap pipeline bukan pengganti suhu.",
    `- version: ${context.version}; scope: ${context.scope}; status: ${context.availability}; sumber: ${context.sourceTable}; timezone: Asia/Jakarta`,
    `- total workspace: ${show(context.workspaceRecords)}; total pada cakupan ${context.scope}: ${show(context.totalRecords)}`,
    `- suhu cakupan hot/warm/cold/unclassified: ${show(context.temperature.hot)}/${show(context.temperature.warm)}/${show(context.temperature.cold)}/${show(context.temperature.unclassified)}`,
    `- suhu workspace hot/warm/cold: ${show(context.workspaceTemperature.hot)}/${show(context.workspaceTemperature.warm)}/${show(context.workspaceTemperature.cold)}`,
    `- qualified leads pada cakupan ini: ${show(context.qualifiedLeads)}`,
    `- tahap tercatat pada cakupan ini: ${stages}`,
    `- atribusi langsung iklan: ${show(context.attribution.directAd)}; ad set: ${show(context.attribution.adSet)}; hanya kampanye: ${show(context.attribution.campaign)}; tanpa atribusi: ${show(context.attribution.unattributed)}`,
    `- tahap survei: ${show(context.outcomes.surveyStage)}. Survei terjadwal: tidak tersedia. Survei selesai: tidak tersedia. Booking: tidak tersedia. Tahap closing: ${show(context.outcomes.closingStage)}. Batal: ${show(context.outcomes.lost)}.`,
    `- CQPL cakupan ${context.scope}: ${cqplText}`,
    "- Catatan CRM adalah tindak lanjut chat CTWA, bukan prospek formulir. Jangan menyamakan jumlah percakapan Meta dengan jumlah catatan. Catatan yang tertaut ke iklan ini adalah hasil tindak lanjut iklan itu. Jangan memindahkan catatan tanpa iklan ke satu iklan bila kampanye punya lebih dari satu iklan.",
  ].join("\n");
}
