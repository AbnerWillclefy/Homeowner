import axios, { type AxiosAdapter, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { refreshSession, type AuthResult } from "../auth/cognito";
import { browserSession, type Session, type SessionStore } from "../auth/session";
import { config } from "../config";

/** Refresh a token that has less than this left, so a request does not race the expiry. */
export const REFRESH_MARGIN_MS = 60_000;

/** Thrown when there is no usable session. The session store has been cleared, so the app shows sign-in. */
export class NotSignedIn extends Error {
  constructor() {
    super("not signed in");
    this.name = "NotSignedIn";
  }
}

export interface ApiClientDeps {
  baseUrl: string;
  session: SessionStore;
  refresh(refreshToken: string): Promise<AuthResult>;
  now(): number;
  adapter?: AxiosAdapter | "fetch";
}

/**
 * The one Axios instance (ADR 0013). It accepts every status (callers read `status`), adds the ID token as a
 * bearer header, refreshes shortly before expiry, and on a 401 refreshes and retries once. When Cognito rejects
 * the refresh token, or a fresh token is still refused, it clears the session, which sends the person to sign-in.
 */
export function createApiClient(deps: ApiClientDeps): AxiosInstance {
  const { session } = deps;
  const used = new WeakMap<InternalAxiosRequestConfig, Session>();
  let inflight: Promise<"refreshed" | "rejected" | "unavailable"> | null = null;

  async function doRefresh(stale: Session): Promise<"refreshed" | "rejected" | "unavailable"> {
    const current = session.load();
    if (current === null) return "rejected";
    // Another request already replaced the token this one used.
    if (current.idToken !== stale.idToken) return "refreshed";
    const result = await deps.refresh(current.refreshToken);
    if (result.kind === "ok") {
      session.save({
        idToken: result.tokens.idToken,
        refreshToken: result.tokens.refreshToken ?? current.refreshToken,
        expiresAt: deps.now() + result.tokens.expiresInSeconds * 1000,
      });
      return "refreshed";
    }
    if (result.kind === "not-authorized") {
      session.clear();
      return "rejected";
    }
    // Cognito could not be reached: keep the session, the person may be offline.
    return "unavailable";
  }

  function refreshOnce(stale: Session) {
    inflight ??= doRefresh(stale).finally(() => {
      inflight = null;
    });
    return inflight;
  }

  function create(): AxiosInstance {
    const instance = axios.create({
      baseURL: deps.baseUrl,
      validateStatus: () => true,
      allowAbsoluteUrls: false,
      adapter: deps.adapter ?? "fetch",
    });
    instance.interceptors.request.use(async (request) => {
      let current = session.load();
      if (current === null) throw new NotSignedIn();
      if (current.expiresAt - deps.now() < REFRESH_MARGIN_MS) {
        if ((await refreshOnce(current)) === "rejected") throw new NotSignedIn();
        current = session.load();
        if (current === null) throw new NotSignedIn();
      }
      request.headers.set("Authorization", `Bearer ${current.idToken}`);
      used.set(request, current);
      return request;
    });
    return instance;
  }

  // The retry goes through its own instance, which has no 401 handling, so a request is retried at most once.
  const retrier = create();
  const client = create();
  client.interceptors.response.use(async (response) => {
    const sent = used.get(response.config);
    if (response.status !== 401 || sent === undefined) return response;
    const outcome = await refreshOnce(sent);
    if (outcome === "rejected") throw new NotSignedIn();
    if (outcome === "unavailable") return response;
    const retried = await retrier.request(response.config);
    if (retried.status === 401) {
      session.clear();
      throw new NotSignedIn();
    }
    return retried;
  });
  return client;
}

export const apiClient = createApiClient({
  baseUrl: config.apiUrl,
  session: browserSession,
  refresh: refreshSession,
  now: Date.now,
});
