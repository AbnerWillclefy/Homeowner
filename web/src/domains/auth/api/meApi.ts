import { authedFetch } from "./request";

export interface Me {
  id: string;
  email: string;
  /** What the User typed as their name, or null when they set none. */
  displayName: string | null;
  /** The shown name, as the API decides it. */
  name: string;
  photoUrl: string | null;
}

export type MeResult =
  | ({ kind: "ok" } & Me)
  | { kind: "not-signed-in" }
  /** The API could not be reached. A stored session is still good; the person may just be offline. */
  | { kind: "offline" }
  | { kind: "error" };

/** A non-empty string, or null. */
function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** A User from the API's `GET /me` shape (also what `PUT /me/name` answers), or null when it is not one. */
export function parseMe(raw: unknown): Me | null {
  const body = typeof raw === "object" ? (raw as Record<string, unknown> | null) : null;
  const id = nonBlank(body?.["id"]);
  const email = nonBlank(body?.["email"]);
  const name = nonBlank(body?.["name"]);
  if (id === null || email === null || name === null) return null;
  return { id, email, displayName: nonBlank(body?.["displayName"]), name, photoUrl: nonBlank(body?.["photoUrl"]) };
}

/** Who the API says is signed in. The first call after sign-in is what creates the User. */
export async function getMe(): Promise<MeResult> {
  try {
    const result = await authedFetch("/me");
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const me = parseMe(await result.response.json());
    return me === null ? { kind: "error" } : { kind: "ok", ...me };
  } catch {
    return { kind: "offline" };
  }
}
