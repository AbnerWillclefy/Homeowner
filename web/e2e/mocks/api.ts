import type { Home } from "../../src/home/api";
import type { ONBOARDING_STEPS } from "../../src/onboarding/api";
import type { Fake, FakeReply, FakeRequest } from "./router";

/** The onboarding steps, in order, as the server stores them. Duplicated on purpose: a runtime import would pull in config.ts. */
const STEPS = ["install", "reminders", "baseline", "restrictions", "preferences", "home"] as const;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
/** Breaks `typecheck` when the app's step list changes and this copy does not. */
export const stepsMatchApp: Equal<typeof STEPS, typeof ONBOARDING_STEPS> = true;

export interface FakeState {
  user: { id: string; email: string };
  /** The last step completed, not the step to show. Null when onboarding has not started. */
  onboardingStored: string | null;
  home: Home | null;
}

export function initialState(): FakeState {
  return { user: { id: "user-1", email: "e2e@example.test" }, onboardingStored: null, home: null };
}

export interface ApiRequest extends FakeRequest {
  /** Values of `{param}` segments in the handler key. */
  params: Record<string, string>;
  /** The token after `Bearer `, or null. */
  token: string | null;
}

export type Handler = (request: ApiRequest, state: FakeState) => FakeReply;

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
  authorization: string | null;
}

export const json = (status: number, body: unknown): FakeReply => ({ status, body });
export const empty = (status = 204): FakeReply => ({ status });
/** The `400 { error, fields }` shape the API answers for an invalid form. */
export const fieldErrors = (fields: Record<string, string>): FakeReply => ({
  status: 400,
  body: { error: "invalid", fields },
});

export interface FakeApi extends Fake {
  state: FakeState;
  /** Every request the fake received, in order, /healthz included. */
  requests: RecordedRequest[];
  /** Registers a group of handlers, for example `api.use(onboardingHandlers)`. */
  use(register: (api: FakeApi) => void): void;
  /** Registers or replaces the handler for a "METHOD /path" key. */
  on(key: string, handler: Handler): void;
  /** Replaces one handler for the rest of the test, or for one call with `{ once: true }`. */
  override(key: string, reply: FakeReply | Handler, options?: { once?: boolean }): void;
}

interface Route {
  method: string;
  pattern: RegExp;
  names: string[];
  handlers: Handler[];
}

function compile(key: string): Pick<Route, "method" | "pattern" | "names"> {
  const [method, path] = key.split(" ");
  if (!method || !path) throw new Error(`Handler key must look like "GET /path", got "${key}".`);
  const names: string[] = [];
  const source = path
    .split("/")
    .map((part) => {
      const match = /^\{(\w+)\}$/.exec(part);
      if (!match) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      names.push(match[1]!);
      return "([^/]+)";
    })
    .join("/");
  return { method, pattern: new RegExp(`^${source}$`), names };
}

export function createFakeApi(options: { baseUrl: string; state?: FakeState }): FakeApi {
  const origin = new URL(options.baseUrl).origin;
  const state = options.state ?? initialState();
  const routes = new Map<string, Route>();
  const requests: RecordedRequest[] = [];

  function find(key: string): Route {
    let route = routes.get(key);
    if (!route) {
      route = { ...compile(key), handlers: [] };
      routes.set(key, route);
    }
    return route;
  }

  const api: FakeApi = {
    name: "api",
    state,
    requests,
    matches: (url) => url.origin === origin,
    handle(request) {
      requests.push({ method: request.method, path: request.path, body: request.body, authorization: request.authorization });
      for (const route of routes.values()) {
        if (route.method !== request.method || route.handlers.length === 0) continue;
        const match = route.pattern.exec(request.path);
        if (!match) continue;
        const params = Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(match[i + 1]!)]));
        const token = /^Bearer (.+)$/.exec(request.authorization ?? "")?.[1] ?? null;
        const handler = route.handlers[route.handlers.length - 1]!;
        return handler({ ...request, params, token }, state);
      }
      return null;
    },
    use: (register) => register(api),
    on(key, handler) {
      find(key).handlers = [handler];
    },
    override(key, reply, { once = false } = {}) {
      const route = find(key);
      const handler: Handler = typeof reply === "function" ? reply : () => reply;
      if (!once) {
        route.handlers.push(handler);
        return;
      }
      const wrapped: Handler = (request, current) => {
        route.handlers.splice(route.handlers.indexOf(wrapped), 1);
        return handler(request, current);
      };
      route.handlers.push(wrapped);
    },
  };

  api.use(coreHandlers);
  return api;
}

const unauthorized = () => json(401, { error: "unauthorized" });

/** Mirrors `Next` in backend/internal/onboarding/onboarding.go: the step to show after the stored one. */
function nextStep(stored: string | null): string {
  if (stored === "done") return "done";
  const index = STEPS.findIndex((step) => step === stored);
  if (index < 0) return STEPS[0];
  return STEPS[index + 1] ?? "done";
}

const rank = (step: string | null): number => (step === null ? -1 : step === "done" ? STEPS.length : STEPS.findIndex((s) => s === step));

/** The handlers the app needs on every load: health, who am I, onboarding progress and the Home. */
export function coreHandlers(api: FakeApi): void {
  const signedIn = (handler: Handler): Handler => (request, state) => (request.token === null ? unauthorized() : handler(request, state));

  api.on("GET /healthz", () => json(200, { status: "ok" }));
  api.on("GET /me", signedIn((_, state) => json(200, state.user)));
  api.on("GET /me/onboarding", signedIn((_, state) => json(200, { step: nextStep(state.onboardingStored) })));
  api.on(
    "PUT /me/onboarding",
    signedIn((request, state) => {
      const step = (request.body as { step?: unknown } | null)?.step;
      if (typeof step !== "string" || step === "home" || !STEPS.some((known) => known === step)) {
        return json(400, { error: "unknown step" });
      }
      if (rank(step) > rank(state.onboardingStored)) state.onboardingStored = step;
      return json(200, { step: nextStep(state.onboardingStored) });
    }),
  );
  api.on(
    "GET /home",
    signedIn((_, state) => (state.home === null ? json(404, { error: "no home" }) : json(200, state.home))),
  );
}
