import { useCallback, useContext, useMemo, useRef } from "react";
import type { MessageKey } from "../i18n";
import { useToast } from "../ui/useToast";
import { UndoContext, type Undo, type UndoableWrite } from "./undoContext";

function useUndo(): Undo {
  const value = useContext(UndoContext);
  if (!value) throw new Error("useUndoable must be used inside <UndoProvider>");
  return value;
}

/** A change undone by writing the old value back (settings, Preferences, a Completion's time). */
export interface UndoableChange {
  /** Names the control, so only a repeat on the same control is ignored. */
  key: string;
  titleKey: MessageKey;
  titleParams?: Record<string, string | number>;
  /** Said when either write fails. */
  failedKey: MessageKey;
  /** Shows the new value at once. */
  apply(): void;
  /** Shows the old value again. */
  revert(): void;
  send(): Promise<{ kind: string }>;
  /** Writes the old value back. */
  sendRevert(): Promise<{ kind: string }>;
}

/** The data with every pending write of `scope` applied, in the order they started. */
export function useUndoOverlay<T>(scope: string, data: T): T {
  const { pending } = useUndo();
  // shortcut: `apply` is typed unknown -> unknown because the provider is generic; the scope says which data it is for.
  return pending.filter((write) => write.scope === scope).reduce((acc, write) => write.apply(acc) as T, data);
}

/**
 * The two undoable kinds (ADR 0029). `undoable` shows the write as done and holds the request until its toast
 * closes, another undoable starts, the Resident leaves the tab or hides the page. `undoableChange` sends at
 * once, and Desfazer sends the old value.
 */
export function useUndoable() {
  const { start, another } = useUndo();
  const toast = useToast();
  const inFlight = useRef(new Set<string>());

  const undoableChange = useCallback(
    async (change: UndoableChange) => {
      if (inFlight.current.has(change.key)) return;
      inFlight.current.add(change.key);
      const fail = () => toast.show({ messageKey: change.failedKey, tone: "error" });
      const settle = async (write: () => Promise<{ kind: string }>) => {
        try {
          return (await write()).kind === "ok";
        } catch {
          return false;
        }
      };
      try {
        // It takes the one toast, so a held write is sent first.
        another();
        change.apply();
        if (!(await settle(change.send))) {
          change.revert();
          return fail();
        }
        // A write held while the send was in flight would lose its toast to this one, so it is sent first.
        another();
        toast.show({
          messageKey: change.titleKey,
          params: change.titleParams,
          tone: "success",
          action: {
            labelKey: "undo.action",
            altTextKey: "undo.altText",
            onClick: () => {
              void (async () => {
                if (inFlight.current.has(change.key)) return;
                inFlight.current.add(change.key);
                try {
                  // A failed write back leaves the new value, which is what the server still has.
                  if (await settle(change.sendRevert)) change.revert();
                  else fail();
                } finally {
                  inFlight.current.delete(change.key);
                }
              })();
            },
          },
        });
      } finally {
        inFlight.current.delete(change.key);
      }
    },
    [another, toast],
  );

  return useMemo(() => ({ undoable: (write: UndoableWrite) => start(write), undoableChange }), [start, undoableChange]);
}

/** Sends the held write now; resolves when it has ended. Outside an `UndoProvider` there is nothing to send. */
export function useUndoFlush(): () => Promise<void> | undefined {
  return useContext(UndoContext)?.flush ?? (() => undefined);
}
