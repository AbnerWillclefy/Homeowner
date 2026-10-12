import { useMemo, useRef, useState } from "react";
import { guardOnce } from "./guardOnce";

/**
 * Binds `guardOnce` to React: ignores a second trigger while one is in flight (also a repeated Enter in a
 * text field, which a disabled button does not stop). `pending` is for the view; put it on the control as
 * `disabled` and `aria-busy`.
 */
export function useSubmitOnce<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result> | Result) {
  const [pending, setPending] = useState(false);
  const latest = useRef(action);
  latest.current = action;
  const run = useMemo(() => guardOnce((...args: Args) => latest.current(...args), setPending), []);
  return { run, pending };
}
