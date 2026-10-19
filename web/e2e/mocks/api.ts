import type { CheckIn } from "../../src/domains/checkin/api/api";
import type { Chore } from "../../src/domains/chores/api/api";
import type { DayPlan } from "../../src/domains/dayplan/api/api";
import type { Home } from "../../src/domains/home/api/api";
import type { Resident } from "../../src/domains/residents/api/api";
import type { Preference, Weekday } from "../../src/domains/profile/api/api";
import type { ONBOARDING_STEPS } from "../../src/domains/onboarding/api/api";
import type { Fake, FakeReply, FakeRequest } from "./router";

/** The onboarding steps, in order, as the server stores them. Duplicated on purpose: a runtime import would pull in config.ts. */
const STEPS = ["install", "reminders", "baseline", "restrictions", "preferences", "home"] as const;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
/** Breaks `typecheck` when the app's step list changes and this copy does not. */
export const stepsMatchApp: Equal<typeof STEPS, typeof ONBOARDING_STEPS> = true;

export interface FakeState {
  user: { id: string; email: string; displayName?: string; photoUrl?: string };
  /** The last step completed, not the step to show. Null when onboarding has not started. */
  onboardingStored: string | null;
  home: Home | null;
  /** What the signed-in User set about themself. A new User has every weekday unset. */
  profile: {
    baseline: Record<Weekday, number | null>;
    /** Only the non-neutral Preferences, like the API. */
    preferences: Record<string, Preference>;
    restrictions: string[];
  };
  /** The Category and Demand ids the API lists (see the note in handlers/onboarding.ts). */
  categories: string[];
  demands: string[];
  /** The Home's stored Chores, in creation order. */
  chores: Chore[];
  /** Today's Check-in and Day Plan. Absent means nothing yet: the handlers answer an unplanned day. */
  checkIn?: CheckIn;
  dayPlan?: DayPlan;
  /** The Home's Residents as `GET /home/residents` lists them. Absent means only the caller. */
  residents?: FakeResident[];
  /** The current Streak `GET /home/streak` answers. Absent means 0. */
  streak?: number;
}

export function initialState(): FakeState {
  return {
    user: { id: "user-1", email: "e2e@example.test" },
    onboardingStored: null,
    home: null,
    profile: {
      baseline: { sunday: null, monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null },
      preferences: {},
      restrictions: [],
    },
    categories: ["kitchen", "bathroom", "bedroom", "living_room", "laundry", "floors", "trash", "outdoor", "pets", "other"],
    demands: ["heavy_lifting", "bending", "heights", "strong_chemicals"],
    chores: [],
  };
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
  /** When the fake received it (`performance.now()`), to order it against calls to other fakes. */
  at: number;
}

export const json = (status: number, body: unknown): FakeReply => ({ status, body });

/** What the API shows for a User: the display name, else the local part of the email. */
export const shownName = ({ email, displayName }: { email: string; displayName?: string }): string =>
  displayName ?? email.split("@")[0]!;

/** A Resident the fake stores. The fake adds `initials` and `avatarTone` from the name, as the API does. */
export type FakeResident = Pick<Resident, "id" | "you" | "name" | "photoUrl"> & Partial<Pick<Resident, "streak" | "doneToday">>;

/**
 * The avatar fallback the API decides: the first letter of the first and last word of the shown name (words split
 * on spaces, dots, underscores, hyphens and plus signs). The tone is always kitchen (peach); no spec checks colours.
 */
export function avatarFor(name: string): { initials: string; avatarTone: string } {
  const words = name.split(/[\s._+-]+/).filter((word) => word !== "");
  const letter = (word: string) => Array.from(word)[0]!.toUpperCase();
  const initials = words.length === 0 ? "" : words.length === 1 ? letter(words[0]!) : letter(words[0]!) + letter(words[words.length - 1]!);
  return { initials, avatarTone: "kitchen" };
}
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
  /** Registers the handler for a "METHOD /path" key, replacing any earlier one. */
  on(key: string, handler: Handler): void;
  /** Registers a group of handlers, for example `fakeApi.use(onboardingHandlers)`. */
  use(register: (api: FakeApi) => void): void;
  /**
   * Replaces the handler for a key for this test. With `once` the replacement answers a single request and the
   * earlier handler answers the next one (a failure followed by a retry that works).
   */
  override(key: string, reply: FakeReply | Handler, options?: { once?: boolean }): void;
}

interface Route {
  method: string;
  pattern: RegExp;
  names: string[];
  handler: Handler;
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

  const api: FakeApi = {
    name: "api",
    state,
    requests,
    matches: (url) => url.origin === origin,
    handle(request) {
      requests.push({ method: request.method, path: request.path, body: request.body, authorization: request.authorization, at: performance.now() });
      for (const route of routes.values()) {
        if (route.method !== request.method) continue;
        const match = route.pattern.exec(request.path);
        if (!match) continue;
        const params = Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(match[i + 1]!)]));
        const token = /^Bearer (.+)$/.exec(request.authorization ?? "")?.[1] ?? null;
        return route.handler({ ...request, params, token }, state);
      }
      return null;
    },
    on(key, handler) {
      routes.set(key, { ...compile(key), handler });
    },
    use(register) {
      register(api);
    },
    override(key, reply, options = {}) {
      const previous = routes.get(key);
      if (options.once && !previous) throw new Error(`Cannot override "${key}" once: no handler is registered for it.`);
      const replacement: Handler = typeof reply === "function" ? reply : () => reply;
      let used = false;
      api.on(key, (request, state) => {
        if (options.once && used) return previous!.handler(request, state);
        used = true;
        return replacement(request, state);
      });
    },
  };

  coreHandlers(api);
  return api;
}

const unauthorized = () => json(401, { error: "unauthorized" });

/** Wraps a handler so a request without a bearer token is answered 401, like the API's auth middleware. */
export const signedIn =
  (handler: Handler): Handler =>
  (request, state) =>
    request.token === null ? unauthorized() : handler(request, state);

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
  api.on("GET /healthz", () => json(200, { status: "ok" }));
  api.on(
    "GET /me",
    signedIn((_, state) => {
      const { id, email, displayName, photoUrl } = state.user;
      const name = shownName({ email, displayName });
      return json(200, { id, email, displayName: displayName ?? null, name, photoUrl: photoUrl ?? null, ...avatarFor(name) });
    }),
  );
  // Mirrors NormalizeName in backend/internal/users/name.go for the cases a spec needs: trim, a blank name clears,
  // and more than 40 code points is `too_long`. The Residents list shows the new name, like the API.
  api.on(
    "PUT /me/name",
    signedIn((request, state) => {
      const raw = (request.body as { name?: unknown } | null)?.name;
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      if (Array.from(trimmed).length > 40) return json(400, { error: "too_long" });
      if (trimmed === "") delete state.user.displayName;
      else state.user.displayName = trimmed;
      const { id, email, displayName, photoUrl } = state.user;
      const shown = shownName({ email, displayName });
      const mine = state.residents?.find((resident) => resident.you);
      if (mine) mine.name = shown;
      return json(200, { id, email, displayName: displayName ?? null, name: shown, photoUrl: photoUrl ?? null, ...avatarFor(shown) });
    }),
  );
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
