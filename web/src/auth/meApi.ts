import { authedFetch } from "../shared/api/request";

export type MeResult =
  | { kind: "ok"; id: string; email: string }
  | { kind: "not-signed-in" }
  /** The API could not be reached. A stored session is still good; the person may just be offline. */
  | { kind: "offline" }
  | { kind: "error" };

/** Who the API says is signed in. The first call after sign-in is what creates the User. */
export async function getMe(): Promise<MeResult> {
  try {
    const result = await authedFetch("/me");
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const body = (await result.response.json()) as { id?: unknown; email?: unknown } | null;
    if (typeof body?.id !== "string" || typeof body.email !== "string") return { kind: "error" };
    return { kind: "ok", id: body.id, email: body.email };
  } catch {
    return { kind: "offline" };
  }
}
