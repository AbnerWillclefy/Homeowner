import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { viewOf } from "../../../shared/query/view";
import { patchTransaction } from "../api/api";
import { invalidateMonth, monthQuery } from "../api/queries";
import type { TransactionEdit } from "../logic/edit";

export type EditOutcome = "saved" | "gone" | "failed";

/** One month of Transactions and the edit that changes them. */
export function useMonth(month: string) {
  const client = useQueryClient();
  const query = useQuery(monthQuery(month));
  const { state, refreshing } = viewOf(query);
  const { refetch } = query;

  /**
   * The totals change with an edit, and a category edit can recategorise other rows of the same merchant, so the
   * month is read again rather than patched in place. A missing row (404) is read again too: it is gone.
   */
  const edit = useCallback(
    async (id: string, body: TransactionEdit): Promise<EditOutcome> => {
      const result = await patchTransaction(id, body);
      if (result.kind === "ok" || result.kind === "not-found") void invalidateMonth(client, month);
      if (result.kind === "ok") return "saved";
      return result.kind === "not-found" ? "gone" : "failed";
    },
    [client, month],
  );

  return { state, refreshing, reload: useCallback(async () => void (await refetch()), [refetch]), edit };
}
