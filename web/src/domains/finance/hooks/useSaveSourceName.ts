import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { putSourceName, type SourceNameResult } from "../api/api";
import { invalidateFinance } from "../api/queries";

/** Writes one Source's name (null goes back to the bank's) and refreshes every Finances read that shows it. */
export function useSaveSourceName() {
  const client = useQueryClient();
  return useCallback(
    async (sourceId: string, name: string | null): Promise<SourceNameResult> => {
      const result = await putSourceName(sourceId, name);
      if (result.kind === "ok") await invalidateFinance(client);
      return result;
    },
    [client],
  );
}
