import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getBills } from "../../bills/api";
import { billsKey } from "../../bills/hooks/useBills";
import { getHistory, getSpending, putBudget, type Spending } from "../api";
import type { SpendingCategory } from "../logic/categories";
import { withLimit } from "../logic/limit";

/** Under `["finance", "transactions"]`, so an edit on the Transactions screen reads this again. */
export const spendingKey = (month: string) => ["finance", "transactions", month, "categories"] as const;
export const HISTORY_MONTHS = 6;

/** One month of Spending Category totals, limits and rows. */
export function useSpending(month: string) {
  const query = useQuery({ queryKey: spendingKey(month), queryFn: () => getSpending(month) });
  return { data: query.data, loading: query.isPending, failed: query.isError && !query.data, reload: () => void query.refetch() };
}

/** The `months` ending at `to`. Its own query, so a failed read hides only the history. */
export function useHistory(to: string, months = HISTORY_MONTHS) {
  const query = useQuery({ queryKey: ["finance", "history", to, months], queryFn: () => getHistory(to, months) });
  return { data: query.data, failed: query.isError && !query.data, reload: () => void query.refetch() };
}

/** The month's Bills, for the card that says where they went. The same query as the Bills screen; a failed read leaves the card out. */
export function useMonthBills(month: string) {
  return useQuery({ queryKey: billsKey(month), queryFn: () => getBills(month) }).data ?? [];
}

/**
 * Sets or removes a Spending limit. The bar changes at once; a failed write puts the previous limit back. A limit
 * holds for every month and changes Planned spending, so the Leftover moves: transactions and commitments are read again.
 */
export function useLimit(month: string) {
  const client = useQueryClient();
  return useCallback(
    async (category: SpendingCategory, cents: number | null): Promise<"saved" | "failed"> => {
      const key = spendingKey(month);
      const before = client.getQueryData<Spending>(key)?.limits[category] ?? null;
      const set = (to: number | null) => client.setQueryData<Spending>(key, (s) => s && { ...s, limits: withLimit(s.limits, category, to) });
      // A read in flight would put the old limit back over the new one.
      await client.cancelQueries({ queryKey: key });
      set(cents);
      const result = await putBudget(category, cents);
      if (result.kind !== "ok") set(before);
      for (const name of ["transactions", "commitments"]) void client.invalidateQueries({ queryKey: ["finance", name] });
      return result.kind === "ok" ? "saved" : "failed";
    },
    [client, month],
  );
}
