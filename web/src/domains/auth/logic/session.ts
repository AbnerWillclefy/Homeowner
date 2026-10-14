export const SESSION_KEY = "homeowner.session";

/** The part of localStorage the session needs, so tests can pass a plain object. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What stays on the device between launches. expiresAt is the ID token's expiry in epoch milliseconds. */
export interface Session {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SessionStore {
  /** The stored session, or null when signed out. Corrupt data is cleared and counts as signed out. */
  load(): Session | null;
  save(session: Session): void;
  clear(): void;
  /** True when the ID token has less than marginMs of life left (or none). */
  expiresWithin(session: Session, marginMs: number): boolean;
  /** Called after every save and clear. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
}

function parse(raw: string): Session | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { idToken, refreshToken, expiresAt } = value as Record<string, unknown>;
  if (typeof idToken !== "string" || idToken === "") return null;
  if (typeof refreshToken !== "string" || refreshToken === "") return null;
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return null;
  return { idToken, refreshToken, expiresAt };
}

/** Storage can throw (private browsing, blocked storage); signing in then lasts only until the page closes. */
function quietly(run: () => void): boolean {
  try {
    run();
    return true;
  } catch {
    // Nothing more to do: the person stays signed out on the next launch.
    return false;
  }
}

export function createSessionStore(storage: StorageLike, now: () => number): SessionStore {
  const listeners = new Set<() => void>();
  // Used only while storage refuses writes, so that launch still works until the page closes.
  let memory: Session | null = null;
  const notify = () => listeners.forEach((listener) => listener());

  return {
    load() {
      let raw: string | null = null;
      try {
        raw = storage.getItem(SESSION_KEY);
      } catch {
        return memory;
      }
      if (raw === null) return memory;
      const session = parse(raw);
      if (session === null) {
        quietly(() => storage.removeItem(SESSION_KEY));
        return null;
      }
      return session;
    },
    save(session) {
      memory = quietly(() => storage.setItem(SESSION_KEY, JSON.stringify(session))) ? null : session;
      notify();
    },
    clear() {
      memory = null;
      quietly(() => storage.removeItem(SESSION_KEY));
      notify();
    },
    expiresWithin(session, marginMs) {
      return session.expiresAt - now() <= marginMs;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** The email in an ID token, for showing offline. Not a check of the token: only the API verifies it. */
export function emailFromIdToken(idToken: string): string | null {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const email = (claims as { email?: unknown } | null)?.email;
    return typeof email === "string" && email !== "" ? email : null;
  } catch {
    return null;
  }
}
