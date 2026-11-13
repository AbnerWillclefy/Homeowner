import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getCardBills, getCardSources, getMonthTransactions, putBillDays, type BillDaysResult } from "../api";

/** The month's card bills, the card Sources (for their days) and the month's Transactions, each read on its own. */
export function useCardBills(month: string) {
  const bills = useQuery({ queryKey: ["finance", "commitments", month, "card-bills"], queryFn: () => getCardBills(month) });
  const sources = useQuery({ queryKey: ["finance", "status", "card-sources"], queryFn: () => getCardSources() });
  const transactions = useQuery({ queryKey: ["finance", "transactions", month, "card-rows"], queryFn: () => getMonthTransactions(month) });
  return {
    bills: bills.data,
    sources: sources.data ?? [],
    transactions: transactions.data ?? [],
    // The bills are the screen; failed sources or rows only hide their part.
    loading: bills.isPending,
    failed: bills.isError && !bills.data,
    rowsFailed: transactions.isError,
    reload: () => void Promise.all([bills.refetch(), sources.refetch(), transactions.refetch()]),
  };
}

/** Writes one card's days (both null clears), then reads status, commitments and transactions again: `countsOn` moves. */
export function useSaveBillDays() {
  const client = useQueryClient();
  return useCallback(
    async (sourceId: string, closeDay: number | null, dueDay: number | null): Promise<BillDaysResult> => {
      const result = await putBillDays(sourceId, closeDay, dueDay);
      if (result.kind === "ok" || result.kind === "not-found") {
        await Promise.all(["status", "commitments", "transactions"].map((key) => client.invalidateQueries({ queryKey: ["finance", key] })));
      }
      return result;
    },
    [client],
  );
}
