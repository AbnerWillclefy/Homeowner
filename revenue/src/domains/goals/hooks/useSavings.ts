import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  deleteGoal, deleteInvestment, getSavings, putContribution, putGoalOrder, putInvestmentServes, putReserve, restoreBankValue, saveGoal, saveInvestment,
  type FieldCodes, type GoalInput, type InvestmentInput, type Savings, type Serves,
} from "../api";

export const savingsKey = ["finance", "savings"] as const;

export type SaveOutcome = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | { kind: "failed" };
export type ReorderOutcome = "saved" | "changed" | "failed";

/** The settings, the reserve, the Goals in the User's order, and the writes that change them. */
export function useSavings() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: savingsKey, queryFn: () => getSavings() });

  // The Monthly contribution is inside the Leftover, so the commitments are read again with the savings.
  const refresh = useCallback(() => {
    for (const key of ["savings", "commitments"]) void client.invalidateQueries({ queryKey: ["finance", key] });
  }, [client]);

  // A missing row (404) is read again too: it is gone in another tab, and the list says so.
  const settle = useCallback(
    (kind: string): SaveOutcome => {
      if (kind !== "ok" && kind !== "not-found") return { kind: "failed" };
      refresh();
      return { kind: "ok" };
    },
    [refresh],
  );

  /**
   * The order shows at once; a failed write puts the previous one back. A 400 means the list changed under the
   * User, so it is read again and the caller says so.
   */
  const reorder = useCallback(
    async (ids: string[]): Promise<ReorderOutcome> => {
      // A read in flight would put the old order back over the move.
      await client.cancelQueries({ queryKey: savingsKey });
      const before = client.getQueryData<Savings>(savingsKey)?.goals;
      client.setQueryData<Savings>(savingsKey, (s) => s && { ...s, goals: ids.flatMap((id) => s.goals.filter((g) => g.id === id)) });
      const result = await putGoalOrder(ids);
      if (result.kind === "ok") {
        refresh(); // the expected months follow the order
        return "saved";
      }
      if (result.kind === "changed" || result.kind === "not-found") refresh();
      else if (before) client.setQueryData<Savings>(savingsKey, (s) => s && { ...s, goals: before });
      return result.kind === "error" ? "failed" : "changed";
    },
    [client, refresh],
  );

  return {
    data: query.data,
    loading: query.isPending,
    failed: query.isError && !query.data,
    reload: () => void query.refetch(),
    /** Sets the Emergency reserve target, or clears it with null. */
    saveReserve: useCallback(async (cents: number | null) => settle((await putReserve(cents)).kind), [settle]),
    /** Sets the Monthly contribution, or clears it with null (both fields go as null). */
    saveContribution: useCallback(async (value: { baseCents: number; reserveSharePercent: number } | null) => settle((await putContribution(value)).kind), [settle]),
    saveGoal: useCallback(
      async (id: string | null, input: GoalInput): Promise<SaveOutcome> => {
        const result = await saveGoal(id, input);
        return result.kind === "fields" ? result : settle(result.kind);
      },
      [settle],
    ),
    removeGoal: useCallback(async (id: string) => settle((await deleteGoal(id)).kind), [settle]),
    saveInvestment: useCallback(
      async (id: string | null, input: InvestmentInput): Promise<SaveOutcome> => {
        const result = await saveInvestment(id, input);
        return result.kind === "fields" ? result : settle(result.kind);
      },
      [settle],
    ),
    removeInvestment: useCallback(async (id: string) => settle((await deleteInvestment(id)).kind), [settle]),
    /** The pick of a bank Investment. The reserve and Goals progress come from the read that follows, not from here. */
    pickServes: useCallback(async (id: string, serves: Serves) => settle((await putInvestmentServes(id, serves)).kind), [settle]),
    takeBankValue: useCallback(async (id: string) => settle((await restoreBankValue(id)).kind), [settle]),
    reorder,
  };
}
