import { authedFetch } from "../../auth/api/request";

/** The signed-in Resident's current Streak, in days. */
export interface Streak {
  current: number;
  /** True when today already counts toward `current`. */
  todayGrew: boolean;
}

export type StreakResult =
  | { kind: "ok"; streak: Streak }
  /** 404: the User has no Home. */
  | { kind: "none" }
  | { kind: "not-signed-in" }
  | { kind: "offline" }
  | { kind: "error" };

function parseStreak(body: unknown): Streak | null {
  if (typeof body !== "object" || body === null) return null;
  const { current, todayGrew } = body as Record<string, unknown>;
  if (typeof current !== "number" || !Number.isInteger(current) || current < 0) return null;
  if (typeof todayGrew !== "boolean") return null;
  return { current, todayGrew };
}

/** Reads `GET /home/streak`. A Streak of 0 is an ok result, not a failure. */
export async function getStreak(): Promise<StreakResult> {
  try {
    const result = await authedFetch("/home/streak");
    if (result.kind === "not-signed-in") return result;
    const { status } = result.response;
    if (status === 404) return { kind: "none" };
    if (status !== 200) return { kind: "error" };
    const streak = parseStreak(await result.response.json());
    return streak ? { kind: "ok", streak } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}
