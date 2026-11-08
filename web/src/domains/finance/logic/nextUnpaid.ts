import type { Bill } from "../api/api";
import { billState } from "./billState";

/** The `count` unpaid Bills nearest by due date; overdue ones come first because their dates are earlier. */
export function nextUnpaid(bills: Bill[], today: string, count: number): Bill[] {
  return bills
    .filter((bill) => billState(bill, today) === "due" || billState(bill, today) === "overdue")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, count);
}
