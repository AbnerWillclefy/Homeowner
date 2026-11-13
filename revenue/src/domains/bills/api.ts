import type { AxiosInstance, AxiosResponse } from "axios";
import { apiClient } from "../../api/client";

/** One Bill in one month, as `GET /me/finance/bills` lists it. Never a card bill. */
export interface Bill {
  id: string;
  name: string;
  expectedCents: number;
  /** 1 to 31; 31 means the last day of a shorter month. */
  dueDay: number;
  /** `YYYY-MM-DD`, the due day in the month asked for. */
  dueDate: string;
  paid: boolean;
  paidBy: "hand" | "bank" | null;
  /** What was paid, which may differ from `expectedCents`. Null while unpaid. */
  paidCents: number | null;
}

export interface BillInput {
  name: string;
  expectedCents: number;
  dueDay: number;
}

/** A Bill the server proposes from a repeating charge. `merchantKey` names the merchant for a dismissal. */
export interface BillSuggestion {
  merchantKey: string;
  name: string;
  amountCents: number;
  dueDay: number;
}

/** A credit card's bill for the month, from the commitments. The User never enters one. */
export interface CardBill {
  sourceId: string;
  name: string;
  amountCents: number;
  /** False when the card has no closing or due day yet. */
  billDaysKnown: boolean;
}

/** Field name to the API's stable machine code, for example `{ dueDay: "invalid" }`. */
export type FieldCodes = Record<string, string>;

/** 404 is another User's or a missing row. */
export type WriteResult = { kind: "ok" } | { kind: "not-found" } | { kind: "error" };
export type SaveResult = WriteResult | { kind: "fields"; fields: FieldCodes };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isInt = (v: unknown): v is number => Number.isInteger(v);

function parseBill(v: unknown): Bill | null {
  if (!isRecord(v)) return null;
  const { id, name, expectedCents, dueDay, dueDate, paid, paidBy, paidCents } = v;
  if (![id, name, dueDate].every((s) => typeof s === "string") || typeof paid !== "boolean") return null;
  if (!isInt(expectedCents) || !isInt(dueDay)) return null;
  if (paidBy !== undefined && paidBy !== null && paidBy !== "hand" && paidBy !== "bank") return null;
  if (paidCents !== undefined && paidCents !== null && !isInt(paidCents)) return null;
  return { id, name, expectedCents, dueDay, dueDate, paid, paidBy: paidBy ?? null, paidCents: paidCents ?? null } as Bill;
}

function parseSuggestion(v: unknown): BillSuggestion | null {
  if (!isRecord(v)) return null;
  const { merchantKey, name, amountCents, dueDay } = v;
  if (typeof merchantKey !== "string" || merchantKey === "" || typeof name !== "string") return null;
  if (!isInt(amountCents) || (amountCents as number) <= 0 || !isInt(dueDay) || (dueDay as number) < 1 || (dueDay as number) > 31) return null;
  return { merchantKey, name, amountCents, dueDay } as BillSuggestion;
}

function parseCard(v: unknown): CardBill | null {
  if (!isRecord(v)) return null;
  const { sourceId, name, amountCents, billDaysKnown } = v;
  if (typeof sourceId !== "string" || typeof name !== "string" || !isInt(amountCents) || typeof billDaysKnown !== "boolean") return null;
  return { sourceId, name, amountCents, billDaysKnown };
}

/** GET `url` and parse every row of the array `pick` takes from the body. Throws on any failure, so a query shows its error state. */
async function readList<T>(client: AxiosInstance, url: string, params: Record<string, string> | undefined, pick: (body: unknown) => unknown, parse: (v: unknown) => T | null): Promise<T[]> {
  const response = await client.get(url, { params });
  if (response.status !== 200) throw new Error(`GET ${url} answered ${response.status}`);
  const rows = pick(response.data);
  if (!Array.isArray(rows)) throw new Error(`GET ${url} answered a malformed body`);
  const parsed = rows.map(parse);
  if (parsed.some((r) => r === null)) throw new Error(`GET ${url} answered a malformed row`);
  return parsed as T[];
}

/** `GET /me/finance/bills?month=`. */
export const getBills = (month: string, client: AxiosInstance = apiClient) =>
  readList(client, "/me/finance/bills", { month }, (b) => b, parseBill);

/** `GET /me/finance/bill-suggestions`. */
export const getBillSuggestions = (client: AxiosInstance = apiClient) =>
  readList(client, "/me/finance/bill-suggestions", undefined, (b) => b, parseSuggestion);

/** `GET /me/finance/commitments?from=`: the month's card bills, which are listed and never written. */
export const getCardBills = (month: string, client: AxiosInstance = apiClient) =>
  readList(client, "/me/finance/commitments", { from: month }, (b) => {
    const months = isRecord(b) ? b.months : null;
    const first = Array.isArray(months) ? months.find((m) => isRecord(m) && m.month === month) : null;
    return isRecord(first) ? first.cards : null;
  }, parseCard);

/** A 400 body's `{ fields: { name: code } }`, or null when it has none. */
function fieldsOf(response: AxiosResponse): FieldCodes | null {
  const body: unknown = response.data;
  if (!isRecord(body) || !isRecord(body.fields)) return null;
  const entries = Object.entries(body.fields).filter((e): e is [string, string] => typeof e[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

async function send(client: AxiosInstance, method: string, url: string, ok: number, data?: unknown): Promise<AxiosResponse | null> {
  try {
    const response = await client.request({ method, url, data });
    return response.status === ok || response.status === 404 || response.status === 400 ? response : null;
  } catch {
    return null;
  }
}

const writeResult = (response: AxiosResponse | null, ok: number): WriteResult =>
  response?.status === ok ? { kind: "ok" } : response?.status === 404 ? { kind: "not-found" } : { kind: "error" };

/** `POST /me/finance/bills`, or `PUT /me/finance/bills/{id}` when `id` is given; a 400 with field codes goes back to the form. */
export async function saveBill(id: string | null, input: BillInput, client: AxiosInstance = apiClient): Promise<SaveResult> {
  const ok = id ? 200 : 201;
  const response = await send(client, id ? "PUT" : "POST", id ? `/me/finance/bills/${encodeURIComponent(id)}` : "/me/finance/bills", ok, input);
  const fields = response?.status === 400 ? fieldsOf(response) : null;
  return fields ? { kind: "fields", fields } : writeResult(response, ok);
}

/** `DELETE /me/finance/bills/{id}`; its payments go with it. */
export const deleteBill = async (id: string, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, "DELETE", `/me/finance/bills/${encodeURIComponent(id)}`, 204), 204);

/** Marks the Bill paid by hand in `month` (PUT), or takes the mark off (DELETE). */
export const setBillPaid = async (id: string, month: string, paid: boolean, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, paid ? "PUT" : "DELETE", `/me/finance/bills/${encodeURIComponent(id)}/payments/${month}`, 204), 204);

/** `POST /me/finance/bill-suggestions/dismissals`: the server keeps it hidden for good; repeating it is harmless. */
export const dismissBillSuggestion = async (merchantKey: string, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, "POST", "/me/finance/bill-suggestions/dismissals", 204, { merchantKey }), 204);
