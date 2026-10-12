/**
 * Wraps `action` so a call while one is in flight returns `undefined` without running it. The flag is a
 * plain variable, not React state, so a second trigger in the same tick is also ignored. It clears in
 * `finally`, so a failure re-arms the guard; the rejection still reaches the caller.
 */
export function guardOnce<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result> | Result,
  onChange: (inFlight: boolean) => void = () => {},
) {
  let inFlight = false;
  return async (...args: Args): Promise<Result | undefined> => {
    if (inFlight) return undefined;
    inFlight = true;
    onChange(true);
    try {
      return await action(...args);
    } finally {
      inFlight = false;
      onChange(false);
    }
  };
}
