import type { MessageKey } from "../../../shared/i18n";

export type BillState = "paid-bank" | "paid-hand" | "due" | "overdue";

/** The fields of a Bill the state is told from. `paidBy` may be absent while the API does not send it. */
export interface BillPayment {
  paid: boolean;
  paidBy?: "hand" | "bank" | null;
  /** `YYYY-MM-DD`. */
  dueDate: string;
}

/** `today` is `YYYY-MM-DD`; both are calendar dates, so comparing the strings is exact. */
export function billState(bill: BillPayment, today: string | null): BillState {
  if (bill.paidBy === "bank") return "paid-bank";
  if (bill.paid) return "paid-hand";
  // A null `today` is a past month: nothing in it is overdue.
  return today !== null && bill.dueDate < today ? "overdue" : "due";
}

/** Overdue has no fixed label: it names the day ("Venceu dia 5"). */
export const BILL_STATE_KEY: Record<Exclude<BillState, "overdue">, MessageKey> = {
  "paid-bank": "finances.bills.state.paidBank",
  "paid-hand": "finances.bills.state.paid",
  due: "finances.bills.state.due",
};
