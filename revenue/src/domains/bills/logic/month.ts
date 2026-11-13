/** `YYYY-MM`, the shape the API takes. */
export type Month = string;

const pad = (n: number) => String(n).padStart(2, "0");

/** The calendar day in São Paulo (`YYYY-MM-DD`), the day the API counts "today" in; never the device's own day. */
export function saoPauloDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** The `?month=` when it is a real `YYYY-MM` no later than `thisMonth`; anything else is `thisMonth`. */
export function monthFromParam(value: string | null, thisMonth: Month): Month {
  return value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value <= thisMonth ? value : thisMonth;
}

/** Formats a date with the month's first letter capitalised: pt-BR writes "janeiro". */
function format(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options)
    .formatToParts(date)
    .map((p) => (p.type === "month" ? p.value.charAt(0).toLocaleUpperCase(locale) + p.value.slice(1) : p.value))
    .join("");
}

export function monthLabel(month: Month, locale: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return format(new Date(y, m - 1, 1), locale, { month: "long", year: "numeric" });
}

/** A due date (`YYYY-MM-DD`) as day and month, read as a calendar date so no time zone moves it. */
export function formatDay(date: string, locale: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return format(new Date(y, m - 1, d), locale, { day: "numeric", month: "short" });
}
