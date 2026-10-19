import { authedFetch } from "./request";

export interface Me {
  id: string;
  email: string;
  /** What the User typed as their name, or null when they set none. */
  displayName: string | null;
  /** The shown name: the display name, else the email's local part (the client's own fallback for an older API). */
  name: string;
  photoUrl: string | null;
}

export type MeResult =
  | ({ kind: "ok" } & Me)
  | { kind: "not-signed-in" }
  /** The API could not be reached. A stored session is still good; the person may just be offline. */
  | { kind: "offline" }
  | { kind: "error" };

/** A non-empty string, or null: the fields an older API does not send read as absent. */
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
    if (typeof body?.["id"] !== "string" || typeof body["email"] !== "string") return { kind: "error" };
    const { id, email } = body as { id: string; email: string };
    const displayName = nonBlank(body["displayName"]);
    const name = nonBlank(body["name"]) ?? displayName ?? email.split("@")[0]!;
    return { kind: "ok", id, email, displayName, name, photoUrl: nonBlank(body["photoUrl"]) };
  } catch {
    return { kind: "offline" };
  }
}
