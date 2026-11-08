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

/** A posting date (`YYYY-MM-DD`) as day and month, read as a calendar date so no time zone moves it. */
export function formatDay(postedOn: string, locale: string): string {
  const [y, m, d] = postedOn.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}

/** Just the month's name ("outubro"), for sentences like "a mais que em outubro". */
export function monthName(month: Month, locale: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(y, m - 1, 1));
}

export function monthLabel(month: Month, locale: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}
