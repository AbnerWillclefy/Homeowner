import type { Bill } from "../api";

export type BillState = "paid-bank" | "paid-hand" | "due" | "overdue";

/** `today` is `YYYY-MM-DD` in São Paulo; null for a past month, where nothing is overdue. Both are calendar dates, so comparing the strings is exact. */
export function billState(bill: Pick<Bill, "paid" | "paidBy" | "dueDate">, today: string | null): BillState {
  if (bill.paidBy === "bank") return "paid-bank";
  if (bill.paid) return "paid-hand";
  return today !== null && bill.dueDate < today ? "overdue" : "due";
}

export const isPaid = (state: BillState) => state === "paid-bank" || state === "paid-hand";

export interface BillSummary {
  paidCents: number;
  toPayCents: number;
  toPayCount: number;
}

/** Paid against still to pay. A paid Bill counts what was paid when the server says, else its expected amount. */
export function summarise(bills: Bill[]): BillSummary {
  const sum: BillSummary = { paidCents: 0, toPayCents: 0, toPayCount: 0 };
  for (const b of bills) {
    if (b.paid) sum.paidCents += b.paidCents ?? b.expectedCents;
    else {
      sum.toPayCents += b.expectedCents;
      sum.toPayCount += 1;
    }
  }
  return sum;
}

/** The Bill as marking it paid (or undoing) will leave it, for the optimistic update. */
export function withPaid(bill: Bill, paid: boolean): Bill {
  return { ...bill, paid, paidBy: paid ? "hand" : null, paidCents: paid ? bill.expectedCents : null };
}
