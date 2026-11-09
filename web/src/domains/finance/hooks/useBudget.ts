import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateCached } from "../../../shared/query/cacheUpdate";
import { putBudget, type MonthResponse } from "../api/api";
import { monthKey } from "../api/queries";
import { withLimit } from "../logic/limit";
import type { SpendingCategory } from "../logic/spendingCategories";

/**
 * Sets or removes a Spending limit. The bar changes at once; a failed write puts only that category's previous limit
 * back. A limit applies to every month, so every cached month is read again afterwards.
 */
export function useBudget(month: string) {
  const client = useQueryClient();
  return useCallback(
    async (category: SpendingCategory, cents: number | null): Promise<"saved" | "failed"> => {
      const key = monthKey(month);
      const before = client.getQueryData<MonthResponse>(key)?.limits[category] ?? null;
      const set = (to: number | null) => updateCached<MonthResponse>(client, key, (m) => ({ ...m, limits: withLimit(m.limits, category, to) }));
      set(cents);
      const result = await putBudget(category, cents);
      if (result.kind !== "ok") set(before);
      void client.invalidateQueries({ queryKey: ["me", "finance", "transactions"] });
      return result.kind === "ok" ? "saved" : "failed";
    },
    [client, month],
  );
}
