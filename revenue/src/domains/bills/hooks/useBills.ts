import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  deleteBill, dismissBillSuggestion, getBills, getBillSuggestions, getCardBills, saveBill, setBillPaid,
  type Bill, type BillInput, type BillSuggestion, type FieldCodes,
} from "../api";
import { withPaid } from "../logic/billState";

export const billsKey = (month: string) => ["finance", "bills", month, "rows"] as const;
const suggestionsKey = ["finance", "bills", "suggestions"] as const;

export type SaveOutcome = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | { kind: "failed" };
type Notice = { month: string; kind: "failed" | "gone" };

/** The card bills of the month: listed read-only, so a failed read only hides the list. */
export function useCardBills(month: string) {
  return useQuery({ queryKey: ["finance", "commitments", month, "cards"], queryFn: () => getCardBills(month) }).data ?? [];
}

/** The suggested Bills (none while loading or when the read failed: the card is only an offer) and the dismissal. */
export function useBillSuggestions() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: suggestionsKey, queryFn: () => getBillSuggestions() });
  const dismiss = useCallback(
    async (s: BillSuggestion): Promise<boolean> => {
      const before = client.getQueryData<BillSuggestion[]>(suggestionsKey);
      client.setQueryData<BillSuggestion[]>(suggestionsKey, (old) => old?.filter((x) => x.merchantKey !== s.merchantKey));
      const result = await dismissBillSuggestion(s.merchantKey);
      if (result.kind !== "ok") client.setQueryData(suggestionsKey, before);
      return result.kind === "ok";
    },
    [client],
  );
  return { suggestions: query.data ?? [], dismiss };
}

/** One month of Bills and the writes that change them. A paid mark shows at once and rolls back when the API refuses it. */
export function useBills(month: string) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: billsKey(month), queryFn: () => getBills(month) });
  const [notice, setNotice] = useState<Notice | null>(null);

  // Bills, commitments and transactions all change with a Bill: the Leftover moves.
  const refresh = useCallback(() => {
    for (const key of ["bills", "commitments", "transactions"]) void client.invalidateQueries({ queryKey: ["finance", key] });
  }, [client]);

  const setPaid = useCallback(
    async (bill: Bill, paid: boolean) => {
      const key = billsKey(month);
      const replace = (row: Bill) => client.setQueryData<Bill[]>(key, (old) => old?.map((b) => (b.id === row.id ? row : b)));
      setNotice(null);
      // A read in flight would put the old row back over the mark.
      await client.cancelQueries({ queryKey: key });
      replace(withPaid(bill, paid));
      const result = await setBillPaid(bill.id, month, paid);
      if (result.kind === "ok") return refresh();
      replace(bill);
      setNotice({ month, kind: result.kind === "not-found" ? "gone" : "failed" });
      if (result.kind === "not-found") refresh();
    },
    [client, month, refresh],
  );

  // A missing Bill (404) is read again too: it is gone, and the list says so.
  const settle = useCallback(
    (kind: string): SaveOutcome => {
      if (kind !== "ok" && kind !== "not-found") return { kind: "failed" };
      refresh();
      return { kind: "ok" };
    },
    [refresh],
  );
  const save = useCallback(
    async (id: string | null, input: BillInput): Promise<SaveOutcome> => {
      const result = await saveBill(id, input);
      return result.kind === "fields" ? result : settle(result.kind);
    },
    [settle],
  );
  const remove = useCallback(
    async (id: string) => {
      setNotice(null);
      if (settle((await deleteBill(id)).kind).kind === "failed") setNotice({ month, kind: "failed" });
    },
    [settle, month],
  );

  return {
    data: query.data,
    loading: query.isPending,
    failed: query.isError && !query.data,
    reload: () => void query.refetch(),
    // A notice about another month is dropped, not shown over this one.
    notice: notice?.month === month ? notice.kind : null,
    setPaid,
    save,
    remove,
  };
}
