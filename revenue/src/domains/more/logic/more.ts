import type { Bill } from "../../bills/api";
import type { CommitmentMonth } from "../../overview/api/api";
import type { PantryItem } from "../../pantry/api";

/** The earliest due date of the Bills still to pay; null when none is. */
export function nextDue(bills: Pick<Bill, "paid" | "dueDate">[]): string | null {
  return bills.filter((b) => !b.paid).map((b) => b.dueDate).sort()[0] ?? null;
}

/** What the open card bills of the month add up to; null with no card. */
export function openCardBillsCents(cards: Pick<CommitmentMonth["cards"][number], "amountCents">[]): number | null {
  return cards.length === 0 ? null : cards.reduce((sum, c) => sum + c.amountCents, 0);
}

export const ranOutCount = (items: Pick<PantryItem, "state">[]) => items.filter((i) => i.state === "ran_out").length;
