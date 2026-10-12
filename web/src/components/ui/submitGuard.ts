export interface SubmitGuard<Args extends unknown[], Result> {
  /** Runs the action unless one is in flight; then it does nothing and resolves to undefined. */
  run(...args: Args): Promise<Result | undefined>;
  isPending(): boolean;
}

/**
 * Wraps an async action so a second trigger while the first is in flight is ignored. The flag is a plain
 * variable, not React state: a second Enter keydown in the same tick has not seen a state update yet.
 * It resets in `finally`, so a failure returns the control to normal; the rejection still reaches the caller.
 */
export function createSubmitGuard<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result> | Result,
  onPendingChange: (pending: boolean) => void = () => {},
): SubmitGuard<Args, Result> {
  let pending = false;
  return {
    isPending: () => pending,
    async run(...args) {
      if (pending) return undefined;
      pending = true;
      onPendingChange(true);
      try {
        return await action(...args);
      } finally {
        pending = false;
        onPendingChange(false);
      }
    },
  };
}
