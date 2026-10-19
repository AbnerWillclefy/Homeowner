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

/** Who the API says is signed in. The first call after sign-in is what creates the User. */
export async function getMe(): Promise<MeResult> {
  try {
    const result = await authedFetch("/me");
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const body = (await result.response.json()) as Record<string, unknown> | null;
    const id = nonBlank(body?.["id"]);
    const email = nonBlank(body?.["email"]);
    const name = nonBlank(body?.["name"]);
    if (id === null || email === null || name === null) return { kind: "error" };
    return { kind: "ok", id, email, displayName: nonBlank(body?.["displayName"]), name, photoUrl: nonBlank(body?.["photoUrl"]) };
  } catch {
    return { kind: "offline" };
  }
}
