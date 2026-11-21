import type { CommitmentMonth } from "../../overview/api/api";
import { addMonths, type Month } from "../../overview/logic/month";

export interface Plan {
  name: string;
  /** The next installment due, from the month the plan first appears in. */
  next: number;
  total: number;
  amountCents: number;
  /** The month of the last installment: `first + (total - next)`. */
  last: Month;
}

/**
 * The Installment plans, in order of first appearance. A line has no plan id, so a plan is its name and total.
 * Counting from the first appearance also dates a plan whose end is past the months the API returns.
 */
export function plansInProgress(months: Pick<CommitmentMonth, "month" | "installments">[]): Plan[] {
  const plans = new Map<string, Plan>();
  for (const m of months) {
    for (const i of m.installments) {
      const key = JSON.stringify([i.name, i.total]);
      if (!plans.has(key)) plans.set(key, { name: i.name, next: i.number, total: i.total, amountCents: i.amountCents, last: addMonths(m.month, i.total - i.number) });
    }
  }
  return [...plans.values()];
}
