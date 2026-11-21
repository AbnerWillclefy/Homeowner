import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { FieldCodes } from "../../../api/write";
import { deleteManualCard, getManualCards, saveManualCard, type ManualCard, type ManualCardInput } from "../api";

const KEY = ["finance", "manual-cards"] as const;

export type ManualCardOutcome = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | { kind: "failed" };

/** The manual cards and the writes that change them. */
export function useManualCards() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: getManualCards });

  // The bill moves the commitments, the Leftover and the Pix rule moves the rows; a changed recipient restarts the import, so Sources says "importing".
  const refresh = useCallback(
    (recipientChanged: boolean) => {
      const keys = ["manual-cards", "commitments", "savings", "transactions", ...(recipientChanged ? ["sources"] : [])];
      for (const key of keys) void client.invalidateQueries({ queryKey: ["finance", key] });
    },
    [client],
  );
  const saved = useCallback((id: string) => client.getQueryData<ManualCard[]>(KEY)?.find((c) => c.id === id), [client]);

  return {
    cards: query.data ?? [],
    loading: query.isPending,
    failed: query.isError && !query.data,
    reload: () => void query.refetch(),
    save: useCallback(
      async (id: string | null, input: ManualCardInput): Promise<ManualCardOutcome> => {
        const before = id ? saved(id)?.pixRecipient ?? null : null;
        const result = await saveManualCard(id, input);
        if (result.kind === "fields") return result;
        // A missing card (404) is gone in another tab: read again and close.
        if (result.kind !== "ok" && result.kind !== "not-found") return { kind: "failed" };
        refresh(before !== input.pixRecipient);
        return { kind: "ok" };
      },
      [refresh, saved],
    ),
    remove: useCallback(
      async (id: string): Promise<ManualCardOutcome> => {
        const had = saved(id)?.pixRecipient != null;
        const result = await deleteManualCard(id);
        if (result.kind === "error") return { kind: "failed" };
        refresh(had);
        return { kind: "ok" };
      },
      [refresh, saved],
    ),
  };
}
