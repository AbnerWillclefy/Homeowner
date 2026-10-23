import type { StorageLike } from "../../domains/auth/logic/session";

/** The sessionStorage key holding when the app last reloaded because a chunk would not load. */
export const CHUNK_RELOAD_KEY = "homeowner.chunk-reload";

/** A failure this soon after a reload is not a stale deploy: reloading again would loop. */
export const CHUNK_RELOAD_WINDOW_MS = 60_000;

/**
 * Whether a chunk that failed to load should be answered with a reload: true for the first failure, and it writes
 * the marker. False while the marker is newer than the window, and false when the storage cannot be used (a
 * reload that cannot be remembered could repeat forever).
 */
export function shouldReload(storage: StorageLike, now: number): boolean {
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last <= CHUNK_RELOAD_WINDOW_MS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

function clearMarker(storage: StorageLike) {
  try {
    storage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Nothing to clear.
  }
}

interface Deps {
  storage: StorageLike;
  now: () => number;
  reload: () => void;
}

/** What Vite's `vite:preloadError` event gives us. */
interface PreloadErrorEvent {
  preventDefault(): void;
}

/**
 * Recovery from a chunk that will not load, for example after a deploy removed it. The first failure reloads the
 * page (to get the new version); a failure after that is thrown, so an error boundary can show it. Several
 * failures at once reload once.
 */
export function createChunkRecovery({ storage, now, reload }: Deps) {
  let reloading = false;

  /** True when a reload has started (now or earlier). */
  function recover(): boolean {
    if (reloading) return true;
    if (!shouldReload(storage, now())) return false;
    reloading = true;
    reload();
    return true;
  }

  return {
    /** Runs the import. A failure either reloads (and then never settles) or is rethrown. */
    async load<T>(importer: () => Promise<T>): Promise<T> {
      try {
        const loaded = await importer();
        // A preload error that was prevented makes Vite resolve the import with nothing: the reload is on its
        // way, and the marker must survive it, or the next load would reload again and loop.
        if (reloading) return new Promise<T>(() => {});
        clearMarker(storage);
        return loaded;
      } catch (error) {
        if (recover()) return new Promise<T>(() => {});
        throw error;
      }
    },
    /** For `vite:preloadError`: reload instead of throwing, the first time. */
    onPreloadError(event: PreloadErrorEvent) {
      if (recover()) event.preventDefault();
    },
  };
}
