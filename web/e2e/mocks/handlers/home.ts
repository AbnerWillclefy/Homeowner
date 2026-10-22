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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isNumbers = (value: unknown): value is number[] => Array.isArray(value) && value.every((item) => typeof item === "number");

/** Mirrors `settingsBody.validate` in backend/internal/homes/dto.go. */
function settingsErrors({ timezone, allocationTime }: Record<string, unknown>): Fields {
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

/** `required` for a missing number, `invalid` for a non-integer, `out_of_range` outside lo..hi, like `intInRange` in the API. */
function intCode(value: unknown, lo: number, hi: number): string | null {
  if (value === undefined || value === null) return "required";
  if (!isWhole(value)) return "invalid";
  return value < lo || value > hi ? "out_of_range" : null;
}

/** Mirrors `chores.Validate` in backend/internal/chores/validate.go, keyed by field name. */
export function choreErrors(value: unknown, state: FakeState): Fields {
  const fields: Fields = {};
  // Anything that is not an object fails every required field, like an empty one.
  const chore: Record<string, unknown> = isRecord(value) ? value : {};
  const name = typeof chore["name"] === "string" ? chore["name"].trim() : "";
  if (name === "") fields["name"] = "required";
  else if ([...name].length > MAX_NAME_RUNES) fields["name"] = "too_long";

  const category = chore["category"];
  if (typeof category !== "string" || category === "") fields["category"] = "required";
  else if (!state.categories.includes(category)) fields["category"] = "unknown";

  const importance = chore["importance"];
  if (typeof importance !== "string" || importance === "") fields["importance"] = "required";
  else if (!IMPORTANCES.includes(importance)) fields["importance"] = "unknown";

  const demands = chore["demands"];
  if (!isStrings(demands) || demands.some((demand) => !state.demands.includes(demand))) fields["demands"] = "unknown";

  const effort = intCode(chore["baseEffort"], 1, 5);
  if (effort) fields["baseEffort"] = effort;
  const people = intCode(chore["people"], 1, 2);
  if (people) fields["people"] = people;
  const intervalDays = chore["intervalDays"];
  if (intervalDays !== null && intervalDays !== undefined) {
    const interval = intCode(intervalDays, 1, 365);
    if (interval) fields["intervalDays"] = interval;
  }

  const days = chore["allowedWeekdays"];
  if (!Array.isArray(days) || !days.every(isWhole)) fields["allowedWeekdays"] = "invalid";
  else if (days.some((day) => day < 0 || day > 6)) fields["allowedWeekdays"] = "out_of_range";

  if (typeof chore["buildsUp"] !== "boolean") fields["buildsUp"] = "invalid";
  return fields;
}

/** Narrows a Chore that `choreErrors` found no fault with; the checks are only the shape the handler then reads. */
function isChoreWire(value: unknown): value is ChoreWire {
  return (
    isRecord(value) &&
    typeof value["name"] === "string" &&
    typeof value["category"] === "string" &&
    isStrings(value["demands"]) &&
    typeof value["baseEffort"] === "number" &&
    typeof value["importance"] === "string" &&
    typeof value["people"] === "number" &&
    isNumbers(value["allowedWeekdays"]) &&
    typeof value["buildsUp"] === "boolean"
  );
}

/** The Home settings and Chores of a valid body, or every field that was wrong. */
function parseHome(body: unknown, state: FakeState): { home: HomeSettings; chores: ChoreWire[] } | { fields: Fields } {
  const record: Record<string, unknown> = isRecord(body) ? body : {};
  const fields = settingsErrors(record);
  const { timezone, allocationTime } = record;
  const raw = record["chores"] ?? [];
  if (!Array.isArray(raw)) fields["chores"] = "invalid";
  else if (raw.length > MAX_NEW_HOME_CHORES) fields["chores"] = "too_many";
  else {
    raw.forEach((chore, index) => {
      for (const [field, code] of Object.entries(choreErrors(chore, state))) fields[`chores.${index}.${field}`] = code;
    });
  }
  if (Object.keys(fields).length > 0 || !Array.isArray(raw) || typeof timezone !== "string" || typeof allocationTime !== "string") return { fields };
  const chores = raw.filter(isChoreWire);
  // Unreachable once the errors above are empty; keeps the narrowing honest.
  if (chores.length !== raw.length) return { fields: { chores: "invalid" } };
  return { home: { timezone, allocationTime }, chores };
}

/** `POST /home`: creates the Home and the reviewed Chores together, as one step of onboarding. */
export function homeHandlers(api: FakeApi): void {
  api.on(
    "POST /home",
    signedIn((request, state) => {
      const result = parseHome(request.body, state);
      if ("fields" in result) return invalidHome(result.fields);
      if (state.home !== null) return json(409, { error: "already a resident" });

      const home: Home = { id: "home-1", ...result.home };
      state.home = home;
      state.chores = result.chores.map((chore, index) => ({
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
