import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getFinanceStatus, type FinanceStatus } from "./api";

/** `GET /me/finance`. Under `["me"]`, so sign-out empties it; the finance views go under it too (web.md, Query keys). */
export const financeStatusKey = ["me", "finance"] as const;

/** Credentials never reach a cache: this holds only the status, which has no secret in it. */
export const financeStatusQuery = queryOptions({
  queryKey: financeStatusKey,
  queryFn: async (): Promise<FinanceStatus> => toQueryData(await getFinanceStatus()).status,
  refetchOnMount: refetchUnlessSucceeded,
});

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
