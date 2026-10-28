/**
 * Formats a Date object in a specific timezone as YYYY-MM-DD (en-CA standard).
 */
export function formatDateInTimezone(date: Date, timezone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Parses user date range selection into deterministic inclusive date boundaries [since, until]
 * strictly adhering to the ad account's configured reporting timezone (Asia/Jakarta).
 */
export function parseDateRange(
  dateRange?: string,
  timezone = "Asia/Jakarta"
): { since?: string; until?: string } {
  if (!dateRange || dateRange === "all" || dateRange === "maximum") {
    return {};
  }

  // Handle custom range string "YYYY-MM-DD:YYYY-MM-DD" or "YYYY-MM-DD_YYYY-MM-DD"
  if (dateRange.includes(":") || (dateRange.includes("_") && !dateRange.startsWith("this_") && !dateRange.startsWith("last_"))) {
    const separator = dateRange.includes(":") ? ":" : "_";
    const [s, u] = dateRange.split(separator);
    if (s && u) {
      return { since: s.trim(), until: u.trim() };
    }
  }

  const now = new Date();
  const todayStr = formatDateInTimezone(now, timezone);

  if (dateRange === "today" || dateRange === "1d") {
    return { since: todayStr, until: todayStr };
  }

  if (dateRange === "yesterday") {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatDateInTimezone(yesterday, timezone);
    return { since: yesterdayStr, until: yesterdayStr };
  }

  if (dateRange === "3d") {
    const start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 3 days inclusive: [today-2, today]
    return { since: formatDateInTimezone(start, timezone), until: todayStr };
  }

  if (dateRange === "7d") {
    const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // 7 days inclusive: [today-6, today]
    return { since: formatDateInTimezone(start, timezone), until: todayStr };
  }

  if (dateRange === "14d") {
    const start = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
    return { since: formatDateInTimezone(start, timezone), until: todayStr };
  }

  if (dateRange === "30d") {
    const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { since: formatDateInTimezone(start, timezone), until: todayStr };
  }

  if (dateRange === "this_month") {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
    }).formatToParts(now);
    const year = Number(parts.find((p) => p.type === "year")?.value || now.getFullYear());
    const month = Number(parts.find((p) => p.type === "month")?.value || now.getMonth() + 1);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    return { since: firstDay, until: todayStr };
  }

  if (dateRange === "last_month") {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
    }).formatToParts(now);
    let year = Number(parts.find((p) => p.type === "year")?.value || now.getFullYear());
    let month = Number(parts.find((p) => p.type === "month")?.value || now.getMonth() + 1) - 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
    return { since: firstDay, until: lastDay };
  }

  return {};
}

/**
 * Computes an equivalent previous date range with the exact same inclusive duration in days.
 * E.g. [2026-10-10, 2026-10-20] (11 days) -> [2026-09-29, 2026-10-09] (11 days).
 */
export function getEquivalentPreviousPeriod(
  since: string,
  until: string
): { prevSince: string; prevUntil: string } | null {
  if (!since || !until) return null;
  const sDate = new Date(`${since}T00:00:00Z`);
  const uDate = new Date(`${until}T00:00:00Z`);
  const durationMs = uDate.getTime() - sDate.getTime();
  if (durationMs < 0 || Number.isNaN(durationMs)) return null;

  const msPerDay = 86400000;
  const prevEndMs = sDate.getTime() - msPerDay;
  const prevStartMs = prevEndMs - durationMs;

  return {
    prevSince: new Date(prevStartMs).toISOString().slice(0, 10),
    prevUntil: new Date(prevEndMs).toISOString().slice(0, 10),
  };
}

