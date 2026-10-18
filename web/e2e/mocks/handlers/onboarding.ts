import type { Preference, Weekday } from "../../../src/domains/profile/api/api";
import { empty, json, signedIn, type FakeApi } from "../api";

// Copies of WEEKDAYS and PREFERENCES in src/domains/profile/api/api.ts: a runtime import would pull in config.ts.
// The Exclude checks break `typecheck` when the app gains a value this list does not have (and the reverse).
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const satisfies readonly Weekday[];
const PREFERENCES = ["like", "neutral", "dislike"] as const satisfies readonly Preference[];
export const listsMatchApp: [Exclude<Weekday, (typeof WEEKDAYS)[number]>, Exclude<Preference, (typeof PREFERENCES)[number]>] extends [never, never] ? true : never = true;

// The Baseline limit, as MaxBaseline in backend/internal/profile.
const MAX_BASELINE_POINTS = 20;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isWeekday = (key: string): key is Weekday => (WEEKDAYS as readonly string[]).includes(key);
const isPreference = (value: unknown): value is Preference => typeof value === "string" && (PREFERENCES as readonly string[]).includes(value);

/**
 * What onboarding reads and writes about the User: the Profile (Baseline, Preferences, Restrictions) and the two
 * lists it is built from. Reads answer what `parseProfile` in src/domains/profile/api/api.ts expects. Writes check
 * the body the way the API does, enough that a client bug is a 400 here too.
 *
 * The Category and Demand ids live in `initialState` (mocks/api.ts), copied from CATEGORY_KEYS in the app. They
 * are not imported because profile/logic/labels.ts pulls in the message catalogs.
 */
export function onboardingHandlers(api: FakeApi): void {
  api.on("GET /categories", signedIn((_, state) => json(200, { categories: state.categories })));
  api.on("GET /demands", signedIn((_, state) => json(200, { demands: state.demands })));
  api.on("GET /me/profile", signedIn((_, state) => json(200, state.profile)));

  api.on(
    "PUT /me/baseline",
    signedIn((request, state) => {
      // Typed with the app's own shape: a day sets points, null clears it, a day left out is untouched.
      const body: Partial<Record<Weekday, number | null>> | null = isRecord(request.body) ? request.body : null;
      if (body === null || Object.keys(body).length === 0) return json(400, { error: "invalid baseline" });
      const changes: Partial<Record<Weekday, number | null>> = {};
      for (const [key, points] of Object.entries(body)) {
        if (!isWeekday(key)) return json(400, { error: "unknown weekday" });
        if (points !== null && (typeof points !== "number" || !Number.isInteger(points) || points < 0 || points > MAX_BASELINE_POINTS)) {
          return json(400, { error: "invalid baseline", fields: { [key]: "out_of_range" } });
        }
        changes[key] = points;
      }
      Object.assign(state.profile.baseline, changes);
      return empty();
    }),
  );

  api.on(
    "PUT /me/preferences/{category}",
    signedIn((request, state) => {
      const category = request.params["category"]!;
      if (!state.categories.includes(category)) return json(400, { error: "unknown category" });
      const preference = isRecord(request.body) ? request.body["preference"] : undefined;
      if (!isPreference(preference)) return json(400, { error: "unknown preference" });
      // Neutral is the absence of a Preference.
      if (preference === "neutral") delete state.profile.preferences[category];
      else state.profile.preferences[category] = preference;
      return empty();
    }),
  );

  api.on(
    "PUT /me/restrictions/{demand}",
    signedIn((request, state) => {
      const demand = request.params["demand"]!;
      if (!state.demands.includes(demand)) return json(400, { error: "unknown demand" });
      if (!state.profile.restrictions.includes(demand)) state.profile.restrictions.push(demand);
      return empty();
    }),
  );

  api.on(
    "DELETE /me/restrictions/{demand}",
    signedIn((request, state) => {
      const demand = request.params["demand"]!;
      if (!state.demands.includes(demand)) return json(400, { error: "unknown demand" });
      state.profile.restrictions = state.profile.restrictions.filter((id) => id !== demand);
      return empty();
    }),
  );
}
