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

/** The month's name with its first letter capitalised (pt-BR writes "janeiro") and the year: "Novembro de 2026". */
export function monthLabel(month: Month, locale: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
    .formatToParts(new Date(y, m - 1, 1))
    .map((p) => (p.type === "month" ? p.value.charAt(0).toLocaleUpperCase(locale) + p.value.slice(1) : p.value))
    .join("");
}

/** A posting date (`YYYY-MM-DD`) as day and short month ("5 de jan."), read as a calendar date so no time zone moves it. */
export function formatDay(postedOn: string, locale: string): string {
  const [y, m, d] = postedOn.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}
