import { lazy, type ComponentType } from "react";
import { createChunkRecovery } from "./logic/chunkReload";

/** The one recovery for the page: `main.tsx` also listens to `vite:preloadError` with it. */
export const chunkRecovery = createChunkRecovery({
  // Read only inside the recovery's try blocks: touching sessionStorage can throw where storage is blocked.
  storage: {
    getItem: (key) => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
    removeItem: (key) => window.sessionStorage.removeItem(key),
  },
  now: () => Date.now(),
  reload: () => window.location.reload(),
});

/**
 * `React.lazy` for a screen's chunk. A chunk that fails to load reloads the page once; a second failure is thrown
 * to the nearest `ChunkErrorBoundary`. Declare it at module level, never inside a component.
 */
// `any` props, as React's own `lazy` has: the component's props are kept by T.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(importer: () => Promise<{ default: T }>) {
  return lazy(() => chunkRecovery.load(importer));
}

/**
 * `lazyWithReload` for a module with a named export instead of a default one:
 * `lazyNamed(() => import("./X"), "X")`. With `lazyWithReload`, the only way to declare a lazy screen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyNamed<K extends string, T extends ComponentType<any>>(importer: () => Promise<Record<K, T>>, name: K) {
  return lazyWithReload(() => importer().then((module) => ({ default: module[name] })));
}
