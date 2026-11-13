import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getMonth, patchTransaction, type MonthResponse, type Transaction, type TransactionEdit } from "../api";
import { applyEdit } from "../logic/edit";

export const monthKey = (month: string) => ["finance", "transactions", month, "rows"] as const;

type Notice = { month: string; kind: "failed" | "gone" };

/** One month of Transactions, and an edit that shows at once and rolls back when the API refuses it. */
export function useTransactions(month: string) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: monthKey(month), queryFn: () => getMonth(month) });
  const [notice, setNotice] = useState<Notice | null>(null);

  const edit = useCallback(
    async (tx: Transaction, body: TransactionEdit) => {
      const key = monthKey(month);
      const replace = (row: Transaction) =>
        client.setQueryData<MonthResponse>(key, (old) => old && { ...old, transactions: old.transactions.map((r) => (r.id === row.id ? row : r)) });
      setNotice(null);
      // A read in flight would put the old row back over the edit.
      await client.cancelQueries({ queryKey: key });
      replace(applyEdit(tx, body));
      const result = await patchTransaction(tx.id, body);
      if (result.kind === "ok") {
        replace(result.transaction);
        // A category or type change moves totals and the Leftover.
        void client.invalidateQueries({ queryKey: ["finance", "transactions"] });
        void client.invalidateQueries({ queryKey: ["finance", "history"] });
        void client.invalidateQueries({ queryKey: ["finance", "commitments"] });
        return;
      }
      replace(tx);
      setNotice({ month, kind: result.kind === "not-found" ? "gone" : "failed" });
      if (result.kind === "not-found") void client.invalidateQueries({ queryKey: key });
    },
    [client, month],
  );

  return {
    data: query.data,
    loading: query.isPending,
    failed: query.isError && !query.data,
    reload: () => void query.refetch(),
    // A notice about another month is dropped, not shown over this one.
    notice: notice?.month === month ? notice.kind : null,
    edit,
  };
}
