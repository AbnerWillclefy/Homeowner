import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { editListItem, getList, type ShoppingList } from "../api";
import { WRITE_DELAY_MS, withQuantity, withoutItem } from "../logic/list";
import { pantryKey } from "./usePantry";

/** Under the Pantry's key, so the refresh a new receipt does also refreshes the list. */
export const listKey = [...pantryKey, "list"] as const;

export type ListNotice = "failed" | "gone";

/**
 * The next shopping list and its edits. A quantity or a removal shows at once; a burst of taps on one stepper sends one
 * write with the final value, and a write the API refuses puts the line back as the server had it.
 */
export function useShoppingList() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: listKey, queryFn: () => getList() });
  const [notice, setNotice] = useState<ListNotice | null>(null);
  // Per item, so a write on one row neither waits for nor frees another's.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  // Quantities waiting out the delay, with the value the server last knew; and the writes in flight. A read while either
  // exists would put the screen's value back over the User's.
  const waiting = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; base: number; value: number }>());
  const inFlight = useRef(0);

  const setBusyId = useCallback((id: string, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; }), []);
  const edit = useCallback((fn: (list: ShoppingList) => ShoppingList) => client.setQueryData<ShoppingList>(listKey, (old) => old && fn(old)), [client]);
  const settled = useCallback(() => {
    if (waiting.current.size === 0 && inFlight.current === 0) void client.invalidateQueries({ queryKey: listKey });
  }, [client]);

  /** Writes one edit; on a refusal `undo` puts the screen back, and a 404 means the item is gone. */
  const write = useCallback(
    async (id: string, body: Parameters<typeof editListItem>[1], undo: () => void) => {
      setBusyId(id, true);
      inFlight.current += 1;
      const result = await editListItem(id, body);
      inFlight.current -= 1;
      setBusyId(id, false);
      if (result.kind !== "ok") {
        undo();
        setNotice(result.kind === "not-found" ? "gone" : "failed");
      }
      settled();
    },
    [setBusyId, settled],
  );

  const setQuantity = useCallback(
    (id: string, quantityMilli: number) => {
      const current = client.getQueryData<ShoppingList>(listKey)?.items.find((i) => i.itemId === id);
      if (!current) return;
      setNotice(null);
      const before = waiting.current.get(id);
      clearTimeout(before?.timer);
      const base = before?.base ?? current.quantityMilli;
      void client.cancelQueries({ queryKey: listKey });
      edit((l) => withQuantity(l, id, quantityMilli));
      const timer = setTimeout(() => {
        waiting.current.delete(id);
        void write(id, { quantityMilli }, () => edit((l) => withQuantity(l, id, base)));
      }, WRITE_DELAY_MS);
      waiting.current.set(id, { timer, base, value: quantityMilli });
    },
    [client, edit, write],
  );

  const remove = useCallback(
    async (id: string) => {
      const before = client.getQueryData<ShoppingList>(listKey);
      if (!before) return;
      setNotice(null);
      clearTimeout(waiting.current.get(id)?.timer);
      waiting.current.delete(id);
      await client.cancelQueries({ queryKey: listKey });
      edit((l) => withoutItem(l, id));
      await write(id, { removed: true }, () => client.setQueryData(listKey, before));
    },
    [client, edit, write],
  );

  // Leaving the screen sends what is still waiting, so a quick edit is not lost.
  useEffect(() => {
    const pending = waiting.current;
    return () => {
      for (const [id, { timer, value }] of pending) {
        clearTimeout(timer);
        void editListItem(id, { quantityMilli: value });
      }
      pending.clear();
    };
  }, []);

  return {
    data: query.data,
    loading: query.isPending,
    failed: query.isError && !query.data,
    reload: () => void query.refetch(),
    notice,
    busy,
    setQuantity,
    remove,
  };
}
