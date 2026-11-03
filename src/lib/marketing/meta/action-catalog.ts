export type MetaActionCategory = "messaging" | "lead" | "landing_page_view" | "link_click" | "other";

const definitions: Record<string, { category: MetaActionCategory; label: string; priority: number }> = {
  "onsite_conversion.messaging_conversation_started_7d": { category: "messaging", label: "Percakapan WhatsApp", priority: 1 },
  "onsite_conversion.total_messaging_connection": { category: "messaging", label: "Koneksi pesan", priority: 2 },
  "onsite_conversion.messaging_first_reply": { category: "messaging", label: "Balasan pertama", priority: 3 },
  "messaging_conversation_started_7d": { category: "messaging", label: "Percakapan WhatsApp", priority: 1 },
  "lead": { category: "lead", label: "Prospek", priority: 1 },
  "onsite_conversion.lead_grouped": { category: "lead", label: "Prospek", priority: 1 },
  "offsite_conversion.fb_pixel_lead": { category: "lead", label: "Prospek website", priority: 2 },
  "landing_page_view": { category: "landing_page_view", label: "Kunjungan halaman", priority: 1 },
  "omni_landing_page_view": { category: "landing_page_view", label: "Kunjungan halaman", priority: 1 },
  "link_click": { category: "link_click", label: "Klik tautan", priority: 1 },
};

export function describeMetaAction(type: string) {
  if (definitions[type]) return { type, ...definitions[type] };
  if (type.startsWith("offsite_conversion.custom.")) {
    const event = type.slice("offsite_conversion.custom.".length).replace(/[_-]+/g, " ").trim();
    return { type, category: "lead" as const, label: event ? `Prospek · ${event}` : "Prospek kustom", priority: 10 };
  }
  return { type, category: "other" as const, label: `Meta action: ${type}`, priority: 99 };
}

export function primaryActionType(breakdown: Record<string, number>, objective?: string | null): string | null {
  const obj = (objective || "").toUpperCase();
  // Link clicks remain a traffic metric; they are never promoted to a
  // conversion/result total or blended with leads and messaging outcomes.
  const actions = Object.keys(breakdown).map(describeMetaAction).filter((a) => a.category !== "other" && a.category !== "link_click" && (breakdown[a.type] || 0) > 0);
  const preferredCategory: MetaActionCategory | null = obj.includes("MESSAGE") ? "messaging" : obj.includes("LEAD") ? "lead" : obj.includes("TRAFFIC") || obj.includes("LINK_CLICKS") ? "landing_page_view" : null;
  const preferred = actions.filter((a) => a.category === preferredCategory).sort((a, b) => a.priority - b.priority)[0];
  if (preferred) return preferred.type;
  const categories = [...new Set(actions.map((a) => a.category))];
  if (categories.length !== 1) return null;
  return actions.sort((a, b) => a.priority - b.priority)[0]?.type ?? null;
}
