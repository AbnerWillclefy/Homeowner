import { authedFetch } from "../shared/api/request";

/** An open Task as the Day Plan shows it. Dates are "YYYY-MM-DD". */
export interface PlanTask {
  id: string;
  choreId: string;
  choreName: string;
  windowStart: string;
  windowEnd: string;
  currentEffort: number;
  baseEffort: number;
  people: number;
  /** An Importance id: essential, normal or nice_to_have. */
  importance: string;
  /** A stable reason id, localised by the app. Empty before the day is planned. */
  reason?: string;
  /**
   * The Chore's Category id. Absent from an older API and possibly an id the app has no style for, so it is
   * optional and a card without a known one renders neutral.
   */
  category?: string;
}

export interface ResidentTasks {
  residentId: string;
  tasks: PlanTask[];
}

/** The Home's Day Plan for today, seen by the signed-in Resident. */
export interface DayPlan {
  date: string;
  /** "HH:MM" in the Home's zone: when the plan comes. */
  allocationTime: string;
  planned: boolean;
  /** Today's run exists but the checker refused the proposal, so nothing is assigned. */
  rejected: boolean;
  allocator: string;
  /** The caller's Energy for the plan: null before it, 0 when they have no Baseline for the weekday. */
  energy: number | null;
  mine: PlanTask[];
  others: ResidentTasks[];
  pool: PlanTask[];
}

export type Failure = { kind: "not-signed-in" } | { kind: "offline" } | { kind: "error" };

export type DayPlanResult =
  | { kind: "ok"; plan: DayPlan }
  /** 404: the User has no Home. */
  | { kind: "none" }
  | Failure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTask(body: unknown): PlanTask | null {
  if (!isRecord(body)) return null;
  const { id, choreId, choreName, windowStart, windowEnd, currentEffort, baseEffort, people, importance, reason } = body;
  if (
    typeof id !== "string" ||
    typeof choreId !== "string" ||
    typeof choreName !== "string" ||
    typeof windowStart !== "string" ||
    typeof windowEnd !== "string" ||
    typeof currentEffort !== "number" ||
    typeof baseEffort !== "number" ||
    typeof people !== "number" ||
    typeof importance !== "string" ||
    !(reason === undefined || typeof reason === "string")
  ) {
    return null;
  }
  const task: PlanTask = { id, choreId, choreName, windowStart, windowEnd, currentEffort, baseEffort, people, importance };
  // Lenient on purpose: a missing or odd category must never turn the whole plan into an error.
  if (typeof body.category === "string") task.category = body.category;
  return reason === undefined ? task : { ...task, reason };
}

/** A list of Tasks, where null (a Go nil slice) means none. Null result: something in it is unreadable. */
function parseTasks(value: unknown): PlanTask[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const tasks = value.map(parseTask);
  return tasks.every((t) => t !== null) ? tasks : null;
}

function parseOthers(value: unknown): ResidentTasks[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const others: ResidentTasks[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.residentId !== "string") return null;
    const tasks = parseTasks(item.tasks);
    if (!tasks) return null;
    others.push({ residentId: item.residentId, tasks });
  }
  return others;
}

function parseDayPlan(body: unknown): DayPlan | null {
  if (!isRecord(body)) return null;
  const { date, allocationTime, planned, rejected, allocator, energy } = body;
  const mine = parseTasks(body.mine);
  const others = parseOthers(body.others);
  const pool = parseTasks(body.pool);
  if (
    typeof date !== "string" ||
    typeof allocationTime !== "string" ||
    typeof planned !== "boolean" ||
    typeof rejected !== "boolean" ||
    typeof allocator !== "string" ||
    !(energy === null || typeof energy === "number") ||
    !mine ||
    !others ||
    !pool
  ) {
    return null;
  }
  return { date, allocationTime, planned, rejected, allocator, energy, mine, others, pool };
}

/** Today's Day Plan for the signed-in Resident's Home. Before the Allocation time it is an unplanned plan, not a failure. */
export function getDayPlan(): Promise<DayPlanResult> {
  return dayPlanCall("/home/day-plan");
}

/**
 * Plans the signed-in Resident alone, right now, from what is still in today's pool ("Get my tasks right
 * away"). It takes no Resident id and no body, and answers with the same Day Plan as getDayPlan. Safe to repeat.
 */
export function planMyDay(): Promise<DayPlanResult> {
  return dayPlanCall("/home/day-plan/me", { method: "POST" });
}

async function dayPlanCall(path: string, init?: RequestInit): Promise<DayPlanResult> {
  try {
    const result = await authedFetch(path, init);
    if (result.kind === "not-signed-in") return result;
    if (result.response.status === 404) return { kind: "none" };
    if (result.response.status !== 200) return { kind: "error" };
    const plan = parseDayPlan(await result.response.json());
    return plan ? { kind: "ok", plan } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}
