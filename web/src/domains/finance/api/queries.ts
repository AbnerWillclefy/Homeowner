import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getBills, getCommitments, getFinanceStatus, getMonth, getReport, type Bill, type Commitments, type FinanceStatus, type MonthResponse, type ReportResponse } from "./api";

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

/** `GET /me/finance/report?month=`, under the status key like the month. */
export const reportKey = (month: string) => ["me", "finance", "report", month] as const;

export const reportQuery = (month: string) =>
  queryOptions({
    queryKey: reportKey(month),
    queryFn: async (): Promise<ReportResponse> => {
      const result = await getReport(month);
      if (result.kind === "ok") return result.report;
      throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
    },
    refetchOnMount: refetchUnlessSucceeded,
  });

/** After a PATCH: the totals changed, and the server may have recategorised other rows of the same merchant, so read the month again. */
export const invalidateMonth = (client: QueryClient, month: string) =>
  Promise.all([
    client.invalidateQueries({ queryKey: monthKey(month) }),
    // Any report may hold this month as its "previous", so every report is read again.
    client.invalidateQueries({ queryKey: ["me", "finance", "report"] }),
  ]);

/** `GET /me/finance/bills?month=`, one entry per month, under the status key so a delete removes them too. */
export const billsKey = (month: string) => ["me", "finance", "bills", month] as const;

export const billsQuery = (month: string) =>
  queryOptions({
    queryKey: billsKey(month),
    queryFn: async (): Promise<Bill[]> => {
      const result = await getBills(month);
      if (result.kind === "ok") return result.bills;
      throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
    },
    refetchOnMount: refetchUnlessSucceeded,
  });

/** `GET /me/finance/commitments?from=`, under the status key so a delete removes it and an income or Bill write can invalidate the prefix. */
export const commitmentsKey = (from: string) => ["me", "finance", "commitments", from] as const;

export const commitmentsQuery = (from: string) =>
  queryOptions({
    queryKey: commitmentsKey(from),
    queryFn: async (): Promise<Commitments> => {
      const result = await getCommitments(from);
      if (result.kind === "ok") return result.commitments;
      throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
    },
    refetchOnMount: refetchUnlessSucceeded,
  });

/** After an income write, or a Bill write: every finance read that carries the totals is read again. */
export const invalidateFinance = (client: QueryClient) => client.invalidateQueries({ queryKey: financeStatusKey });

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
