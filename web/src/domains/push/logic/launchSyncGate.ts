/** "A few seconds": past the slow-network first screen, well inside any reminder schedule. */
export const LAUNCH_SYNC_FALLBACK_MS = 5000;

export interface LaunchSyncGate {
  /** The first page load has settled: run now. Later calls do nothing. */
  settled(): void;
  /** Stop waiting. After this neither path runs. */
  dispose(): void;
}

/**
 * Runs `run` at most once: when `settled()` is called, or after `fallbackMs` if it never is, whichever comes first,
 * so the launch re-subscribe waits for the first screen but is never lost. Pure of React for fake-timer tests.
 */
export function launchSyncGate(fallbackMs: number, run: () => void): LaunchSyncGate {
  let done = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(fire, fallbackMs);

  function clear() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function fire() {
    if (done || disposed) return;
    done = true;
    clear();
    run();
  }

  return {
    settled() {
      if (done || disposed) return;
      clear();
      queueMicrotask(fire);
    },
    dispose() {
      disposed = true;
      clear();
    },
  };
}
