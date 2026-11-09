import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FieldCodes } from "../../../shared/api/fieldErrors";
import { viewOf } from "../../../shared/query/view";
import { deleteBill, saveBill, setBillPaid, type BillInput } from "../api/api";
import { billsQuery, invalidateFinance } from "../api/queries";

export type BillOutcome = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | { kind: "failed" };

/** One month of Bills and the writes that change them. Every write reads the finance views again. */
export function useBills(month: string) {
  const client = useQueryClient();
  const query = useQuery(billsQuery(month));
  const { state, refreshing } = viewOf(query);
  const { refetch } = query;

  // A missing Bill (404) is read again too: it is gone, and the list says so.
  const settle = useCallback(
    (kind: string): BillOutcome => {
      if (kind === "ok" || kind === "not-found") {
        void invalidateFinance(client); // the commitments carry the Bills too
        return { kind: "ok" };
      }
      return { kind: "failed" };
    },
    [client, month],
  );

  const save = useCallback(
    async (id: string | null, input: BillInput): Promise<BillOutcome> => {
      const result = await saveBill(id, input);
      return result.kind === "fields" ? result : settle(result.kind);
    },
    [settle],
  );
  const remove = useCallback(async (id: string) => settle((await deleteBill(id)).kind), [settle]);
  const setPaid = useCallback(async (id: string, paid: boolean) => settle((await setBillPaid(id, month, paid)).kind), [settle, month]);

  return { state, refreshing, reload: useCallback(async () => void (await refetch()), [refetch]), save, remove, setPaid };
}
