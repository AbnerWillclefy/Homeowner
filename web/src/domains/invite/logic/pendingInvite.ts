// The Invite token a person arrived with, kept until the Invite is accepted or turns out unusable.
//
// The link is https://<app>/#invite=<token>. A fragment is never sent to a server, so the token stays out of
// CloudFront and API logs. It is copied to localStorage (not sessionStorage) because the Cognito confirmation
// email can open a new tab, and the token must survive sign-up, the confirmation code and sign-in. Every
// storage or history failure is silent, like localeStorage.ts: the token then lives only for this session.
export const INVITE_STORAGE_KEY = "homeowner.invite";

const FRAGMENT_PREFIX = "#invite=";
// base64url, which is what the API issues. Anything else cannot be a token, so it is never stored or sent.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type InviteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isToken(value: string | null | undefined): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** The token in a location hash such as "#invite=abc", or null. */
export function inviteTokenFromHash(hash: string): string | null {
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;
  const token = hash.slice(FRAGMENT_PREFIX.length);
  return isToken(token) ? token : null;
}

function browserStorage(): InviteStorage {
  return globalThis.localStorage;
}

/** The stored token, or null when there is none, it is malformed, or storage is unusable. */
export function readPendingInvite(storage?: InviteStorage): string | null {
  try {
    const value = (storage ?? browserStorage()).getItem(INVITE_STORAGE_KEY);
    return isToken(value) ? value : null;
  } catch {
    return null;
  }
}

/** Forget the token. Never throws. */
export function clearPendingInvite(storage?: InviteStorage): void {
  try {
    (storage ?? browserStorage()).removeItem(INVITE_STORAGE_KEY);
  } catch {
    // Nothing to forget, or it cannot be forgotten; the next launch will ask the API again.
  }
}

export interface CaptureDeps {
  hash: string;
  pathname: string;
  search: string;
  storage?: InviteStorage;
  replaceState(data: null, unused: string, url: string): void;
}

function browserDeps(): CaptureDeps {
  const { hash, pathname, search } = globalThis.location;
  return { hash, pathname, search, replaceState: (...args) => globalThis.history.replaceState(...args) };
}

/**
 * Run once at startup. A token in the address is stored and removed from the address bar; otherwise the
 * stored one (from an earlier launch) is returned. Returns null when there is no pending Invite.
 */
export function captureInvite(deps: CaptureDeps = browserDeps()): string | null {
  const fromLink = inviteTokenFromHash(deps.hash);
  if (fromLink === null) return readPendingInvite(deps.storage);
  try {
    (deps.storage ?? browserStorage()).setItem(INVITE_STORAGE_KEY, fromLink);
  } catch {
    // Not persisted; the Invite still works for this session.
  }
  try {
    deps.replaceState(null, "", `${deps.pathname}${deps.search}`);
  } catch {
    // The token stays in the address bar; harmless, it is never sent anywhere.
  }
  return fromLink;
}
