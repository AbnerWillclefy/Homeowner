import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { dismissBillSuggestion, getBills, getBillSuggestions, getCommitments, getDaily, getFinanceStatus, getHistory, getMonth, getSavings, type Bill, type BillSuggestion, type Commitments, type Daily, type FinanceStatus, type History, type MonthResponse, type Savings } from "./api";

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

/**
 * After a PATCH: the totals changed, and the server may refile the merchant's other Expenses in every month, so
 * each cached month is read again (last month's same-days markers would go stale otherwise).
 */
export const invalidateMonth = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ["me", "finance", "transactions"] }),
    // A category PATCH moves spend between categories in past months too.
    client.invalidateQueries({ queryKey: ["me", "finance", "history"] }),
    // The pace chart is made of the same spend.
    client.invalidateQueries({ queryKey: ["me", "finance", "daily"] }),
  ]);

/** `GET /me/finance/history?to=&months=`: every parameter is in the key, under the status key so a delete removes it. */
export const historyKey = (to: string, months: number) => ["me", "finance", "history", to, months] as const;

export const historyQuery = (to: string, months: number) =>
  queryOptions({
    queryKey: historyKey(to, months),
    queryFn: async (): Promise<History> => {
      const result = await getHistory(to, months);
      if (result.kind === "ok") return result.history;
      throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
    },
    refetchOnMount: refetchUnlessSucceeded,
  });

/** `GET /me/finance/daily?month=`, one entry per month, under the status key so a delete removes them too. */
export const dailyKey = (month: string) => ["me", "finance", "daily", month] as const;

export const dailyQuery = (month: string) =>
  queryOptions({
    queryKey: dailyKey(month),
    queryFn: async (): Promise<Daily> => {
      const result = await getDaily(month);
      if (result.kind === "ok") return result.daily;
      throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
    },
    refetchOnMount: refetchUnlessSucceeded,
  });

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

/** `GET /me/finance/bill-suggestions`, under the status key so `invalidateFinance` reads it again and a delete removes it. */
export const billSuggestionsKey = ["me", "finance", "bill-suggestions"] as const;

export const billSuggestionsQuery = queryOptions({
  queryKey: billSuggestionsKey,
  queryFn: async (): Promise<BillSuggestion[]> => {
    const result = await getBillSuggestions();
    if (result.kind === "ok") return result.suggestions;
    throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
  },
  refetchOnMount: refetchUnlessSucceeded,
});

/** Hides a suggestion at once and tells the server; if that fails the list comes back as it was. True when it stuck. */
export async function dismissSuggestion(client: QueryClient, merchantKey: string): Promise<boolean> {
  await client.cancelQueries({ queryKey: billSuggestionsKey });
  const before = client.getQueryData<BillSuggestion[]>(billSuggestionsKey);
  client.setQueryData<BillSuggestion[]>(billSuggestionsKey, (list) => list?.filter((s) => s.merchantKey !== merchantKey));
  if ((await dismissBillSuggestion(merchantKey)).kind === "ok") return true;
  // Revert only this merchant from the newest list, so overlapping dismissals don't undo each other.
  client.setQueryData<BillSuggestion[]>(billSuggestionsKey, (list) =>
    before?.filter((s) => s.merchantKey === merchantKey || list?.some((x) => x.merchantKey === s.merchantKey)),
  );
  return false;
}

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

/** `GET /me/finance/savings`, under the status key so a delete removes it; the savings writes read it again on their own. */
export const savingsKey = ["me", "finance", "savings"] as const;

export const savingsQuery = queryOptions({
  queryKey: savingsKey,
  queryFn: async (): Promise<Savings> => {
    const result = await getSavings();
    if (result.kind === "ok") return result.savings;
    throw new ApiFailure(result.kind === "offline" || result.kind === "not-signed-in" ? result.kind : "error");
  },
  refetchOnMount: refetchUnlessSucceeded,
});

/**
 * After an income, Bill, bill-days or Source-name write: every cached finance read is marked stale. Only the ones on
 * show read again now; a screen the User left reads when it opens, because `refetchUnlessSucceeded` lets an
 * invalidated entry refetch on mount. The Save does not wait for reads of screens nobody is looking at.
 */
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
