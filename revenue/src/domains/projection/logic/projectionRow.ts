import type { CommitmentMonth } from "../../overview/api/api";
import { monthRows } from "../../overview/logic/monthRows";

/** A month as the table's columns. Off-card installments sit in `bills`, as in the month card. */
export interface ProjectionRow {
  month: string;
  cardsCents: number;
  billsCents: number;
  plannedCents: number;
  /** Spent off the card: the API sends it for the current month only. */
  spentCents: number | undefined;
  savingCents: number | undefined;
  /** Null when no Monthly income is set. */
  leftoverCents: number | null;
}

export function projectionRow(m: CommitmentMonth): ProjectionRow {
  const { groups, leftoverCents } = monthRows(m);
  const cents = (id: string) => groups.find((g) => g.id === id)?.cents;
  return {
    month: m.month, cardsCents: cents("cards") ?? 0, billsCents: cents("bills") ?? 0, plannedCents: cents("planned") ?? 0,
    spentCents: cents("spent"), savingCents: cents("saving"), leftoverCents,
  };
}
