export interface IncomeSplit {
  spent: number;
  unpaid: number;
  /** Income minus spent minus unpaid; negative when over. */
  left: number;
  /** How far past the income, 0 when not over. */
  over: number;
  /** What the bar's full width stands for: the income, or spent plus unpaid when over, so it never draws past 100%. */
  scale: number;
}

/** The Monthly income split into spent so far, Bills still unpaid and what is left; null while no income is set. */
export function incomeSplit(income: number | null, spentCents: number, unpaidCents: number): IncomeSplit | null {
  if (income === null) return null;
  const spent = Math.max(0, spentCents); // a refund-heavy month is not negative spending
  const left = income - spent - unpaidCents;
  return { spent, unpaid: unpaidCents, left, over: Math.max(0, -left), scale: Math.max(income, spent + unpaidCents) };
}
