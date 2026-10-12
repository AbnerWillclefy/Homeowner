import { useMemo, useState } from "react";
import { guardOnce } from "./guardOnce";
import { useStableHandlers } from "./useStableHandlers";

/**
 * Binds `guardOnce` to React: ignores a second trigger while one is in flight (also a repeated Enter in a
 * text field, which a disabled button does not stop). `pending` is for the view; put it on the control as
 * `disabled` and `aria-busy`.
 */
export function useSubmitOnce<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result> | Result) {
  const [pending, setPending] = useState(false);
  const stable = useStableHandlers({ action });
  const run = useMemo(() => guardOnce(stable.action as (...args: Args) => Promise<Result> | Result, setPending), [stable]);
  return { run, pending };
}
