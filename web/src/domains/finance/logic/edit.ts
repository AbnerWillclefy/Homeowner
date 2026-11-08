import type { Transaction, TransactionType } from "../api/api";
import type { SpendingCategory } from "./spendingCategories";

export interface TransactionEdit {
  type?: TransactionType;
  spendingCategory?: SpendingCategory;
}

/** The PATCH body for what the dialog holds, or null when nothing changed. A category goes only with an Expense; the API refuses it otherwise. */
export function editFor(tx: Transaction, type: TransactionType, category: SpendingCategory): TransactionEdit | null {
  const edit: TransactionEdit = {};
  if (type !== tx.type) edit.type = type;
  if (type === "expense" && (type !== tx.type || category !== (tx.spendingCategory ?? "other"))) edit.spendingCategory = category;
  return Object.keys(edit).length > 0 ? edit : null;
}
