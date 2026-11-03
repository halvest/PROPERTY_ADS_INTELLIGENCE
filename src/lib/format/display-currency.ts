export type DisplayLocale = "id" | "en";

/** Satu format uang untuk halaman Ads. IDR memakai simbol Rp dan pemisah locale. */
export function formatDisplayCurrency(
  amount: number | null | undefined,
  currency?: string | null,
  locale: DisplayLocale = "id"
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const code = (currency || "IDR").trim().toUpperCase() || "IDR";
  const rounded = Math.round(amount);
  const intlLocale = locale === "id" ? "id-ID" : "en-US";
  if (code === "IDR") {
    return `Rp ${rounded.toLocaleString(intlLocale)}`;
  }
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `Rp ${rounded.toLocaleString(intlLocale)}`;
  }
}

export function formatAccountMask(rawId: string): string {
  const clean = rawId.replace(/^act_/, "");
  return clean.length > 4 ? `••••${clean.slice(-4)}` : clean;
}

export function syncFreshnessClass(lastSyncedAt?: string | null, now = Date.now()): string {
  if (!lastSyncedAt) return "bg-zinc-400";
  const age = now - new Date(lastSyncedAt).getTime();
  if (!Number.isFinite(age) || age < 0) return "bg-zinc-400";
  if (age <= 6 * 60 * 60 * 1000) return "bg-emerald-500";
  if (age <= 24 * 60 * 60 * 1000) return "bg-amber-500";
  return "bg-rose-500";
}
