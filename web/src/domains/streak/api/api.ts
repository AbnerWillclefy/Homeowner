import { authedRequest } from "../../auth/api/client";

/** The signed-in Resident's current Streak, in days. */
export interface Streak {
  current: number;
  /** True when today already counts toward `current`. */
  todayGrew: boolean;
  /** The last seven days, oldest first, today last. Absent from an older API or when unreadable: show no week. */
  week?: StreakDay[];
}

export interface StreakDay {
  /** A Home-local day, YYYY-MM-DD. */
  date: string;
  state: "grew" | "paused" | "broken" | "open";
}

const DAY_STATES: readonly string[] = ["grew", "paused", "broken", "open"];

/** Lenient: anything but exactly seven well-formed days is none, never a failed Streak. */
function parseWeek(value: unknown): StreakDay[] | undefined {
  if (!Array.isArray(value) || value.length !== 7) return undefined;
  const ok = value.every(
    (d) => typeof d === "object" && d !== null && typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && DAY_STATES.includes(d.state),
  );
  return ok ? value.map((d) => ({ date: d.date, state: d.state })) : undefined;
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
  const week = parseWeek((body as Record<string, unknown>).week);
  return week ? { current, todayGrew, week } : { current, todayGrew };
}

/** Reads `GET /home/streak`. A Streak of 0 is an ok result, not a failure. */
export async function getStreak(): Promise<StreakResult> {
  try {
    const result = await authedRequest({ url: "/home/streak" });
    if (result.kind === "not-signed-in") return result;
    const { status } = result.response;
    if (status === 404) return { kind: "none" };
    if (status !== 200) return { kind: "error" };
    const streak = parseStreak(result.response.data);
    return streak ? { kind: "ok", streak } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}
