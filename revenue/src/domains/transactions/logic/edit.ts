import type { Transaction, TransactionEdit, TransactionType } from "../api";
import type { SpendingCategory } from "./categories";

/** The PATCH body for what the sheet holds, or null when nothing changed. A category goes only with an Expense; the API refuses it otherwise. */
export function editFor(tx: Transaction, type: TransactionType, category: SpendingCategory): TransactionEdit | null {
  const edit: TransactionEdit = {};
  if (type !== tx.type) edit.type = type;
  if (type === "expense" && (type !== tx.type || category !== (tx.spendingCategory ?? "other"))) edit.spendingCategory = category;
  return Object.keys(edit).length > 0 ? edit : null;
}

/** The row as the edit will leave it, for the optimistic update. */
export function applyEdit(tx: Transaction, edit: TransactionEdit): Transaction {
  const type = edit.type ?? tx.type;
  return { ...tx, type, spendingCategory: type === "expense" ? (edit.spendingCategory ?? tx.spendingCategory) : null };
}
