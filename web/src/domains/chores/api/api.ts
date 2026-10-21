import { parseFields, type FieldCodes } from "../../../shared/api/fieldErrors";
import { authedRequest } from "../../auth/api/client";

/** What a Resident edits about a Chore, as the API takes it. Weekdays are 0 to 6 with 0 = Sunday. */
export interface ChoreInput {
  name: string;
  /** A Category id. */
  category: string;
  /** Demand ids. */
  demands: string[];
  baseEffort: number;
  /** An Importance id: essential, normal or nice_to_have. */
  importance: string;
  people: number;
  /** Null means the Chore comes due once. */
  intervalDays: number | null;
  allowedWeekdays: number[];
  buildsUp: boolean;
}

/** A stored Chore, as the API returns it. */
export interface Chore extends ChoreInput {
  id: string;
}

/** A ChoreInput as sent. The interval may be the text typed, so the API can reject what was written. */
export type ChoreWire = Omit<ChoreInput, "intervalDays"> & { intervalDays: number | string | null };

export type Failure = { kind: "not-signed-in" } | { kind: "offline" } | { kind: "error" };

export type ListChoresResult = { kind: "ok"; chores: Chore[] } | Failure;

export type SaveChoreResult =
  | { kind: "ok"; chore: Chore }
  | { kind: "invalid"; fields: FieldCodes }
  /** 404: the Chore is already gone. Only an update can have it. */
  | { kind: "none" }
  | Failure;

export type DeleteChoreResult = { kind: "ok" } | { kind: "none" } | Failure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function parseChore(body: unknown): Chore | null {
  if (!isRecord(body)) return null;
  const { id, name, category, demands, baseEffort, importance, people, intervalDays, allowedWeekdays, buildsUp } = body;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof category !== "string" ||
    !isStringList(demands) ||
    typeof baseEffort !== "number" ||
    typeof importance !== "string" ||
    typeof people !== "number" ||
    !(intervalDays === null || typeof intervalDays === "number") ||
    !isNumberList(allowedWeekdays) ||
    typeof buildsUp !== "boolean"
  ) {
    return null;
  }
  return { id, name, category, demands, baseEffort, importance, people, intervalDays, allowedWeekdays, buildsUp };
}

export async function listChores(): Promise<ListChoresResult> {
  try {
    const result = await authedRequest({ url: "/home/chores" });
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const body: unknown = result.response.data;
    if (!isRecord(body) || !Array.isArray(body.chores)) return { kind: "error" };
    const chores = body.chores.map(parseChore);
    return chores.every((c) => c !== null) ? { kind: "ok", chores } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

async function save(path: string, method: "POST" | "PUT", input: ChoreWire, okStatus: number): Promise<SaveChoreResult> {
  try {
    const result = await authedRequest({ url: path, method, data: input });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === 404) return { kind: "none" };
    if (response.status === 400) {
      const fields = parseFields(response);
      return fields ? { kind: "invalid", fields } : { kind: "error" };
    }
    if (response.status !== okStatus) return { kind: "error" };
    const chore = parseChore(response.data);
    return chore ? { kind: "ok", chore } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

export function createChore(input: ChoreWire): Promise<SaveChoreResult> {
  return save("/home/chores", "POST", input, 201);
}

/** Replaces every field of the Chore. */
export function updateChore(id: string, input: ChoreWire): Promise<SaveChoreResult> {
  return save(`/home/chores/${encodeURIComponent(id)}`, "PUT", input, 200);
}

export async function deleteChore(id: string): Promise<DeleteChoreResult> {
  try {
    const result = await authedRequest({ url: `/home/chores/${encodeURIComponent(id)}`, method: "DELETE" });
    if (result.kind === "not-signed-in") return result;
    if (result.response.status === 404) return { kind: "none" };
    return result.response.status === 204 ? { kind: "ok" } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}
