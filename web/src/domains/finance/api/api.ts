import type { AxiosRequestConfig } from "axios";
import type { SpendingCategory } from "../logic/spendingCategories";
import { authedRequest, errorCode } from "../../auth/api/client";
import { parseFields, type FieldCodes } from "../../../shared/api/fieldErrors";

export interface FinanceSource {
  id: string;
  name: string;
  /** `checking`, `savings` or `credit_card`; the screen labels the ones it knows and shows others as they come. */
  kind: string;
  currency: string;
}

/** `GET /me/finance`. Never carries the credentials. */
export interface FinanceStatus {
  configured: boolean;
  sources: FinanceSource[];
  /** True while any bank has not finished its first import. */
  importing: boolean;
  /** RFC 3339, or null while any bank has never synced. */
  lastSyncedAt: string | null;
}

export type FinanceFailureKind =
  | "not-signed-in"
  | "offline"
  | "error"
  /** 400: the API refused the shape of the credentials. */
  | "invalid"
  /** 422 `pluggy_credentials_rejected`: Pluggy turned the credentials down. */
  | "rejected"
  /** 422 for an item Pluggy could not log in to, or one with no supported account. */
  | "item-refused"
  /** 409: there are no credentials to use. */
  | "no-credentials"
  /** 502: Pluggy did not answer. */
  | "unavailable"
  /** 404: the Transaction is gone, so the month is read again. */
  | "not-found";

type Failure = { kind: FinanceFailureKind };
export type WriteResult = { kind: "ok" } | Failure;
export type StatusResult = { kind: "ok"; status: FinanceStatus } | Failure;
export type ConnectTokenResult = { kind: "ok"; connectToken: string; includeSandbox: boolean } | Failure;

export type TransactionType = "income" | "expense" | "transfer";

/** One Transaction of `GET /me/finance/transactions`. `amountCents` is signed: negative is money out. */
export interface Transaction {
  id: string;
  /** `YYYY-MM-DD`. */
  postedOn: string;
  description: string;
  sourceName: string;
  amountCents: number;
  currency: string;
  type: TransactionType;
  /** Only an Expense has one. */
  spendingCategory: SpendingCategory | null;
  /** `fallback` means nothing could categorise it yet. */
  categorySetBy: CategorySetBy;
}

export type CategorySetBy = "auto" | "user" | "fallback" | null;

export interface MonthResponse {
  month: string;
  /** What was spent in the month: Expenses only, refunds netted off. */
  spentCents: number;
  categories: { category: SpendingCategory; spentCents: number }[];
  transactions: Transaction[];
}

export type MonthResult = { kind: "ok"; month: MonthResponse } | Failure;

function parseStatus(body: unknown): FinanceStatus | null {
  if (typeof body !== "object" || body === null) return null;
  const { configured, sources, importing, lastSyncedAt } = body as Record<string, unknown>;
  if (typeof configured !== "boolean" || typeof importing !== "boolean" || !Array.isArray(sources)) return null;
  if (lastSyncedAt !== null && typeof lastSyncedAt !== "string") return null;
  const parsed: FinanceSource[] = [];
  for (const source of sources) {
    if (typeof source !== "object" || source === null) return null;
    const { id, name, kind, currency } = source as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || typeof kind !== "string" || typeof currency !== "string") return null;
    parsed.push({ id, name, kind, currency });
  }
  return { configured, sources: parsed, importing, lastSyncedAt };
}

/** The failure for a status that was not the expected one. */
function failureOf(status: number, code: string | null): FinanceFailureKind {
  if (status === 400) return "invalid";
  if (status === 404) return "not-found";
  if (status === 409) return "no-credentials";
  if (status === 422) return code === "pluggy_credentials_rejected" ? "rejected" : "item-refused";
  if (status === 502) return "unavailable";
  return "error";
}

/** Sends one request and hands a success to `read`; every other outcome becomes a failure kind. */
async function call<T>(
  request: AxiosRequestConfig,
  success: number,
  read: (data: unknown) => T | null,
): Promise<({ kind: "ok" } & T) | Failure> {
  try {
    const result = await authedRequest(request);
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status !== success) return { kind: failureOf(response.status, errorCode(response)) };
    const value = read(response.data);
    return value === null ? { kind: "error" } : { kind: "ok", ...value };
  } catch {
    return { kind: "offline" };
  }
}

const nothing = () => ({});
const statusOf = (data: unknown) => {
  const status = parseStatus(data);
  return status && { status };
};

export const getFinanceStatus = (): Promise<StatusResult> => call({ url: "/me/finance" }, 200, statusOf) as Promise<StatusResult>;

/** The values go in the request body and nowhere else: not the URL, not a cache, not a log. */
export const putCredentials = (clientId: string, clientSecret: string): Promise<WriteResult> =>
  call({ url: "/me/finance/credentials", method: "PUT", data: { clientId, clientSecret } }, 204, nothing);

export const deleteCredentials = (): Promise<WriteResult> =>
  call({ url: "/me/finance/credentials", method: "DELETE" }, 204, nothing);

/** `DELETE /me/finance`: all the User's finance data and credentials. The banks stay connected in MeuPluggy. */
export const deleteFinanceData = (): Promise<WriteResult> => call({ url: "/me/finance", method: "DELETE" }, 204, nothing);

export const createConnectToken = (): Promise<ConnectTokenResult> =>
  call(
    { url: "/me/finance/connect-token", method: "POST" },
    200,
    (data) => {
      const { connectToken, includeSandbox } = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
      return typeof connectToken === "string" && connectToken !== "" && typeof includeSandbox === "boolean"
        ? { connectToken, includeSandbox }
        : null;
    },
  ) as Promise<ConnectTokenResult>;

/** Registers the item the widget made. The answer is the new status. */
export const registerItem = (itemId: string): Promise<StatusResult> =>
  call({ url: "/me/finance/items", method: "POST", data: { itemId } }, 200, statusOf) as Promise<StatusResult>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function parseMonth(body: unknown): MonthResponse | null {
  if (!isObject(body) || typeof body.month !== "string" || typeof body.spentCents !== "number") return null;
  if (!Array.isArray(body.transactions) || !Array.isArray(body.categories)) return null;
  const valid = body.transactions.every(
    (t) =>
      isObject(t) &&
      typeof t.id === "string" &&
      typeof t.postedOn === "string" &&
      typeof t.description === "string" &&
      typeof t.sourceName === "string" &&
      typeof t.amountCents === "number" &&
      (t.type === "income" || t.type === "expense" || t.type === "transfer") &&
      (t.spendingCategory === null || typeof t.spendingCategory === "string"),
  );
  if (!valid) return null;
  // A body without it (an older mock or API) reads as null, so the parse never breaks on it.
  const transactions = (body.transactions as Record<string, unknown>[]).map((t) => ({
    ...t,
    categorySetBy: t.categorySetBy === "auto" || t.categorySetBy === "user" || t.categorySetBy === "fallback" ? t.categorySetBy : null,
  }));
  return { ...(body as unknown as MonthResponse), transactions: transactions as unknown as Transaction[] };
}

/** `GET /me/finance/transactions?month=YYYY-MM`. */
export const getMonth = (month: string): Promise<MonthResult> =>
  call({ url: "/me/finance/transactions", params: { month } }, 200, (data) => {
    const parsed = parseMonth(data);
    return parsed && { month: parsed };
  }) as Promise<MonthResult>;

export interface HistoryMonth {
  month: string;
  spentCents: number;
  categories: { category: SpendingCategory; spentCents: number }[];
}

export interface History {
  to: string;
  months: HistoryMonth[];
}

export type HistoryResult = { kind: "ok"; history: History } | Failure;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseHistory(body: unknown): History | null {
  if (!isObject(body) || typeof body.to !== "string" || !Array.isArray(body.months)) return null;
  const valid = body.months.every(
    (m) =>
      isObject(m) &&
      typeof m.month === "string" &&
      MONTH_PATTERN.test(m.month) &&
      typeof m.spentCents === "number" &&
      Array.isArray(m.categories) &&
      m.categories.every((c) => isObject(c) && typeof c.category === "string" && typeof c.spentCents === "number"),
  );
  return valid ? (body as unknown as History) : null;
}

/** `GET /me/finance/history?to=YYYY-MM&months=N`, oldest month first. */
export const getHistory = (to: string, months: number): Promise<HistoryResult> =>
  call({ url: "/me/finance/history", params: { to, months } }, 200, (data) => {
    const parsed = parseHistory(data);
    return parsed && { history: parsed };
  }) as Promise<HistoryResult>;

/** Cumulative spend in cents at the end of each day, as `GET /me/finance/daily` answers. */
export interface Daily {
  month: string;
  days: number;
  current: number[];
  previous: number[];
  average: number[];
  averageMonths: number;
}

export type DailyResult = { kind: "ok"; daily: Daily } | Failure;

const numbers = (value: unknown) => Array.isArray(value) && value.every((n) => typeof n === "number" && Number.isFinite(n));

function parseDaily(body: unknown): Daily | null {
  if (!isObject(body) || typeof body.month !== "string" || !MONTH_PATTERN.test(body.month)) return null;
  if (!Number.isInteger(body.days) || !Number.isInteger(body.averageMonths)) return null;
  return numbers(body.current) && numbers(body.previous) && numbers(body.average) ? (body as unknown as Daily) : null;
}

/** `GET /me/finance/daily?month=YYYY-MM`. */
export const getDaily = (month: string): Promise<DailyResult> =>
  call({ url: "/me/finance/daily", params: { month } }, 200, (data) => {
    const parsed = parseDaily(data);
    return parsed && { daily: parsed };
  }) as Promise<DailyResult>;

export interface CommitmentMonth {
  month: string;
  committedCents: number;
  /** Absent when no Monthly income is set. */
  percentOfIncome?: number;
  installments: { name: string; number: number; total: number; amountCents: number }[];
  bills: { id: string; name: string; expectedCents: number }[];
}

export interface Commitments {
  monthlyIncomeCents: number | null;
  months: CommitmentMonth[];
}

export type CommitmentsResult = { kind: "ok"; commitments: Commitments } | Failure;

const isNum = (v: unknown) => typeof v === "number";

function parseCommitments(body: unknown): Commitments | null {
  if (!isObject(body) || !Array.isArray(body.months)) return null;
  if (body.monthlyIncomeCents !== null && !isNum(body.monthlyIncomeCents)) return null;
  const valid = body.months.every(
    (m) =>
      isObject(m) &&
      typeof m.month === "string" &&
      isNum(m.committedCents) &&
      (m.percentOfIncome === undefined || isNum(m.percentOfIncome)) &&
      Array.isArray(m.installments) &&
      m.installments.every((i) => isObject(i) && typeof i.name === "string" && isNum(i.number) && isNum(i.total) && isNum(i.amountCents)) &&
      Array.isArray(m.bills) &&
      m.bills.every((b) => isObject(b) && typeof b.id === "string" && typeof b.name === "string" && isNum(b.expectedCents)),
  );
  return valid ? (body as unknown as Commitments) : null;
}

/** `GET /me/finance/commitments?from=YYYY-MM`. */
export const getCommitments = (from: string): Promise<CommitmentsResult> =>
  call({ url: "/me/finance/commitments", params: { from } }, 200, (data) => {
    const parsed = parseCommitments(data);
    return parsed && { commitments: parsed };
  }) as Promise<CommitmentsResult>;

/** `PUT /me/finance/income`; null clears it. */
export const putIncome = (monthlyIncomeCents: number | null): Promise<WriteResult> =>
  call({ url: "/me/finance/income", method: "PUT", data: { monthlyIncomeCents } }, 204, nothing);

/** `PATCH /me/finance/transactions/{id}`; an absent field stays as it is. The answer is the row, which the screen does not need. */
export const patchTransaction = (
  id: string,
  edit: { type?: TransactionType; spendingCategory?: SpendingCategory },
): Promise<WriteResult> =>
  call({ url: `/me/finance/transactions/${encodeURIComponent(id)}`, method: "PATCH", data: edit }, 200, nothing);

/** One Bill in one month, as `GET /me/finance/bills` lists it. `paidBy` is null while unpaid. */
export interface Bill {
  id: string;
  name: string;
  expectedCents: number;
  /** 1 to 31; 31 means the last day of a shorter month. */
  dueDay: number;
  /** `YYYY-MM-DD`, the due day in the month asked for. */
  dueDate: string;
  paid: boolean;
  paidBy?: "hand" | "bank" | null;
}

export interface BillInput {
  name: string;
  expectedCents: number;
  dueDay: number;
}

export type BillsResult = { kind: "ok"; bills: Bill[] } | Failure;
/** A 400 carries the codes per field, which the form shows beside each field. */
export type SaveBillResult = WriteResult | { kind: "fields"; fields: FieldCodes };

function parseBills(body: unknown): Bill[] | null {
  if (!Array.isArray(body)) return null;
  const valid = body.every(
    (b) =>
      isObject(b) &&
      typeof b.id === "string" &&
      typeof b.name === "string" &&
      typeof b.expectedCents === "number" &&
      typeof b.dueDay === "number" &&
      typeof b.dueDate === "string" &&
      typeof b.paid === "boolean" &&
      (b.paidBy === undefined || b.paidBy === null || b.paidBy === "hand" || b.paidBy === "bank"),
  );
  return valid ? (body as Bill[]) : null;
}

/** `GET /me/finance/bills?month=YYYY-MM`. */
export const getBills = (month: string): Promise<BillsResult> =>
  call({ url: "/me/finance/bills", params: { month } }, 200, (data) => {
    const bills = parseBills(data);
    return bills && { bills };
  }) as Promise<BillsResult>;

/** `POST /me/finance/bills`, or `PUT /{id}` when `id` is given. */
export async function saveBill(id: string | null, input: BillInput): Promise<SaveBillResult> {
  try {
    const result = await authedRequest({
      url: id ? `/me/finance/bills/${encodeURIComponent(id)}` : "/me/finance/bills",
      method: id ? "PUT" : "POST",
      data: input,
    });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === (id ? 200 : 201)) return { kind: "ok" };
    const fields = response.status === 400 ? parseFields(response) : null;
    return fields ? { kind: "fields", fields } : { kind: failureOf(response.status, errorCode(response)) };
  } catch {
    return { kind: "offline" };
  }
}

export const deleteBill = (id: string): Promise<WriteResult> =>
  call({ url: `/me/finance/bills/${encodeURIComponent(id)}`, method: "DELETE" }, 204, nothing);

/** Marks the Bill paid by hand in `month`, or takes the mark off. */
export const setBillPaid = (id: string, month: string, paid: boolean): Promise<WriteResult> =>
  call({ url: `/me/finance/bills/${encodeURIComponent(id)}/payments/${month}`, method: paid ? "PUT" : "DELETE" }, 204, nothing);
