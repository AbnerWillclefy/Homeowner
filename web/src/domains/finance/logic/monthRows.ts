import type { CommitmentMonth } from "../api/api";

export type RowItem =
  | { kind: "card"; key: string; name: string; cents: number; daysKnown: boolean }
  | { kind: "bill"; key: string; name: string; cents: number; paid: boolean }
  | { kind: "offCardInstallments"; key: string; cents: number }
  | { kind: "planned"; key: string; category: string; cents: number };

export interface RowGroup {
  id: "cards" | "bills" | "planned" | "spent" | "saving";
  cents: number;
  items: RowItem[];
}

export interface MonthRows {
  groups: RowGroup[];
  totalCents: number;
  /** Null when no Monthly income is set. Negative when the month takes more than the income. */
  leftoverCents: number | null;
  /** By how much the total passes the income; 0 otherwise. */
  overCents: number;
}

const sum = (items: { cents: number }[]) => items.reduce((a, i) => a + i.cents, 0);

/**
 * A month's groups in the order the screen shows them. The cards group is always there (empty means no bill known
 * yet); the others only when they hold something, and "spent off the card" and "put aside" only when the API sends them
 * (the API always sends the second; the first for the current month only). Totals and the leftover are the API's, never recomputed.
 */
export function monthRows(m: CommitmentMonth): MonthRows {
  const cards = m.cards.map((c): RowItem => ({ kind: "card", key: c.sourceId, name: c.name, cents: c.amountCents, daysKnown: c.billDaysKnown }));
  const bills = m.otherBills.map((b): RowItem => ({ kind: "bill", key: b.id, name: b.name, cents: b.cents, paid: b.paid }));
  if (m.otherInstallmentsCents > 0) bills.push({ kind: "offCardInstallments", key: "installments", cents: m.otherInstallmentsCents });
  const planned = m.planned.filter((p) => p.cents > 0).map((p): RowItem => ({ kind: "planned", key: p.category, category: p.category, cents: p.cents }));

  const groups: RowGroup[] = [{ id: "cards", cents: sum(cards), items: cards }];
  if (bills.length > 0) groups.push({ id: "bills", cents: sum(bills), items: bills });
  if (planned.length > 0 || m.plannedCents > 0) groups.push({ id: "planned", cents: m.plannedCents, items: planned });
  if (m.spentOffCardCents !== undefined) groups.push({ id: "spent", cents: m.spentOffCardCents, items: [] });
  if (m.savingCents !== undefined) groups.push({ id: "saving", cents: m.savingCents, items: [] });

  const leftoverCents = m.leftoverCents ?? null;
  return { groups, totalCents: m.totalCents, leftoverCents, overCents: leftoverCents !== null && leftoverCents < 0 ? -leftoverCents : 0 };
}
