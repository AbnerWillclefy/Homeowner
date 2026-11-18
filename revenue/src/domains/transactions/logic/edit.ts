import type { Transaction, TransactionEdit, TransactionType } from "../api";
import type { SpendingCategory } from "./categories";

export const NOTE_MAX = 200;

/** The Note as sent: control characters (a pasted tab) become spaces, since the server refuses them. */
const clean = (text: string) => text.replace(/\p{Cc}/gu, " ").trim();

/** Whether the Note is over the server's limit. It counts code points, as the server does, not UTF-16 units. */
export const noteTooLong = (text: string) => [...clean(text)].length > NOTE_MAX;

/** The PATCH body for what the sheet holds, or null when nothing changed. A category goes only with an Expense; the API refuses it otherwise. */
export function editFor(tx: Transaction, type: TransactionType, category: SpendingCategory, note: string): TransactionEdit | null {
  const edit: TransactionEdit = {};
  if (type !== tx.type) edit.type = type;
  if (type === "expense" && (type !== tx.type || category !== (tx.spendingCategory ?? "other"))) edit.spendingCategory = category;
  if (clean(note) !== (tx.note ?? "")) edit.note = clean(note);
  return Object.keys(edit).length > 0 ? edit : null;
}

/** The row as the edit will leave it, for the optimistic update. */
export function applyEdit(tx: Transaction, edit: TransactionEdit): Transaction {
  const type = edit.type ?? tx.type;
  const note = edit.note === undefined ? tx.note : edit.note === "" ? null : edit.note;
  return { ...tx, type, spendingCategory: type === "expense" ? (edit.spendingCategory ?? tx.spendingCategory) : null, note };
}
