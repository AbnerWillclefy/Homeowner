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
type Failure =
  | { kind: "not-signed-in" }
  /** The API could not be reached. Whatever was typed is still good. */
  | { kind: "offline" }
  | { kind: "error" };

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

function parseHome(body: unknown): Home | null {
  const b = body as { id?: unknown; timezone?: unknown; allocationTime?: unknown } | null;
  if (typeof b?.id !== "string" || typeof b.timezone !== "string" || typeof b.allocationTime !== "string") return null;
  return { id: b.id, timezone: b.timezone, allocationTime: b.allocationTime };
}

async function parseFields(response: Response): Promise<FieldCodes | null> {
  const body = (await response.json().catch(() => null)) as { fields?: unknown } | null;
  const fields = body?.fields;
  if (typeof fields !== "object" || fields === null) return null;
  const entries = Object.entries(fields).filter((e): e is [string, string] => typeof e[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** The caller's Home. `none` (a 404) means they have not made one yet. */
export async function getHome(): Promise<GetHomeResult> {
  try {
    const result = await authedFetch("/home");
    if (result.kind === "not-signed-in") return result;
    if (result.response.status === 404) return { kind: "none" };
    if (result.response.status !== 200) return { kind: "error" };
    const home = parseHome(await result.response.json());
    return home ? { kind: "ok", home } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

export async function createHome(settings: HomeSettings): Promise<CreateHomeResult> {
  try {
    const result = await authedFetch("/home", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(settings) });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === 409) return { kind: "already-resident" };
    if (response.status === 400) {
      const fields = await parseFields(response);
      return fields ? { kind: "invalid", fields } : { kind: "error" };
    }
    if (response.status !== 201) return { kind: "error" };
    const home = parseHome(await response.json());
    return home ? { kind: "ok", home } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

/** Replaces the Home's settings. Any Resident can. */
export async function updateHome(settings: HomeSettings): Promise<UpdateHomeResult> {
  try {
    const result = await authedFetch("/home", { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(settings) });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === 404) return { kind: "none" };
    if (response.status === 400) {
      const fields = await parseFields(response);
      return fields ? { kind: "invalid", fields } : { kind: "error" };
    }
    if (response.status !== 200) return { kind: "error" };
    const home = parseHome(await response.json());
    return home ? { kind: "ok", home } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}
