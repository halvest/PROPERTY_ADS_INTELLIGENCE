export interface AdCardFacts {
  locale: "id" | "en";
  paused: boolean;
  spend: number | null;
  conversations: number | null;
  costPerConversation: number | null;
  linkCtr: number | null;
  hasTarget: boolean;
  directProspects: number | null;
  campaignOnly: number | null;
  crmFailed: boolean;
}

function money(locale: "id" | "en", value: number | null): string {
  if (value === null || !Number.isFinite(value)) return locale === "en" ? "unavailable" : "tidak tersedia";
  return `Rp${Math.round(value).toLocaleString(locale === "en" ? "en-US" : "id-ID")}`;
}

function count(locale: "id" | "en", value: number | null): string {
  if (value === null || !Number.isFinite(value)) return locale === "en" ? "unavailable" : "tidak tersedia";
  return value.toLocaleString(locale === "en" ? "en-US" : "id-ID");
}

function percent(locale: "id" | "en", value: number | null): string {
  if (value === null || !Number.isFinite(value)) return locale === "en" ? "unavailable" : "tidak tersedia";
  const digits = value.toFixed(2);
  return locale === "en" ? `${digits}%` : `${digits.replace(".", ",")}%`;
}

export function composeAdCardCopy(facts: AdCardFacts): { reason: string; summary: string } {
  const en = facts.locale === "en";
  const direct = count(facts.locale, facts.directProspects);
  const campaign = count(facts.locale, facts.campaignOnly);
  const spend = money(facts.locale, facts.spend);
  const cost = money(facts.locale, facts.costPerConversation);
  const conversations = count(facts.locale, facts.conversations);
  const ctr = percent(facts.locale, facts.linkCtr);

  if (facts.crmFailed) {
    return en
      ? {
          reason: facts.paused
            ? "Status is paused. CRM data is unavailable, so qualified leads are not calculated. Do not increase the budget."
            : "CRM data is unavailable, so qualified leads are not calculated. Do not treat a missing CRM count as zero.",
          summary: `Spend ${spend}. Meta conversations ${conversations}. Link CTR ${ctr} is an observation. CRM data is unavailable.`,
        }
      : {
          reason: facts.paused
            ? "Status dijeda. Data CRM tidak tersedia, jadi qualified lead tidak dihitung. Jangan menaikkan anggaran."
            : "Data CRM tidak tersedia, jadi qualified lead tidak dihitung. Angka yang gagal diambil bukan nol.",
          summary: `Belanja ${spend}. Percakapan Meta ${conversations}. CTR tautan ${ctr} adalah observasi. Data CRM tidak tersedia.`,
        };
  }

  const campaignNote = (facts.campaignOnly || 0) > 0
    ? en
      ? ` Notes without an ad (${campaign}) sit in a campaign that has more than one ad, so they are not this ad's follow-up yet.`
      : ` Catatan tanpa iklan (${campaign}) ada di kampanye yang punya lebih dari satu iklan, jadi belum menjadi tindak lanjut iklan ini.`
    : "";
  const reason = en
    ? `${facts.paused ? "Status is paused. " : ""}CTWA notes for this ad: ${direct}. Qualified leads are Hot or Warm among those notes.${campaignNote}${facts.paused ? " Do not increase the budget." : ""}`
    : `${facts.paused ? "Status dijeda. " : ""}Catatan CTWA iklan ini: ${direct}. Qualified lead adalah Hot atau Warm pada catatan itu.${campaignNote}${facts.paused ? " Jangan menaikkan anggaran." : ""}`;

  const targetNote = facts.hasTarget
    ? ""
    : en
      ? " No CPR target is set."
      : " Target CPR belum diatur.";
  const summary = en
    ? `Meta cost per conversation ${cost} from ${conversations} conversations on ${spend} spend. Those are chats Meta reported, not the CRM note count. Link CTR ${ctr} is an observation.${targetNote} CTWA notes for this ad: ${direct}.${campaignNote}`
    : `Biaya per percakapan Meta ${cost} dari ${conversations} percakapan pada belanja ${spend}. Itu chat yang Meta laporkan, bukan jumlah catatan CRM. CTR tautan ${ctr} adalah observasi.${targetNote} Catatan CTWA iklan ini: ${direct}.${campaignNote}`;

  return { reason, summary };
}
