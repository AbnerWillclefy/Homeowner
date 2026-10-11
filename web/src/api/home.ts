import type { ChoreWire } from "./chores";
import { authedFetch } from "./request";

/** What a Resident can change about their Home. `allocationTime` is "HH:MM", 24 hours, in the Home's zone. */
export interface HomeSettings {
  timezone: string;
  allocationTime: string;
}

export interface Home extends HomeSettings {
  id: string;
}

/** Field name to the API's stable machine code, for example `{ timezone: "unknown" }`. */
export type FieldCodes = Record<string, string>;

/** Failures every call can have. */
export type Failure =
  | { kind: "not-signed-in" }
  /** The API could not be reached. Whatever was typed is still good. */
  | { kind: "offline" }
  | { kind: "error" };

export type FailureReason = Failure["kind"];

export type GetHomeResult = { kind: "ok"; home: Home } | { kind: "none" } | Failure;

export type CreateHomeResult =
  | { kind: "ok"; home: Home }
  /** 409: the caller already lives in a Home; load it instead. */
  | { kind: "already-resident" }
  | { kind: "invalid"; fields: FieldCodes }
  | Failure;

export type UpdateHomeResult =
  | { kind: "ok"; home: Home }
  | { kind: "none" }
  | { kind: "invalid"; fields: FieldCodes }
  | Failure;

const JSON_HEADERS = { "Content-Type": "application/json" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseHome(body: unknown): Home | null {
  if (!isRecord(body)) return null;
  const { id, timezone, allocationTime } = body;
  if (typeof id !== "string" || typeof timezone !== "string" || typeof allocationTime !== "string") return null;
  return { id, timezone, allocationTime };
}

async function parseFields(response: Response): Promise<FieldCodes | null> {
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body) || !isRecord(body.fields)) return null;
  const entries = Object.entries(body.fields).filter((e): e is [string, string] => typeof e[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

type Shared = { kind: "ok"; home: Home } | { kind: "invalid"; fields: FieldCodes } | Failure;

/**
 * The flow every Home call shares: send, pass a missing session through, read a 400 as field codes, and
 * read `okStatus` as a Home. `special` maps the one status that is particular to the call.
 */
async function sendHome<S>(init: RequestInit, okStatus: number, special: Readonly<Record<number, S>>): Promise<Shared | S> {
  try {
    const result = await authedFetch("/home", init);
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    const mapped = special[response.status];
    if (mapped !== undefined) return mapped;
    if (response.status === 400) {
      const fields = await parseFields(response);
      return fields ? { kind: "invalid", fields } : { kind: "error" };
    }
    if (response.status !== okStatus) return { kind: "error" };
    const home = parseHome(await response.json());
    return home ? { kind: "ok", home } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

function withBody(method: string, body: HomeSettings | (HomeSettings & { chores: ChoreWire[] })): RequestInit {
  return { method, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/** The caller's Home. `none` (a 404) means they have not made one yet. */
export async function getHome(): Promise<GetHomeResult> {
  const result = await sendHome<{ kind: "none" }>({}, 200, { 404: { kind: "none" } });
  // A GET sends nothing, so there is nothing for a 400 to be about.
  return result.kind === "invalid" ? { kind: "error" } : result;
}

/**
 * Creates the Home. `chores` are the reviewed Chores to create with it in the same transaction; the API's
 * field errors for them are keyed `chores.<index>.<field>`.
 */
export function createHome(settings: HomeSettings, chores: readonly ChoreWire[] = []): Promise<CreateHomeResult> {
  const body = chores.length > 0 ? { ...settings, chores: [...chores] } : settings;
  return sendHome<{ kind: "already-resident" }>(withBody("POST", body), 201, { 409: { kind: "already-resident" } });
}

/** Replaces the Home's settings. Any Resident can. */
export function updateHome(settings: HomeSettings): Promise<UpdateHomeResult> {
  return sendHome<{ kind: "none" }>(withBody("PUT", settings), 200, { 404: { kind: "none" } });
}
