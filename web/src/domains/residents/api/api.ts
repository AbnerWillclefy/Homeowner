import { authedFetch } from "../../auth/api/request";

/** One Resident of the signed-in User's Home, as `GET /home/residents` lists them. Never carries an email. */
export interface Resident {
  residentId: string;
  userId: string;
  /** The shown name: the display name, else the API's stand-in. */
  name: string;
  photoUrl: string | null;
  /** True for the caller's own row. */
  me: boolean;
}

export type ResidentsResult =
  | { kind: "ok"; residents: Resident[] }
  /** 404: the User has no Home. */
  | { kind: "none" }
  | { kind: "not-signed-in" }
  | { kind: "offline" }
  | { kind: "error" };

/** A row the app cannot use is dropped, so one bad row never hides the others. A missing photoUrl is null. */
function parseResident(row: unknown): Resident | null {
  if (typeof row !== "object" || row === null) return null;
  const { residentId, userId, name, photoUrl, me } = row as Record<string, unknown>;
  if (typeof residentId !== "string" || typeof userId !== "string" || typeof name !== "string" || typeof me !== "boolean") {
    return null;
  }
  return { residentId, userId, name, photoUrl: typeof photoUrl === "string" && photoUrl !== "" ? photoUrl : null, me };
}

/** Reads `GET /home/residents`. */
export async function getResidents(): Promise<ResidentsResult> {
  try {
    const result = await authedFetch("/home/residents");
    if (result.kind === "not-signed-in") return result;
    const { status } = result.response;
    if (status === 404) return { kind: "none" };
    if (status !== 200) return { kind: "error" };
    const body: unknown = await result.response.json();
    if (!Array.isArray(body)) return { kind: "error" };
    const residents = body.map(parseResident).filter((resident): resident is Resident => resident !== null);
    return { kind: "ok", residents };
  } catch {
    return { kind: "offline" };
  }
}
