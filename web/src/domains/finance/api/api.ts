import type { AxiosRequestConfig } from "axios";
import type { SpendingCategory } from "../logic/spendingCategories";
import { authedRequest, errorCode } from "../../auth/api/client";
import { parseFields, type FieldCodes } from "../../../shared/api/fieldErrors";

export interface FinanceSource {
  id: string;
  /** What to show: the User's own name for the Source when set, else the bank's. */
  name: string;
  /** The bank's own name; equals `name` while no custom name is set. */
  bankName: string;
  /** `checking`, `savings` or `credit_card`; the screen labels the ones it knows and shows others as they come. */
  kind: string;
  currency: string;
  /** A credit card's statement closing and due days (1 to 31), both set or both null; null on every other kind. */
  closeDay: number | null;
  dueDay: number | null;
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

export type TransactionType = "income" | "expense" | "transfer" | "saving";

/** One Transaction of `GET /me/finance/transactions`. `amountCents` is signed: negative is money out. */
export interface Transaction {
  id: string;
  /** `YYYY-MM-DD`. */
  postedOn: string;
  /** `YYYY-MM-DD`, the day it counts as spent: a card charge counts on its bill's due date, anything else on `postedOn`. */
  countsOn: string;
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
  /** The Spending limits, the same for every month. A category with none is absent. */
  limits: Partial<Record<SpendingCategory, number>>;
  /** What the month's bills and card commitments come to. Absent from an older API or cached month. */
  committedCents?: number;
  /** What was spent from the 1st on, card purchases whose bill falls in a later month included. Absent like `committedCents`. */
  spentSinceFirstCents?: number;
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
    const { id, name, bankName, kind, currency, closeDay, dueDay } = source as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || typeof kind !== "string" || typeof currency !== "string") return null;
    if (!(closeDay === null || Number.isInteger(closeDay)) || !(dueDay === null || Number.isInteger(dueDay))) return null;
    // An older API or mock sends no bankName; the shown name stands in so the status still reads.
    parsed.push({ id, name, bankName: typeof bankName === "string" ? bankName : name, kind, currency, closeDay: closeDay as number | null, dueDay: dueDay as number | null });
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
      (t.type === "income" || t.type === "expense" || t.type === "transfer" || t.type === "saving") &&
      (t.spendingCategory === null || typeof t.spendingCategory === "string"),
  );
  if (!valid) return null;
  // A body without `limits` (an older mock or API) reads as none.
  const limits = body.limits ?? {};
  if (!isObject(limits) || !Object.values(limits).every((v) => Number.isInteger(v) && (v as number) > 0)) return null;
  // The two header numbers may be absent (an older API or mock), but a value that is not a number is malformed.
  if ([body.committedCents, body.spentSinceFirstCents].some((n) => n !== undefined && typeof n !== "number")) return null;
  // A body without it (an older mock or API) reads as null, so the parse never breaks on it.
  const transactions = (body.transactions as Record<string, unknown>[]).map((t) => ({
    ...t,
    countsOn: typeof t.countsOn === "string" ? t.countsOn : t.postedOn,
    categorySetBy: t.categorySetBy === "auto" || t.categorySetBy === "user" || t.categorySetBy === "fallback" ? t.categorySetBy : null,
  }));
  return { ...(body as unknown as MonthResponse), limits, transactions: transactions as unknown as Transaction[] };
}

/** `PUT /me/finance/budgets/{category}`; null removes the Spending limit. A limit holds for every month. */
export const putBudget = (category: SpendingCategory, limitCents: number | null): Promise<WriteResult> =>
  call({ url: `/me/finance/budgets/${encodeURIComponent(category)}`, method: "PUT", data: { limitCents } }, 204, nothing);

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
  installments: { name: string; number: number; total: number; amountCents: number }[];
  /** One credit card's bill; `billDaysKnown` is false when the card has no closing or due day. */
  cards: { sourceId: string; name: string; amountCents: number; billDaysKnown: boolean }[];
  /** Bills to pay that are not a card bill, paid or not. */
  otherBills: { id: string; name: string; cents: number; paid: boolean }[];
  /** What plans on a Source that is not a credit card owe. */
  otherInstallmentsCents: number;
  /** The rest of each Spending limit, and their sum. */
  planned: { category: string; cents: number }[];
  plannedCents: number;
  /** Present only on the current month. */
  spentOffCardCents?: number;
  /** The larger of the month's saving Transactions (net of withdrawals) and the Monthly contribution; counted in `totalCents`. */
  savingCents?: number;
  totalCents: number;
  /** Absent when no Monthly income is set; negative when the month takes more. */
  leftoverCents?: number;
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
  const optNum = (v: unknown) => v === undefined || isNum(v);
  const list = (v: unknown, line: (x: Record<string, unknown>) => boolean) => Array.isArray(v) && v.every((x) => isObject(x) && line(x));
  const valid = body.months.every(
    (m) =>
      isObject(m) &&
      typeof m.month === "string" &&
      list(m.installments, (i) => typeof i.name === "string" && isNum(i.number) && isNum(i.total) && isNum(i.amountCents)) &&
      list(m.cards, (c) => typeof c.sourceId === "string" && typeof c.name === "string" && isNum(c.amountCents) && typeof c.billDaysKnown === "boolean") &&
      list(m.otherBills, (b) => typeof b.id === "string" && typeof b.name === "string" && isNum(b.cents) && typeof b.paid === "boolean") &&
      isNum(m.otherInstallmentsCents) &&
      list(m.planned, (p) => typeof p.category === "string" && isNum(p.cents)) &&
      isNum(m.plannedCents) &&
      isNum(m.totalCents) &&
      optNum(m.spentOffCardCents) &&
      optNum(m.savingCents) &&
      optNum(m.leftoverCents),
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
  /** What was paid, which may differ from `expectedCents`. Null while unpaid, or while the API does not send it. */
  paidCents: number | null;
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
      (b.paidBy === undefined || b.paidBy === null || b.paidBy === "hand" || b.paidBy === "bank") &&
      (b.paidCents === undefined || b.paidCents === null || typeof b.paidCents === "number"),
  );
  return valid ? (body as Bill[]).map((b) => ({ ...b, paidCents: b.paidCents ?? null })) : null;
}

/** `GET /me/finance/bills?month=YYYY-MM`. */
export const getBills = (month: string): Promise<BillsResult> =>
  call({ url: "/me/finance/bills", params: { month } }, 200, (data) => {
    const bills = parseBills(data);
    return bills && { bills };
  }) as Promise<BillsResult>;

/** `POST <base>`, or `PUT <base>/{id}` when `id` is given; a 400 with field codes goes back to the form. */
async function saveRow(base: string, id: string | null, input: object): Promise<SaveBillResult> {
  try {
    const result = await authedRequest({
      url: id ? `${base}/${encodeURIComponent(id)}` : base,
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

export const saveBill = (id: string | null, input: BillInput): Promise<SaveBillResult> => saveRow("/me/finance/bills", id, input);

/** The days typed for one card; null clears. The API takes both or neither. */
export type BillDaysResult = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | Failure;

/** `PUT /me/finance/sources/{id}/bill-days`; a 400 with field codes goes back to the form. */
export async function putBillDays(sourceId: string, closeDay: number | null, dueDay: number | null): Promise<BillDaysResult> {
  try {
    const result = await authedRequest({
      url: `/me/finance/sources/${encodeURIComponent(sourceId)}/bill-days`,
      method: "PUT",
      data: { closeDay, dueDay },
    });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === 204) return { kind: "ok" };
    const fields = response.status === 400 ? parseFields(response) : null;
    return fields ? { kind: "fields", fields } : { kind: failureOf(response.status, errorCode(response)) };
  } catch {
    return { kind: "offline" };
  }
}

/** `PUT /me/finance/sources/{id}/name`; null goes back to the bank's name. A 400 carries `fields.name`. */
export type SourceNameResult = BillDaysResult;

export async function putSourceName(sourceId: string, name: string | null): Promise<SourceNameResult> {
  try {
    const result = await authedRequest({
      url: `/me/finance/sources/${encodeURIComponent(sourceId)}/name`,
      method: "PUT",
      data: { name },
    });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === 204) return { kind: "ok" };
    const fields = response.status === 400 ? parseFields(response) : null;
    return fields ? { kind: "fields", fields } : { kind: failureOf(response.status, errorCode(response)) };
  } catch {
    return { kind: "offline" };
  }
}

export const deleteBill =(id: string): Promise<WriteResult> =>
  call({ url: `/me/finance/bills/${encodeURIComponent(id)}`, method: "DELETE" }, 204, nothing);

/** A Bill the server proposes from a repeating charge. `merchantKey` names the merchant for a dismissal. */
export interface BillSuggestion {
  merchantKey: string;
  name: string;
  amountCents: number;
  dueDay: number;
}

export type BillSuggestionsResult = { kind: "ok"; suggestions: BillSuggestion[] } | Failure;

export function parseBillSuggestions(body: unknown): BillSuggestion[] | null {
  if (!Array.isArray(body)) return null;
  const valid = body.every(
    (s) =>
      isObject(s) &&
      typeof s.merchantKey === "string" &&
      s.merchantKey !== "" &&
      typeof s.name === "string" &&
      Number.isInteger(s.amountCents) &&
      (s.amountCents as number) > 0 &&
      Number.isInteger(s.dueDay) &&
      (s.dueDay as number) >= 1 &&
      (s.dueDay as number) <= 31,
  );
  return valid ? (body as BillSuggestion[]).map(({ merchantKey, name, amountCents, dueDay }) => ({ merchantKey, name, amountCents, dueDay })) : null;
}

/** `GET /me/finance/bill-suggestions`. */
export const getBillSuggestions = (): Promise<BillSuggestionsResult> =>
  call({ url: "/me/finance/bill-suggestions" }, 200, (data) => {
    const suggestions = parseBillSuggestions(data);
    return suggestions && { suggestions };
  }) as Promise<BillSuggestionsResult>;

/** `POST /me/finance/bill-suggestions/dismissals`: the server keeps it hidden for good; repeating it is harmless. */
export const dismissBillSuggestion = (merchantKey: string): Promise<WriteResult> =>
  call({ url: "/me/finance/bill-suggestions/dismissals", method: "POST", data: { merchantKey } }, 204, nothing);

/** Marks the Bill paid by hand in `month`, or takes the mark off. */
export const setBillPaid = (id: string, month: string, paid: boolean): Promise<WriteResult> =>
  call({ url: `/me/finance/bills/${encodeURIComponent(id)}/payments/${month}`, method: paid ? "PUT" : "DELETE" }, 204, nothing);

export type Serves = "reserve" | "goals";

export interface Investment {
  id: string;
  name: string;
  valueCents: number;
  serves: Serves;
}
export type InvestmentInput = Omit<Investment, "id">;

export interface Goal {
  id: string;
  name: string;
  targetCents: number;
  /** `YYYY-MM`, or null for a Goal with no date. */
  targetMonth: string | null;
}
export type GoalInput = Omit<Goal, "id">;

/** A Goal as the savings read gives it, with its progress and this month's share. `monthCents` and `expectedMonth` are null without a Monthly contribution; `expectedMonth` also when the Goal is not reached within 10 years. */
export interface SavingsGoal extends Goal {
  savedCents: number;
  monthCents: number | null;
  /** `YYYY-MM`. */
  expectedMonth: string | null;
  /** A Goal with a date that its expected month passes. */
  late: boolean;
}

/** The Emergency reserve's progress; `monthCents` and `expectedMonth` are null as a Goal's are. */
export interface ReserveProgress {
  targetCents: number | null;
  savedCents: number;
  monthCents: number | null;
  expectedMonth: string | null;
}

/** Given when the month's leftover is above the Monthly contribution; `monthsSooner` is null when it cannot be told. */
export interface LeftoverExtra {
  leftoverCents: number;
  extraCents: number;
  monthsSooner: number | null;
}

export interface OverLimit {
  category: string;
  overCents: number;
}

/** `GET /me/finance/savings`: the settings (null while unset) and the lists, Goals in the User's order. */
export interface Savings {
  reserveTargetCents: number | null;
  contributionBaseCents: number | null;
  reserveSharePercent: number | null;
  investments: Investment[];
  reserve: ReserveProgress;
  goals: SavingsGoal[];
  /** Money no Goal takes. */
  unassignedCents: number;
  /** Set when the month's leftover is above the Monthly contribution. */
  leftover?: LeftoverExtra;
  /** Set when it is below: the Spending Categories over their limit, an empty list when none is. */
  overLimit?: OverLimit[];
}
export type SavingsResult = { kind: "ok"; savings: Savings } | Failure;

const nullableNum = (v: unknown) => v === null || typeof v === "number";

/** Reads what this screen uses and ignores the rest, so fields added later do not fail it. */
export function parseSavings(body: unknown): Savings | null {
  if (!isObject(body) || !Array.isArray(body.investments) || !Array.isArray(body.goals) || !isObject(body.reserve) || typeof body.unassignedCents !== "number") return null;
  const { reserve, leftover, overLimit } = body;
  const nullableMonth = (v: unknown) => v === null || typeof v === "string";
  const valid =
    nullableNum(body.reserveTargetCents) &&
    nullableNum(body.contributionBaseCents) &&
    nullableNum(body.reserveSharePercent) &&
    nullableNum(reserve.targetCents) &&
    typeof reserve.savedCents === "number" &&
    nullableNum(reserve.monthCents) &&
    nullableMonth(reserve.expectedMonth) &&
    body.investments.every(
      (i) => isObject(i) && typeof i.id === "string" && typeof i.name === "string" && typeof i.valueCents === "number" && (i.serves === "reserve" || i.serves === "goals"),
    ) &&
    body.goals.every(
      (g) =>
        isObject(g) &&
        typeof g.id === "string" &&
        typeof g.name === "string" &&
        typeof g.targetCents === "number" &&
        nullableMonth(g.targetMonth) &&
        typeof g.savedCents === "number" &&
        nullableNum(g.monthCents) &&
        nullableMonth(g.expectedMonth) &&
        typeof g.late === "boolean",
    ) &&
    (leftover === undefined ||
      (isObject(leftover) && typeof leftover.leftoverCents === "number" && typeof leftover.extraCents === "number" && nullableNum(leftover.monthsSooner))) &&
    (overLimit === undefined || (Array.isArray(overLimit) && overLimit.every((o) => isObject(o) && typeof o.category === "string" && typeof o.overCents === "number")));
  if (!valid) return null;
  const { reserveTargetCents, contributionBaseCents, reserveSharePercent, investments, goals, unassignedCents } = body as unknown as Savings;
  const r = reserve as unknown as ReserveProgress;
  const l = leftover as LeftoverExtra | undefined;
  const o = overLimit as OverLimit[] | undefined;
  return {
    reserveTargetCents,
    contributionBaseCents,
    reserveSharePercent,
    investments: investments.map(({ id, name, valueCents, serves }) => ({ id, name, valueCents, serves })),
    reserve: { targetCents: r.targetCents, savedCents: r.savedCents, monthCents: r.monthCents, expectedMonth: r.expectedMonth },
    goals: goals.map(({ id, name, targetCents, targetMonth, savedCents, monthCents, expectedMonth, late }) => ({ id, name, targetCents, targetMonth, savedCents, monthCents, expectedMonth, late })),
    unassignedCents,
    ...(l && { leftover: { leftoverCents: l.leftoverCents, extraCents: l.extraCents, monthsSooner: l.monthsSooner } }),
    ...(o && { overLimit: o.map(({ category, overCents }) => ({ category, overCents })) }),
  };
}

export const getSavings = (): Promise<SavingsResult> =>
  call({ url: "/me/finance/savings" }, 200, (data) => {
    const savings = parseSavings(data);
    return savings && { savings };
  }) as Promise<SavingsResult>;

/** `PUT /me/finance/reserve`; null clears the target. */
export const putReserve = (targetCents: number | null): Promise<WriteResult> =>
  call({ url: "/me/finance/reserve", method: "PUT", data: { targetCents } }, 204, nothing);

/** `PUT /me/finance/contribution`; null clears both fields together, as the API wants. */
export const putContribution = (contribution: { baseCents: number; reserveSharePercent: number } | null): Promise<WriteResult> =>
  call({ url: "/me/finance/contribution", method: "PUT", data: contribution ?? { baseCents: null, reserveSharePercent: null } }, 204, nothing);

export const saveInvestment = (id: string | null, input: InvestmentInput): Promise<SaveBillResult> => saveRow("/me/finance/investments", id, input);

export const deleteInvestment = (id: string): Promise<WriteResult> =>
  call({ url: `/me/finance/investments/${encodeURIComponent(id)}`, method: "DELETE" }, 204, nothing);

export const saveGoal = (id: string | null, input: GoalInput): Promise<SaveBillResult> => saveRow("/me/finance/goals", id, input);

export const deleteGoal = (id: string): Promise<WriteResult> =>
  call({ url: `/me/finance/goals/${encodeURIComponent(id)}`, method: "DELETE" }, 204, nothing);

/** `PUT /me/finance/goals/order` with every Goal id; a 400 means the list changed under the User. */
export const putGoalOrder = (ids: string[]): Promise<WriteResult> =>
  call({ url: "/me/finance/goals/order", method: "PUT", data: { ids } }, 204, nothing);
