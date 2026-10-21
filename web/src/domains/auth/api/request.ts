import { browserKeeper } from "./browserKeeper";
import { refreshSession, type RefreshResult } from "./cognito";
import { browserSession } from "../logic/browserSession";
import type { SessionStore } from "../logic/session";
import { createTokenKeeper, type TokenKeeper } from "../logic/tokenKeeper";
import { config } from "../../../shared/config";

export type AuthedResult =
  | { kind: "response"; response: Response }
  /** There is no session, or Cognito and the API both turned it down; the person must sign in again. */
  | { kind: "not-signed-in" };

export interface AuthedFetchDeps {
  session: SessionStore;
  refresh(refreshToken: string): Promise<RefreshResult>;
  fetch: typeof fetch;
  now(): number;
  baseUrl: string;
  /** Share one keeper with the Axios client, so the two transports never send two refreshes at once. */
  keeper?: TokenKeeper;
}

/**
 * Calls the API as the signed-in person. Adds the bearer ID token, refreshes it first when it is about to
 * expire, and on a 401 refreshes once and retries once. A network failure of the API call itself throws,
 * like fetch, so callers keep their own error handling. Only a refresh Cognito rejects, or a 401 that
 * survives a fresh token, ends the session; an unreachable Cognito does not (the person may be offline).
 * The refresh rules live in the token keeper.
 */
export function createAuthedFetch(deps: AuthedFetchDeps) {
  const keeper = deps.keeper ?? createTokenKeeper(deps);

  function send(path: string, init: RequestInit | undefined, idToken: string): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${idToken}`);
    return deps.fetch(`${deps.baseUrl}${path}`, { ...init, headers });
  }

  return async function authedFetch(path: string, init?: RequestInit): Promise<AuthedResult> {
    const session = await keeper.usableSession();
    if (session === null) return { kind: "not-signed-in" };

    const response = await send(path, init, session.idToken);
    if (response.status !== 401) return { kind: "response", response };

    const outcome = await keeper.afterUnauthorized(session);
    if (outcome === "rejected") return { kind: "not-signed-in" };
    // Cognito could not be reached: keep the session and let the caller see the 401.
    if (outcome === "unavailable") return { kind: "response", response };

    const renewed = deps.session.load();
    if (renewed === null) return { kind: "not-signed-in" };
    const retry = await send(path, init, renewed.idToken);
    if (retry.status === 401) {
      deps.session.clear();
      return { kind: "not-signed-in" };
    }
    return { kind: "response", response: retry };
  };
}

/** The `error` code of an API error body, or null when the body is not JSON of that shape. */
export async function errorCode(response: Response): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null) return null;
  const code = (body as Record<string, unknown>).error;
  return typeof code === "string" ? code : null;
}

/** The app's own: the stored session, Cognito and the real API. */
export const authedFetch = createAuthedFetch({
  session: browserSession,
  refresh: refreshSession,
  keeper: browserKeeper,
  fetch: (...args) => fetch(...args),
  now: Date.now,
  baseUrl: config.apiBaseUrl,
});
