import {
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { browserKeeper } from "./browserKeeper";
import type { Session } from "../logic/session";
import type { TokenKeeper } from "../logic/tokenKeeper";
import { config } from "../../../shared/config";
import { createHttpClient } from "../../../shared/api/http";
import { refuseAbsoluteUrl } from "../../../shared/api/absoluteUrl";

export type AuthedResult =
  | { kind: "response"; response: AxiosResponse }
  /** There is no session, or Cognito and the API both turned it down; the person must sign in again. */
  | { kind: "not-signed-in" };

export interface ApiClientDeps {
  /** Shared with other transports so they never send two refreshes at once. */
  keeper: TokenKeeper;
  baseUrl: string;
  adapter?: AxiosAdapter;
}

/** Thrown inside the client when the person has no usable session. `authedRequest` turns it into a result. */
export class NotSignedIn extends Error {
  constructor() {
    super("not signed in");
    this.name = "NotSignedIn";
  }
}

/**
 * The one Axios instance for the API. It accepts every status (callers read `status`, as with fetch), adds
 * the bearer token, refreshes first when the token is near expiry, and on a 401 refreshes once and retries
 * once. It refuses absolute URLs, so the token only ever goes to `baseUrl`.
 */
export function createApiClient(deps: ApiClientDeps): AxiosInstance {
  const { keeper } = deps;
  // The session each request carried, kept here so no auth state shows on callers' request configs.
  const sessionUsed = new WeakMap<InternalAxiosRequestConfig, Session>();

  function instance(): AxiosInstance {
    const created = createHttpClient({ baseURL: deps.baseUrl, ...(deps.adapter && { adapter: deps.adapter }) });
    created.interceptors.request.use(async (request) => {
      // Axios runs request interceptors last-registered first, so this one runs before the guard in
      // createHttpClient. Refuse here too, before a refresh or a token touches a request that would go elsewhere.
      refuseAbsoluteUrl(request.url);
      const session = await keeper.usableSession();
      if (session === null) throw new NotSignedIn();
      request.headers.set("Authorization", `Bearer ${session.idToken}`);
      sessionUsed.set(request, session);
      return request;
    });
    return created;
  }

  // The retry goes through its own instance, which has no 401 handling, so a request is retried at most once.
  const retrier = instance();
  const client = instance();

  // The fulfilled path: with validateStatus always true a 401 never rejects.
  client.interceptors.response.use(async (response) => {
    const used = sessionUsed.get(response.config);
    if (response.status !== 401 || used === undefined) return response;

    const outcome = await keeper.afterUnauthorized(used);
    if (outcome === "rejected") throw new NotSignedIn();
    // Cognito could not be reached: keep the session and let the caller see the 401.
    if (outcome === "unavailable") return response;

    const retried = await retrier.request(response.config);
    if (retried.status === 401) {
      keeper.rejectSession();
      throw new NotSignedIn();
    }
    return retried;
  });

  return client;
}

/** Sends a request through the client. Only "no usable session" becomes a result; every other error throws. */
export function createAuthedRequest(client: AxiosInstance) {
  return async function authedRequest(request: AxiosRequestConfig): Promise<AuthedResult> {
    try {
      return { kind: "response", response: await client.request(request) };
    } catch (error) {
      if (error instanceof NotSignedIn) return { kind: "not-signed-in" };
      throw error;
    }
  };
}

/** The `error` code of an API error body, or null when the body is not JSON of that shape. */
export function errorCode(response: AxiosResponse): string | null {
  const body: unknown = response.data;
  if (typeof body !== "object" || body === null) return null;
  const code = (body as Record<string, unknown>).error;
  return typeof code === "string" ? code : null;
}

/** The app's own: the stored session, Cognito and the real API. */
export const apiClient = createApiClient({ keeper: browserKeeper, baseUrl: config.apiBaseUrl });

export const authedRequest = createAuthedRequest(apiClient);
