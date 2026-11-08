import type { CommitmentMonth } from "../api/api";
import type { Month } from "./month";

export interface CommittedBar {
  month: Month;
  /** Fixed Bills. */
  bills: number;
  installments: number;
  total: number;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** One bar per month with something committed, split into Bills and installments. The total is their sum, so the bar and its text agree. */
export function committedBars(months: CommitmentMonth[]): CommittedBar[] {
  return months
    .filter((m) => m.committedCents > 0)
    .map((m) => {
      const bills = sum(m.bills.map((b) => b.expectedCents));
      const installments = sum(m.installments.map((i) => i.amountCents));
      return { month: m.month, bills, installments, total: bills + installments };
    });
}
