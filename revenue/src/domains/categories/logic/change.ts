import { addMonths, type Month } from "../../../shared/month/month";
import type { History } from "../api";
import type { SpendingCategory } from "./categories";

/** The change against the previous month, in whole percent; null when that month spent nothing, as there is nothing to compare. */
export function changePercent(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

/** The month before `month` in a history: its total and what each category took. Null when the history lacks it. */
export function previousMonth(history: History | undefined, month: Month) {
  const prev = addMonths(month, -1);
  const found = history?.months.find((m) => m.month === prev);
  if (!found) return null;
  return {
    month: prev,
    total: found.categories.reduce((n, c) => n + c.spentCents, 0),
    byCategory: new Map<SpendingCategory, number>(found.categories.map((c) => [c.category, c.spentCents])),
  };
}

/** Where `today` (`YYYY-MM-DD`, São Paulo) stands in `month`: "day 10 of 31, 32% of the month". */
export function dayProgress(today: string, month: Month) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const day = Number(today.slice(8));
  const days = new Date(y, m, 0).getDate();
  return { day, days, percent: Math.round((day / days) * 100) };
}

/** "+12%", "-4%" or "0%". */
export const formatChange = (percent: number, locale: string): string =>
  new Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero" }).format(percent / 100);
