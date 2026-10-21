import axios, { type AxiosAdapter, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { browserKeeper } from "./browserKeeper";
import { refreshSession, type RefreshResult } from "./cognito";
import { browserSession } from "../logic/browserSession";
import type { Session, SessionStore } from "../logic/session";
import { createTokenKeeper, type TokenKeeper } from "../logic/tokenKeeper";
import { config } from "../../../shared/config";
import { fetchAdapter } from "../../../shared/api/fetchAdapter";

declare module "axios" {
  interface AxiosRequestConfig {
    /** The session whose token this request carried, so a 401 refreshes only if it is still current. */
    sessionUsed?: Session;
    /** Set once the request has been re-issued after a refresh. */
    retried?: boolean;
  }
}

export type AuthedResult =
  | { kind: "response"; response: AxiosResponse }
  /** There is no session, or Cognito and the API both turned it down; the person must sign in again. */
  | { kind: "not-signed-in" };

export interface ApiClientDeps {
  session: SessionStore;
  refresh(refreshToken: string): Promise<RefreshResult>;
  now(): number;
  baseUrl: string;
  adapter?: AxiosAdapter;
  /** Share one keeper with other transports so they never send two refreshes at once. */
  keeper?: TokenKeeper;
}

/** Thrown inside the client when the person has no usable session. `authedRequest` turns it into a result. */
export class NotSignedIn extends Error {
  constructor() {
    super("not signed in");
    this.name = "NotSignedIn";
  }
}

const ABSOLUTE_URL = /^([a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * The one Axios instance for the API. It accepts every status (callers read `status`, as with fetch), adds
 * the bearer token, refreshes first when the token is near expiry, and on a 401 refreshes once and retries
 * once. It refuses absolute URLs, so the token only ever goes to `baseUrl`.
 */
export function createApiClient(deps: ApiClientDeps): AxiosInstance {
  const keeper = deps.keeper ?? createTokenKeeper(deps);
  const client = axios.create({
    baseURL: deps.baseUrl,
    validateStatus: () => true,
    allowAbsoluteUrls: false,
    adapter: deps.adapter ?? fetchAdapter,
  });

  client.interceptors.request.use(async (request) => {
    // allowAbsoluteUrls: false alone would glue the two URLs together, so refuse before any token is attached.
    if (request.url && ABSOLUTE_URL.test(request.url)) {
      throw new Error(`The API client refuses the absolute URL ${request.url}`);
    }
    const session = await keeper.usableSession();
    if (session === null) throw new NotSignedIn();
    request.headers.set("Authorization", `Bearer ${session.idToken}`);
    request.sessionUsed = session;
    return request;
  });

  // The fulfilled path: with validateStatus always true a 401 never rejects.
  client.interceptors.response.use(async (response) => {
    const request = response.config;
    if (response.status !== 401 || request.sessionUsed === undefined) return response;

    if (request.retried) {
      deps.session.clear();
      throw new NotSignedIn();
    }
    const outcome = await keeper.afterUnauthorized(request.sessionUsed);
    if (outcome === "rejected") throw new NotSignedIn();
    // Cognito could not be reached: keep the session and let the caller see the 401.
    if (outcome === "unavailable") return response;

    request.retried = true;
    return client.request(request);
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
export const apiClient = createApiClient({
  session: browserSession,
  refresh: refreshSession,
  now: Date.now,
  baseUrl: config.apiBaseUrl,
  keeper: browserKeeper,
});

export const authedRequest = createAuthedRequest(apiClient);
