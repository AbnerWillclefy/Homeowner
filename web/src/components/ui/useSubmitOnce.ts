import { useMemo, useRef, useState } from "react";
import { createSubmitGuard } from "./submitGuard";

/**
 * Binds the submit guard to React. `run` ignores a second trigger while one is in flight (also a repeated
 * Enter in a text field, which a disabled button does not stop). Put `pending` on the control as `disabled`
 * and `aria-busy`.
 */
export function useSubmitOnce<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result> | Result) {
  const [pending, setPending] = useState(false);
  const latest = useRef(action);
  latest.current = action;
  const run = useMemo(() => createSubmitGuard((...args: Args) => latest.current(...args), setPending).run, []);
  return { run, pending };
}
