import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FieldCodes } from "../../../shared/api/fieldErrors";
import { updateCached } from "../../../shared/query/cacheUpdate";
import { viewOf } from "../../../shared/query/view";
import {
  deleteGoal,
  deleteInvestment,
  putContribution,
  putGoalOrder,
  putReserve,
  saveGoal,
  saveInvestment,
  type GoalInput,
  type InvestmentInput,
  type Savings,
} from "../api/api";
import { savingsKey, savingsQuery } from "../api/queries";

export type SavingsOutcome = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | { kind: "failed" };

/** The Investments, Goals and the two settings, and the writes that change them. Every write reads the savings again. */
export function useSavings() {
  const client = useQueryClient();
  const query = useQuery(savingsQuery);
  const { state, refreshing } = viewOf(query);
  const { refetch } = query;

  // A missing row (404) is read again too: it is gone in another tab, and the list says so.
  const settle = useCallback(
    (kind: string): SavingsOutcome => {
      if (kind !== "ok" && kind !== "not-found") return { kind: "failed" };
      void client.invalidateQueries({ queryKey: savingsKey });
      return { kind: "ok" };
    },
    [client],
  );
  const save = useCallback(
    async (write: Promise<{ kind: string } | { kind: "fields"; fields: FieldCodes }>): Promise<SavingsOutcome> => {
      const result = await write;
      return result.kind === "fields" && "fields" in result ? result : settle(result.kind);
    },
    [settle],
  );

  /** Sets the Emergency reserve target, or clears it with null. True when it stuck. */
  const saveReserve = useCallback(async (cents: number | null) => (await save(putReserve(cents))).kind === "ok", [save]);
  /** Sets the Monthly contribution, or clears it with null. True when it stuck. */
  const saveContribution = useCallback(
    async (value: { baseCents: number; reserveSharePercent: number } | null) => (await save(putContribution(value))).kind === "ok",
    [save],
  );

  /**
   * The order changes at once; a failed write puts the previous one back. A 400 means the list changed under the
   * User, so it is read again and the caller says so.
   */
  const reorder = useCallback(
    async (ids: string[]): Promise<"saved" | "changed" | "failed"> => {
      const before = client.getQueryData<Savings>(savingsKey)?.goals;
      updateCached<Savings>(client, savingsKey, (s) => ({ ...s, goals: ids.flatMap((id) => s.goals.filter((g) => g.id === id)) }));
      const result = await putGoalOrder(ids);
      if (result.kind === "ok") return "saved";
      if (result.kind === "invalid") void client.invalidateQueries({ queryKey: savingsKey });
      else if (before) updateCached<Savings>(client, savingsKey, (s) => ({ ...s, goals: before }));
      return result.kind === "invalid" ? "changed" : "failed";
    },
    [client],
  );

  return {
    state,
    refreshing,
    reload: useCallback(async () => void (await refetch()), [refetch]),
    saveReserve,
    saveContribution,
    saveInvestment: useCallback((id: string | null, input: InvestmentInput) => save(saveInvestment(id, input)), [save]),
    removeInvestment: useCallback((id: string) => save(deleteInvestment(id)), [save]),
    saveGoal: useCallback((id: string | null, input: GoalInput) => save(saveGoal(id, input)), [save]),
    removeGoal: useCallback((id: string) => save(deleteGoal(id)), [save]),
    reorder,
  };
}
