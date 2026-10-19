import { authedFetch } from "../../auth/api/request";

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
