import { apiClient } from "../../../api/client";

export interface Pace {
  /** Cumulative spend at the end of each day, from day 1 to today (the whole month once it is past). */
  spentCents: number[];
  /** The straight line's value on the last day: Monthly income minus Leftover. */
  lineEndCents: number;
}

export interface CommitmentMonth {
  month: string;
  /** Every Installment plan's part due this month, on a card or not; the off-card ones are also summed in `otherInstallmentsCents`. */
  installments: { name: string; number: number; total: number; amountCents: number }[];
  cards: { sourceId: string; name: string; amountCents: number; billDaysKnown: boolean; /** `YYYY-MM-DD`, null or absent when the card's days are not known. */ dueOn?: string | null; closesOn?: string | null }[];
  otherBills: { id: string; name: string; cents: number; paid: boolean }[];
  otherInstallmentsCents: number;
  planned: { category: string; cents: number }[];
  plannedCents: number;
  /** Present only on the current month. */
  spentOffCardCents?: number;
  savingCents?: number;
  totalCents: number;
  /** Absent when no Monthly income is set; negative when the month takes more. */
  leftoverCents?: number;
  /** Present only on the current month with a Monthly income; negative when the Leftover is. */
  dailyAllowanceCents?: number;
  /** Absent with no Monthly income. */
  pace?: Pace;
}

export interface Commitments {
  monthlyIncomeCents: number | null;
  months: CommitmentMonth[];
}

/** One month of `GET /me/finance/history`: the month's result is `incomeCents - spentCents - savedCents`. */
export interface HistoryMonth {
  month: string;
  incomeCents: number;
  spentCents: number;
  savedCents: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const optNum = (v: unknown) => v === undefined || isNum(v);
const list = (v: unknown, line: (x: Record<string, unknown>) => boolean) => Array.isArray(v) && v.every((x) => isObject(x) && line(x));

/** GET `url`; a non-200 answer or a body `parse` refuses throws, so the query shows its block's error. */
async function read<T>(url: string, params: Record<string, string>, parse: (body: unknown) => T | null): Promise<T> {
  const response = await apiClient.get(url, { params });
  if (response.status !== 200) throw new Error(`GET ${url} answered ${response.status}`);
  const parsed = parse(response.data);
  if (parsed === null) throw new Error(`GET ${url} answered a malformed body`);
  return parsed;
}

function parseCommitments(body: unknown): Commitments | null {
  if (!isObject(body) || !Array.isArray(body.months)) return null;
  if (body.monthlyIncomeCents !== null && !isNum(body.monthlyIncomeCents)) return null;
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
      optNum(m.leftoverCents) &&
      optNum(m.dailyAllowanceCents) &&
      (m.pace === undefined || (isObject(m.pace) && isNum(m.pace.lineEndCents) && Array.isArray(m.pace.spentCents) && m.pace.spentCents.every(isNum))),
  );
  return valid ? (body as unknown as Commitments) : null;
}

/** `GET /me/finance/commitments?from=YYYY-MM`: `months[0]` is `from`. */
export const getCommitments = (from: string) => read("/me/finance/commitments", { from }, parseCommitments);

function parseHistory(body: unknown): HistoryMonth[] | null {
  if (!isObject(body) || !Array.isArray(body.months)) return null;
  const valid = body.months.every((m) => isObject(m) && typeof m.month === "string" && isNum(m.incomeCents) && isNum(m.spentCents) && isNum(m.savedCents));
  return valid ? (body.months as HistoryMonth[]).map(({ month, incomeCents, spentCents, savedCents }) => ({ month, incomeCents, spentCents, savedCents })) : null;
}

/** `GET /me/finance/history?to=YYYY-MM&months=N`, oldest month first. */
export const getHistory = (to: string, months: number) => read("/me/finance/history", { to, months: String(months) }, parseHistory);
