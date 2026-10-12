import { useMemo, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handlers = Record<string, (...args: any[]) => unknown>;

/**
 * Returns the same object on every render, whose functions always call the latest `handlers` passed in. For
 * building a guarded submitter once (so its in-flight flag survives re-renders) without it closing over stale
 * props or state. To pass a value, pass a getter for it, for example `getValues: () => values`. The keys must
 * not change between renders. This is the one place the latest handlers are written during render.
 */
export function useStableHandlers<T extends Handlers>(handlers: T): T {
  const latest = useRef(handlers);
  latest.current = handlers;
  return useMemo(
    () =>
      Object.fromEntries(
        Object.keys(handlers).map((key) => [key, (...args: unknown[]) => latest.current[key](...args)]),
      ) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}
