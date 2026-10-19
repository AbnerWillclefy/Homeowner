export interface DelayedFlag {
  /** Tell the flag whether the thing it follows is active. */
  set(active: boolean): void;
  /** Stop the pending wait. Call it when the owner goes away. */
  dispose(): void;
}

/**
 * A flag that turns true only once `active` has stayed true for `delayMs`, and turns false at once when `active`
 * goes false. Becoming active again restarts the wait. `onChange` is called only when the flag changes, so a load
 * that finishes in time never calls it. Pure of React so it can be tested with fake timers.
 */
export function delayedFlag(delayMs: number, onChange: (on: boolean) => void): DelayedFlag {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let on = false;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  return {
    set(active) {
      if (active) {
        if (on || timer !== undefined) return;
        timer = setTimeout(() => {
          timer = undefined;
          on = true;
          onChange(true);
        }, delayMs);
        return;
      }
      clear();
      if (on) {
        on = false;
        onChange(false);
      }
    },
    dispose: clear,
  };
}
