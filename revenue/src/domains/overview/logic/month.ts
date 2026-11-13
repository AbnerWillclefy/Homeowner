/** `YYYY-MM`, the shape the API takes. */
export type Month = string;

const pad = (n: number) => String(n).padStart(2, "0");

/** The month on the device's clock. */
export const currentMonth = (now: Date): Month => `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

/** The calendar day on the device's clock, `YYYY-MM-DD`. */
export const currentDay = (now: Date): string => `${currentMonth(now)}-${pad(now.getDate())}`;

export function daysInMonth(month: Month): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m, 0).getDate();
}

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Formats a date as `Intl` does, with the month's first letter capitalised: pt-BR writes "novembro", Finances shows "Novembro" as en-US does. */
export function formatCapitalisedMonth(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options)
    .formatToParts(date)
    .map((p) => (p.type === "month" ? p.value.charAt(0).toLocaleUpperCase(locale) + p.value.slice(1) : p.value))
    .join("");
}

/** A posting date (`YYYY-MM-DD`) as day and month, read as a calendar date so no time zone moves it. */
export function formatDay(postedOn: string, locale: string): string {
  const [y, m, d] = postedOn.split("-").map(Number) as [number, number, number];
  return formatCapitalisedMonth(new Date(y, m - 1, d), locale, { day: "numeric", month: "short" });
}

/** Just the month's name ("Outubro"), for sentences like "a mais que em Outubro". */
export function monthName(month: Month, locale: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return formatCapitalisedMonth(new Date(y, m - 1, 1), locale, { month: "long" });
}

export function monthLabel(month: Month, locale: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return formatCapitalisedMonth(new Date(y, m - 1, 1), locale, { month: "long", year: "numeric" });
}

/** The `?month=` of a Finances view, when it is a real `YYYY-MM` no later than `thisMonth`; anything else is `thisMonth`. */
export function monthFromParam(value: string | null, thisMonth: Month): Month {
  return value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value <= thisMonth ? value : thisMonth;
}
