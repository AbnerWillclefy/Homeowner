import type { Preference, WriteResult } from "./profile";
import { authedFetch } from "./request";

/** The caller's effective Preference for a Chore, and whether they restricted that Chore itself. */
export interface OwnChoreSetting {
  preference: Preference;
  /** True only when the Resident set a Restriction on this Chore, not one that came from their general ones. */
  restricted: boolean;
}

/** Keyed by Chore id. A Chore that is absent has the defaults: neutral and not restricted. */
export type OwnChoreSettings = Record<string, OwnChoreSetting>;

export type OwnChoreSettingsResult =
  | { kind: "ok"; settings: OwnChoreSettings }
  | { kind: "not-signed-in" }
  | { kind: "offline" }
  | { kind: "error" };

const JSON_HEADERS = { "Content-Type": "application/json" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPreference(value: unknown): value is Preference {
  return value === "like" || value === "neutral" || value === "dislike";
}

function parseOwn(body: unknown): OwnChoreSettings | null {
  if (!isRecord(body) || !Array.isArray(body.residents)) return null;
  const me = body.residents.find((r): r is Record<string, unknown> => isRecord(r) && r.you === true);
  if (!me) return {};
  if (!isRecord(me.chores)) return null;
  const settings: OwnChoreSettings = {};
  for (const [id, entry] of Object.entries(me.chores)) {
    if (!isRecord(entry) || !isPreference(entry.preference) || typeof entry.restrictedByChore !== "boolean") {
      return null;
    }
    settings[id] = { preference: entry.preference, restricted: entry.restrictedByChore };
  }
  return settings;
}

/** The signed-in Resident's own settings for every Chore of their Home. */
export async function getOwnChoreSettings(): Promise<OwnChoreSettingsResult> {
  try {
    const result = await authedFetch("/home/chores/settings");
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const settings = parseOwn(await result.response.json());
    return settings ? { kind: "ok", settings } : { kind: "error" };
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

const choreUrl = (id: string, part: "preference" | "restriction") => `/home/chores/${encodeURIComponent(id)}/${part}`;

/** Sets the Resident's Preference for one Chore. Neutral clears it on the API. */
export function putChorePreference(choreId: string, preference: Preference): Promise<WriteResult> {
  return write(choreUrl(choreId, "preference"), {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ preference }),
  });
}

/** Both directions are idempotent on the API. */
export function setChoreRestriction(choreId: string, restricted: boolean): Promise<WriteResult> {
  return write(choreUrl(choreId, "restriction"), { method: restricted ? "PUT" : "DELETE" });
}
