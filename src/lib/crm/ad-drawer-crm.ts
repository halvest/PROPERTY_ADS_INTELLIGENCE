export type CrmDrawerAvailability = "available" | "empty" | "error" | "incomplete";

export interface CrmConversationRow {
  id: string;
  ad_id?: string | null;
  campaign_id?: string | null;
  attribution_status?: string | null;
  quality_label?: string | null;
  channel?: string | null;
  attribution_evidence?: { funnel_stage?: string | null; provider_adset_id?: string | null } | null;
}

export interface CrmAdSummary {
  availability: CrmDrawerAvailability;
  workspaceTotal: number | null;
  directAd: number | null;
  attributedToAd: number | null;
  adSet: number | null;
  adSetState: "available" | "unavailable";
  campaignOnly: number | null;
  otherAds: number | null;
  unattributed: number | null;
  hot: number | null;
  warm: number | null;
  cold: number | null;
  campaignStages: Record<string, number>;
  attributedIds: string[];
  prospectsLine: string;
  lines: string[];
  note: string;
}

function temperature(label: string | null | undefined): "hot" | "warm" | "cold" | null {
  const value = (label || "").toLowerCase();
  if (value.includes("hot") || value.includes("panas")) return "hot";
  if (value.includes("warm") || value.includes("hangat")) return "warm";
  if (value.includes("cold") || value.includes("dingin")) return "cold";
  return null;
}

function blank(availability: CrmDrawerAvailability, line: string, note: string): CrmAdSummary {
  return {
    availability,
    workspaceTotal: availability === "empty" ? 0 : null,
    directAd: availability === "empty" ? 0 : null,
    attributedToAd: availability === "empty" ? 0 : null,
    adSet: null,
    adSetState: "unavailable",
    campaignOnly: availability === "empty" ? 0 : null,
    otherAds: availability === "empty" ? 0 : null,
    unattributed: availability === "empty" ? 0 : null,
    hot: availability === "empty" ? 0 : null,
    warm: availability === "empty" ? 0 : null,
    cold: availability === "empty" ? 0 : null,
    campaignStages: {},
    attributedIds: [],
    prospectsLine: line,
    lines: [line],
    note,
  };
}

export function summarizeCrmForAd(
  rows: CrmConversationRow[] | null,
  failed: boolean,
  adId: string,
  campaignId: string | null,
  options?: { truncated?: boolean; providerAdSetId?: string | null }
): CrmAdSummary {
  if (failed) {
    return blank(
      "error",
      "Gagal mengambil data CRM",
      "Pengambilan data CRM gagal. Angka 0 tidak dipakai sebagai pengganti."
    );
  }
  if (options?.truncated) {
    return blank(
      "incomplete",
      "Data CRM tidak lengkap",
      "Hasil query terpotong oleh batas halaman. Angka sebagian tidak ditampilkan sebagai total."
    );
  }

  const crmRows = (rows || []).filter((row) => row.channel === "crm_upload" || !row.channel);
  const seen = new Set<string>();
  let directAd = 0;
  let nameUnverified = 0;
  let adSetCount = 0;
  let campaignOnly = 0;
  let otherAds = 0;
  let unattributed = 0;
  let hot = 0;
  let warm = 0;
  let cold = 0;
  const attributedIds: string[] = [];
  const campaignStages: Record<string, number> = {};

  for (const row of crmRows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    const heat = temperature(row.quality_label);
    if (heat === "hot") hot += 1;
    else if (heat === "warm") warm += 1;
    else if (heat === "cold") cold += 1;

    const verified = (row.attribution_status || "").toLowerCase() === "verified";
    if (row.ad_id && row.ad_id === adId && verified) {
      directAd += 1;
      attributedIds.push(row.id);
    } else if (row.ad_id && row.ad_id === adId) {
      nameUnverified += 1;
      attributedIds.push(row.id);
    } else if (!row.ad_id && row.attribution_evidence?.provider_adset_id) {
      if (options?.providerAdSetId && row.attribution_evidence.provider_adset_id === options.providerAdSetId) adSetCount += 1;
      else otherAds += 1;
    } else if (!row.ad_id && campaignId && row.campaign_id === campaignId) {
      campaignOnly += 1;
      const stage = row.attribution_evidence?.funnel_stage?.trim().toLowerCase();
      if (stage) campaignStages[stage] = (campaignStages[stage] || 0) + 1;
    } else if (row.ad_id) {
      otherAds += 1;
    } else {
      unattributed += 1;
    }
  }

  const adSetKnown = Boolean(options?.providerAdSetId);
  const workspaceTotal = seen.size;
  if (workspaceTotal === 0) {
    return blank(
      "empty",
      "Langsung 0 · Kampanye 0 · Workspace 0",
      "Tidak ada prospek CRM pada workspace untuk periode ini. Atribusi ad set tidak tersedia karena percakapan tidak menyimpan ad set. Prospek berkualitas tidak dihitung."
    );
  }

  const stageNote = Object.entries(campaignStages)
    .map(([stage, count]) => `${count} ${stage}`)
    .join(", ");

  return {
    availability: "available",
    workspaceTotal,
    directAd,
    attributedToAd: directAd + nameUnverified,
    adSet: adSetKnown ? adSetCount : null,
    adSetState: adSetKnown ? "available" : "unavailable",
    campaignOnly,
    otherAds,
    unattributed,
    hot,
    warm,
    cold,
    campaignStages,
    attributedIds,
    lines: [
      `Atribusi langsung ke iklan: ${directAd.toLocaleString("id-ID")}`,
      adSetKnown ? `Atribusi ad set: ${adSetCount.toLocaleString("id-ID")}` : "Atribusi ad set: tidak tersedia",
      `Hanya kampanye: ${campaignOnly.toLocaleString("id-ID")}`,
      `Iklan lain: ${otherAds.toLocaleString("id-ID")}`,
      `Tanpa atribusi: ${unattributed.toLocaleString("id-ID")}`,
      `Total workspace: ${workspaceTotal.toLocaleString("id-ID")}`,
    ],
    prospectsLine: `Langsung ${(directAd + nameUnverified).toLocaleString("id-ID")} · Kampanye ${campaignOnly.toLocaleString("id-ID")} · Workspace ${workspaceTotal.toLocaleString("id-ID")}`,
    note: [
      `Hasil CRM iklan ini ${directAd + nameUnverified}. Klik terverifikasi ${directAd}. Terhubung ke iklan ${nameUnverified}. ${adSetKnown ? `Ad set ${adSetCount}.` : "Ad set tidak tersedia."} Hanya kampanye ${campaignOnly}. Iklan lain ${otherAds}. Tanpa atribusi ${unattributed}. Workspace ${workspaceTotal}.`,
      `Suhu workspace: ${hot} hot, ${warm} warm, ${cold} cold. Qualified lead adalah Hot atau Warm.`,
      stageNote ? `Tahap pada prospek yang hanya terhubung ke kampanye: ${stageNote}.` : "Tidak ada tahap tersimpan pada prospek yang hanya terhubung ke kampanye.",
      "Prospek tanpa iklan tidak dihitung sebagai hasil iklan ini. Klik Meta terverifikasi dan tautan ke satu-satunya iklan di kampanye sama-sama masuk hasil iklan.",
    ].join(" "),
  };
}
