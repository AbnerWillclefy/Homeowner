import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { viewOf } from "../../../shared/query/view";
import { putIncome } from "../api/api";
import { commitmentsQuery, invalidateFinance } from "../api/queries";

/** The committed months from `from`, and the Monthly income write that changes their leftovers. */
export function useCommitments(from: string) {
  const client = useQueryClient();
  const query = useQuery(commitmentsQuery(from));
  const { state, refreshing } = viewOf(query);
  const { refetch } = query;

  /** Sets the income, or clears it with null. The percentages change, so the finance prefix is read again. */
  const saveIncome = useCallback(
    async (cents: number | null): Promise<boolean> => {
      const result = await putIncome(cents);
      if (result.kind !== "ok") return false;
      await invalidateFinance(client);
      return true;
    },
    [client],
  );

  return { state, refreshing, reload: useCallback(async () => void (await refetch()), [refetch]), saveIncome };
}
