import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useToast } from "../ui/useToast";
import { idle, pendingWrite, type PendingEffect, type PendingEvent, type PendingState, type SendResult } from "./pendingWrite";
import { UndoContext, type HeldWrite, type Undo, type UndoableWrite } from "./undoContext";

/**
 * Holds one undoable write at a time (ADR 0029). Mount once per session, inside the router (a tab change sends
 * the write) and the toast provider (Desfazer is a toast). All the rules live in the pure `pendingWrite`; this
 * runs its effects: sends, error toasts, and the triggers (navigation, page hidden, sign-out).
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { pathname } = useLocation();
  const [state, setState] = useState<PendingState<HeldWrite>>(idle);
  const stateRef = useRef(state);
  const nextId = useRef(1);
  const sends = useRef(new Set<Promise<void>>());
  // Write id -> its Desfazer toast, which goes away once the write is sent for any reason.
  const toastOf = useRef(new Map<number, number>());

  const dispatch = useCallback(
    function dispatch(event: PendingEvent<HeldWrite>) {
      const next = pendingWrite(stateRef.current, event);
      stateRef.current = next.state;
      setState(next.state);
      for (const effect of next.effects) run(effect);
    },
    // `run` only reads `toast`, `toastOf` and `dispatch`, both stable, so it is not a dependency.
    [],
  );

  function run(effect: PendingEffect<HeldWrite>) {
    const { action } = effect;
    if (effect.type === "report") {
      toast.show({ messageKey: effect.result.messageKey, tone: "error" });
      if (effect.result.kind === "conflict") action.refresh?.();
      return;
    }
    const toastId = toastOf.current.get(action.id);
    if (toastId !== undefined) toast.dismiss(toastId);
    toastOf.current.delete(action.id);
    const promise = action
      .send({ keepalive: effect.keepalive })
      .catch((): SendResult => ({ kind: "failed", messageKey: action.failedKey }))
      .then((result) => {
        if (result.kind === "ok") dispatch({ type: "sent", id: action.id });
        else dispatch({ type: "failed", id: action.id, result });
      })
      .finally(() => sends.current.delete(promise));
    sends.current.add(promise);
  }

  const start = useCallback(
    (write: UndoableWrite) => {
      const id = nextId.current++;
      dispatch({ type: "start", action: { ...write, id } });
      const toastId = toast.show({
        messageKey: write.titleKey,
        params: write.titleParams,
        tone: "success",
        // Radix calls the action's onClick and then onOpenChange(false): the close that follows an undo is a no-op.
        action: { labelKey: "undo.action", altTextKey: "undo.altText", onClick: () => dispatch({ type: "undo", id }) },
        onClose: () => dispatch({ type: "close", id }),
      });
      toastOf.current.set(id, toastId);
    },
    [dispatch, toast],
  );

  const flush = useCallback(() => {
    dispatch({ type: "signOut" });
    return sends.current.size > 0 ? Promise.allSettled([...sends.current]).then(() => undefined) : undefined;
  }, [dispatch]);

  const another = useCallback(() => dispatch({ type: "another" }), [dispatch]);

  // A tab is a route; a Sheet on the same route does not change the path.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    dispatch({ type: "navigate" });
  }, [pathname, dispatch]);

  // iOS Safari does not always fire visibilitychange when it unloads a page, so pagehide too.
  useEffect(() => {
    const hide = () => dispatch({ type: "hidden" });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hide();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", hide);
    };
  }, [dispatch]);

  const pending = useMemo(() => (state.held ? [...state.sending, state.held] : state.sending), [state]);
  const value = useMemo<Undo>(() => ({ pending, start, flush, another }), [pending, start, flush, another]);
  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
}
