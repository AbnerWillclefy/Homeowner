import { authedFetch } from "./request";

/** The wire keys of the Baseline, in the API's order (0 = Sunday). The screen reorders them to start on Monday. */
export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PREFERENCES = ["like", "neutral", "dislike"] as const;
export type Preference = (typeof PREFERENCES)[number];

/** Points per weekday; null means the day is unset. */
export type Baseline = Record<Weekday, number | null>;

export interface Profile {
  baseline: Baseline;
  /** Only the non-neutral Preferences; a Category that is absent is neutral. */
  preferences: Record<string, Preference>;
  /** Demand ids. */
  restrictions: string[];
}

/** Ids come from the API, so a Category or Demand added there needs no change here. */
export type IdsResult =
  | { kind: "ok"; ids: string[] }
  | { kind: "not-signed-in" }
  /** The API could not be reached. */
  | { kind: "offline" }
  | { kind: "error" };

export type ProfileResult =
  | { kind: "ok"; profile: Profile }
  | { kind: "not-signed-in" }
  | { kind: "offline" }
  | { kind: "error" };

export type WriteResult = { kind: "ok" } | { kind: "not-signed-in" } | { kind: "offline" } | { kind: "error" };

const JSON_HEADERS = { "Content-Type": "application/json" };

function isPreference(value: unknown): value is Preference {
  return typeof value === "string" && (PREFERENCES as readonly string[]).includes(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

async function getIds(path: string, field: "categories" | "demands"): Promise<IdsResult> {
  try {
    const result = await authedFetch(path);
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const body = (await result.response.json()) as Record<string, unknown> | null;
    const ids = body?.[field];
    return isStringList(ids) ? { kind: "ok", ids } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

export const getCategories = (): Promise<IdsResult> => getIds("/categories", "categories");
export const getDemands = (): Promise<IdsResult> => getIds("/demands", "demands");

function parseProfile(body: unknown): Profile | null {
  if (typeof body !== "object" || body === null) return null;
  const { baseline, preferences, restrictions } = body as Record<string, unknown>;
  if (typeof baseline !== "object" || baseline === null) return null;
  if (typeof preferences !== "object" || preferences === null) return null;
  if (!isStringList(restrictions)) return null;

  const days = {} as Baseline;
  for (const day of WEEKDAYS) {
    const points = (baseline as Record<string, unknown>)[day];
    if (points === undefined || points === null) days[day] = null;
    else if (typeof points === "number" && Number.isInteger(points)) days[day] = points;
    else return null;
  }

  const prefs: Record<string, Preference> = {};
  for (const [category, value] of Object.entries(preferences)) {
    if (!isPreference(value)) return null;
    prefs[category] = value;
  }
  return { baseline: days, preferences: prefs, restrictions };
}

export async function getProfile(): Promise<ProfileResult> {
  try {
    const result = await authedFetch("/me/profile");
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const profile = parseProfile(await result.response.json());
    return profile ? { kind: "ok", profile } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

async function write(path: string, init: RequestInit): Promise<WriteResult> {
  try {
    const result = await authedFetch(path, init);
    if (result.kind === "not-signed-in") return result;
    return result.response.status === 204 ? { kind: "ok" } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

/** Sets (a number) or clears (null) only the days named; the others are untouched. */
export function putBaseline(days: Partial<Record<Weekday, number | null>>): Promise<WriteResult> {
  return write("/me/baseline", { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(days) });
}

/** Neutral clears the Preference on the API. */
export function putPreference(category: string, preference: Preference): Promise<WriteResult> {
  return write(`/me/preferences/${encodeURIComponent(category)}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ preference }),
  });
}

/** Both directions are idempotent on the API. */
export function setRestriction(demand: string, restricted: boolean): Promise<WriteResult> {
  return write(`/me/restrictions/${encodeURIComponent(demand)}`, { method: restricted ? "PUT" : "DELETE" });
}
