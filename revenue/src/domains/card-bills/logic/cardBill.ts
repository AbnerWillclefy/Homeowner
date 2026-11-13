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
