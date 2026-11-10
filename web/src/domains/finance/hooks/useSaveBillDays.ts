import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { putBillDays, type BillDaysResult } from "../api/api";
import { invalidateFinance } from "../api/queries";

/** Writes one card's days (both null clears) and reads the status again so the row shows them. */
export function useSaveBillDays() {
  const client = useQueryClient();
  return useCallback(
    async (sourceId: string, closeDay: number | null, dueDay: number | null): Promise<BillDaysResult> => {
      const result = await putBillDays(sourceId, closeDay, dueDay);
      if (result.kind === "ok") await invalidateFinance(client);
      return result;
    },
    [client],
  );
}
