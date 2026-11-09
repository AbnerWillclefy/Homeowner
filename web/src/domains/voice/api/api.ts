import type { Locale } from "../../../shared/i18n/locales";
import { authedRequest } from "../../auth/api/client";
import type { ChoreWire } from "../../chores/api/api";

/** One proposal, as far as the app trusts it: a closed kind, ids and Chore data. Model text never gets this far. */
export type PlainAction =
  | { kind: "create_chore"; choreName: string; body: ChoreWire }
  | { kind: "edit_chore"; choreId: string; choreName: string; changed: ChangedField[]; body: ChoreWire }
  | { kind: TaskKind; taskId: string; choreName: string };

export type VoiceAction =
  | PlainAction
  /** Several matches: the Resident picks one, which replaces this; until then it is never sent. */
  | { kind: "choice"; candidates: PlainAction[] };

export const TASK_KINDS = ["accept", "take", "refuse", "complete"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const CHANGED_FIELDS = ["name", "category", "baseEffort", "importance", "intervalDays", "allowedWeekdays"] as const;
export type ChangedField = (typeof CHANGED_FIELDS)[number];

export interface Interpretation {
  status: "ok" | "nothing_understood" | "too_many";
  actions: VoiceAction[];
  remaining: number;
}

export type InterpretResult =
  | { kind: "ok"; interpretation: Interpretation }
  /** 429: the daily limit. */
  | { kind: "limit" }
  /** 503: voice is off in this environment. */
  | { kind: "unavailable" }
  /** 502 or 504: the model failed or timed out. */
  | { kind: "failed" }
  /** 400: the server refused the transcript. */
  | { kind: "invalid" }
  | { kind: "offline" }
  | { kind: "not-signed-in" }
  | { kind: "error" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isList = (v: unknown, type: string): boolean => Array.isArray(v) && v.every((x) => typeof x === type);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.some((x) => x === v);

function parseBody(v: unknown): ChoreWire | null {
  if (!isRecord(v)) return null;
  const ok =
    typeof v.name === "string" &&
    typeof v.category === "string" &&
    isList(v.demands, "string") &&
    typeof v.baseEffort === "number" &&
    typeof v.importance === "string" &&
    typeof v.people === "number" &&
    (v.intervalDays === null || typeof v.intervalDays === "number") &&
    isList(v.allowedWeekdays, "number") &&
    typeof v.buildsUp === "boolean";
  return ok ? (v as unknown as ChoreWire) : null;
}

function parseAction(raw: unknown, allowChoice: boolean): VoiceAction | null {
  if (!isRecord(raw)) return null;
  const { kind, choreName } = raw;
  if (Array.isArray(raw.candidates) && raw.candidates.length > 0) {
    const nested = raw.candidates.map((c) => parseAction(c, false));
    return allowChoice && nested.every((c) => c !== null) ? { kind: "choice", candidates: nested as PlainAction[] } : null;
  }
  if (typeof choreName !== "string") return null;
  const body = isRecord(raw.request) ? parseBody(raw.request.body) : null;
  if (kind === "create_chore") return body ? { kind, choreName, body } : null;
  if (kind === "edit_chore") {
    const { choreId, changed } = raw;
    if (!body || typeof choreId !== "string" || !Array.isArray(changed) || !changed.every((f) => oneOf(CHANGED_FIELDS, f))) return null;
    return { kind, choreId, choreName, changed: changed as ChangedField[], body };
  }
  if (oneOf(TASK_KINDS, kind) && typeof raw.taskId === "string") return { kind, taskId: raw.taskId, choreName };
  return null;
}

/** Strict: anything outside the closed set makes the whole answer an error, so nothing odd is ever applied. */
export function parseInterpretation(body: unknown): Interpretation | null {
  if (!isRecord(body) || !Array.isArray(body.actions) || typeof body.remaining !== "number") return null;
  const status = body.status;
  if (status !== "ok" && status !== "nothing_understood" && status !== "too_many") return null;
  const actions = body.actions.map((a) => parseAction(a, true));
  if (actions.some((a) => a === null)) return null;
  return { status, actions: actions as VoiceAction[], remaining: body.remaining };
}

const FAILURES: Record<number, InterpretResult> = {
  400: { kind: "invalid" },
  429: { kind: "limit" },
  503: { kind: "unavailable" },
  502: { kind: "failed" },
  504: { kind: "failed" },
};

/** Sends the transcript, as text, to be turned into proposals. Nothing is changed by this call. */
export async function interpret(transcript: string, locale: Locale): Promise<InterpretResult> {
  try {
    const result = await authedRequest({ url: "/home/voice/interpret", method: "POST", data: { transcript, locale } });
    if (result.kind === "not-signed-in") return result;
    const { status, data } = result.response;
    if (status === 200) {
      const interpretation = parseInterpretation(data);
      return interpretation ? { kind: "ok", interpretation } : { kind: "error" };
    }
    return FAILURES[status] ?? { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}
