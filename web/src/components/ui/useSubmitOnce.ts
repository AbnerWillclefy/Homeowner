import { useCallback, useRef, useState } from "react";

/**
 * Ignores a second trigger while one is in flight (also a repeated Enter in a text field, which a disabled
 * button does not stop). The ref is the synchronous guard: a second keydown in the same tick has not seen a
 * state update yet. `pending` is for the view; put it on the control as `disabled` and `aria-busy`. It resets
 * in `finally`, so a failure returns the control to normal; the rejection still reaches the caller.
 */
export function useSubmitOnce<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result> | Result) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const latest = useRef(action);
  latest.current = action;
  const run = useCallback(async (...args: Args): Promise<Result | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    try {
      return await latest.current(...args);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);
  return { run, pending };
}
