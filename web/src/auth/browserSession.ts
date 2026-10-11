import { createSessionStore, type StorageLike } from "./session";

/** localStorage, looked up on each use so importing this never touches storage and a blocked one just throws inside. */
const lazyLocalStorage: StorageLike = {
  getItem: (key) => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: (key) => globalThis.localStorage.removeItem(key),
};

/** The one session of this browser. */
export const browserSession = createSessionStore(lazyLocalStorage, Date.now);
