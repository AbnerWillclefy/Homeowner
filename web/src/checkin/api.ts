import { authedFetch } from "../auth/request";

export const LEVELS = ["drained", "low", "normal", "energized"] as const;
/** How much Energy a Resident says they have today. */
export type Level = (typeof LEVELS)[number];

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

/** The signed-in Resident's Check-in for the Home's local day. `level` is null until they check in. */
export interface CheckIn {
  /** "YYYY-MM-DD" in the Home's zone. */
  date: string;
  checkedIn: boolean;
  level: Level | null;
  /** Demand ids the Resident cannot do today only. */
  restrictions: string[];
}

export type Failure = { kind: "not-signed-in" } | { kind: "offline" } | { kind: "error" };

export type CheckInResult =
  | { kind: "ok"; checkIn: CheckIn }
  /** 404: the User has no Home. */
  | { kind: "none" }
  | Failure;

export type SaveCheckInResult = CheckInResult | { kind: "invalid" };

function parseCheckIn(body: unknown): CheckIn | null {
  if (typeof body !== "object" || body === null) return null;
  const { date, checkedIn, level } = body as Record<string, unknown>;
  const restrictions = (body as Record<string, unknown>).restrictions ?? [];
  if (typeof date !== "string" || typeof checkedIn !== "boolean") return null;
  if (!Array.isArray(restrictions) || !restrictions.every((r) => typeof r === "string")) return null;
  if (checkedIn ? !isLevel(level) : level !== null) return null;
  return { date, checkedIn, level: level as Level | null, restrictions: restrictions as string[] };
}

async function request(init?: RequestInit): Promise<SaveCheckInResult> {
  try {
    const result = await authedFetch("/home/check-in", init);
    if (result.kind === "not-signed-in") return result;
    const { status } = result.response;
    if (status === 404) return { kind: "none" };
    if (status === 400) return { kind: "invalid" };
    if (status !== 200) return { kind: "error" };
    const checkIn = parseCheckIn(await result.response.json());
    return checkIn ? { kind: "ok", checkIn } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

/** Today's Check-in. A day with none is an ok result with `checkedIn: false`, not a failure. */
export const getCheckIn = (): Promise<CheckInResult> => request() as Promise<CheckInResult>;

/** Sets today's Check-in, replacing an earlier one. Idempotent; the API plans the Resident again if today's plan exists. */
export function putCheckIn(level: Level, restrictions: readonly string[]): Promise<SaveCheckInResult> {
  return request({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level, restrictions }),
  });
}
