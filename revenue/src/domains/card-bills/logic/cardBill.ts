import type { CardBill, CardTransaction } from "./../api";

/**
 * The card's rows in its bill, newest first: in a cycle (`heldFrom`) those posted from its start and, once closed,
 * before `heldTo`, whatever month they count in; otherwise those whose `countsOn` is in `month` (`YYYY-MM`).
 */
export function billRows(rows: readonly CardTransaction[], bill: Pick<CardBill, "sourceId" | "heldFrom" | "heldTo">, month: string): CardTransaction[] {
  const { sourceId, heldFrom, heldTo } = bill;
  const inBill = (r: CardTransaction) => (heldFrom ? r.postedOn >= heldFrom && (!heldTo || r.postedOn < heldTo) : r.countsOn.startsWith(month));
  return rows
    .filter((r) => r.sourceId === sourceId && inBill(r))
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn) || a.id.localeCompare(b.id));
}

/** The bill's own rows told apart: charges in installments, subscriptions, and the rest. Sums of the rows, which may differ from the bank's total. */
export function billSplit(rows: readonly CardTransaction[]): { purchasesCents: number; installmentsCents: number; subscriptionsCents: number } {
  const split = { purchasesCents: 0, installmentsCents: 0, subscriptionsCents: 0 };
  for (const r of rows) {
    const key = r.installment ? "installmentsCents" : r.spendingCategory === "subscriptions" ? "subscriptionsCents" : "purchasesCents";
    split[key] -= r.amountCents;
  }
  return split;
}

/** The card `?card=` names, else the first; undefined without cards. A Source that is gone or not a card in the list falls back to the first. */
export const pickCard = <T extends { sourceId: string }>(bills: readonly T[], param: string | null): T | undefined =>
  bills.find((b) => b.sourceId === param) ?? bills[0];
