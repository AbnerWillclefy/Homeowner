import { authedFetch, errorCode } from "../../auth/api/request";

/** One Resident of the signed-in User's Home, as `GET /home/residents` lists them. Never carries an email or a user id. */
export interface Resident {
  /** The id the Day Plan uses for a Resident. */
  id: string;
  /** True for the caller's own row. */
  you: boolean;
  /** The shown name: the display name, else the API's stand-in. */
  name: string;
  photoUrl: string | null;
  /** The letters of the initials Avatar, decided by the API. */
  initials: string;
  /** The pastel of the initials Avatar, as a Category id (kitchen, bathroom, ...). */
  avatarTone: string;
  /** The current Streak, in days. */
  streak: number;
  /** How many Tasks they completed today. */
  doneToday: number;
}

export type ResidentsResult =
  | { kind: "ok"; /** Today in the Home's time zone, YYYY-MM-DD. */ date: string; residents: Resident[] }
  /** 404: the User has no Home. */
  | { kind: "none" }
  | { kind: "not-signed-in" }
  | { kind: "offline" }
  | { kind: "error" };

const count = (value: unknown): number => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0);

/** A row the app cannot use is dropped, so one bad row never hides the others. A missing photoUrl is null. */
function parseResident(row: unknown): Resident | null {
  if (typeof row !== "object" || row === null) return null;
  const { id, you, name, photoUrl, initials, avatarTone, streak, doneToday } = row as Record<string, unknown>;
  if (typeof id !== "string" || typeof name !== "string" || typeof you !== "boolean") return null;
  return {
    id,
    you,
    name,
    photoUrl: typeof photoUrl === "string" && photoUrl !== "" ? photoUrl : null,
    initials: typeof initials === "string" ? initials : "",
    avatarTone: typeof avatarTone === "string" ? avatarTone : "",
    streak: count(streak),
    doneToday: count(doneToday),
  };
}

/** Reads `GET /home/residents`. */
export async function getResidents(): Promise<ResidentsResult> {
  try {
    const result = await authedFetch("/home/residents");
    if (result.kind === "not-signed-in") return result;
    const { status } = result.response;
    if (status === 404) return { kind: "none" };
    if (status !== 200) return { kind: "error" };
    const body = (await result.response.json()) as { date?: unknown; residents?: unknown } | null;
    if (typeof body?.date !== "string" || !Array.isArray(body.residents)) return { kind: "error" };
    const residents = body.residents.map(parseResident).filter((resident): resident is Resident => resident !== null);
    return { kind: "ok", date: body.date, residents };
  } catch {
    return { kind: "offline" };
  }
}

/** The other Resident on a two-person Completion. */
export interface Partner {
  id: string;
  name: string;
}

/** One Completion on a Resident's page: a record, never something to act on. */
export interface ResidentCompletion {
  id: string;
  choreName: string;
  /** The Category id, or "" when the API did not send one; `categoryStyle` turns it into "other". */
  category: string;
  /** The instant, RFC 3339 (UTC). */
  completedAt: string;
  with: Partner[];
}

/** The Completions of one local day of the Home, oldest first. */
export interface ResidentDay {
  /** The Home's local date, YYYY-MM-DD. */
  date: string;
  completions: ResidentCompletion[];
}

/** `GET /home/residents/{id}`: one Resident, their Streak and their last 7 days. */
export interface ResidentDetail {
  /** Today in the Home's time zone, YYYY-MM-DD: the day the headings are counted from. */
  date: string;
  id: string;
  you: boolean;
  name: string;
  photoUrl: string | null;
  initials: string;
  avatarTone: string;
  streak: number;
  doneLast7Days: number;
  /** Only the days that have Completions, newest first. */
  days: ResidentDay[];
}

export type ResidentResult =
  | { kind: "ok"; resident: ResidentDetail }
  /** 404 `resident not found`: unknown, left, another Home or a malformed id; all read the same. */
  | { kind: "not-found" }
  /** 404 `no home`: the User has no Home. */
  | { kind: "none" }
  | { kind: "not-signed-in" }
  | { kind: "offline" }
  | { kind: "error" };

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function parsePartner(value: unknown): Partner | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  return { id: value.id, name: value.name };
}

function parseCompletion(value: unknown): ResidentCompletion | null {
  if (!isRecord(value)) return null;
  const { id, choreName, category, completedAt, with: partners } = value;
  if (typeof id !== "string" || typeof choreName !== "string") return null;
  if (typeof completedAt !== "string" || Number.isNaN(Date.parse(completedAt))) return null;
  if (!Array.isArray(partners)) return null;
  const parsed = partners.map(parsePartner);
  if (parsed.some((partner) => partner === null)) return null;
  return { id, choreName, category: typeof category === "string" ? category : "", completedAt, with: parsed as Partner[] };
}

function parseDay(value: unknown): ResidentDay | null {
  if (!isRecord(value) || typeof value.date !== "string" || !Array.isArray(value.completions)) return null;
  const completions = value.completions.map(parseCompletion);
  if (completions.some((completion) => completion === null)) return null;
  return { date: value.date, completions: completions as ResidentCompletion[] };
}

/** Strict: a page built on a half-understood answer would mislead, so anything off is an error with Retry. */
function parseDetail(body: unknown): ResidentDetail | null {
  if (!isRecord(body)) return null;
  const { date, id, you, name, photoUrl, initials, avatarTone, streak, doneLast7Days, days } = body;
  if (typeof date !== "string" || typeof id !== "string" || typeof name !== "string" || typeof you !== "boolean") return null;
  if (!isCount(streak) || !isCount(doneLast7Days) || !Array.isArray(days)) return null;
  const parsedDays = days.map(parseDay);
  if (parsedDays.some((day) => day === null)) return null;
  return {
    date,
    id,
    you,
    name,
    photoUrl: typeof photoUrl === "string" && photoUrl !== "" ? photoUrl : null,
    initials: typeof initials === "string" ? initials : "",
    avatarTone: typeof avatarTone === "string" ? avatarTone : "",
    streak,
    doneLast7Days,
    days: parsedDays as ResidentDay[],
  };
}

/** Reads `GET /home/residents/{id}`. The two 404s are told apart by the API's `error` code. */
export async function getResident(id: string): Promise<ResidentResult> {
  try {
    const result = await authedFetch(`/home/residents/${encodeURIComponent(id)}`);
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === 404) return (await errorCode(response)) === "no home" ? { kind: "none" } : { kind: "not-found" };
    if (response.status !== 200) return { kind: "error" };
    const resident = parseDetail(await response.json().catch(() => null));
    return resident === null ? { kind: "error" } : { kind: "ok", resident };
  } catch {
    return { kind: "offline" };
  }
}
