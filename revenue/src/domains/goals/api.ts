import type { AxiosInstance } from "axios";
import { apiClient } from "../../api/client";
import { saveRow, send, writeResult, type SaveResult, type WriteResult } from "../../api/write";

export type { FieldCodes, SaveResult, WriteResult } from "../../api/write";

export interface GoalInput {
  name: string;
  targetCents: number;
  /** `YYYY-MM`, or null for a Goal with no date. */
  targetMonth: string | null;
}

/** A Goal as the savings read gives it, with its progress and this month's share. `monthCents` is null without a Monthly contribution; `expectedMonth` also when the Goal is not reached within 10 years. */
export interface SavingsGoal extends GoalInput {
  id: string;
  savedCents: number;
  monthCents: number | null;
  /** `YYYY-MM`. */
  expectedMonth: string | null;
  /** The server's word for a Goal behind its date; this screen says nothing different about it. */
  late: boolean;
}

/** The Emergency reserve's progress; `monthCents` and `expectedMonth` are null as a Goal's are. */
export interface ReserveProgress {
  targetCents: number | null;
  savedCents: number;
  monthCents: number | null;
  expectedMonth: string | null;
}

/** `GET /me/finance/savings`: the settings (null while unset) and the progress, Goals in the User's order. */
export interface Savings {
  reserveTargetCents: number | null;
  contributionBaseCents: number | null;
  reserveSharePercent: number | null;
  reserve: ReserveProgress;
  goals: SavingsGoal[];
  /** Money no Goal takes. */
  unassignedCents: number;
}

/** 400 on the order means the list changed under the User. */
export type OrderResult = WriteResult | { kind: "changed" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const nullableNum = (v: unknown) => v === null || typeof v === "number";
const nullableStr = (v: unknown) => v === null || typeof v === "string";

/**
 * Reads what this screen uses and ignores the rest. Investments are not read at all, so an Investment with
 * `serves: null` or fields added later (`source`, `edited`, `bankValueCents`, `reportedByBank`) cannot drop the screen.
 */
export function parseSavings(body: unknown): Savings | null {
  if (!isRecord(body) || !Array.isArray(body.goals) || !isRecord(body.reserve) || typeof body.unassignedCents !== "number") return null;
  const { reserve } = body;
  const valid =
    nullableNum(body.reserveTargetCents) &&
    nullableNum(body.contributionBaseCents) &&
    nullableNum(body.reserveSharePercent) &&
    nullableNum(reserve.targetCents) &&
    typeof reserve.savedCents === "number" &&
    nullableNum(reserve.monthCents) &&
    nullableStr(reserve.expectedMonth) &&
    body.goals.every(
      (g) =>
        isRecord(g) &&
        typeof g.id === "string" &&
        typeof g.name === "string" &&
        typeof g.targetCents === "number" &&
        nullableStr(g.targetMonth) &&
        typeof g.savedCents === "number" &&
        nullableNum(g.monthCents) &&
        nullableStr(g.expectedMonth) &&
        typeof g.late === "boolean",
    );
  if (!valid) return null;
  const { reserveTargetCents, contributionBaseCents, reserveSharePercent, unassignedCents } = body as unknown as Savings;
  const r = reserve as unknown as ReserveProgress;
  return {
    reserveTargetCents,
    contributionBaseCents,
    reserveSharePercent,
    reserve: { targetCents: r.targetCents, savedCents: r.savedCents, monthCents: r.monthCents, expectedMonth: r.expectedMonth },
    goals: (body.goals as SavingsGoal[]).map(({ id, name, targetCents, targetMonth, savedCents, monthCents, expectedMonth, late }) => ({ id, name, targetCents, targetMonth, savedCents, monthCents, expectedMonth, late })),
    unassignedCents,
  };
}

/** `GET /me/finance/savings`. Throws on any failure, so a query shows its error state. */
export async function getSavings(client: AxiosInstance = apiClient): Promise<Savings> {
  const response = await client.get("/me/finance/savings");
  if (response.status !== 200) throw new Error(`GET /me/finance/savings answered ${response.status}`);
  const savings = parseSavings(response.data);
  if (!savings) throw new Error("GET /me/finance/savings answered a malformed body");
  return savings;
}

/** `POST /me/finance/goals`, or `PUT /me/finance/goals/{id}` when `id` is given; a 400 with field codes goes back to the form. */
export const saveGoal = (id: string | null, input: GoalInput, client: AxiosInstance = apiClient): Promise<SaveResult> => saveRow(client, "/me/finance/goals", id, input);

export const deleteGoal = async (id: string, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, "DELETE", `/me/finance/goals/${encodeURIComponent(id)}`, 204), 204);

/** `PUT /me/finance/goals/order` with every Goal id. */
export async function putGoalOrder(ids: string[], client: AxiosInstance = apiClient): Promise<OrderResult> {
  const response = await send(client, "PUT", "/me/finance/goals/order", 204, { ids });
  return response?.status === 400 ? { kind: "changed" } : writeResult(response, 204);
}

/** `PUT /me/finance/reserve`; null clears the target. */
export const putReserve = async (targetCents: number | null, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, "PUT", "/me/finance/reserve", 204, { targetCents }), 204);

/** `PUT /me/finance/contribution`; null clears both fields together, as the API wants. */
export const putContribution = async (contribution: { baseCents: number; reserveSharePercent: number } | null, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, "PUT", "/me/finance/contribution", 204, contribution ?? { baseCents: null, reserveSharePercent: null }), 204);
