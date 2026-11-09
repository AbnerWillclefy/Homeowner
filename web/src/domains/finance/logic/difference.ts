export type DifferenceKey = "more" | "less" | "same";

/** How this month's spending compares with the previous one. `amount` is never negative. */
export function difference(current: number, previous: number): { key: DifferenceKey; amount: number } {
  const gap = current - previous;
  return { key: gap > 0 ? "more" : gap < 0 ? "less" : "same", amount: Math.abs(gap) };
}
