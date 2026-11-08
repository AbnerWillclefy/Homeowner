export type DifferenceKey = "more" | "less" | "same";

/** How this month's spending compares with the previous one. `amount` is never negative. */
export function difference(current: number, previous: number): { key: DifferenceKey; amount: number } {
  const gap = current - previous;
  return { key: gap > 0 ? "more" : gap < 0 ? "less" : "same", amount: Math.abs(gap) };
}

/** A bar's width in percent of the largest value; zero or negative draws nothing (the text carries the value). */
export const barWidth = (cents: number, max: number): number => (max > 0 && cents > 0 ? (cents / max) * 100 : 0);
