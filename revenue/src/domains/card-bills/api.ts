import type { AxiosInstance } from "axios";
import { apiClient } from "../../api/client";

/**
 * One card's bill for a month, from the commitments. `fromBank` is true for a closed bill, whose amount is the
 * bank's total; false for the open bill, whose amount is the app's sum plus known installments.
 */
export interface CardBill {
  sourceId: string;
  name: string;
  amountCents: number;
  billDaysKnown: boolean;
  fromBank: boolean;
  /** `YYYY-MM-DD`, or null when neither the bank nor the card's days say. */
  dueOn: string | null;
  closesOn: string | null;
}

/** A card Source with its closing and due days (1 to 31), null while not set. */
export interface CardSource {
  id: string;
  name: string;
  closeDay: number | null;
  dueDay: number | null;
}

/** One Transaction of a card. `amountCents` is signed: negative is money out. */
export interface CardTransaction {
  id: string;
  sourceId: string;
  description: string;
  /** `YYYY-MM-DD`. */
  postedOn: string;
  countsOn: string;
  amountCents: number;
  installment: { number: number; total: number } | null;
}

export type BillDaysResult = { kind: "ok" } | { kind: "fields"; fields: Record<string, string> } | { kind: "not-found" } | { kind: "error" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isNullableDay = (v: unknown): v is string | null => v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));

function parseCard(v: unknown): CardBill | null {
  if (!isRecord(v)) return null;
  const { sourceId, name, amountCents, billDaysKnown, fromBank, dueOn = null, closesOn = null } = v;
  if (typeof sourceId !== "string" || typeof name !== "string" || !isInt(amountCents)) return null;
  if (typeof billDaysKnown !== "boolean" || typeof fromBank !== "boolean" || !isNullableDay(dueOn) || !isNullableDay(closesOn)) return null;
  return { sourceId, name, amountCents, billDaysKnown, fromBank, dueOn, closesOn };
}

function parseSource(v: unknown): CardSource | null {
  if (!isRecord(v)) return null;
  const { id, name, closeDay, dueDay } = v;
  if (typeof id !== "string" || typeof name !== "string") return null;
  const day = (d: unknown) => (isInt(d) ? d : null);
  return { id, name, closeDay: day(closeDay), dueDay: day(dueDay) };
}

function parseTransaction(v: unknown): CardTransaction | null {
  if (!isRecord(v)) return null;
  const { id, sourceId, description, postedOn, countsOn, amountCents, installment } = v;
  if (![id, sourceId, description, postedOn, countsOn].every((s) => typeof s === "string") || !isInt(amountCents)) return null;
  const parts = isRecord(installment) && isInt(installment.number) && isInt(installment.total);
  return { id, sourceId, description, postedOn, countsOn, amountCents, installment: parts ? { number: installment.number, total: installment.total } : null } as CardTransaction;
}

async function readRows<T>(client: AxiosInstance, url: string, params: Record<string, string> | undefined, pick: (body: unknown) => unknown, parse: (v: unknown) => T | null): Promise<T[]> {
  const response = await client.get(url, { params });
  if (response.status !== 200) throw new Error(`GET ${url} answered ${response.status}`);
  const rows = pick(response.data);
  if (!Array.isArray(rows)) throw new Error(`GET ${url} answered a malformed body`);
  const parsed = rows.map(parse);
  if (parsed.some((r) => r === null)) throw new Error(`GET ${url} answered a malformed row`);
  return parsed as T[];
}

/** `GET /me/finance/commitments?from=`: the cards of `month`. Throws on any failure, so a query shows its error state. */
export const getCardBills = (month: string, client: AxiosInstance = apiClient) =>
  readRows(client, "/me/finance/commitments", { from: month }, (b) => {
    const months = isRecord(b) ? b.months : null;
    const first = Array.isArray(months) ? months.find((m) => isRecord(m) && m.month === month) : null;
    return isRecord(first) ? first.cards : null;
  }, parseCard);

/** `GET /me/finance`: the card Sources with their closing and due days. Other kinds of Source are left out. */
export const getCardSources = (client: AxiosInstance = apiClient) =>
  readRows(client, "/me/finance", undefined, (b) => (isRecord(b) && Array.isArray(b.sources) ? b.sources.filter((v) => isRecord(v) && v.kind === "credit_card") : null), parseSource);

/** `GET /me/finance/transactions?month=`: the rows whose `countsOn` is in `month`. */
export const getMonthTransactions = (month: string, client: AxiosInstance = apiClient) =>
  readRows(client, "/me/finance/transactions", { month }, (b) => (isRecord(b) ? b.transactions : null), parseTransaction);

/** `PUT /me/finance/sources/{id}/bill-days`: both days, or both null to clear. A 400 carries the API's field codes. */
export async function putBillDays(sourceId: string, closeDay: number | null, dueDay: number | null, client: AxiosInstance = apiClient): Promise<BillDaysResult> {
  try {
    const response = await client.put(`/me/finance/sources/${encodeURIComponent(sourceId)}/bill-days`, { closeDay, dueDay });
    if (response.status === 204) return { kind: "ok" };
    if (response.status === 404) return { kind: "not-found" };
    const fields: unknown = response.status === 400 && isRecord(response.data) ? response.data.fields : null;
    if (isRecord(fields)) {
      const codes = Object.entries(fields).filter((e): e is [string, string] => typeof e[1] === "string");
      if (codes.length > 0) return { kind: "fields", fields: Object.fromEntries(codes) };
    }
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
