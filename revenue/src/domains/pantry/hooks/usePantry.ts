import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { saoPauloDay } from "../../../shared/month/month";
import { addItem, deleteItem, getPantry, markRanOut, undoRanOut, updateItem, type FieldCodes, type PantryItem, type PantryPatch } from "../api";
import { withRanOut } from "../logic/pantry";

export const pantryKey = ["finance", "pantry"] as const;

export type SaveOutcome = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | { kind: "failed" };
export type Notice = "failed" | "gone";

/** The Pantry and the writes that change it. A run-out (or its undo) shows at once and rolls back when the API refuses it. */
export function usePantry() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: pantryKey, queryFn: () => getPantry() });
  const [notice, setNotice] = useState<Notice | null>(null);
  // Per item, so a second tap on another row neither waits for nor frees the first.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  // Run-out writes in flight: a read while one is pending would put its row back as it was.
  const pending = useRef(0);
  const setBusyId = useCallback((id: string, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; }), []);

  const refresh = useCallback(() => void client.invalidateQueries({ queryKey: pantryKey }), [client]);

  const setRanOut = useCallback(
    async (item: PantryItem, ranOut: boolean): Promise<boolean> => {
      const replace = (row: PantryItem) => client.setQueryData<PantryItem[]>(pantryKey, (old) => old?.map((i) => (i.id === row.id ? row : i)));
      setNotice(null);
      setBusyId(item.id, true);
      pending.current += 1;
      // A read in flight would put the old row back over the mark.
      await client.cancelQueries({ queryKey: pantryKey });
      // Roll back to the row as the list shows it now: an undo's `item` is the row from before the run-out.
      const before = client.getQueryData<PantryItem[]>(pantryKey)?.find((i) => i.id === item.id) ?? item;
      replace(withRanOut(item, ranOut, saoPauloDay(new Date())));
      const result = await (ranOut ? markRanOut : undoRanOut)(item.id);
      pending.current -= 1;
      setBusyId(item.id, false);
      if (result.kind !== "ok") {
        replace(before);
        setNotice(result.kind === "not-found" ? "gone" : "failed");
      }
      // Also covers a read `settle` skipped while this run-out was pending.
      if (pending.current === 0) refresh();
      return result.kind === "ok";
    },
    [client, refresh, setBusyId],
  );

  // A missing item (404) is read again too: it is gone, and the list says so.
  const settle = useCallback(
    (kind: string): SaveOutcome => {
      if (kind !== "ok" && kind !== "not-found") return { kind: "failed" };
      if (pending.current === 0) refresh();
      return { kind: "ok" };
    },
    [refresh],
  );
  const add = useCallback(
    async (name: string): Promise<SaveOutcome> => {
      const result = await addItem(name);
      return result.kind === "fields" ? result : settle(result.kind);
    },
    [settle],
  );
  const update = useCallback(
    async (id: string, patch: PantryPatch): Promise<SaveOutcome> => {
      const result = await updateItem(id, patch);
      return result.kind === "fields" ? result : settle(result.kind);
    },
    [settle],
  );
  const remove = useCallback(
    async (id: string) => {
      setNotice(null);
      setBusyId(id, true);
      const result = await deleteItem(id);
      setBusyId(id, false);
      if (settle(result.kind).kind === "failed") setNotice("failed");
    },
    [settle, setBusyId],
  );

  return {
    data: query.data,
    loading: query.isPending,
    failed: query.isError && !query.data,
    reload: () => void query.refetch(),
    notice,
    busy,
    setRanOut,
    add,
    update,
    remove,
  };
}
