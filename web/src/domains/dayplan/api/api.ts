import type { Locale } from "../../../shared/i18n/locales";
import { authedFetch, errorCode } from "../../auth/api/request";

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
  /** The Resident it is assigned to accepted it today. Absent from an older API. */
  committed?: boolean;
  /**
   * The Chore has reached its Effort cap, so a two-person Task would be kinder. Absent from an older API,
   * which reads as false.
   */
  suggestTwoPerson?: boolean;
  /** The other Residents' ids the Task is also given to (a two-person Task). Absent means none. */
  with?: string[];
}

/** A Task the signed-in Resident completed today. */
export interface CompletedTask {
  id: string;
  choreName: string;
  /** An instant, RFC 3339. */
  completedAt: string;
  /** The Chore's Category id. Optional and read leniently, as on `PlanTask`. */
  category?: string;
  /**
   * The other Residents' ids on the Completion: empty for a one-person Task. An older API omits it, which
   * reads as empty.
   */
  with: string[];
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
  /**
   * Which allocation run made the plan. Absent before the day is planned, so a new run is a different id.
   * Read leniently: a non-string is left out.
   */
  runId?: string;
  /**
   * Why the baseline planned instead of the AI (an id such as llm_daily_cap_reached); absent when there was no
   * fallback. Read leniently like `category`.
   */
  fallbackReason?: string;
  /** The caller's Energy for the plan: null before it, 0 when they have no Baseline for the weekday. */
  energy: number | null;
  mine: PlanTask[];
  others: ResidentTasks[];
  pool: PlanTask[];
  /** The caller's Tasks completed today, oldest first. */
  doneToday: CompletedTask[];
  /** The Swap offers the caller is part of. Always present: an absent or odd `swaps` reads as no offers. */
  swaps: { incoming: SwapOffer[]; outgoing: SwapOffer[] };
  /** Absent when there is none: before the plan, after a rejected run, or from an older API. */
  explanation?: Explanation;
}

/**
 * A live Swap offer. `residentId` is the other Resident: the offerer on an incoming offer, the recipient on an
 * outgoing one. `offered` is always what the offerer gives and `requested` what they ask for.
 */
export interface SwapOffer {
  id: string;
  residentId: string;
  offered: PlanTask;
  requested: PlanTask;
}

/**
 * Why the Resident's day looks the way it does, in plain words. Server data in both languages at once: the
 * app picks one by Locale and never translates it. `source` says who wrote it: the model ("llm") or a
 * template filled from the recorded reasons ("template").
 */
export interface Explanation {
  source: "llm" | "template";
  headline: Record<Locale, string>;
  detail: Record<Locale, string>;
}

export type Failure = { kind: "not-signed-in" } | { kind: "offline" } | { kind: "error" };

export type DayPlanResult =
  | { kind: "ok"; plan: DayPlan }
  /** 404: the User has no Home, or the Task is unknown. */
  | { kind: "none" }
  | Failure;

/** What an action answers: a Day Plan result, or 409 when the screen was stale. */
export type ActionResult =
  | DayPlanResult
  /** 409: `code` is the API's `error` ("unknown" when unreadable). Only actions return it. */
  | { kind: "conflict"; code: string };

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
    !(reason === undefined || typeof reason === "string") ||
    !(body.committed === undefined || typeof body.committed === "boolean")
  ) {
    return null;
  }
  const task: PlanTask = { id, choreId, choreName, windowStart, windowEnd, currentEffort, baseEffort, people, importance };
  // Lenient on purpose: a missing or odd category must never turn the whole plan into an error.
  if (typeof body.category === "string") task.category = body.category;
  if (typeof body.committed === "boolean") task.committed = body.committed;
  if (body.suggestTwoPerson === true) task.suggestTwoPerson = true;
  if (Array.isArray(body.with)) {
    const partners = body.with.filter((id): id is string => typeof id === "string");
    if (partners.length > 0) task.with = partners;
  }
  return reason === undefined ? task : { ...task, reason };
}

function parseCompleted(body: unknown): CompletedTask | null {
  if (!isRecord(body)) return null;
  const { id, choreName, completedAt } = body;
  if (typeof id !== "string" || typeof choreName !== "string" || typeof completedAt !== "string") return null;
  // Lenient on purpose: a missing or odd `with` or category must never turn the whole plan into an error.
  const partners = Array.isArray(body.with) && body.with.every((p) => typeof p === "string") ? (body.with as string[]) : [];
  const done: CompletedTask = { id, choreName, completedAt, with: partners };
  if (typeof body.category === "string") done.category = body.category;
  return done;
}

function parseDone(value: unknown): CompletedTask[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const done = value.map(parseCompleted);
  return done.every((d) => d !== null) ? done : null;
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

/** A non-blank string in both languages, or null. */
function parseBilingual(value: unknown): Record<Locale, string> | null {
  if (!isRecord(value)) return null;
  const en = value["en-US"];
  const pt = value["pt-BR"];
  if (typeof en !== "string" || typeof pt !== "string" || en.trim() === "" || pt.trim() === "") return null;
  return { "en-US": en, "pt-BR": pt };
}

/**
 * Lenient: anything that is not a full explanation (a known source, a headline and a detail in both languages,
 * none blank) is none, never a failed plan. An older server that sends only `text` therefore shows no card.
 */
function parseExplanation(value: unknown): Explanation | null {
  if (!isRecord(value)) return null;
  const { source } = value;
  const headline = parseBilingual(value.headline);
  const detail = parseBilingual(value.detail);
  if ((source !== "llm" && source !== "template") || !headline || !detail) return null;
  return { source, headline, detail };
}

function parseSwapOffer(body: unknown): SwapOffer | null {
  if (!isRecord(body)) return null;
  const { id, residentId } = body;
  if (typeof id !== "string" || id === "" || typeof residentId !== "string") return null;
  const offered = parseTask(body.offered);
  const requested = parseTask(body.requested);
  // A Task missing on the server arrives as an empty one (id ""): not an offer anyone can act on.
  if (!offered || !requested || offered.id === "" || requested.id === "") return null;
  return { id, residentId, offered, requested };
}

/** Never null: a bad list or entry must not cost the Resident their plan. */
function parseSwapList(value: unknown): SwapOffer[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseSwapOffer).filter((offer): offer is SwapOffer => offer !== null);
}

/**
 * Lenient, the opposite of `parseTasks`: Swap offers are secondary to the plan, so an offer that cannot be read
 * is dropped (like `category`) instead of turning the whole Day Plan into an error.
 */
function parseSwaps(value: unknown): DayPlan["swaps"] {
  if (!isRecord(value)) return { incoming: [], outgoing: [] };
  return { incoming: parseSwapList(value.incoming), outgoing: parseSwapList(value.outgoing) };
}

function parseDayPlan(body: unknown): DayPlan | null {
  if (!isRecord(body)) return null;
  const { date, allocationTime, planned, rejected, allocator, energy } = body;
  const mine = parseTasks(body.mine);
  const others = parseOthers(body.others);
  const pool = parseTasks(body.pool);
  const doneToday = parseDone(body.doneToday);
  if (
    typeof date !== "string" ||
    typeof allocationTime !== "string" ||
    typeof planned !== "boolean" ||
    typeof rejected !== "boolean" ||
    typeof allocator !== "string" ||
    !(energy === null || typeof energy === "number") ||
    !mine ||
    !others ||
    !pool ||
    !doneToday
  ) {
    return null;
  }
  const swaps = parseSwaps(body.swaps);
  const plan: DayPlan = {
    date,
    allocationTime,
    planned,
    rejected,
    allocator,
    energy,
    mine,
    others,
    pool,
    doneToday,
    swaps,
  };
  if (typeof body.runId === "string" && body.runId !== "") plan.runId = body.runId;
  if (typeof body.fallbackReason === "string" && body.fallbackReason !== "") plan.fallbackReason = body.fallbackReason;
  const explanation = parseExplanation(body.explanation);
  return explanation ? { ...plan, explanation } : plan;
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

/** What asking for a new plan answers. `none` (404) means the route does not exist: not a staging build. */
export type ReplanResult = { kind: "ok" } | { kind: "none" } | Failure;

/**
 * Asks the API to plan the Home again now (staging only: `POST /dev/replan`, no body). The API answers 202 and
 * plans in the background, so the new plan is found by reading the Day Plan until its run changes.
 */
export async function replanHome(): Promise<ReplanResult> {
  try {
    const result = await authedFetch("/dev/replan", { method: "POST" });
    if (result.kind === "not-signed-in") return result;
    if (result.response.status === 202) return { kind: "ok" };
    if (result.response.status === 404) return { kind: "none" };
    return { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

const post = (path: string) => send(path, { method: "POST" });
const taskPath = (id: string, action: string) => `/home/tasks/${encodeURIComponent(id)}/${action}`;

/** Accepts one of the caller's Proposed Tasks: it becomes Committed. */
export const acceptTask = (id: string) => post(taskPath(id, "accept"));
/** Accepts every Proposed Task of the caller at once. */
export const acceptAll = () => post("/home/day-plan/accept-all");
/** Refuses one of the caller's Proposed Tasks: it goes back to the pool. */
export const refuseTask = (id: string) => post(taskPath(id, "refuse"));
/** Takes a Task from the pool. */
export const takeTask = (id: string) => post(taskPath(id, "take"));
/** Records the Completion of one of the caller's Tasks. */
export const completeTask = (id: string) => post(taskPath(id, "complete"));

const swapPath = (id: string, action: string) => `/home/swaps/${encodeURIComponent(id)}/${action}`;

/** Offers one of the caller's Tasks for another Resident's. Nothing moves until they accept. */
export const offerSwap = (offeredTaskId: string, requestedTaskId: string) =>
  send("/home/swaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offeredTaskId, requestedTaskId }),
  });
/** Accepts a Swap offered to the caller: the two Tasks change hands. */
export const acceptSwap = (id: string) => post(swapPath(id, "accept"));
/** Declines a Swap offered to the caller. */
export const declineSwap = (id: string) => post(swapPath(id, "decline"));
/** Takes back a Swap the caller offered. */
export const cancelSwap = (id: string) => post(swapPath(id, "cancel"));

/** A read: a 409 is not something a read can get, so it counts as an error. */
async function dayPlanCall(path: string, init?: RequestInit): Promise<DayPlanResult> {
  const result = await send(path, init);
  return result.kind === "conflict" ? { kind: "error" } : result;
}

async function send(path: string, init?: RequestInit): Promise<ActionResult> {
  try {
    const result = await authedFetch(path, init);
    if (result.kind === "not-signed-in") return result;
    if (result.response.status === 404) {
      // A Swap that was answered or vanished: the screen is stale, like a 409. Any other 404 is a missing Home or Task.
      return (await errorCode(result.response)) === "swap_not_found"
        ? { kind: "conflict", code: "swap_not_found" }
        : { kind: "none" };
    }
    if (result.response.status === 409) return { kind: "conflict", code: (await errorCode(result.response)) ?? "unknown" };
    if (result.response.status !== 200) return { kind: "error" };
    const plan = parseDayPlan(await result.response.json());
    return plan ? { kind: "ok", plan } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}
