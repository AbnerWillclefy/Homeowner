/** The signed-in person's tokens. Kept in this origin's localStorage only, so environments never share a session. */
export interface Session {
  idToken: string;
  refreshToken: string;
  /** When the ID token expires, in epoch milliseconds. */
  expiresAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The admin-prefixed key, so it can never collide with the PWA's keys if both ever ran on one origin. */
export const SESSION_KEY = "admin.session";

export interface SessionStore {
  load(): Session | null;
  save(session: Session): void;
  /** Sign-out and "the server turned the session down" both end here. */
  clear(): void;
  /** For useSyncExternalStore. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.idToken === "string" && typeof v.refreshToken === "string" && typeof v.expiresAt === "number";
}

export function createSessionStore(storage: StorageLike): SessionStore {
  const listeners = new Set<() => void>();
  // The same object until something changes, which useSyncExternalStore needs.
  let cached: Session | null | undefined;

  function read(): Session | null {
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      return isSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function set(next: Session | null) {
    cached = next;
    listeners.forEach((listener) => listener());
  }

  return {
    load() {
      cached ??= read();
      return cached;
    },
    save(session) {
      try {
        storage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
        // Storage blocked: the session lasts until reload.
      }
      set(session);
    },
    clear() {
      try {
        storage.removeItem(SESSION_KEY);
      } catch {
        // Nothing stored that we could remove.
      }
      set(null);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The one session of this browser. localStorage is looked up on use, so importing this never touches storage. */
export const browserSession = createSessionStore({
  getItem: (key) => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: (key) => globalThis.localStorage.removeItem(key),
});
