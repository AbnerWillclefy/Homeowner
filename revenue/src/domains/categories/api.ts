import type { AxiosInstance } from "axios";
import { apiClient } from "../../api/client";
import { SPENDING_CATEGORIES, type SpendingCategory } from "./logic/categories";
import type { Limits } from "./logic/limit";

export interface CategorySpent {
  category: SpendingCategory;
  spentCents: number;
}

/** The part of a Transaction this screen reads. `amountCents` is signed: negative is money out. */
export interface Transaction {
  id: string;
  /** `YYYY-MM-DD`. */
  postedOn: string;
  description: string;
  amountCents: number;
  type: string;
  spendingCategory: SpendingCategory | null;
  /** `fallback` is an Expense nothing could categorise. */
  categorySetBy: "auto" | "user" | "fallback" | null;
}

export interface Spending {
  categories: CategorySpent[];
  /** The Spending limits, the same for every month. A category with none is absent. */
  limits: Limits;
  transactions: Transaction[];
}

export interface History {
  months: { month: string; spentCents: number; categories: CategorySpent[] }[];
}

export type WriteResult = { kind: "ok" } | { kind: "error" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isCategory = (v: unknown): v is SpendingCategory => (SPENDING_CATEGORIES as readonly unknown[]).includes(v);

function parseSpent(v: unknown): CategorySpent | null {
  return isRecord(v) && isCategory(v.category) && Number.isInteger(v.spentCents) ? (v as unknown as CategorySpent) : null;
}

function parseTransaction(v: unknown): Transaction | null {
  if (!isRecord(v)) return null;
  const { id, postedOn, description, amountCents, type, spendingCategory, categorySetBy } = v;
  if (![id, postedOn, description, type].every((s) => typeof s === "string") || !Number.isInteger(amountCents)) return null;
  if (spendingCategory !== null && !isCategory(spendingCategory)) return null;
  const setBy = categorySetBy === "auto" || categorySetBy === "user" || categorySetBy === "fallback" ? categorySetBy : null;
  return { id, postedOn, description, amountCents, type, spendingCategory, categorySetBy: setBy } as Transaction;
}

/** Every row of `rows` through `parse`; throws when `rows` is no array or a row is malformed. */
function parseAll<T>(rows: unknown, parse: (v: unknown) => T | null, what: string): T[] {
  if (!Array.isArray(rows)) throw new Error(`malformed ${what}`);
  const parsed = rows.map(parse);
  if (parsed.some((r) => r === null)) throw new Error(`malformed ${what} row`);
  return parsed as T[];
}

async function read(client: AxiosInstance, url: string, params: Record<string, string | number>): Promise<Record<string, unknown>> {
  const response = await client.get(url, { params });
  if (response.status !== 200) throw new Error(`GET ${url} answered ${response.status}`);
  if (!isRecord(response.data)) throw new Error(`GET ${url} answered a malformed body`);
  return response.data;
}

/** `GET /me/finance/transactions?month=`: what each Spending Category took, the limits and the rows. Throws on any failure, so a query shows its error state. */
export async function getSpending(month: string, client: AxiosInstance = apiClient): Promise<Spending> {
  const body = await read(client, "/me/finance/transactions", { month });
  // A body without `limits` reads as none.
  const limits = body.limits ?? {};
  if (!isRecord(limits) || !Object.entries(limits).every(([k, v]) => isCategory(k) && Number.isInteger(v) && (v as number) > 0)) throw new Error("malformed limits");
  return {
    categories: parseAll(body.categories, parseSpent, "categories"),
    limits: limits as Limits,
    transactions: parseAll(body.transactions, parseTransaction, "transactions"),
  };
}

/** `GET /me/finance/history?to=YYYY-MM&months=N`, N from 1 to 12, oldest month first. */
export async function getHistory(to: string, months: number, client: AxiosInstance = apiClient): Promise<History> {
  const body = await read(client, "/me/finance/history", { to, months });
  const parseMonth = (v: unknown) => {
    if (!isRecord(v) || typeof v.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.month) || !Number.isInteger(v.spentCents)) return null;
    return { month: v.month, spentCents: v.spentCents as number, categories: parseAll(v.categories, parseSpent, "history categories") };
  };
  return { months: parseAll(body.months, parseMonth, "history months") };
}

/** `PUT /me/finance/budgets/{category}`; null removes the Spending limit. A limit holds for every month. */
export async function putBudget(category: SpendingCategory, limitCents: number | null, client: AxiosInstance = apiClient): Promise<WriteResult> {
  try {
    const response = await client.put(`/me/finance/budgets/${encodeURIComponent(category)}`, { limitCents });
    return response.status === 204 ? { kind: "ok" } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
