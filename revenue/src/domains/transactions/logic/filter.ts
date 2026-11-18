import type { Transaction, TransactionType } from "../api";
import type { SpendingCategory } from "./categories";

export interface Filter {
  type: TransactionType | "all";
  category: SpendingCategory | "all";
  /** An Expense with no Spending Category yet: the "Revisar" badge and the phone's chip. */
  uncategorised: boolean;
  /** What the User typed in the search field. */
  query: string;
}

export const NO_FILTER: Filter = { type: "all", category: "all", uncategorised: false, query: "" };

export const isFiltered = (f: Filter) => f.type !== "all" || f.category !== "all" || f.uncategorised || f.query.trim() !== "";

/** Lower case with no accents, so "cafe" finds "Café". */
const plain = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Whether `query` finds the row: in its description, Note or Source name, or, when the query is only a number, in its amount.
 * "1.234,56", "1234,56" and "1234.56" all mean 123456 cents, so only the digits are compared.
 */
export function matchesQuery(tx: Transaction, query: string): boolean {
  const text = plain(query.trim());
  if (text === "") return true;
  if (plain(`${tx.description} ${tx.note ?? ""} ${tx.sourceName}`).includes(text)) return true;
  const digits = text.replace(/\D/g, "");
  return digits !== "" && /^[\d.,\s]+$/.test(text) && String(Math.abs(tx.amountCents)).includes(digits);
}

/** Client-side, over the month's rows. An Expense with no category yet counts as Other, as in Finances. */
export function filterRows(rows: Transaction[], { type, category, uncategorised, query }: Filter): Transaction[] {
  return rows.filter(
    (tx) =>
      (type === "all" || tx.type === type) &&
      (category === "all" || (tx.type === "expense" && (tx.spendingCategory ?? "other") === category)) &&
      (!uncategorised || isUncategorised(tx)) &&
      matchesQuery(tx, query),
  );
}

export const isUncategorised = (tx: Transaction) => tx.type === "expense" && tx.spendingCategory === null;
