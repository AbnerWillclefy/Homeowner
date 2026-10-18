import type { ChoreWire } from "../../../src/domains/chores/api/api";
import type { Home, HomeSettings } from "../../../src/domains/home/api/api";
import { json, signedIn, type FakeApi, type FakeState } from "../api";

// Mirrors maxNewHomeChores in backend/internal/homes/handler.go: more Chores than this is `chores: too_many`.
const MAX_NEW_HOME_CHORES = 100;
const MAX_NAME_RUNES = 100;
const IMPORTANCES = ["essential", "normal", "nice_to_have"];
const ALLOCATION_TIME = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

type Fields = Record<string, string>;

const invalidHome = (fields: Fields) => json(400, { error: "invalid home", fields });

/** Mirrors `settingsBody.validate` in backend/internal/homes/dto.go. */
function settingsErrors({ timezone, allocationTime }: Partial<HomeSettings>): Fields {
  const fields: Fields = {};
  if (typeof timezone !== "string" || timezone === "") fields["timezone"] = "required";
  else if (timezone === "Local" || !isZone(timezone)) fields["timezone"] = "unknown";

  const match = typeof allocationTime === "string" ? ALLOCATION_TIME.exec(allocationTime) : null;
  if (typeof allocationTime !== "string" || allocationTime === "") fields["allocationTime"] = "required";
  else if (match === null) fields["allocationTime"] = "invalid";
  else if (!["00", "15", "30", "45"].includes(match[2]!)) fields["allocationTime"] = "not_quarter_hour";
  return fields;
}

function isZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

/** `required` for a missing number, `invalid` for a non-integer, `out_of_range` outside lo..hi, like `intInRange` in the API. */
function intCode(value: unknown, lo: number, hi: number): string | null {
  if (value === undefined || value === null) return "required";
  if (!isWhole(value)) return "invalid";
  return value < lo || value > hi ? "out_of_range" : null;
}

/** Mirrors `chores.Validate` in backend/internal/chores/validate.go, keyed by field name. */
function choreErrors(chore: Partial<ChoreWire>, state: FakeState): Fields {
  const fields: Fields = {};
  const name = typeof chore.name === "string" ? chore.name.trim() : "";
  if (name === "") fields["name"] = "required";
  else if ([...name].length > MAX_NAME_RUNES) fields["name"] = "too_long";

  if (typeof chore.category !== "string" || chore.category === "") fields["category"] = "required";
  else if (!state.categories.includes(chore.category)) fields["category"] = "unknown";

  if (typeof chore.importance !== "string" || chore.importance === "") fields["importance"] = "required";
  else if (!IMPORTANCES.includes(chore.importance)) fields["importance"] = "unknown";

  if (!Array.isArray(chore.demands) || chore.demands.some((demand) => !state.demands.includes(demand))) fields["demands"] = "unknown";

  const effort = intCode(chore.baseEffort, 1, 5);
  if (effort) fields["baseEffort"] = effort;
  const people = intCode(chore.people, 1, 2);
  if (people) fields["people"] = people;
  if (chore.intervalDays !== null && chore.intervalDays !== undefined) {
    const interval = intCode(chore.intervalDays, 1, 365);
    if (interval) fields["intervalDays"] = interval;
  }

  const days: unknown = chore.allowedWeekdays;
  if (!Array.isArray(days)) fields["allowedWeekdays"] = "invalid";
  else if (days.some((day) => !isWhole(day))) fields["allowedWeekdays"] = "invalid";
  else if (days.some((day: number) => day < 0 || day > 6)) fields["allowedWeekdays"] = "out_of_range";

  if (typeof chore.buildsUp !== "boolean") fields["buildsUp"] = "invalid";
  return fields;
}

/** `POST /home`: creates the Home and the reviewed Chores together, as one step of onboarding. */
export function homeHandlers(api: FakeApi): void {
  api.on(
    "POST /home",
    signedIn((request, state) => {
      const body = (typeof request.body === "object" && request.body !== null ? request.body : {}) as Partial<HomeSettings> & {
        chores?: Partial<ChoreWire>[];
      };
      const fields = settingsErrors(body);
      const chores = body.chores ?? [];
      if (!Array.isArray(chores)) fields["chores"] = "invalid";
      else if (chores.length > MAX_NEW_HOME_CHORES) fields["chores"] = "too_many";
      else {
        chores.forEach((chore, index) => {
          for (const [field, code] of Object.entries(choreErrors(chore ?? {}, state))) fields[`chores.${index}.${field}`] = code;
        });
      }
      if (Object.keys(fields).length > 0) return invalidHome(fields);
      if (state.home !== null) return json(409, { error: "already a resident" });

      const home: Home = { id: "home-1", timezone: body.timezone!, allocationTime: body.allocationTime! };
      state.home = home;
      state.chores = (chores as ChoreWire[]).map((chore, index) => ({
        id: `chore-${index + 1}`,
        name: chore.name.trim(),
        category: chore.category,
        demands: [...new Set(chore.demands)].sort(),
        baseEffort: chore.baseEffort,
        importance: chore.importance,
        people: chore.people,
        intervalDays: typeof chore.intervalDays === "number" ? chore.intervalDays : null,
        allowedWeekdays: [...new Set(chore.allowedWeekdays)].sort((a, b) => a - b),
        buildsUp: chore.buildsUp,
      }));
      // Creating the Home completes the last onboarding step on the server.
      state.onboardingStored = "done";
      return json(201, home);
    }),
  );
}
