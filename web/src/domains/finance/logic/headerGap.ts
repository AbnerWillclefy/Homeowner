/**
 * The gap between "Committed this month" and "Spent since the 1st", as words. Committed is above Spent when earlier
 * purchases (card bills due this month) took part of it; below when this month's card purchases fall on later bills.
 */
export function headerGap(committedCents: number, spentSinceFirstCents: number): { key: "earlier" | "later"; amount: number } | null {
  const gap = committedCents - spentSinceFirstCents;
  if (gap === 0) return null;
  return { key: gap > 0 ? "earlier" : "later", amount: Math.abs(gap) };
}
