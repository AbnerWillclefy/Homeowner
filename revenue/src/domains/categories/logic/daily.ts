import type { Transaction } from "../api";

export interface DayPoint {
  /** Day of the month, as the axis label. */
  label: string;
  cents: number;
  /** Trailing average of up to `WINDOW` days; early days average the days there are. */
  average: number;
}

const WINDOW = 7;

/**
 * Spending by posted day, from day 1 to `lastDay`. The rule is the API's (`MonthTotals`): every Expense counts,
 * a refund offsets its day, so the days add up to the Spending Categories' total. A day with no spending is 0.
 */
export function dailySpend(rows: Transaction[], lastDay: number): DayPoint[] {
  const cents = Array.from({ length: lastDay }, () => 0);
  for (const tx of rows) {
    const day = Number(tx.postedOn.slice(8));
    if (tx.type === "expense" && day >= 1 && day <= lastDay) cents[day - 1]! -= tx.amountCents;
  }
  return cents.map((c, i) => {
    const window = cents.slice(Math.max(0, i - WINDOW + 1), i + 1);
    return { label: String(i + 1), cents: c, average: Math.round(window.reduce((n, x) => n + x, 0) / window.length) };
  });
}

/** The limits spread over the days of the month: the daily pace that ends the month on the limits. Undefined with no limit. */
export function limitPace(limits: Record<string, number | undefined>, days: number): number | undefined {
  const sum = Object.values(limits).reduce<number>((n, c) => n + (c ?? 0), 0);
  return sum > 0 ? Math.round(sum / days) : undefined;
}
