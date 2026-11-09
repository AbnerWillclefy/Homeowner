import type { Bill } from "../api/api";
import { billState } from "./billState";

export interface BillGroup {
  bills: Bill[];
  totalCents: number;
}

export interface BillGroups {
  overdue: BillGroup;
  due: BillGroup;
  paid: BillGroup;
  /** The Pagas total. */
  paidCents: number;
  /** Vencida plus A pagar. */
  toPayCents: number;
}

const group = (bills: Bill[]): BillGroup => ({
  bills: [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  // A paid Bill counts what was paid when the server says, else its expected amount; the rest count expected amounts.
  totalCents: bills.reduce((sum, b) => sum + (b.paid ? (b.paidCents ?? b.expectedCents) : b.expectedCents), 0),
});

/** Vencida, A pagar and Pagas, each by due date. The summary is added up from the groups, so the two always agree. */
export function billGroups(bills: Bill[], today: string | null): BillGroups {
  const overdue: Bill[] = [];
  const due: Bill[] = [];
  const paid: Bill[] = [];
  for (const bill of bills) {
    const state = billState(bill, today);
    (state === "overdue" ? overdue : state === "due" ? due : paid).push(bill);
  }
  const groups = { overdue: group(overdue), due: group(due), paid: group(paid) };
  return { ...groups, paidCents: groups.paid.totalCents, toPayCents: groups.overdue.totalCents + groups.due.totalCents };
}
