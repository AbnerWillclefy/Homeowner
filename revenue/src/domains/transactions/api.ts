import type { AxiosInstance } from "axios";
import { apiClient } from "../../api/client";
import type { SpendingCategory } from "./logic/categories";

export type TransactionType = "income" | "expense" | "transfer" | "saving";
export const TYPES: readonly TransactionType[] = ["income", "expense", "transfer", "saving"];

/** One Transaction of `GET /me/finance/transactions`. `amountCents` is signed: negative is money out. */
export interface Transaction {
  id: string;
  /** `YYYY-MM-DD`. */
  postedOn: string;
  countsOn: string;
  description: string;
  sourceName: string;
  amountCents: number;
  type: TransactionType;
  /** Only an Expense has one. */
  spendingCategory: SpendingCategory | null;
  installment: { number: number; total: number } | null;
}

export interface MonthResponse {
  month: string;
  transactions: Transaction[];
}

export interface TransactionEdit {
  type?: TransactionType;
  spendingCategory?: SpendingCategory;
}

export type PatchResult =
  | { kind: "ok"; transaction: Transaction }
  | { kind: "not-found" }
  | { kind: "error" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** The Transaction in `value`, or null when a field the screen reads is missing or of the wrong type. */
function parseTransaction(value: unknown): Transaction | null {
  if (!isRecord(value)) return null;
  const { id, postedOn, countsOn, description, sourceName, amountCents, type, spendingCategory, installment } = value;
  if (![id, postedOn, countsOn, description, sourceName].every((s) => typeof s === "string")) return null;
  if (!Number.isInteger(amountCents) || !TYPES.includes(type as TransactionType)) return null;
  if (spendingCategory !== null && typeof spendingCategory !== "string") return null;
  const parts = isRecord(installment) && Number.isInteger(installment.number) && Number.isInteger(installment.total);
  return {
    id, postedOn, countsOn, description, sourceName, amountCents, type, spendingCategory,
    installment: parts ? { number: installment.number, total: installment.total } : null,
  } as Transaction;
}

/** `GET /me/finance/transactions?month=`. Throws on any failure, so a query shows its error state. */
export async function getMonth(month: string, client: AxiosInstance = apiClient): Promise<MonthResponse> {
  const response = await client.get("/me/finance/transactions", { params: { month } });
  if (response.status !== 200) throw new Error(`GET transactions answered ${response.status}`);
  const rows: unknown = isRecord(response.data) ? response.data.transactions : null;
  if (!Array.isArray(rows)) throw new Error("malformed transactions body");
  const transactions = rows.map(parseTransaction);
  if (transactions.some((t) => t === null)) throw new Error("malformed transaction");
  return { month, transactions: transactions as Transaction[] };
}

/** `PATCH /me/finance/transactions/{id}`; an absent field stays as it is. 404 is another User's or a missing row. */
export async function patchTransaction(id: string, edit: TransactionEdit, client: AxiosInstance = apiClient): Promise<PatchResult> {
  try {
    const response = await client.patch(`/me/finance/transactions/${encodeURIComponent(id)}`, edit);
    if (response.status === 404) return { kind: "not-found" };
    const transaction = response.status === 200 ? parseTransaction(response.data) : null;
    return transaction ? { kind: "ok", transaction } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
