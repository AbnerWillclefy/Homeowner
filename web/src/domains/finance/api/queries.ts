import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getFinanceStatus, getMonth, type FinanceStatus, type MonthResponse } from "./api";

/** `GET /me/finance`. Under `["me"]`, so sign-out empties it; the finance views go under it too (web.md, Query keys). */
export const financeStatusKey = ["me", "finance"] as const;

/** Credentials never reach a cache: this holds only the status, which has no secret in it. */
export const financeStatusQuery = queryOptions({
  queryKey: financeStatusKey,
  queryFn: async (): Promise<FinanceStatus> => {
    const result = await getFinanceStatus();
    if (result.kind === "ok") return result.status;
    // The read has no other failure the screen words differently.
    throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
  },
  refetchOnMount: refetchUnlessSucceeded,
});

/** `GET /me/finance/transactions?month=`, one entry per month, under the status key so a delete removes them too. */
export const monthKey = (month: string) => ["me", "finance", "transactions", month] as const;

export const monthQuery = (month: string) =>
  queryOptions({
    queryKey: monthKey(month),
    queryFn: async (): Promise<MonthResponse> => {
      const result = await getMonth(month);
      if (result.kind === "ok") return result.month;
      throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
    },
    refetchOnMount: refetchUnlessSucceeded,
  });

/** After a PATCH: the totals changed, and the server may have recategorised other rows of the same merchant, so read the month again. */
export const invalidateMonth = (client: QueryClient, month: string) => client.invalidateQueries({ queryKey: monthKey(month) });

const EMPTY: FinanceStatus = { configured: false, sources: [], importing: false, lastSyncedAt: null };

/** Puts a newer answer in the cache; a read still in flight is cancelled so its older answer cannot land after. */
export async function writeFinanceStatus(client: QueryClient, status: FinanceStatus): Promise<void> {
  await client.cancelQueries({ queryKey: financeStatusKey, exact: true });
  client.setQueryData(financeStatusKey, status);
}

/** All finance data is gone: drop every finance entry, `["me"]` itself stays (it holds the finance flag), then show the empty status. */
export async function financeDeleted(client: QueryClient): Promise<void> {
  await client.cancelQueries({ queryKey: financeStatusKey });
  client.removeQueries({ queryKey: financeStatusKey });
  client.setQueryData(financeStatusKey, EMPTY);
}
